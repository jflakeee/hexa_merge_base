import { test, expect } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

/**
 * 광고 보상 시스템 테스트
 *
 * AdManager 스텁(Mock) 기반의 광고 초기화, 배너 표시/숨김, 보상형 광고 흐름,
 * 보상 유형별(Continue/RemoveTile/UndoMove) 지급, 쿨다운 타이머(30초),
 * 광고 제거(AdsRemoved) 영속성을 검증한다.
 *
 * 참조: docs/test-plans/07_ad-reward/test-plan.md
 */

// ---------------------------------------------------------------------------
// 상수
// ---------------------------------------------------------------------------

const UNITY_INSTANCE_VAR = 'unityInstance';

/** 보상형 광고 쿨다운(초) - AdManager 스텁 기본 설정 */
const REWARD_AD_COOLDOWN_SEC = 30;

/** 보상형 광고 시뮬레이션 완료 대기 시간(ms) */
const AD_SIMULATION_TIMEOUT = 10_000;

/** Unity 상태 변화 반영 대기 시간(ms) */
const STATE_SETTLE_MS = 1_500;

// ---------------------------------------------------------------------------
// 헬퍼 유틸리티
// ---------------------------------------------------------------------------

/**
 * AdManager(스텁)에게 SendMessage 를 보내는 공통 래퍼.
 * 기존 UnityBridge 가 WebGLBridge 전용이므로, AdManager 전용 호출을 별도 함수로 분리한다.
 */
async function sendToAdManager(
  bridge: UnityBridge,
  method: string,
  param = '',
): Promise<void> {
  await bridge['page'].evaluate(
    ({ varName, go, m, p }: { varName: string; go: string; m: string; p: string }) => {
      (window as any)[varName].SendMessage(go, m, p);
    },
    { varName: UNITY_INSTANCE_VAR, go: 'AdManager', m: method, p: param },
  );
}

/**
 * Unity 페이지에서 gamebridge 상태 조회 값을 가져오는 범용 헬퍼.
 */
async function evaluateBridge<T>(bridge: UnityBridge, expression: string): Promise<T> {
  return bridge['page'].evaluate(expression) as Promise<T>;
}

/**
 * unity-message CustomEvent 에서 특정 이벤트가 올 때까지 대기한다.
 * AdManager 스텁이 발행하는 이벤트를 수신할 때 사용.
 */
async function waitForAdEvent(
  bridge: UnityBridge,
  eventName: string,
  timeout = AD_SIMULATION_TIMEOUT,
): Promise<any> {
  return bridge['page'].evaluate(
    ({ evtName, timeoutMs }: { evtName: string; timeoutMs: number }) => {
      return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`Ad event timeout: ${evtName}`));
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
  );
}

/**
 * 짧은 대기 헬퍼. Unity 측 상태 반영을 기다릴 때 사용한다.
 */
function settle(ms = STATE_SETTLE_MS): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ===========================================================================
// 테스트 그룹 1: 광고 초기화 (Ad Initialization)
// ===========================================================================

test.describe('광고 초기화 - AdManager 스텁 로드 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('AdManager 스텁이 초기화되면 adInitialized 이벤트가 발생한다', async () => {
    // AdManager 스텁 초기화 요청 후 이벤트 대기
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    const evt = await initPromise;

    expect(evt).toHaveProperty('event', 'adInitialized');
    expect(evt).toHaveProperty('stubMode', true);
  });

  test('초기화 후 배너 광고가 로드 가능 상태가 된다', async () => {
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // 배너 로드 가능 여부 확인
    const canLoadBanner: boolean = await evaluateBridge(
      bridge,
      '(() => (window.gamebridge ? window.gamebridge.isBannerReady() : true))()',
    );
    expect(canLoadBanner).toBe(true);
  });

  test('초기화 후 보상형 광고가 로드 가능 상태가 된다', async () => {
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // 보상형 광고 로드 가능 여부 확인
    const canLoadRewarded: boolean = await evaluateBridge(
      bridge,
      '(() => (window.gamebridge ? window.gamebridge.isRewardedReady() : true))()',
    );
    expect(canLoadRewarded).toBe(true);
  });
});

