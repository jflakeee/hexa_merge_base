import { test, expect, Page } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

// ---------------------------------------------------------------------------
// IAP 제품 카탈로그 정의
// ---------------------------------------------------------------------------

interface IAPProduct {
  productId: string;
  type: 'consumable' | 'non-consumable';
  price: string;
}

const IAP_PRODUCTS: IAPProduct[] = [
  { productId: 'RemoveAds', type: 'non-consumable', price: '$2.99' },
  { productId: 'GemPack_Small', type: 'consumable', price: '$0.99' },
  { productId: 'GemPack_Large', type: 'consumable', price: '$4.99' },
  { productId: 'UndoPack', type: 'consumable', price: '$1.99' },
];

const CONSUMABLE_PRODUCTS = IAP_PRODUCTS.filter((p) => p.type === 'consumable');
const NON_CONSUMABLE_PRODUCTS = IAP_PRODUCTS.filter((p) => p.type === 'non-consumable');

/** Unity SendMessage 호출 래퍼 */
const UNITY_INSTANCE_VAR = 'unityInstance';

// ---------------------------------------------------------------------------
// IAP 브릿지 헬퍼 함수
// ---------------------------------------------------------------------------

/**
 * IAPManager에 SendMessage를 전달한다.
 */
async function sendIAPMessage(
  page: Page,
  methodName: string,
  value: string = '',
): Promise<void> {
  await page.evaluate(
    ({ varName, method, val }) => {
      (window as any)[varName].SendMessage('IAPManager', method, val);
    },
    { varName: UNITY_INSTANCE_VAR, method: methodName, val: value },
  );
}

/**
 * Mock 구매 결과를 설정한다.
 */
async function setMockPurchaseResult(
  page: Page,
  result: 'success' | 'cancel' | 'network_error' | 'product_unavailable' | 'payment_declined',
): Promise<void> {
  await sendIAPMessage(page, 'SetMockPurchaseResult', result);
}

/**
 * 모든 구매 기록을 초기화한다.
 */
async function resetAllPurchases(page: Page): Promise<void> {
  await sendIAPMessage(page, 'ResetAllPurchases', '');
  // 초기화 처리 시간 대기
  await page.waitForTimeout(500);
}

/**
 * 특정 상품의 Mock 구매를 트리거한다.
 * IAPManager.PurchaseProduct(productId) 호출.
 */
async function purchaseProduct(page: Page, productId: string): Promise<void> {
  await sendIAPMessage(page, 'PurchaseProduct', productId);
}

/**
 * 구매 복원을 시뮬레이션한다.
 * 복원할 비소비형 상품 ID 목록을 쉼표로 구분하여 전달.
 */
async function simulateRestorePurchases(
  page: Page,
  productIds: string[],
): Promise<void> {
  await sendIAPMessage(page, 'SimulateRestorePurchases', productIds.join(','));
}

/**
 * IAP 관련 gamebridge 상태를 조회한다.
 * unity-message 이벤트를 통해 콜백으로 응답을 받는다.
 */
