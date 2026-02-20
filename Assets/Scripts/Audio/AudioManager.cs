namespace HexaMerge.Audio
{
    using UnityEngine;
    using System.Collections.Generic;

    public enum SFXType
    {
        TapSelect,
        MergeBasic,
        MergeMid,
        MergeHigh,
        MergeUltra,
        ChainCombo,
        Milestone,
        CrownChange,
        GameOver,
        GameStart,
        ButtonClick,
        TileDrop
    }

    public class AudioManager : MonoBehaviour
    {
        public static AudioManager Instance { get; private set; }

        [System.Serializable]
        public struct SFXEntry
        {
            public SFXType type;
            public AudioClip clip;
            [Range(0f, 1f)] public float volume;
        }

        [SerializeField] private SFXEntry[] sfxEntries;
        [SerializeField] private int maxSimultaneousSFX = 8;
        [SerializeField] [Range(0f, 1f)] private float masterVolume = 1f;

        private AudioSource[] sfxSources;
        private Dictionary<SFXType, SFXEntry> sfxLookup;
        private bool isMuted;

        private float bgmVolume = 0.7f;
        private float sfxVolume = 1.0f;
        private string lastPlayedSFX = "";
        private List<string> recentSFXHistory = new List<string>();

        private const string MuteKey = "AudioMuted";
        private const string VolumeKey = "MasterVolume";
        private const string BGMVolumeKey = "Audio_BGMVolume";
        private const string SFXVolumeKey = "Audio_SFXVolume";

        public bool IsMuted => isMuted;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }

            Instance = this;
            DontDestroyOnLoad(gameObject);

            sfxSources = new AudioSource[maxSimultaneousSFX];
            for (int i = 0; i < maxSimultaneousSFX; i++)
            {
                sfxSources[i] = gameObject.AddComponent<AudioSource>();
                sfxSources[i].playOnAwake = false;
            }

            sfxLookup = new Dictionary<SFXType, SFXEntry>();
            if (sfxEntries != null)
            {
                foreach (var entry in sfxEntries)
                {
                    sfxLookup[entry.type] = entry;
                }
            }

            LoadMuteState();
        }

        public void PlaySFX(SFXType type)
        {
            if (isMuted) return;

            if (!sfxLookup.TryGetValue(type, out SFXEntry entry)) return;
            if (entry.clip == null) return;

            AudioSource source = GetAvailableSource();
            if (source == null) return;

            source.clip = entry.clip;
            source.volume = entry.volume * masterVolume;
            source.Play();

            string sfxName = type.ToString();
            lastPlayedSFX = sfxName;
            recentSFXHistory.Add(sfxName);
            if (recentSFXHistory.Count > 10)
            {
                recentSFXHistory.RemoveAt(0);
            }
        }

        public static SFXType GetMergeSFXType(double resultValue)
        {
            if (resultValue <= 64) return SFXType.MergeBasic;
            if (resultValue <= 512) return SFXType.MergeMid;
            if (resultValue <= 4096) return SFXType.MergeHigh;
            return SFXType.MergeUltra;
        }

        public void ToggleMute()
        {
            isMuted = !isMuted;
            SaveMuteState();

            if (isMuted)
            {
                foreach (var source in sfxSources)
                {
                    if (source.isPlaying)
                        source.Stop();
                }
            }
        }

        public void SetMasterVolume(float vol)
        {
            masterVolume = Mathf.Clamp01(vol);
            PlayerPrefs.SetFloat(VolumeKey, masterVolume);
            PlayerPrefs.Save();
        }

        public void SetMasterVolume(string vol)
        {
            float v;
            if (float.TryParse(vol, out v))
                SetMasterVolume(v);
        }

        public void SetBGMVolume(float vol)
        {
            bgmVolume = Mathf.Clamp01(vol);
            PlayerPrefs.SetFloat(BGMVolumeKey, bgmVolume);
            PlayerPrefs.Save();
        }

        public void SetBGMVolume(string vol)
        {
            float v;
            if (float.TryParse(vol, out v))
                SetBGMVolume(v);
        }

        public void SetSFXVolume(float vol)
        {
            sfxVolume = Mathf.Clamp01(vol);
            PlayerPrefs.SetFloat(SFXVolumeKey, sfxVolume);
            PlayerPrefs.Save();
        }

        public void SetSFXVolume(string vol)
        {
            float v;
            if (float.TryParse(vol, out v))
                SetSFXVolume(v);
        }

        public void SaveAudioSettings(string _unused)
        {
            PlayerPrefs.Save();
        }

        public void PlaySFXByName(string sfxName)
        {
            SFXType type;
            try
            {
                type = (SFXType)System.Enum.Parse(typeof(SFXType), sfxName, true);
            }
            catch (System.ArgumentException)
            {
                Debug.LogWarning("[AudioManager] Unknown SFX name: " + sfxName);
                return;
            }
            PlaySFX(type);
        }

        /// <summary>
        /// 절차적 SFX 클립을 런타임에 등록합니다.
        /// 기존에 같은 타입이 있으면 덮어쓰지 않습니다.
        /// </summary>
        public void RegisterSFX(SFXType type, AudioClip clip, float volume = 0.8f)
        {
            if (clip == null) return;
            if (sfxLookup.ContainsKey(type)) return;

            var entry = new SFXEntry
            {
                type = type,
                clip = clip,
                volume = volume
            };
            sfxLookup[type] = entry;
        }

        private AudioSource GetAvailableSource()
        {
            foreach (var source in sfxSources)
            {
                if (!source.isPlaying)
                    return source;
            }

            return null;
        }

        private void LoadMuteState()
        {
            isMuted = PlayerPrefs.GetInt(MuteKey, 0) == 1;
            masterVolume = PlayerPrefs.GetFloat(VolumeKey, 1f);
            bgmVolume = PlayerPrefs.GetFloat(BGMVolumeKey, 0.7f);
            sfxVolume = PlayerPrefs.GetFloat(SFXVolumeKey, 1.0f);
        }

        /// <summary>
        /// JS 측에서 호출하여 오디오 상태를 window.__unityAudioState에 설정합니다.
        /// SendMessage('AudioManager', 'QueryAudioState') 형태로 호출.
        /// </summary>
        public void QueryAudioState()
        {
            QueryAudioState("");
        }

        public void QueryAudioState(string _unused)
        {
            int registeredCount = sfxLookup != null ? sfxLookup.Count : 0;
            int poolSize = sfxSources != null ? sfxSources.Length : 0;

            float effectiveBGM = masterVolume * bgmVolume;
            float effectiveSFX = masterVolume * sfxVolume;
            float masterDB = isMuted ? -80f : (masterVolume > 0f ? 20f * Mathf.Log10(masterVolume) : -80f);

            // Build registeredSFXNames array
            string sfxNamesArray = "[]";
            if (sfxLookup != null && sfxLookup.Count > 0)
            {
                var names = new List<string>();
                foreach (var key in sfxLookup.Keys)
                {
                    names.Add("\"" + key.ToString() + "\"");
                }
                sfxNamesArray = "[" + string.Join(",", names.ToArray()) + "]";
            }

            // Build recentSFXHistory array
            string historyArray = "[]";
            if (recentSFXHistory.Count > 0)
            {
                var items = new List<string>();
                foreach (var s in recentSFXHistory)
                {
                    items.Add("\"" + s + "\"");
                }
                historyArray = "[" + string.Join(",", items.ToArray()) + "]";
            }

            // Count active SFX channels
            int activeChannels = 0;
            if (sfxSources != null)
            {
                foreach (var src in sfxSources)
                {
                    if (src != null && src.isPlaying)
                        activeChannels++;
                }
            }

            string json = "{" +
                "\"isInitialized\":true," +
                "\"isMuted\":" + (isMuted ? "true" : "false") + "," +
                "\"masterVolume\":" + masterVolume.ToString("F2") + "," +
                "\"bgmVolume\":" + bgmVolume.ToString("F2") + "," +
                "\"sfxVolume\":" + sfxVolume.ToString("F2") + "," +
                "\"effectiveBGMVolume\":" + effectiveBGM.ToString("F2") + "," +
                "\"effectiveSFXVolume\":" + effectiveSFX.ToString("F2") + "," +
                "\"sfxPoolSize\":" + poolSize + "," +
                "\"registeredSFXCount\":" + registeredCount + "," +
                "\"registeredSFXNames\":" + sfxNamesArray + "," +
                "\"lastPlayedSFX\":\"" + lastPlayedSFX + "\"," +
                "\"recentSFXHistory\":" + historyArray + "," +
                "\"activeSFXChannels\":" + activeChannels + "," +
                "\"masterDecibelValue\":" + masterDB.ToString("F2") + "," +
                "\"isDontDestroyOnLoad\":true" +
            "}";

            HexaMerge.Game.WebGLBridge.SetJSProperty("__unityAudioState", json);
            Debug.Log("[AudioManager] QueryAudioState: " + json);
        }

        private void SaveMuteState()
        {
            PlayerPrefs.SetInt(MuteKey, isMuted ? 1 : 0);
            PlayerPrefs.Save();
        }
    }
}