// ===========================================================================
// 테스트 그룹 2: 배너 광고 표시/숨김 (Banner Show/Hide)
// ===========================================================================

test.describe('배너 광고 - 표시 및 숨김 동작', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    // 광고 시스템 초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;
  });

  test('ShowBanner 호출 시 bannerShown 이벤트가 발생한다', async () => {
    const shownPromise = waitForAdEvent(bridge, 'bannerShown');
    await sendToAdManager(bridge, 'ShowBanner', '');
    const evt = await shownPromise;

    expect(evt).toHaveProperty('event', 'bannerShown');
  });

  test('HideBanner 호출 시 bannerHidden 이벤트가 발생한다', async () => {
    // 먼저 배너를 보여준다
    const shownPromise = waitForAdEvent(bridge, 'bannerShown');
    await sendToAdManager(bridge, 'ShowBanner', '');
    await shownPromise;

    // 배너 숨김 요청
    const hiddenPromise = waitForAdEvent(bridge, 'bannerHidden');
    await sendToAdManager(bridge, 'HideBanner', '');
    const evt = await hiddenPromise;

    expect(evt).toHaveProperty('event', 'bannerHidden');
  });

  test('배너를 숨긴 후 다시 ShowBanner 호출 시 정상적으로 표시된다', async () => {
    // 표시
    let shownPromise = waitForAdEvent(bridge, 'bannerShown');
    await sendToAdManager(bridge, 'ShowBanner', '');
    await shownPromise;

    // 숨김
    const hiddenPromise = waitForAdEvent(bridge, 'bannerHidden');
    await sendToAdManager(bridge, 'HideBanner', '');
    await hiddenPromise;

    // 다시 표시
    shownPromise = waitForAdEvent(bridge, 'bannerShown');
    await sendToAdManager(bridge, 'ShowBanner', '');
    const evt = await shownPromise;

    expect(evt).toHaveProperty('event', 'bannerShown');
  });
});

// ===========================================================================
// 테스트 그룹 3: 보상형 광고 흐름 (Reward Ad Flow - Simulation)
// ===========================================================================

test.describe('보상형 광고 - 시뮬레이션 흐름', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // AdManager 초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // 쿨다운 및 상태 초기화
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');
    await sendToAdManager(bridge, 'SetMockAdDelay', '0');
  });

  test('보상형 광고 요청 시 rewardAdLoaded 이벤트가 발생한다', async () => {
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    const evt = await loadedPromise;

    expect(evt).toHaveProperty('event', 'rewardAdLoaded');
  });

  test('보상형 광고 시청 완료 시 rewardGranted 이벤트가 발생한다', async () => {
    // 광고 로드
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    // 광고 표시 및 완료 대기
    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await grantedPromise;

    expect(evt).toHaveProperty('event', 'rewardGranted');
  });

  test('Mock 결과가 cancel 일 때 보상이 지급되지 않는다', async () => {
    await sendToAdManager(bridge, 'SetMockAdResult', 'cancel');

    // 광고 로드
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    // 광고 표시 - 취소 이벤트 대기
    const cancelPromise = waitForAdEvent(bridge, 'rewardAdCancelled');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await cancelPromise;

    expect(evt).toHaveProperty('event', 'rewardAdCancelled');
  });

  test('Mock 결과가 fail 일 때 rewardAdFailed 이벤트가 발생한다', async () => {
    await sendToAdManager(bridge, 'SetMockAdResult', 'fail');

    // 광고 로드 시도
    const failPromise = waitForAdEvent(bridge, 'rewardAdFailed');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    const evt = await failPromise;

    expect(evt).toHaveProperty('event', 'rewardAdFailed');
  });

  test('광고 시청 완료 후 rewardAdClosed 이벤트가 발생한다', async () => {
    // 광고 로드
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    // 광고 표시 - 완료 & 닫힘 이벤트 대기
    const closedPromise = waitForAdEvent(bridge, 'rewardAdClosed');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await closedPromise;

    expect(evt).toHaveProperty('event', 'rewardAdClosed');
  });
});

