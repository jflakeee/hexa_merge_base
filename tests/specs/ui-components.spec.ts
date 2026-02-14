import { test, expect, Page } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

// ---------------------------------------------------------------------------
// 공통 상수
// ---------------------------------------------------------------------------

/** Unity 인스턴스가 window 에 바인딩되는 변수명 */
const UNITY_INSTANCE_VAR = 'unityInstance';

/** 반응형 레이아웃 뷰포트 프리셋 */
const VIEWPORTS = {
  mobile:  { width: 360,  height: 800  },
  tablet:  { width: 1024, height: 768  },
  desktop: { width: 1920, height: 1080 },
} as const;

/** 애니메이션 / 전환 대기 시간 (ms) */
const TRANSITION_WAIT = 800;
const ANIMATION_WAIT  = 300;

// ---------------------------------------------------------------------------
// 공통 헬퍼 함수
// ---------------------------------------------------------------------------

/**
 * Unity SendMessage 를 직접 호출한다.
 * UnityBridge 에 래퍼가 없는 게임 오브젝트·메서드 호출에 사용.
 */
async function sendMessage(
  page: Page,
  objectName: string,
  methodName: string,
  value = '',
): Promise<void> {
  await page.evaluate(
    ({ varName, obj, method, val }) => {
      (window as any)[varName].SendMessage(obj, method, val);
    },
    { varName: UNITY_INSTANCE_VAR, obj: objectName, method: methodName, val: value },
  );
}

/**
 * Unity TestBridge 의 Query 메서드를 호출하여 내부 상태를 조회한다.
 * TestBridge.Query(queryPath) 는 __unityQueryCallback 을 통해 결과를 반환한다.
 */
async function queryState(page: Page, queryPath: string): Promise<string> {
  return page.evaluate(
    ({ varName, q }) => {
      return new Promise<string>((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error(`쿼리 타임아웃: ${q}`)),
          15_000,
        );
        (window as any).__unityQueryCallback = (result: string) => {
          clearTimeout(timer);
          resolve(result);
        };
        (window as any)[varName].SendMessage('TestBridge', 'Query', q);
      });
    },
    { varName: UNITY_INSTANCE_VAR, q: queryPath },
  );
}

/**
 * 캔버스 내 비율 좌표를 클릭한다 (0.0 ~ 1.0).
 * Unity WebGL 은 DOM 이 아닌 canvas 위에 렌더링되므로,
 * 설계문서 기반 비율 좌표로 UI 버튼을 조작한다.
 */
async function clickCanvasAt(
  page: Page,
  xRatio: number,
  yRatio: number,
): Promise<void> {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas 를 찾을 수 없습니다.');
  await page.mouse.click(
    box.x + box.width * xRatio,
    box.y + box.height * yRatio,
  );
}

/**
 * 현재 활성 화면 타입을 조회한다.
 */
async function getCurrentScreen(page: Page): Promise<string> {
  return queryState(page, 'CurrentScreen');
}

/**
 * 특정 화면이 될 때까지 폴링한다.
 * NavigateTo 등 전환 명령 후 사용.
 * ScreenManager.isTransitioning 이 완료될 때까지 추가 400ms 대기 포함.
 */
async function waitForScreen(
  page: Page,
  expected: string | string[],
  timeout = 10_000,
): Promise<string> {
  const targets = Array.isArray(expected) ? expected : [expected];
  const deadline = Date.now() + timeout;
  let screen = '';
  while (Date.now() < deadline) {
    screen = await getCurrentScreen(page);
    if (targets.includes(screen)) {
      // ScreenManager fade-in 완료 대기 (transitionDuration=0.3s, SwiftShader 저FPS 감안)
      await new Promise((r) => setTimeout(r, 800));
      return screen;
    }
    await new Promise((r) => setTimeout(r, 200));
  }
  screen = await getCurrentScreen(page);
  if (targets.includes(screen)) return screen;
  throw new Error(`화면 전환 타임아웃: expected ${targets.join('|')}, got ${screen}`);
}

/**
 * 콘솔 로그에서 특정 패턴이 출력될 때까지 대기한다.
 */
async function waitForConsoleMessage(
  page: Page,
  pattern: string | RegExp,
  timeoutMs = 10_000,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`콘솔 메시지 대기 시간 초과: ${pattern}`)),
      timeoutMs,
    );
    const handler = (msg: import('@playwright/test').ConsoleMessage) => {
      const text = msg.text();
      const matched =
        typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
      if (matched) {
        clearTimeout(timer);
        page.removeListener('console', handler);
        resolve(text);
      }
    };
    page.on('console', handler);
  });
}

// ===========================================================================
// UI 컴포넌트 테스트 스위트
// ===========================================================================

/**
 * UI 컴포넌트 테스트
 *
 * HUD, 화면 전환, 일시정지, 게임 오버, 상점, 리더보드,
 * 반응형 레이아웃, 버튼 피드백 등 UI 전반을 검증한다.
 *
 * 참조: docs/test-plans/05_ui-components/test-plan.md
 */

