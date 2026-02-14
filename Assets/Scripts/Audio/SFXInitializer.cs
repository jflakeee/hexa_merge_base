namespace HexaMerge.Audio
{
    using UnityEngine;
    using System.Collections.Generic;

    /// <summary>
    /// 게임 시작 시 ProceduralSFX로 모든 효과음을 생성하고
    /// AudioManager에 자동 등록합니다.
    /// DefaultExecutionOrder(-100)으로 AudioManager보다 먼저 실행됩니다.
    /// </summary>
    [DefaultExecutionOrder(-100)]
    public class SFXInitializer : MonoBehaviour
    {
        /// <summary>
        /// 생성된 클립을 보관하는 static 프로퍼티.
        /// AudioManager가 아직 초기화되지 않은 경우 여기서 가져갈 수 있습니다.
        /// </summary>
        public static Dictionary<SFXType, AudioClip> GeneratedClips { get; private set; }

        /// <summary>초기화 완료 여부</summary>
        public static bool IsReady { get; private set; }

        private void Awake()
        {
            if (GeneratedClips != null)
            {
                // 이미 생성된 경우 중복 생성 방지
                return;
            }

            GeneratedClips = ProceduralSFX.GenerateAllSFX();
            IsReady = true;

            Debug.Log("[SFXInitializer] 절차적 SFX " + GeneratedClips.Count + "개 생성 완료");

            // AudioManager가 이미 존재하면 즉시 등록
            TryRegisterToAudioManager();
        }

        private void Start()
        {
            // Awake에서 AudioManager가 없었을 경우 Start에서 재시도
            TryRegisterToAudioManager();
        }

        /// <summary>
        /// AudioManager.Instance가 존재하면 생성된 클립을 등록합니다.
        /// </summary>
        private void TryRegisterToAudioManager()
        {
            if (GeneratedClips == null) return;
            if (AudioManager.Instance == null) return;

            RegisterClips(AudioManager.Instance, GeneratedClips);
        }

        /// <summary>
        /// AudioManager에 절차적 SFX 클립을 등록합니다.
        /// 기존 sfxLookup 딕셔너리에 직접 접근하여 등록합니다.
        /// </summary>
        private static void RegisterClips(AudioManager manager, Dictionary<SFXType, AudioClip> clips)
        {
            if (manager == null || clips == null) return;

            foreach (var kvp in clips)
            {
                manager.RegisterSFX(kvp.Key, kvp.Value);
            }

            Debug.Log("[SFXInitializer] AudioManager에 SFX " + clips.Count + "개 등록 완료");
        }

        /// <summary>
        /// 외부에서 수동으로 등록을 트리거할 수 있는 메서드.
        /// AudioManager가 나중에 초기화되는 경우 사용합니다.
        /// </summary>
        public static void ForceRegister()
        {
            if (GeneratedClips == null || AudioManager.Instance == null) return;
            RegisterClips(AudioManager.Instance, GeneratedClips);
        }
    }
}