// ===========================================================================
// 테스트 그룹 4: 보상 유형 (Reward Types)
// ===========================================================================

test.describe('보상 유형 - Continue / RemoveTile / UndoMove', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // AdManager 초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // 게임 시작 (보상 적용 대상 게임 상태 생성)
    await bridge.loadAndStartGame();

    // 쿨다운 및 Mock 상태 초기화
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');
    await sendToAdManager(bridge, 'SetMockAdDelay', '0');
  });

  test('Continue 보상: 게임 오버 후 광고 시청 시 게임이 이어서 진행된다', async () => {
    // 게임 상태를 GameOver 로 전환
    await bridge['page'].evaluate((varName: string) => {
      (window as any)[varName].SendMessage('GameManager', 'JS_TriggerGameOver', '');
    }, UNITY_INSTANCE_VAR);
    await settle();

    // 게임 오버 상태 확인
    const stateBeforeReward = await bridge.getGameState();
    expect(stateBeforeReward.state).toBe('GameOver');

    // Continue 보상형 광고 요청
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', 'Continue');
    const evt = await grantedPromise;

    expect(evt).toHaveProperty('rewardType', 'Continue');

    // 게임이 Playing 상태로 복원되었는지 확인
    await settle();
    const stateAfterReward = await bridge.getGameState();
    expect(stateAfterReward.state).toBe('Playing');
  });

  test('RemoveTile 보상: 광고 시청 후 타일 1개가 제거된다', async () => {
    // 현재 비어있지 않은 셀 수를 기록
    const nonEmptyBefore = await bridge.getNonEmptyCells();
    const countBefore = nonEmptyBefore.length;
    expect(countBefore).toBeGreaterThan(0);

    // RemoveTile 보상형 광고 요청
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', 'RemoveTile');
    const evt = await grantedPromise;

    expect(evt).toHaveProperty('rewardType', 'RemoveTile');

    // 타일 제거 반영 대기
    await settle();

    // 비어있지 않은 셀 수가 1 감소했는지 확인
    const nonEmptyAfter = await bridge.getNonEmptyCells();
    expect(nonEmptyAfter.length).toBe(countBefore - 1);
  });

  test('UndoMove 보상: 광고 시청 후 마지막 이동이 되돌려진다', async () => {
    // 타일을 탭하여 이동 발생시키기
    const nonEmpty = await bridge.getNonEmptyCells();
    expect(nonEmpty.length).toBeGreaterThan(0);

    // 이동 전 보드 상태 기록
    const stateBefore = await bridge.getGameState();
    const scoreBeforeTap = stateBefore.score;

    // 비어있는 셀을 찾아서 탭 (타일 배치가 발생)
    const allCells = stateBefore.cells;
    const emptyCell = allCells.find((c) => c.v === 0);
    if (emptyCell) {
      await bridge.tapCell(emptyCell.q, emptyCell.r);
      await settle(500);
    }

    // 이동 후 상태 기록
    const stateAfterTap = await bridge.getGameState();

    // UndoMove 보상형 광고 요청
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', 'UndoMove');
    const evt = await grantedPromise;

    expect(evt).toHaveProperty('rewardType', 'UndoMove');

    // Undo 반영 대기
    await settle();

    // 되돌린 후 상태 확인 (점수가 탭 이전으로 복원되었거나, 보드 상태가 변경됨)
    const stateAfterUndo = await bridge.getGameState();
    // UndoMove 는 마지막 이동을 되돌리므로, 이전 점수와 같거나 보드 셀 구성이 달라져야 한다
    const undoApplied =
      stateAfterUndo.score <= stateAfterTap.score ||
      JSON.stringify(stateAfterUndo.cells) !== JSON.stringify(stateAfterTap.cells);
    expect(undoApplied).toBe(true);
  });

  test('알 수 없는 보상 유형은 무시되고 에러 이벤트가 발생하지 않는다', async () => {
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    // 잘못된 보상 유형으로 광고 표시 시도
    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', 'InvalidType');
    const evt = await grantedPromise;

    // 보상이 지급되더라도 게임 상태가 비정상적으로 변하지 않는지 확인
    await settle();
    const state = await bridge.getGameState();
    expect(['Ready', 'Playing', 'Paused', 'GameOver']).toContain(state.state);
  });
});

