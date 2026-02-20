namespace HexaMerge.Audio
{
    using UnityEngine;
    using System.Collections.Generic;

    /// <summary>
    /// AudioClip.Create로 절차적 SFX를 생성합니다.
    /// 피아노 음색 합성: 비조화 배음 + 해머 노이즈 + 지수 감쇠.
    /// </summary>
    public static class ProceduralSFX
    {
        private const int SampleRate = 44100;
        private const float Inharmonicity = 0.0005f; // 피아노 비조화 계수 B

        // ──────────────────────────────────────────────
        //  피아노 음색 헬퍼
        // ──────────────────────────────────────────────

        /// <summary>
        /// 피아노 음색 단일 노트를 합성합니다.
        /// 8개 배음 + 비조화성 + 해머 노이즈 + 지수 감쇠.
        /// </summary>
        private static float PianoNote(float freq, float duration, float t, float p)
        {
            // 빠른 어택 (3ms) + 지수 감쇠
            float attack = 0.003f / duration;
            float env;
            if (p < attack)
                env = p / attack;
            else
                env = Mathf.Exp(-(p - attack) * 6f);

            // 배음 합성: 8개 배음, 고차 배음 차등 감쇠
            float sample = 0f;
            for (int n = 1; n <= 8; n++)
            {
                // 비조화 배음 주파수: f_n = n * f0 * (1 + B * n^2)
                float fn = n * freq * (1f + Inharmonicity * n * n);
                float amp = 1f / n; // 기본 진폭: 1/n
                // 고차 배음이 먼저 감쇠: exp(-n * 4 * p)
                float harmonicDecay = Mathf.Exp(-n * 4f * p);
                sample += Sine(fn, t) * amp * harmonicDecay;
            }

            // 해머 노이즈: 어택 시 짧은 노이즈 버스트 (p < 0.02)
            float hammer = 0f;
            if (p < 0.02f)
            {
                float hammerEnv = 1f - p / 0.02f;
                hammer = (Random(t) * 2f - 1f) * 0.3f * hammerEnv;
            }

            return (sample + hammer) * env;
        }

        // ──────────────────────────────────────────────
        //  타일 탭 사운드 — E5 스타카토
        // ──────────────────────────────────────────────
        public static AudioClip CreateTapSound()
        {
            return CreateClip("SFX_Tap", 0.1f, (t, p) =>
            {
                return PianoNote(659.25f, 0.1f, t, p) * 0.7f;
            });
        }

        // ──────────────────────────────────────────────
        //  머지 사운드 - 레벨별 피아노 노트
        // ──────────────────────────────────────────────
        public static AudioClip CreateMergeBasicSound()
        {
            // C4 (261.63Hz)
            return CreateClip("SFX_MergeBasic", 0.4f, (t, p) =>
            {
                return PianoNote(261.63f, 0.4f, t, p) * 0.75f;
            });
        }

        public static AudioClip CreateMergeMidSound()
        {
            // E4 (329.63Hz)
            return CreateClip("SFX_MergeMid", 0.4f, (t, p) =>
            {
                return PianoNote(329.63f, 0.4f, t, p) * 0.75f;
            });
        }

        public static AudioClip CreateMergeHighSound()
        {
            // G4 (392.00Hz)
            return CreateClip("SFX_MergeHigh", 0.5f, (t, p) =>
            {
                return PianoNote(392.00f, 0.5f, t, p) * 0.7f;
            });
        }

        public static AudioClip CreateMergeUltraSound()
        {
            // C5 (523.25Hz)
            return CreateClip("SFX_MergeUltra", 0.5f, (t, p) =>
            {
                return PianoNote(523.25f, 0.5f, t, p) * 0.7f;
            });
        }

        // ──────────────────────────────────────────────
        //  연쇄 콤보 — 피아노 상승 아르페지오
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
                return PianoNote(note, 0.13f, t, noteP) * 0.65f;
            });
        }

        // ──────────────────────────────────────────────
        //  마일스톤 — 피아노 4음 아르페지오
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
                return PianoNote(note, 0.125f, t, noteP) * globalEnv * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  왕관 전환 — G5 피아노
        // ──────────────────────────────────────────────
        public static AudioClip CreateCrownChangeSound()
        {
            // G5 (783.99Hz)
            return CreateClip("SFX_CrownChange", 0.3f, (t, p) =>
            {
                return PianoNote(783.99f, 0.3f, t, p) * 0.65f;
            });
        }

        // ──────────────────────────────────────────────
        //  게임 오버 — E4→C4→A3 하강 피아노
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
                    note = 329.63f; // E4
                    noteP = p / 0.33f;
                }
                else if (p < 0.66f)
                {
                    note = 261.63f; // C4
                    noteP = (p - 0.33f) / 0.33f;
                }
                else
                {
                    note = 220.00f; // A3
                    noteP = (p - 0.66f) / 0.34f;
                }
                float globalEnv = 1f - p * 0.2f;
                return PianoNote(note, 0.2f, t, noteP) * globalEnv * 0.7f;
            });
        }

        // ──────────────────────────────────────────────
        //  게임 시작 — C4→E4→G4 상승 아르페지오
        // ──────────────────────────────────────────────
        public static AudioClip CreateGameStartSound()
        {
            return CreateClip("SFX_GameStart", 0.5f, (t, p) =>
            {
                // C4→E4→G4 상승 아르페지오
                float note;
                float noteP;
                if (p < 0.33f)
                {
                    note = 261.63f; // C4
                    noteP = p / 0.33f;
                }
                else if (p < 0.66f)
                {
                    note = 329.63f; // E4
                    noteP = (p - 0.33f) / 0.33f;
                }
                else
                {
                    note = 392.00f; // G4
                    noteP = (p - 0.66f) / 0.34f;
                }
                float globalEnv = 1f - p * 0.2f;
                return PianoNote(note, 0.17f, t, noteP) * globalEnv * 0.65f;
            });
        }

        // ──────────────────────────────────────────────
        //  버튼 클릭 — C5 스타카토
        // ──────────────────────────────────────────────
        public static AudioClip CreateButtonClickSound()
        {
            return CreateClip("SFX_ButtonClick", 0.08f, (t, p) =>
            {
                return PianoNote(523.25f, 0.08f, t, p) * 0.6f;
            });
        }

        // ──────────────────────────────────────────────
        //  타일 드롭 — G3 짧은 피아노
        // ──────────────────────────────────────────────
        public static AudioClip CreateTileDropSound()
        {
            return CreateClip("SFX_TileDrop", 0.15f, (t, p) =>
            {
                return PianoNote(196.00f, 0.15f, t, p) * 0.7f;
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