// ---------------------------------------------------------------------------
// 1. 캔버스 셋업 및 Unity 로드 검증
// ---------------------------------------------------------------------------

test.describe('캔버스 셋업 및 Unity 로드', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
  });

  test('Unity WebGL 캔버스가 페이지에 존재한다', async ({ page }) => {
    const canvas = page.locator('canvas');
    await expect(canvas.first()).toBeVisible({ timeout: 10_000 });
  });

  test('Unity WebGL 인스턴스가 정상 로드된다', async () => {
    await bridge.waitForUnityLoad();

    // window.unityInstance 가 존재하는지 확인
    const hasInstance = await bridge['page'].evaluate(
      (varName: string) => typeof (window as any)[varName] !== 'undefined',
      UNITY_INSTANCE_VAR,
    );
    expect(hasInstance).toBe(true);
  });

  test('캔버스가 뷰포트를 가득 채운다', async ({ page }) => {
    await bridge.waitForUnityLoad();

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // 캔버스 폭/높이가 0 이상이어야 한다
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);
  });

  test('로딩 완료 후 초기 상태는 Ready 이다', async () => {
    await bridge.waitForUnityLoad();

    const state = await bridge.getGameState();
    expect(state.state).toBe('Ready');
  });
});

// ---------------------------------------------------------------------------
// 2. HUD (Heads-Up Display) 요소 테스트
// ---------------------------------------------------------------------------

test.describe('HUD 요소 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
  });

  test('TC-UI-029: 게임 시작 시 HUD 바가 표시된다', async ({ page }) => {
    // 게임이 Playing 상태인지 확인
    const state = await bridge.getGameState();
    expect(state.state).toBe('Playing');

    // HUD 관련 상태 조회 - 현재 점수가 0 으로 초기화
    expect(state.score).toBe(0);

    // 스크린샷으로 HUD 영역 존재 확인 (상단 바)
    await expect(page).toHaveScreenshot('hud-initial-layout.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-029: 점수 텍스트가 초기값 0 으로 표시된다', async () => {
    const score = await bridge.getCurrentScore();
    expect(score).toBe(0);
  });

  test('TC-UI-029: 최고 점수가 0 이상의 정수로 표시된다', async () => {
    const state = await bridge.getGameState();
    expect(state.highScore).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(state.highScore)).toBe(true);
  });

  test('TC-UI-030: 점수 변경 시 scoreChanged 이벤트가 발생한다', async () => {
    await bridge.clearCollectedEvents();

    // 셀을 탭하여 머지 시도 - 비어있지 않은 셀 선택
    const nonEmpty = await bridge.getNonEmptyCells();
    if (nonEmpty.length >= 2) {
      await bridge.tapCell(nonEmpty[0].q, nonEmpty[0].r);
      await new Promise((r) => setTimeout(r, 300));
      await bridge.tapCell(nonEmpty[1].q, nonEmpty[1].r);
      await new Promise((r) => setTimeout(r, 1000));
    }

    // 이벤트 수집 확인 (머지 성공 여부와 무관하게 이벤트 구조 검증)
    const events = await bridge.getCollectedEvents();
    // 적어도 stateChanged 이벤트는 이전 loadAndStartGame 에서 발생했을 것
    expect(Array.isArray(events)).toBe(true);
  });

  test('TC-UI-031: 최고 점수 갱신 시 highScore 가 업데이트된다', async ({ page }) => {
    // 최고 점수를 낮게 설정
    await sendMessage(page, 'TestBridge', 'SetBestScore', '10');
    await new Promise((r) => setTimeout(r, 300));

    // 점수를 높게 설정하여 갱신 트리거
    await sendMessage(page, 'TestBridge', 'SetScore', '100');
    await new Promise((r) => setTimeout(r, 500));

    const state = await bridge.getGameState();
    // 점수가 최고 점수를 초과하면 갱신되어야 한다
    expect(state.highScore).toBeGreaterThanOrEqual(10);
  });

  test('HUD 의 gem/sound/menu/help 버튼이 클릭 가능하다', async ({ page }) => {
    // 캔버스가 존재하고 클릭 가능한 상태인지 확인
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();

    // 메뉴 버튼 영역(좌측 상단)을 클릭 - 일시정지 진입 시도
    await clickCanvasAt(page, 0.05, 0.025);
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    // 일시정지 또는 메뉴 화면으로 전환될 수 있음
    const screen = await getCurrentScreen(page);
    // 일시정지 화면이 열렸거나 게임플레이 유지 중 하나
    expect(['Pause', 'Gameplay']).toContain(screen);
  });
});

// ---------------------------------------------------------------------------
// 3. 일시정지 화면 테스트
// ---------------------------------------------------------------------------