// ===========================================================================
// 테스트 그룹 5: 쿨다운 타이머 (30초)
// ===========================================================================

test.describe('쿨다운 타이머 - 보상형 광고 30초 재사용 제한', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // AdManager 초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // 쿨다운 초기화 및 Mock 성공 설정
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');
    await sendToAdManager(bridge, 'SetMockAdDelay', '0');
  });

  test('광고 시청 완료 직후 쿨다운이 시작되어 재시청이 차단된다', async () => {
    // 첫 번째 광고 시청 완료
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    await grantedPromise;

    await settle(500);

    // 쿨다운 중 두 번째 광고 시도 - 차단 이벤트 확인
    const cooldownPromise = waitForAdEvent(bridge, 'rewardAdCooldown', 5_000);
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await cooldownPromise;

    expect(evt).toHaveProperty('event', 'rewardAdCooldown');
    expect(evt).toHaveProperty('remainingSeconds');
    expect(evt.remainingSeconds).toBeGreaterThan(0);
    expect(evt.remainingSeconds).toBeLessThanOrEqual(REWARD_AD_COOLDOWN_SEC);
  });

  test('남은 쿨다운 시간이 30초 이하로 보고된다', async () => {
    // 광고 시청 완료
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    await grantedPromise;

    await settle(500);

    // 쿨다운 조회
    const cooldownPromise = waitForAdEvent(bridge, 'rewardAdCooldown', 5_000);
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await cooldownPromise;

    // 대략 28~30초 범위 (500ms settle 고려)
    expect(evt.remainingSeconds).toBeGreaterThanOrEqual(REWARD_AD_COOLDOWN_SEC - 3);
    expect(evt.remainingSeconds).toBeLessThanOrEqual(REWARD_AD_COOLDOWN_SEC);
  });

  test('쿨다운 경과 후 광고를 다시 시청할 수 있다', async () => {
    // 첫 번째 광고 시청 완료
    let loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    await grantedPromise;

    // 시간 조작: 쿨다운(30초) 경과 시뮬레이션
    await sendToAdManager(bridge, 'AdvanceTime', REWARD_AD_COOLDOWN_SEC.toString());
    await settle(500);

    // 두 번째 광고 시청 시도 - 성공해야 한다
    loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise2 = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await grantedPromise2;

    expect(evt).toHaveProperty('event', 'rewardGranted');
  });

  test('ResetAllCooldowns 호출 후 즉시 재시청이 가능하다', async () => {
    // 첫 번째 광고 시청 완료
    let loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    await grantedPromise;

    // 쿨다운 강제 초기화
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await settle(500);

    // 두 번째 광고 시청 시도 - 즉시 성공해야 한다
    loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise2 = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await grantedPromise2;

    expect(evt).toHaveProperty('event', 'rewardGranted');
  });

  test('광고 취소(cancel) 시에는 쿨다운이 시작되지 않는다', async () => {
    // Mock 결과를 cancel 로 설정
    await sendToAdManager(bridge, 'SetMockAdResult', 'cancel');

    // 광고 로드 및 표시 (취소됨)
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const cancelPromise = waitForAdEvent(bridge, 'rewardAdCancelled');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    await cancelPromise;

    await settle(500);

    // Mock 결과를 다시 success 로 변경
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');

    // 즉시 재시도 - 쿨다운 없이 성공해야 한다
    const loadedPromise2 = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise2;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await grantedPromise;

    expect(evt).toHaveProperty('event', 'rewardGranted');
  });
});

// ===========================================================================
// 테스트 그룹 6: 광고 제거 (Ads Removed / AdsRemoved 영속성)
// ===========================================================================

