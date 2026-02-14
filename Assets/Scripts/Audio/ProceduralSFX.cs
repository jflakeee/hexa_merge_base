namespace HexaMerge.Audio
{
    using UnityEngine;
    using System.Collections.Generic;

    /// <summary>
    /// AudioClip.Create로 절차적 SFX를 생성합니다.
    /// 외부 오디오 에셋 없이 기본 효과음을 제공합니다.
    /// 사인파 합성 + 하모닉스 + 엔벨로프로 자연스러운 사운드를 만듭니다.
    /// </summary>
    public static class ProceduralSFX
    {
        private const int SampleRate = 44100;

        // ──────────────────────────────────────────────
        //  타일 탭 사운드 (짧은 클릭/팝)
        // ──────────────────────────────────────────────
        public static AudioClip CreateTapSound()
        {
            return CreateClip("SFX_Tap", 0.08f, (t, p) =>
            {
                float fundamental = Sine(800f, t);
                float harmonic = Sine(1600f, t) * 0.3f;
                float noise = (Random(t) * 2f - 1f) * 0.15f;
                float env = Envelope(p, 0.01f, 0.4f);
                return (fundamental + harmonic + noise) * env * 0.8f;
            });
        }

        // ──────────────────────────────────────────────
        //  머지 사운드 - 레벨별
        // ──────────────────────────────────────────────
        public static AudioClip CreateMergeBasicSound()
        {
            return CreateClip("SFX_MergeBasic", 0.15f, (t, p) =>
            {
                float f = 400f + p * 50f; // 약간 상승
                float fundamental = Sine(f, t);
                float h2 = Sine(f * 2f, t) * 0.25f;
                float h3 = Sine(f * 3f, t) * 0.1f;
                float env = Envelope(p, 0.05f, 0.5f);
                return (fundamental + h2 + h3) * env * 0.7f;
            });
        }

        public static AudioClip CreateMergeMidSound()
        {
            return CreateClip("SFX_MergeMid", 0.2f, (t, p) =>
            {
                float f = 600f + p * 80f;
                float fundamental = Sine(f, t);
                float h2 = Sine(f * 2f, t) * 0.3f;
                float h3 = Sine(f * 3f, t) * 0.15f;
                float h4 = Sine(f * 4f, t) * 0.05f;
                float env = Envelope(p, 0.05f, 0.45f);
                return (fundamental + h2 + h3 + h4) * env * 0.7f;
            });
        }

        public static AudioClip CreateMergeHighSound()
        {
            return CreateClip("SFX_MergeHigh", 0.25f, (t, p) =>
            {
                float f = 800f + p * 120f;
                float fundamental = Sine(f, t);
                float h2 = Sine(f * 2f, t) * 0.3f;
                float h3 = Sine(f * 3f, t) * 0.2f;
                float h5 = Sine(f * 5f, t) * 0.08f;
                float shimmer = Sine(f * 1.01f, t) * 0.2f; // 약간의 디튜닝으로 풍성함
                float env = Envelope(p, 0.04f, 0.4f);
                return (fundamental + h2 + h3 + h5 + shimmer) * env * 0.65f;
            });
        }

        public static AudioClip CreateMergeUltraSound()
        {
            return CreateClip("SFX_MergeUltra", 0.3f, (t, p) =>
            {
                float f = 1000f + p * 150f;
                float fundamental = Sine(f, t);
                float h2 = Sine(f * 2f, t) * 0.35f;
                float h3 = Sine(f * 3f, t) * 0.2f;
                float h4 = Sine(f * 4f, t) * 0.1f;
                float shimmer1 = Sine(f * 1.005f, t) * 0.25f;
                float shimmer2 = Sine(f * 2.01f, t) * 0.15f;
                float sparkle = Sine(f * 6f, t) * 0.05f * (1f - p); // 초반에 밝은 스파클
                float env = Envelope(p, 0.03f, 0.35f);
                return (fundamental + h2 + h3 + h4 + shimmer1 + shimmer2 + sparkle) * env * 0.55f;
            });
        }

        // ──────────────────────────────────────────────
        //  연쇄 콤보 사운드 (상승 피치 스윕)
        // ──────────────────────────────────────────────
        public static AudioClip CreateChainComboSound()
        {
            return CreateClip("SFX_ChainCombo", 0.3f, (t, p) =>
            {
                float f = Mathf.Lerp(500f, 1200f, p * p); // 가속 상승
                float fundamental = Sine(f, t);
                float h2 = Sine(f * 2f, t) * 0.25f;
                float h3 = Sine(f * 1.5f, t) * 0.15f; // 5도 하모닉
                float noise = (Random(t + 0.1f) * 2f - 1f) * 0.05f * (1f - p);
                float env = Envelope(p, 0.02f, 0.3f);
                return (fundamental + h2 + h3 + noise) * env * 0.7f;
            });
        }

        // ──────────────────────────────────────────────
        //  마일스톤 달성 (판파레 느낌)
        // ──────────────────────────────────────────────
        public static AudioClip CreateMilestoneSound()
        {
            return CreateClip("SFX_Milestone", 0.5f, (t, p) =>
            {
                // 3단 아르페지오: C5 → E5 → G5 → C6
                float note;
                if (p < 0.25f)
                    note = 523.25f; // C5
                else if (p < 0.5f)
                    note = 659.25f; // E5
                else if (p < 0.75f)
                    note = 783.99f; // G5
                else
                    note = 1046.5f; // C6

                float fundamental = Sine(note, t);
                float h2 = Sine(note * 2f, t) * 0.3f;
                float h3 = Sine(note * 3f, t) * 0.15f;
                float shimmer = Sine(note * 1.003f, t) * 0.2f;

                // 각 노트 내부 엔벨로프
                float noteProgress = (p % 0.25f) / 0.25f;
                float noteEnv = Envelope(noteProgress, 0.05f, 0.3f);
                // 전체 엔벨로프
                float globalEnv = 1f - p * 0.3f;

                return (fundamental + h2 + h3 + shimmer) * noteEnv * globalEnv * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  왕관 전환 (밝은 벨 사운드)
        // ──────────────────────────────────────────────
        public static AudioClip CreateCrownChangeSound()
        {
            return CreateClip("SFX_CrownChange", 0.2f, (t, p) =>
            {
                // 벨 사운드: 비정수 배음이 특징
                float f = 1200f;
                float fundamental = Sine(f, t);
                float h1 = Sine(f * 2.76f, t) * 0.4f;  // 비정수 배음 (벨 특성)
                float h2 = Sine(f * 5.4f, t) * 0.15f;   // 고차 비정수 배음
                float h3 = Sine(f * 0.5f, t) * 0.2f;    // 저음 보강
                float env = Envelope(p, 0.01f, 0.2f);
                // 벨은 고주파가 먼저 감쇠
                float highDecay = Mathf.Exp(-p * 8f);
                float lowDecay = Mathf.Exp(-p * 3f);
                return (fundamental * lowDecay + h1 * highDecay + h2 * highDecay + h3 * lowDecay) * env * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  게임 오버 (하강 톤)
        // ──────────────────────────────────────────────
        public static AudioClip CreateGameOverSound()
        {
            return CreateClip("SFX_GameOver", 0.6f, (t, p) =>
            {
                float f = Mathf.Lerp(400f, 100f, p); // 선형 하강
                float fundamental = Sine(f, t);
                float h2 = Sine(f * 2f, t) * 0.2f;
                float h3 = Sine(f * 3f, t) * 0.1f;
                // 약간의 노이즈로 무거운 느낌
                float noise = (Random(t + 0.5f) * 2f - 1f) * 0.08f * p;
                // 비브라토
                float vibrato = Sine(6f, t) * 5f;
                float vibFund = Sine(f + vibrato, t) * 0.15f;
                float env = Envelope(p, 0.05f, 0.6f);
                return (fundamental + h2 + h3 + noise + vibFund) * env * 0.7f;
            });
        }

        // ──────────────────────────────────────────────
        //  게임 시작 (상승 톤)
        // ──────────────────────────────────────────────
        public static AudioClip CreateGameStartSound()
        {
            return CreateClip("SFX_GameStart", 0.4f, (t, p) =>
            {
                float f = Mathf.Lerp(300f, 600f, p * p); // 가속 상승
                float fundamental = Sine(f, t);
                float h2 = Sine(f * 2f, t) * 0.3f;
                float h3 = Sine(f * 3f, t) * 0.15f;
                float h5 = Sine(f * 1.5f, t) * 0.1f; // 5도
                float shimmer = Sine(f * 1.005f, t) * 0.15f;
                float env = Envelope(p, 0.03f, 0.4f);
                return (fundamental + h2 + h3 + h5 + shimmer) * env * 0.65f;
            });
        }

        // ──────────────────────────────────────────────
        //  버튼 클릭
        // ──────────────────────────────────────────────
        public static AudioClip CreateButtonClickSound()
        {
            return CreateClip("SFX_ButtonClick", 0.05f, (t, p) =>
            {
                float fundamental = Sine(1000f, t);
                float h2 = Sine(2000f, t) * 0.2f;
                float click = (Random(t) * 2f - 1f) * 0.3f * (1f - p);
                float env = Envelope(p, 0.01f, 0.5f);
                return (fundamental + h2 + click) * env * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  타일 드롭 (짧은 바운스)
        // ──────────────────────────────────────────────
        public static AudioClip CreateTileDropSound()
        {
            return CreateClip("SFX_TileDrop", 0.1f, (t, p) =>
            {
                // 빠르게 하강하는 톤 + 바운스
                float f = 300f * (1f - p * 0.5f); // 300→150Hz 하강
                float fundamental = Sine(f, t);
                float h2 = Sine(f * 2f, t) * 0.2f;
                // 바운스: 두 번째 작은 임팩트
                float bounce = 0f;
                if (p > 0.5f && p < 0.7f)
                {
                    float bounceP = (p - 0.5f) / 0.2f;
                    bounce = Sine(250f, t) * 0.4f * Envelope(bounceP, 0.05f, 0.5f);
                }
                float noise = (Random(t + 0.3f) * 2f - 1f) * 0.1f * (1f - p);
                float env = Envelope(p, 0.01f, 0.3f);
                return (fundamental + h2 + noise) * env * 0.7f + bounce;
            });
        }

        // ──────────────────────────────────────────────
        //  유틸리티 메서드
        // ──────────────────────────────────────────────

        /// <summary>
        /// 파형 함수를 사용하여 AudioClip을 생성합니다.
        /// </summary>
        /// <param name="name">클립 이름</param>
        /// <param name="duration">길이(초)</param>
        /// <param name="waveFunc">파형 함수 (시간, 진행도) → 샘플값</param>
        private static AudioClip CreateClip(string name, float duration, System.Func<float, float, float> waveFunc)
        {
            int sampleCount = (int)(SampleRate * duration);
            float[] samples = new float[sampleCount];
            for (int i = 0; i < sampleCount; i++)
            {
                float t = (float)i / SampleRate;         // 시간(초)
                float progress = (float)i / sampleCount;  // 0~1 진행도
                samples[i] = Mathf.Clamp(waveFunc(t, progress), -1f, 1f);
            }
            AudioClip clip = AudioClip.Create(name, sampleCount, 1, SampleRate, false);
            clip.SetData(samples, 0);
            return clip;
        }

        /// <summary>사인파 생성</summary>
        private static float Sine(float frequency, float time)
        {
            return Mathf.Sin(2f * Mathf.PI * frequency * time);
        }

        /// <summary>
        /// Attack-Sustain-Release 엔벨로프.
        /// attack: 0~1 구간 중 어택이 차지하는 비율.
        /// decay: 어택 이후 감쇠 시작점 (0~1). decay 이후 값이 0으로 감소.
        /// </summary>
        private static float Envelope(float progress, float attack, float decay)
        {
            // Attack 구간: 0 → 1
            if (progress < attack)
            {
                return progress / attack;
            }
            // Sustain 구간: 1 유지
            if (progress < decay)
            {
                return 1f;
            }
            // Release 구간: 1 → 0 (지수 감쇠)
            float releaseProgress = (progress - decay) / (1f - decay);
            return Mathf.Exp(-releaseProgress * 5f);
        }

        /// <summary>
        /// 결정론적 의사 난수 (같은 시간값에 같은 결과).
        /// 노이즈 생성용.
        /// </summary>
        private static float Random(float seed)
        {
            // 해시 기반 의사난수 (0~1)
            float v = Mathf.Sin(seed * 12345.6789f + seed * seed * 9876.5432f) * 43758.5453f;
            return v - Mathf.Floor(v);
        }

        // ──────────────────────────────────────────────
        //  모든 SFX를 한번에 생성
        // ──────────────────────────────────────────────

        /// <summary>
        /// 모든 SFX를 생성하여 Dictionary로 반환합니다.
        /// </summary>
        public static Dictionary<SFXType, AudioClip> GenerateAllSFX()
        {
            var clips = new Dictionary<SFXType, AudioClip>
            {
                { SFXType.TapSelect,   CreateTapSound() },
                { SFXType.MergeBasic,  CreateMergeBasicSound() },
                { SFXType.MergeMid,    CreateMergeMidSound() },
                { SFXType.MergeHigh,   CreateMergeHighSound() },
                { SFXType.MergeUltra,  CreateMergeUltraSound() },
                { SFXType.ChainCombo,  CreateChainComboSound() },
                { SFXType.Milestone,   CreateMilestoneSound() },
                { SFXType.CrownChange, CreateCrownChangeSound() },
                { SFXType.GameOver,    CreateGameOverSound() },
                { SFXType.GameStart,   CreateGameStartSound() },
                { SFXType.ButtonClick, CreateButtonClickSound() },
                { SFXType.TileDrop,    CreateTileDropSound() }
            };
            return clips;
        }
    }
}
