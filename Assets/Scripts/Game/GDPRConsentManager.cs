namespace HexaMerge.Game
{
    using UnityEngine;

    /// <summary>
    /// GDPR 동의 관리. PlayerPrefs 기반 영속성.
    /// 테스트에서 SendMessage('GDPRConsentManager', ...) 로 호출.
    /// </summary>
    public class GDPRConsentManager : MonoBehaviour
    {
        public static GDPRConsentManager Instance { get; private set; }

        private const string GDPR_CONSENT_KEY = "GDPRConsent";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        /// <summary>
        /// 동의 상태 초기화 (PlayerPrefs 삭제).
        /// </summary>
        public void ResetConsent(string _unused)
        {
            PlayerPrefs.DeleteKey(GDPR_CONSENT_KEY);
            PlayerPrefs.Save();
            Debug.Log("[GDPRConsentManager] Consent reset.");
        }

        /// <summary>
        /// 동의 상태 설정. "true" 또는 "false".
        /// </summary>
        public void SetConsent(string value)
        {
            bool consented = value == "true" || value == "1";
            PlayerPrefs.SetInt(GDPR_CONSENT_KEY, consented ? 1 : 0);
            PlayerPrefs.Save();
            Debug.Log("[GDPRConsentManager] Consent set to: " + consented);

            WebGLBridge.SendToJS("{\"event\":\"gdprConsentUpdated\",\"consented\":" +
                (consented ? "true" : "false") + "}");
        }

        /// <summary>
        /// GDPR 동의 상태 확인. 미설정이면 gdprConsentRequired, 있으면 gdprConsentStatus.
        /// </summary>
        public void CheckGDPRConsent(string _unused)
        {
            if (!PlayerPrefs.HasKey(GDPR_CONSENT_KEY))
            {
                Debug.Log("[GDPRConsentManager] No consent recorded - required.");
                WebGLBridge.SendToJS("{\"event\":\"gdprConsentRequired\"}");
            }
            else
            {
                bool consented = PlayerPrefs.GetInt(GDPR_CONSENT_KEY, 0) == 1;
                Debug.Log("[GDPRConsentManager] Consent status: " + consented);
                WebGLBridge.SendToJS("{\"event\":\"gdprConsentStatus\",\"consented\":" +
                    (consented ? "true" : "false") + "}");
            }
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
