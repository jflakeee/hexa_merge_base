namespace HexaMerge.Core
{
    /// <summary>
    /// 타일 값과 관련된 순수 유틸리티 메서드 모음.
    /// MonoBehaviour 에 의존하지 않으므로 어디서든 호출 가능.
    /// double 기반으로 k, m, g, t, p, e, z, y, r, q 단위까지 지원.
    /// 999q 초과 시 단위 표시 초기화 (실제 값 유지).
    /// </summary>
    public static class TileHelper
    {
        // ----------------------------------------------------------
        // Constants
        // ----------------------------------------------------------
        public static readonly double MinValue    = 2;
        public static readonly double MaxValue    = 1e300;
        public static readonly int TotalLevels    = 100;

        // ----------------------------------------------------------
        // Validation
        // ----------------------------------------------------------

        /// <summary>
        /// value 가 유효한 타일 값(2 의 거듭제곱이며 MinValue ~ MaxValue 범위)인지 검사한다.
        /// </summary>
        public static bool IsValidTileValue(double value)
        {
            if (value < MinValue || value > MaxValue) return false;
            double log2 = System.Math.Log(value, 2.0);
            return System.Math.Abs(log2 - System.Math.Round(log2)) < 0.001;
        }

        // ----------------------------------------------------------
        // Merge / Progression
        // ----------------------------------------------------------

        /// <summary>
        /// 머지 후 다음 값을 반환한다. 이미 최대값이면 MaxValue 를 반환.
        /// </summary>
        public static double GetNextValue(double value)
        {
            double next = value * 2;
            return next > MaxValue ? MaxValue : next;
        }

        // ----------------------------------------------------------
        // Display
        // ----------------------------------------------------------

        /// <summary>
        /// UI 표시용 문자열을 반환한다.
        /// SI 접두사를 사용: k, m, g, t, p, e, z, y, r, q
        /// 소수점 없이 정수부만 표시.
        /// 999q 초과 시 단위 표시 초기화 (1e33 단위로 순환).
        /// </summary>
        public static string FormatValue(double value)
        {
            // 999q 초과 시 단위 순환: 1e33 단위로 나누어 표시 초기화
            while (value >= 1e33)
                value /= 1e33;

            if (value >= 1e30) return (value / 1e30).ToString("0") + "q";
            if (value >= 1e27) return (value / 1e27).ToString("0") + "r";
            if (value >= 1e24) return (value / 1e24).ToString("0") + "y";
            if (value >= 1e21) return (value / 1e21).ToString("0") + "z";
            if (value >= 1e18) return (value / 1e18).ToString("0") + "e";
            if (value >= 1e15) return (value / 1e15).ToString("0") + "p";
            if (value >= 1e12) return (value / 1e12).ToString("0") + "t";
            if (value >= 1e9)  return (value / 1e9).ToString("0") + "g";
            if (value >= 1e6)  return (value / 1e6).ToString("0") + "m";
            if (value >= 1e3)  return (value / 1e3).ToString("0") + "k";
            return value.ToString("0");
        }

        // ----------------------------------------------------------
        // Level
        // ----------------------------------------------------------

        /// <summary>
        /// 타일 값을 0 기반 레벨로 변환한다.
        /// 2 -> 0, 4 -> 1, 8 -> 2, ... , 65536 -> 15
        /// </summary>
        public static int GetTileLevel(double value)
        {
            if (value < 2) return 0;
            return (int)System.Math.Round(System.Math.Log(value, 2.0)) - 1;
        }

        // ----------------------------------------------------------
        // Random
        // ----------------------------------------------------------

        /// <summary>
        /// 새로 생성할 타일 값을 반환한다.
        /// 90% 확률로 2, 10% 확률로 4.
        /// </summary>
        public static double GetRandomNewTileValue()
        {
            return UnityEngine.Random.value < 0.9f ? 2 : 4;
        }

        /// <summary>
        /// 현재 보드 최소값 기준 8배 범위 내에서 리필 타일 값을 반환한다.
        /// 예: min=4 → {4,8,16,32} 중 가중 랜덤 (낮은 값일수록 높은 확률)
        /// </summary>
        public static double GetRandomRefillValue(double minDisplayedValue)
        {
            if (minDisplayedValue < MinValue) minDisplayedValue = MinValue;
            double maxRange = minDisplayedValue * 8;
            if (maxRange > MaxValue) maxRange = MaxValue;

            // 범위 내 유효 레벨 수 계산
            int levels = 0;
            double v = minDisplayedValue;
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
            double result = minDisplayedValue;
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
        public static double GetRandomInitialTileValue()
        {
            float roll = UnityEngine.Random.value;
            if (roll < 0.50f) return 2;
            if (roll < 0.80f) return 4;
            if (roll < 0.95f) return 8;
            return 16;
        }
    }
}