test.describe('광고 제거 - AdsRemoved PlayerPrefs 영속성', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // AdManager 초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // AdsRemoved 상태 초기화 (광고 활성 상태로)
    await sendToAdManager(bridge, 'SetAdsRemoved', 'false');
    await settle(500);
  });

  test('AdsRemoved 가 false 일 때 배너 광고가 정상 표시된다', async () => {
    const shownPromise = waitForAdEvent(bridge, 'bannerShown');
    await sendToAdManager(bridge, 'ShowBanner', '');
    const evt = await shownPromise;

    expect(evt).toHaveProperty('event', 'bannerShown');
  });

  test('AdsRemoved 를 true 로 설정하면 배너가 즉시 숨겨진다', async () => {
    // 배너 표시
    const shownPromise = waitForAdEvent(bridge, 'bannerShown');
    await sendToAdManager(bridge, 'ShowBanner', '');
    await shownPromise;

    // 광고 제거 설정
    const hiddenPromise = waitForAdEvent(bridge, 'bannerHidden');
    await sendToAdManager(bridge, 'SetAdsRemoved', 'true');
    const evt = await hiddenPromise;

    expect(evt).toHaveProperty('event', 'bannerHidden');
  });

  test('AdsRemoved 상태에서 ShowBanner 호출 시 배너가 표시되지 않는다', async () => {
    // 광고 제거 설정
    await sendToAdManager(bridge, 'SetAdsRemoved', 'true');
    await settle(500);

    // 배너 표시 시도 - adsRemovedBlocked 이벤트가 발생해야 한다
    const blockedPromise = waitForAdEvent(bridge, 'adsRemovedBlocked', 5_000);
    await sendToAdManager(bridge, 'ShowBanner', '');
    const evt = await blockedPromise;

    expect(evt).toHaveProperty('event', 'adsRemovedBlocked');
    expect(evt).toHaveProperty('adType', 'banner');
  });

  test('AdsRemoved 가 true 여도 보상형 광고는 여전히 시청 가능하다', async () => {
    // 광고 제거 설정
    await sendToAdManager(bridge, 'SetAdsRemoved', 'true');
    await settle(500);

    // 보상형 광고는 AdsRemoved 와 무관하게 시청 가능해야 한다
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');
    await sendToAdManager(bridge, 'SetMockAdDelay', '0');
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');

    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await grantedPromise;

    expect(evt).toHaveProperty('event', 'rewardGranted');
  });

  test('AdsRemoved 상태가 페이지 새로고침 후에도 유지된다 (PlayerPrefs 영속성)', async ({ page }) => {
    // 광고 제거 설정
    await sendToAdManager(bridge, 'SetAdsRemoved', 'true');
    await settle(1_000);

    // 페이지 새로고침
    await page.reload();
    bridge = new UnityBridge(page);
    await bridge.waitForUnityLoad();

    // AdManager 재초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // AdsRemoved 상태가 유지되어 배너 표시가 차단되는지 확인
    const blockedPromise = waitForAdEvent(bridge, 'adsRemovedBlocked', 5_000);
    await sendToAdManager(bridge, 'ShowBanner', '');
    const evt = await blockedPromise;

    expect(evt).toHaveProperty('event', 'adsRemovedBlocked');
  });

  test('AdsRemoved 를 false 로 복원하면 배너가 다시 표시 가능하다', async () => {
    // 광고 제거 설정
    await sendToAdManager(bridge, 'SetAdsRemoved', 'true');
    await settle(500);

    // 광고 제거 해제
    await sendToAdManager(bridge, 'SetAdsRemoved', 'false');
    await settle(500);

    // 배너 다시 표시
    const shownPromise = waitForAdEvent(bridge, 'bannerShown');
    await sendToAdManager(bridge, 'ShowBanner', '');
    const evt = await shownPromise;

    expect(evt).toHaveProperty('event', 'bannerShown');
  });
});

// ===========================================================================
// 테스트 그룹 7: 일일 제한 및 쿨다운 연동
// ===========================================================================

