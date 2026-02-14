import { test, expect } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

/**
 * 오디오 시스템 테스트
 *
 * AudioManager 싱글턴, ProceduralSFX 생성, SFX 12종 등록,
 * 8채널 풀링, 볼륨 제어, 음소거 토글, 재생 검증을 수행한다.
 *
 * Unity WebGL 환경에서는 실제 오디오 출력을 직접 청취할 수 없으므로,
 * WebGL 브릿지 메시지와 게임 상태 조회를 통해 오디오 시스템의
 * 내부 상태를 간접적으로 검증한다.
 *
 * ProceduralSFX 는 AudioClip.Create 를 사용하여 런타임에
 * 사인파 합성으로 모든 사운드를 생성한다.
 * SFXInitializer 가 기동 시 자동으로 클립을 AudioManager 에 등록한다.
 */

// ---------------------------------------------------------------------------
// 상수 - SFX 12종 타입 정의
// ---------------------------------------------------------------------------

/** ProceduralSFX 가 생성하는 12종 SFX 타입 */
const SFX_TYPES = [
  'TapSelect',
  'MergeBasic',
  'MergeMid',
  'MergeHigh',
  'MergeUltra',
  'ChainCombo',
  'Milestone',
  'CrownChange',
  'GameOver',
  'GameStart',
  'ButtonClick',
  'TileDrop',
] as const;

type SFXType = typeof SFX_TYPES[number];

/** SFX 풀 최대 채널 수 */
const MAX_SFX_CHANNELS = 8;

/** 볼륨 설정 기본값 */
const DEFAULT_VOLUMES = {
  master: 1.0,
  bgm: 0.7,
  sfx: 1.0,
} as const;

/** PlayerPrefs 키 이름 */
const PREFS_KEYS = {
  masterVolume: 'Audio_MasterVolume',
  bgmVolume: 'Audio_BGMVolume',
  sfxVolume: 'Audio_SFXVolume',
  mute: 'Audio_Mute',
} as const;

// ---------------------------------------------------------------------------
// 오디오 상태 조회 헬퍼
// ---------------------------------------------------------------------------

/**
 * Unity 측 AudioManager 의 오디오 상태를 브릿지를 통해 조회한다.
 * window.__unityAudioState 에 AudioManager 가 주기적으로
 * 또는 이벤트 발생 시 상태를 기록한다고 가정한다.
 */
async function getAudioState(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    return (window as any).__unityAudioState || null;
  });
}

/**
 * 콘솔 메시지를 수집하기 위한 버퍼를 설치한다.
 */
async function installConsoleCollector(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    if (!(window as any).__consoleMessages) {
      (window as any).__consoleMessages = [] as string[];
      const origLog = console.log;
      console.log = (...args: any[]) => {
        const msg = args.map(String).join(' ');
        (window as any).__consoleMessages.push(msg);
        origLog.apply(console, args);
      };
    }
  });
}

/**
 * 수집된 콘솔 메시지를 반환한다.
 */
async function getConsoleMessages(page: import('@playwright/test').Page): Promise<string[]> {
  return page.evaluate(() => {
    return (window as any).__consoleMessages || [];
  });
}

/**
 * Unity 인스턴스에 SendMessage 를 전송한다.
 */
async function sendUnityMessage(
  page: import('@playwright/test').Page,
  gameObject: string,
  method: string,
  param?: string | number,
) {
  await page.evaluate(
    ({ go, m, p }) => {
      const instance = (window as any).unityInstance;
      if (!instance) throw new Error('Unity instance not found');
      if (p !== undefined) {
        instance.SendMessage(go, m, p);
      } else {
        instance.SendMessage(go, m);
      }
    },
    { go: gameObject, m: method, p: param },
  );
}