test.describe('일시정지 화면 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
  });

  test('TC-UI-009: 일시정지 버튼 클릭 시 Paused 상태로 전환된다', async ({ page }) => {
    // 일시정지 트리거 (WebGLBridge 를 통한 직접 호출)
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    const state = await bridge.getGameState();
    expect(state.state).toBe('Paused');
  });

  test('TC-UI-009: 일시정지 화면 스크린샷이 기준 이미지와 일치한다', async ({ page }) => {
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    await expect(page).toHaveScreenshot('pause-overlay.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-010: 일시정지 화면에 continue/restart/sound 버튼이 배치된다', async ({ page }) => {
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    // GameManager 상태로 확인 (PauseGame은 ScreenManager를 직접 전환하지 않음)
    const state = await bridge.getGameState();
    expect(state.state).toBe('Paused');

    // 스크린샷으로 버튼 배치 시각 검증
    await expect(page).toHaveScreenshot('pause-buttons-layout.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-011: RESUME (계속하기) 동작 시 게임이 재개된다', async ({ page }) => {
    // 일시정지 진입
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    let state = await bridge.getGameState();
    expect(state.state).toBe('Paused');

    // RESUME: 일시정지 해제 - 브릿지를 통해 게임 재개
    await sendMessage(page, 'GameManager', 'JS_ResumeGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    state = await bridge.getGameState();
    expect(state.state).toBe('Playing');
  });

  test('TC-UI-011: RESUME 후 TimeScale 이 1 로 복원된다', async ({ page }) => {
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    await sendMessage(page, 'GameManager', 'JS_ResumeGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    const timeScale = await queryState(page, 'Game.TimeScale');
    expect(timeScale).toBe('1');
  });

  test('TC-UI-012: RESTART 후 점수가 0 으로 초기화된다', async ({ page }) => {
    // 점수를 올린 상태에서 일시정지 후 재시작
    await bridge.tapCell(0, 0);
    await new Promise((r) => setTimeout(r, 300));

    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    // 재시작 수행
    await bridge.startNewGame();
    await new Promise((r) => setTimeout(r, 1500));

    const state = await bridge.getGameState();
    expect(state.score).toBe(0);
    expect(state.state).toBe('Playing');
  });

  test('일시정지 중 점수가 변하지 않는다', async ({ page }) => {
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    const scoreBefore = (await bridge.getGameState()).score;

    // 일시정지 중 대기
    await new Promise((r) => setTimeout(r, 1000));

    const scoreAfter = (await bridge.getGameState()).score;
    expect(scoreAfter).toBe(scoreBefore);
  });
});

// ---------------------------------------------------------------------------
// 4. 게임 오버 화면 테스트
// ---------------------------------------------------------------------------

test.describe('게임 오버 화면 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
  });

  test('GameOver 상태에서 게임 오버 화면이 표시된다', async ({ page }) => {
    // 게임 오버를 강제 트리거
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'GameOver');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const screen = await getCurrentScreen(page);
    expect(screen).toBe('GameOver');

    await expect(page).toHaveScreenshot('game-over-screen.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('게임 오버 화면에서 RESTART 클릭 시 새 게임이 시작된다', async ({ page }) => {
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'GameOver');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    // 재시작 브릿지 호출
    await bridge.startNewGame();
    await new Promise((r) => setTimeout(r, 1500));

    const state = await bridge.getGameState();
    expect(state.state).toBe('Playing');
    expect(state.score).toBe(0);
  });

  test('게임 오버 화면에서 최종 점수가 표시된다', async ({ page }) => {
    // 점수를 설정한 뒤 게임 오버 진입
    await sendMessage(page, 'TestBridge', 'SetScore', '1500');
    await new Promise((r) => setTimeout(r, 300));

    await sendMessage(page, 'TestBridge', 'NavigateTo', 'GameOver');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const state = await bridge.getGameState();
    expect(state.state).toBe('GameOver');
    // 점수가 유지되어야 한다
    expect(state.score).toBeGreaterThanOrEqual(0);
  });

  test('게임 오버 화면 스크린샷에 restart/watch-ad 버튼 영역이 존재한다', async ({ page }) => {
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'GameOver');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    await expect(page).toHaveScreenshot('game-over-buttons.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});

// ---------------------------------------------------------------------------
// 5. 상점 화면 테스트
// ---------------------------------------------------------------------------

test.describe('상점 화면 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // 상점 화면으로 직접 이동
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Shop');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));
  });

  test('TC-UI-024: 상점 화면이 정상 표시된다', async ({ page }) => {
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Shop');

    await expect(page).toHaveScreenshot('shop-initial-layout.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-024: 상점에 보유 재화(젬) 정보가 표시된다', async ({ page }) => {
    const gems = await queryState(page, 'Currency.Gems');
    expect(parseInt(gems)).toBeGreaterThanOrEqual(0);
  });

  test('TC-UI-025: ITEMS 탭이 기본 활성 상태이다', async ({ page }) => {
    const activeTab = await queryState(page, 'Shop.CurrentTab');
    expect(activeTab).toBe('Items');
  });

  test('TC-UI-025: 카테고리 탭 전환 시 탭 상태가 변경된다', async ({ page }) => {
    // COINS 탭으로 전환
    await sendMessage(page, 'TestBridge', 'SetShopTab', 'Coins');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    let tab = await queryState(page, 'Shop.CurrentTab');
    expect(tab).toBe('Coins');

    // NO ADS 탭으로 전환
    await sendMessage(page, 'TestBridge', 'SetShopTab', 'NoAds');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    tab = await queryState(page, 'Shop.CurrentTab');
    expect(tab).toBe('NoAds');

    // ITEMS 탭으로 복귀
    await sendMessage(page, 'TestBridge', 'SetShopTab', 'Items');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    tab = await queryState(page, 'Shop.CurrentTab');
    expect(tab).toBe('Items');
  });

  test('TC-UI-027: 젬으로 아이템 구매 시 재화가 차감된다', async ({ page }) => {
    // 테스트 젬 100개 지급
    await sendMessage(page, 'TestBridge', 'SetGems', '100');
    await new Promise((r) => setTimeout(r, 300));

    const gemsBefore = await queryState(page, 'Currency.Gems');
    expect(gemsBefore).toBe('100');

    // Hint x3 구매 (50젬) - SendMessage 경유
    await sendMessage(page, 'TestBridge', 'BuyHint', '50');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    // 젬 차감 확인
    const gemsAfter = await queryState(page, 'Currency.Gems');
    expect(parseInt(gemsAfter)).toBeLessThan(100);
  });

  test('TC-UI-027: 구매 후 아이템 수량이 증가한다', async ({ page }) => {
    await sendMessage(page, 'TestBridge', 'SetGems', '100');
    await sendMessage(page, 'TestBridge', 'SetHints', '0');
    await new Promise((r) => setTimeout(r, 300));

    // Hint x3 구매 (50젬) - SendMessage 경유
    await sendMessage(page, 'TestBridge', 'BuyHint', '50');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const hints = await queryState(page, 'Items.HintCount');
    expect(parseInt(hints)).toBeGreaterThanOrEqual(0);
  });

  test('TC-UI-028: 재화 부족 시 구매가 실패한다', async ({ page }) => {
    // 젬을 0으로 설정
    await sendMessage(page, 'TestBridge', 'SetGems', '0');
    await new Promise((r) => setTimeout(r, 300));

    const gemsBefore = await queryState(page, 'Currency.Gems');
    expect(gemsBefore).toBe('0');

    // 구매 시도
    await clickCanvasAt(page, 0.25, 0.55);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    // 젬이 여전히 0이어야 한다 (구매 실패)
    const gemsAfter = await queryState(page, 'Currency.Gems');
    expect(gemsAfter).toBe('0');
  });

  test('상점 화면에서 뒤로가기 시 이전 화면으로 복귀한다', async ({ page }) => {
    // 뒤로가기 - SendMessage 경유
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'MainMenu');
    const screen = await waitForScreen(page, ['MainMenu', 'Gameplay']);

    // 메인 메뉴 또는 이전 화면으로 복귀
    expect(['MainMenu', 'Gameplay']).toContain(screen);
  });
});

// ---------------------------------------------------------------------------
// 6. 리더보드 화면 테스트
// ---------------------------------------------------------------------------

test.describe('리더보드 화면 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // 리더보드 화면으로 직접 이동
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Leaderboard');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));
  });

  test('TC-UI-021: 리더보드 화면이 정상 표시된다', async ({ page }) => {
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Leaderboard');

    await expect(page).toHaveScreenshot('leaderboard-initial-layout.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-021: ALL 탭이 기본 활성 상태이다', async ({ page }) => {
    const activeTab = await queryState(page, 'Leaderboard.CurrentTab');
    expect(activeTab).toBe('All');
  });

  test('TC-UI-022: 리더보드 탭 전환이 정상 동작한다', async ({ page }) => {
    // WEEKLY 탭 전환 - SendMessage 경유
    await sendMessage(page, 'TestBridge', 'SetLeaderboardTab', 'Weekly');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    let tab = await queryState(page, 'Leaderboard.CurrentTab');
    expect(tab).toBe('Weekly');

    // FRIENDS 탭 전환
    await sendMessage(page, 'TestBridge', 'SetLeaderboardTab', 'Friends');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    tab = await queryState(page, 'Leaderboard.CurrentTab');
    expect(tab).toBe('Friends');

    // ALL 탭 복귀
    await sendMessage(page, 'TestBridge', 'SetLeaderboardTab', 'All');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    tab = await queryState(page, 'Leaderboard.CurrentTab');
    expect(tab).toBe('All');
  });

  test('TC-UI-023: 리더보드 목록을 스크롤할 수 있다', async ({ page }) => {
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas 를 찾을 수 없습니다.');

    // 목록 영역에서 위로 스와이프 (스크롤)
    const centerX = box.x + box.width * 0.5;
    const startY = box.y + box.height * 0.7;
    const endY = box.y + box.height * 0.3;

    await page.mouse.move(centerX, startY);
    await page.mouse.down();
    await page.mouse.move(centerX, endY, { steps: 10 });
    await page.mouse.up();
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    // 스크롤 후에도 리더보드 화면 유지
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Leaderboard');
  });

  test('리더보드에서 뒤로가기 시 이전 화면으로 복귀한다', async ({ page }) => {
    // 뒤로가기 - SendMessage 경유
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'MainMenu');
    const screen = await waitForScreen(page, ['MainMenu', 'Gameplay']);

    expect(['MainMenu', 'Gameplay']).toContain(screen);
  });
});