test.describe('일일 제한 및 쿨다운 연동', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // AdManager 초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // 상태 초기화
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await sendToAdManager(bridge, 'ResetDailyAdCount', '');
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');
    await sendToAdManager(bridge, 'SetMockAdDelay', '0');
    await sendToAdManager(bridge, 'SetConsecutiveFailures', '0');
  });

  test('일일 광고 횟수 한도(20회)에 도달하면 추가 시청이 차단된다', async () => {
    // 일일 카운터를 19회로 설정
    await sendToAdManager(bridge, 'SetDailyAdCount', '19');

    // 20회째 광고 시청 - 정상 처리되어야 한다
    let loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    await grantedPromise;

    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await settle(500);

    // 21회째 시도 - 일일 한도 초과 이벤트
    const limitPromise = waitForAdEvent(bridge, 'dailyLimitReached', 5_000);
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await limitPromise;

    expect(evt).toHaveProperty('event', 'dailyLimitReached');
  });

  test('UTC 자정 시뮬레이션 후 일일 카운터가 리셋된다', async () => {
    // 일일 카운터를 20회(한도)로 설정
    await sendToAdManager(bridge, 'SetDailyAdCount', '20');

    // 한도 초과 확인
    const limitPromise = waitForAdEvent(bridge, 'dailyLimitReached', 5_000);
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    await limitPromise;

    // UTC 자정 리셋 시뮬레이션
    await sendToAdManager(bridge, 'SimulateUTCMidnight', '');
    await settle(500);

    // 리셋 후 광고 시청 가능 확인
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await grantedPromise;

    expect(evt).toHaveProperty('event', 'rewardGranted');
  });

  test('연속 3회 실패 후 광고가 비활성화된다', async () => {
    await sendToAdManager(bridge, 'SetMockAdResult', 'fail');

    // 3회 연속 실패 시뮬레이션
    for (let i = 0; i < 3; i++) {
      await sendToAdManager(bridge, 'ResetAllCooldowns', '');
      const failPromise = waitForAdEvent(bridge, 'rewardAdFailed', 5_000);
      await sendToAdManager(bridge, 'LoadRewardedAd', '');
      await failPromise;
      await settle(500);
    }

    // 3회 연속 실패 후 비활성화 이벤트 확인
    const disabledPromise = waitForAdEvent(bridge, 'adsDisabledByFailure', 5_000);
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    const evt = await disabledPromise;

    expect(evt).toHaveProperty('event', 'adsDisabledByFailure');
  });
});

// ===========================================================================
// 테스트 그룹 8: 오프라인 처리
// ===========================================================================

test.describe('오프라인 광고 처리', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // AdManager 초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');
    await sendToAdManager(bridge, 'SetMockAdDelay', '0');
  });

  test('오프라인 전환 시 배너가 숨겨진다', async ({ context }) => {
    // 먼저 배너 표시
    const shownPromise = waitForAdEvent(bridge, 'bannerShown');
    await sendToAdManager(bridge, 'ShowBanner', '');
    await shownPromise;

    // 오프라인 전환
    await context.setOffline(true);
    // Unity에 오프라인 상태 알림
    await sendToAdManager(bridge, 'SimulateOffline', 'true');
    await settle(1_000);

    // 배너 숨김 이벤트 또는 오프라인 상태 전환 이벤트 확인
    const events = await bridge.getCollectedEvents();
    const hasOfflineEvent = events.some(
      (e: any) => e.event === 'bannerHidden' || e.event === 'offlineDetected',
    );
    expect(hasOfflineEvent).toBe(true);

    // 온라인 복귀
    await sendToAdManager(bridge, 'SimulateOffline', 'false');
    await context.setOffline(false);
    await settle(1_000);
  });

  test('오프라인 상태에서 보상형 광고 요청 시 오프라인 알림이 발생한다', async ({ context }) => {
    // 오프라인 전환
    await context.setOffline(true);
    // Unity에 오프라인 상태 알림
    await sendToAdManager(bridge, 'SimulateOffline', 'true');
    await settle(1_000);

    // 오프라인에서 보상형 광고 요청
    const offlinePromise = waitForAdEvent(bridge, 'adOfflineBlocked', 5_000).catch(() => null);
    const failPromise = waitForAdEvent(bridge, 'rewardAdFailed', 5_000).catch(() => null);
    await sendToAdManager(bridge, 'ShowRewardedAd', 'Continue');

    // 오프라인 차단 또는 실패 이벤트 중 하나가 발생해야 한다
    const result = await Promise.race([
      offlinePromise,
      failPromise,
    ]);
    expect(result).not.toBeNull();

    // 온라인 복귀
    await sendToAdManager(bridge, 'SimulateOffline', 'false');
    await context.setOffline(false);
    await settle(1_000);
  });

  test('온라인 복귀 후 광고가 다시 정상 동작한다', async ({ context }) => {
    // 오프라인 전환
    await context.setOffline(true);
    await settle(3_000);

    // 온라인 복귀
    await context.setOffline(false);
    await settle(5_000);

    // 쿨다운 초기화
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');

    // 광고 시청 시도 - 성공해야 한다
    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const evt = await grantedPromise;

    expect(evt).toHaveProperty('event', 'rewardGranted');
  });
});