async function getIAPState(page: Page, timeout = 15_000): Promise<{
  isInitialized: boolean;
  products: Array<{
    productId: string;
    type: string;
    price: string;
    isAvailable: boolean;
  }>;
  purchasedNonConsumables: string[];
  isAdsRemoved: boolean;
  lastPurchaseResult: {
    productId: string;
    isSuccess: boolean;
    failureReason: string;
  } | null;
}> {
  const callbackId = `iap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  return page.evaluate(
    ({ varName, cbId, timeoutMs }) => {
      return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`IAP 상태 콜백 타임아웃: ${cbId}`));
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

        (window as any)[varName].SendMessage('IAPManager', 'JS_GetIAPState', cbId);
      });
    },
    { varName: UNITY_INSTANCE_VAR, cbId: callbackId, timeoutMs: timeout },
  );
}

/**
 * unity-message 이벤트에서 IAP 관련 이벤트를 대기한다.
 */
async function waitForIAPEvent(
  page: Page,
  eventName: string,
  timeout = 15_000,
): Promise<any> {
  return page.evaluate(
    ({ evtName, timeoutMs }) => {
      return new Promise<any>((resolve, reject) => {
        const timer = setTimeout(() => {
          reject(new Error(`IAP 이벤트 대기 타임아웃: ${evtName}`));
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
 * ShopScreen을 연다 (SendMessage 경유).
 */
async function openShopScreen(page: Page): Promise<void> {
  await page.evaluate((varName: string) => {
    (window as any)[varName].SendMessage('GameManager', 'JS_OpenShop', '');
  }, UNITY_INSTANCE_VAR);
  // 상점 UI 전환 대기
  await page.waitForTimeout(1000);
}

/**
 * ShopScreen을 닫는다.
 */
async function closeShopScreen(page: Page): Promise<void> {
  await page.evaluate((varName: string) => {
    (window as any)[varName].SendMessage('GameManager', 'JS_CloseShop', '');
  }, UNITY_INSTANCE_VAR);
  await page.waitForTimeout(500);
}

// ---------------------------------------------------------------------------
// 테스트 시작
// ---------------------------------------------------------------------------

/**
 * 인앱 결제(IAP) 시스템 테스트
 *
 * IAPManager 스텁의 동작을 검증한다.
 * - 제품 카탈로그 조회
 * - 구매 시뮬레이션 (성공/실패)
 * - 구매 복원
 * - RemoveAds -> AdManager 연동
 * - 구매 이력 영속성
 *
 * 참고: IAPManager는 스텁이며 실제 Google Play Billing SDK를 사용하지 않는다.
 *       WebGL 빌드에서 EditorIAPService(Mock) 기반으로 동작한다.
 */

test.describe('IAP 시스템 - 제품 카탈로그', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('IAP 서비스가 초기화되면 4종 상품 카탈로그를 반환한다', async ({ page }) => {
    // IAPManager 초기화 완료 대기 (Start() 비동기 처리 감안 폴링)
    let iapState = await getIAPState(page);
    const deadline = Date.now() + 30_000;
    while (!iapState.isInitialized && Date.now() < deadline) {
      await page.waitForTimeout(500);
      iapState = await getIAPState(page);
    }

    expect(iapState.isInitialized).toBe(true);
    expect(iapState.products).toHaveLength(4);

    const productIds = iapState.products.map((p) => p.productId);
    expect(productIds).toContain('RemoveAds');
    expect(productIds).toContain('GemPack_Small');
    expect(productIds).toContain('GemPack_Large');
    expect(productIds).toContain('UndoPack');
  });

  test('각 상품의 타입이 올바르게 설정되어 있다', async ({ page }) => {
    const iapState = await getIAPState(page);

    const removeAds = iapState.products.find((p) => p.productId === 'RemoveAds');
    expect(removeAds).toBeDefined();
    expect(removeAds!.type).toBe('non-consumable');

    for (const consumable of ['GemPack_Small', 'GemPack_Large', 'UndoPack']) {
      const product = iapState.products.find((p) => p.productId === consumable);
      expect(product).toBeDefined();
      expect(product!.type).toBe('consumable');
    }
  });

  test('각 상품에 유효한 가격 문자열이 설정되어 있다', async ({ page }) => {
    const iapState = await getIAPState(page);

    for (const product of iapState.products) {
      expect(product.price).toBeDefined();
      expect(typeof product.price).toBe('string');
      // 가격이 비어있거나 기본값("---")이 아닌지 확인
      expect(product.price.length).toBeGreaterThan(0);
      expect(product.price).not.toBe('---');
    }

    // 개별 가격 검증
    const priceMap = new Map(iapState.products.map((p) => [p.productId, p.price]));
    expect(priceMap.get('RemoveAds')).toBe('$2.99');
    expect(priceMap.get('GemPack_Small')).toBe('$0.99');
    expect(priceMap.get('GemPack_Large')).toBe('$4.99');
    expect(priceMap.get('UndoPack')).toBe('$1.99');
  });

  test('모든 상품이 구매 가능(available) 상태이다', async ({ page }) => {
    const iapState = await getIAPState(page);

    for (const product of iapState.products) {
      expect(product.isAvailable).toBe(true);
    }
  });

  test('초기 상태에서 구매된 비소비형 상품이 없다', async ({ page }) => {
    await resetAllPurchases(page);
    const iapState = await getIAPState(page);

    expect(iapState.purchasedNonConsumables).toHaveLength(0);
    expect(iapState.isAdsRemoved).toBe(false);
  });
});

test.describe('IAP 시스템 - 구매 플로우 (성공 시뮬레이션)', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await resetAllPurchases(page);
    await setMockPurchaseResult(page, 'success');
  });

  test('GemPack_Small 구매 시 성공 결과가 반환된다', async ({ page }) => {
    // 구매 이벤트 대기를 먼저 설정
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');

    const result = await purchasePromise;

    expect(result.productId).toBe('GemPack_Small');
    expect(result.isSuccess).toBe(true);
    expect(result.failureReason).toBeFalsy();
  });

  test('GemPack_Small 구매 후 lastPurchaseResult에 기록된다', async ({ page }) => {
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    await purchasePromise;

    const iapState = await getIAPState(page);
    expect(iapState.lastPurchaseResult).not.toBeNull();
    expect(iapState.lastPurchaseResult!.productId).toBe('GemPack_Small');
    expect(iapState.lastPurchaseResult!.isSuccess).toBe(true);
  });

  test('GemPack_Large 구매 시 성공 결과가 반환된다', async ({ page }) => {
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Large');

    const result = await purchasePromise;

    expect(result.productId).toBe('GemPack_Large');
    expect(result.isSuccess).toBe(true);
  });

  test('UndoPack 구매 시 성공 결과가 반환된다', async ({ page }) => {
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'UndoPack');

    const result = await purchasePromise;

    expect(result.productId).toBe('UndoPack');
    expect(result.isSuccess).toBe(true);
  });

  test('소비형 상품은 여러 번 구매할 수 있다', async ({ page }) => {
    // 1회차 구매
    const firstPromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    const first = await firstPromise;
    expect(first.isSuccess).toBe(true);

    // 2회차 구매
    const secondPromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    const second = await secondPromise;
    expect(second.isSuccess).toBe(true);
  });

  test('RemoveAds(비소비형) 구매 시 성공 결과가 반환된다', async ({ page }) => {
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');

    const result = await purchasePromise;

    expect(result.productId).toBe('RemoveAds');
    expect(result.isSuccess).toBe(true);
  });

  test('RemoveAds 구매 후 purchasedNonConsumables에 기록된다', async ({ page }) => {
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    await purchasePromise;

    const iapState = await getIAPState(page);
    expect(iapState.purchasedNonConsumables).toContain('RemoveAds');
  });
});

test.describe('IAP 시스템 - 구매 플로우 (실패 시뮬레이션)', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await resetAllPurchases(page);
  });

  test('사용자 취소(cancel) 시 구매 실패 이벤트가 발생한다', async ({ page }) => {
    await setMockPurchaseResult(page, 'cancel');

    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');

    const result = await purchasePromise;

    expect(result.productId).toBe('GemPack_Small');
    expect(result.isSuccess).toBe(false);
    expect(result.failureReason).toBeTruthy();
  });

  test('네트워크 오류(network_error) 시 구매 실패 이벤트가 발생한다', async ({ page }) => {
    await setMockPurchaseResult(page, 'network_error');

    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');

    const result = await purchasePromise;

    expect(result.productId).toBe('GemPack_Small');
    expect(result.isSuccess).toBe(false);
    expect(result.failureReason).toBeTruthy();
  });

  test('상품 불가(product_unavailable) 시 구매 실패 이벤트가 발생한다', async ({ page }) => {
    await setMockPurchaseResult(page, 'product_unavailable');

    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');

    const result = await purchasePromise;

    expect(result.isSuccess).toBe(false);
    expect(result.failureReason).toBeTruthy();
  });

  test('결제 거절(payment_declined) 시 구매 실패 이벤트가 발생한다', async ({ page }) => {
    await setMockPurchaseResult(page, 'payment_declined');

    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Large');

    const result = await purchasePromise;

    expect(result.isSuccess).toBe(false);
    expect(result.failureReason).toBeTruthy();
  });

  test('구매 실패 후 재화가 변동되지 않는다', async ({ page }) => {
    // 실패 전 게임 상태 기록
    const stateBefore = await bridge.getGameState();
    const scoreBefore = stateBefore.score;

    await setMockPurchaseResult(page, 'network_error');

    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    await purchasePromise;

    // 실패 후 게임 상태 확인 - 스코어 등 재화 변동이 없어야 한다
    const stateAfter = await bridge.getGameState();
    expect(stateAfter.score).toBe(scoreBefore);
  });

  test('구매 취소 후 동일 상품 재구매가 가능하다', async ({ page }) => {
    // 1차 시도: 취소
    await setMockPurchaseResult(page, 'cancel');
    const cancelPromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    const cancelResult = await cancelPromise;
    expect(cancelResult.isSuccess).toBe(false);

    // 2차 시도: 성공으로 변경 후 재구매
    await setMockPurchaseResult(page, 'success');
    const successPromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    const successResult = await successPromise;
    expect(successResult.isSuccess).toBe(true);
    expect(successResult.productId).toBe('GemPack_Small');
  });

  test('구매 실패 후 lastPurchaseResult에 실패 정보가 기록된다', async ({ page }) => {
    await setMockPurchaseResult(page, 'network_error');

    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Large');
    await purchasePromise;

    const iapState = await getIAPState(page);
    expect(iapState.lastPurchaseResult).not.toBeNull();
    expect(iapState.lastPurchaseResult!.productId).toBe('GemPack_Large');
    expect(iapState.lastPurchaseResult!.isSuccess).toBe(false);
    expect(iapState.lastPurchaseResult!.failureReason).toBeTruthy();
  });
});

test.describe('IAP 시스템 - 구매 복원', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await resetAllPurchases(page);
  });

  test('비소비형 상품(RemoveAds) 복원 시 purchasedNonConsumables에 반영된다', async ({
    page,
  }) => {
    // 초기 상태 확인: 구매 내역 없음
    const stateBefore = await getIAPState(page);
    expect(stateBefore.purchasedNonConsumables).not.toContain('RemoveAds');
    expect(stateBefore.isAdsRemoved).toBe(false);

    // 복원 이벤트 대기 설정 후 복원 시뮬레이션
    const restorePromise = waitForIAPEvent(page, 'restoreComplete', 15_000);
    await simulateRestorePurchases(page, ['RemoveAds']);

    const restoreResult = await restorePromise;
    expect(restoreResult.restoredProducts).toContain('RemoveAds');

    // 복원 후 상태 확인
    const stateAfter = await getIAPState(page);
    expect(stateAfter.purchasedNonConsumables).toContain('RemoveAds');
  });

  test('복원 시 isAdsRemoved 플래그가 true로 설정된다', async ({ page }) => {
    const restorePromise = waitForIAPEvent(page, 'restoreComplete', 15_000);
    await simulateRestorePurchases(page, ['RemoveAds']);
    await restorePromise;

    const iapState = await getIAPState(page);
    expect(iapState.isAdsRemoved).toBe(true);
  });

  test('복원할 상품이 없으면 빈 결과가 반환된다', async ({ page }) => {
    const restorePromise = waitForIAPEvent(page, 'restoreComplete', 15_000);
    await simulateRestorePurchases(page, []);

    const restoreResult = await restorePromise;
    expect(restoreResult.restoredProducts).toHaveLength(0);
  });

  test('소비형 상품은 복원 대상에서 제외된다', async ({ page }) => {
    // 소비형 상품 ID를 복원 목록에 포함시켜도 무시되어야 한다
    const restorePromise = waitForIAPEvent(page, 'restoreComplete', 15_000);
    await simulateRestorePurchases(page, ['GemPack_Small', 'RemoveAds']);

    const restoreResult = await restorePromise;

    // RemoveAds만 복원되고, GemPack_Small은 무시된다
    expect(restoreResult.restoredProducts).toContain('RemoveAds');
    expect(restoreResult.restoredProducts).not.toContain('GemPack_Small');
  });

  test('이미 구매된 상품을 다시 복원해도 중복 기록되지 않는다', async ({ page }) => {
    // 1차 복원
    const firstRestore = waitForIAPEvent(page, 'restoreComplete', 15_000);
    await simulateRestorePurchases(page, ['RemoveAds']);
    await firstRestore;

    // 2차 복원 (중복)
    const secondRestore = waitForIAPEvent(page, 'restoreComplete', 15_000);
    await simulateRestorePurchases(page, ['RemoveAds']);
    await secondRestore;

    const iapState = await getIAPState(page);
    // RemoveAds가 1건만 기록되어야 한다
    const removeAdsCount = iapState.purchasedNonConsumables.filter(
      (id) => id === 'RemoveAds',
    ).length;
    expect(removeAdsCount).toBe(1);
  });
});

test.describe('IAP 시스템 - RemoveAds -> AdManager 연동', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await resetAllPurchases(page);
    await setMockPurchaseResult(page, 'success');
  });

  test('RemoveAds 구매 전 isAdsRemoved는 false이다', async ({ page }) => {
    const iapState = await getIAPState(page);
    expect(iapState.isAdsRemoved).toBe(false);
  });

  test('RemoveAds 구매 후 isAdsRemoved가 true로 전환된다', async ({ page }) => {
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    const result = await purchasePromise;
    expect(result.isSuccess).toBe(true);

    const iapState = await getIAPState(page);
    expect(iapState.isAdsRemoved).toBe(true);
  });

  test('RemoveAds 구매 후 AdManager에 광고 제거가 반영된다', async ({ page }) => {
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    await purchasePromise;

    // getIAPState를 통해 isAdsRemoved 확인
    const iapState = await getIAPState(page);
    expect(iapState.isAdsRemoved).toBe(true);
  });

  test('RemoveAds는 비소비형이므로 중복 구매가 방지된다', async ({ page }) => {
    // 1차 구매 성공
    const firstPurchase = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    const firstResult = await firstPurchase;
    expect(firstResult.isSuccess).toBe(true);

    // 2차 구매 시도 - 이미 구매된 비소비형이므로 실패하거나 무시되어야 한다
    const secondPurchase = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    const secondResult = await secondPurchase;

    // 중복 구매는 실패로 처리되어야 한다
    expect(secondResult.isSuccess).toBe(false);

    // 비소비형 목록에 여전히 1건만 존재
    const iapState = await getIAPState(page);
    const removeAdsCount = iapState.purchasedNonConsumables.filter(
      (id) => id === 'RemoveAds',
    ).length;
    expect(removeAdsCount).toBe(1);
  });

  test('RemoveAds 복원 후에도 AdManager 연동이 정상 동작한다', async ({ page }) => {
    // 구매가 아닌 복원을 통해 RemoveAds 적용
    const restorePromise = waitForIAPEvent(page, 'restoreComplete', 15_000);
    await simulateRestorePurchases(page, ['RemoveAds']);
    await restorePromise;

    const iapState = await getIAPState(page);
    expect(iapState.isAdsRemoved).toBe(true);
    expect(iapState.purchasedNonConsumables).toContain('RemoveAds');
  });
});

test.describe('IAP 시스템 - 구매 이력 영속성', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await resetAllPurchases(page);
    await setMockPurchaseResult(page, 'success');
  });

  test('RemoveAds 구매 후 페이지 새로고침해도 구매 상태가 유지된다', async ({ page }) => {
    // 구매 실행
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    await purchasePromise;

    // 구매 확인
    const stateBefore = await getIAPState(page);
    expect(stateBefore.isAdsRemoved).toBe(true);
    expect(stateBefore.purchasedNonConsumables).toContain('RemoveAds');

    // 페이지 새로고침
    await page.reload();
    await bridge.waitForUnityLoad();

    // 새로고침 후에도 구매 상태 유지 확인
    const stateAfter = await getIAPState(page);
    expect(stateAfter.isAdsRemoved).toBe(true);
    expect(stateAfter.purchasedNonConsumables).toContain('RemoveAds');
  });

  test('소비형 상품 구매 이력은 영속적으로 기록된다', async ({ page }) => {
    // GemPack_Small 2회 구매
    const first = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    await first;

    const second = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    await second;

    // PlayerPrefs.Save() → IndexedDB 비동기 쓰기 완료 대기
    await page.waitForTimeout(2000);

    // 페이지 새로고침
    await page.reload();
    await bridge.waitForUnityLoad();

    // IAPManager 초기화 완료 대기
    let iapState = await getIAPState(page);
    const deadline = Date.now() + 15_000;
    while (!iapState.isInitialized && Date.now() < deadline) {
      await page.waitForTimeout(500);
      iapState = await getIAPState(page);
    }

    // 구매 이력이 유지되는지 확인 (lastPurchaseResult은 마지막 건만 보관)
    expect(iapState.lastPurchaseResult).not.toBeNull();
    expect(iapState.lastPurchaseResult!.productId).toBe('GemPack_Small');
  });

  test('ResetAllPurchases 호출 시 모든 구매 기록이 초기화된다', async ({ page }) => {
    // 구매 실행
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    await purchasePromise;

    // 구매 확인
    const stateWithPurchase = await getIAPState(page);
    expect(stateWithPurchase.purchasedNonConsumables).toContain('RemoveAds');
    expect(stateWithPurchase.isAdsRemoved).toBe(true);

    // 초기화
    await resetAllPurchases(page);

    // 초기화 후 확인
    const stateAfterReset = await getIAPState(page);
    expect(stateAfterReset.purchasedNonConsumables).toHaveLength(0);
    expect(stateAfterReset.isAdsRemoved).toBe(false);
  });

  test('ResetAllPurchases 후 RemoveAds를 다시 구매할 수 있다', async ({ page }) => {
    // 1차 구매
    const firstPurchase = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    await firstPurchase;

    // 초기화
    await resetAllPurchases(page);

    // 2차 구매 (초기화 후이므로 가능해야 한다)
    const secondPurchase = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    const result = await secondPurchase;

    expect(result.isSuccess).toBe(true);
    expect(result.productId).toBe('RemoveAds');

    const iapState = await getIAPState(page);
    expect(iapState.purchasedNonConsumables).toContain('RemoveAds');
    expect(iapState.isAdsRemoved).toBe(true);
  });
});

test.describe('IAP 시스템 - ShopScreen UI 통합', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
    await bridge.loadAndStartGame();
    await resetAllPurchases(page);
    await setMockPurchaseResult(page, 'success');
  });

  test('ShopScreen을 열고 닫을 수 있다', async ({ page }) => {
    // 상점 열기
    await openShopScreen(page);

    // 상점이 열렸는지 unity-message 이벤트 또는 상태로 확인
    // ShopScreen이 열린 상태에서 IAP 상태 조회가 가능해야 한다
    const iapState = await getIAPState(page);
    expect(iapState.isInitialized).toBe(true);

    // 상점 닫기
    await closeShopScreen(page);
  });

  test('ShopScreen에서 상품 구매 후 결과가 게임 상태에 반영된다', async ({ page }) => {
    await openShopScreen(page);

    // 상점 내에서 RemoveAds 구매
    const purchasePromise = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'RemoveAds');
    const result = await purchasePromise;
    expect(result.isSuccess).toBe(true);

    await closeShopScreen(page);

    // 게임 상태에 반영 확인
    const iapState = await getIAPState(page);
    expect(iapState.isAdsRemoved).toBe(true);
  });

  test('ShopScreen에서 소비형 상품 연속 구매가 가능하다', async ({ page }) => {
    await openShopScreen(page);

    // GemPack_Small 연속 구매
    const first = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'GemPack_Small');
    expect((await first).isSuccess).toBe(true);

    const second = waitForIAPEvent(page, 'purchaseComplete', 15_000);
    await purchaseProduct(page, 'UndoPack');
    expect((await second).isSuccess).toBe(true);

    await closeShopScreen(page);
  });
});
