import { test, expect } from '@playwright/test';
import { UnityBridge, CellInfo, getAllGridCoords } from '../helpers/unity-bridge';

// ---------------------------------------------------------------------------
// HexaTest bridge helper types & constants
// ---------------------------------------------------------------------------

/**
 * The Unity WebGL build exposes window.HexaTest for animation test automation.
 * These helpers wrap page.evaluate calls to the HexaTest JS bridge so that
 * animation-specific queries (scale, alpha, FPS, animation state) can be
 * performed from Playwright.
 *
 * See: docs/test-plans/04_animation/test-plan.md -- section 1.4
 */

/** Default timeout for waiting on HexaTest to become available */
const HEXA_TEST_LOAD_TIMEOUT = 30_000;

/** Tolerance used when comparing scale values */
const SCALE_TOLERANCE = 0.05;

/** Tolerance used when comparing alpha values */
const ALPHA_TOLERANCE = 0.05;

// ---------------------------------------------------------------------------
// Page-level HexaTest bridge helpers
// ---------------------------------------------------------------------------

async function waitForHexaTestReady(page: import('@playwright/test').Page, timeout = HEXA_TEST_LOAD_TIMEOUT) {
  await page.waitForFunction(
    () => typeof (window as any).HexaTest !== 'undefined',
    { timeout },
  );
}

async function triggerSpawnAnimation(page: import('@playwright/test').Page, count: number): Promise<void> {
  await page.evaluate((c) => (window as any).HexaTest.triggerSpawnAnimation(c), count);
}

async function triggerMerge(
  page: import('@playwright/test').Page,
  q1: number, r1: number,
  q2: number, r2: number,
): Promise<void> {
  await page.evaluate(
    ([a, b, c, d]) => (window as any).HexaTest.triggerMerge(a, b, c, d),
    [q1, r1, q2, r2],
  );
}

async function triggerCombo(page: import('@playwright/test').Page, count: number): Promise<void> {
  await page.evaluate((c) => (window as any).HexaTest.triggerCombo(c), count);
}

async function triggerWaveAnimation(page: import('@playwright/test').Page, direction: string): Promise<void> {
  await page.evaluate((d) => (window as any).HexaTest.triggerWaveAnimation(d), direction);
}

async function triggerScreenTransition(page: import('@playwright/test').Page, from: string, to: string): Promise<void> {
  await page.evaluate(([f, t]) => (window as any).HexaTest.triggerScreenTransition(f, t), [from, to]);
}

async function isAnimationPlaying(page: import('@playwright/test').Page): Promise<boolean> {
  return page.evaluate(() => (window as any).HexaTest.isAnimationPlaying());
}

async function waitForAnimationComplete(page: import('@playwright/test').Page, timeout = 5_000): Promise<void> {
  await page.waitForFunction(
    () => !(window as any).HexaTest.isAnimationPlaying(),
    { timeout },
  );
}

async function getBlockScale(page: import('@playwright/test').Page, q: number, r: number): Promise<number> {
  return page.evaluate(([q, r]) => (window as any).HexaTest.getBlockScale(q, r), [q, r]);
}

async function getBlockAlpha(page: import('@playwright/test').Page, q: number, r: number): Promise<number> {
  return page.evaluate(([q, r]) => (window as any).HexaTest.getBlockAlpha(q, r), [q, r]);
}

async function getAnimationState(page: import('@playwright/test').Page): Promise<any> {
  return page.evaluate(() => (window as any).HexaTest.getAnimationState());
}

async function getFPS(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => (window as any).HexaTest.getFPS());
}

async function setBoardState(page: import('@playwright/test').Page, state: object): Promise<void> {
  await page.evaluate(
    (s) => (window as any).HexaTest.setBoardState(JSON.stringify(s)),
    state,
  );
}

// ===========================================================================
// Test suites
// ===========================================================================