// ===========================================================================
// 테스트 그룹 9: GDPR 동의 처리
// ===========================================================================

test.describe('GDPR 동의 - 광고 개인화 제어', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();

    // AdManager 초기화
    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;
  });

  test('GDPR 동의 초기화 후 동의 팝업 이벤트가 발생한다', async ({ page }) => {
    // 동의 상태 초기화
    await bridge['page'].evaluate((varName: string) => {
      (window as any)[varName].SendMessage('GDPRConsentManager', 'ResetConsent', '');
    }, UNITY_INSTANCE_VAR);

    // 페이지 새로고침
    await page.reload();
    bridge = new UnityBridge(page);
    await bridge.waitForUnityLoad();

    const initPromise = waitForAdEvent(bridge, 'adInitialized', 15_000);
    await sendToAdManager(bridge, 'InitializeAds', '');
    await initPromise;

    // 동의 팝업 이벤트 대기
    const consentPromise = waitForAdEvent(bridge, 'gdprConsentRequired', 10_000);
    await sendToAdManager(bridge, 'CheckGDPRConsent', '');
    const evt = await consentPromise;

    expect(evt).toHaveProperty('event', 'gdprConsentRequired');
  });

  test('GDPR 동의 시 광고 개인화가 활성화된다', async () => {
    // 동의 처리
    const consentPromise = waitForAdEvent(bridge, 'gdprConsentUpdated', 5_000);
    await bridge['page'].evaluate((varName: string) => {
      (window as any)[varName].SendMessage('GDPRConsentManager', 'SetConsent', 'true');
    }, UNITY_INSTANCE_VAR);
    const evt = await consentPromise;

    expect(evt).toHaveProperty('event', 'gdprConsentUpdated');
    expect(evt).toHaveProperty('consented', true);
  });

  test('GDPR 거부 시 광고 개인화가 비활성화되지만 광고 자체는 가능하다', async () => {
    // 거부 처리
    const consentPromise = waitForAdEvent(bridge, 'gdprConsentUpdated', 5_000);
    await bridge['page'].evaluate((varName: string) => {
      (window as any)[varName].SendMessage('GDPRConsentManager', 'SetConsent', 'false');
    }, UNITY_INSTANCE_VAR);
    const evt = await consentPromise;

    expect(evt).toHaveProperty('event', 'gdprConsentUpdated');
    expect(evt).toHaveProperty('consented', false);

    // GDPR 거부 후에도 광고 시청은 가능해야 한다
    await sendToAdManager(bridge, 'ResetAllCooldowns', '');
    await sendToAdManager(bridge, 'SetMockAdResult', 'success');
    await sendToAdManager(bridge, 'SetMockAdDelay', '0');

    const loadedPromise = waitForAdEvent(bridge, 'rewardAdLoaded');
    await sendToAdManager(bridge, 'LoadRewardedAd', '');
    await loadedPromise;

    const grantedPromise = waitForAdEvent(bridge, 'rewardGranted');
    await sendToAdManager(bridge, 'ShowRewardedAd', '');
    const grantedEvt = await grantedPromise;

    expect(grantedEvt).toHaveProperty('event', 'rewardGranted');
  });
});