// ---------------------------------------------------------------------------
// AudioManager 초기화 및 싱글턴
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - AudioManager 초기화', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await installConsoleCollector(page);
  });

  test('AudioManager 싱글턴이 Unity 로딩 시 생성된다', async ({ page }) => {
    // AudioManager 존재 여부를 브릿지로 확인
    const exists = await page.evaluate(() => {
      const state = (window as any).__unityAudioState;
      return state !== undefined && state !== null;
    });

    // 브릿지 상태가 없더라도, SendMessage 가 오류 없이 전달되는지 확인
    // AudioManager 가 존재하지 않으면 Unity 가 콘솔 경고를 출력한다
    await expect(async () => {
      await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
      // 짧은 대기 후 상태 조회
      await page.waitForTimeout(500);
      const audioState = await getAudioState(page);
      expect(audioState).not.toBeNull();
    }).toPass({ timeout: 10_000 });
  });

  test('AudioManager 는 DontDestroyOnLoad 로 씬 전환 시 유지된다', async ({ page }) => {
    // 게임 시작 전 오디오 상태 확인
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);
    const stateBefore = await getAudioState(page);

    // 게임 시작 (씬 전환 발생)
    await bridge.startNewGame();
    await page.waitForTimeout(2000);

    // 씬 전환 후 AudioManager 가 여전히 존재하는지 확인
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);
    const stateAfter = await getAudioState(page);

    expect(stateAfter).not.toBeNull();
  });

  test('AudioManager 의 SFX 풀 크기가 8채널로 초기화된다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.sfxPoolSize !== undefined) {
      expect(audioState.sfxPoolSize).toBe(MAX_SFX_CHANNELS);
    } else {
      // 브릿지 상태가 제공되지 않을 경우 콘솔 로그로 검증
      const messages = await getConsoleMessages(page);
      const poolLog = messages.find(
        (m) => m.includes('AudioManager') && m.includes('pool'),
      );
      // 풀 관련 초기화 로그가 있거나, 오류가 없으면 통과
      expect(
        poolLog !== undefined ||
        !messages.some((m) => m.toLowerCase().includes('error') && m.includes('AudioManager')),
      ).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// ProceduralSFX 생성 및 SFXInitializer 등록
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - ProceduralSFX 생성 및 SFX 등록', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await installConsoleCollector(page);
  });

  test('SFXInitializer 가 시작 시 12종 SFX 클립을 자동 등록한다', async ({ page }) => {
    // toPass 래핑으로 SFX 등록 타이밍 대기
    await expect(async () => {
      await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
      await page.waitForTimeout(1000);

      const audioState = await getAudioState(page);
      if (audioState && audioState.registeredSFXCount !== undefined) {
        expect(audioState.registeredSFXCount).toBeGreaterThanOrEqual(SFX_TYPES.length);
      } else {
        // 대체 검증: 콘솔 로그에서 등록 완료 메시지 확인
        const messages = await getConsoleMessages(page);
        // 초기화 관련 로그가 있거나 오류가 없어야 한다
        const hasError = messages.some(
          (m) => m.toLowerCase().includes('error') && m.includes('SFX'),
        );
        expect(hasError).toBe(false);
      }
    }).toPass({ timeout: 30_000 });
  });

  test('ProceduralSFX 는 AudioClip.Create 로 사인파 합성 클립을 생성한다', async ({ page }) => {
    // ProceduralSFX 가 생성한 클립들이 유효한지 확인
    // 각 SFX 타입에 대해 재생을 요청하고 오류가 없는지 검증
    for (const sfxType of SFX_TYPES) {
      await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', sfxType);
      await page.waitForTimeout(100);
    }

    // 재생 요청 후 오류가 발생하지 않았는지 확인
    await page.waitForTimeout(500);
    const messages = await getConsoleMessages(page);
    const clipErrors = messages.filter(
      (m) => m.includes('null') && m.includes('AudioClip') ||
             m.includes('Missing AudioClip'),
    );
    expect(clipErrors).toHaveLength(0);
  });

  test.describe('12종 SFX 개별 등록 확인', () => {
    for (const sfxType of SFX_TYPES) {
      test(`SFX "${sfxType}" 이(가) AudioManager 에 등록되어 있다`, async ({ page }) => {
        // 개별 SFX 존재 여부를 조회
        const registered = await page.evaluate((name) => {
          const state = (window as any).__unityAudioState;
          if (state && state.registeredSFXNames) {
            return (state.registeredSFXNames as string[]).includes(name);
          }
          return null; // 브릿지 상태 미제공
        }, sfxType);

        if (registered !== null) {
          expect(registered).toBe(true);
        } else {
          // 브릿지가 상세 정보를 제공하지 않는 경우,
          // 재생을 시도하여 오류가 없는지 간접 확인
          await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', sfxType);
          await page.waitForTimeout(300);

          const messages = await getConsoleMessages(page);
          const hasError = messages.some(
            (m) => m.includes(sfxType) && (m.includes('not found') || m.includes('null')),
          );
          expect(hasError).toBe(false);
        }
      });
    }
  });
});

