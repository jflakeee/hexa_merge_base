namespace HexaMerge.Audio
{
    using UnityEngine;
    using System.Collections.Generic;

    /// <summary>
    /// AudioClip.Create로 절차적 SFX를 생성합니다.
    /// 크리스탈컵 음색 합성: 비정수 배음 + 쉬머링 + 느린 감쇠.
    /// </summary>
    public static class ProceduralSFX
    {
        private const int SampleRate = 44100;

        // ──────────────────────────────────────────────
        //  크리스탈컵 음색 헬퍼
        // ──────────────────────────────────────────────

        /// <summary>
        /// 크리스탈 잔/컵 음색을 합성합니다.
        /// 비정수 배음 (유리 특성) + 쉬머링 비트 + 느린 지수 감쇠.
        /// </summary>
        private static float CrystalNote(float freq, float duration, float t, float p)
        {
            // 부드러운 어택 (5ms) + 느린 지수 감쇠 (유리 공명)
            float attack = 0.005f / duration;
            float env;
            if (p < attack)
                env = p / attack;
            else
                env = Mathf.Exp(-(p - attack) * 3.5f);

            // 크리스탈 비정수 배음: 유리/금속 특유의 배음비
            float f1 = Sine(freq, t);                          // 기본음
            float f2 = Sine(freq * 2.76f, t) * 0.35f;         // 비정수 배음 1
            float f3 = Sine(freq * 5.4f, t) * 0.15f;          // 비정수 배음 2
            float f4 = Sine(freq * 8.93f, t) * 0.06f;         // 비정수 배음 3

            // 고차 배음 차등 감쇠: 높은 배음이 먼저 사라짐
            float d2 = Mathf.Exp(-p * 5f);
            float d3 = Mathf.Exp(-p * 8f);
            float d4 = Mathf.Exp(-p * 12f);

            // 쉬머링: 근접 주파수 비트로 맑은 울림
            float shimmer = Sine(freq * 1.003f, t) * 0.2f * Mathf.Exp(-p * 4f);

            float sample = f1 + f2 * d2 + f3 * d3 + f4 * d4 + shimmer;
            return sample * env;
        }

        /// <summary>
        /// 크리스탈 동시화음 (왕관 전환용).
        /// 여러 음을 동시에 울려 풍성한 공명.
        /// </summary>
        private static float CrystalChord(float[] freqs, float duration, float t, float p)
        {
            float sum = 0f;
            for (int i = 0; i < freqs.Length; i++)
            {
                sum += CrystalNote(freqs[i], duration, t, p);
            }
            return sum / freqs.Length;
        }

        // ──────────────────────────────────────────────
        //  타일 탭 사운드 — E5 크리스탈 스타카토
        // ──────────────────────────────────────────────
        public static AudioClip CreateTapSound()
        {
            return CreateClip("SFX_Tap", 0.1f, (t, p) =>
            {
                return CrystalNote(659.25f, 0.1f, t, p) * 0.7f;
            });
        }

        // ──────────────────────────────────────────────
        //  머지 사운드 - 레벨별 크리스탈 노트
        // ──────────────────────────────────────────────
        public static AudioClip CreateMergeBasicSound()
        {
            // C5 (523.25Hz)
            return CreateClip("SFX_MergeBasic", 0.4f, (t, p) =>
            {
                return CrystalNote(523.25f, 0.4f, t, p) * 0.7f;
            });
        }

        public static AudioClip CreateMergeMidSound()
        {
            // E5 (659.25Hz)
            return CreateClip("SFX_MergeMid", 0.4f, (t, p) =>
            {
                return CrystalNote(659.25f, 0.4f, t, p) * 0.7f;
            });
        }

        public static AudioClip CreateMergeHighSound()
        {
            // G5 (783.99Hz)
            return CreateClip("SFX_MergeHigh", 0.5f, (t, p) =>
            {
                return CrystalNote(783.99f, 0.5f, t, p) * 0.65f;
            });
        }

        public static AudioClip CreateMergeUltraSound()
        {
            // C6 (1046.5Hz)
            return CreateClip("SFX_MergeUltra", 0.5f, (t, p) =>
            {
                return CrystalNote(1046.5f, 0.5f, t, p) * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  연쇄 콤보 — 크리스탈 상승 아르페지오
        // ──────────────────────────────────────────────
        public static AudioClip CreateChainComboSound()
        {
            return CreateClip("SFX_ChainCombo", 0.4f, (t, p) =>
            {
                // C5→E5→G5 빠른 아르페지오
                float note;
                float noteP;
                if (p < 0.33f)
                {
                    note = 523.25f; // C5
                    noteP = p / 0.33f;
                }
                else if (p < 0.66f)
                {
                    note = 659.25f; // E5
                    noteP = (p - 0.33f) / 0.33f;
                }
                else
                {
                    note = 783.99f; // G5
                    noteP = (p - 0.66f) / 0.34f;
                }
                return CrystalNote(note, 0.13f, t, noteP) * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  마일스톤 — 크리스탈 4음 아르페지오
        // ──────────────────────────────────────────────
        public static AudioClip CreateMilestoneSound()
        {
            return CreateClip("SFX_Milestone", 0.5f, (t, p) =>
            {
                // C5→E5→G5→C6 아르페지오
                float note;
                float noteP;
                if (p < 0.25f)
                {
                    note = 523.25f;
                    noteP = p / 0.25f;
                }
                else if (p < 0.5f)
                {
                    note = 659.25f;
                    noteP = (p - 0.25f) / 0.25f;
                }
                else if (p < 0.75f)
                {
                    note = 783.99f;
                    noteP = (p - 0.5f) / 0.25f;
                }
                else
                {
                    note = 1046.5f;
                    noteP = (p - 0.75f) / 0.25f;
                }
                float globalEnv = 1f - p * 0.3f;
                return CrystalNote(note, 0.125f, t, noteP) * globalEnv * 0.55f;
            });
        }

        // ──────────────────────────────────────────────
        //  왕관 전환 — 크리스탈 동시화음 (C5+E5+G5)
        // ──────────────────────────────────────────────
        public static AudioClip CreateCrownChangeSound()
        {
            return CreateClip("SFX_CrownChange", 0.4f, (t, p) =>
            {
                // C5 + E5 + G5 동시화음
                float[] chord = new float[] { 523.25f, 659.25f, 783.99f };
                return CrystalChord(chord, 0.4f, t, p) * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  게임 오버 — E4→C4→A3 하강 크리스탈
        // ──────────────────────────────────────────────
        public static AudioClip CreateGameOverSound()
        {
            return CreateClip("SFX_GameOver", 0.6f, (t, p) =>
            {
                // E4→C4→A3 하강 아르페지오
                float note;
                float noteP;
                if (p < 0.33f)
                {
                    note = 659.25f; // E5
                    noteP = p / 0.33f;
                }
                else if (p < 0.66f)
                {
                    note = 523.25f; // C5
                    noteP = (p - 0.33f) / 0.33f;
                }
                else
                {
                    note = 440.00f; // A4
                    noteP = (p - 0.66f) / 0.34f;
                }
                float globalEnv = 1f - p * 0.2f;
                return CrystalNote(note, 0.2f, t, noteP) * globalEnv * 0.65f;
            });
        }

        // ──────────────────────────────────────────────
        //  게임 시작 — C5→E5→G5 상승 크리스탈
        // ──────────────────────────────────────────────
        public static AudioClip CreateGameStartSound()
        {
            return CreateClip("SFX_GameStart", 0.5f, (t, p) =>
            {
                // C5→E5→G5 상승 아르페지오
                float note;
                float noteP;
                if (p < 0.33f)
                {
                    note = 523.25f; // C5
                    noteP = p / 0.33f;
                }
                else if (p < 0.66f)
                {
                    note = 659.25f; // E5
                    noteP = (p - 0.33f) / 0.33f;
                }
                else
                {
                    note = 783.99f; // G5
                    noteP = (p - 0.66f) / 0.34f;
                }
                float globalEnv = 1f - p * 0.2f;
                return CrystalNote(note, 0.17f, t, noteP) * globalEnv * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  버튼 클릭 — C6 크리스탈 스타카토
        // ──────────────────────────────────────────────
        public static AudioClip CreateButtonClickSound()
        {
            return CreateClip("SFX_ButtonClick", 0.08f, (t, p) =>
            {
                return CrystalNote(1046.5f, 0.08f, t, p) * 0.55f;
            });
        }

        // ──────────────────────────────────────────────
        //  타일 드롭 — G4 크리스탈 짧은 탭
        // ──────────────────────────────────────────────
        public static AudioClip CreateTileDropSound()
        {
            return CreateClip("SFX_TileDrop", 0.15f, (t, p) =>
            {
                return CrystalNote(392.00f, 0.15f, t, p) * 0.65f;
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
