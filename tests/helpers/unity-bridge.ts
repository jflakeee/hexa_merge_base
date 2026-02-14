import { Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// 타입 정의
// ---------------------------------------------------------------------------

/** Unity 에서 전달되는 셀 정보 */
export interface CellInfo {
  q: number;
  r: number;
  /** 타일 값 (0 이면 빈 셀) */
  v: number;
}

/** JS_GetGameState 콜백으로 받는 전체 게임 상태 */
export interface GameStatePayload {
  callbackId: string;
  state: 'Ready' | 'Playing' | 'Paused' | 'GameOver';
  score: number;
  highScore: number;
  cells: CellInfo[];
}

/** Unity 에서 JS 로 전달되는 이벤트 유니온 타입 */
export type UnityEvent =
  | { event: 'stateChanged'; state: string }
  | { event: 'merge'; value: number; count: number; score: number }
  | { event: 'scoreChanged'; score: number };

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

/** Unity WebGL 인스턴스가 window 에 바인딩되는 기본 변수명 */
const UNITY_INSTANCE_VAR = 'unityInstance';

/** Unity → JS 커스텀 이벤트 이름 (HexaMergeBridge.jslib 에서 dispatch) */
const UNITY_MESSAGE_EVENT = 'unityMessage';

/** WebGLBridge 컴포넌트가 부착된 GameObject 이름 */
const BRIDGE_OBJECT_NAME = 'GameManager';

/** Unity WebGL 로딩 완료 대기 기본 타임아웃 (ms) */
const DEFAULT_LOAD_TIMEOUT = 90_000;

/** 게임 상태 콜백 대기 기본 타임아웃 (ms) */
const DEFAULT_CALLBACK_TIMEOUT = 15_000;

// ---------------------------------------------------------------------------
// 25셀 다이아몬드 그리드 좌표 유틸리티
// ---------------------------------------------------------------------------

/**
 * 25셀 다이아몬드 그리드의 모든 (q, r) 좌표를 반환한다.
 * 행 구성: 1-2-3-4-5-4-3-2-1 (gridRadius = 4)
 *
 * HexGrid.cs 의 Initialize() 로직과 동일한 좌표 생성.
 */
export function getAllGridCoords(): Array<{ q: number; r: number }> {
  const coords: Array<{ q: number; r: number }> = [];
  const gridRadius = 4;

  for (let r = -gridRadius; r <= gridRadius; r++) {
    const rowWidth = gridRadius + 1 - Math.abs(r);
    const qStart = -Math.floor((rowWidth - 1) / 2);
    const qEnd = Math.floor(rowWidth / 2);

    for (let q = qStart; q <= qEnd; q++) {
      coords.push({ q, r });
    }
  }

  return coords;
}

// ---------------------------------------------------------------------------
// Unity WebGL Bridge 헬퍼 클래스
// ---------------------------------------------------------------------------

/**
 * Playwright Page 객체를 감싸서 Unity WebGL 인스턴스와
 * SendMessage / 이벤트 수신을 쉽게 수행할 수 있도록 하는 헬퍼.
 */
export class UnityBridge {
  constructor(private readonly page: Page) {}

  // -----------------------------------------------------------------------
  // 초기화 / 로딩
  // -----------------------------------------------------------------------

  /**
   * Unity WebGL 인스턴스가 window 에 할당될 때까지 대기한다.
   * index.html 에서 createUnityInstance() 완료 후 window.unityInstance 에 할당되어야 함.
   */
  async waitForUnityLoad(timeout = DEFAULT_LOAD_TIMEOUT): Promise<void> {
    await this.page.waitForFunction(
      (varName: string) => {
        return typeof (window as any)[varName] !== 'undefined' &&
               (window as any)[varName] !== null;
      },
      UNITY_INSTANCE_VAR,
      { timeout },
    );

    // Unity → JS 이벤트 수집 버퍼를 페이지에 설치
    await this.page.evaluate(() => {
      if (!(window as any).__unityEvents) {
        (window as any).__unityEvents = [] as any[];
        window.addEventListener('unityMessage', ((e: CustomEvent) => {
          (window as any).__unityEvents.push(e.detail);
        }) as EventListener);
      }
    });
  }

  // -----------------------------------------------------------------------
  // SendMessage 래퍼 (JS → Unity)
  // -----------------------------------------------------------------------

  /**
   * Unity 오브젝트에 SendMessage 를 보낸다.
   */
  async sendMessage(objectName: string, methodName: string, value: string = ''): Promise<void> {
    await this.page.evaluate(
      ({ varName, obj, method, val }) => {
        (window as any)[varName].SendMessage(obj, method, val);
      },
      { varName: UNITY_INSTANCE_VAR, obj: objectName, method: methodName, val: value },
    );
  }

  /**
   * 새 게임을 시작한다.
   */
  async startNewGame(): Promise<void> {
    await this.sendMessage(BRIDGE_OBJECT_NAME, 'JS_StartNewGame', '');
  }

  /**
   * 특정 셀을 탭한다.
   */
  async tapCell(q: number, r: number): Promise<void> {
    await this.sendMessage(BRIDGE_OBJECT_NAME, 'JS_TapCell', `${q},${r}`);
  }

  /**
   * 게임 상태를 조회한다.
   * JS_GetGameState 를 호출하고, Unity 가 SendMessageToJS 로 응답할 때까지 대기.
   */
  async getGameState(timeout = DEFAULT_CALLBACK_TIMEOUT): Promise<GameStatePayload> {
    const callbackId = `cb_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    return this.page.evaluate(
      ({ varName, bridgeName, cbId, timeoutMs }) => {
        return new Promise<any>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`게임 상태 콜백 타임아웃: ${cbId}`));
          }, timeoutMs);

          const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.callbackId === cbId) {
              clearTimeout(timer);
              window.removeEventListener('unityMessage', handler);
              resolve(detail);
            }
          };
          window.addEventListener('unityMessage', handler);

          // Unity 에 요청 전송
          (window as any)[varName].SendMessage(bridgeName, 'JS_GetGameState', cbId);
        });
      },
      { varName: UNITY_INSTANCE_VAR, bridgeName: BRIDGE_OBJECT_NAME, cbId: callbackId, timeoutMs: timeout },
    ) as Promise<GameStatePayload>;
  }

  // -----------------------------------------------------------------------
  // 이벤트 수신 헬퍼 (Unity → JS)
  // -----------------------------------------------------------------------

  /**
   * 특정 이벤트가 발생할 때까지 대기한다.
   * @param eventName - 'stateChanged' | 'merge' | 'scoreChanged'
   * @param predicate - 추가 필터 조건 (선택)
   * @param timeout - 대기 타임아웃 (ms)
   */
  async waitForEvent<T extends UnityEvent>(
    eventName: string,
    predicate?: (detail: T) => boolean,
    timeout = DEFAULT_CALLBACK_TIMEOUT,
  ): Promise<T> {
    return this.page.evaluate(
      ({ evtName, timeoutMs }) => {
        return new Promise<any>((resolve, reject) => {
          const timer = setTimeout(() => {
            reject(new Error(`Unity 이벤트 대기 타임아웃: ${evtName}`));
          }, timeoutMs);

          const handler = (e: Event) => {
            const detail = (e as CustomEvent).detail;
            if (detail && detail.event === evtName) {
              clearTimeout(timer);
              window.removeEventListener('unityMessage', handler);
              resolve(detail);
            }
          };
          window.addEventListener('unityMessage', handler);
        });
      },
      { evtName: eventName, timeoutMs: timeout },
    ) as Promise<T>;
  }

  /**
   * 수집된 모든 Unity 이벤트 목록을 반환한다.
   * waitForUnityLoad() 호출 이후 쌓인 이벤트들을 조회.
   */
  async getCollectedEvents(): Promise<UnityEvent[]> {
    return this.page.evaluate(() => {
      return (window as any).__unityEvents || [];
    });
  }

  /**
   * 수집된 이벤트 버퍼를 초기화한다.
   */
  async clearCollectedEvents(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).__unityEvents = [];
    });
  }

  // -----------------------------------------------------------------------
  // 편의 메서드
  // -----------------------------------------------------------------------

  /**
   * Unity 로딩 완료 후 새 게임을 시작하고, 'Playing' 상태가 될 때까지 대기.
   * 테스트 beforeEach 에서 주로 사용.
   *
   * GameplayController.Start() 에서 자동으로 StartNewGame 이 호출되므로,
   * Unity 로드 후 이미 Playing 상태일 수 있다.
   * 그 경우 명시적 StartNewGame + 이벤트 대기를 건너뛴다.
   *
   * stateChanged 이벤트는 auto-start와 경합하여 비신뢰적이므로
   * getGameState() 폴링 방식을 사용한다.
   */
  async loadAndStartGame(timeout = DEFAULT_LOAD_TIMEOUT): Promise<void> {
    await this.waitForUnityLoad(timeout);

    // Unity 초기화 직후 약간의 대기 (GameplayController.Start 자동 시작 대기)
    await this.page.waitForTimeout(500);

    // getGameState 로 현재 상태 확인
    const state = await this.getGameState();
    if (state.state === 'Playing') {
      return;
    }

    // Playing 이 아니면 명시적으로 시작
    await this.sendMessage(BRIDGE_OBJECT_NAME, 'JS_StartNewGame', '');

    // 폴링으로 Playing 상태 대기 (SwiftShader 저FPS 환경 감안 60초)
    const deadline = Date.now() + 60_000;
    while (Date.now() < deadline) {
      await this.page.waitForTimeout(500);
      const current = await this.getGameState();
      if (current.state === 'Playing') {
        return;
      }
    }
    throw new Error('Playing 상태 대기 타임아웃');
  }

  /**
   * 현재 보드에서 비어있지 않은 셀 목록을 반환한다.
   */
  async getNonEmptyCells(): Promise<CellInfo[]> {
    const state = await this.getGameState();
    return state.cells.filter((c) => c.v > 0);
  }

  /**
   * 현재 점수를 반환한다.
   */
  async getCurrentScore(): Promise<number> {
    const state = await this.getGameState();
    return state.score;
  }
}