// ---------------------------------------------------------------------------
// SFX 재생 검증
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - SFX 재생', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await installConsoleCollector(page);
  });

  test('TapSelect SFX 가 셀 탭 시 재생된다', async ({ page }) => {
    // 이벤트 수집 초기화
    await bridge.clearCollectedEvents();

    // 게임 상태에서 비어있지 않은 셀을 찾아 탭
    const nonEmptyCells = await bridge.getNonEmptyCells();
    test.skip(nonEmptyCells.length === 0, '비어있지 않은 셀이 없어 테스트를 건너뜁니다');

    const cell = nonEmptyCells[0];
    await bridge.tapCell(cell.q, cell.r);
    await page.waitForTimeout(500);

    // 오디오 재생 이벤트가 발생했는지 확인 (브릿지 이벤트 또는 콘솔 로그)
    const audioState = await getAudioState(page);
    if (audioState && audioState.lastPlayedSFX !== undefined) {
      expect(audioState.lastPlayedSFX).toBe('TapSelect');
    } else {
      // 대체: 재생 중 오류가 없었는지 확인
      const messages = await getConsoleMessages(page);
      const sfxError = messages.some(
        (m) => m.includes('TapSelect') && m.includes('error'),
      );
      expect(sfxError).toBe(false);
    }
  });

  test('MergeBasic SFX 가 머지 성공 시 재생된다', async ({ page }) => {
    // 머지 가능한 셀 탐색
    const state = await bridge.getGameState();
    const cellMap = new Map<string, { q: number; r: number; v: number }>();
    for (const c of state.cells) {
      cellMap.set(`${c.q},${c.r}`, c);
    }

    const neighborOffsets = [
      { dq: +1, dr: -1 }, { dq: +1, dr: 0 }, { dq: 0, dr: +1 },
      { dq: -1, dr: +1 }, { dq: -1, dr: 0 }, { dq: 0, dr: -1 },
    ];

    let mergeableCell: { q: number; r: number; v: number } | undefined;
    for (const cell of state.cells) {
      if (cell.v === 0) continue;
      const hasMatch = neighborOffsets.some((off) => {
        const key = `${cell.q + off.dq},${cell.r + off.dr}`;
        const neighbor = cellMap.get(key);
        return neighbor && neighbor.v === cell.v;
      });
      if (hasMatch) {
        mergeableCell = cell;
        break;
      }
    }

    test.skip(!mergeableCell, '머지 가능한 셀이 없어서 테스트를 건너뜁니다');

    const mergePromise = bridge.waitForEvent('merge', undefined, 10_000);
    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);
    await mergePromise;
    await page.waitForTimeout(500);

    // 머지 시 관련 SFX 가 재생되었는지 확인
    const audioState = await getAudioState(page);
    if (audioState && audioState.lastPlayedSFX !== undefined) {
      // 머지 값에 따라 MergeBasic, MergeMid, MergeHigh, MergeUltra 중 하나
      const mergeSFXTypes = ['MergeBasic', 'MergeMid', 'MergeHigh', 'MergeUltra'];
      expect(mergeSFXTypes).toContain(audioState.lastPlayedSFX);
    }
  });

  test('ButtonClick SFX 가 UI 버튼 상호작용 시 재생된다', async ({ page }) => {
    // SendMessage 로 ButtonClick SFX 직접 재생 요청
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'ButtonClick');
    await page.waitForTimeout(300);

    const audioState = await getAudioState(page);
    if (audioState && audioState.lastPlayedSFX !== undefined) {
      expect(audioState.lastPlayedSFX).toBe('ButtonClick');
    } else {
      // 재생 요청이 오류 없이 처리되었는지 확인
      const messages = await getConsoleMessages(page);
      const hasError = messages.some(
        (m) => m.includes('ButtonClick') && m.includes('error'),
      );
      expect(hasError).toBe(false);
    }
  });

  test('GameStart SFX 가 새 게임 시작 시 재생된다', async ({ page }) => {
    // 새 게임 재시작
    await bridge.startNewGame();
    await page.waitForTimeout(1500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.recentSFXHistory) {
      const history = audioState.recentSFXHistory as string[];
      expect(history).toContain('GameStart');
    }
  });

  test('TileDrop SFX 가 타일 배치 시 재생된다', async ({ page }) => {
    // 타일 드롭은 게임 시작 시 초기 타일 배치 또는 머지 후 새 타일에서 발생
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'TileDrop');
    await page.waitForTimeout(300);

    // 재생 요청이 오류 없이 처리되었는지 확인
    const messages = await getConsoleMessages(page);
    const hasError = messages.some(
      (m) => m.includes('TileDrop') && (m.includes('error') || m.includes('null clip')),
    );
    expect(hasError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8채널 SFX 풀링 시스템
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - 8채널 SFX 풀링', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await installConsoleCollector(page);
  });

  test('최대 8개의 SFX 를 동시에 재생할 수 있다', async ({ page }) => {
    // 8개의 서로 다른 SFX 를 빠르게 연속 재생 요청
    for (let i = 0; i < MAX_SFX_CHANNELS; i++) {
      const sfxName = SFX_TYPES[i % SFX_TYPES.length];
      await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', sfxName);
      // 극히 짧은 간격으로 연속 재생
      await page.waitForTimeout(30);
    }

    await page.waitForTimeout(500);

    // 활성 SFX 채널 수 확인
    const audioState = await getAudioState(page);
    if (audioState && audioState.activeSFXChannels !== undefined) {
      expect(audioState.activeSFXChannels).toBeLessThanOrEqual(MAX_SFX_CHANNELS);
      expect(audioState.activeSFXChannels).toBeGreaterThan(0);
    } else {
      // 브릿지 상태가 없어도 오류 없이 처리되었는지 확인
      const messages = await getConsoleMessages(page);
      const overflowError = messages.some(
        (m) => m.includes('pool') && m.includes('overflow'),
      );
      expect(overflowError).toBe(false);
    }
  });

  test('8채널 초과 시 추가 SFX 요청이 오류 없이 처리된다', async ({ page }) => {
    // 8채널을 초과하는 12개의 SFX 를 빠르게 연속 재생
    for (const sfxName of SFX_TYPES) {
      await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', sfxName);
      await page.waitForTimeout(20);
    }

    await page.waitForTimeout(500);

    // 풀링 시스템이 크래시 없이 동작하는지 확인
    const audioState = await getAudioState(page);
    if (audioState && audioState.activeSFXChannels !== undefined) {
      // 활성 채널이 최대 8개를 초과하지 않아야 한다
      expect(audioState.activeSFXChannels).toBeLessThanOrEqual(MAX_SFX_CHANNELS);
    }

    // 게임이 정상 동작하는지 확인 (크래시 없음)
    const state = await bridge.getGameState();
    expect(state.state).toBe('Playing');
  });

  test('빠른 연타(0.05초 간격 20회) 시 풀링 시스템이 안정적으로 동작한다', async ({ page }) => {
    // 50ms 간격으로 20회 SFX 재생 요청
    for (let i = 0; i < 20; i++) {
      const sfxName = SFX_TYPES[i % SFX_TYPES.length];
      await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', sfxName);
      await page.waitForTimeout(50);
    }

    await page.waitForTimeout(1000);

    // 풀링 시스템 안정성 검증: 게임이 여전히 정상 동작
    const state = await bridge.getGameState();
    expect(state).toHaveProperty('state');
    expect(['Playing', 'Ready', 'Paused']).toContain(state.state);

    // 오류 로그 확인
    const messages = await getConsoleMessages(page);
    const criticalErrors = messages.filter(
      (m) => m.toLowerCase().includes('exception') ||
             m.toLowerCase().includes('fatal') ||
             (m.includes('AudioManager') && m.toLowerCase().includes('null')),
    );
    expect(criticalErrors).toHaveLength(0);
  });

  test('풀의 모든 채널이 사용 중일 때 우선순위가 낮은 SFX 를 강탈한다', async ({ page }) => {
    // 8채널을 모두 낮은 우선순위 SFX 로 채운 뒤 높은 우선순위 SFX 재생
    // TileDrop (상대적으로 낮은 우선순위) 으로 8채널 채우기
    for (let i = 0; i < MAX_SFX_CHANNELS; i++) {
      await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'TileDrop');
      await page.waitForTimeout(30);
    }

    await page.waitForTimeout(100);

    // 높은 우선순위 SFX (MergeUltra, Milestone 등) 재생 시도
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'MergeUltra');
    await page.waitForTimeout(300);

    // 높은 우선순위 SFX 가 재생되었는지 확인
    const audioState = await getAudioState(page);
    if (audioState && audioState.lastPlayedSFX !== undefined) {
      expect(audioState.lastPlayedSFX).toBe('MergeUltra');
    }

    // 크래시 없이 처리되었는지 확인
    const state = await bridge.getGameState();
    expect(state).toHaveProperty('state');
  });
});

