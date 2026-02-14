# 07. 광고 보상 시스템 - 상세 개발 계획서

> **프로젝트**: Hexa Merge Basic
> **기반 설계문서**: `docs/design/03_monetization-platform-design.md` - 섹션 1. 광고 보상 시스템
> **플랫폼**: Android (AdMob) / WebGL (Unity Ads)
> **작성일**: 2026-02-13
> **문서 버전**: 1.0

---

## 목차

1. [구현 개요](#1-구현-개요)
2. [광고 서비스 추상화 레이어](#2-광고-서비스-추상화-레이어)
3. [AdMob SDK 연동 (Android)](#3-admob-sdk-연동-android)
4. [Unity Ads SDK 연동 (WebGL)](#4-unity-ads-sdk-연동-webgl)
5. [에디터 테스트용 Mock 광고 서비스](#5-에디터-테스트용-mock-광고-서비스)
6. [보상형 광고 트리거 포인트 구현 (T1~T6)](#6-보상형-광고-트리거-포인트-구현-t1t6)
7. [쿨다운 및 일일 제한 시스템](#7-쿨다운-및-일일-제한-시스템)
8. [광고 실패 폴백 처리](#8-광고-실패-폴백-처리)
9. [오프라인 대체 처리](#9-오프라인-대체-처리)
10. [광고 설정 ScriptableObject](#10-광고-설정-scriptableobject)
11. [GDPR 및 개인정보 동의](#11-gdpr-및-개인정보-동의)
12. [Analytics 이벤트 연동](#12-analytics-이벤트-연동)
13. [전체 구현 체크리스트 요약](#13-전체-구현-체크리스트-요약)

---

## 1. 구현 개요

### 1.1 아키텍처 다이어그램

```
+-----------------------------------------------------------+
|                     AdRewardManager                        |
|  (싱글턴, 전체 광고 흐름 조율)                                |
+-----------------------------------------------------------+
        |                    |                    |
        v                    v                    v
+---------------+  +------------------+  +----------------+
| IAdsService   |  | CooldownManager  |  | RewardGranter  |
| (광고 SDK      |  | (쿨다운/일일제한) |  | (보상 지급)     |
|  추상화)       |  |                  |  |                |
+---------------+  +------------------+  +----------------+
   |        |
   v        v
+------+ +------------+ +---------------+
|AdMob | |Unity Ads   | |EditorMock     |
|Ads   | |Service     | |AdsService     |
|Svc   | |(WebGL)     | |(테스트용)      |
+------+ +------------+ +---------------+
```

### 1.2 주요 네임스페이스 구조

```
HexaMerge.Ads/
  ├── Core/
  │   ├── IAdsService.cs
  │   ├── AdRewardManager.cs
  │   ├── AdCooldownManager.cs
  │   └── AdRewardConfig.cs (ScriptableObject)
  ├── Platform/
  │   ├── AdMobAdsService.cs
  │   ├── UnityAdsService.cs
  │   └── EditorAdsService.cs
  ├── Triggers/
  │   ├── AdTriggerBase.cs
  │   ├── ContinueAdTrigger.cs      (T1)
  │   ├── HintAdTrigger.cs          (T2)
  │   ├── ScoreBoosterAdTrigger.cs  (T3)
  │   ├── ItemAdTrigger.cs          (T4)
  │   ├── DailyBonusAdTrigger.cs    (T5)
  │   └── CoinBonusAdTrigger.cs     (T6)
  ├── Fallback/
  │   ├── AdFallbackHandler.cs
  │   └── OfflineAdHandler.cs
  └── Consent/
      └── GDPRConsentManager.cs
```

---

## 2. 광고 서비스 추상화 레이어

### 2.1 체크리스트

- [ ] **IAdsService 인터페이스 정의**
  - 구현 설명: 모든 플랫폼 광고 SDK를 추상화하는 핵심 인터페이스. Android(AdMob), WebGL(Unity Ads), Editor(Mock) 세 가지 구현체가 이 인터페이스를 따른다.
  - 필요한 클래스/메서드:
    - `IAdsService` 인터페이스
    - `Initialize(Action<bool> onInitialized)` -- SDK 초기화
    - `LoadRewardedAd()` -- 보상형 광고 미리 로드
    - `ShowRewardedAd(string triggerPointId, Action<AdResult> onComplete)` -- 광고 재생
    - `IsRewardedAdReady() : bool` -- 광고 로드 상태 확인
    - `SetUserConsent(bool consent)` -- GDPR 동의 설정
    - `Dispose()` -- 리소스 정리
  - 예상 난이도: **하**
  - 의존성: 없음

```csharp
namespace HexaMerge.Ads.Core
{
    /// <summary>
    /// 광고 재생 결과를 나타내는 열거형.
    /// </summary>
    public enum AdResultType
    {
        Success,          // 광고 시청 완료, 보상 지급 가능
        Failed,           // 광고 로드/재생 실패
        NotReady,         // 광고가 아직 로드되지 않음
        UserCancelled,    // 사용자가 광고를 도중에 닫음
        NetworkError,     // 네트워크 연결 오류
        NoFill            // 광고 인벤토리 없음
    }

    /// <summary>
    /// 광고 재생 결과 데이터.
    /// </summary>
    public struct AdResult
    {
        public AdResultType Type;
        public string ErrorMessage;
        public string AdNetworkName;  // "AdMob", "UnityAds", "Editor"

        public bool IsSuccess => Type == AdResultType.Success;
    }

    /// <summary>
    /// 모든 플랫폼 광고 SDK를 추상화하는 인터페이스.
    /// 설계문서 1.5.3 기반.
    /// </summary>
    public interface IAdsService : System.IDisposable
    {
        /// <summary>광고 SDK가 초기화 완료되었는지 여부.</summary>
        bool IsInitialized { get; }

        /// <summary>SDK 초기화. onInitialized 콜백으로 성공/실패 전달.</summary>
        void Initialize(System.Action<bool> onInitialized);

        /// <summary>보상형 광고를 미리 로드한다.</summary>
        void LoadRewardedAd();

        /// <summary>보상형 광고를 표시한다.</summary>
        /// <param name="triggerPointId">트리거 포인트 ID (T1~T6)</param>
        /// <param name="onComplete">광고 완료 콜백</param>
        void ShowRewardedAd(string triggerPointId, System.Action<AdResult> onComplete);

        /// <summary>보상형 광고가 재생 가능한 상태인지 확인.</summary>
        bool IsRewardedAdReady();

        /// <summary>사용자 개인정보 동의 상태를 SDK에 전달.</summary>
        void SetUserConsent(bool consent);
    }
}
```

---

- [ ] **AdRewardManager 싱글턴 구현**
  - 구현 설명: 광고 흐름의 중앙 관리자. 플랫폼별 SDK 서비스 생성, 쿨다운 체크, 보상 지급, 폴백 처리를 조율하는 퍼사드(Facade) 역할.
  - 필요한 클래스/메서드:
    - `AdRewardManager : MonoBehaviour` (싱글턴)
    - `RequestAd(AdTriggerType triggerType, Action<bool> onRewardGranted)` -- 광고 요청 진입점
    - `OnAdCompleted(AdResult result)` -- 광고 완료 핸들러
    - `InitializePlatformService()` -- 플랫폼별 SDK 서비스 선택 및 초기화
    - `IsAdAvailable(AdTriggerType triggerType) : bool` -- 특정 트리거에 대해 광고 시청 가능 여부
  - 예상 난이도: **중**
  - 의존성: `IAdsService`, `AdCooldownManager`, `AdFallbackHandler`, `AdRewardConfig`

```csharp
namespace HexaMerge.Ads.Core
{
    using UnityEngine;
    using System;

    /// <summary>
    /// 광고 트리거 유형. 설계문서 1.2 기반.
    /// </summary>
    public enum AdTriggerType
    {
        T1_Continue,       // 게임 오버 후 이어하기
        T2_Hint,           // 힌트 충전
        T3_ScoreBooster,   // 점수 부스터 활성화
        T4_SpecialItem,    // 특수 아이템 획득
        T5_DailyBonus,     // 일일 보너스 2배
        T6_CoinBonus       // 코인 보너스
    }

    /// <summary>
    /// 광고 보상 시스템의 중앙 관리자.
    /// 플랫폼별 SDK 선택, 쿨다운 검증, 보상 지급, 폴백 처리를 조율한다.
    /// </summary>
    public class AdRewardManager : MonoBehaviour
    {
        public static AdRewardManager Instance { get; private set; }

        [SerializeField] private AdRewardConfig _config;

        private IAdsService _primaryAdsService;
        private IAdsService _fallbackAdsService;
        private AdCooldownManager _cooldownManager;
        private AdFallbackHandler _fallbackHandler;

        private Action<bool> _currentRewardCallback;
        private AdTriggerType _currentTriggerType;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            _cooldownManager = new AdCooldownManager(_config);
            _fallbackHandler = new AdFallbackHandler();
            InitializePlatformService();
        }

        /// <summary>
        /// 플랫폼에 따라 1차/2차 광고 서비스를 생성하고 초기화한다.
        /// 설계문서 1.5.1 기반: Android=AdMob(1차)+UnityAds(2차), WebGL=UnityAds(1차).
        /// </summary>
        private void InitializePlatformService()
        {
#if UNITY_EDITOR
            _primaryAdsService = new EditorAdsService();
#elif UNITY_ANDROID
            _primaryAdsService = new Platform.AdMobAdsService(_config.AdMobRewardedAdUnitId);
            _fallbackAdsService = new Platform.UnityAdsService(
                _config.UnityAdsGameId, _config.UnityAdsRewardedPlacementId);
#elif UNITY_WEBGL
            _primaryAdsService = new Platform.UnityAdsService(
                _config.UnityAdsGameId, _config.UnityAdsRewardedPlacementId);
#endif

            _primaryAdsService?.Initialize(success =>
            {
                if (success)
                {
                    _primaryAdsService.LoadRewardedAd();
                    Debug.Log("[AdRewardManager] 1차 광고 SDK 초기화 성공");
                }
                else
                {
                    Debug.LogWarning("[AdRewardManager] 1차 광고 SDK 초기화 실패, 2차 SDK 시도");
                    _fallbackAdsService?.Initialize(_ => _fallbackAdsService.LoadRewardedAd());
                }
            });
        }

        /// <summary>
        /// 광고 시청을 요청한다. 쿨다운/일일제한 검증 후 광고를 재생한다.
        /// 설계문서 1.4 광고 요청 흐름 참조.
        /// </summary>
        /// <param name="triggerType">트리거 포인트 유형 (T1~T6)</param>
        /// <param name="onRewardGranted">보상 지급 결과 콜백 (true=성공)</param>
        public void RequestAd(AdTriggerType triggerType, Action<bool> onRewardGranted)
        {
            _currentRewardCallback = onRewardGranted;
            _currentTriggerType = triggerType;

            // 1단계: 일일 한도 확인 (20회/일)
            if (!_cooldownManager.CanWatchAd())
            {
                Debug.Log("[AdRewardManager] 일일 광고 한도 도달");
                UIManager.Instance?.ShowPopup("오늘의 광고 시청 한도에 도달했습니다.");
                onRewardGranted?.Invoke(false);
                return;
            }

            // 2단계: 쿨다운 확인
            if (!_cooldownManager.IsCooldownReady(triggerType))
            {
                float remaining = _cooldownManager.GetRemainingCooldown(triggerType);
                Debug.Log($"[AdRewardManager] 쿨다운 대기 중: {remaining:F0}초 남음");
                UIManager.Instance?.ShowPopup($"잠시 후 다시 시도해주세요. ({remaining:F0}초)");
                onRewardGranted?.Invoke(false);
                return;
            }

            // 3단계: 광고 재생
            if (_primaryAdsService != null && _primaryAdsService.IsRewardedAdReady())
            {
                _primaryAdsService.ShowRewardedAd(
                    triggerType.ToString(), OnAdCompleted);
            }
            else
            {
                // 1차 SDK 실패 시 폴백 처리로 이동
                _fallbackHandler.HandleFailure(
                    _primaryAdsService, _fallbackAdsService,
                    triggerType, OnAdCompleted);
            }
        }

        /// <summary>
        /// 특정 트리거에 대해 광고 시청이 가능한지 확인한다.
        /// UI에서 광고 버튼 활성화/비활성화에 사용.
        /// </summary>
        public bool IsAdAvailable(AdTriggerType triggerType)
        {
            if (!NetworkReachabilityChecker.IsOnline) return false;
            if (!_cooldownManager.CanWatchAd()) return false;
            if (!_cooldownManager.IsCooldownReady(triggerType)) return false;
            if (_primaryAdsService == null) return false;
            return _primaryAdsService.IsRewardedAdReady();
        }

        private void OnAdCompleted(AdResult result)
        {
            if (result.IsSuccess)
            {
                _cooldownManager.RecordAdWatch(_currentTriggerType);
                RewardGranter.GrantReward(_currentTriggerType);
                _currentRewardCallback?.Invoke(true);

                // 다음 광고 미리 로드
                _primaryAdsService?.LoadRewardedAd();
            }
            else
            {
                _currentRewardCallback?.Invoke(false);
            }
        }
    }
}
```

---

## 3. AdMob SDK 연동 (Android)

### 3.1 체크리스트

- [ ] **AdMob SDK 패키지 설치 및 설정**
  - 구현 설명: Google Mobile Ads Unity 플러그인을 UPM 또는 `.unitypackage`로 설치하고, `AndroidManifest.xml`에 AdMob App ID를 등록한다.
  - 필요한 설정:
    - `Google Mobile Ads Unity Plugin v9.x` 설치
    - `Assets/Plugins/Android/AndroidManifest.xml`에 `com.google.android.gms.ads.APPLICATION_ID` 메타데이터 추가
    - `Assets/GoogleMobileAds/Resources/GoogleMobileAdsSettings.asset` 생성
  - 예상 난이도: **중**
  - 의존성: Unity 2021.3+, Android Build Support

```xml
<!-- Assets/Plugins/Android/AndroidManifest.xml 추가 항목 -->
<meta-data
    android:name="com.google.android.gms.ads.APPLICATION_ID"
    android:value="ca-app-pub-XXXXXXXXXXXXXXXX~YYYYYYYYYY"/>
```

---

- [ ] **AdMobAdsService 구현체 작성**
  - 구현 설명: `IAdsService`를 구현하는 Android 전용 광고 서비스. Google Mobile Ads SDK의 `RewardedAd` API를 래핑하여 초기화, 로드, 표시, 콜백 처리를 수행한다.
  - 필요한 클래스/메서드:
    - `AdMobAdsService : IAdsService`
    - `Initialize(Action<bool>)` -- `MobileAds.Initialize()` 호출
    - `LoadRewardedAd()` -- `RewardedAd.Load()` 비동기 로드
    - `ShowRewardedAd(string, Action<AdResult>)` -- `_rewardedAd.Show()` 호출
    - `IsRewardedAdReady()` -- `_rewardedAd != null` 체크
    - `SetUserConsent(bool)` -- `ConsentInformation` API 호출
    - `RegisterEventHandlers()` -- 광고 이벤트 핸들러 등록
  - 예상 난이도: **상**
  - 의존성: `Google Mobile Ads Unity Plugin`, `IAdsService`

```csharp
#if UNITY_ANDROID
namespace HexaMerge.Ads.Platform
{
    using GoogleMobileAds.Api;
    using HexaMerge.Ads.Core;
    using System;
    using UnityEngine;

    /// <summary>
    /// Android용 AdMob 보상형 광고 서비스.
    /// 설계문서 1.5.1: Android 1차 SDK = Google AdMob.
    /// </summary>
    public class AdMobAdsService : IAdsService
    {
        public bool IsInitialized { get; private set; }

        private readonly string _rewardedAdUnitId;
        private RewardedAd _rewardedAd;
        private Action<AdResult> _onCompleteCallback;
        private int _consecutiveFailures;

        /// <summary>
        /// AdMob 광고 서비스를 생성한다.
        /// </summary>
        /// <param name="rewardedAdUnitId">보상형 광고 단위 ID</param>
        public AdMobAdsService(string rewardedAdUnitId)
        {
            _rewardedAdUnitId = rewardedAdUnitId;
            _consecutiveFailures = 0;
        }

        public void Initialize(Action<bool> onInitialized)
        {
            MobileAds.Initialize(initStatus =>
            {
                IsInitialized = true;
                Debug.Log("[AdMob] SDK 초기화 완료");
                onInitialized?.Invoke(true);
            });
        }

        public void LoadRewardedAd()
        {
            if (!IsInitialized)
            {
                Debug.LogWarning("[AdMob] SDK가 초기화되지 않아 광고를 로드할 수 없음");
                return;
            }

            var adRequest = new AdRequest();

            RewardedAd.Load(_rewardedAdUnitId, adRequest, (RewardedAd ad, LoadAdError error) =>
            {
                if (error != null || ad == null)
                {
                    _consecutiveFailures++;
                    Debug.LogError($"[AdMob] 보상형 광고 로드 실패: {error?.GetMessage()}");
                    return;
                }

                _consecutiveFailures = 0;
                _rewardedAd = ad;
                RegisterEventHandlers(_rewardedAd);
                Debug.Log("[AdMob] 보상형 광고 로드 성공");
            });
        }

        public void ShowRewardedAd(string triggerPointId, Action<AdResult> onComplete)
        {
            _onCompleteCallback = onComplete;

            if (_rewardedAd == null || !_rewardedAd.CanShowAd())
            {
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.NotReady,
                    ErrorMessage = "광고가 준비되지 않았습니다.",
                    AdNetworkName = "AdMob"
                });
                return;
            }

            _rewardedAd.Show(reward =>
            {
                Debug.Log($"[AdMob] 보상 수령: {reward.Type}, 수량: {reward.Amount}");
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.Success,
                    AdNetworkName = "AdMob"
                });
            });
        }

        public bool IsRewardedAdReady()
        {
            return _rewardedAd != null && _rewardedAd.CanShowAd();
        }

        public void SetUserConsent(bool consent)
        {
            // UMP SDK를 통한 GDPR 동의 처리
            var requestParameters = new ConsentRequestParameters
            {
                TagForUnderAgeOfConsent = false
            };
            ConsentInformation.Update(requestParameters, error =>
            {
                if (error != null)
                {
                    Debug.LogError($"[AdMob] 동의 정보 업데이트 실패: {error.Message}");
                }
            });
        }

        /// <summary>
        /// 광고 이벤트 핸들러 등록. 광고 닫힘, 노출 실패 등을 처리한다.
        /// </summary>
        private void RegisterEventHandlers(RewardedAd ad)
        {
            ad.OnAdFullScreenContentClosed += () =>
            {
                Debug.Log("[AdMob] 광고 화면 닫힘 -> 다음 광고 미리 로드");
                LoadRewardedAd();
            };

            ad.OnAdFullScreenContentFailed += (AdError adError) =>
            {
                _consecutiveFailures++;
                Debug.LogError($"[AdMob] 광고 표시 실패: {adError.GetMessage()}");
                _onCompleteCallback?.Invoke(new AdResult
                {
                    Type = AdResultType.Failed,
                    ErrorMessage = adError.GetMessage(),
                    AdNetworkName = "AdMob"
                });
                LoadRewardedAd();
            };

            ad.OnAdImpressionRecorded += () =>
            {
                Debug.Log("[AdMob] 광고 노출 기록됨");
            };
        }

        public void Dispose()
        {
            _rewardedAd?.Destroy();
            _rewardedAd = null;
        }
    }
}
#endif
```

---

## 4. Unity Ads SDK 연동 (WebGL)

### 4.1 체크리스트

- [ ] **Unity Ads 패키지 설치 및 설정**
  - 구현 설명: Unity Package Manager에서 `com.unity.ads` 패키지를 설치하고 Unity Dashboard에서 Game ID와 Placement ID를 설정한다. WebGL 빌드에서 AdMob은 지원되지 않으므로 Unity Ads가 1차 SDK가 된다.
  - 필요한 설정:
    - UPM: `com.unity.ads@4.x` 패키지 설치
    - Unity Dashboard: 프로젝트 설정에서 Ads 서비스 활성화
    - Game ID (Android/iOS/WebGL별), Rewarded Placement ID 발급
  - 예상 난이도: **하**
  - 의존성: Unity Services 계정

---

- [ ] **UnityAdsService 구현체 작성**
  - 구현 설명: `IAdsService`를 구현하는 WebGL 전용 광고 서비스. `IUnityAdsInitializationListener`, `IUnityAdsLoadListener`, `IUnityAdsShowListener` 인터페이스를 구현하여 Unity Ads 콜백을 처리한다. Android에서는 AdMob의 2차 폴백으로도 사용된다.
  - 필요한 클래스/메서드:
    - `UnityAdsService : IAdsService, IUnityAdsInitializationListener, IUnityAdsLoadListener, IUnityAdsShowListener`
    - `Initialize(Action<bool>)` -- `Advertisement.Initialize()` 호출
    - `LoadRewardedAd()` -- `Advertisement.Load()` 호출
    - `ShowRewardedAd(string, Action<AdResult>)` -- `Advertisement.Show()` 호출
    - `OnInitializationComplete()` / `OnInitializationFailed()` -- 초기화 콜백
    - `OnUnityAdsAdLoaded()` / `OnUnityAdsFailedToLoad()` -- 로드 콜백
    - `OnUnityAdsShowComplete()` / `OnUnityAdsShowFailure()` -- 표시 콜백
  - 예상 난이도: **상**
  - 의존성: `com.unity.ads@4.x`, `IAdsService`

```csharp
namespace HexaMerge.Ads.Platform
{
    using UnityEngine;
    using UnityEngine.Advertisements;
    using HexaMerge.Ads.Core;
    using System;

    /// <summary>
    /// Unity Ads 보상형 광고 서비스.
    /// 설계문서 1.5.1: WebGL 1차 SDK = Unity Ads, Android 2차 SDK = Unity Ads.
    /// IUnityAds*Listener 인터페이스를 구현하여 광고 수명주기를 처리한다.
    /// </summary>
    public class UnityAdsService : IAdsService,
        IUnityAdsInitializationListener,
        IUnityAdsLoadListener,
        IUnityAdsShowListener
    {
        public bool IsInitialized { get; private set; }

        private readonly string _gameId;
        private readonly string _rewardedPlacementId;
        private Action<bool> _onInitializedCallback;
        private Action<AdResult> _onCompleteCallback;
        private bool _isAdLoaded;
        private int _consecutiveFailures;

        /// <summary>
        /// Unity Ads 서비스를 생성한다.
        /// </summary>
        /// <param name="gameId">Unity Ads Game ID</param>
        /// <param name="rewardedPlacementId">보상형 광고 Placement ID</param>
        public UnityAdsService(string gameId, string rewardedPlacementId)
        {
            _gameId = gameId;
            _rewardedPlacementId = rewardedPlacementId;
            _consecutiveFailures = 0;
        }

        public void Initialize(Action<bool> onInitialized)
        {
            _onInitializedCallback = onInitialized;

            if (Advertisement.isInitialized)
            {
                IsInitialized = true;
                onInitialized?.Invoke(true);
                return;
            }

#if UNITY_EDITOR || DEBUG
            bool testMode = true;
#else
            bool testMode = false;
#endif
            Advertisement.Initialize(_gameId, testMode, this);
        }

        public void LoadRewardedAd()
        {
            if (!IsInitialized)
            {
                Debug.LogWarning("[UnityAds] SDK가 초기화되지 않아 광고를 로드할 수 없음");
                return;
            }
            Advertisement.Load(_rewardedPlacementId, this);
        }

        public void ShowRewardedAd(string triggerPointId, Action<AdResult> onComplete)
        {
            _onCompleteCallback = onComplete;

            if (!_isAdLoaded)
            {
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.NotReady,
                    ErrorMessage = "Unity Ads 광고가 준비되지 않았습니다.",
                    AdNetworkName = "UnityAds"
                });
                return;
            }

            Advertisement.Show(_rewardedPlacementId, this);
        }

        public bool IsRewardedAdReady() => _isAdLoaded;

        public void SetUserConsent(bool consent)
        {
            var metaData = new MetaData("gdpr");
            metaData.Set("consent", consent ? "true" : "false");
            Advertisement.SetMetaData(metaData);

            var privacyMetaData = new MetaData("privacy");
            privacyMetaData.Set("consent", consent ? "true" : "false");
            Advertisement.SetMetaData(privacyMetaData);
        }

        // --- IUnityAdsInitializationListener ---

        public void OnInitializationComplete()
        {
            IsInitialized = true;
            Debug.Log("[UnityAds] SDK 초기화 완료");
            _onInitializedCallback?.Invoke(true);
        }

        public void OnInitializationFailed(UnityAdsInitializationError error, string message)
        {
            IsInitialized = false;
            Debug.LogError($"[UnityAds] SDK 초기화 실패: {error} - {message}");
            _onInitializedCallback?.Invoke(false);
        }

        // --- IUnityAdsLoadListener ---

        public void OnUnityAdsAdLoaded(string placementId)
        {
            _isAdLoaded = true;
            _consecutiveFailures = 0;
            Debug.Log($"[UnityAds] 광고 로드 완료: {placementId}");
        }

        public void OnUnityAdsFailedToLoad(
            string placementId, UnityAdsLoadError error, string message)
        {
            _isAdLoaded = false;
            _consecutiveFailures++;
            Debug.LogError($"[UnityAds] 광고 로드 실패: {error} - {message}");
        }

        // --- IUnityAdsShowListener ---

        public void OnUnityAdsShowComplete(
            string placementId, UnityAdsShowCompletionState showCompletionState)
        {
            if (showCompletionState == UnityAdsShowCompletionState.COMPLETED)
            {
                _onCompleteCallback?.Invoke(new AdResult
                {
                    Type = AdResultType.Success,
                    AdNetworkName = "UnityAds"
                });
            }
            else
            {
                _onCompleteCallback?.Invoke(new AdResult
                {
                    Type = AdResultType.UserCancelled,
                    ErrorMessage = "사용자가 광고를 건너뛰었습니다.",
                    AdNetworkName = "UnityAds"
                });
            }

            _isAdLoaded = false;
            LoadRewardedAd(); // 다음 광고 미리 로드
        }

        public void OnUnityAdsShowFailure(
            string placementId, UnityAdsShowError error, string message)
        {
            _consecutiveFailures++;
            _onCompleteCallback?.Invoke(new AdResult
            {
                Type = AdResultType.Failed,
                ErrorMessage = $"{error}: {message}",
                AdNetworkName = "UnityAds"
            });

            _isAdLoaded = false;
            LoadRewardedAd();
        }

        public void OnUnityAdsShowStart(string placementId)
        {
            Debug.Log($"[UnityAds] 광고 재생 시작: {placementId}");
        }

        public void OnUnityAdsShowClick(string placementId)
        {
            Debug.Log($"[UnityAds] 광고 클릭: {placementId}");
        }

        public void Dispose()
        {
            _isAdLoaded = false;
        }
    }
}
```

---

## 5. 에디터 테스트용 Mock 광고 서비스

### 5.1 체크리스트

- [ ] **EditorAdsService 구현체 작성**
  - 구현 설명: Unity Editor 환경에서 실제 광고 SDK 없이 광고 흐름을 테스트하기 위한 Mock 서비스. 설정 가능한 딜레이와 성공/실패 시뮬레이션을 제공한다.
  - 필요한 클래스/메서드:
    - `EditorAdsService : IAdsService`
    - `SimulateAdDelay` -- 광고 시청 시뮬레이션 딜레이 (기본 2초)
    - `SimulateFailure` -- 실패 시뮬레이션 활성화 플래그
    - `FailureRate` -- 실패 확률 (0~1, 기본 0.1)
  - 예상 난이도: **하**
  - 의존성: `IAdsService`

```csharp
#if UNITY_EDITOR
namespace HexaMerge.Ads.Platform
{
    using HexaMerge.Ads.Core;
    using System;
    using System.Collections;
    using UnityEngine;

    /// <summary>
    /// Unity Editor 환경에서 광고 흐름을 테스트하기 위한 Mock 서비스.
    /// 설계문서 1.5.3: EditorAdsService (에디터 테스트용).
    /// </summary>
    public class EditorAdsService : IAdsService
    {
        public bool IsInitialized { get; private set; }

        /// <summary>광고 시뮬레이션 딜레이 (초). 실제 광고 15~30초를 축약.</summary>
        public float SimulateAdDelay { get; set; } = 2f;

        /// <summary>실패 시뮬레이션 활성화 여부.</summary>
        public bool SimulateFailure { get; set; } = false;

        /// <summary>실패 확률 (0~1). SimulateFailure=true일 때 적용.</summary>
        public float FailureRate { get; set; } = 0.1f;

        private bool _isAdReady;

        public void Initialize(Action<bool> onInitialized)
        {
            IsInitialized = true;
            Debug.Log("[EditorAds] Mock SDK 초기화 완료");
            onInitialized?.Invoke(true);
        }

        public void LoadRewardedAd()
        {
            _isAdReady = true;
            Debug.Log("[EditorAds] Mock 광고 로드 완료");
        }

        public void ShowRewardedAd(string triggerPointId, Action<AdResult> onComplete)
        {
            if (!_isAdReady)
            {
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.NotReady,
                    ErrorMessage = "[Editor] 광고 미로드 상태",
                    AdNetworkName = "Editor"
                });
                return;
            }

            // 코루틴을 실행하기 위해 CoroutineRunner 활용
            CoroutineRunner.Instance.StartCoroutine(
                SimulateAdPlayback(triggerPointId, onComplete));
        }

        private IEnumerator SimulateAdPlayback(
            string triggerPointId, Action<AdResult> onComplete)
        {
            Debug.Log($"[EditorAds] 광고 시뮬레이션 시작 (트리거: {triggerPointId})");

            // 광고 시청 시뮬레이션 딜레이
            yield return new WaitForSecondsRealtime(SimulateAdDelay);

            bool shouldFail = SimulateFailure &&
                              UnityEngine.Random.value < FailureRate;

            if (shouldFail)
            {
                Debug.LogWarning("[EditorAds] 광고 실패 시뮬레이션");
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.Failed,
                    ErrorMessage = "[Editor] 시뮬레이션된 광고 실패",
                    AdNetworkName = "Editor"
                });
            }
            else
            {
                Debug.Log("[EditorAds] 광고 시청 완료 (시뮬레이션)");
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.Success,
                    AdNetworkName = "Editor"
                });
            }

            _isAdReady = false;
            LoadRewardedAd(); // 다음 광고 자동 로드
        }

        public bool IsRewardedAdReady() => _isAdReady;

        public void SetUserConsent(bool consent)
        {
            Debug.Log($"[EditorAds] 사용자 동의 설정: {consent}");
        }

        public void Dispose()
        {
            _isAdReady = false;
        }
    }
}
#endif
```

---

## 6. 보상형 광고 트리거 포인트 구현 (T1~T6)

설계문서 1.2에 정의된 6개의 보상형 광고 트리거 포인트를 각각 구현한다.

### 6.0 트리거 기반 클래스

- [ ] **AdTriggerBase 추상 클래스 작성**
  - 구현 설명: 모든 광고 트리거의 공통 기능(광고 가능 여부 확인, 광고 요청, 보상 지급 위임)을 정의하는 추상 기반 클래스.
  - 필요한 클래스/메서드:
    - `AdTriggerBase : MonoBehaviour` (추상)
    - `abstract AdTriggerType TriggerType { get; }` -- 트리거 유형 반환
    - `virtual bool CanTrigger()` -- 광고 시청 조건 충족 확인
    - `RequestAdReward()` -- `AdRewardManager.RequestAd()` 호출
    - `abstract void OnRewardGranted()` -- 보상 지급 시 호출 (하위 클래스 구현)
    - `abstract void OnRewardFailed()` -- 보상 실패 시 호출 (하위 클래스 구현)
    - `UpdateButtonState()` -- UI 버튼 활성화/비활성화 갱신
  - 예상 난이도: **중**
  - 의존성: `AdRewardManager`, `AdTriggerType`

```csharp
namespace HexaMerge.Ads.Triggers
{
    using HexaMerge.Ads.Core;
    using UnityEngine;
    using UnityEngine.UI;

    /// <summary>
    /// 광고 트리거의 공통 기반 클래스.
    /// 각 트리거 포인트(T1~T6)는 이 클래스를 상속하여 구체적인 보상 로직을 구현한다.
    /// </summary>
    public abstract class AdTriggerBase : MonoBehaviour
    {
        [SerializeField] protected Button _adButton;
        [SerializeField] protected GameObject _adButtonRoot;

        /// <summary>이 트리거의 유형을 반환한다.</summary>
        public abstract AdTriggerType TriggerType { get; }

        protected virtual void Update()
        {
            UpdateButtonState();
        }

        /// <summary>
        /// 이 트리거에서 광고 시청이 가능한지 확인한다.
        /// 하위 클래스에서 추가 조건을 오버라이드할 수 있다.
        /// </summary>
        public virtual bool CanTrigger()
        {
            return AdRewardManager.Instance != null &&
                   AdRewardManager.Instance.IsAdAvailable(TriggerType);
        }

        /// <summary>광고 시청을 요청한다.</summary>
        public void RequestAdReward()
        {
            if (!CanTrigger())
            {
                Debug.Log($"[AdTrigger] {TriggerType} 광고 시청 불가");
                return;
            }

            AdRewardManager.Instance.RequestAd(TriggerType, success =>
            {
                if (success)
                    OnRewardGranted();
                else
                    OnRewardFailed();
            });
        }

        /// <summary>보상 지급 성공 시 호출. 하위 클래스에서 구현.</summary>
        protected abstract void OnRewardGranted();

        /// <summary>보상 지급 실패 시 호출. 하위 클래스에서 구현.</summary>
        protected abstract void OnRewardFailed();

        /// <summary>광고 버튼의 활성화/비활성화 상태를 갱신한다.</summary>
        protected virtual void UpdateButtonState()
        {
            if (_adButtonRoot != null)
                _adButtonRoot.SetActive(CanTrigger());
        }
    }
}
```

---

### 6.1 T1 - 게임 오버 후 "이어하기"

- [ ] **ContinueAdTrigger 구현**
  - 구현 설명: 게임 오버 시 노출되는 "이어하기" 광고 트리거. 광고 시청 완료 시 보드 상태를 유지한 채 게임을 계속할 수 있다. 게임당 1회만 사용 가능하며 쿨다운이 없다.
  - 필요한 클래스/메서드:
    - `ContinueAdTrigger : AdTriggerBase`
    - `OnRewardGranted()` -- `GameManager.ContinueGame()` 호출
    - `OnRewardFailed()` -- 게임오버 화면 유지
    - `CanTrigger()` -- 게임당 1회 제한 체크 추가
  - 예상 난이도: **중**
  - 의존성: `AdTriggerBase`, `GameManager`

```csharp
namespace HexaMerge.Ads.Triggers
{
    using HexaMerge.Ads.Core;
    using UnityEngine;

    /// <summary>
    /// T1: 게임 오버 후 이어하기 광고 트리거.
    /// 설계문서: 게임 오버 시 1회 이어하기 (보드 유지). 우선순위 높음.
    /// 쿨다운 없음, 게임당 1회 제한.
    /// </summary>
    public class ContinueAdTrigger : AdTriggerBase
    {
        public override AdTriggerType TriggerType => AdTriggerType.T1_Continue;

        private bool _hasUsedThisGame;

        /// <summary>새 게임 시작 시 호출하여 사용 횟수를 초기화한다.</summary>
        public void ResetForNewGame()
        {
            _hasUsedThisGame = false;
        }

        public override bool CanTrigger()
        {
            // 게임당 1회 제한
            if (_hasUsedThisGame) return false;
            return base.CanTrigger();
        }

        protected override void OnRewardGranted()
        {
            _hasUsedThisGame = true;
            Debug.Log("[T1] 이어하기 보상 지급: 보드 유지, 게임 계속");
            // GameManager.Instance.ContinueGame();
        }

        protected override void OnRewardFailed()
        {
            Debug.Log("[T1] 이어하기 광고 실패: 게임오버 화면 유지");
        }
    }
}
```

---

### 6.2 T2 - 힌트 충전

- [ ] **HintAdTrigger 구현**
  - 구현 설명: 힌트가 0개일 때 노출되는 광고 트리거. 광고 시청 완료 시 힌트 3개를 즉시 지급한다. 힌트 최대 보유량(10개)을 초과하지 않도록 클램핑한다.
  - 필요한 클래스/메서드:
    - `HintAdTrigger : AdTriggerBase`
    - `OnRewardGranted()` -- `PlayerInventory.AddHints(3)` 호출
    - `CanTrigger()` -- 힌트가 0개일 때만 활성화
  - 예상 난이도: **하**
  - 의존성: `AdTriggerBase`, `PlayerInventory`

```csharp
namespace HexaMerge.Ads.Triggers
{
    using HexaMerge.Ads.Core;
    using UnityEngine;

    /// <summary>
    /// T2: 힌트 충전 광고 트리거.
    /// 설계문서: 힌트 0개일 때 -> 힌트 3개 지급. 우선순위 높음.
    /// 힌트 최대 보유량 10개, 자연 회복 10분당 1개.
    /// </summary>
    public class HintAdTrigger : AdTriggerBase
    {
        public override AdTriggerType TriggerType => AdTriggerType.T2_Hint;

        private const int HINT_REWARD_AMOUNT = 3;
        private const int HINT_MAX_CAPACITY = 10;

        public override bool CanTrigger()
        {
            // 힌트가 0개일 때만 광고 버튼 표시
            // if (PlayerInventory.Instance.HintCount > 0) return false;
            return base.CanTrigger();
        }

        protected override void OnRewardGranted()
        {
            Debug.Log($"[T2] 힌트 보상 지급: +{HINT_REWARD_AMOUNT}개");
            // int currentHints = PlayerInventory.Instance.HintCount;
            // int newHints = Mathf.Min(currentHints + HINT_REWARD_AMOUNT, HINT_MAX_CAPACITY);
            // PlayerInventory.Instance.SetHints(newHints);
        }

        protected override void OnRewardFailed()
        {
            Debug.Log("[T2] 힌트 광고 실패");
            // UIManager.Instance?.ShowPopup("광고를 시청할 수 없습니다. 잠시 후 다시 시도해주세요.");
        }
    }
}
```

---

### 6.3 T3 - 점수 부스터 활성화

- [ ] **ScoreBoosterAdTrigger 구현**
  - 구현 설명: 스테이지 시작 전에 노출되는 광고 트리거. 광고 시청 완료 시 60초간 점수 2배 부스터를 활성화한다.
  - 필요한 클래스/메서드:
    - `ScoreBoosterAdTrigger : AdTriggerBase`
    - `OnRewardGranted()` -- `ScoreManager.ActivateBooster(2x, 60초)` 호출
    - `CanTrigger()` -- 스테이지 시작 전 상태일 때만 활성화
  - 예상 난이도: **중**
  - 의존성: `AdTriggerBase`, `ScoreManager`

```csharp
namespace HexaMerge.Ads.Triggers
{
    using HexaMerge.Ads.Core;
    using UnityEngine;

    /// <summary>
    /// T3: 점수 부스터 활성화 광고 트리거.
    /// 설계문서: 스테이지 시작 전 -> 60초간 점수 2배. 우선순위 중간.
    /// </summary>
    public class ScoreBoosterAdTrigger : AdTriggerBase
    {
        public override AdTriggerType TriggerType => AdTriggerType.T3_ScoreBooster;

        private const float BOOSTER_DURATION = 60f;
        private const int BOOSTER_MULTIPLIER = 2;

        protected override void OnRewardGranted()
        {
            Debug.Log($"[T3] 점수 부스터 활성화: {BOOSTER_MULTIPLIER}배, {BOOSTER_DURATION}초");
            // ScoreManager.Instance.ActivateBooster(BOOSTER_MULTIPLIER, BOOSTER_DURATION);
        }

        protected override void OnRewardFailed()
        {
            Debug.Log("[T3] 점수 부스터 광고 실패");
        }
    }
}
```

---

### 6.4 T4 - 특수 아이템 획득

- [ ] **ItemAdTrigger 구현**
  - 구현 설명: 아이템 슬롯이 비었을 때 노출되는 광고 트리거. 광고 시청 완료 시 랜덤 특수 아이템(셔플/폭탄/무지개 블록) 1개를 지급한다.
  - 필요한 클래스/메서드:
    - `ItemAdTrigger : AdTriggerBase`
    - `OnRewardGranted()` -- `PlayerInventory.AddRandomSpecialItem()` 호출
    - `GetRandomItemType() : SpecialItemType` -- 랜덤 아이템 타입 선택
    - `CanTrigger()` -- 아이템 슬롯이 비었을 때만 활성화
  - 예상 난이도: **중**
  - 의존성: `AdTriggerBase`, `PlayerInventory`, `SpecialItemType`

```csharp
namespace HexaMerge.Ads.Triggers
{
    using HexaMerge.Ads.Core;
    using UnityEngine;

    /// <summary>
    /// 특수 아이템 유형. 설계문서 1.3.2 기반.
    /// </summary>
    public enum SpecialItemType
    {
        Shuffle,      // 셔플: 대기 중인 헥사 블록 3개를 새로 교체
        Bomb,         // 폭탄: 선택한 셀 주변 7칸 제거
        RainbowBlock  // 무지개 블록: 어떤 색상과도 합체 가능
    }

    /// <summary>
    /// T4: 특수 아이템 획득 광고 트리거.
    /// 설계문서: 아이템 슬롯 비었을 때 -> 랜덤 특수 아이템 1개. 우선순위 중간.
    /// </summary>
    public class ItemAdTrigger : AdTriggerBase
    {
        public override AdTriggerType TriggerType => AdTriggerType.T4_SpecialItem;

        protected override void OnRewardGranted()
        {
            SpecialItemType randomItem = GetRandomItemType();
            Debug.Log($"[T4] 특수 아이템 보상 지급: {randomItem}");
            // PlayerInventory.Instance.AddItem(randomItem, 1);
        }

        protected override void OnRewardFailed()
        {
            Debug.Log("[T4] 특수 아이템 광고 실패");
        }

        /// <summary>
        /// 균등 확률로 랜덤 특수 아이템 타입을 선택한다.
        /// </summary>
        private SpecialItemType GetRandomItemType()
        {
            var values = System.Enum.GetValues(typeof(SpecialItemType));
            int index = Random.Range(0, values.Length);
            return (SpecialItemType)values.GetValue(index);
        }
    }
}
```

---

### 6.5 T5 - 일일 보너스 2배

- [ ] **DailyBonusAdTrigger 구현**
  - 구현 설명: 일일 출석 보상 수령 시 노출되는 광고 트리거. 광고 시청 완료 시 출석 보상을 2배로 지급한다.
  - 필요한 클래스/메서드:
    - `DailyBonusAdTrigger : AdTriggerBase`
    - `OnRewardGranted()` -- 출석 보상 2배 지급
    - `SetDailyRewardAmount(int amount)` -- 현재 출석 보상량 설정
    - `CanTrigger()` -- 일일 출석 보상 수령 시점에서만 활성화
  - 예상 난이도: **하**
  - 의존성: `AdTriggerBase`, `DailyRewardSystem`

```csharp
namespace HexaMerge.Ads.Triggers
{
    using HexaMerge.Ads.Core;
    using UnityEngine;

    /// <summary>
    /// T5: 일일 보너스 2배 광고 트리거.
    /// 설계문서: 일일 출석 보상 수령 시 -> 출석 보상 2배. 우선순위 낮음.
    /// </summary>
    public class DailyBonusAdTrigger : AdTriggerBase
    {
        public override AdTriggerType TriggerType => AdTriggerType.T5_DailyBonus;

        private int _baseDailyRewardAmount;

        /// <summary>
        /// 현재 일일 보상 기본 수량을 설정한다.
        /// DailyRewardSystem에서 보상 수령 시 호출한다.
        /// </summary>
        public void SetDailyRewardAmount(int amount)
        {
            _baseDailyRewardAmount = amount;
        }

        protected override void OnRewardGranted()
        {
            int bonusAmount = _baseDailyRewardAmount; // 2배 = 기본 + 추가 기본
            Debug.Log($"[T5] 일일 보너스 2배 지급: 기본 {_baseDailyRewardAmount} + " +
                      $"추가 {bonusAmount} = 총 {_baseDailyRewardAmount + bonusAmount}");
            // PlayerInventory.Instance.AddCoins(bonusAmount);
        }

        protected override void OnRewardFailed()
        {
            Debug.Log("[T5] 일일 보너스 2배 광고 실패: 기본 보상만 지급");
        }
    }
}
```

---

### 6.6 T6 - 코인 보너스

- [ ] **CoinBonusAdTrigger 구현**
  - 구현 설명: 메인 화면의 보상 버튼을 통해 접근하는 광고 트리거. 광고 시청 완료 시 코인 100개를 지급한다.
  - 필요한 클래스/메서드:
    - `CoinBonusAdTrigger : AdTriggerBase`
    - `OnRewardGranted()` -- `PlayerInventory.AddCoins(100)` 호출
  - 예상 난이도: **하**
  - 의존성: `AdTriggerBase`, `PlayerInventory`

```csharp
namespace HexaMerge.Ads.Triggers
{
    using HexaMerge.Ads.Core;
    using UnityEngine;

    /// <summary>
    /// T6: 코인 보너스 광고 트리거.
    /// 설계문서: 메인 화면 보상 버튼 -> 코인 100개. 우선순위 낮음.
    /// </summary>
    public class CoinBonusAdTrigger : AdTriggerBase
    {
        public override AdTriggerType TriggerType => AdTriggerType.T6_CoinBonus;

        private const int COIN_REWARD_AMOUNT = 100;

        protected override void OnRewardGranted()
        {
            Debug.Log($"[T6] 코인 보너스 지급: +{COIN_REWARD_AMOUNT}개");
            // PlayerInventory.Instance.AddCoins(COIN_REWARD_AMOUNT);
        }

        protected override void OnRewardFailed()
        {
            Debug.Log("[T6] 코인 보너스 광고 실패");
        }
    }
}
```

---

## 7. 쿨다운 및 일일 제한 시스템

### 7.1 체크리스트

- [ ] **AdCooldownManager 구현**
  - 구현 설명: 설계문서 1.4에 정의된 쿨다운 및 일일 제한 규칙을 관리한다. 동일 트리거 3분, 서로 다른 트리거 1분, T1 쿨다운 없음, 일일 20회 제한, UTC 00:00 리셋.
  - 필요한 클래스/메서드:
    - `AdCooldownManager`
    - `CanWatchAd() : bool` -- 일일 한도(20회) 미만 확인
    - `IsCooldownReady(AdTriggerType) : bool` -- 특정 트리거의 쿨다운 경과 확인
    - `GetRemainingCooldown(AdTriggerType) : float` -- 남은 쿨다운 시간(초) 반환
    - `RecordAdWatch(AdTriggerType)` -- 광고 시청 기록 (카운터 증가, 쿨다운 시작)
    - `GetDailyWatchCount() : int` -- 오늘 시청 횟수 반환
    - `CheckDailyReset()` -- UTC 00:00 기준 일일 리셋 확인
    - `SaveState()` / `LoadState()` -- PlayerPrefs에 상태 저장/복원
  - 예상 난이도: **중**
  - 의존성: `AdRewardConfig`, `AdTriggerType`

```csharp
namespace HexaMerge.Ads.Core
{
    using System;
    using System.Collections.Generic;
    using UnityEngine;

    /// <summary>
    /// 광고 쿨다운 및 일일 제한 관리자.
    /// 설계문서 1.4 쿨다운 규칙:
    ///   - 동일 트리거: 3분
    ///   - 서로 다른 트리거: 1분
    ///   - T1(이어하기): 쿨다운 없음 (게임당 1회)
    ///   - 일일 제한: 20회/일
    ///   - 일일 리셋: UTC 00:00
    /// </summary>
    public class AdCooldownManager
    {
        private readonly AdRewardConfig _config;

        // 트리거별 마지막 광고 시청 시각
        private readonly Dictionary<AdTriggerType, DateTime> _lastWatchTime;

        // 마지막 광고 시청 시각 (트리거 무관)
        private DateTime _lastAnyAdWatchTime;

        // 오늘의 광고 시청 횟수
        private int _dailyWatchCount;

        // 마지막 리셋 날짜 (UTC)
        private DateTime _lastResetDate;

        private const string PREFS_DAILY_COUNT = "ad_daily_count";
        private const string PREFS_LAST_RESET = "ad_last_reset_date";
        private const string PREFS_COOLDOWN_PREFIX = "ad_cooldown_";

        public AdCooldownManager(AdRewardConfig config)
        {
            _config = config;
            _lastWatchTime = new Dictionary<AdTriggerType, DateTime>();
            _lastAnyAdWatchTime = DateTime.MinValue;
            LoadState();
            CheckDailyReset();
        }

        /// <summary>일일 한도(20회) 미만인지 확인한다.</summary>
        public bool CanWatchAd()
        {
            CheckDailyReset();
            return _dailyWatchCount < _config.DailyAdLimit;
        }

        /// <summary>특정 트리거의 쿨다운이 경과했는지 확인한다.</summary>
        public bool IsCooldownReady(AdTriggerType triggerType)
        {
            // T1(이어하기)은 쿨다운 없음
            if (triggerType == AdTriggerType.T1_Continue)
                return true;

            DateTime now = DateTime.UtcNow;

            // 동일 트리거 쿨다운 체크 (3분)
            if (_lastWatchTime.TryGetValue(triggerType, out DateTime lastTriggerTime))
            {
                float sameTriggerCooldown = _config.SameTriggerCooldownSeconds; // 180초
                if ((now - lastTriggerTime).TotalSeconds < sameTriggerCooldown)
                    return false;
            }

            // 서로 다른 트리거 쿨다운 체크 (1분)
            float diffTriggerCooldown = _config.DifferentTriggerCooldownSeconds; // 60초
            if ((now - _lastAnyAdWatchTime).TotalSeconds < diffTriggerCooldown)
                return false;

            return true;
        }

        /// <summary>특정 트리거의 남은 쿨다운 시간(초)을 반환한다.</summary>
        public float GetRemainingCooldown(AdTriggerType triggerType)
        {
            if (triggerType == AdTriggerType.T1_Continue)
                return 0f;

            DateTime now = DateTime.UtcNow;
            float remaining = 0f;

            // 동일 트리거 쿨다운 남은 시간
            if (_lastWatchTime.TryGetValue(triggerType, out DateTime lastTriggerTime))
            {
                float sameCooldown = _config.SameTriggerCooldownSeconds;
                float elapsed = (float)(now - lastTriggerTime).TotalSeconds;
                remaining = Mathf.Max(remaining, sameCooldown - elapsed);
            }

            // 다른 트리거 쿨다운 남은 시간
            float diffCooldown = _config.DifferentTriggerCooldownSeconds;
            float anyElapsed = (float)(now - _lastAnyAdWatchTime).TotalSeconds;
            remaining = Mathf.Max(remaining, diffCooldown - anyElapsed);

            return Mathf.Max(0f, remaining);
        }

        /// <summary>
        /// 광고 시청을 기록한다.
        /// 일일 카운터 증가, 쿨다운 타이머 시작, 상태 저장.
        /// </summary>
        public void RecordAdWatch(AdTriggerType triggerType)
        {
            DateTime now = DateTime.UtcNow;
            _lastWatchTime[triggerType] = now;
            _lastAnyAdWatchTime = now;
            _dailyWatchCount++;
            SaveState();

            Debug.Log($"[Cooldown] 광고 시청 기록: {triggerType}, " +
                      $"오늘 {_dailyWatchCount}/{_config.DailyAdLimit}회");
        }

        /// <summary>오늘 시청 횟수를 반환한다.</summary>
        public int GetDailyWatchCount() => _dailyWatchCount;

        /// <summary>UTC 00:00 기준으로 일일 카운터를 리셋한다.</summary>
        public void CheckDailyReset()
        {
            DateTime todayUtc = DateTime.UtcNow.Date;
            if (_lastResetDate < todayUtc)
            {
                _dailyWatchCount = 0;
                _lastResetDate = todayUtc;
                _lastWatchTime.Clear();
                _lastAnyAdWatchTime = DateTime.MinValue;
                SaveState();
                Debug.Log("[Cooldown] 일일 광고 카운터 리셋 (UTC 00:00)");
            }
        }

        /// <summary>상태를 PlayerPrefs에 저장한다.</summary>
        private void SaveState()
        {
            PlayerPrefs.SetInt(PREFS_DAILY_COUNT, _dailyWatchCount);
            PlayerPrefs.SetString(PREFS_LAST_RESET,
                _lastResetDate.ToString("yyyy-MM-dd"));
            PlayerPrefs.Save();
        }

        /// <summary>PlayerPrefs에서 상태를 복원한다.</summary>
        private void LoadState()
        {
            _dailyWatchCount = PlayerPrefs.GetInt(PREFS_DAILY_COUNT, 0);

            string resetDateStr = PlayerPrefs.GetString(PREFS_LAST_RESET, "");
            if (DateTime.TryParse(resetDateStr, out DateTime parsedDate))
                _lastResetDate = parsedDate;
            else
                _lastResetDate = DateTime.MinValue;
        }
    }
}
```

---

## 8. 광고 실패 폴백 처리

### 8.1 체크리스트

- [ ] **AdFallbackHandler 구현**
  - 구현 설명: 설계문서 1.6에 정의된 광고 실패 시 폴백 흐름을 처리한다. 네트워크 오류 시 1회 재시도, 1차 SDK 실패 시 2차 SDK 전환, 최종 실패 시 코인 대체 구매 옵션 제공, 연속 3회 실패 시 광고 버튼 비활성화.
  - 필요한 클래스/메서드:
    - `AdFallbackHandler`
    - `HandleFailure(IAdsService primary, IAdsService fallback, AdTriggerType, Action<AdResult>)` -- 폴백 진입점
    - `RetryWithPrimarySDK(...)` -- 네트워크 오류 시 1회 재시도
    - `TryFallbackSDK(...)` -- 2차 SDK 전환 시도
    - `OfferCoinAlternative(AdTriggerType)` -- 코인 대체 구매 옵션 UI 표시
    - `CheckConsecutiveFailures() : bool` -- 연속 실패 횟수 확인 (3회 시 비활성화)
    - `RecordFailure()` / `ResetFailureCount()` -- 실패 카운트 관리
    - `DisableAdsForSession()` -- 해당 세션에서 광고 버튼 비활성화
  - 예상 난이도: **상**
  - 의존성: `IAdsService`, `AdTriggerType`, `AdResult`

```csharp
namespace HexaMerge.Ads.Fallback
{
    using HexaMerge.Ads.Core;
    using System;
    using UnityEngine;

    /// <summary>
    /// 광고 실패 시 폴백 처리 핸들러.
    /// 설계문서 1.6 폴백 정책:
    ///   - 1차 SDK 실패 -> 2차 SDK 자동 전환
    ///   - 2차 SDK도 실패 -> 코인 대체 구매 옵션
    ///   - 네트워크 오류 -> 1회 자동 재시도
    ///   - 연속 3회 실패 -> 해당 세션 광고 버튼 비활성화
    ///   - 실패 로그를 Analytics에 기록
    /// </summary>
    public class AdFallbackHandler
    {
        private int _consecutiveFailureCount;
        private bool _isSessionDisabled;

        private const int MAX_CONSECUTIVE_FAILURES = 3;

        /// <summary>세션에서 광고가 비활성화되었는지 여부.</summary>
        public bool IsSessionDisabled => _isSessionDisabled;

        /// <summary>
        /// 광고 실패를 처리한다. 재시도 -> 2차 SDK 전환 -> 코인 대체 순서로 진행.
        /// </summary>
        /// <param name="primaryService">1차 광고 SDK 서비스</param>
        /// <param name="fallbackService">2차 광고 SDK 서비스 (nullable)</param>
        /// <param name="triggerType">트리거 포인트 유형</param>
        /// <param name="onComplete">최종 결과 콜백</param>
        public void HandleFailure(
            IAdsService primaryService,
            IAdsService fallbackService,
            AdTriggerType triggerType,
            Action<AdResult> onComplete)
        {
            if (_isSessionDisabled)
            {
                Debug.LogWarning("[Fallback] 세션에서 광고 비활성화 상태");
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.Failed,
                    ErrorMessage = "이 세션에서 광고가 비활성화되었습니다."
                });
                return;
            }

            // 1단계: 1차 SDK 재시도 (네트워크 오류 대비 1회)
            RetryWithPrimarySDK(primaryService, triggerType, primaryResult =>
            {
                if (primaryResult.IsSuccess)
                {
                    ResetFailureCount();
                    onComplete?.Invoke(primaryResult);
                    return;
                }

                // 2단계: 2차 SDK 전환
                TryFallbackSDK(fallbackService, triggerType, fallbackResult =>
                {
                    if (fallbackResult.IsSuccess)
                    {
                        ResetFailureCount();
                        onComplete?.Invoke(fallbackResult);
                        return;
                    }

                    // 3단계: 최종 실패 처리
                    RecordFailure();
                    LogFailureToAnalytics(triggerType, fallbackResult);

                    if (_consecutiveFailureCount >= MAX_CONSECUTIVE_FAILURES)
                    {
                        DisableAdsForSession();
                    }

                    // 코인 대체 구매 옵션 제안
                    OfferCoinAlternative(triggerType);

                    onComplete?.Invoke(new AdResult
                    {
                        Type = AdResultType.Failed,
                        ErrorMessage = "모든 광고 SDK 실패. 코인 대체 옵션 제공.",
                        AdNetworkName = "Fallback"
                    });
                });
            });
        }

        /// <summary>1차 SDK로 1회 재시도한다.</summary>
        private void RetryWithPrimarySDK(
            IAdsService primaryService,
            AdTriggerType triggerType,
            Action<AdResult> onComplete)
        {
            if (primaryService == null || !primaryService.IsInitialized)
            {
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.Failed,
                    ErrorMessage = "1차 SDK를 사용할 수 없습니다."
                });
                return;
            }

            Debug.Log("[Fallback] 1차 SDK 재시도 중...");
            primaryService.LoadRewardedAd();

            // 로드 후 약간의 대기 시간이 필요할 수 있음 -> 코루틴으로 처리 권장
            // 간략화를 위해 즉시 시도
            if (primaryService.IsRewardedAdReady())
            {
                primaryService.ShowRewardedAd(triggerType.ToString(), onComplete);
            }
            else
            {
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.NotReady,
                    ErrorMessage = "1차 SDK 재시도 실패: 광고 로드 안됨"
                });
            }
        }

        /// <summary>2차 SDK로 전환하여 광고를 시도한다.</summary>
        private void TryFallbackSDK(
            IAdsService fallbackService,
            AdTriggerType triggerType,
            Action<AdResult> onComplete)
        {
            if (fallbackService == null)
            {
                Debug.Log("[Fallback] 2차 SDK 없음, 코인 대체로 이동");
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.Failed,
                    ErrorMessage = "2차 SDK가 설정되지 않았습니다."
                });
                return;
            }

            if (!fallbackService.IsInitialized)
            {
                Debug.Log("[Fallback] 2차 SDK 초기화 중...");
                fallbackService.Initialize(success =>
                {
                    if (success)
                    {
                        fallbackService.LoadRewardedAd();
                        fallbackService.ShowRewardedAd(
                            triggerType.ToString(), onComplete);
                    }
                    else
                    {
                        onComplete?.Invoke(new AdResult
                        {
                            Type = AdResultType.Failed,
                            ErrorMessage = "2차 SDK 초기화 실패"
                        });
                    }
                });
                return;
            }

            if (fallbackService.IsRewardedAdReady())
            {
                Debug.Log("[Fallback] 2차 SDK로 광고 표시");
                fallbackService.ShowRewardedAd(triggerType.ToString(), onComplete);
            }
            else
            {
                fallbackService.LoadRewardedAd();
                onComplete?.Invoke(new AdResult
                {
                    Type = AdResultType.NotReady,
                    ErrorMessage = "2차 SDK 광고 준비 안됨"
                });
            }
        }

        /// <summary>
        /// 코인으로 동일 보상을 구매하는 대체 옵션 UI를 표시한다.
        /// 설계문서: 코인 50개로 동일 보상 구매 / "나중에 다시" 버튼.
        /// </summary>
        private void OfferCoinAlternative(AdTriggerType triggerType)
        {
            int coinCost = GetCoinAlternativeCost(triggerType);
            Debug.Log($"[Fallback] 코인 대체 구매 제안: {triggerType}, 비용 {coinCost} 코인");
            // UIManager.Instance?.ShowCoinAlternativePopup(triggerType, coinCost);
        }

        /// <summary>트리거별 코인 대체 비용을 반환한다.</summary>
        private int GetCoinAlternativeCost(AdTriggerType triggerType)
        {
            // 설계문서: 코인 50개로 동일 보상 구매
            return triggerType switch
            {
                AdTriggerType.T1_Continue => 50,
                AdTriggerType.T2_Hint => 50,
                AdTriggerType.T3_ScoreBooster => 50,
                AdTriggerType.T4_SpecialItem => 50,
                AdTriggerType.T5_DailyBonus => 50,
                AdTriggerType.T6_CoinBonus => 50,
                _ => 50
            };
        }

        /// <summary>실패 횟수를 기록한다.</summary>
        private void RecordFailure()
        {
            _consecutiveFailureCount++;
            Debug.LogWarning($"[Fallback] 연속 실패: {_consecutiveFailureCount}/{MAX_CONSECUTIVE_FAILURES}");
        }

        /// <summary>실패 카운트를 초기화한다.</summary>
        public void ResetFailureCount()
        {
            _consecutiveFailureCount = 0;
        }

        /// <summary>
        /// 해당 세션에서 광고 버튼을 비활성화한다.
        /// 설계문서: 연속 3회 실패 시 해당 세션에서 광고 버튼 비활성화.
        /// </summary>
        private void DisableAdsForSession()
        {
            _isSessionDisabled = true;
            Debug.LogWarning("[Fallback] 연속 3회 실패: 이 세션에서 광고 버튼 비활성화");
            // UIManager.Instance?.DisableAllAdButtons();
        }

        /// <summary>실패 로그를 Firebase Analytics에 기록한다.</summary>
        private void LogFailureToAnalytics(AdTriggerType triggerType, AdResult result)
        {
            Debug.Log($"[Analytics] 광고 실패 기록: trigger={triggerType}, " +
                      $"error={result.ErrorMessage}, network={result.AdNetworkName}");
            // AnalyticsManager.LogEvent("ad_load_failed", new Dictionary<string, object>
            // {
            //     { "trigger_point", triggerType.ToString() },
            //     { "error_message", result.ErrorMessage },
            //     { "ad_network", result.AdNetworkName }
            // });
        }
    }
}
```

---

## 9. 오프라인 대체 처리

### 9.1 체크리스트

- [ ] **NetworkReachabilityChecker 구현**
  - 구현 설명: 네트워크 연결 상태를 실시간으로 감지하고 상태 변경 시 이벤트를 발행한다. `Application.internetReachability`를 주기적으로 폴링하여 온라인/오프라인 전환을 감지한다.
  - 필요한 클래스/메서드:
    - `NetworkReachabilityChecker : MonoBehaviour` (싱글턴)
    - `static bool IsOnline { get; }` -- 현재 네트워크 연결 여부
    - `static event Action<bool> OnNetworkStatusChanged` -- 상태 변경 이벤트
    - `CheckInterval` -- 폴링 간격 (기본 3초)
  - 예상 난이도: **하**
  - 의존성: 없음

```csharp
namespace HexaMerge.Ads.Fallback
{
    using UnityEngine;
    using System;
    using System.Collections;

    /// <summary>
    /// 네트워크 연결 상태를 감지하는 유틸리티.
    /// 설계문서 1.7: 오프라인 시 광고 처리의 기반.
    /// </summary>
    public class NetworkReachabilityChecker : MonoBehaviour
    {
        public static NetworkReachabilityChecker Instance { get; private set; }

        /// <summary>현재 네트워크 연결 여부.</summary>
        public static bool IsOnline { get; private set; }

        /// <summary>네트워크 상태 변경 시 발행되는 이벤트 (true=온라인).</summary>
        public static event Action<bool> OnNetworkStatusChanged;

        [SerializeField] private float _checkInterval = 3f;

        private NetworkReachability _lastReachability;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            _lastReachability = Application.internetReachability;
            IsOnline = _lastReachability != NetworkReachability.NotReachable;

            StartCoroutine(CheckNetworkRoutine());
        }

        private IEnumerator CheckNetworkRoutine()
        {
            while (true)
            {
                yield return new WaitForSecondsRealtime(_checkInterval);

                var currentReachability = Application.internetReachability;
                if (currentReachability != _lastReachability)
                {
                    _lastReachability = currentReachability;
                    bool wasOnline = IsOnline;
                    IsOnline = currentReachability != NetworkReachability.NotReachable;

                    if (wasOnline != IsOnline)
                    {
                        Debug.Log($"[Network] 상태 변경: {(IsOnline ? "온라인" : "오프라인")}");
                        OnNetworkStatusChanged?.Invoke(IsOnline);
                    }
                }
            }
        }
    }
}
```

---

- [ ] **OfflineAdHandler 구현**
  - 구현 설명: 설계문서 1.7에 정의된 오프라인 시 광고 처리를 담당한다. 오프라인 상태에서 광고 버튼 숨김, 코인 대체 보상(1.5배 가격) 제공, 온라인 복귀 시 자동 광고 미리 로드 및 버튼 재활성화를 수행한다.
  - 필요한 클래스/메서드:
    - `OfflineAdHandler : MonoBehaviour`
    - `OnNetworkStatusChanged(bool isOnline)` -- 네트워크 상태 변경 리스너
    - `HideAdButtons()` -- 모든 광고 버튼 숨김 + "오프라인 상태" 툴팁
    - `ShowAdButtons()` -- 광고 버튼 재활성화
    - `OfferOfflineCoinPurchase(AdTriggerType)` -- 오프라인 코인 대체 보상 (1.5배 가격)
    - `ReloadAdsOnReconnect()` -- 온라인 복귀 시 광고 미리 로드
  - 예상 난이도: **중**
  - 의존성: `NetworkReachabilityChecker`, `AdRewardManager`

```csharp
namespace HexaMerge.Ads.Fallback
{
    using HexaMerge.Ads.Core;
    using UnityEngine;
    using System.Collections.Generic;

    /// <summary>
    /// 오프라인 시 광고 대체 처리.
    /// 설계문서 1.7 오프라인 시 광고 처리:
    ///   - 완전 오프라인: 광고 버튼 숨김, "오프라인 상태" 툴팁
    ///   - 오프라인 -> 온라인 복귀: 자동 광고 미리 로드, 버튼 재활성화
    ///   - 오프라인 대체 보상: 코인으로 보상 구매 가능 (가격 1.5배)
    /// </summary>
    public class OfflineAdHandler : MonoBehaviour
    {
        [SerializeField] private List<GameObject> _adButtonRoots;
        [SerializeField] private GameObject _offlineTooltip;

        /// <summary>오프라인 시 코인 가격 배율. 설계문서: 1.5배.</summary>
        private const float OFFLINE_PRICE_MULTIPLIER = 1.5f;

        private void OnEnable()
        {
            NetworkReachabilityChecker.OnNetworkStatusChanged += OnNetworkStatusChanged;
        }

        private void OnDisable()
        {
            NetworkReachabilityChecker.OnNetworkStatusChanged -= OnNetworkStatusChanged;
        }

        /// <summary>네트워크 상태 변경 시 호출된다.</summary>
        private void OnNetworkStatusChanged(bool isOnline)
        {
            if (isOnline)
            {
                ShowAdButtons();
                ReloadAdsOnReconnect();
            }
            else
            {
                HideAdButtons();
            }
        }

        /// <summary>모든 광고 버튼을 숨기고 오프라인 툴팁을 표시한다.</summary>
        private void HideAdButtons()
        {
            Debug.Log("[OfflineAd] 오프라인 감지: 광고 버튼 숨김");
            foreach (var buttonRoot in _adButtonRoots)
            {
                if (buttonRoot != null)
                    buttonRoot.SetActive(false);
            }

            if (_offlineTooltip != null)
                _offlineTooltip.SetActive(true);
        }

        /// <summary>광고 버튼을 재활성화하고 오프라인 툴팁을 숨긴다.</summary>
        private void ShowAdButtons()
        {
            Debug.Log("[OfflineAd] 온라인 복귀: 광고 버튼 재활성화");
            foreach (var buttonRoot in _adButtonRoots)
            {
                if (buttonRoot != null)
                    buttonRoot.SetActive(true);
            }

            if (_offlineTooltip != null)
                _offlineTooltip.SetActive(false);
        }

        /// <summary>온라인 복귀 시 광고를 미리 로드한다.</summary>
        private void ReloadAdsOnReconnect()
        {
            Debug.Log("[OfflineAd] 온라인 복귀 -> 광고 미리 로드 시작");
            // AdRewardManager.Instance?.ReloadAds();
        }

        /// <summary>
        /// 오프라인 시 코인으로 보상을 구매하는 옵션을 제공한다.
        /// 가격은 온라인 대비 1.5배.
        /// </summary>
        /// <param name="triggerType">보상을 받으려는 트리거 유형</param>
        public void OfferOfflineCoinPurchase(AdTriggerType triggerType)
        {
            int baseCost = 50; // 온라인 코인 대체 비용
            int offlineCost = Mathf.CeilToInt(baseCost * OFFLINE_PRICE_MULTIPLIER); // 75코인

            Debug.Log($"[OfflineAd] 오프라인 코인 대체 구매 제안: " +
                      $"{triggerType}, 비용 {offlineCost} 코인 (1.5배)");
            // UIManager.Instance?.ShowOfflinePurchasePopup(triggerType, offlineCost);
        }
    }
}
```

---

## 10. 광고 설정 ScriptableObject

### 10.1 체크리스트

- [ ] **AdRewardConfig ScriptableObject 구현**
  - 구현 설명: 광고 ID, 쿨다운 시간, 일일 제한 수 등 모든 광고 관련 설정값을 중앙 관리하는 ScriptableObject. Inspector에서 편집 가능하며 빌드별(디버그/릴리스) 설정 분리를 지원한다.
  - 필요한 클래스/메서드:
    - `AdRewardConfig : ScriptableObject`
    - 광고 단위 ID (AdMob, Unity Ads)
    - 쿨다운 설정값 (동일 트리거 3분, 다른 트리거 1분)
    - 일일 제한 (20회)
    - 보상 수량 설정 (힌트 3개, 코인 100개 등)
    - 폴백 설정 (최대 연속 실패 3회, 코인 대체 비용)
  - 예상 난이도: **하**
  - 의존성: 없음

```csharp
namespace HexaMerge.Ads.Core
{
    using UnityEngine;

    /// <summary>
    /// 광고 보상 시스템의 모든 설정값을 관리하는 ScriptableObject.
    /// 설계문서 1.1~1.7의 정책값을 Inspector에서 편집할 수 있다.
    /// 메뉴: Assets > Create > HexaMerge > Ad Reward Config
    /// </summary>
    [CreateAssetMenu(
        fileName = "AdRewardConfig",
        menuName = "HexaMerge/Ad Reward Config",
        order = 1)]
    public class AdRewardConfig : ScriptableObject
    {
        [Header("=== 광고 SDK 설정 ===")]

        [Tooltip("AdMob 보상형 광고 단위 ID (Android)")]
        public string AdMobRewardedAdUnitId = "ca-app-pub-xxx/yyy";

        [Tooltip("Unity Ads Game ID")]
        public string UnityAdsGameId = "1234567";

        [Tooltip("Unity Ads 보상형 광고 Placement ID")]
        public string UnityAdsRewardedPlacementId = "rewardedVideo";

        [Header("=== 쿨다운 설정 ===")]

        [Tooltip("동일 트리거 쿨다운 (초). 설계문서: 3분 = 180초")]
        [Range(0, 600)]
        public float SameTriggerCooldownSeconds = 180f;

        [Tooltip("서로 다른 트리거 쿨다운 (초). 설계문서: 1분 = 60초")]
        [Range(0, 300)]
        public float DifferentTriggerCooldownSeconds = 60f;

        [Header("=== 일일 제한 ===")]

        [Tooltip("일일 최대 광고 시청 횟수. 설계문서: 20회/일")]
        [Range(1, 100)]
        public int DailyAdLimit = 20;

        [Header("=== 보상 수량 ===")]

        [Tooltip("T2: 힌트 광고 보상 개수. 설계문서: 3개")]
        public int HintRewardAmount = 3;

        [Tooltip("힌트 최대 보유량. 설계문서: 10개")]
        public int HintMaxCapacity = 10;

        [Tooltip("T3: 점수 부스터 배율. 설계문서: 2배")]
        public int ScoreBoosterMultiplier = 2;

        [Tooltip("T3: 점수 부스터 지속시간 (초). 설계문서: 60초")]
        public float ScoreBoosterDuration = 60f;

        [Tooltip("T6: 코인 보너스 수량. 설계문서: 100개")]
        public int CoinBonusAmount = 100;

        [Header("=== 폴백 설정 ===")]

        [Tooltip("코인 대체 구매 비용 (온라인). 설계문서: 50코인")]
        public int CoinAlternativeCost = 50;

        [Tooltip("오프라인 코인 대체 가격 배율. 설계문서: 1.5배")]
        public float OfflinePriceMultiplier = 1.5f;

        [Tooltip("세션 내 광고 비활성화까지 연속 실패 횟수. 설계문서: 3회")]
        public int MaxConsecutiveFailures = 3;

        [Header("=== 테스트 설정 ===")]

        [Tooltip("에디터에서 광고 시뮬레이션 딜레이 (초)")]
        public float EditorSimulateDelay = 2f;

        [Tooltip("에디터에서 광고 실패 시뮬레이션 활성화")]
        public bool EditorSimulateFailure = false;

        [Tooltip("에디터에서 광고 실패 확률 (0~1)")]
        [Range(0f, 1f)]
        public float EditorFailureRate = 0.1f;
    }
}
```

---

## 11. GDPR 및 개인정보 동의

### 11.1 체크리스트

- [ ] **GDPRConsentManager 구현**
  - 구현 설명: 설계문서 1.5.2에 정의된 GDPR 동의 확인 흐름을 구현한다. Android에서는 UMP(User Messaging Platform) SDK, WebGL에서는 자체 쿠키 동의 UI를 사용한다. 동의 상태를 로컬에 저장하고 광고 SDK에 전달한다.
  - 필요한 클래스/메서드:
    - `GDPRConsentManager : MonoBehaviour`
    - `CheckConsentStatus()` -- 현재 동의 상태 확인
    - `ShowConsentForm()` -- 동의 UI 표시 (플랫폼별 분기)
    - `OnConsentResult(bool consented)` -- 동의 결과 처리
    - `SaveConsentStatus(bool)` / `LoadConsentStatus() : bool` -- PlayerPrefs 저장/로드
    - `static bool HasConsented` -- 동의 여부 프로퍼티
  - 예상 난이도: **중**
  - 의존성: `IAdsService`, UMP SDK (Android), 자체 UI (WebGL)

```csharp
namespace HexaMerge.Ads.Consent
{
    using UnityEngine;
    using System;

    /// <summary>
    /// GDPR/개인정보 동의 관리자.
    /// 설계문서 1.5.2:
    ///   - Android: UMP SDK로 GDPR 동의 확인
    ///   - WebGL: 자체 쿠키 동의 UI
    /// 동의 완료 후 광고 SDK에 동의 상태를 전달한다.
    /// </summary>
    public class GDPRConsentManager : MonoBehaviour
    {
        public static GDPRConsentManager Instance { get; private set; }

        /// <summary>사용자가 개인정보 수집에 동의했는지 여부.</summary>
        public static bool HasConsented { get; private set; }

        /// <summary>동의 결과가 확정되었을 때 발행되는 이벤트.</summary>
        public static event Action<bool> OnConsentDetermined;

        [SerializeField] private GameObject _webGLConsentPanel;

        private const string PREFS_CONSENT_STATUS = "gdpr_consent_status";
        private const string PREFS_CONSENT_CHECKED = "gdpr_consent_checked";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            CheckConsentStatus();
        }

        /// <summary>저장된 동의 상태를 확인하고, 미확인 시 동의 UI를 표시한다.</summary>
        public void CheckConsentStatus()
        {
            bool alreadyChecked = PlayerPrefs.GetInt(PREFS_CONSENT_CHECKED, 0) == 1;

            if (alreadyChecked)
            {
                HasConsented = PlayerPrefs.GetInt(PREFS_CONSENT_STATUS, 0) == 1;
                OnConsentDetermined?.Invoke(HasConsented);
                return;
            }

            ShowConsentForm();
        }

        /// <summary>플랫폼에 따라 적절한 동의 UI를 표시한다.</summary>
        public void ShowConsentForm()
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            ShowAndroidUMPConsent();
#elif UNITY_WEBGL && !UNITY_EDITOR
            ShowWebGLConsentPanel();
#else
            // 에디터에서는 자동 동의
            OnConsentResult(true);
#endif
        }

        /// <summary>Android UMP SDK를 통해 동의를 요청한다.</summary>
        private void ShowAndroidUMPConsent()
        {
            Debug.Log("[GDPR] Android UMP 동의 폼 표시");
            // 실제 구현: Google UMP SDK 호출
            // ConsentInformation.Update(...);
            // ConsentForm.Load(...);
        }

        /// <summary>WebGL 자체 동의 패널을 표시한다.</summary>
        private void ShowWebGLConsentPanel()
        {
            Debug.Log("[GDPR] WebGL 쿠키 동의 패널 표시");
            if (_webGLConsentPanel != null)
                _webGLConsentPanel.SetActive(true);
        }

        /// <summary>
        /// 동의 결과를 처리한다. UI 버튼의 onClick에서 호출.
        /// </summary>
        /// <param name="consented">동의 여부</param>
        public void OnConsentResult(bool consented)
        {
            HasConsented = consented;
            SaveConsentStatus(consented);
            OnConsentDetermined?.Invoke(consented);

            Debug.Log($"[GDPR] 동의 결과: {(consented ? "동의" : "거부")}");

            if (_webGLConsentPanel != null)
                _webGLConsentPanel.SetActive(false);
        }

        private void SaveConsentStatus(bool consented)
        {
            PlayerPrefs.SetInt(PREFS_CONSENT_STATUS, consented ? 1 : 0);
            PlayerPrefs.SetInt(PREFS_CONSENT_CHECKED, 1);
            PlayerPrefs.Save();
        }
    }
}
```

---

## 12. Analytics 이벤트 연동

### 12.1 체크리스트

- [ ] **광고 관련 Analytics 이벤트 구현**
  - 구현 설명: 설계문서 1.8 체크리스트의 "광고 관련 이벤트 Analytics 전송" 항목을 구현한다. Firebase Analytics에 광고 시청 시작, 완료, 실패, 보상 수령 이벤트를 전송한다.
  - 필요한 이벤트 목록:
    - `ad_rewarded_start` -- 광고 시청 시작 (`trigger_point`, `ad_network`)
    - `ad_rewarded_complete` -- 광고 시청 완료 (`trigger_point`, `ad_network`, `watch_count_today`)
    - `ad_reward_claimed` -- 보상 수령 (`reward_type`, `reward_amount`, `trigger_point`)
    - `ad_load_failed` -- 광고 로드 실패 (`trigger_point`, `error_message`, `ad_network`)
    - `ad_fallback_triggered` -- 폴백 발동 (`from_network`, `to_network`, `trigger_point`)
    - `ad_session_disabled` -- 세션 광고 비활성화 (`consecutive_failures`)
    - `ad_offline_coin_purchase` -- 오프라인 코인 대체 구매 (`trigger_point`, `coin_cost`)
  - 예상 난이도: **하**
  - 의존성: Firebase Analytics SDK (Android), 자체 Analytics (WebGL)

```csharp
namespace HexaMerge.Ads.Core
{
    using System.Collections.Generic;
    using UnityEngine;

    /// <summary>
    /// 광고 시스템 관련 Analytics 이벤트를 전송하는 유틸리티.
    /// 설계문서 6장 분석 및 추적에서 정의된 ad_reward_claimed 등의 이벤트를 구현한다.
    /// </summary>
    public static class AdAnalytics
    {
        /// <summary>광고 시청 시작 이벤트.</summary>
        public static void LogAdStart(AdTriggerType trigger, string adNetwork)
        {
            Log("ad_rewarded_start", new Dictionary<string, object>
            {
                { "trigger_point", trigger.ToString() },
                { "ad_network", adNetwork }
            });
        }

        /// <summary>광고 시청 완료 이벤트.</summary>
        public static void LogAdComplete(
            AdTriggerType trigger, string adNetwork, int watchCountToday)
        {
            Log("ad_rewarded_complete", new Dictionary<string, object>
            {
                { "trigger_point", trigger.ToString() },
                { "ad_network", adNetwork },
                { "watch_count_today", watchCountToday }
            });
        }

        /// <summary>보상 수령 이벤트.</summary>
        public static void LogRewardClaimed(
            AdTriggerType trigger, string rewardType, int rewardAmount)
        {
            Log("ad_reward_claimed", new Dictionary<string, object>
            {
                { "trigger_point", trigger.ToString() },
                { "reward_type", rewardType },
                { "reward_amount", rewardAmount }
            });
        }

        /// <summary>광고 로드 실패 이벤트.</summary>
        public static void LogAdFailed(
            AdTriggerType trigger, string errorMessage, string adNetwork)
        {
            Log("ad_load_failed", new Dictionary<string, object>
            {
                { "trigger_point", trigger.ToString() },
                { "error_message", errorMessage },
                { "ad_network", adNetwork }
            });
        }

        /// <summary>폴백 발동 이벤트.</summary>
        public static void LogFallbackTriggered(
            string fromNetwork, string toNetwork, AdTriggerType trigger)
        {
            Log("ad_fallback_triggered", new Dictionary<string, object>
            {
                { "from_network", fromNetwork },
                { "to_network", toNetwork },
                { "trigger_point", trigger.ToString() }
            });
        }

        /// <summary>세션 광고 비활성화 이벤트.</summary>
        public static void LogSessionDisabled(int consecutiveFailures)
        {
            Log("ad_session_disabled", new Dictionary<string, object>
            {
                { "consecutive_failures", consecutiveFailures }
            });
        }

        /// <summary>오프라인 코인 대체 구매 이벤트.</summary>
        public static void LogOfflineCoinPurchase(AdTriggerType trigger, int coinCost)
        {
            Log("ad_offline_coin_purchase", new Dictionary<string, object>
            {
                { "trigger_point", trigger.ToString() },
                { "coin_cost", coinCost }
            });
        }

        /// <summary>Analytics 이벤트를 실제 전송한다.</summary>
        private static void Log(string eventName, Dictionary<string, object> parameters)
        {
            // Firebase Analytics 또는 자체 Analytics 시스템으로 전송
            // Firebase.Analytics.FirebaseAnalytics.LogEvent(eventName, ...);

            string paramStr = "";
            foreach (var kvp in parameters)
                paramStr += $"{kvp.Key}={kvp.Value}, ";
            Debug.Log($"[AdAnalytics] {eventName}: {paramStr}");
        }
    }
}
```

---

## 13. 전체 구현 체크리스트 요약

아래는 전체 구현 항목을 난이도 및 의존성과 함께 정리한 체크리스트이다.

### 13.1 인프라 및 추상화 (1주차)

| # | 구현 항목 | 난이도 | 의존성 | 상태 |
|---|----------|--------|--------|------|
| 1 | `IAdsService` 인터페이스 정의 | 하 | 없음 | [ ] |
| 2 | `AdRewardConfig` ScriptableObject | 하 | 없음 | [ ] |
| 3 | `AdTriggerType` 열거형 정의 | 하 | 없음 | [ ] |
| 4 | `AdResult` / `AdResultType` 구조체/열거형 정의 | 하 | 없음 | [ ] |
| 5 | `NetworkReachabilityChecker` 싱글턴 | 하 | 없음 | [ ] |
| 6 | `AdCooldownManager` 쿨다운/일일제한 | 중 | #2 | [ ] |
| 7 | `AdTriggerBase` 추상 기반 클래스 | 중 | #1, #3 | [ ] |

### 13.2 플랫폼별 SDK 연동 (2주차)

| # | 구현 항목 | 난이도 | 의존성 | 상태 |
|---|----------|--------|--------|------|
| 8 | AdMob SDK 패키지 설치 및 설정 | 중 | 없음 | [ ] |
| 9 | `AdMobAdsService` 구현 (Android) | 상 | #1, #8 | [ ] |
| 10 | Unity Ads 패키지 설치 및 설정 | 하 | 없음 | [ ] |
| 11 | `UnityAdsService` 구현 (WebGL) | 상 | #1, #10 | [ ] |
| 12 | `EditorAdsService` Mock 구현 | 하 | #1 | [ ] |
| 13 | `GDPRConsentManager` 동의 관리 | 중 | #1 | [ ] |

### 13.3 보상형 광고 트리거 (3주차)

| # | 구현 항목 | 난이도 | 의존성 | 상태 |
|---|----------|--------|--------|------|
| 14 | T1 `ContinueAdTrigger` 게임 오버 이어하기 | 중 | #7, GameManager | [ ] |
| 15 | T2 `HintAdTrigger` 힌트 충전 | 하 | #7, PlayerInventory | [ ] |
| 16 | T3 `ScoreBoosterAdTrigger` 점수 부스터 | 중 | #7, ScoreManager | [ ] |
| 17 | T4 `ItemAdTrigger` 특수 아이템 획득 | 중 | #7, PlayerInventory | [ ] |
| 18 | T5 `DailyBonusAdTrigger` 일일 보너스 2배 | 하 | #7, DailyRewardSystem | [ ] |
| 19 | T6 `CoinBonusAdTrigger` 코인 보너스 | 하 | #7, PlayerInventory | [ ] |

### 13.4 핵심 매니저 및 폴백 (3~4주차)

| # | 구현 항목 | 난이도 | 의존성 | 상태 |
|---|----------|--------|--------|------|
| 20 | `AdRewardManager` 싱글턴 (중앙 조율자) | 중 | #1, #6, #9, #11, #12 | [ ] |
| 21 | `AdFallbackHandler` 광고 실패 폴백 | 상 | #1, #3, #20 | [ ] |
| 22 | `OfflineAdHandler` 오프라인 대체 처리 | 중 | #5, #20 | [ ] |
| 23 | `AdAnalytics` 이벤트 전송 | 하 | Firebase SDK | [ ] |

### 13.5 최종 검증 (4주차)

| # | 구현 항목 | 난이도 | 의존성 | 상태 |
|---|----------|--------|--------|------|
| 24 | Editor Mock으로 전체 플로우 테스트 | 중 | #12, #20 | [ ] |
| 25 | Android 실기기 AdMob 테스트 (테스트 광고 ID) | 중 | #9, #20 | [ ] |
| 26 | WebGL 빌드 Unity Ads 테스트 | 중 | #11, #20 | [ ] |
| 27 | 쿨다운/일일제한 경계값 테스트 | 하 | #6 | [ ] |
| 28 | 폴백 시나리오 테스트 (네트워크 끊기 시뮬레이션) | 중 | #21, #22 | [ ] |
| 29 | GDPR 동의 플로우 테스트 | 하 | #13 | [ ] |
| 30 | Analytics 이벤트 수신 확인 (Firebase DebugView) | 하 | #23 | [ ] |

---

### 구현 우선순위 요약

```
[1주차] 인프라/추상화       ──> #1~#7   (기반 구조)
[2주차] SDK 연동            ──> #8~#13  (플랫폼별 광고 SDK)
[3주차] 트리거 + 매니저     ──> #14~#22 (기능 구현)
[4주차] 테스트 + Analytics  ──> #23~#30 (검증 및 출시 준비)
```

### 난이도별 분류

| 난이도 | 항목 수 | 해당 항목 |
|--------|---------|----------|
| **상** | 3개 | #9 AdMobAdsService, #11 UnityAdsService, #21 AdFallbackHandler |
| **중** | 13개 | #6, #7, #8, #13, #14, #16, #17, #20, #22, #24, #25, #26, #28 |
| **하** | 14개 | #1, #2, #3, #4, #5, #10, #12, #15, #18, #19, #23, #27, #29, #30 |

---

> **참고**: 이 문서의 모든 코드 스니펫은 설계문서 `03_monetization-platform-design.md`의 섹션 1(광고 보상 시스템)에 정의된 정책과 흐름을 기반으로 작성되었다. 주석 처리된 코드(`// GameManager.Instance...` 등)는 다른 시스템의 구현에 의존하며, 해당 시스템 개발 완료 후 연결해야 한다.
