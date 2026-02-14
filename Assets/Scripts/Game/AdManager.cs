namespace HexaMerge.Game
{
    using UnityEngine;
    using System;

    /// <summary>
    /// AdMob 배너 + 보상형 광고 관리.
    /// 실제 AdMob SDK 연동 전 스텁/인터페이스 구현.
    /// 실제 SDK 연동 시 #if UNITY_ANDROID / UNITY_IOS 분기 추가.
    /// </summary>
    public enum AdRewardType { Continue, RemoveTile, UndoMove }

    public class AdManager : MonoBehaviour
    {
        public static AdManager Instance { get; private set; }

        [Header("Ad Unit IDs (Test)")]
        [SerializeField] private string bannerAdUnitId = "ca-app-pub-3940256099942544/6300978111";
        [SerializeField] private string rewardAdUnitId = "ca-app-pub-3940256099942544/5224354917";

        [Header("Settings")]
        [SerializeField] private bool showBannerOnStart = true;
        [SerializeField] private float rewardAdCooldown = 30f;

        private const string ADS_REMOVED_KEY = "AdsRemoved";

        public bool IsBannerVisible { get; private set; }
        public bool IsRewardAdReady { get; private set; }
        public bool AdsRemoved { get; private set; }

        public event Action<AdRewardType> OnRewardEarned;
        public event Action OnRewardAdFailed;

        private float lastRewardAdTime;

        // Mock 상태 (테스트용)
        private string mockAdResult = "success";
        private float mockAdDelay;
        private int dailyAdCount;
        private int consecutiveFailures;
        private bool isOffline;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            LoadAdRemovalState();
            lastRewardAdTime = -rewardAdCooldown; // 시작 시 바로 사용 가능
        }

        private void Start()
        {
            if (showBannerOnStart)
                ShowBanner();

            LoadRewardAd();

            Debug.Log("[AdManager] Initialized. Banner: " + bannerAdUnitId
                + " | Reward: " + rewardAdUnitId);
        }

        /// <summary>
        /// 배너 광고를 표시합니다. AdsRemoved 상태이면 무시합니다.
        /// </summary>
        public void ShowBanner()
        {
            if (AdsRemoved)
            {
                Debug.Log("[AdManager] Ads removed - skipping banner.");
                SendAdEvent("{\"event\":\"adsRemovedBlocked\",\"adType\":\"banner\"}");
                return;
            }

            if (isOffline)
            {
                Debug.Log("[AdManager] Offline - hiding banner.");
                SendAdEvent("{\"event\":\"bannerHidden\"}");
                return;
            }

            IsBannerVisible = true;
            Debug.Log("[AdManager] Banner shown (stub). Unit: " + bannerAdUnitId);

            SendAdEvent("{\"event\":\"bannerShown\",\"adUnitId\":\"" + bannerAdUnitId + "\"}");
        }

        /// <summary>
        /// 배너 광고를 숨깁니다.
        /// </summary>
        public void HideBanner()
        {
            IsBannerVisible = false;
            Debug.Log("[AdManager] Banner hidden (stub).");

            SendAdEvent("{\"event\":\"bannerHidden\"}");
        }

        /// <summary>
        /// 보상형 광고를 사전 로드합니다.
        /// </summary>
        public void LoadRewardAd()
        {
            if (mockAdResult == "fail")
            {
                IsRewardAdReady = false;
                consecutiveFailures++;
                Debug.Log("[AdManager] Reward ad load failed (mock). Consecutive: " + consecutiveFailures);
                SendAdEvent("{\"event\":\"rewardAdFailed\",\"reason\":\"loadFailed\"}");
                OnRewardAdFailed?.Invoke();

                if (consecutiveFailures >= 3)
                {
                    SendAdEvent("{\"event\":\"adsDisabledByFailure\",\"consecutiveFailures\":" + consecutiveFailures + "}");
                }
                return;
            }

            consecutiveFailures = 0;
            IsRewardAdReady = true;
            Debug.Log("[AdManager] Reward ad loaded (stub). Unit: " + rewardAdUnitId);

            SendAdEvent("{\"event\":\"rewardAdLoaded\",\"adUnitId\":\"" + rewardAdUnitId + "\"}");
        }

        /// <summary>
        /// 보상형 광고를 표시합니다. 쿨다운 중이면 실패합니다.
        /// </summary>
        public void ShowRewardAd(AdRewardType rewardType)
        {
            // 오프라인 체크
            if (isOffline)
            {
                Debug.Log("[AdManager] Offline - blocking reward ad.");
                SendAdEvent("{\"event\":\"adOfflineBlocked\",\"adType\":\"reward\"}");
                return;
            }

            // 일일 광고 한도 체크 (20회)
            if (dailyAdCount >= 20)
            {
                Debug.Log("[AdManager] Daily ad limit reached: " + dailyAdCount);
                SendAdEvent("{\"event\":\"dailyLimitReached\",\"dailyAdCount\":" + dailyAdCount + "}");
                return;
            }

            // 쿨다운 체크
            float timeSinceLast = Time.realtimeSinceStartup - lastRewardAdTime;
            if (timeSinceLast < rewardAdCooldown)
            {
                int remaining = Mathf.CeilToInt(rewardAdCooldown - timeSinceLast);
                Debug.Log("[AdManager] Reward ad on cooldown. " + remaining + "s remaining.");
                SendAdEvent("{\"event\":\"rewardAdCooldown\",\"remainingSeconds\":" + remaining + "}");
                OnRewardAdFailed?.Invoke();
                return;
            }

            if (!IsRewardAdReady)
            {
                Debug.Log("[AdManager] Reward ad not ready.");
                SendAdEvent("{\"event\":\"rewardAdFailed\",\"reason\":\"notReady\"}");
                OnRewardAdFailed?.Invoke();
                return;
            }

            SimulateRewardAd(rewardType);
        }

        /// <summary>
        /// 광고 제거 (IAP 연동). 배너를 즉시 숨기고 상태를 저장합니다.
        /// </summary>
        public void RemoveAds()
        {
            AdsRemoved = true;
            HideBanner();
            SaveAdRemovalState();
            Debug.Log("[AdManager] Ads permanently removed.");

            SendAdEvent("{\"event\":\"adsRemoved\"}");
        }

        /// <summary>
        /// 스텁 구현: 실제 SDK 없이 보상형 광고 시뮬레이션.
        /// 실제 구현 시 이 메서드를 SDK 콜백으로 교체합니다.
        /// </summary>
        private void SimulateRewardAd(AdRewardType rewardType)
        {
            Debug.Log("[AdManager] Simulating reward ad for: " + rewardType);

            IsRewardAdReady = false;

            if (mockAdResult == "cancel")
            {
                Debug.Log("[AdManager] Reward ad cancelled (mock).");
                SendAdEvent("{\"event\":\"rewardAdCancelled\",\"rewardType\":\"" + rewardType + "\"}");
                LoadRewardAd();
                return;
            }

            // 성공 시에만 쿨다운 시작
            lastRewardAdTime = Time.realtimeSinceStartup;

            // 시뮬레이션: 성공으로 처리
            Debug.Log("[AdManager] Reward earned: " + rewardType);
            OnRewardEarned?.Invoke(rewardType);
            dailyAdCount++;

            // 보상 적용
            ApplyReward(rewardType);

            SendAdEvent("{\"event\":\"rewardGranted\",\"rewardType\":\"" + rewardType + "\"}");
            SendAdEvent("{\"event\":\"rewardAdClosed\",\"rewardType\":\"" + rewardType + "\"}");

            // 다음 광고 사전 로드
            LoadRewardAd();
        }

        /// <summary>
        /// 보상 유형에 따라 게임 상태를 변경합니다.
        /// </summary>
        private void ApplyReward(AdRewardType rewardType)
        {
            switch (rewardType)
            {
                case AdRewardType.Continue:
                    if (GameManager.Instance != null)
                        GameManager.Instance.ContinueAfterGameOver();
                    break;
                case AdRewardType.RemoveTile:
                    if (GameManager.Instance != null)
                        GameManager.Instance.RemoveRandomTile();
                    break;
                case AdRewardType.UndoMove:
                    // UndoMove 는 스텁 (Undo 시스템 미구현)
                    Debug.Log("[AdManager] UndoMove reward - stub (no-op).");
                    break;
            }
        }

        /// <summary>
        /// WebGLBridge를 통해 광고 이벤트를 JS로 전송합니다.
        /// </summary>
        private void SendAdEvent(string json)
        {
            WebGLBridge.SendToJS(json);
        }

        #region SendMessage Bridge Methods (Playwright 테스트용)

        // Unity SendMessage는 string 파라미터만 지원하므로 래퍼 제공

        /// <summary>광고 시스템 초기화 (테스트에서 명시적 호출)</summary>
        public void InitializeAds(string _unused)
        {
            LoadAdRemovalState();
            lastRewardAdTime = -rewardAdCooldown;
            IsRewardAdReady = false;
            mockAdResult = "success";
            consecutiveFailures = 0;

            LoadRewardAd();
            Debug.Log("[AdManager] InitializeAds called from bridge.");

            SendAdEvent("{\"event\":\"adInitialized\",\"stubMode\":true,\"adsRemoved\":" +
                (AdsRemoved ? "true" : "false") + "}");
        }

        /// <summary>보상형 광고 로드 (SendMessage 래퍼)</summary>
        public void LoadRewardedAd(string _unused)
        {
            LoadRewardAd();
        }

        /// <summary>보상형 광고 표시 (SendMessage 래퍼, rewardType 문자열)</summary>
        public void ShowRewardedAd(string rewardType)
        {
            AdRewardType type = AdRewardType.Continue;
            if (!string.IsNullOrEmpty(rewardType) && System.Enum.IsDefined(typeof(AdRewardType), rewardType))
            {
                type = (AdRewardType)System.Enum.Parse(typeof(AdRewardType), rewardType);
            }
            ShowRewardAd(type);
        }

        /// <summary>쿨다운 초기화 (테스트용)</summary>
        public void ResetAllCooldowns(string _unused)
        {
            lastRewardAdTime = -rewardAdCooldown;
            Debug.Log("[AdManager] All cooldowns reset.");
        }

        /// <summary>시간 전진 시뮬레이션 (테스트용)</summary>
        public void AdvanceTime(string seconds)
        {
            if (float.TryParse(seconds, out float sec))
            {
                lastRewardAdTime -= sec;
                Debug.Log("[AdManager] Time advanced by " + sec + "s.");
            }
        }

        /// <summary>광고 제거 상태 직접 설정 (테스트용)</summary>
        public void SetAdsRemoved(string value)
        {
            AdsRemoved = value == "true" || value == "1";
            if (AdsRemoved)
                HideBanner();
            SaveAdRemovalState();
            Debug.Log("[AdManager] AdsRemoved set to " + AdsRemoved);
        }

        /// <summary>Mock 광고 결과 설정 (success/cancel/fail)</summary>
        public void SetMockAdResult(string result)
        {
            mockAdResult = result;
            Debug.Log("[AdManager] Mock ad result set to: " + result);
        }

        /// <summary>Mock 광고 딜레이 설정</summary>
        public void SetMockAdDelay(string delay)
        {
            if (float.TryParse(delay, out float d))
                mockAdDelay = d;
            Debug.Log("[AdManager] Mock ad delay set to: " + delay);
        }

        /// <summary>일일 광고 카운트 설정 (테스트용)</summary>
        public void SetDailyAdCount(string count)
        {
            if (int.TryParse(count, out int c))
                dailyAdCount = c;
            Debug.Log("[AdManager] Daily ad count set to: " + count);
        }

        /// <summary>일일 광고 카운트 리셋 (테스트용)</summary>
        public void ResetDailyAdCount(string _unused)
        {
            dailyAdCount = 0;
            Debug.Log("[AdManager] Daily ad count reset.");
        }

        /// <summary>UTC 자정 시뮬레이션 (테스트용)</summary>
        public void SimulateUTCMidnight(string _unused)
        {
            dailyAdCount = 0;
            Debug.Log("[AdManager] UTC midnight simulated.");
        }

        /// <summary>연속 실패 횟수 설정 (테스트용)</summary>
        public void SetConsecutiveFailures(string count)
        {
            if (int.TryParse(count, out int c))
                consecutiveFailures = c;
            Debug.Log("[AdManager] Consecutive failures set to: " + count);
        }

        /// <summary>오프라인 시뮬레이션 (테스트용)</summary>
        public void SimulateOffline(string value)
        {
            isOffline = value == "true" || value == "1";
            Debug.Log("[AdManager] SimulateOffline: " + isOffline);

            if (isOffline && IsBannerVisible)
            {
                IsBannerVisible = false;
                SendAdEvent("{\"event\":\"bannerHidden\"}");
            }
        }

        /// <summary>GDPR 동의 확인 - GDPRConsentManager에 위임</summary>
        public void CheckGDPRConsent(string _unused)
        {
            Debug.Log("[AdManager] GDPR consent check - delegating to GDPRConsentManager.");
            if (GDPRConsentManager.Instance != null)
            {
                GDPRConsentManager.Instance.CheckGDPRConsent(_unused);
            }
            else
            {
                Debug.LogWarning("[AdManager] GDPRConsentManager not found.");
                SendAdEvent("{\"event\":\"gdprConsentStatus\",\"consented\":true}");
            }
        }

        /// <summary>광고 상태 조회 (테스트용)</summary>
        public void QueryAdState(string callbackId)
        {
            string json = "{" +
                "\"callbackId\":\"" + callbackId + "\"," +
                "\"isBannerVisible\":" + (IsBannerVisible ? "true" : "false") + "," +
                "\"isRewardAdReady\":" + (IsRewardAdReady ? "true" : "false") + "," +
                "\"adsRemoved\":" + (AdsRemoved ? "true" : "false") + "," +
                "\"dailyAdCount\":" + dailyAdCount + "," +
                "\"consecutiveFailures\":" + consecutiveFailures +
            "}";
            WebGLBridge.SendToJS(json);
        }

        #endregion

        private void SaveAdRemovalState()
        {
            PlayerPrefs.SetInt(ADS_REMOVED_KEY, AdsRemoved ? 1 : 0);
            PlayerPrefs.Save();
        }

        private void LoadAdRemovalState()
        {
            AdsRemoved = PlayerPrefs.GetInt(ADS_REMOVED_KEY, 0) == 1;
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                Instance = null;
            }
        }
    }
}
