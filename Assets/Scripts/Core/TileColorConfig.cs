using System.Collections.Generic;
using UnityEngine;

namespace HexaMerge.Core
{
    [CreateAssetMenu(fileName = "TileColorConfig", menuName = "HexaMerge/Tile Color Config")]
    public class TileColorConfig : ScriptableObject
    {
        [System.Serializable]
        public struct TileColorEntry
        {
            public int value;
            public Color color;
            public Color textColor;
        }

        [Header("Tile Colors")]
        public TileColorEntry[] entries;

        [Header("Defaults")]
        public Color emptyColor = new Color(0.2f, 0.2f, 0.2f, 1f);
        public Color defaultTextColor = Color.white;

        // ------------------------------------------------------------
        // Runtime lookup cache
        // ------------------------------------------------------------
        private Dictionary<int, Color> _colorCache;
        private Dictionary<int, Color> _textColorCache;

        private void BuildCacheIfNeeded()
        {
            if (_colorCache != null) return;

            _colorCache = new Dictionary<int, Color>(entries != null ? entries.Length : 0);
            _textColorCache = new Dictionary<int, Color>(entries != null ? entries.Length : 0);

            if (entries == null) return;

            for (int i = 0; i < entries.Length; i++)
            {
                TileColorEntry e = entries[i];
                _colorCache[e.value] = e.color;
                _textColorCache[e.value] = e.textColor;
            }
        }

        /// <summary>
        /// ScriptableObject 가 로드되거나 값이 바뀔 때 캐시를 무효화한다.
        /// </summary>
        private void OnEnable()
        {
            _colorCache = null;
            _textColorCache = null;
        }

        private void OnValidate()
        {
            _colorCache = null;
            _textColorCache = null;
        }

        // ------------------------------------------------------------
        // Public API
        // ------------------------------------------------------------

        /// <summary>타일 값에 대응하는 배경 색상을 반환한다.</summary>
        public Color GetColor(int value)
        {
            BuildCacheIfNeeded();
            return _colorCache.TryGetValue(value, out Color c) ? c : emptyColor;
        }

        /// <summary>타일 값에 대응하는 텍스트 색상을 반환한다.</summary>
        public Color GetTextColor(int value)
        {
            BuildCacheIfNeeded();
            return _textColorCache.TryGetValue(value, out Color c) ? c : defaultTextColor;
        }

        // ------------------------------------------------------------
        // Editor : Reset 시 기본 색상 16 개를 자동 세팅
        // ------------------------------------------------------------
        private void Reset()
        {
            defaultTextColor = Color.white;
            emptyColor = new Color(0.22f, 0.22f, 0.24f, 1f);

            entries = new TileColorEntry[]
            {
                MakeEntry(2,     "#FFD700", "#FFFFFF"),  // 노랑
                MakeEntry(4,     "#FF6B35", "#FFFFFF"),  // 주황
                MakeEntry(8,     "#EC407A", "#FFFFFF"),  // 핑크
                MakeEntry(16,    "#880E4F", "#FFFFFF"),  // 다크레드
                MakeEntry(32,    "#C2185B", "#FFFFFF"),  // 마젠타
                MakeEntry(64,    "#8E24AA", "#FFFFFF"),  // 보라
                MakeEntry(128,   "#4A148C", "#FFFFFF"),  // 짙은보라
                MakeEntry(256,   "#7C4DFF", "#FFFFFF"),  // 중간보라
                MakeEntry(512,   "#1976D2", "#FFFFFF"),  // 파랑
                MakeEntry(1024,  "#00897B", "#FFFFFF"),  // 틸
                MakeEntry(2048,  "#9ACD32", "#333333"),  // 라임 (밝아서 어두운 텍스트)
                MakeEntry(4096,  "#4CAF50", "#FFFFFF"),  // 녹색
                MakeEntry(8192,  "#00695C", "#FFFFFF"),  // 다크틸
                MakeEntry(16384, "#FFB300", "#333333"),  // 골드 (밝아서 어두운 텍스트)
                MakeEntry(32768, "#E64A19", "#FFFFFF"),  // 레드
                MakeEntry(65536, "#E91E63", "#FFFFFF"),  // 로즈
            };
        }

        private static TileColorEntry MakeEntry(int value, string hexColor, string hexTextColor)
        {
            ColorUtility.TryParseHtmlString(hexColor, out Color bg);
            ColorUtility.TryParseHtmlString(hexTextColor, out Color txt);

            return new TileColorEntry
            {
                value = value,
                color = bg,
                textColor = txt,
            };
        }
    }
}