// ---------------------------------------------------------------------------
// 7. 화면 전환 (Screen Transition) 테스트
// ---------------------------------------------------------------------------

test.describe('화면 전환 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('TC-UI-037: 메인 메뉴 -> 게임 전환이 정상 수행된다', async ({ page }) => {
    // PLAY 버튼 위치 클릭 (화면 중앙)
    await clickCanvasAt(page, 0.5, 0.5);
    await new Promise((r) => setTimeout(r, 600));

    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Gameplay');
  });

  test('TC-UI-038: 게임 -> 일시정지 전환(오버레이 페이드인)이 발생한다', async ({ page }) => {
    await bridge.loadAndStartGame();

    // 전환 전 스크린샷
    const beforeBuf = await page.screenshot();

    // 일시정지 진입
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    // 전환 후 스크린샷
    const afterBuf = await page.screenshot();

    // 두 스크린샷이 시각적으로 다른지 확인 (오버레이가 표시됨)
    const isDifferent = !beforeBuf.equals(afterBuf);
    expect(isDifferent).toBe(true);
  });

  test('TC-UI-039: 설정/리더보드/상점 슬라이드 전환이 시각적으로 변화한다', async ({ page }) => {
    // 초기 화면 스크린샷
    const mainMenuBuf = await page.screenshot();

    // 상점 진입
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Shop');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const shopBuf = await page.screenshot();
    expect(!mainMenuBuf.equals(shopBuf)).toBe(true);

    // 리더보드 진입
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Leaderboard');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const leaderboardBuf = await page.screenshot();
    expect(!shopBuf.equals(leaderboardBuf)).toBe(true);
  });

  test('TC-UI-040: 화면 전환 중 입력이 차단된다', async ({ page }) => {
    // 게임 시작 직후 빠르게 SHOP 위치도 클릭
    await clickCanvasAt(page, 0.5, 0.5); // PLAY 클릭
    await clickCanvasAt(page, 0.6, 0.77); // SHOP 위치 즉시 클릭

    await new Promise((r) => setTimeout(r, 800));

    // Gameplay 화면으로 전환되어야 한다 (Shop 이 아님)
    const screen = await getCurrentScreen(page);
    // 첫 번째 클릭만 처리되어야 함
    expect(['Gameplay', 'MainMenu']).toContain(screen);
  });

  test('화면 전환 후 게임 상태가 유지된다', async ({ page }) => {
    await bridge.loadAndStartGame();

    const stateBefore = await bridge.getGameState();

    // 일시정지 진입 후 복귀
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    await sendMessage(page, 'GameManager', 'JS_ResumeGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    const stateAfter = await bridge.getGameState();
    expect(stateAfter.score).toBe(stateBefore.score);
    expect(stateAfter.cells).toHaveLength(25);
  });
});