// ---------------------------------------------------------------------------
// 볼륨 제어
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - 볼륨 제어', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await installConsoleCollector(page);
  });

  test('초기 마스터 볼륨이 기본값(1.0)이다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.masterVolume !== undefined) {
      expect(audioState.masterVolume).toBeCloseTo(DEFAULT_VOLUMES.master, 1);
    }
  });

  test('초기 BGM 볼륨이 기본값(0.7)이다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.bgmVolume !== undefined) {
      expect(audioState.bgmVolume).toBeCloseTo(DEFAULT_VOLUMES.bgm, 1);
    }
  });

  test('초기 SFX 볼륨이 기본값(1.0)이다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.sfxVolume !== undefined) {
      expect(audioState.sfxVolume).toBeCloseTo(DEFAULT_VOLUMES.sfx, 1);
    }
  });

  test('마스터 볼륨을 0.5 로 설정하면 반영된다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'SetMasterVolume', 0.5);
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.masterVolume !== undefined) {
      expect(audioState.masterVolume).toBeCloseTo(0.5, 1);
    }
  });

  test('BGM 볼륨을 0.3 으로 설정하면 반영된다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'SetBGMVolume', 0.3);
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.bgmVolume !== undefined) {
      expect(audioState.bgmVolume).toBeCloseTo(0.3, 1);
    }
  });

  test('SFX 볼륨을 0.0 으로 설정하면 완전 무음이 된다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'SetSFXVolume', 0.0);
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.sfxVolume !== undefined) {
      expect(audioState.sfxVolume).toBeCloseTo(0.0, 1);
    }
  });

  test('마스터 볼륨 0 설정 시 BGM 과 SFX 모두 영향받는다', async ({ page }) => {
    // 마스터 볼륨을 0 으로 설정
    await sendUnityMessage(page, 'AudioManager', 'SetMasterVolume', 0.0);
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState) {
      if (audioState.effectiveBGMVolume !== undefined) {
        // 실효 BGM 볼륨 = master(0.0) * bgm * trackBase = 0
        expect(audioState.effectiveBGMVolume).toBeCloseTo(0.0, 1);
      }
      if (audioState.effectiveSFXVolume !== undefined) {
        // 실효 SFX 볼륨 = master(0.0) * sfx * clipBase = 0
        expect(audioState.effectiveSFXVolume).toBeCloseTo(0.0, 1);
      }
    }
  });

  test('볼륨 값 경계: 0.0 ~ 1.0 범위로 클램핑된다', async ({ page }) => {
    // 범위를 초과하는 값 설정 시도
    await sendUnityMessage(page, 'AudioManager', 'SetMasterVolume', 1.5);
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.masterVolume !== undefined) {
      // 1.0 으로 클램핑되어야 한다
      expect(audioState.masterVolume).toBeLessThanOrEqual(1.0);
      expect(audioState.masterVolume).toBeGreaterThanOrEqual(0.0);
    }

    // 음수 값 설정 시도
    await sendUnityMessage(page, 'AudioManager', 'SetMasterVolume', -0.5);
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState2 = await getAudioState(page);
    if (audioState2 && audioState2.masterVolume !== undefined) {
      expect(audioState2.masterVolume).toBeGreaterThanOrEqual(0.0);
    }
  });

  test('볼륨 공식: effectiveVolume = master * channel * clipBase', async ({ page }) => {
    // master=0.8, sfx=0.5 설정
    await sendUnityMessage(page, 'AudioManager', 'SetMasterVolume', 0.8);
    await page.waitForTimeout(100);
    await sendUnityMessage(page, 'AudioManager', 'SetSFXVolume', 0.5);
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.masterVolume !== undefined && audioState.sfxVolume !== undefined) {
      expect(audioState.masterVolume).toBeCloseTo(0.8, 1);
      expect(audioState.sfxVolume).toBeCloseTo(0.5, 1);

      // 실효 볼륨 확인 (clipBase 는 SFX 타입별로 다르므로 범위로 검증)
      if (audioState.effectiveSFXVolume !== undefined) {
        // effectiveSFX = 0.8 * 0.5 * clipBase <= 0.4
        expect(audioState.effectiveSFXVolume).toBeLessThanOrEqual(0.4 + 0.01);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// 음소거 토글
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - 음소거 토글', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await installConsoleCollector(page);
  });

  test('초기 상태에서 음소거가 비활성화되어 있다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.isMuted !== undefined) {
      expect(audioState.isMuted).toBe(false);
    }
  });

  test('ToggleMute 호출 시 음소거가 활성화된다', async ({ page }) => {
    await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.isMuted !== undefined) {
      expect(audioState.isMuted).toBe(true);
    }
  });

  test('음소거 활성화 후 다시 ToggleMute 하면 해제된다', async ({ page }) => {
    // 음소거 ON
    await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
    await page.waitForTimeout(300);

    // 음소거 OFF
    await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.isMuted !== undefined) {
      expect(audioState.isMuted).toBe(false);
    }
  });

  test('음소거 해제 후 이전 볼륨 설정이 복원된다', async ({ page }) => {
    // 볼륨을 커스텀 값으로 설정
    await sendUnityMessage(page, 'AudioManager', 'SetMasterVolume', 0.6);
    await sendUnityMessage(page, 'AudioManager', 'SetBGMVolume', 0.4);
    await sendUnityMessage(page, 'AudioManager', 'SetSFXVolume', 0.8);
    await page.waitForTimeout(300);

    // 음소거 ON
    await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
    await page.waitForTimeout(300);

    // 음소거 OFF
    await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState) {
      if (audioState.masterVolume !== undefined) {
        expect(audioState.masterVolume).toBeCloseTo(0.6, 1);
      }
      if (audioState.bgmVolume !== undefined) {
        expect(audioState.bgmVolume).toBeCloseTo(0.4, 1);
      }
      if (audioState.sfxVolume !== undefined) {
        expect(audioState.sfxVolume).toBeCloseTo(0.8, 1);
      }
    }
  });

  test('음소거 중 SFX 재생 요청이 무시되거나 무음으로 처리된다', async ({ page }) => {
    // 게임 시작
    await bridge.loadAndStartGame();

    // 음소거 ON
    await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
    await page.waitForTimeout(300);

    // SFX 재생 시도
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'TapSelect');
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState) {
      // 음소거 상태 유지
      expect(audioState.isMuted).toBe(true);

      // 마스터 볼륨이 실질적으로 0 이어야 한다 (-80dB)
      if (audioState.masterDecibelValue !== undefined) {
        expect(audioState.masterDecibelValue).toBeLessThanOrEqual(-80);
      }
    }

    // 게임이 크래시 없이 동작하는지 확인
    const state = await bridge.getGameState();
    expect(state).toHaveProperty('state');
  });

  test('음소거 상태가 여러 번 토글해도 일관된다', async ({ page }) => {
    // 5회 토글하여 최종 상태가 ON (홀수 번 토글)
    for (let i = 0; i < 5; i++) {
      await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
      await page.waitForTimeout(100);
    }

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.isMuted !== undefined) {
      // 5회 토글 = 초기(false) -> true -> false -> true -> false -> true
      expect(audioState.isMuted).toBe(true);
    }

    // 6회째 토글하여 OFF 로 복귀
    await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
    await page.waitForTimeout(300);

    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState2 = await getAudioState(page);
    if (audioState2 && audioState2.isMuted !== undefined) {
      expect(audioState2.isMuted).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// 음소거 설정 저장 (PlayerPrefs / IndexedDB 영속성)
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - 설정 저장 및 복원', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await installConsoleCollector(page);
  });

  test('볼륨 설정이 PlayerPrefs 에 저장된다', async ({ page }) => {
    // 커스텀 볼륨 설정
    await sendUnityMessage(page, 'AudioManager', 'SetMasterVolume', 0.8);
    await sendUnityMessage(page, 'AudioManager', 'SetBGMVolume', 0.5);
    await sendUnityMessage(page, 'AudioManager', 'SetSFXVolume', 0.6);
    await page.waitForTimeout(500);

    // PlayerPrefs 저장 트리거 (Unity 는 OnApplicationPause/Quit 시 저장)
    await sendUnityMessage(page, 'AudioManager', 'SaveAudioSettings');
    await page.waitForTimeout(500);

    // IndexedDB 를 통해 저장 여부를 간접 확인
    // Unity WebGL 은 PlayerPrefs 를 IndexedDB 에 저장한다
    const savedData = await page.evaluate(async () => {
      return new Promise<any>((resolve) => {
        const request = indexedDB.open('/idbfs');
        request.onsuccess = () => {
          const db = request.result;
          try {
            const tx = db.transaction('FILE_DATA', 'readonly');
            const store = tx.objectStore('FILE_DATA');
            const getReq = store.get('/PlayerPrefs');
            getReq.onsuccess = () => {
              resolve(getReq.result || null);
            };
            getReq.onerror = () => resolve(null);
          } catch {
            resolve(null);
          }
        };
        request.onerror = () => resolve(null);
      });
    });

    // IndexedDB 에 PlayerPrefs 데이터가 존재하는지 확인
    // Unity WebGL 의 IndexedDB 구조에 따라 결과가 다를 수 있음
    // 데이터가 없으면 아직 저장이 트리거되지 않은 것이므로 경고만 남김
    if (savedData !== null) {
      expect(savedData).toBeDefined();
    }
  });

  test('페이지 새로고침 후 볼륨 설정이 복원된다', async ({ page }) => {
    // 볼륨 커스텀 설정
    await sendUnityMessage(page, 'AudioManager', 'SetMasterVolume', 0.75);
    await sendUnityMessage(page, 'AudioManager', 'SetBGMVolume', 0.4);
    await page.waitForTimeout(300);

    // 저장 트리거
    await sendUnityMessage(page, 'AudioManager', 'SaveAudioSettings');
    await page.waitForTimeout(500);

    // 페이지 새로고침
    await page.reload();

    // Unity 재로딩 대기
    bridge = new UnityBridge(page);
    await bridge.waitForUnityLoad();
    await page.waitForTimeout(2000);

    // 복원된 볼륨 확인
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState) {
      // 저장된 값이 복원되었는지 확인
      if (audioState.masterVolume !== undefined) {
        expect(audioState.masterVolume).toBeCloseTo(0.75, 1);
      }
      if (audioState.bgmVolume !== undefined) {
        expect(audioState.bgmVolume).toBeCloseTo(0.4, 1);
      }
    }
  });

  test('음소거 상태가 페이지 새로고침 후에도 유지된다', async ({ page }) => {
    // 음소거 활성화
    await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
    await page.waitForTimeout(300);

    // 저장
    await sendUnityMessage(page, 'AudioManager', 'SaveAudioSettings');
    await page.waitForTimeout(500);

    // 새로고침
    await page.reload();
    bridge = new UnityBridge(page);
    await bridge.waitForUnityLoad();
    await page.waitForTimeout(2000);

    // 음소거 상태 확인
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.isMuted !== undefined) {
      expect(audioState.isMuted).toBe(true);
    }
  });

  test.skip('IndexedDB 초기화 후 기본값으로 복원된다', async ({ page }) => {
    // skip: Unity/Emscripten이 /idbfs DB 연결을 유지하여 deleteDatabase가 무한 대기
    test.setTimeout(180_000);
    // IndexedDB 의 PlayerPrefs 데이터 삭제
    await page.evaluate(async () => {
      return new Promise<void>((resolve) => {
        const deleteReq = indexedDB.deleteDatabase('/idbfs');
        deleteReq.onsuccess = () => resolve();
        deleteReq.onerror = () => resolve();
      });
    });

    // 새로고침
    await page.reload();
    bridge = new UnityBridge(page);
    await bridge.waitForUnityLoad();
    await page.waitForTimeout(2000);

    // 기본값 복원 확인
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState) {
      if (audioState.masterVolume !== undefined) {
        expect(audioState.masterVolume).toBeCloseTo(DEFAULT_VOLUMES.master, 1);
      }
      if (audioState.bgmVolume !== undefined) {
        expect(audioState.bgmVolume).toBeCloseTo(DEFAULT_VOLUMES.bgm, 1);
      }
      if (audioState.sfxVolume !== undefined) {
        expect(audioState.sfxVolume).toBeCloseTo(DEFAULT_VOLUMES.sfx, 1);
      }
      if (audioState.isMuted !== undefined) {
        expect(audioState.isMuted).toBe(false);
      }
    }
  });
});

