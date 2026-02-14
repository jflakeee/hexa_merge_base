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
            if (value >= 16384)
            {
                // 정수 나눗셈으로 소수점 없이 K 단위 표기
                return (value / 1024) + "K";
            }
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
    }
}