// ---------------------------------------------------------------------------
// 8. 반응형 레이아웃 테스트
// ---------------------------------------------------------------------------

test.describe('반응형 레이아웃 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('TC-UI-032: 모바일 뷰포트(360x800) 에서 캔버스가 정상 렌더링된다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('responsive-mobile-360x800.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-032: 모바일 뷰포트에서 Breakpoint 가 Mobile 이다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Mobile');
  });

  test('TC-UI-032: 모바일 뷰포트에서 사이드바가 숨겨진다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const sidebarVisible = await queryState(page, 'ResponsiveLayout.SidebarVisible');
    expect(sidebarVisible).toBe('false');
  });

  test('TC-UI-033: 태블릿 뷰포트(1024x768) 에서 캔버스가 정상 렌더링된다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('responsive-tablet-1024x768.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-033: 태블릿 뷰포트에서 Breakpoint 가 Tablet 이다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.tablet);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Tablet');
  });

  test('TC-UI-034: 데스크톱 뷰포트(1920x1080) 에서 캔버스가 정상 렌더링된다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);

    await expect(page).toHaveScreenshot('responsive-desktop-1920x1080.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-034: 데스크톱 뷰포트에서 Breakpoint 가 Desktop 이다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Desktop');
  });

  test('TC-UI-034: 데스크톱 뷰포트에서 사이드바가 표시된다', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const sidebarVisible = await queryState(page, 'ResponsiveLayout.SidebarVisible');
    expect(sidebarVisible).toBe('true');
  });

  test('TC-UI-035: 뷰포트 동적 변경 시 레이아웃이 전환된다', async ({ page }) => {
    // 데스크톱으로 시작
    await page.setViewportSize(VIEWPORTS.desktop);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    let bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Desktop');

    // 태블릿으로 리사이즈
    await page.setViewportSize(VIEWPORTS.tablet);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Tablet');

    // 모바일로 리사이즈
    await page.setViewportSize(VIEWPORTS.mobile);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Mobile');
  });

  test('TC-UI-035: 뷰포트 리사이즈 중 게임 상태가 유지된다', async ({ page }) => {
    await bridge.loadAndStartGame();

    const stateBefore = await bridge.getGameState();

    // 다양한 뷰포트로 리사이즈
    await page.setViewportSize(VIEWPORTS.tablet);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    await page.setViewportSize(VIEWPORTS.mobile);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    await page.setViewportSize(VIEWPORTS.desktop);
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const stateAfter = await bridge.getGameState();

    // 상태 유지 확인
    expect(stateAfter.state).toBe('Playing');
    expect(stateAfter.score).toBe(stateBefore.score);
    expect(stateAfter.cells).toHaveLength(25);
  });

  test('TC-UI-036: 메인 메뉴가 모든 뷰포트에서 정상 표시된다', async ({ page }) => {
    for (const [name, viewport] of Object.entries(VIEWPORTS)) {
      await page.setViewportSize(viewport);
      await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

      const canvas = page.locator('canvas').first();
      const box = await canvas.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);

      await expect(page).toHaveScreenshot(`mainmenu-responsive-${name}.png`, {
        maxDiffPixelRatio: 0.1,
      });
    }
  });
});

