# 08. 인앱 결제(IAP) 시스템 상세 개발 계획서

> **프로젝트**: Hexa Merge Basic
> **기반 설계문서**: `docs/design/03_monetization-platform-design.md` - 섹션 2, 7
> **플랫폼**: Android (Google Play Billing 7.x) + WebGL (Stripe Checkout)
> **엔진**: Unity 6 LTS (C# / .NET Standard 2.1 / IL2CPP)
> **작성일**: 2026-02-13
> **문서 버전**: 1.0

---

## 목차

1. [아키텍처 총괄](#1-아키텍처-총괄)
2. [상품 관리 시스템](#2-상품-관리-시스템)
3. [Google Play Billing 연동](#3-google-play-billing-연동)
4. [웹 결제 Stripe 연동](#4-웹-결제-stripe-연동)
5. [영수증 서버 검증](#5-영수증-서버-검증)
6. [구매 복원](#6-구매-복원)
7. [환불 RTDN 처리](#7-환불-rtdn-처리)
8. [테스트 계획](#8-테스트-계획)
9. [구현 우선순위 및 일정](#9-구현-우선순위-및-일정)

---

## 1. 아키텍처 총괄

### 1.1 클래스 다이어그램 개요

```
IIAPService (인터페이스)
├── Initialize()
├── Purchase(productId)
├── RestorePurchases()
├── GetProductInfo(productId) : ProductInfo
└── IsInitialized() : bool

구현체:
├── GooglePlayIAPService   (Android용)
├── StripeIAPService       (WebGL용)
└── EditorIAPService       (에디터 테스트용)

IAPManager (싱글톤 - 통합 관리)
├── IIAPService _service
├── IReceiptValidator _receiptValidator
├── ProductCatalog _catalog
├── PurchaseHistory _history
└── event OnPurchaseComplete

ProductCatalog (상품 카탈로그)
├── List<ProductDefinition> Products
├── GetProduct(productId) : ProductDefinition
└── GetProductsByType(type) : List<ProductDefinition>

ReceiptValidator (영수증 검증)
├── ValidateGoogleReceipt(token) : Task<ValidationResult>
├── ValidateStripePayment(sessionId) : Task<ValidationResult>
└── CheckDuplicate(orderId) : bool

PurchaseRestorer (구매 복원)
├── RestoreAll() : Task<List<RestoredPurchase>>
└── RestoreNonConsumables() : Task<List<RestoredPurchase>>

RefundHandler (환불 처리 - 서버)
├── HandleRTDN(notification) : Task
├── RevokeEntitlement(userId, productId) : Task
└── DeductCurrency(userId, amount) : Task
```

### 1.2 디렉토리 구조

```
Assets/
├── Scripts/
│   └── IAP/
│       ├── Core/
│       │   ├── IIAPService.cs
│       │   ├── IAPManager.cs
│       │   ├── IAPInitializer.cs
│       │   └── IAPEventBus.cs
│       ├── Products/
│       │   ├── ProductDefinition.cs
│       │   ├── ProductCatalog.cs
│       │   ├── ProductType.cs
│       │   └── ProductCatalogSO.cs        (ScriptableObject)
│       ├── Platform/
│       │   ├── GooglePlay/
│       │   │   ├── GooglePlayIAPService.cs
│       │   │   └── GooglePlayBillingWrapper.cs
│       │   ├── Stripe/
│       │   │   ├── StripeIAPService.cs
│       │   │   └── StripeJSBridge.cs
│       │   └── Editor/
│       │       └── EditorIAPService.cs
│       ├── Validation/
│       │   ├── IReceiptValidator.cs
│       │   ├── ServerReceiptValidator.cs
│       │   └── ValidationResult.cs
│       ├── Restore/
│       │   ├── PurchaseRestorer.cs
│       │   └── RestoredPurchase.cs
│       ├── Refund/
│       │   └── RefundHandler.cs           (서버 사이드)
│       └── UI/
│           ├── ShopUI.cs
│           ├── ShopItemView.cs
│           ├── PurchaseConfirmPopup.cs
│           └── PurchaseResultPopup.cs
├── Plugins/
│   ├── Android/
│   │   └── billing-7.x.aar
│   └── WebGL/
│       └── StripePlugin.jslib
└── ScriptableObjects/
    └── IAP/
        └── ProductCatalog.asset
```

---

## 2. 상품 관리 시스템

### 2.1 상품 타입 열거형 정의

- [ ] **`ProductType` 열거형 구현**

  **구현 설명**: 소비형(Consumable), 비소비형(NonConsumable), 구독형(Subscription)을 구분하는 열거형. Google Play와 Stripe 양쪽 모두에서 상품 처리 분기의 기준이 된다.

  **필요한 클래스/메서드**:
  - `ProductType.cs` - 열거형 정의

  **코드 스니펫**:
  ```csharp
  namespace HexaMerge.IAP
  {
      /// <summary>
      /// 상품 유형 분류.
      /// Google Play: Consumable -> consume(), NonConsumable -> acknowledge()
      /// Stripe: 모두 one-time payment, 서버에서 유형별 처리 분기.
      /// </summary>
      public enum ProductType
      {
          /// <summary>소비형 - 코인 팩, 힌트 팩, 아이템 번들 등</summary>
          Consumable,

          /// <summary>비소비형 - 광고 제거, 테마, 프리미엄 패스 등</summary>
          NonConsumable,

          /// <summary>구독형 - VIP 월간 구독 (v2.0 예약)</summary>
          Subscription
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

### 2.2 상품 정의 데이터 클래스

- [ ] **`ProductDefinition` 데이터 클래스 구현**

  **구현 설명**: 개별 상품의 ID, 이름, 설명, 가격, 유형, 보상 내용을 보유하는 데이터 클래스. ScriptableObject 기반 카탈로그에서 직렬화되어 관리되며, 런타임에는 Google Play/Stripe에서 가져온 실시간 가격으로 덮어쓴다.

  **필요한 클래스/메서드**:
  - `ProductDefinition.cs` - 상품 정의 데이터
  - `ProductReward.cs` - 보상 내용 (코인 수량, 힌트 수량, 아이템 목록 등)

  **코드 스니펫**:
  ```csharp
  using System;
  using UnityEngine;

  namespace HexaMerge.IAP
  {
      [Serializable]
      public class ProductDefinition
      {
          [Header("기본 정보")]
          public string productId;          // "coin_pack_s", "remove_ads" 등
          public string displayName;        // "코인 소형 팩"
          public string description;        // "코인 500개"
          public ProductType productType;   // Consumable / NonConsumable

          [Header("가격 (기본값 - 런타임에 스토어 가격으로 대체)")]
          public decimal basePrice_KRW;
          public decimal basePrice_USD;

          [Header("보상 내용")]
          public ProductReward reward;

          [Header("구매 제한")]
          public int maxPurchaseCount;      // 0 = 무제한, 1 = 1회 한정 (스타터 팩)

          /// <summary>스토어에서 조회한 현지화 가격 문자열 (런타임 전용)</summary>
          [NonSerialized] public string localizedPriceString;
      }

      [Serializable]
      public class ProductReward
      {
          public int coins;
          public int hints;
          public int shuffleItems;
          public int bombItems;
          public int rainbowItems;
          public bool removeAds;
          public string[] unlockThemeIds;   // "theme_ocean" 등
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: `ProductType`

---

### 2.3 상품 카탈로그 ScriptableObject

- [ ] **`ProductCatalogSO` ScriptableObject 구현**

  **구현 설명**: Unity 에디터에서 상품 목록을 시각적으로 관리할 수 있는 ScriptableObject. 설계문서에 정의된 소비형 7종, 비소비형 6종 총 13종의 상품을 등록한다. 빌드 시 포함되어 오프라인에서도 기본 상품 정보를 표시할 수 있다.

  **필요한 클래스/메서드**:
  - `ProductCatalogSO.cs` - ScriptableObject 정의
  - `ProductCatalogSO.GetProduct(string productId)` - ID로 상품 조회
  - `ProductCatalogSO.GetProductsByType(ProductType type)` - 유형별 조회
  - `ProductCatalogSO.AllProductIds` - 전체 상품 ID 목록 프로퍼티

  **코드 스니펫**:
  ```csharp
  using System.Collections.Generic;
  using System.Linq;
  using UnityEngine;

  namespace HexaMerge.IAP
  {
      [CreateAssetMenu(
          fileName = "ProductCatalog",
          menuName = "HexaMerge/IAP/Product Catalog")]
      public class ProductCatalogSO : ScriptableObject
      {
          [SerializeField]
          private List<ProductDefinition> _products = new();

          private Dictionary<string, ProductDefinition> _lookup;

          public IReadOnlyList<ProductDefinition> Products => _products;

          public string[] AllProductIds =>
              _products.Select(p => p.productId).ToArray();

          public ProductDefinition GetProduct(string productId)
          {
              EnsureLookup();
              _lookup.TryGetValue(productId, out var product);
              return product;
          }

          public List<ProductDefinition> GetProductsByType(ProductType type)
          {
              return _products
                  .Where(p => p.productType == type)
                  .ToList();
          }

          private void EnsureLookup()
          {
              if (_lookup != null) return;
              _lookup = new Dictionary<string, ProductDefinition>();
              foreach (var p in _products)
              {
                  if (!string.IsNullOrEmpty(p.productId))
                      _lookup[p.productId] = p;
              }
          }

          private void OnEnable() => _lookup = null; // 리로드 시 캐시 초기화
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: `ProductDefinition`, `ProductType`

---

### 2.4 상품 등록 데이터

- [ ] **설계문서 기반 상품 13종 에셋 등록**

  **구현 설명**: `ProductCatalogSO` 에셋에 다음 상품들을 등록한다. 가격은 기본값으로 입력하되, 런타임에 Google Play `ProductDetails` 또는 Stripe 서버 가격으로 대체한다.

  | 상품 ID | 유형 | KRW | USD | 보상 |
  |---------|------|-----|-----|------|
  | `coin_pack_s` | Consumable | 1,200 | 0.99 | 코인 500 |
  | `coin_pack_m` | Consumable | 3,300 | 2.99 | 코인 1,500 |
  | `coin_pack_l` | Consumable | 6,600 | 5.99 | 코인 4,000 |
  | `coin_pack_xl` | Consumable | 12,000 | 9.99 | 코인 10,000 |
  | `item_hint_10` | Consumable | 1,200 | 0.99 | 힌트 10 |
  | `item_bundle` | Consumable | 2,500 | 1.99 | 셔플 3 + 폭탄 3 + 무지개 3 |
  | `starter_pack` | Consumable | 3,300 | 2.99 | 코인 2,000 + 힌트 10 + 번들 (1회 한정) |
  | `remove_ads` | NonConsumable | 4,400 | 3.99 | 광고 제거 + 코인 1,000 |
  | `theme_ocean` | NonConsumable | 2,500 | 1.99 | 오션 테마 언락 |
  | `theme_forest` | NonConsumable | 2,500 | 1.99 | 포레스트 테마 언락 |
  | `theme_space` | NonConsumable | 2,500 | 1.99 | 스페이스 테마 언락 |
  | `theme_bundle` | NonConsumable | 5,500 | 4.99 | 전체 테마 언락 |
  | `premium_pass` | NonConsumable | 12,000 | 9.99 | 광고 제거 + 전체 테마 + 코인 5,000 |

  **필요한 클래스/메서드**:
  - Unity Editor에서 `ProductCatalogSO` 에셋 생성 및 인스펙터에서 데이터 입력
  - Google Play Console에 동일 상품 ID로 등록

  **예상 난이도**: 하
  **의존성**: `ProductCatalogSO`

---

## 3. Google Play Billing 연동

### 3.1 IAP 서비스 인터페이스

- [ ] **`IIAPService` 인터페이스 정의**

  **구현 설명**: 플랫폼별 결제 서비스의 공통 인터페이스. Android(Google Play)와 WebGL(Stripe) 구현체가 이 인터페이스를 따른다. `IAPManager`는 이 인터페이스에만 의존하여 플랫폼 무관 로직을 구성한다.

  **필요한 클래스/메서드**:
  - `IIAPService.cs` - 인터페이스 정의
  - `PurchaseResult.cs` - 구매 결과 DTO
  - `PurchaseFailureReason.cs` - 실패 원인 열거형

  **코드 스니펫**:
  ```csharp
  using System;
  using System.Threading.Tasks;
  using System.Collections.Generic;

  namespace HexaMerge.IAP
  {
      public interface IIAPService
      {
          /// <summary>서비스 초기화 완료 여부</summary>
          bool IsInitialized { get; }

          /// <summary>결제 서비스 초기화</summary>
          Task<bool> Initialize(string[] productIds);

          /// <summary>상품 구매 시작</summary>
          Task<PurchaseResult> Purchase(string productId);

          /// <summary>비소비형 상품 구매 복원</summary>
          Task<List<RestoredPurchase>> RestorePurchases();

          /// <summary>현지화된 가격 문자열 조회</summary>
          string GetLocalizedPrice(string productId);

          /// <summary>상품 구매 가능 여부</summary>
          bool IsProductAvailable(string productId);

          /// <summary>구매 완료 이벤트</summary>
          event Action<PurchaseResult> OnPurchaseCompleted;

          /// <summary>구매 실패 이벤트</summary>
          event Action<string, PurchaseFailureReason> OnPurchaseFailed;
      }

      public class PurchaseResult
      {
          public string ProductId;
          public string TransactionId;    // orderId (Google) / paymentIntentId (Stripe)
          public string Receipt;          // purchaseToken (Google) / session_id (Stripe)
          public bool IsSuccess;
          public PurchaseFailureReason FailureReason;
      }

      public enum PurchaseFailureReason
      {
          None,
          UserCancelled,
          NetworkError,
          ProductUnavailable,
          PaymentDeclined,
          DuplicateTransaction,
          ServerValidationFailed,
          Unknown
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: `ProductDefinition`, `RestoredPurchase`

---

### 3.2 Google Play IAP 서비스 구현

- [ ] **`GooglePlayIAPService` 클래스 구현**

  **구현 설명**: Google Play Billing Library 7.x를 Unity 네이티브 플러그인(AAR)을 통해 호출하는 Android 전용 결제 서비스. `BillingClient` 생명주기 관리, `launchBillingFlow`, 소비형 `consume`/비소비형 `acknowledge` 처리를 포함한다. 연결 끊김 시 지수 백오프(최대 5회) 재연결을 수행한다.

  **필요한 클래스/메서드**:
  - `GooglePlayIAPService.cs` - 메인 서비스 클래스
    - `Initialize(string[] productIds)` - BillingClient 연결 + 상품 조회
    - `Purchase(string productId)` - `launchBillingFlow()` 호출
    - `RestorePurchases()` - `queryPurchasesAsync()` 호출
    - `HandlePurchaseUpdated(purchase)` - 구매 콜백 처리
    - `ConsumePurchase(purchaseToken)` - 소비형 처리
    - `AcknowledgePurchase(purchaseToken)` - 비소비형 처리
    - `RetryConnection(attempt)` - 지수 백오프 재연결
  - `GooglePlayBillingWrapper.cs` - Java 네이티브 메서드 호출 래퍼

  **코드 스니펫**:
  ```csharp
  using System;
  using System.Collections.Generic;
  using System.Threading.Tasks;
  using UnityEngine;

  namespace HexaMerge.IAP.Platform
  {
      /// <summary>
      /// Google Play Billing Library 7.x 연동 서비스.
      /// Android 플랫폼 전용. #if UNITY_ANDROID 컴파일 가드 사용.
      /// </summary>
      public class GooglePlayIAPService : IIAPService
      {
          public bool IsInitialized { get; private set; }

          public event Action<PurchaseResult> OnPurchaseCompleted;
          public event Action<string, PurchaseFailureReason> OnPurchaseFailed;

          private AndroidJavaObject _billingClient;
          private Dictionary<string, AndroidJavaObject> _productDetailsMap = new();
          private TaskCompletionSource<PurchaseResult> _pendingPurchaseTcs;

          private const int MAX_RETRY = 5;
          private int _retryCount;

          // --- 초기화 ---

          public async Task<bool> Initialize(string[] productIds)
          {
  #if UNITY_ANDROID && !UNITY_EDITOR
              try
              {
                  _billingClient = CreateBillingClient();
                  bool connected = await StartConnection();
                  if (!connected) return false;

                  await QueryProductDetails(productIds);
                  await ProcessPendingPurchases();

                  IsInitialized = true;
                  Debug.Log("[IAP] GooglePlay 초기화 완료");
                  return true;
              }
              catch (Exception ex)
              {
                  Debug.LogError($"[IAP] GooglePlay 초기화 실패: {ex.Message}");
                  return false;
              }
  #else
              return false;
  #endif
          }

          // --- 구매 ---

          public async Task<PurchaseResult> Purchase(string productId)
          {
  #if UNITY_ANDROID && !UNITY_EDITOR
              if (!_productDetailsMap.TryGetValue(productId, out var details))
              {
                  OnPurchaseFailed?.Invoke(productId,
                      PurchaseFailureReason.ProductUnavailable);
                  return new PurchaseResult
                  {
                      ProductId = productId,
                      IsSuccess = false,
                      FailureReason = PurchaseFailureReason.ProductUnavailable
                  };
              }

              _pendingPurchaseTcs = new TaskCompletionSource<PurchaseResult>();
              LaunchBillingFlow(details);
              return await _pendingPurchaseTcs.Task;
  #else
              return new PurchaseResult { IsSuccess = false };
  #endif
          }

          // --- 콜백 (Java -> C#) ---

          /// <summary>
          /// BillingClient.onPurchasesUpdated 콜백에서 호출됨.
          /// UnitySendMessage 경유.
          /// </summary>
          public void OnPurchaseUpdated(string purchaseJson)
          {
              // JSON 파싱 -> purchaseToken, orderId, productId 추출
              var data = JsonUtility.FromJson<GooglePurchaseData>(purchaseJson);

              if (data.purchaseState == 0) // PURCHASED
              {
                  // 서버 검증 후 consume/acknowledge
                  _ = ValidateAndFinalize(data);
              }
              else if (data.purchaseState == 2) // PENDING
              {
                  Debug.Log("[IAP] 결제 보류 중 (pending)");
              }
          }

          private async Task ValidateAndFinalize(GooglePurchaseData data)
          {
              // 1. 서버 영수증 검증
              var validation = await IAPManager.Instance.ReceiptValidator
                  .ValidateGoogleReceipt(data.purchaseToken, data.productId);

              if (!validation.IsValid)
              {
                  _pendingPurchaseTcs?.TrySetResult(new PurchaseResult
                  {
                      ProductId = data.productId,
                      IsSuccess = false,
                      FailureReason = PurchaseFailureReason.ServerValidationFailed
                  });
                  return;
              }

              // 2. 상품 유형에 따라 consume / acknowledge
              var productDef = IAPManager.Instance.Catalog.GetProduct(data.productId);
              if (productDef.productType == ProductType.Consumable)
                  await ConsumePurchase(data.purchaseToken);
              else
                  await AcknowledgePurchase(data.purchaseToken);

              // 3. 결과 반환
              var result = new PurchaseResult
              {
                  ProductId = data.productId,
                  TransactionId = data.orderId,
                  Receipt = data.purchaseToken,
                  IsSuccess = true
              };

              OnPurchaseCompleted?.Invoke(result);
              _pendingPurchaseTcs?.TrySetResult(result);
          }

          // --- 재연결 (지수 백오프) ---

          private async Task<bool> RetryConnection()
          {
              for (_retryCount = 0; _retryCount < MAX_RETRY; _retryCount++)
              {
                  int delayMs = (int)(Math.Pow(2, _retryCount) * 1000); // 1s, 2s, 4s, 8s, 16s
                  Debug.Log($"[IAP] 재연결 시도 {_retryCount + 1}/{MAX_RETRY} " +
                            $"({delayMs}ms 후)");
                  await Task.Delay(delayMs);

                  bool connected = await StartConnection();
                  if (connected)
                  {
                      _retryCount = 0;
                      return true;
                  }
              }

              Debug.LogError("[IAP] BillingClient 재연결 모든 시도 실패. 상점 비활성화.");
              return false;
          }

          // --- 헬퍼 (네이티브 호출 래퍼) ---

          private AndroidJavaObject CreateBillingClient() { /* ... */ return null; }
          private Task<bool> StartConnection() { /* ... */ return Task.FromResult(false); }
          private Task QueryProductDetails(string[] ids) { /* ... */ return Task.CompletedTask; }
          private Task ProcessPendingPurchases() { /* ... */ return Task.CompletedTask; }
          private void LaunchBillingFlow(AndroidJavaObject details) { /* ... */ }
          private Task ConsumePurchase(string token) { /* ... */ return Task.CompletedTask; }
          private Task AcknowledgePurchase(string token) { /* ... */ return Task.CompletedTask; }

          // --- 가격/상태 조회 ---

          public string GetLocalizedPrice(string productId)
          {
              // ProductDetails.getOneTimePurchaseOfferDetails().getFormattedPrice()
              return _productDetailsMap.ContainsKey(productId) ? "가격 조회" : "---";
          }

          public bool IsProductAvailable(string productId)
              => IsInitialized && _productDetailsMap.ContainsKey(productId);

          public Task<List<RestoredPurchase>> RestorePurchases()
          {
              // 섹션 6에서 상세 구현
              return Task.FromResult(new List<RestoredPurchase>());
          }

          [Serializable]
          private class GooglePurchaseData
          {
              public string productId;
              public string orderId;
              public string purchaseToken;
              public int purchaseState;     // 0=PURCHASED, 1=CANCELED, 2=PENDING
          }
      }
  }
  ```

  **예상 난이도**: 상
  **의존성**: `IIAPService`, `IAPManager`, `ProductCatalogSO`, `ServerReceiptValidator`

---

### 3.3 BillingClient 네이티브 래퍼

- [ ] **`GooglePlayBillingWrapper` 네이티브 호출 래퍼 구현**

  **구현 설명**: Unity의 `AndroidJavaObject`/`AndroidJavaProxy`를 사용하여 Google Play Billing Library 7.x의 Java 메서드를 C#에서 호출하는 래퍼. `BillingClientStateListener`, `PurchasesUpdatedListener`, `ProductDetailsResponseListener` 등의 Java 콜백 인터페이스를 `AndroidJavaProxy`로 구현한다.

  **필요한 클래스/메서드**:
  - `GooglePlayBillingWrapper.cs`
    - `NewBillingClient(Activity activity)` - BillingClient 빌더 호출
    - `StartConnection(BillingClientStateListener listener)` - 연결 시작
    - `QueryProductDetailsAsync(params)` - 상품 정보 조회
    - `LaunchBillingFlow(Activity, BillingFlowParams)` - 결제 UI 실행
    - `ConsumeAsync(ConsumeParams)` - 소비형 처리
    - `AcknowledgePurchase(AcknowledgePurchaseParams)` - 비소비형 확인
    - `QueryPurchasesAsync(QueryPurchasesParams)` - 기존 구매 조회
  - `BillingClientStateProxy.cs` - `AndroidJavaProxy` 콜백
  - `PurchasesUpdatedProxy.cs` - `AndroidJavaProxy` 콜백

  **코드 스니펫**:
  ```csharp
  using UnityEngine;

  namespace HexaMerge.IAP.Platform
  {
      /// <summary>
      /// BillingClientStateListener 를 Java 콜백으로 수신하는 프록시.
      /// AndroidJavaProxy를 통해 Java 인터페이스 구현.
      /// </summary>
      public class BillingClientStateProxy : AndroidJavaProxy
      {
          private readonly System.Action _onConnected;
          private readonly System.Action<int> _onDisconnected;

          public BillingClientStateProxy(
              System.Action onConnected,
              System.Action<int> onDisconnected)
              : base("com.android.billingclient.api.BillingClientStateListener")
          {
              _onConnected = onConnected;
              _onDisconnected = onDisconnected;
          }

          // Java에서 호출됨
          void onBillingSetupFinished(AndroidJavaObject billingResult)
          {
              int responseCode = billingResult.Call<int>("getResponseCode");
              if (responseCode == 0) // BillingResponseCode.OK
              {
                  UnityMainThread.Post(() => _onConnected?.Invoke());
              }
          }

          void onBillingServiceDisconnected()
          {
              UnityMainThread.Post(() => _onDisconnected?.Invoke(-1));
          }
      }

      /// <summary>
      /// PurchasesUpdatedListener 를 Java 콜백으로 수신하는 프록시.
      /// </summary>
      public class PurchasesUpdatedProxy : AndroidJavaProxy
      {
          private readonly System.Action<int, AndroidJavaObject> _onUpdated;

          public PurchasesUpdatedProxy(
              System.Action<int, AndroidJavaObject> onUpdated)
              : base("com.android.billingclient.api.PurchasesUpdatedListener")
          {
              _onUpdated = onUpdated;
          }

          void onPurchasesUpdated(
              AndroidJavaObject billingResult,
              AndroidJavaObject purchasesList)
          {
              int code = billingResult.Call<int>("getResponseCode");
              UnityMainThread.Post(() => _onUpdated?.Invoke(code, purchasesList));
          }
      }
  }
  ```

  **예상 난이도**: 상
  **의존성**: `GooglePlayIAPService`, Google Play Billing AAR 플러그인

---

### 3.4 IAPManager 통합 관리자

- [ ] **`IAPManager` 싱글톤 클래스 구현**

  **구현 설명**: 플랫폼별 `IIAPService` 구현체를 자동 선택하고 상품 카탈로그, 영수증 검증, 보상 지급을 통합 관리하는 싱글톤. 게임 시작 시 초기화되며, 상점 UI와 게임 로직 사이의 중재자 역할을 한다. 구매 성공 시 `ProductReward`에 따라 `CurrencyManager`, `InventoryManager`, `SettingsManager`에 보상을 분배한다.

  **필요한 클래스/메서드**:
  - `IAPManager.cs`
    - `Instance` - 싱글톤 접근자
    - `Initialize()` - 플랫폼 감지 및 서비스 초기화
    - `PurchaseProduct(string productId)` - 구매 요청 (UI에서 호출)
    - `OnPurchaseSuccess(PurchaseResult result)` - 보상 지급 로직
    - `GrantReward(ProductDefinition product)` - 보상 분배
    - `IsStarterPackAvailable()` - 스타터 팩 1회 제한 확인
    - `ProductCatalog Catalog` - 카탈로그 프로퍼티
    - `IReceiptValidator ReceiptValidator` - 검증기 프로퍼티

  **코드 스니펫**:
  ```csharp
  using System;
  using System.Threading.Tasks;
  using UnityEngine;

  namespace HexaMerge.IAP
  {
      public class IAPManager : MonoBehaviour
      {
          public static IAPManager Instance { get; private set; }

          [SerializeField] private ProductCatalogSO _catalogAsset;

          public ProductCatalogSO Catalog => _catalogAsset;
          public IReceiptValidator ReceiptValidator { get; private set; }

          private IIAPService _service;

          public event Action<string, ProductReward> OnRewardGranted;
          public event Action<string, PurchaseFailureReason> OnPurchaseError;

          private void Awake()
          {
              if (Instance != null) { Destroy(gameObject); return; }
              Instance = this;
              DontDestroyOnLoad(gameObject);
          }

          public async Task Initialize()
          {
              // 플랫폼별 서비스 선택
  #if UNITY_ANDROID && !UNITY_EDITOR
              _service = new Platform.GooglePlayIAPService();
  #elif UNITY_WEBGL && !UNITY_EDITOR
              _service = new Platform.StripeIAPService();
  #else
              _service = new Platform.EditorIAPService();
  #endif
              ReceiptValidator = new ServerReceiptValidator();

              _service.OnPurchaseCompleted += OnPurchaseSuccess;
              _service.OnPurchaseFailed += (id, reason) =>
                  OnPurchaseError?.Invoke(id, reason);

              string[] productIds = _catalogAsset.AllProductIds;
              bool ok = await _service.Initialize(productIds);
              Debug.Log($"[IAPManager] 초기화 {(ok ? "성공" : "실패")}");
          }

          /// <summary>상점 UI에서 호출. 구매 플로우 시작.</summary>
          public async Task PurchaseProduct(string productId)
          {
              var product = _catalogAsset.GetProduct(productId);
              if (product == null)
              {
                  Debug.LogError($"[IAPManager] 알 수 없는 상품: {productId}");
                  return;
              }

              // 스타터 팩 1회 제한 확인
              if (product.maxPurchaseCount > 0)
              {
                  int purchased = GetPurchaseCount(productId);
                  if (purchased >= product.maxPurchaseCount)
                  {
                      OnPurchaseError?.Invoke(productId,
                          PurchaseFailureReason.DuplicateTransaction);
                      return;
                  }
              }

              await _service.Purchase(productId);
          }

          private void OnPurchaseSuccess(PurchaseResult result)
          {
              var product = _catalogAsset.GetProduct(result.ProductId);
              if (product == null) return;

              GrantReward(product);
              IncrementPurchaseCount(result.ProductId);
              SavePurchaseRecord(result);

              OnRewardGranted?.Invoke(result.ProductId, product.reward);
              Debug.Log($"[IAPManager] 보상 지급 완료: {result.ProductId}");
          }

          private void GrantReward(ProductDefinition product)
          {
              var r = product.reward;

              if (r.coins > 0)
                  CurrencyManager.Instance.AddCoins(r.coins);
              if (r.hints > 0)
                  InventoryManager.Instance.AddHints(r.hints);
              if (r.shuffleItems > 0)
                  InventoryManager.Instance.AddItem("shuffle", r.shuffleItems);
              if (r.bombItems > 0)
                  InventoryManager.Instance.AddItem("bomb", r.bombItems);
              if (r.rainbowItems > 0)
                  InventoryManager.Instance.AddItem("rainbow", r.rainbowItems);
              if (r.removeAds)
                  SettingsManager.Instance.SetAdsRemoved(true);
              if (r.unlockThemeIds is { Length: > 0 })
              {
                  foreach (var themeId in r.unlockThemeIds)
                      ThemeManager.Instance.UnlockTheme(themeId);
              }
          }

          public string GetLocalizedPrice(string productId)
              => _service?.GetLocalizedPrice(productId) ?? "---";

          public bool IsProductAvailable(string productId)
              => _service?.IsProductAvailable(productId) ?? false;

          private int GetPurchaseCount(string productId)
              => PlayerPrefs.GetInt($"iap_count_{productId}", 0);

          private void IncrementPurchaseCount(string productId)
              => PlayerPrefs.SetInt($"iap_count_{productId}",
                  GetPurchaseCount(productId) + 1);

          private void SavePurchaseRecord(PurchaseResult result)
          {
              // 로컬 구매 이력 저장 (암호화 파일)
              // PurchaseHistory에 추가 후 직렬화
          }
      }
  }
  ```

  **예상 난이도**: 상
  **의존성**: `IIAPService`, `ProductCatalogSO`, `ServerReceiptValidator`, `CurrencyManager`, `InventoryManager`, `SettingsManager`, `ThemeManager`

---

## 4. 웹 결제 Stripe 연동

### 4.1 Stripe IAP 서비스 (클라이언트)

- [ ] **`StripeIAPService` 클래스 구현**

  **구현 설명**: WebGL 빌드에서 Stripe Checkout을 통해 결제를 처리하는 서비스. Unity C#에서 `.jslib` 플러그인을 통해 JavaScript `Stripe.js`를 호출한다. 결제 요청 시 서버에 Checkout Session 생성을 요청하고, Stripe 호스팅 결제 페이지로 리다이렉트한다. 결제 성공 후 리다이렉트 URL로 돌아오면 서버 Webhook 결과를 Polling으로 확인한다.

  **필요한 클래스/메서드**:
  - `StripeIAPService.cs`
    - `Initialize(string[] productIds)` - 서버에서 상품 가격 정보 조회
    - `Purchase(string productId)` - Checkout Session 생성 요청 + 리다이렉트
    - `PollPaymentResult(string sessionId)` - 결제 결과 폴링
    - `RestorePurchases()` - 서버에서 구매 이력 조회
  - `StripeJSBridge.cs` - `.jslib`와 C# 브릿지

  **코드 스니펫**:
  ```csharp
  using System;
  using System.Collections.Generic;
  using System.Runtime.InteropServices;
  using System.Threading.Tasks;
  using UnityEngine;

  namespace HexaMerge.IAP.Platform
  {
      /// <summary>
      /// WebGL Stripe Checkout 결제 서비스.
      /// .jslib 플러그인을 통해 Stripe.js와 통신.
      /// </summary>
      public class StripeIAPService : IIAPService
      {
          public bool IsInitialized { get; private set; }

          public event Action<PurchaseResult> OnPurchaseCompleted;
          public event Action<string, PurchaseFailureReason> OnPurchaseFailed;

          // 서버에서 조회한 가격 정보 캐시
          private Dictionary<string, StripeProductInfo> _productInfoMap = new();

          private const string API_BASE = "https://api.hexamerge.example.com";
          private const int POLL_INTERVAL_MS = 2000;
          private const int POLL_MAX_ATTEMPTS = 30; // 최대 60초

  #if UNITY_WEBGL && !UNITY_EDITOR
          [DllImport("__Internal")]
          private static extern void StripeRedirectToCheckout(string sessionId);

          [DllImport("__Internal")]
          private static extern string StripeGetReturnSessionId();
  #endif

          public async Task<bool> Initialize(string[] productIds)
          {
              try
              {
                  // 서버에서 상품 가격 정보 조회
                  string url = $"{API_BASE}/api/products";
                  string json = await WebRequestHelper.Get(url);
                  var products = JsonUtility.FromJson<StripeProductList>(json);

                  foreach (var p in products.items)
                      _productInfoMap[p.productId] = p;

                  // 리다이렉트 복귀 확인 (결제 완료 후 돌아온 경우)
                  await CheckReturnFromCheckout();

                  IsInitialized = true;
                  return true;
              }
              catch (Exception ex)
              {
                  Debug.LogError($"[IAP] Stripe 초기화 실패: {ex.Message}");
                  return false;
              }
          }

          public async Task<PurchaseResult> Purchase(string productId)
          {
              try
              {
                  // 1. 서버에 Checkout Session 생성 요청
                  string url = $"{API_BASE}/api/checkout";
                  string body = JsonUtility.ToJson(new CheckoutRequest
                  {
                      productId = productId,
                      userId = AuthManager.Instance.UserId
                  });
                  string response = await WebRequestHelper.Post(url, body);
                  var session = JsonUtility.FromJson<CheckoutResponse>(response);

                  // 2. Stripe Checkout 페이지로 리다이렉트
  #if UNITY_WEBGL && !UNITY_EDITOR
                  StripeRedirectToCheckout(session.sessionId);
  #endif
                  // 리다이렉트 후에는 이 코드에 도달하지 않음.
                  // 결제 결과는 리다이렉트 복귀 시 CheckReturnFromCheckout()에서 처리.
                  return new PurchaseResult { ProductId = productId, IsSuccess = false };
              }
              catch (Exception ex)
              {
                  var result = new PurchaseResult
                  {
                      ProductId = productId,
                      IsSuccess = false,
                      FailureReason = PurchaseFailureReason.NetworkError
                  };
                  OnPurchaseFailed?.Invoke(productId, PurchaseFailureReason.NetworkError);
                  Debug.LogError($"[IAP] Stripe 구매 요청 실패: {ex.Message}");
                  return result;
              }
          }

          /// <summary>
          /// Stripe Checkout에서 리다이렉트 복귀 시 결제 결과 확인.
          /// URL 파라미터에서 session_id를 추출하여 서버에 결과 폴링.
          /// </summary>
          private async Task CheckReturnFromCheckout()
          {
  #if UNITY_WEBGL && !UNITY_EDITOR
              string sessionId = StripeGetReturnSessionId();
              if (string.IsNullOrEmpty(sessionId)) return;

              // 서버에서 결제 완료 상태 폴링
              for (int i = 0; i < POLL_MAX_ATTEMPTS; i++)
              {
                  string url = $"{API_BASE}/api/checkout/status?sessionId={sessionId}";
                  string json = await WebRequestHelper.Get(url);
                  var status = JsonUtility.FromJson<PaymentStatus>(json);

                  if (status.state == "completed")
                  {
                      var result = new PurchaseResult
                      {
                          ProductId = status.productId,
                          TransactionId = status.paymentIntentId,
                          Receipt = sessionId,
                          IsSuccess = true
                      };
                      OnPurchaseCompleted?.Invoke(result);
                      return;
                  }

                  if (status.state == "failed" || status.state == "expired")
                  {
                      OnPurchaseFailed?.Invoke(status.productId,
                          PurchaseFailureReason.PaymentDeclined);
                      return;
                  }

                  await Task.Delay(POLL_INTERVAL_MS);
              }

              Debug.LogWarning("[IAP] Stripe 결제 상태 확인 타임아웃");
  #endif
          }

          public string GetLocalizedPrice(string productId)
          {
              if (_productInfoMap.TryGetValue(productId, out var info))
                  return info.formattedPrice;
              return "---";
          }

          public bool IsProductAvailable(string productId)
              => IsInitialized && _productInfoMap.ContainsKey(productId);

          public Task<List<RestoredPurchase>> RestorePurchases()
          {
              // 섹션 6에서 상세 구현
              return Task.FromResult(new List<RestoredPurchase>());
          }

          // --- DTO ---

          [Serializable]
          private class CheckoutRequest
          {
              public string productId;
              public string userId;
          }

          [Serializable]
          private class CheckoutResponse
          {
              public string sessionId;
          }

          [Serializable]
          private class PaymentStatus
          {
              public string state;          // "pending", "completed", "failed", "expired"
              public string productId;
              public string paymentIntentId;
          }

          [Serializable]
          private class StripeProductInfo
          {
              public string productId;
              public string formattedPrice;
              public int priceInCents;
          }

          [Serializable]
          private class StripeProductList
          {
              public StripeProductInfo[] items;
          }
      }
  }
  ```

  **예상 난이도**: 상
  **의존성**: `IIAPService`, `StripeJSBridge(.jslib)`, 서버 API (`/api/checkout`, `/api/checkout/status`, `/api/products`)

---

### 4.2 Stripe JavaScript 브릿지

- [ ] **`StripePlugin.jslib` WebGL 플러그인 구현**

  **구현 설명**: Unity WebGL에서 브라우저의 `Stripe.js`를 호출하기 위한 JavaScript 플러그인. `mergeInto(LibraryManager.library, {...})` 패턴으로 작성하며, Checkout Session ID를 받아 Stripe 결제 페이지로 리다이렉트한다. 결제 후 리다이렉트로 돌아왔을 때 URL 파라미터에서 `session_id`를 추출하는 함수도 포함한다.

  **필요한 클래스/메서드**:
  - `StripePlugin.jslib`
    - `StripeRedirectToCheckout(sessionId)` - Stripe 결제 페이지 리다이렉트
    - `StripeGetReturnSessionId()` - URL에서 session_id 파라미터 추출

  **코드 스니펫**:
  ```javascript
  // Assets/Plugins/WebGL/StripePlugin.jslib
  mergeInto(LibraryManager.library, {

      StripeRedirectToCheckout: function(sessionIdPtr) {
          var sessionId = UTF8ToString(sessionIdPtr);
          var stripe = Stripe('pk_live_XXXXXXXXXXXXXXXX'); // 공개 키
          stripe.redirectToCheckout({ sessionId: sessionId })
              .then(function(result) {
                  if (result.error) {
                      console.error('[Stripe] Redirect error:', result.error.message);
                  }
              });
      },

      StripeGetReturnSessionId: function() {
          var params = new URLSearchParams(window.location.search);
          var sessionId = params.get('session_id') || '';
          var bufferSize = lengthBytesUTF8(sessionId) + 1;
          var buffer = _malloc(bufferSize);
          stringToUTF8(sessionId, buffer, bufferSize);
          return buffer;
      }
  });
  ```

  **예상 난이도**: 중
  **의존성**: Stripe.js CDN (`<script src="https://js.stripe.com/v3/">` - index.html에 추가 필요)

---

### 4.3 Stripe 서버 API (Node.js)

- [ ] **Stripe Checkout 백엔드 API 구현**

  **구현 설명**: Stripe Checkout Session을 생성하고, Webhook으로 결제 완료를 수신하며, 클라이언트 폴링 요청에 결제 상태를 반환하는 서버 API. Firebase Functions 또는 Express 서버로 구현한다. 상품 가격은 서버에서만 관리하여 클라이언트 금액 변조를 방지한다.

  **필요한 클래스/메서드**:
  - `POST /api/checkout` - Checkout Session 생성
  - `POST /api/stripe/webhook` - Stripe Webhook 수신
  - `GET /api/checkout/status` - 결제 상태 조회 (클라이언트 폴링)
  - `GET /api/products` - 상품 목록 및 가격 조회

  **코드 스니펫** (Node.js / Express):
  ```javascript
  // server/routes/checkout.js
  const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
  const { PRODUCT_PRICES } = require('../config/products');

  // Checkout Session 생성
  router.post('/api/checkout', async (req, res) => {
      const { productId, userId } = req.body;

      // 서버에서 가격 결정 (클라이언트 금액 신뢰 금지)
      const priceData = PRODUCT_PRICES[productId];
      if (!priceData) {
          return res.status(400).json({ error: 'Invalid product' });
      }

      const session = await stripe.checkout.sessions.create({
          payment_method_types: ['card'],
          line_items: [{
              price_data: {
                  currency: 'usd',
                  product_data: { name: priceData.name },
                  unit_amount: priceData.amountInCents,  // 서버 결정 금액
              },
              quantity: 1,
          }],
          mode: 'payment',
          success_url: `${process.env.GAME_URL}?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${process.env.GAME_URL}?cancelled=true`,
          metadata: {
              userId: userId,
              productId: productId,
          },
          idempotency_key: `${userId}_${productId}_${Date.now()}`,
      });

      res.json({ sessionId: session.id });
  });

  // Stripe Webhook 수신
  router.post('/api/stripe/webhook',
      express.raw({ type: 'application/json' }),
      async (req, res) => {
          const sig = req.headers['stripe-signature'];
          let event;

          try {
              event = stripe.webhooks.constructEvent(
                  req.body,
                  sig,
                  process.env.STRIPE_WEBHOOK_SECRET
              );
          } catch (err) {
              console.error('Webhook signature 검증 실패:', err.message);
              return res.status(400).send(`Webhook Error: ${err.message}`);
          }

          if (event.type === 'checkout.session.completed') {
              const session = event.data.object;
              await handleSuccessfulPayment(session);
          }

          res.json({ received: true });
      }
  );

  async function handleSuccessfulPayment(session) {
      const { userId, productId } = session.metadata;

      // 중복 처리 방지 (idempotency)
      const existing = await db.collection('transactions')
          .where('stripeSessionId', '==', session.id)
          .get();
      if (!existing.empty) return;

      // 거래 기록 저장
      await db.collection('transactions').add({
          userId,
          productId,
          stripeSessionId: session.id,
          paymentIntentId: session.payment_intent,
          amount: session.amount_total,
          currency: session.currency,
          status: 'completed',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 아이템 지급 (서버 사이드)
      await grantReward(userId, productId);
  }
  ```

  **예상 난이도**: 상
  **의존성**: Stripe SDK (Node.js), Firebase Firestore, 서버 인프라

---

## 5. 영수증 서버 검증

### 5.1 영수증 검증 인터페이스

- [ ] **`IReceiptValidator` 인터페이스 정의**

  **구현 설명**: Google Play 영수증 검증과 Stripe 결제 검증을 추상화하는 인터페이스. 클라이언트에서 서버 API를 호출하여 검증 결과를 받는다. 모든 결제는 반드시 서버에서 검증한 후에만 보상을 지급한다(클라이언트 검증 결과를 신뢰하지 않음).

  **필요한 클래스/메서드**:
  - `IReceiptValidator.cs` - 인터페이스
  - `ValidationResult.cs` - 검증 결과 DTO

  **코드 스니펫**:
  ```csharp
  using System.Threading.Tasks;

  namespace HexaMerge.IAP
  {
      public interface IReceiptValidator
      {
          /// <summary>Google Play 영수증 검증 (서버 경유)</summary>
          Task<ValidationResult> ValidateGoogleReceipt(
              string purchaseToken, string productId);

          /// <summary>Stripe 결제 검증 (서버 경유)</summary>
          Task<ValidationResult> ValidateStripePayment(
              string sessionId, string productId);
      }

      public class ValidationResult
      {
          public bool IsValid;
          public string OrderId;          // Google orderId / Stripe paymentIntentId
          public string ErrorMessage;
          public ValidationErrorCode ErrorCode;
      }

      public enum ValidationErrorCode
      {
          None,
          InvalidSignature,
          ProductMismatch,
          DuplicateOrder,
          ExpiredReceipt,
          NetworkError,
          ServerError
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: 없음

---

### 5.2 서버 영수증 검증 클라이언트

- [ ] **`ServerReceiptValidator` 클래스 구현**

  **구현 설명**: 서버의 영수증 검증 API를 호출하는 클라이언트 측 구현체. Google Play `purchaseToken`이나 Stripe `sessionId`를 서버에 전달하고, 서버가 Google Play Developer API 또는 Stripe API로 검증한 결과를 받아 반환한다.

  **필요한 클래스/메서드**:
  - `ServerReceiptValidator.cs`
    - `ValidateGoogleReceipt(token, productId)` - Google 영수증 서버 검증 요청
    - `ValidateStripePayment(sessionId, productId)` - Stripe 결제 서버 검증 요청

  **코드 스니펫**:
  ```csharp
  using System;
  using System.Threading.Tasks;
  using UnityEngine;

  namespace HexaMerge.IAP
  {
      /// <summary>
      /// 서버 영수증 검증 API 호출 클라이언트.
      /// 모든 결제는 서버에서 검증 후 보상 지급.
      /// </summary>
      public class ServerReceiptValidator : IReceiptValidator
      {
          private const string API_BASE = "https://api.hexamerge.example.com";

          public async Task<ValidationResult> ValidateGoogleReceipt(
              string purchaseToken, string productId)
          {
              try
              {
                  string url = $"{API_BASE}/api/validate/google";
                  var request = new GoogleValidationRequest
                  {
                      purchaseToken = purchaseToken,
                      productId = productId,
                      packageName = Application.identifier,
                      userId = AuthManager.Instance.UserId
                  };

                  string body = JsonUtility.ToJson(request);
                  string response = await WebRequestHelper.Post(url, body,
                      AuthManager.Instance.GetAuthHeaders());

                  var result = JsonUtility.FromJson<ServerValidationResponse>(response);

                  return new ValidationResult
                  {
                      IsValid = result.valid,
                      OrderId = result.orderId,
                      ErrorMessage = result.error,
                      ErrorCode = result.valid
                          ? ValidationErrorCode.None
                          : ParseErrorCode(result.errorCode)
                  };
              }
              catch (Exception ex)
              {
                  Debug.LogError($"[IAP] 영수증 검증 실패: {ex.Message}");
                  return new ValidationResult
                  {
                      IsValid = false,
                      ErrorMessage = ex.Message,
                      ErrorCode = ValidationErrorCode.NetworkError
                  };
              }
          }

          public async Task<ValidationResult> ValidateStripePayment(
              string sessionId, string productId)
          {
              try
              {
                  string url = $"{API_BASE}/api/validate/stripe";
                  var request = new StripeValidationRequest
                  {
                      sessionId = sessionId,
                      productId = productId,
                      userId = AuthManager.Instance.UserId
                  };

                  string body = JsonUtility.ToJson(request);
                  string response = await WebRequestHelper.Post(url, body,
                      AuthManager.Instance.GetAuthHeaders());

                  var result = JsonUtility.FromJson<ServerValidationResponse>(response);

                  return new ValidationResult
                  {
                      IsValid = result.valid,
                      OrderId = result.orderId,
                      ErrorMessage = result.error,
                      ErrorCode = result.valid
                          ? ValidationErrorCode.None
                          : ParseErrorCode(result.errorCode)
                  };
              }
              catch (Exception ex)
              {
                  Debug.LogError($"[IAP] Stripe 검증 실패: {ex.Message}");
                  return new ValidationResult
                  {
                      IsValid = false,
                      ErrorMessage = ex.Message,
                      ErrorCode = ValidationErrorCode.NetworkError
                  };
              }
          }

          private ValidationErrorCode ParseErrorCode(string code) => code switch
          {
              "INVALID_SIGNATURE" => ValidationErrorCode.InvalidSignature,
              "PRODUCT_MISMATCH" => ValidationErrorCode.ProductMismatch,
              "DUPLICATE_ORDER" => ValidationErrorCode.DuplicateOrder,
              "EXPIRED" => ValidationErrorCode.ExpiredReceipt,
              _ => ValidationErrorCode.ServerError
          };

          // --- DTO ---

          [Serializable]
          private class GoogleValidationRequest
          {
              public string purchaseToken;
              public string productId;
              public string packageName;
              public string userId;
          }

          [Serializable]
          private class StripeValidationRequest
          {
              public string sessionId;
              public string productId;
              public string userId;
          }

          [Serializable]
          private class ServerValidationResponse
          {
              public bool valid;
              public string orderId;
              public string error;
              public string errorCode;
          }
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: `IReceiptValidator`, `AuthManager`, 서버 API

---

### 5.3 Google Play 영수증 검증 서버 API

- [ ] **Google Play Developer API 영수증 검증 서버 구현**

  **구현 설명**: Google Play Developer API `purchases.products.get`을 호출하여 `purchaseToken`의 유효성을 검증하는 서버 API. 서비스 계정 인증을 사용하며, orderId 기반 중복 구매 체크, packageName 일치 확인, purchaseState 검증을 수행한다.

  **필요한 클래스/메서드**:
  - `POST /api/validate/google` - 검증 엔드포인트
  - `GooglePlayValidator` - Google API 호출 클래스
  - DB: `transactions` 컬렉션 (orderId 중복 체크)

  **코드 스니펫** (Node.js):
  ```javascript
  // server/routes/validate-google.js
  const { google } = require('googleapis');
  const androidPublisher = google.androidpublisher('v3');

  router.post('/api/validate/google', async (req, res) => {
      const { purchaseToken, productId, packageName, userId } = req.body;

      try {
          // 1. Google Play Developer API 호출
          const auth = new google.auth.GoogleAuth({
              keyFile: process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH,
              scopes: ['https://www.googleapis.com/auth/androidpublisher'],
          });

          const response = await androidPublisher.purchases.products.get({
              auth: await auth.getClient(),
              packageName: packageName,
              productId: productId,
              token: purchaseToken,
          });

          const purchase = response.data;

          // 2. 검증 로직
          // 2-1. purchaseState 확인 (0 = 구매 완료)
          if (purchase.purchaseState !== 0) {
              return res.json({
                  valid: false,
                  errorCode: 'INVALID_STATE',
                  error: `purchaseState: ${purchase.purchaseState}`
              });
          }

          // 2-2. productId 일치 확인
          if (purchase.productId !== productId) {
              return res.json({
                  valid: false,
                  errorCode: 'PRODUCT_MISMATCH',
                  error: 'productId 불일치'
              });
          }

          // 2-3. 중복 거래 확인 (orderId 기반)
          const existing = await db.collection('transactions')
              .where('orderId', '==', purchase.orderId)
              .get();

          if (!existing.empty) {
              return res.json({
                  valid: false,
                  errorCode: 'DUPLICATE_ORDER',
                  error: `이미 처리된 orderId: ${purchase.orderId}`
              });
          }

          // 3. 거래 기록 저장
          await db.collection('transactions').add({
              userId,
              productId,
              orderId: purchase.orderId,
              purchaseToken,
              purchaseState: purchase.purchaseState,
              platform: 'google_play',
              status: 'validated',
              createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          // 4. 서버 사이드 보상 지급
          await grantReward(userId, productId);

          return res.json({
              valid: true,
              orderId: purchase.orderId,
          });

      } catch (error) {
          console.error('Google 영수증 검증 오류:', error);

          // Slack/Email 알림 전송
          await sendAlert('Google 영수증 검증 실패', {
              userId, productId, error: error.message
          });

          return res.status(500).json({
              valid: false,
              errorCode: 'SERVER_ERROR',
              error: error.message
          });
      }
  });
  ```

  **예상 난이도**: 상
  **의존성**: Google Play Developer API 서비스 계정, Firebase Firestore, 알림 시스템

---

### 5.4 Stripe 결제 Webhook 검증

- [ ] **Stripe Webhook Signature 검증 구현**

  **구현 설명**: Stripe에서 전송하는 Webhook 이벤트의 서명(HMAC-SHA256)을 검증하여 요청의 진위를 확인한다. `payment_intent.succeeded` 이벤트를 수신하면 결제 금액, 상품 ID, idempotency를 확인한 후 보상을 지급한다. 섹션 4.3의 Webhook 핸들러에 통합 구현.

  **필요한 클래스/메서드**:
  - Stripe SDK `stripe.webhooks.constructEvent()` - 서명 검증 내장
  - `verifyPaymentAmount(session, productId)` - 금액 일치 확인
  - `checkIdempotency(sessionId)` - 중복 처리 방지

  **코드 스니펫**:
  ```javascript
  // server/middleware/stripe-webhook-verify.js

  /**
   * Stripe Webhook 서명 검증 미들웨어.
   * HMAC-SHA256으로 요청 무결성 확인.
   * raw body가 필요하므로 express.json() 이전에 적용.
   */
  function verifyStripeWebhook(req, res, next) {
      const sig = req.headers['stripe-signature'];
      const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

      try {
          // Stripe SDK가 HMAC-SHA256 서명을 내부적으로 검증
          req.stripeEvent = stripe.webhooks.constructEvent(
              req.body,       // raw body (Buffer)
              sig,
              endpointSecret
          );
          next();
      } catch (err) {
          console.error(`[Webhook] 서명 검증 실패: ${err.message}`);
          // 잘못된 서명 -> 즉시 거부
          return res.status(400).json({
              error: 'Webhook signature verification failed'
          });
      }
  }

  /**
   * 결제 금액이 서버에 등록된 상품 가격과 일치하는지 확인.
   * 클라이언트 금액 변조 공격 방지.
   */
  function verifyPaymentAmount(session, productId) {
      const expectedPrice = PRODUCT_PRICES[productId];
      if (!expectedPrice) return false;

      return (
          session.amount_total === expectedPrice.amountInCents &&
          session.currency === expectedPrice.currency
      );
  }
  ```

  **예상 난이도**: 중
  **의존성**: Stripe SDK, 서버 환경변수 (`STRIPE_WEBHOOK_SECRET`)

---

## 6. 구매 복원

### 6.1 구매 복원 클래스

- [ ] **`PurchaseRestorer` 구매 복원 시스템 구현**

  **구현 설명**: 앱 재설치, 기기 변경 시 비소비형 상품의 구매 이력을 복원하는 시스템. Android에서는 `queryPurchasesAsync()`로 Google Play에 보유한 구매 이력을 조회하고, WebGL에서는 서버 DB에 저장된 구매 이력을 조회한다. 복원된 각 상품에 대해 권한을 재설정한다 (광고 제거, 테마 언락 등).

  **필요한 클래스/메서드**:
  - `PurchaseRestorer.cs`
    - `RestoreAll()` - 전체 구매 복원
    - `RestoreNonConsumables()` - 비소비형만 복원
    - `ApplyRestoredPurchase(RestoredPurchase purchase)` - 개별 복원 적용
  - `RestoredPurchase.cs` - 복원된 구매 데이터

  **코드 스니펫**:
  ```csharp
  using System;
  using System.Collections.Generic;
  using System.Threading.Tasks;
  using UnityEngine;

  namespace HexaMerge.IAP
  {
      /// <summary>
      /// 비소비형 상품 구매 복원 처리.
      /// Android: queryPurchasesAsync()
      /// WebGL: 서버 DB 조회
      /// </summary>
      public class PurchaseRestorer
      {
          private readonly IIAPService _service;
          private readonly ProductCatalogSO _catalog;

          public event Action<int> OnRestoreCompleted;   // 복원된 상품 수
          public event Action<string> OnRestoreFailed;    // 실패 메시지

          public PurchaseRestorer(IIAPService service, ProductCatalogSO catalog)
          {
              _service = service;
              _catalog = catalog;
          }

          /// <summary>
          /// 비소비형 상품 구매 이력을 조회하고 권한을 복원한다.
          /// 설정 > "구매 복원" 버튼에서 호출.
          /// </summary>
          public async Task<List<RestoredPurchase>> RestoreAll()
          {
              try
              {
                  Debug.Log("[IAP] 구매 복원 시작...");

                  List<RestoredPurchase> restored = await _service.RestorePurchases();

                  if (restored == null || restored.Count == 0)
                  {
                      Debug.Log("[IAP] 복원할 구매 이력 없음");
                      OnRestoreCompleted?.Invoke(0);
                      return new List<RestoredPurchase>();
                  }

                  int count = 0;
                  foreach (var purchase in restored)
                  {
                      var product = _catalog.GetProduct(purchase.ProductId);
                      if (product == null) continue;

                      // 비소비형만 복원 (소비형은 이미 소비됨)
                      if (product.productType != ProductType.NonConsumable)
                          continue;

                      ApplyRestoredPurchase(purchase, product);
                      count++;
                  }

                  Debug.Log($"[IAP] 구매 복원 완료: {count}건");
                  OnRestoreCompleted?.Invoke(count);
                  return restored;
              }
              catch (Exception ex)
              {
                  Debug.LogError($"[IAP] 구매 복원 실패: {ex.Message}");
                  OnRestoreFailed?.Invoke(ex.Message);
                  return new List<RestoredPurchase>();
              }
          }

          /// <summary>
          /// 개별 복원 적용. 비소비형 상품의 권한을 재설정.
          /// </summary>
          private void ApplyRestoredPurchase(
              RestoredPurchase purchase, ProductDefinition product)
          {
              var r = product.reward;

              if (r.removeAds)
              {
                  SettingsManager.Instance.SetAdsRemoved(true);
                  Debug.Log("[IAP] 광고 제거 복원됨");
              }

              if (r.unlockThemeIds is { Length: > 0 })
              {
                  foreach (var themeId in r.unlockThemeIds)
                  {
                      ThemeManager.Instance.UnlockTheme(themeId);
                      Debug.Log($"[IAP] 테마 복원됨: {themeId}");
                  }
              }

              // 비소비형 구매 기록 로컬 저장
              var purchasedList = PlayerPrefsHelper.GetStringList("purchasedProducts");
              if (!purchasedList.Contains(purchase.ProductId))
              {
                  purchasedList.Add(purchase.ProductId);
                  PlayerPrefsHelper.SetStringList("purchasedProducts", purchasedList);
              }
          }
      }

      [Serializable]
      public class RestoredPurchase
      {
          public string ProductId;
          public string TransactionId;
          public string PurchaseToken;
          public long PurchaseTimeMillis;
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: `IIAPService`, `ProductCatalogSO`, `SettingsManager`, `ThemeManager`

---

### 6.2 Android 구매 복원 (Google Play)

- [ ] **`GooglePlayIAPService.RestorePurchases()` 상세 구현**

  **구현 설명**: Google Play Billing Library의 `queryPurchasesAsync()`를 호출하여 `INAPP` 유형의 모든 구매 이력을 조회한다. 반환된 구매 목록 중 `purchaseState == 0`(구매 완료)인 항목만 필터링하여 `RestoredPurchase` 리스트로 변환한다. 미처리(acknowledge 안 된) 구매가 있으면 함께 처리한다.

  **필요한 클래스/메서드**:
  - `GooglePlayIAPService.RestorePurchases()` - 구현 완성
  - `GooglePlayIAPService.ProcessPendingPurchases()` - 미처리 구매 확인

  **코드 스니펫**:
  ```csharp
  // GooglePlayIAPService.cs 내부

  public async Task<List<RestoredPurchase>> RestorePurchases()
  {
  #if UNITY_ANDROID && !UNITY_EDITOR
      var restored = new List<RestoredPurchase>();

      try
      {
          // queryPurchasesAsync - INAPP (일회성 구매) 조회
          using var queryParams = new AndroidJavaObject(
              "com.android.billingclient.api.QueryPurchasesParams$Builder");
          queryParams.Call<AndroidJavaObject>("setProductType", "inapp");
          var builtParams = queryParams.Call<AndroidJavaObject>("build");

          var tcs = new TaskCompletionSource<AndroidJavaObject>();
          var listener = new PurchasesResponseProxy((code, purchases) =>
          {
              tcs.TrySetResult(purchases);
          });

          _billingClient.Call("queryPurchasesAsync", builtParams, listener);
          var purchasesList = await tcs.Task;

          if (purchasesList == null) return restored;

          int size = purchasesList.Call<int>("size");
          for (int i = 0; i < size; i++)
          {
              var purchase = purchasesList.Call<AndroidJavaObject>("get", i);
              int state = purchase.Call<int>("getPurchaseState");

              if (state != 0) continue; // PURCHASED만

              string productId = purchase
                  .Call<AndroidJavaObject>("getProducts")
                  .Call<string>("get", 0);
              string orderId = purchase.Call<string>("getOrderId");
              string token = purchase.Call<string>("getPurchaseToken");
              long time = purchase.Call<long>("getPurchaseTime");
              bool acknowledged = purchase.Call<bool>("isAcknowledged");

              // 미처리 구매 acknowledge 처리
              if (!acknowledged)
              {
                  await AcknowledgePurchase(token);
              }

              restored.Add(new RestoredPurchase
              {
                  ProductId = productId,
                  TransactionId = orderId,
                  PurchaseToken = token,
                  PurchaseTimeMillis = time
              });
          }

          Debug.Log($"[IAP] Google Play 구매 복원: {restored.Count}건");
      }
      catch (Exception ex)
      {
          Debug.LogError($"[IAP] Google Play 구매 복원 실패: {ex.Message}");
      }

      return restored;
  #else
      return new List<RestoredPurchase>();
  #endif
  }
  ```

  **예상 난이도**: 중
  **의존성**: `GooglePlayIAPService`, Google Play Billing Library

---

### 6.3 WebGL 구매 복원 (서버 DB)

- [ ] **`StripeIAPService.RestorePurchases()` 상세 구현**

  **구현 설명**: WebGL에서는 Google Play처럼 로컬 구매 이력이 없으므로, 서버 DB(Firestore)에 저장된 사용자의 구매 이력을 조회하여 비소비형 상품 권한을 복원한다.

  **필요한 클래스/메서드**:
  - `StripeIAPService.RestorePurchases()` - 서버 구매 이력 조회
  - `GET /api/purchases/:userId` - 서버 API

  **코드 스니펫**:
  ```csharp
  // StripeIAPService.cs 내부

  public async Task<List<RestoredPurchase>> RestorePurchases()
  {
      var restored = new List<RestoredPurchase>();

      try
      {
          string userId = AuthManager.Instance.UserId;
          string url = $"{API_BASE}/api/purchases/{userId}?type=non_consumable";
          string json = await WebRequestHelper.Get(url,
              AuthManager.Instance.GetAuthHeaders());

          var response = JsonUtility.FromJson<PurchaseHistoryResponse>(json);

          foreach (var record in response.purchases)
          {
              restored.Add(new RestoredPurchase
              {
                  ProductId = record.productId,
                  TransactionId = record.transactionId,
                  PurchaseToken = record.sessionId,
                  PurchaseTimeMillis = record.purchaseTimeMillis
              });
          }

          Debug.Log($"[IAP] 서버 구매 복원: {restored.Count}건");
      }
      catch (Exception ex)
      {
          Debug.LogError($"[IAP] 서버 구매 복원 실패: {ex.Message}");
      }

      return restored;
  }

  [Serializable]
  private class PurchaseHistoryResponse
  {
      public PurchaseRecord[] purchases;
  }

  [Serializable]
  private class PurchaseRecord
  {
      public string productId;
      public string transactionId;
      public string sessionId;
      public long purchaseTimeMillis;
  }
  ```

  **예상 난이도**: 중
  **의존성**: `StripeIAPService`, 서버 API (`/api/purchases`), `AuthManager`

---

### 6.4 미처리 구매(Pending Purchases) 복구

- [ ] **앱 시작 시 미처리 구매 자동 복구 로직 구현**

  **구현 설명**: Google Play 정책상 구매 후 3일 이내에 `acknowledge` 또는 `consume`하지 않으면 자동 환불된다. 앱 시작 시 `queryPurchasesAsync()`를 호출하여 미처리 구매를 확인하고, 서버 영수증 검증 후 처리를 완료하는 로직이다. `IAPInitializer`에서 `IAPManager.Initialize()` 직후 자동 실행한다.

  **필요한 클래스/메서드**:
  - `IAPInitializer.cs` - 앱 시작 시 IAP 초기화 오케스트레이션
  - `GooglePlayIAPService.ProcessPendingPurchases()` - 미처리 구매 일괄 처리

  **코드 스니펫**:
  ```csharp
  using System.Threading.Tasks;
  using UnityEngine;

  namespace HexaMerge.IAP
  {
      /// <summary>
      /// 앱 시작 시 IAP 시스템 초기화 및 미처리 구매 복구를 오케스트레이션.
      /// 게임 매니저의 초기화 시퀀스에서 호출.
      /// </summary>
      public class IAPInitializer : MonoBehaviour
      {
          [SerializeField] private ProductCatalogSO _catalog;

          private async void Start()
          {
              await InitializeIAP();
          }

          private async Task InitializeIAP()
          {
              // 1. IAPManager 초기화 (플랫폼별 서비스 + 상품 조회)
              await IAPManager.Instance.Initialize();

              // 2. 미처리 구매 확인 및 복구
              //    (GooglePlayIAPService.Initialize() 내부에서 자동 처리됨)
              //    WebGL에서는 Stripe Checkout 리다이렉트 복귀 확인

              // 3. 비소비형 구매 복원 (앱 재설치 대비)
              var restorer = new PurchaseRestorer(
                  IAPManager.Instance.GetService(),
                  _catalog);

              restorer.OnRestoreCompleted += count =>
              {
                  if (count > 0)
                      Debug.Log($"[IAP] 자동 구매 복원: {count}건 적용됨");
              };

              await restorer.RestoreAll();

              Debug.Log("[IAP] IAP 시스템 초기화 완료");
          }
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: `IAPManager`, `PurchaseRestorer`, `GooglePlayIAPService`

---

## 7. 환불 RTDN 처리

### 7.1 RTDN 수신 서버 구현

- [ ] **Google Play Real-Time Developer Notification 수신 서버 구현**

  **구현 설명**: Google Play에서 환불이 발생하면 Cloud Pub/Sub를 통해 RTDN(Real-Time Developer Notification)이 전달된다. 서버에서 이 알림을 수신하여 환불 유형을 확인하고, 사용자 데이터를 갱신(소비형: 재화 차감, 비소비형: 권한 회수)한다. 클라이언트는 다음 접속 시 서버에서 변경된 데이터를 동기화한다.

  **필요한 클래스/메서드**:
  - `POST /api/rtdn/google` - Pub/Sub push 수신 엔드포인트
  - `RefundHandler.handleRTDN(notification)` - 환불 처리 분기
  - `RefundHandler.revokeConsumable(userId, productId)` - 소비형 환불 처리
  - `RefundHandler.revokeNonConsumable(userId, productId)` - 비소비형 환불 처리

  **코드 스니펫** (Node.js):
  ```javascript
  // server/routes/rtdn-google.js
  const { google } = require('googleapis');

  /**
   * Google Play RTDN (Real-Time Developer Notification) 수신 엔드포인트.
   * Cloud Pub/Sub push subscription으로 호출됨.
   */
  router.post('/api/rtdn/google', async (req, res) => {
      try {
          // Pub/Sub 메시지 파싱
          const message = req.body.message;
          if (!message || !message.data) {
              return res.status(400).send('Invalid Pub/Sub message');
          }

          const data = JSON.parse(
              Buffer.from(message.data, 'base64').toString()
          );

          console.log('[RTDN] 알림 수신:', JSON.stringify(data));

          // 일회성 상품 환불 (oneTimeProductNotification)
          if (data.oneTimeProductNotification) {
              await handleOneTimeProductRefund(data);
          }

          // 구독 알림 (subscriptionNotification) - v2.0 예약
          if (data.subscriptionNotification) {
              await handleSubscriptionNotification(data);
          }

          // Pub/Sub에 ACK 응답 (200)
          res.status(200).send('OK');

      } catch (error) {
          console.error('[RTDN] 처리 오류:', error);
          // 오류 시에도 200 반환하여 Pub/Sub 재시도 방지
          // (단, 오류 로그 및 알림은 전송)
          await sendAlert('RTDN 처리 오류', { error: error.message });
          res.status(200).send('Error logged');
      }
  });

  /**
   * 일회성 상품 환불 처리.
   * notificationType: 2 = ONE_TIME_PRODUCT_REFUNDED
   */
  async function handleOneTimeProductRefund(data) {
      const notification = data.oneTimeProductNotification;
      const { purchaseToken, sku: productId } = notification;

      // notificationType 2 = REFUND
      if (notification.notificationType !== 2) {
          console.log(`[RTDN] 무시할 알림 유형: ${notification.notificationType}`);
          return;
      }

      // 1. 거래 기록에서 사용자 ID 조회
      const txSnapshot = await db.collection('transactions')
          .where('purchaseToken', '==', purchaseToken)
          .where('productId', '==', productId)
          .limit(1)
          .get();

      if (txSnapshot.empty) {
          console.warn(`[RTDN] 거래 기록 없음: token=${purchaseToken}`);
          await sendAlert('RTDN 미확인 거래', { purchaseToken, productId });
          return;
      }

      const tx = txSnapshot.docs[0].data();
      const userId = tx.userId;

      // 2. 상품 유형에 따라 환불 처리
      const productConfig = PRODUCT_CATALOG[productId];

      if (productConfig.type === 'consumable') {
          await revokeConsumable(userId, productId, productConfig);
      } else {
          await revokeNonConsumable(userId, productId, productConfig);
      }

      // 3. 거래 상태 업데이트
      await txSnapshot.docs[0].ref.update({
          status: 'refunded',
          refundedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // 4. 사용자에게 동기화 플래그 설정
      await db.collection('users').doc(userId).update({
          pendingSync: true,
          lastRefundAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`[RTDN] 환불 처리 완료: user=${userId}, product=${productId}`);
  }

  /**
   * 소비형 상품 환불: 코인/아이템 차감.
   * 잔액 부족 시 0으로 설정 (마이너스 방지).
   */
  async function revokeConsumable(userId, productId, config) {
      const userRef = db.collection('users').doc(userId);

      await db.runTransaction(async (t) => {
          const userDoc = await t.get(userRef);
          const userData = userDoc.data();

          // 코인 차감 (0 미만 방지)
          if (config.reward.coins > 0) {
              const currentCoins = userData.coins || 0;
              const newCoins = Math.max(0, currentCoins - config.reward.coins);
              t.update(userRef, { coins: newCoins });
          }

          // 힌트 차감
          if (config.reward.hints > 0) {
              const currentHints = userData.hints || 0;
              const newHints = Math.max(0, currentHints - config.reward.hints);
              t.update(userRef, { hints: newHints });
          }

          // 아이템 차감 (각 아이템별)
          // ... 유사 패턴
      });
  }

  /**
   * 비소비형 상품 환불: 권한 회수.
   * 광고 제거 -> 다시 활성화, 테마 -> 언락 해제.
   */
  async function revokeNonConsumable(userId, productId, config) {
      const userRef = db.collection('users').doc(userId);

      const updates = {};

      if (config.reward.removeAds) {
          updates.adsRemoved = false;
      }

      if (config.reward.unlockThemeIds?.length > 0) {
          // 현재 언락된 테마에서 해당 테마 제거
          const userDoc = await userRef.get();
          const currentThemes = userDoc.data().unlockedThemes || [];
          updates.unlockedThemes = currentThemes.filter(
              t => !config.reward.unlockThemeIds.includes(t)
          );
      }

      // 구매 상품 목록에서 제거
      const userDoc = await userRef.get();
      const purchased = userDoc.data().purchasedProducts || [];
      updates.purchasedProducts = purchased.filter(p => p !== productId);

      await userRef.update(updates);
  }
  ```

  **예상 난이도**: 상
  **의존성**: Google Cloud Pub/Sub 구독 설정, Firebase Firestore, 상품 카탈로그 서버 설정

---

### 7.2 클라이언트 환불 동기화

- [ ] **클라이언트 측 환불 데이터 동기화 구현**

  **구현 설명**: 서버에서 환불 처리 후 `pendingSync` 플래그가 설정된다. 클라이언트는 앱 시작 시 또는 주기적으로 서버에 동기화 상태를 확인하고, 변경된 데이터(코인 차감, 권한 회수 등)를 로컬에 반영한다.

  **필요한 클래스/메서드**:
  - `RefundSyncChecker.cs`
    - `CheckPendingSync()` - 서버에 동기화 필요 여부 확인
    - `ApplyServerState(UserState state)` - 서버 상태를 로컬에 반영
  - `GET /api/user/:userId/sync` - 동기화 상태 조회 서버 API

  **코드 스니펫**:
  ```csharp
  using System;
  using System.Threading.Tasks;
  using UnityEngine;

  namespace HexaMerge.IAP
  {
      /// <summary>
      /// 환불 등 서버 측 변경사항을 클라이언트에 동기화.
      /// 앱 시작 시 + 주기적 확인 (5분 간격).
      /// </summary>
      public class RefundSyncChecker
      {
          private const string API_BASE = "https://api.hexamerge.example.com";
          private const float SYNC_INTERVAL = 300f; // 5분

          /// <summary>서버에 동기화 필요 여부를 확인하고 반영.</summary>
          public async Task CheckPendingSync()
          {
              try
              {
                  string userId = AuthManager.Instance.UserId;
                  string url = $"{API_BASE}/api/user/{userId}/sync";
                  string json = await WebRequestHelper.Get(url,
                      AuthManager.Instance.GetAuthHeaders());

                  var syncData = JsonUtility.FromJson<SyncResponse>(json);

                  if (!syncData.pendingSync) return;

                  Debug.Log("[IAP] 서버 동기화 필요 - 환불 등 변경사항 감지");

                  // 서버 상태를 로컬에 반영
                  ApplyServerState(syncData);

                  // 동기화 완료 알림
                  string ackUrl = $"{API_BASE}/api/user/{userId}/sync/ack";
                  await WebRequestHelper.Post(ackUrl, "{}",
                      AuthManager.Instance.GetAuthHeaders());
              }
              catch (Exception ex)
              {
                  Debug.LogError($"[IAP] 동기화 확인 실패: {ex.Message}");
              }
          }

          private void ApplyServerState(SyncResponse state)
          {
              // 재화 동기화
              if (state.coins >= 0)
                  CurrencyManager.Instance.SetCoins(state.coins);
              if (state.hints >= 0)
                  InventoryManager.Instance.SetHints(state.hints);

              // 광고 제거 상태 동기화
              SettingsManager.Instance.SetAdsRemoved(state.adsRemoved);

              // 테마 언락 상태 동기화
              ThemeManager.Instance.SetUnlockedThemes(state.unlockedThemes);

              // 구매 상품 목록 동기화
              PlayerPrefsHelper.SetStringList("purchasedProducts",
                  new System.Collections.Generic.List<string>(state.purchasedProducts));

              Debug.Log("[IAP] 서버 상태 로컬 반영 완료");
          }

          [Serializable]
          private class SyncResponse
          {
              public bool pendingSync;
              public int coins;
              public int hints;
              public bool adsRemoved;
              public string[] unlockedThemes;
              public string[] purchasedProducts;
          }
      }
  }
  ```

  **예상 난이도**: 중
  **의존성**: `AuthManager`, `CurrencyManager`, `InventoryManager`, `SettingsManager`, `ThemeManager`, 서버 API

---

### 7.3 Cloud Pub/Sub 구독 설정

- [ ] **Google Cloud Pub/Sub RTDN 구독 설정**

  **구현 설명**: Google Play Console에서 RTDN을 수신할 Cloud Pub/Sub 토픽을 설정하고, 해당 토픽에 push subscription을 생성하여 서버 엔드포인트(`/api/rtdn/google`)로 알림이 전달되도록 구성한다.

  **필요한 작업**:
  1. Google Cloud Console에서 Pub/Sub 토픽 생성: `projects/{project-id}/topics/play-rtdn`
  2. Push Subscription 생성: 엔드포인트 = `https://api.hexamerge.example.com/api/rtdn/google`
  3. Google Play Console > 수익화 설정 > 실시간 개발자 알림에 토픽 이름 등록
  4. Pub/Sub 서비스 계정에 `google-play-developer-notifications@system.gserviceaccount.com` 게시자 권한 부여

  **예상 난이도**: 중
  **의존성**: Google Cloud 프로젝트, Google Play Console 접근 권한, 서버 HTTPS 엔드포인트

---

## 8. 테스트 계획

### 8.1 Google Play 테스트

- [ ] **Google Play 라이선스 테스트 설정**

  **구현 설명**: Google Play Console에서 라이선스 테스트 계정을 등록하고, 테스트 트랙(내부 테스트)에 앱을 업로드하여 실제 결제 없이 전체 구매 플로우를 검증한다.

  **테스트 항목**:
  - [ ] 소비형 상품 구매 -> consume -> 보상 지급 확인
  - [ ] 비소비형 상품 구매 -> acknowledge -> 권한 설정 확인
  - [ ] 구매 취소 시 적절한 에러 UI 표시
  - [ ] 네트워크 끊김 상태에서 구매 시도 -> 에러 처리
  - [ ] BillingClient 연결 끊김 -> 자동 재연결 확인
  - [ ] 미처리 구매 복구 (앱 강제 종료 후 재시작)
  - [ ] 비소비형 구매 복원 (앱 삭제 후 재설치)
  - [ ] 스타터 팩 1회 구매 제한 동작 확인
  - [ ] 가격 현지화 표시 (ProductDetails에서 가져온 가격)
  - [ ] ProGuard/R8 적용 후 결제 정상 동작

  **예상 난이도**: 중
  **의존성**: Google Play Console 내부 테스트 트랙, 라이선스 테스트 계정

---

### 8.2 Stripe 테스트

- [ ] **Stripe 테스트 모드 결제 검증**

  **구현 설명**: Stripe 테스트 모드(pk_test/sk_test)를 사용하여 Checkout 세션 생성, 결제 완료, Webhook 수신, 보상 지급의 전체 플로우를 검증한다.

  **테스트 항목**:
  - [ ] 테스트 카드 번호로 정상 결제: `4242 4242 4242 4242`
  - [ ] 결제 거절 테스트: `4000 0000 0000 0002`
  - [ ] 3D Secure 인증 테스트: `4000 0027 6000 3184`
  - [ ] Checkout Session 생성 -> 리다이렉트 -> 결제 -> 리턴 플로우
  - [ ] Webhook 수신 및 서명 검증
  - [ ] 결제 완료 후 폴링으로 상태 확인
  - [ ] 중복 결제 방지 (idempotency key)
  - [ ] 서버 다운 시 Webhook 재시도 확인

  **예상 난이도**: 중
  **의존성**: Stripe 테스트 API 키, Stripe CLI (로컬 Webhook 테스트)

---

### 8.3 영수증 검증 테스트

- [ ] **서버 영수증 검증 단위/통합 테스트**

  **테스트 항목**:
  - [ ] 유효한 Google 영수증 -> 검증 성공 + 보상 지급
  - [ ] 잘못된 purchaseToken -> 검증 실패 응답
  - [ ] 중복 orderId -> `DUPLICATE_ORDER` 에러
  - [ ] packageName 불일치 -> 검증 실패
  - [ ] Stripe Webhook 유효한 서명 -> 처리 성공
  - [ ] Stripe Webhook 잘못된 서명 -> 400 응답
  - [ ] 결제 금액 변조 감지

  **예상 난이도**: 중
  **의존성**: 서버 테스트 환경, 테스트 DB

---

### 8.4 환불 테스트

- [ ] **RTDN 환불 처리 테스트**

  **테스트 항목**:
  - [ ] 소비형 환불 -> 코인/아이템 차감 확인 (음수 방지)
  - [ ] 비소비형 환불 -> 광고 제거 해제, 테마 언락 해제
  - [ ] 클라이언트 동기화 -> 다음 접속 시 변경사항 반영
  - [ ] 거래 기록 없는 환불 알림 -> 경고 알림 전송
  - [ ] Pub/Sub 메시지 중복 수신 -> 멱등성 보장

  **예상 난이도**: 상
  **의존성**: RTDN 테스트 환경, Cloud Pub/Sub 에뮬레이터

---

### 8.5 에디터 테스트 서비스

- [ ] **`EditorIAPService` 에디터 전용 테스트 서비스 구현**

  **구현 설명**: Unity 에디터에서 실제 결제 없이 IAP 플로우를 테스트할 수 있는 모의(Mock) 서비스. 모든 구매가 즉시 성공하며, 지연/실패 시뮬레이션 옵션을 제공한다.

  **필요한 클래스/메서드**:
  - `EditorIAPService.cs`
    - 모든 `IIAPService` 메서드 구현 (Mock)
    - `SimulateDelay` - 네트워크 지연 시뮬레이션
    - `SimulateFailure` - 결제 실패 시뮬레이션
    - `SimulateRestore` - 구매 복원 시뮬레이션

  **코드 스니펫**:
  ```csharp
  using System;
  using System.Collections.Generic;
  using System.Threading.Tasks;
  using UnityEngine;

  namespace HexaMerge.IAP.Platform
  {
      /// <summary>
      /// Unity 에디터 전용 모의 IAP 서비스.
      /// 실제 결제 없이 전체 플로우 테스트 가능.
      /// </summary>
      public class EditorIAPService : IIAPService
      {
          public bool IsInitialized { get; private set; }

          public event Action<PurchaseResult> OnPurchaseCompleted;
          public event Action<string, PurchaseFailureReason> OnPurchaseFailed;

          [Header("시뮬레이션 옵션")]
          public bool SimulateDelay = true;
          public int DelayMs = 1500;
          public bool SimulateFailure = false;
          public PurchaseFailureReason SimulatedFailureReason =
              PurchaseFailureReason.UserCancelled;

          private HashSet<string> _simulatedPurchases = new();

          public async Task<bool> Initialize(string[] productIds)
          {
              if (SimulateDelay) await Task.Delay(500);
              IsInitialized = true;
              Debug.Log("[IAP-Editor] 모의 IAP 서비스 초기화 완료");
              return true;
          }

          public async Task<PurchaseResult> Purchase(string productId)
          {
              Debug.Log($"[IAP-Editor] 모의 구매 시작: {productId}");
              if (SimulateDelay) await Task.Delay(DelayMs);

              if (SimulateFailure)
              {
                  OnPurchaseFailed?.Invoke(productId, SimulatedFailureReason);
                  return new PurchaseResult
                  {
                      ProductId = productId,
                      IsSuccess = false,
                      FailureReason = SimulatedFailureReason
                  };
              }

              var result = new PurchaseResult
              {
                  ProductId = productId,
                  TransactionId = $"EDITOR_{Guid.NewGuid():N}",
                  Receipt = $"editor_token_{productId}_{DateTime.UtcNow.Ticks}",
                  IsSuccess = true
              };

              _simulatedPurchases.Add(productId);
              OnPurchaseCompleted?.Invoke(result);
              Debug.Log($"[IAP-Editor] 모의 구매 성공: {productId}");
              return result;
          }

          public async Task<List<RestoredPurchase>> RestorePurchases()
          {
              if (SimulateDelay) await Task.Delay(1000);

              var restored = new List<RestoredPurchase>();
              foreach (var id in _simulatedPurchases)
              {
                  restored.Add(new RestoredPurchase
                  {
                      ProductId = id,
                      TransactionId = $"EDITOR_RESTORE_{id}",
                      PurchaseTimeMillis = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
                  });
              }

              Debug.Log($"[IAP-Editor] 모의 복원: {restored.Count}건");
              return restored;
          }

          public string GetLocalizedPrice(string productId) => "$0.99 (Editor)";
          public bool IsProductAvailable(string productId) => IsInitialized;
      }
  }
  ```

  **예상 난이도**: 하
  **의존성**: `IIAPService`

---

## 9. 구현 우선순위 및 일정

### 9.1 단계별 구현 순서

| 단계 | 항목 | 관련 섹션 | 난이도 | 예상 기간 | 의존성 |
|------|------|----------|--------|----------|--------|
| **1단계: 기반 구조** | | | | **3일** | |
| 1-1 | `ProductType` 열거형 | 2.1 | 하 | 0.5일 | 없음 |
| 1-2 | `ProductDefinition` 데이터 클래스 | 2.2 | 하 | 0.5일 | 1-1 |
| 1-3 | `ProductCatalogSO` ScriptableObject | 2.3 | 하 | 0.5일 | 1-2 |
| 1-4 | 상품 13종 데이터 등록 | 2.4 | 하 | 0.5일 | 1-3 |
| 1-5 | `IIAPService` 인터페이스 | 3.1 | 중 | 0.5일 | 1-2 |
| 1-6 | `IReceiptValidator` 인터페이스 | 5.1 | 하 | 0.5일 | 없음 |
| **2단계: 에디터 테스트** | | | | **1일** | |
| 2-1 | `EditorIAPService` 모의 서비스 | 8.5 | 하 | 0.5일 | 1-5 |
| 2-2 | `IAPManager` 통합 관리자 | 3.4 | 상 | 0.5일 | 1-5, 1-6, 2-1 |
| **3단계: Google Play 연동** | | | | **5일** | |
| 3-1 | `GooglePlayBillingWrapper` 네이티브 래퍼 | 3.3 | 상 | 2일 | 1-5, Billing AAR |
| 3-2 | `GooglePlayIAPService` 서비스 구현 | 3.2 | 상 | 2일 | 3-1 |
| 3-3 | Google Play Console 상품 등록 | - | 중 | 1일 | 1-4 |
| **4단계: 서버 검증** | | | | **4일** | |
| 4-1 | Google 영수증 검증 서버 API | 5.3 | 상 | 2일 | 서버 인프라 |
| 4-2 | `ServerReceiptValidator` 클라이언트 | 5.2 | 중 | 1일 | 4-1, 1-6 |
| 4-3 | 중복 거래 방지 DB 구성 | 5.3 | 중 | 1일 | 4-1 |
| **5단계: Stripe 연동** | | | | **5일** | |
| 5-1 | Stripe 서버 API (Checkout + Webhook) | 4.3, 5.4 | 상 | 2일 | 서버 인프라 |
| 5-2 | `StripePlugin.jslib` 브릿지 | 4.2 | 중 | 1일 | 없음 |
| 5-3 | `StripeIAPService` 클라이언트 | 4.1 | 상 | 2일 | 5-1, 5-2, 1-5 |
| **6단계: 구매 복원** | | | | **3일** | |
| 6-1 | `PurchaseRestorer` 클래스 | 6.1 | 중 | 1일 | 1-5, 1-3 |
| 6-2 | Android 구매 복원 구현 | 6.2 | 중 | 1일 | 3-2, 6-1 |
| 6-3 | WebGL 구매 복원 구현 | 6.3 | 중 | 0.5일 | 5-3, 6-1 |
| 6-4 | 미처리 구매 자동 복구 | 6.4 | 중 | 0.5일 | 6-2 |
| **7단계: 환불 처리** | | | | **3일** | |
| 7-1 | Cloud Pub/Sub 구독 설정 | 7.3 | 중 | 0.5일 | GCP 프로젝트 |
| 7-2 | RTDN 수신 서버 구현 | 7.1 | 상 | 1.5일 | 7-1, 4-1 |
| 7-3 | 클라이언트 환불 동기화 | 7.2 | 중 | 1일 | 7-2 |
| **8단계: 테스트** | | | | **4일** | |
| 8-1 | Google Play 라이선스 테스트 | 8.1 | 중 | 1.5일 | 3단계 전체 |
| 8-2 | Stripe 테스트 모드 검증 | 8.2 | 중 | 1일 | 5단계 전체 |
| 8-3 | 영수증 검증 테스트 | 8.3 | 중 | 0.5일 | 4단계 전체 |
| 8-4 | 환불 처리 테스트 | 8.4 | 상 | 1일 | 7단계 전체 |

### 9.2 총 예상 기간

| 항목 | 기간 |
|------|------|
| 1단계: 기반 구조 | 3일 |
| 2단계: 에디터 테스트 | 1일 |
| 3단계: Google Play 연동 | 5일 |
| 4단계: 서버 검증 | 4일 |
| 5단계: Stripe 연동 | 5일 |
| 6단계: 구매 복원 | 3일 |
| 7단계: 환불 처리 | 3일 |
| 8단계: 테스트 | 4일 |
| **합계** | **28일 (약 4주)** |

### 9.3 핵심 의존성 맵

```
[의존성 흐름도]

ProductType ─> ProductDefinition ─> ProductCatalogSO ─> 상품 데이터 등록
                                                              |
IIAPService <─────────────────────────────────────── IAPManager
    |                                                    |    |
    ├── GooglePlayIAPService                             |    |
    |       |                                            |    |
    |       └── GooglePlayBillingWrapper                 |    |
    |               |                                    |    |
    |               └── billing-7.x.aar (AAR 플러그인)   |    |
    |                                                    |    |
    ├── StripeIAPService                                 |    |
    |       |                                            |    |
    |       └── StripePlugin.jslib                       |    |
    |                                                    |    |
    └── EditorIAPService (에디터 전용)                    |    |
                                                         |    |
IReceiptValidator <──────────────────────────────────────+    |
    |                                                         |
    └── ServerReceiptValidator                                |
            |                                                 |
            ├── /api/validate/google (서버)                   |
            └── /api/validate/stripe (서버)                   |
                                                              |
PurchaseRestorer <────────────────────────────────────────────+
                                                              |
RefundSyncChecker <───────────────────────────────────────────+

[서버 사이드 의존성]

/api/rtdn/google <── Cloud Pub/Sub <── Google Play Console RTDN
       |
       └── RefundHandler
               ├── revokeConsumable()
               └── revokeNonConsumable()
                       |
                       └── Firestore (users / transactions)
```

---

## 부록

### A. ProGuard/R8 규칙

Google Play Billing Library 클래스가 난독화되지 않도록 예외 규칙을 추가해야 한다.

```proguard
# Google Play Billing Library
-keep class com.android.billingclient.** { *; }
-keep interface com.android.billingclient.** { *; }
-dontwarn com.android.billingclient.**
```

### B. AndroidManifest.xml 필수 권한

```xml
<!-- 인앱 결제 권한 -->
<uses-permission android:name="com.android.vending.BILLING" />
```

### C. WebGL index.html Stripe.js 추가

```html
<!-- Stripe.js SDK - CSP 허용 필요 -->
<script src="https://js.stripe.com/v3/"></script>
```

### D. 환경 변수 목록 (서버)

| 변수명 | 설명 | 사용처 |
|--------|------|--------|
| `GOOGLE_SERVICE_ACCOUNT_KEY_PATH` | Google API 서비스 계정 키 파일 경로 | 영수증 검증 |
| `STRIPE_SECRET_KEY` | Stripe 비밀 키 (sk_live / sk_test) | Checkout Session 생성 |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhook 서명 검증 시크릿 | Webhook 검증 |
| `STRIPE_PUBLISHABLE_KEY` | Stripe 공개 키 (pk_live / pk_test) | 클라이언트 .jslib |
| `GAME_URL` | 게임 WebGL 호스팅 URL | Checkout 리다이렉트 |

### E. 참고 자료

- [Google Play Billing Library 7.x 문서](https://developer.android.com/google/play/billing)
- [Google Play Developer API - purchases.products.get](https://developers.google.com/android-publisher/api-ref/rest/v3/purchases.products)
- [Google Play Real-Time Developer Notifications](https://developer.android.com/google/play/billing/getting-ready#configure-rtdn)
- [Stripe Checkout 문서](https://stripe.com/docs/payments/checkout)
- [Stripe Webhook 서명 검증](https://stripe.com/docs/webhooks/signatures)
- [Unity WebGL jslib 플러그인 가이드](https://docs.unity3d.com/Manual/webgl-interactingwithbrowserscripting.html)

---

> **문서 이력**
> | 버전 | 날짜 | 작성자 | 변경 내용 |
> |------|------|--------|----------|
> | 1.0 | 2026-02-13 | - | 최초 작성 |