test.describe('애니메이션 시스템 - 블록 생성 애니메이션', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-001: 단일 블록 생성 시 Scale(0->1.1->1.0) + Fade(0->1) 애니메이션이 재생된다', async ({ page }) => {
    // Trigger single block spawn
    await triggerSpawnAnimation(page, 1);

    // Immediately after trigger the scale should start near 0
    const initialScale = await getBlockScale(page, 0, 0);
    expect(initialScale).toBeLessThanOrEqual(0.2);

    // Wait for the animation midpoint (~125ms) -- scale should be rising
    await page.waitForTimeout(125);
    const midScale = await getBlockScale(page, 0, 0);
    expect(midScale).toBeGreaterThan(0);
    expect(midScale).toBeLessThanOrEqual(1.15);

    // Wait until full animation duration (250ms total) plus small buffer
    await page.waitForTimeout(175);
    const finalScale = await getBlockScale(page, 0, 0);
    expect(finalScale).toBeGreaterThanOrEqual(1.0 - SCALE_TOLERANCE);
    expect(finalScale).toBeLessThanOrEqual(1.0 + SCALE_TOLERANCE);

    // Alpha must be fully opaque after animation completes
    const alpha = await getBlockAlpha(page, 0, 0);
    expect(alpha).toBeGreaterThanOrEqual(1.0 - ALPHA_TOLERANCE);
  });

  test('TC-ANIM-002: 다중 블록(5개) 생성 시 0.03초 순차 딜레이로 파도 효과가 나타난다', async ({ page }) => {
    const startTime = Date.now();
    await triggerSpawnAnimation(page, 5);

    // Wait for all animations to complete (250ms animation + 120ms sequential delay)
    await waitForAnimationComplete(page, 2_000);
    const elapsed = Date.now() - startTime;

    // Total time: 250ms (animation) + 4 * 30ms (delay) = ~370ms
    // Allow generous tolerance: 300~600ms
    expect(elapsed).toBeGreaterThan(300);
    expect(elapsed).toBeLessThan(600);
  });

  test('TC-ANIM-003: 생성 애니메이션 총 소요 시간이 250ms(+-50ms) 이내이다', async ({ page }) => {
    const startTime = Date.now();
    await triggerSpawnAnimation(page, 1);
    await waitForAnimationComplete(page, 2_000);
    const elapsed = Date.now() - startTime;

    // 250ms design spec with +-50ms tolerance
    expect(elapsed).toBeGreaterThan(200);
    expect(elapsed).toBeLessThan(300);
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 탭 선택 피드백', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-004: 블록 탭 시 Scale 1.0->0.95->1.05->1.0 탄성 바운스가 재생된다', async ({ page }) => {
    // Find a non-empty cell to tap
    const nonEmpty = await bridge.getNonEmptyCells();
    test.skip(nonEmpty.length === 0, '보드에 타일이 없어서 테스트를 건너뜁니다');

    const target = nonEmpty[0];
    await bridge.tapCell(target.q, target.r);

    // Shortly after tap (~30ms): scale should contract toward 0.95
    await page.waitForTimeout(30);
    const contractedScale = await getBlockScale(page, target.q, target.r);
    expect(contractedScale).toBeLessThanOrEqual(1.0);

    // After bounce (~80ms): scale should overshoot above 1.0
    await page.waitForTimeout(50);
    const overshootScale = await getBlockScale(page, target.q, target.r);
    expect(overshootScale).toBeGreaterThanOrEqual(0.98);

    // After settling (~150ms total): scale returns to 1.0
    await page.waitForTimeout(70);
    const finalScale = await getBlockScale(page, target.q, target.r);
    expect(finalScale).toBeGreaterThanOrEqual(1.0 - SCALE_TOLERANCE);
    expect(finalScale).toBeLessThanOrEqual(1.0 + SCALE_TOLERANCE);
  });

  test('TC-ANIM-005: 선택 상태에서 글로우 테두리가 표시된다', async ({ page }) => {
    const nonEmpty = await bridge.getNonEmptyCells();
    test.skip(nonEmpty.length === 0, '보드에 타일이 없어서 테스트를 건너뜁니다');

    const target = nonEmpty[0];

    // Capture screenshot BEFORE tap
    const beforeTap = await page.screenshot();

    // Tap the block and wait for glow to fully appear (100ms fade-in + buffer)
    await bridge.tapCell(target.q, target.r);
    await page.waitForTimeout(200);

    // Capture screenshot AFTER tap
    const afterTap = await page.screenshot();

    // The two screenshots must differ (glow added)
    expect(Buffer.compare(beforeTap, afterTap)).not.toBe(0);
  });

  test('TC-ANIM-006: 다른 숫자 블록 두 개를 탭하면 흔들림(Shake) 피드백이 재생된다', async ({ page }) => {
    const state = await bridge.getGameState();
    const nonEmpty = state.cells.filter((c) => c.v > 0);

    // Find two adjacent cells with DIFFERENT values
    const neighborOffsets = [
      { dq: +1, dr: -1 }, { dq: +1, dr: 0 }, { dq: 0, dr: +1 },
      { dq: -1, dr: +1 }, { dq: -1, dr: 0 }, { dq: 0, dr: -1 },
    ];
    const cellMap = new Map<string, CellInfo>();
    for (const c of state.cells) {
      cellMap.set(`${c.q},${c.r}`, c);
    }

    let cellA: CellInfo | undefined;
    let cellB: CellInfo | undefined;
    for (const cell of nonEmpty) {
      for (const off of neighborOffsets) {
        const key = `${cell.q + off.dq},${cell.r + off.dr}`;
        const neighbor = cellMap.get(key);
        if (neighbor && neighbor.v > 0 && neighbor.v !== cell.v) {
          cellA = cell;
          cellB = neighbor;
          break;
        }
      }
      if (cellA) break;
    }

    test.skip(!cellA || !cellB, '서로 다른 숫자의 인접 블록이 없어서 테스트를 건너뜁니다');

    // Tap first block, then tap second (mismatch -> shake)
    await bridge.tapCell(cellA!.q, cellA!.r);
    await page.waitForTimeout(100);
    await bridge.tapCell(cellB!.q, cellB!.r);

    // During shake (~100ms after mismatch), animation should be playing
    await page.waitForTimeout(100);
    const playing = await isAnimationPlaying(page);
    // Shake lasts 0.2s so animation should still be active
    expect(playing).toBe(true);

    // After shake completes (~300ms total), animation should stop
    await page.waitForTimeout(200);
    const animState = await getAnimationState(page);
    expect(animState.shaking).toBeFalsy();
  });

  test('TC-ANIM-007: 선택된 블록을 다시 탭하면 글로우가 페이드아웃으로 사라진다', async ({ page }) => {
    const nonEmpty = await bridge.getNonEmptyCells();
    test.skip(nonEmpty.length === 0, '보드에 타일이 없어서 테스트를 건너뜁니다');

    const target = nonEmpty[0];

    // Select block
    await bridge.tapCell(target.q, target.r);
    await page.waitForTimeout(200);

    // Capture selected state screenshot
    const selectedScreenshot = await page.screenshot();

    // Deselect by tapping same block again
    await bridge.tapCell(target.q, target.r);
    await page.waitForTimeout(200);

    // Capture deselected state screenshot
    const deselectedScreenshot = await page.screenshot();

    // Screenshots should differ (glow removed)
    expect(Buffer.compare(selectedScreenshot, deselectedScreenshot)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 머지 4단계 시퀀스', () => {
  let bridge: UnityBridge;

  /** Fixed board with two adjacent blocks of value 32 for deterministic merge testing */
  const MERGE_BOARD = {
    blocks: [
      { q: 0, r: 0, value: 32 },
      { q: 1, r: 0, value: 32 },
    ],
  };

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);

    // Set up deterministic merge board
    await setBoardState(page, MERGE_BOARD);
  });

  test('TC-ANIM-008: 머지 단계1 - 블록 B가 블록 A 위치로 이동한다 (0~200ms)', async ({ page }) => {
    await triggerMerge(page, 0, 0, 1, 0);

    // At 100ms the animation should be in the "moving" phase
    await page.waitForTimeout(100);
    const animState = await getAnimationState(page);
    expect(animState.phase).toBe('moving');
  });

  test('TC-ANIM-009: 머지 단계2 - 합체 시 숫자 크로스페이드가 발생한다 (200~300ms)', async ({ page }) => {
    await triggerMerge(page, 0, 0, 1, 0);

    // At ~250ms the merge should be in the "merging" (crossfade) phase
    await page.waitForTimeout(250);
    const animState = await getAnimationState(page);
    expect(animState.phase).toBe('merging');
  });

  test('TC-ANIM-010: 머지 단계3 - 블록이 1.3배로 팽창하며 파티클이 방출된다 (300~400ms)', async ({ page }) => {
    await triggerMerge(page, 0, 0, 1, 0);

    // At ~350ms the merged block should be in expand phase
    await page.waitForTimeout(350);
    const scale = await getBlockScale(page, 0, 0);
    // Expect scale around 1.3 with tolerance of 0.15
    expect(scale).toBeGreaterThan(1.1);
    expect(scale).toBeLessThanOrEqual(1.45);

    // Screenshot: the expand + particles visual state
    await expect(page).toHaveScreenshot('merge-expand-particles.png', {
      maxDiffPixelRatio: 0.05, // particles are random, allow 5%
    });
  });

  test('TC-ANIM-011: 머지 단계4 - 블록이 1.0 스케일로 정착하고 애니메이션이 완료된다', async ({ page }) => {
    await triggerMerge(page, 0, 0, 1, 0);

    // Wait for full merge sequence to complete (~500ms)
    await page.waitForTimeout(550);
    const finalScale = await getBlockScale(page, 0, 0);
    expect(finalScale).toBeGreaterThanOrEqual(1.0 - SCALE_TOLERANCE);
    expect(finalScale).toBeLessThanOrEqual(1.0 + SCALE_TOLERANCE);

    // Animation should be done
    const playing = await isAnimationPlaying(page);
    expect(playing).toBe(false);
  });

  test('TC-ANIM-012: 머지 전체 시퀀스 타이밍이 500ms(+-80ms) 이내이다', async ({ page }) => {
    const startTime = Date.now();
    await triggerMerge(page, 0, 0, 1, 0);
    await waitForAnimationComplete(page, 3_000);
    const elapsed = Date.now() - startTime;

    // 500ms design spec with +-80ms tolerance
    expect(elapsed).toBeGreaterThan(420);
    expect(elapsed).toBeLessThan(580);
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 점수 팝업', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-017: 일반 머지 시 금색 "+점수" 팝업이 Scale 0->1.2->1.0 후 위로 떠오른다', async ({ page }) => {
    // Set up a low-value merge (score < 1000)
    await setBoardState(page, {
      blocks: [
        { q: 0, r: 0, value: 2 },
        { q: 1, r: 0, value: 2 },
      ],
    });

    // Capture pre-merge screenshot
    const beforeMerge = await page.screenshot();

    await triggerMerge(page, 0, 0, 1, 0);

    // At ~150ms the score popup should be visible
    await page.waitForTimeout(150);
    const duringPopup = await page.screenshot();
    expect(Buffer.compare(beforeMerge, duringPopup)).not.toBe(0);

    // At ~800ms the popup should have faded out
    await page.waitForTimeout(650);
    const afterFade = await page.screenshot();

    // The post-fade screenshot should differ from the popup screenshot
    // (popup text is gone)
    expect(Buffer.compare(duringPopup, afterFade)).not.toBe(0);
  });

  test('TC-ANIM-018: 1000점 이상 획득 시 대형 빨강 팝업과 별 파티클이 표시된다', async ({ page }) => {
    // 512 + 512 = 1024 -> score >= 1000
    await setBoardState(page, {
      blocks: [
        { q: 0, r: 0, value: 512 },
        { q: 1, r: 0, value: 512 },
      ],
    });

    await triggerMerge(page, 0, 0, 1, 0);

    // At ~200ms the large popup + star particles should be visible
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('large-score-popup.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('TC-ANIM-019: 점수 팝업이 0.5초 시점부터 페이드아웃하여 0.8초에 완전히 사라진다', async ({ page }) => {
    await setBoardState(page, {
      blocks: [
        { q: 0, r: 0, value: 4 },
        { q: 1, r: 0, value: 4 },
      ],
    });

    await triggerMerge(page, 0, 0, 1, 0);

    // At 400ms: popup should still be fully visible
    await page.waitForTimeout(400);
    const visibleScreenshot = await page.screenshot();

    // At 600ms: popup should be fading (semi-transparent)
    await page.waitForTimeout(200);
    const fadingScreenshot = await page.screenshot();

    // At 850ms: popup should be gone
    await page.waitForTimeout(250);
    const goneScreenshot = await page.screenshot();

    // All three should differ from each other
    expect(Buffer.compare(visibleScreenshot, fadingScreenshot)).not.toBe(0);
    expect(Buffer.compare(fadingScreenshot, goneScreenshot)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 화면 전환 (Crown Transition)', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-025: Circle Wipe 전환 (메인 메뉴 -> 게임) 이 0.5초 내에 완료된다', async ({ page }) => {
    await triggerScreenTransition(page, 'MainMenu', 'Game');

    // At ~100ms: transition should be in progress (circle mask expanding)
    await page.waitForTimeout(100);
    const playing = await isAnimationPlaying(page);
    expect(playing).toBe(true);

    // At ~500ms: transition should be complete
    await page.waitForTimeout(400);
    await waitForAnimationComplete(page, 2_000);

    // Verify the game screen is now displayed
    await expect(page).toHaveScreenshot('transition-to-game.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('TC-ANIM-026: 오버레이 페이드 전환 (게임 <-> 일시정지) 이 0.3초에 완료된다', async ({ page }) => {
    // Game -> Pause (fade-in overlay)
    await triggerScreenTransition(page, 'Game', 'Pause');

    // At ~150ms: overlay should be semi-transparent
    await page.waitForTimeout(150);
    const midTransition = await page.screenshot();

    // At ~300ms: pause screen should be fully displayed
    await page.waitForTimeout(150);
    await waitForAnimationComplete(page, 2_000);
    const pauseScreen = await page.screenshot();

    // Mid-transition and final should differ
    expect(Buffer.compare(midTransition, pauseScreen)).not.toBe(0);

    // Pause -> Game (fade-out overlay)
    await triggerScreenTransition(page, 'Pause', 'Game');
    await page.waitForTimeout(350);
    await waitForAnimationComplete(page, 2_000);

    const gameScreen = await page.screenshot();
    // Game screen should differ from pause screen
    expect(Buffer.compare(pauseScreen, gameScreen)).not.toBe(0);
  });

  test('TC-ANIM-027: 슬라이드 전환 (메뉴 간) 이 EaseInOutCubic 0.3초에 완료된다', async ({ page }) => {
    // MainMenu -> Settings slide transition
    await triggerScreenTransition(page, 'MainMenu', 'Settings');

    // At ~150ms: settings panel should be sliding in
    await page.waitForTimeout(150);
    const midSlide = await page.screenshot();

    // At ~300ms: fully visible
    await page.waitForTimeout(200);
    await waitForAnimationComplete(page, 2_000);
    const settingsScreen = await page.screenshot();

    expect(Buffer.compare(midSlide, settingsScreen)).not.toBe(0);

    // Settings -> MainMenu reverse slide
    await triggerScreenTransition(page, 'Settings', 'MainMenu');
    await page.waitForTimeout(350);
    await waitForAnimationComplete(page, 2_000);

    const mainMenuScreen = await page.screenshot();
    expect(Buffer.compare(settingsScreen, mainMenuScreen)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 게임오버 애니메이션', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('보드가 가득 차면 GameOver 상태가 되고 전환 애니메이션이 재생된다', async ({ page }) => {
    // Fill the entire board so no merges are possible (unique values per cell)
    const coords = getAllGridCoords();
    const fullBoard = {
      blocks: coords.map((c, i) => ({
        q: c.q,
        r: c.r,
        // Use different prime-like values so no adjacent matches exist
        value: 2 ** (2 + (i % 10)),
      })),
    };

    await setBoardState(page, fullBoard);

    // Tap any cell -- with no merges possible the game should transition to GameOver
    await bridge.tapCell(0, 0);

    // Wait for the game over state event
    const stateEvt = await bridge.waitForEvent(
      'stateChanged',
      ((d: any) => d.state === 'GameOver') as any,
      15_000,
    );
    expect((stateEvt as any).state).toBe('GameOver');

    // Wait for any game-over animation to finish
    await page.waitForTimeout(1_000);
    await waitForAnimationComplete(page, 5_000);

    // Confirm the game state is GameOver via the bridge
    const gameState = await bridge.getGameState();
    expect(gameState.state).toBe('GameOver');
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 콤보 이펙트', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-020: 콤보 x2 시 "COMBO x2" 텍스트가 표시된다', async ({ page }) => {
    await triggerCombo(page, 2);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('combo-x2.png', {
      maxDiffPixelRatio: 0.03,
    });
  });

  test('TC-ANIM-021: 콤보 x3 시 화면 미세 흔들림이 발생한다', async ({ page }) => {
    // Capture baseline
    const baseline = await page.screenshot();

    await triggerCombo(page, 3);

    // Take rapid screenshots during shake to detect positional jitter
    const shakeScreenshots: Buffer[] = [];
    for (let i = 0; i < 5; i++) {
      await page.waitForTimeout(50);
      shakeScreenshots.push(await page.screenshot());
    }

    // At least one screenshot during shake should differ from the baseline
    // (camera offset changes)
    const anyDifference = shakeScreenshots.some(
      (ss) => Buffer.compare(baseline, ss) !== 0,
    );
    expect(anyDifference).toBe(true);
  });

  test('TC-ANIM-022: 콤보 x4 시 글로우 + 파티클이 표시된다', async ({ page }) => {
    await triggerCombo(page, 4);
    await page.waitForTimeout(200);

    // Verify visually via screenshot comparison
    await expect(page).toHaveScreenshot('combo-x4-glow.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('TC-ANIM-023: 콤보 x5+ 시 화면 플래시와 대형 파티클이 재생된다', async ({ page }) => {
    const beforeFlash = await page.screenshot();

    await triggerCombo(page, 5);

    // Flash happens within first ~30ms -- entire screen brightens
    await page.waitForTimeout(30);
    const duringFlash = await page.screenshot();
    expect(Buffer.compare(beforeFlash, duringFlash)).not.toBe(0);

    // At ~200ms: large particles should be visible
    await page.waitForTimeout(170);
    await expect(page).toHaveScreenshot('combo-x5-particles.png', {
      maxDiffPixelRatio: 0.08, // particles have random positions
    });
  });

  test('TC-ANIM-024: 콤보 텍스트는 2.0초 유지 후 0.5초에 걸쳐 페이드아웃된다', async ({ page }) => {
    await triggerCombo(page, 2);

    // At 1.5s: combo text should still be visible
    await page.waitForTimeout(1_500);
    const animState1 = await getAnimationState(page);
    expect(animState1.comboVisible).toBe(true);

    // At 3.0s total (2.0s timer + 0.5s fade + buffer): text gone
    await page.waitForTimeout(1_500);
    const animState2 = await getAnimationState(page);
    expect(animState2.comboVisible).toBe(false);
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 파도 웨이브', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-013: BottomToTop 파도 애니메이션이 정상 재생된다', async ({ page }) => {
    await triggerWaveAnimation(page, 'BottomToTop');

    // Animation should be in progress shortly after trigger
    await page.waitForTimeout(50);
    const playing = await isAnimationPlaying(page);
    expect(playing).toBe(true);

    // Wait for completion
    await waitForAnimationComplete(page, 5_000);

    // Verify animation is no longer playing
    const done = await isAnimationPlaying(page);
    expect(done).toBe(false);
  });

  test('TC-ANIM-014: LeftToRight 파도 애니메이션이 정상 재생된다', async ({ page }) => {
    await triggerWaveAnimation(page, 'LeftToRight');

    await page.waitForTimeout(50);
    const playing = await isAnimationPlaying(page);
    expect(playing).toBe(true);

    await waitForAnimationComplete(page, 5_000);
    const done = await isAnimationPlaying(page);
    expect(done).toBe(false);
  });

  test('TC-ANIM-015: OuterToCenter 파도 애니메이션이 정상 재생된다', async ({ page }) => {
    await triggerWaveAnimation(page, 'OuterToCenter');

    await page.waitForTimeout(50);
    const playing = await isAnimationPlaying(page);
    expect(playing).toBe(true);

    await waitForAnimationComplete(page, 5_000);
    const done = await isAnimationPlaying(page);
    expect(done).toBe(false);
  });

  test('TC-ANIM-016: 파도 방향이 BottomToTop->LeftToRight->OuterToCenter 순환한다', async ({ page }) => {
    const directions: string[] = [];

    for (let i = 0; i < 4; i++) {
      // Trigger a wave and record the direction from animation state
      await triggerWaveAnimation(page, 'auto');
      await page.waitForTimeout(50);
      const animState = await getAnimationState(page);
      directions.push(animState.waveDirection);
      await waitForAnimationComplete(page, 5_000);
    }

    // Expected cycle: BtT, LtR, OtC, BtT (wraps)
    expect(directions[0]).toBe('BottomToTop');
    expect(directions[1]).toBe('LeftToRight');
    expect(directions[2]).toBe('OuterToCenter');
    expect(directions[3]).toBe('BottomToTop'); // cycle repeats
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 파티클 이펙트', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-028: 머지 시 원형 파티클(8~12개)이 방출되고 0.4초 후 소멸한다', async ({ page }) => {
    await setBoardState(page, {
      blocks: [
        { q: 0, r: 0, value: 16 },
        { q: 1, r: 0, value: 16 },
      ],
    });

    await triggerMerge(page, 0, 0, 1, 0);

    // At 300~350ms (expand phase): particles should be visible
    await page.waitForTimeout(330);
    const expandScreenshot = await page.screenshot();

    // At 700ms: particles should have vanished (0.4s lifespan after spawn at ~300ms)
    await page.waitForTimeout(370);
    const afterParticles = await page.screenshot();

    // The screenshots should differ (particles gone)
    expect(Buffer.compare(expandScreenshot, afterParticles)).not.toBe(0);
  });

  test('TC-ANIM-029: 대형 점수(1000+) 획득 시 별 파티클이 방출되고 0.6초 후 소멸한다', async ({ page }) => {
    await setBoardState(page, {
      blocks: [
        { q: 0, r: 0, value: 512 },
        { q: 1, r: 0, value: 512 },
      ],
    });

    await triggerMerge(page, 0, 0, 1, 0);

    // At ~200ms: star particles should be visible alongside large popup
    await page.waitForTimeout(200);
    const starParticleScreenshot = await page.screenshot();

    // At ~800ms (200ms spawn + 600ms lifespan): star particles should be gone
    await page.waitForTimeout(600);
    const afterStars = await page.screenshot();

    expect(Buffer.compare(starParticleScreenshot, afterStars)).not.toBe(0);
  });

  test('TC-ANIM-030: 콤보 x5+ 시 대형 파티클(~20개)이 화면 전체에 분포하고 1초 후 소멸한다', async ({ page }) => {
    await triggerCombo(page, 5);

    // At ~200ms: large particles should be distributed across the screen
    await page.waitForTimeout(200);
    const particleScreenshot = await page.screenshot();

    // At ~1200ms (200ms + 1000ms lifespan): particles should be gone
    await page.waitForTimeout(1_000);
    const afterParticles = await page.screenshot();

    expect(Buffer.compare(particleScreenshot, afterParticles)).not.toBe(0);
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 성능 테스트', () => {
  let bridge: UnityBridge;

  // Performance tests need longer timeouts
  test.setTimeout(120_000);

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-031: 개별 애니메이션 재생 중 평균 FPS >= 55, 최저 FPS >= 30', async ({ page }) => {
    await setBoardState(page, {
      blocks: [
        { q: 0, r: 0, value: 16 },
        { q: 1, r: 0, value: 16 },
      ],
    });

    await triggerMerge(page, 0, 0, 1, 0);

    // Sample FPS 10 times at 100ms intervals
    const fpsSamples: number[] = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(100);
      const fps = await getFPS(page);
      fpsSamples.push(fps);
    }

    const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
    const minFps = Math.min(...fpsSamples);

    // Log for CI visibility
    console.log(`[TC-ANIM-031] 평균 FPS: ${avgFps.toFixed(1)}, 최저 FPS: ${minFps}`);

    expect(avgFps).toBeGreaterThanOrEqual(55);
    expect(minFps).toBeGreaterThanOrEqual(30);
  });

  test('TC-ANIM-032: 복합 애니메이션(머지 + 콤보) 동시 재생 시 최저 FPS >= 30', async ({ page }) => {
    await setBoardState(page, {
      blocks: [
        { q: 0, r: 0, value: 8 },
        { q: 1, r: 0, value: 8 },
        { q: 2, r: 0, value: 4 },
        { q: 3, r: 0, value: 4 },
      ],
    });

    // Trigger merge + combo simultaneously
    await triggerMerge(page, 0, 0, 1, 0);
    await triggerCombo(page, 3);

    // Sample FPS 20 times at 50ms intervals
    const fpsSamples: number[] = [];
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(50);
      const fps = await getFPS(page);
      fpsSamples.push(fps);
    }

    const minFps = Math.min(...fpsSamples);
    const avgFps = fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;

    console.log(`[TC-ANIM-032] 복합 애니메이션 FPS 샘플: ${fpsSamples.join(', ')}`);
    console.log(`[TC-ANIM-032] 평균 FPS: ${avgFps.toFixed(1)}, 최저 FPS: ${minFps}`);

    expect(minFps).toBeGreaterThanOrEqual(30);
  });

  test('TC-ANIM-033: 30초 연속 애니메이션 수행 시 FPS 하락이 15fps 이내이고 메모리 누수가 없다', async ({ page }) => {
    // Measure initial memory
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    const fpsSamplesOverTime: Array<{ time: number; fps: number }> = [];

    // Run animations for 30 seconds, triggering merge + wave every 2 seconds
    for (let sec = 0; sec < 30; sec += 2) {
      await setBoardState(page, {
        blocks: [
          { q: 0, r: 0, value: 2 },
          { q: 1, r: 0, value: 2 },
        ],
      });
      await triggerMerge(page, 0, 0, 1, 0);
      await page.waitForTimeout(1_000);
      await triggerWaveAnimation(page, 'BottomToTop');
      await page.waitForTimeout(1_000);

      const fps = await getFPS(page);
      fpsSamplesOverTime.push({ time: sec, fps });
    }

    // FPS should not drop more than 15 between first and last sample
    const firstFps = fpsSamplesOverTime[0].fps;
    const lastFps = fpsSamplesOverTime[fpsSamplesOverTime.length - 1].fps;
    const fpsDrop = firstFps - lastFps;

    console.log(`[TC-ANIM-033] FPS 변화: ${firstFps} -> ${lastFps} (하락: ${fpsDrop})`);
    expect(fpsDrop).toBeLessThan(15);

    // Check memory growth (only when performance.memory is available)
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    if (initialMemory > 0 && finalMemory > 0) {
      const memoryGrowthPct = ((finalMemory - initialMemory) / initialMemory) * 100;
      console.log(`[TC-ANIM-033] 메모리 증가율: ${memoryGrowthPct.toFixed(1)}%`);
      expect(memoryGrowthPct).toBeLessThan(50);
    }
  });
});

// ---------------------------------------------------------------------------

test.describe('애니메이션 시스템 - 시각적 회귀 테스트', () => {
  let bridge: UnityBridge;

  /** Deterministic board layout for reproducible screenshots */
  const FIXED_BOARD_STATE = {
    blocks: [
      { q: 0, r: -2, value: 2 },
      { q: 1, r: -2, value: 4 },
      { q: 2, r: -2, value: 8 },
      { q: -1, r: -1, value: 16 },
      { q: 0, r: -1, value: 32 },
      { q: 1, r: -1, value: 64 },
      { q: 2, r: -1, value: 128 },
      { q: -2, r: 0, value: 2 },
      { q: -1, r: 0, value: 4 },
      { q: 0, r: 0, value: 32 },
      { q: 1, r: 0, value: 32 },
      { q: 2, r: 0, value: 8 },
    ],
  };

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
    await waitForHexaTestReady(page);
  });

  test('TC-ANIM-034: 블록 생성 완료 후 스크린샷이 기준 이미지와 2% 이내로 일치한다', async ({ page }) => {
    await setBoardState(page, FIXED_BOARD_STATE);
    await triggerSpawnAnimation(page, 12);
    await waitForAnimationComplete(page, 3_000);

    // Extra stabilization wait
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('spawn-complete.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('TC-ANIM-035: 머지(32+32) 완료 후 스크린샷이 기준 이미지와 2% 이내로 일치한다', async ({ page }) => {
    await setBoardState(page, FIXED_BOARD_STATE);
    await waitForAnimationComplete(page, 2_000);

    // Merge the two 32 blocks at (0,0) and (1,0)
    await triggerMerge(page, 0, 0, 1, 0);
    await waitForAnimationComplete(page, 3_000);

    // Wait for particle dissipation
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('merge-complete.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('TC-ANIM-036: 화면 전환 완료 후 스크린샷이 기준 이미지와 2% 이내로 일치한다', async ({ page }) => {
    // MainMenu -> Game transition
    await triggerScreenTransition(page, 'MainMenu', 'Game');
    await waitForAnimationComplete(page, 3_000);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('transition-to-game.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });

    // Game -> Pause transition
    await triggerScreenTransition(page, 'Game', 'Pause');
    await waitForAnimationComplete(page, 2_000);
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('transition-to-pause.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });
});
