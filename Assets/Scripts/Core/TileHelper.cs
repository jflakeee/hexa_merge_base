namespace HexaMerge.Core
{
    /// <summary>
    /// 타일 값과 관련된 순수 유틸리티 메서드 모음.
    /// MonoBehaviour 에 의존하지 않으므로 어디서든 호출 가능.
    /// </summary>
    public static class TileHelper
    {
        // ----------------------------------------------------------
        // Constants
        // ----------------------------------------------------------
        public static readonly int MinValue    = 2;
        public static readonly int MaxValue    = 65536;
        public static readonly int TotalLevels = 16;   // 2 ~ 65536

        // ----------------------------------------------------------
        // Validation
        // ----------------------------------------------------------

        /// <summary>
        /// value 가 유효한 타일 값(2 의 거듭제곱이며 2 ~ 65536 범위)인지 검사한다.
        /// </summary>
        public static bool IsValidTileValue(int value)
        {
            if (value < MinValue || value > MaxValue) return false;
            // 2 의 거듭제곱 판별: n > 0 && (n & (n-1)) == 0
            return (value & (value - 1)) == 0;
        }

        // ----------------------------------------------------------
        // Merge / Progression
        // ----------------------------------------------------------

        /// <summary>
        /// 머지 후 다음 값을 반환한다. 이미 최대값이면 MaxValue 를 반환.
        /// </summary>
        public static int GetNextValue(int value)
        {
            int next = value * 2;
            return next > MaxValue ? MaxValue : next;
        }

        // ----------------------------------------------------------
        // Display
        // ----------------------------------------------------------

        /// <summary>
        /// UI 표시용 문자열을 반환한다.
        /// 16384 이상이면 K 축약 표기를 사용한다.
        /// 예: 16384 -> "16K", 32768 -> "32K", 65536 -> "65K"
        /// </summary>
        public static string FormatValue(int value)
        {
            if (value >= 1000000000) return (value / 1000000000f).ToString("0.#") + "g";
            if (value >= 1000000) return (value / 1000000f).ToString("0.#") + "m";
            if (value >= 1000) return (value / 1000f).ToString("0.#") + "k";
            return value.ToString();
        }

        // ----------------------------------------------------------
        // Level
        // ----------------------------------------------------------

        /// <summary>
        /// 타일 값을 0 기반 레벨로 변환한다.
        /// 2 -> 0, 4 -> 1, 8 -> 2, ... , 65536 -> 15
        /// </summary>
        public static int GetTileLevel(int value)
        {
            // log2 를 비트 시프트로 계산 (정수 전용, GC 없음)
            int level = 0;
            int v = value;
            while (v > 1)
            {
                v >>= 1;
                level++;
            }
            return level - 1;
        }

        // ----------------------------------------------------------
        // Random
        // ----------------------------------------------------------

        /// <summary>
        /// 새로 생성할 타일 값을 반환한다.
        /// 90% 확률로 2, 10% 확률로 4.
        /// </summary>
        public static int GetRandomNewTileValue()
        {
            // UnityEngine.Random 은 static class 에서도 사용 가능
            return UnityEngine.Random.value < 0.9f ? 2 : 4;
        }

        /// <summary>
        /// 현재 보드 최소값 기준 8배 범위 내에서 리필 타일 값을 반환한다.
        /// 예: min=4 → {4,8,16,32} 중 가중 랜덤 (낮은 값일수록 높은 확률)
        /// </summary>
        public static int GetRandomRefillValue(int minDisplayedValue)
        {
            if (minDisplayedValue < MinValue) minDisplayedValue = MinValue;
            int maxRange = minDisplayedValue * 8;
            if (maxRange > MaxValue) maxRange = MaxValue;

            // 범위 내 유효 레벨 수 계산
            int levels = 0;
            int v = minDisplayedValue;
            while (v <= maxRange && v <= MaxValue)
            {
                levels++;
                v *= 2;
            }

            if (levels <= 1) return minDisplayedValue;

            // 가중 랜덤: 낮은 값일수록 높은 확률 (1/1, 1/2, 1/3, ...)
            float totalWeight = 0f;
            for (int i = 1; i <= levels; i++)
                totalWeight += 1f / i;

            float roll = UnityEngine.Random.Range(0f, totalWeight);
            float cumulative = 0f;
            int result = minDisplayedValue;
            for (int i = 1; i <= levels; i++)
            {
                cumulative += 1f / i;
                if (roll <= cumulative)
                    return result;
                result *= 2;
            }

            return minDisplayedValue;
        }

        /// <summary>
        /// 초기 보드 타일 값을 반환한다 (리필보다 다양한 분포).
        /// 50% 2, 30% 4, 15% 8, 5% 16
        /// </summary>
        public static int GetRandomInitialTileValue()
        {
            float roll = UnityEngine.Random.value;
            if (roll < 0.50f) return 2;
            if (roll < 0.80f) return 4;
            if (roll < 0.95f) return 8;
            return 16;
        }
    }
}