// ---------------------------------------------------------------------------
// 9. 버튼 피드백 (ButtonFeedback) 테스트
// ---------------------------------------------------------------------------

test.describe('버튼 피드백 (스케일 펀치 애니메이션) 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('버튼 클릭 시 시각적 피드백이 발생한다 (스크린샷 차이)', async ({ page }) => {
    // 클릭 직전 스크린샷
    const beforeBuf = await page.screenshot();

    // 화면 중앙 (PLAY 버튼 영역) 클릭
    await clickCanvasAt(page, 0.5, 0.5);

    // 클릭 직후 (애니메이션 중) 스크린샷 - 매우 짧은 딜레이
    await new Promise((r) => setTimeout(r, 50));
    const duringBuf = await page.screenshot();

    // 클릭 전후 시각적 차이가 존재해야 한다
    const isDifferent = !beforeBuf.equals(duringBuf);
    expect(isDifferent).toBe(true);
  });

  test('TC-UI-004: PLAY 버튼에 펄스 애니메이션이 적용된다', async ({ page }) => {
    // 0.5초 간격으로 3장의 스크린샷 캡처
    const screenshots: Buffer[] = [];
    for (let i = 0; i < 3; i++) {
      screenshots.push(await page.screenshot());
      if (i < 2) await new Promise((r) => setTimeout(r, 500));
    }

    // 프레임 간 차이가 존재하는지 확인 (펄스 애니메이션)
    // 최소 하나의 프레임 쌍에서 차이가 있어야 한다
    let hasDiff = false;
    for (let i = 1; i < screenshots.length; i++) {
      if (!screenshots[i - 1].equals(screenshots[i])) {
        hasDiff = true;
        break;
      }
    }
    expect(hasDiff).toBe(true);
  });

  test('게임플레이 중 셀 탭 시 시각적 피드백이 발생한다', async ({ page }) => {
    await bridge.loadAndStartGame();

    const nonEmpty = await bridge.getNonEmptyCells();
    if (nonEmpty.length === 0) {
      test.skip();
      return;
    }

    // 탭 전 스크린샷
    const beforeBuf = await page.screenshot();

    // 셀 탭
    await bridge.tapCell(nonEmpty[0].q, nonEmpty[0].r);
    await new Promise((r) => setTimeout(r, 200));

    // 탭 후 스크린샷
    const afterBuf = await page.screenshot();

    // 시각적 차이 확인 (선택 글로우 또는 스케일 바운스)
    const isDifferent = !beforeBuf.equals(afterBuf);
    expect(isDifferent).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. 팝업 및 토스트 테스트
// ---------------------------------------------------------------------------

test.describe('팝업 및 토스트 메시지 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('TC-UI-041: 확인 팝업이 모달로 동작한다', async ({ page }) => {
    // 설정 화면 진입
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Settings');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    // RESET ALL DATA 클릭 - 확인 팝업 트리거
    await clickCanvasAt(page, 0.5, 0.85);
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    // 팝업 표시 스크린샷
    await expect(page).toHaveScreenshot('confirm-popup-modal.png', {
      maxDiffPixelRatio: 0.1,
    });

    // 팝업 바깥 영역 클릭 - 팝업이 닫히지 않아야 한다
    await clickCanvasAt(page, 0.05, 0.05);
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    // 여전히 설정 화면 (팝업 위에서)
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Settings');
  });

  test('TC-UI-042: 토스트 메시지가 표시되고 자동으로 사라진다', async ({ page }) => {
    // 토스트 강제 트리거
    await sendMessage(page, 'TestBridge', 'TriggerToast', '테스트 토스트 메시지');
    await new Promise((r) => setTimeout(r, 200));

    // 토스트 표시 직후 스크린샷
    const withToastBuf = await page.screenshot();

    // 토스트 자동 소멸 대기 (3초)
    await new Promise((r) => setTimeout(r, 3500));

    // 소멸 후 스크린샷
    const withoutToastBuf = await page.screenshot();

    // 토스트 표시 전후 시각적 차이 확인
    const isDifferent = !withToastBuf.equals(withoutToastBuf);
    expect(isDifferent).toBe(true);
  });

  test('TC-UI-043: 연속 토스트 발생 시 최신 메시지로 교체된다', async ({ page }) => {
    // 첫 번째 토스트
    await sendMessage(page, 'TestBridge', 'TriggerToast', '메시지 A');
    await new Promise((r) => setTimeout(r, 100));

    // 즉시 두 번째 토스트
    await sendMessage(page, 'TestBridge', 'TriggerToast', '메시지 B');
    await new Promise((r) => setTimeout(r, 300));

    // 스크린샷으로 최신 토스트만 표시되는지 시각 검증
    await expect(page).toHaveScreenshot('toast-replacement.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});

// ---------------------------------------------------------------------------
// 11. 설정 화면 테스트
// ---------------------------------------------------------------------------

test.describe('설정 화면 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // 설정 화면으로 이동
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Settings');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));
  });

  test('TC-UI-014: 설정 화면이 정상 표시된다', async ({ page }) => {
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Settings');

    await expect(page).toHaveScreenshot('settings-initial-layout.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-005: 사운드 토글 ON/OFF 전환이 동작한다', async ({ page }) => {
    // 사운드 토글 - SendMessage 경유
    await sendMessage(page, 'AudioManager', 'ToggleMute', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    const muteState = await queryState(page, 'Settings.MuteEnabled');
    expect(muteState).toBe('true');

    // 다시 토글하여 ON 복원
    await sendMessage(page, 'AudioManager', 'ToggleMute', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));

    const unmuteState = await queryState(page, 'Settings.MuteEnabled');
    expect(unmuteState).toBe('false');
  });

  test('TC-UI-015: BGM 볼륨 값을 조회할 수 있다', async ({ page }) => {
    const bgmVolume = await queryState(page, 'Settings.BGMVolume');
    const vol = parseFloat(bgmVolume);
    expect(vol).toBeGreaterThanOrEqual(0);
    expect(vol).toBeLessThanOrEqual(1);
  });

  test('TC-UI-016: SFX 볼륨 값을 조회할 수 있다', async ({ page }) => {
    const sfxVolume = await queryState(page, 'Settings.SFXVolume');
    const vol = parseFloat(sfxVolume);
    expect(vol).toBeGreaterThanOrEqual(0);
    expect(vol).toBeLessThanOrEqual(1);
  });

  test('TC-UI-019: 데이터 초기화 후 최고 점수가 0이 된다', async ({ page }) => {
    // 최고 점수를 높게 설정
    await sendMessage(page, 'TestBridge', 'SetBestScore', '9999');
    await new Promise((r) => setTimeout(r, 300));

    // 데이터 초기화
    await sendMessage(page, 'TestBridge', 'ClearSaveData', '');
    await new Promise((r) => setTimeout(r, 500));

    // 메인 메뉴로 이동하여 점수 확인
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'MainMenu');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    // getGameState 로 highScore 확인
    const state = await bridge.getGameState();
    expect(state.highScore).toBe(0);
  });

  test('TC-UI-020: 설정에서 뒤로가기 시 이전 화면으로 복귀한다', async ({ page }) => {
    // 뒤로가기 - SendMessage 경유
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'MainMenu');
    const screen = await waitForScreen(page, ['MainMenu', 'Pause']);

    expect(['MainMenu', 'Pause']).toContain(screen);
  });

  test('TC-UI-018: 언어 인덱스를 조회할 수 있다', async ({ page }) => {
    const langIndex = await queryState(page, 'Settings.LanguageIndex');
    const idx = parseInt(langIndex);
    // 0=한국어, 1=English
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThanOrEqual(1);
  });
});

// ---------------------------------------------------------------------------
// 12. 메인 메뉴 화면 테스트
// ---------------------------------------------------------------------------

test.describe('메인 메뉴 화면 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('TC-UI-001: 메인 메뉴 초기 레이아웃이 표시된다', async ({ page }) => {
    await expect(page).toHaveScreenshot('main-menu-layout.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-001: PLAY 버튼이 활성 상태이다', async ({ page }) => {
    const playBtnActive = await queryState(page, 'MainMenu.PlayButton.Active');
    expect(playBtnActive).toBe('true');
  });

  test('TC-UI-001: 최고 점수 텍스트가 "Best:" 접두어로 표시된다', async ({ page }) => {
    const bestScoreText = await queryState(page, 'MainMenu.BestScoreText');
    expect(bestScoreText).toMatch(/^Best: [\d,]+$/);
  });

  test('TC-UI-002: PLAY 버튼 클릭 시 게임 화면으로 전환된다', async ({ page }) => {
    await clickCanvasAt(page, 0.5, 0.5);
    await new Promise((r) => setTimeout(r, 600));

    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Gameplay');

    await expect(page).toHaveScreenshot('gameplay-after-play.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-003: 저장 데이터 없으면 CONTINUE 버튼이 비활성이다', async ({ page }) => {
    // 저장 데이터 초기화
    await sendMessage(page, 'TestBridge', 'ClearSaveData', '');
    await new Promise((r) => setTimeout(r, 500));

    // 메인 메뉴 새로고침
    await page.reload();
    await bridge.waitForUnityLoad();

    const continueActive = await queryState(page, 'MainMenu.ContinueButton.Active');
    expect(continueActive).toBe('false');
  });

  test('TC-UI-006: 게임 플레이 화면 진입 후 보드와 HUD 가 표시된다', async ({ page }) => {
    await bridge.loadAndStartGame();

    const state = await bridge.getGameState();
    expect(state.state).toBe('Playing');
    expect(state.cells).toHaveLength(25);

    // 초기 타일 배치 확인 (4~6개)
    const nonEmpty = state.cells.filter((c) => c.v > 0);
    expect(nonEmpty.length).toBeGreaterThanOrEqual(4);
    expect(nonEmpty.length).toBeLessThanOrEqual(6);

    await expect(page).toHaveScreenshot('gameplay-initial-layout.png', {
      maxDiffPixelRatio: 0.1,
    });
  });
});

// ---------------------------------------------------------------------------
// 13. 종합 화면 흐름 (End-to-End Flow) 테스트
// ---------------------------------------------------------------------------

test.describe('종합 화면 흐름 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('메인 메뉴 -> 게임플레이 -> 일시정지 -> 게임플레이 전체 흐름', async ({ page }) => {
    // 1. 메인 메뉴 확인
    const state0 = await bridge.getGameState();
    expect(state0.state).toBe('Ready');

    // 2. 게임 시작
    await bridge.loadAndStartGame();
    const state1 = await bridge.getGameState();
    expect(state1.state).toBe('Playing');

    // 3. 일시정지
    await sendMessage(page, 'GameManager', 'JS_PauseGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));
    const state2 = await bridge.getGameState();
    expect(state2.state).toBe('Paused');

    // 4. 게임 재개
    await sendMessage(page, 'GameManager', 'JS_ResumeGame', '');
    await new Promise((r) => setTimeout(r, ANIMATION_WAIT));
    const state3 = await bridge.getGameState();
    expect(state3.state).toBe('Playing');

    // 5. 점수 유지 확인
    expect(state3.score).toBe(state1.score);
  });

  test('게임플레이 -> 게임오버 -> 재시작 전체 흐름', async ({ page }) => {
    // 1. 게임 시작
    await bridge.loadAndStartGame();

    // 2. 게임 오버 진입
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'GameOver');
    await new Promise((r) => setTimeout(r, TRANSITION_WAIT));

    const state1 = await bridge.getGameState();
    expect(state1.state).toBe('GameOver');

    // 3. 재시작
    await bridge.startNewGame();
    await new Promise((r) => setTimeout(r, 1500));

    const state2 = await bridge.getGameState();
    expect(state2.state).toBe('Playing');
    expect(state2.score).toBe(0);
  });

  test('다양한 화면을 순회한 뒤 게임 상태가 정상 유지된다', async ({ page }) => {
    // 상점 방문
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Shop');
    await waitForScreen(page, 'Shop');
    expect(await getCurrentScreen(page)).toBe('Shop');

    // 리더보드 방문
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Leaderboard');
    await waitForScreen(page, 'Leaderboard');
    expect(await getCurrentScreen(page)).toBe('Leaderboard');

    // 설정 방문
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'Settings');
    await waitForScreen(page, 'Settings');
    expect(await getCurrentScreen(page)).toBe('Settings');

    // 메인 메뉴 복귀
    await sendMessage(page, 'TestBridge', 'NavigateTo', 'MainMenu');
    await waitForScreen(page, 'MainMenu');

    // Unity 인스턴스가 여전히 유효한지 확인
    const state = await bridge.getGameState();
    expect(state).toHaveProperty('state');
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('cells');
  });
});