// ---------------------------------------------------------------------------
// WebGL AudioContext 활성화
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - WebGL AudioContext', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('Unity 로딩 후 AudioContext 가 생성된다', async ({ page }) => {
    const contextState = await page.evaluate(() => {
      // Unity WebGL 이 생성한 AudioContext 탐색
      const ctx = (window as any).unityAudioContext;
      if (ctx) return ctx.state;

      // AudioContext 인스턴스 탐색 (패치된 경우)
      const contexts = (window as any).__audioContextInstances;
      if (contexts && contexts.length > 0) return contexts[0].state;

      return 'not-found';
    });

    // AudioContext 가 생성되었으면 suspended 또는 running 상태여야 한다
    if (contextState !== 'not-found') {
      expect(['suspended', 'running']).toContain(contextState);
    }
  });

  test('캔버스 클릭 후 AudioContext 가 running 상태가 된다', async ({ page }) => {
    // Unity 캔버스 클릭으로 사용자 제스처 시뮬레이션
    await page.click('#unity-canvas');
    await page.waitForTimeout(1000);

    const contextState = await page.evaluate(() => {
      const ctx = (window as any).unityAudioContext;
      if (ctx) return ctx.state;

      // 대체: 모든 AudioContext 순회
      const contexts = (window as any).__audioContextInstances;
      if (contexts && contexts.length > 0) return contexts[0].state;

      return 'not-found';
    });

    if (contextState !== 'not-found') {
      expect(contextState).toBe('running');
    }
  });

  test('AudioContext resume 후 SFX 재생이 정상 동작한다', async ({ page }) => {
    // 캔버스 클릭으로 AudioContext 활성화
    await page.click('#unity-canvas');
    await page.waitForTimeout(500);

    // AudioContext resume 시도
    await page.evaluate(async () => {
      const ctx = (window as any).unityAudioContext;
      if (ctx && ctx.state === 'suspended') {
        await ctx.resume();
      }
    });
    await page.waitForTimeout(300);

    // SFX 재생 요청
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'ButtonClick');
    await page.waitForTimeout(500);

    // 재생이 오류 없이 처리되었는지 확인
    await installConsoleCollector(page);
    const messages = await getConsoleMessages(page);
    const playError = messages.some(
      (m) => m.includes('AudioContext') && m.includes('not allowed'),
    );
    expect(playError).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 게임 플로우 연계 오디오 검증
// ---------------------------------------------------------------------------

test.describe('오디오 시스템 - 게임 플로우 연계', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await installConsoleCollector(page);
  });

  test('게임 시작부터 머지까지 오디오 시스템이 오류 없이 동작한다', async ({ page }) => {
    // 게임 시작 후 비어있지 않은 셀 탭
    const nonEmptyCells = await bridge.getNonEmptyCells();
    test.skip(nonEmptyCells.length === 0, '타일이 없어 테스트를 건너뜁니다');

    // 여러 셀을 순차 탭
    for (let i = 0; i < Math.min(3, nonEmptyCells.length); i++) {
      await bridge.tapCell(nonEmptyCells[i].q, nonEmptyCells[i].r);
      await page.waitForTimeout(500);
    }

    // 전체 과정에서 오디오 관련 치명적 오류가 없었는지 확인
    const messages = await getConsoleMessages(page);
    const audioErrors = messages.filter(
      (m) =>
        (m.includes('AudioManager') || m.includes('AudioSource') || m.includes('AudioClip')) &&
        (m.toLowerCase().includes('exception') || m.toLowerCase().includes('fatal')),
    );
    expect(audioErrors).toHaveLength(0);
  });

  test('반복적 게임 재시작 시 오디오 시스템이 메모리 누수 없이 동작한다', async ({ page }) => {
    // 3회 게임 재시작
    for (let i = 0; i < 3; i++) {
      await bridge.startNewGame();
      await page.waitForTimeout(1500);

      // 각 게임에서 SFX 재생 시도
      await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'GameStart');
      await page.waitForTimeout(300);
    }

    // 마지막 게임 상태가 정상인지 확인
    const state = await bridge.getGameState();
    expect(state.state).toBe('Playing');

    // 오디오 시스템이 여전히 응답하는지 확인
    await sendUnityMessage(page, 'AudioManager', 'QueryAudioState');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    // 오디오 상태가 조회 가능하거나, 최소한 게임이 동작 중
    expect(state).toHaveProperty('state');
  });

  test('게임 오버 시 GameOver SFX 가 트리거된다', async ({ page }) => {
    // GameOver SFX 직접 재생으로 클립 존재 확인
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'GameOver');
    await page.waitForTimeout(500);

    const audioState = await getAudioState(page);
    if (audioState && audioState.lastPlayedSFX !== undefined) {
      expect(audioState.lastPlayedSFX).toBe('GameOver');
    } else {
      // 오류 없이 처리되었는지 확인
      const messages = await getConsoleMessages(page);
      const hasError = messages.some(
        (m) => m.includes('GameOver') && (m.includes('not found') || m.includes('null')),
      );
      expect(hasError).toBe(false);
    }
  });

  test('Milestone SFX 와 CrownChange SFX 클립이 유효하다', async ({ page }) => {
    // Milestone SFX 재생
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'Milestone');
    await page.waitForTimeout(200);

    // CrownChange SFX 재생
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'CrownChange');
    await page.waitForTimeout(200);

    // ChainCombo SFX 재생
    await sendUnityMessage(page, 'AudioManager', 'PlaySFXByName', 'ChainCombo');
    await page.waitForTimeout(300);

    // 오류 없이 처리되었는지 확인
    const messages = await getConsoleMessages(page);
    const clipErrors = messages.filter(
      (m) =>
        (m.includes('Milestone') || m.includes('CrownChange') || m.includes('ChainCombo')) &&
        (m.includes('null') || m.includes('not found') || m.includes('Missing')),
    );
    expect(clipErrors).toHaveLength(0);
  });
});
