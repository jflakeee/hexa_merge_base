namespace HexaMerge.UI
{
    using HexaMerge.Core;
    using HexaMerge.Game;
    using UnityEngine;
    using UnityEngine.UI;
    using System;

    public class HexCellView : MonoBehaviour
    {
        [SerializeField] private Image hexBackground;
        [SerializeField] private Text valueText;
        [SerializeField] private GameObject crownIcon;
        [SerializeField] private Button button;
        private TileColorConfig colorConfig;

        private static Sprite cachedHexSprite;

        public HexCoord Coord { get; private set; }
        public RectTransform RectTransform => (RectTransform)transform;

        private Action<HexCoord> onTapCallback;

        public void Initialize(HexCoord coord, Action<HexCoord> onTap, TileColorConfig config = null)
        {
            Coord = coord;
            onTapCallback = onTap;
            colorConfig = config ?? (GameManager.Instance != null ? GameManager.Instance.ColorConfig : null);

            // Auto-find components if not assigned in Inspector
            if (hexBackground == null)
                hexBackground = GetComponent<Image>();
            if (valueText == null)
                valueText = GetComponentInChildren<Text>(true);
            if (button == null)
                button = GetComponent<Button>();

            if (button != null)
                button.onClick.AddListener(() => onTapCallback?.Invoke(Coord));

            // 육각형 스프라이트 적용
            if (hexBackground != null && hexBackground.sprite == null)
            {
                hexBackground.sprite = GetOrCreateHexSprite(128);
                hexBackground.preserveAspect = true;
            }

            // Ensure valueText renders on top of background
            if (valueText != null)
            {
                valueText.transform.SetAsLastSibling();
                valueText.raycastTarget = false;
                valueText.alignment = TextAnchor.MiddleCenter;
                valueText.horizontalOverflow = HorizontalWrapMode.Overflow;
                valueText.verticalOverflow = VerticalWrapMode.Overflow;
                if (valueText.font == null)
                    valueText.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            }

            ShowEmpty();
        }

        private static Sprite GetOrCreateHexSprite(int size)
        {
            if (cachedHexSprite != null) return cachedHexSprite;

            Texture2D tex = new Texture2D(size, size, TextureFormat.RGBA32, false);
            Color32[] pixels = new Color32[size * size];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);

            float cx = size * 0.5f;
            float cy = size * 0.5f;
            float radius = size * 0.5f - 1f;

            // flat-top 헥사곤 6개 꼭짓점
            float[] vx = new float[6];
            float[] vy = new float[6];
            for (int i = 0; i < 6; i++)
            {
                float angle = Mathf.Deg2Rad * (60f * i);
                vx[i] = cx + radius * Mathf.Cos(angle);
                vy[i] = cy + radius * Mathf.Sin(angle);
            }

            for (int y = 0; y < size; y++)
            {
                for (int x = 0; x < size; x++)
                {
                    pixels[y * size + x] = PointInHex(x + 0.5f, y + 0.5f, vx, vy) ? white : clear;
                }
            }

            tex.SetPixels32(pixels);
            tex.Apply();

            cachedHexSprite = Sprite.Create(tex, new Rect(0, 0, size, size), new Vector2(0.5f, 0.5f), 100f);
            return cachedHexSprite;
        }

        private static bool PointInHex(float px, float py, float[] vx, float[] vy)
        {
            // ray-casting point-in-polygon
            bool inside = false;
            for (int i = 0, j = 5; i < 6; j = i++)
            {
                if (((vy[i] > py) != (vy[j] > py)) &&
                    (px < (vx[j] - vx[i]) * (py - vy[i]) / (vy[j] - vy[i]) + vx[i]))
                {
                    inside = !inside;
                }
            }
            return inside;
        }

        public void UpdateView(int value, bool hasCrown)
        {
            if (value <= 0)
            {
                ShowEmpty();
                return;
            }

            UpdateColors(value);
            UpdateText(value);
            UpdateCrown(hasCrown);
        }

        private void UpdateColors(int value)
        {
            if (colorConfig != null)
            {
                if (hexBackground != null)
                    hexBackground.color = colorConfig.GetColor(value);
                if (valueText != null)
                    valueText.color = colorConfig.GetTextColor(value);
            }
            else
            {
                if (hexBackground != null)
                    hexBackground.color = new Color(0.3f, 0.3f, 0.35f, 1f);
                if (valueText != null)
                    valueText.color = Color.white;
            }
        }

        private void UpdateText(int value)
        {
            if (valueText == null) return;

            valueText.text = value.ToString();
            valueText.gameObject.SetActive(true);

            int fontSize;
            if (value < 10) fontSize = 36;
            else if (value < 100) fontSize = 32;
            else if (value < 1000) fontSize = 26;
            else if (value < 10000) fontSize = 22;
            else fontSize = 18;
            valueText.fontSize = fontSize;
        }

        private void UpdateCrown(bool show)
        {
            if (crownIcon != null)
                crownIcon.SetActive(show);
        }

        private void ShowEmpty()
        {
            if (hexBackground != null)
                hexBackground.color = Color.clear;

            if (valueText != null)
            {
                valueText.text = string.Empty;
                valueText.gameObject.SetActive(false);
            }

            if (crownIcon != null)
                crownIcon.SetActive(false);
        }
    }
}
