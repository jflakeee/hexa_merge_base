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
                hexBackground.preserveAspect = false;
                // 육각형 모양으로 클릭 영역 제한 (투명 영역 클릭 무시)
                hexBackground.alphaHitTestMinimumThreshold = 0.5f;
            }

            // Ensure valueText renders on top of background
            if (valueText != null)
            {
                valueText.transform.SetAsLastSibling();
                valueText.raycastTarget = false;
                valueText.alignment = TextAnchor.MiddleCenter;
                valueText.horizontalOverflow = HorizontalWrapMode.Overflow;
                valueText.verticalOverflow = VerticalWrapMode.Overflow;
                valueText.supportRichText = true;
                if (valueText.font == null)
                    valueText.font = Resources.GetBuiltinResource<Font>("Arial.ttf");
            }

            ShowEmpty();
        }

        private static Sprite GetOrCreateHexSprite(int size)
        {
            if (cachedHexSprite != null) return cachedHexSprite;

            // flat-top hex: width = 2*r, height = sqrt(3)*r
            int texW = size;
            int texH = Mathf.RoundToInt(size * Mathf.Sqrt(3f) / 2f);

            Texture2D tex = new Texture2D(texW, texH, TextureFormat.RGBA32, false);
            Color32[] pixels = new Color32[texW * texH];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);

            float cx = texW * 0.5f;
            float cy = texH * 0.5f;
            float radius = texW * 0.478f;
            float cornerRadius = texW * 0.08f;

            // 내부 축소 육각형 (변을 cornerRadius만큼 안쪽으로 이동)
            // 정육각형 apothem = R * sqrt(3)/2, 새 apothem = apothem - cornerRadius
            // 새 R = (apothem - cornerRadius) / (sqrt(3)/2)
            float insetR = radius - cornerRadius * 2f / Mathf.Sqrt(3f);

            float[] ivx = new float[6];
            float[] ivy = new float[6];
            for (int i = 0; i < 6; i++)
            {
                float angle = Mathf.Deg2Rad * (60f * i);
                ivx[i] = cx + insetR * Mathf.Cos(angle);
                ivy[i] = cy + insetR * Mathf.Sin(angle);
            }

            for (int y = 0; y < texH; y++)
            {
                for (int x = 0; x < texW; x++)
                {
                    float px = x + 0.5f;
                    float py = y + 0.5f;

                    if (PointInHex(px, py, ivx, ivy))
                    {
                        pixels[y * texW + x] = white;
                    }
                    else
                    {
                        float dist = PointToPolygonDist(px, py, ivx, ivy, 6);
                        pixels[y * texW + x] = dist <= cornerRadius ? white : clear;
                    }
                }
            }

            tex.SetPixels32(pixels);
            tex.Apply();

            cachedHexSprite = Sprite.Create(tex, new Rect(0, 0, texW, texH), new Vector2(0.5f, 0.5f), 100f);
            return cachedHexSprite;
        }

        private static bool PointInHex(float px, float py, float[] vx, float[] vy)
        {
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

        private static float PointToSegmentDist(float px, float py, float ax, float ay, float bx, float by)
        {
            float dx = bx - ax;
            float dy = by - ay;
            float lenSq = dx * dx + dy * dy;
            if (lenSq < 0.0001f)
                return Mathf.Sqrt((px - ax) * (px - ax) + (py - ay) * (py - ay));

            float t = Mathf.Clamp01(((px - ax) * dx + (py - ay) * dy) / lenSq);
            float closestX = ax + t * dx;
            float closestY = ay + t * dy;
            float distX = px - closestX;
            float distY = py - closestY;
            return Mathf.Sqrt(distX * distX + distY * distY);
        }

        private static float PointToPolygonDist(float px, float py, float[] vx, float[] vy, int n)
        {
            float minDist = float.MaxValue;
            for (int i = 0; i < n; i++)
            {
                int j = (i + 1) % n;
                float dist = PointToSegmentDist(px, py, vx[i], vy[i], vx[j], vy[j]);
                if (dist < minDist) minDist = dist;
            }
            return minDist;
        }

        public void UpdateView(double value, bool hasCrown)
        {
            if (value <= 0)
            {
                ShowEmpty();
                return;
            }

            UpdateColors(value);
            UpdateCrown(hasCrown);
            UpdateText(value);
        }

        private void UpdateColors(double value)
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

        private void UpdateText(double value)
        {
            if (valueText == null) return;

            valueText.gameObject.SetActive(true);

            string display = TileHelper.FormatValue(value);
            int len = display.Length;
            int fontSize;
            if (len <= 1) fontSize = 48;
            else fontSize = 36;
            valueText.fontSize = fontSize;
            valueText.text = display;
        }

        private Image crownImage;
        private bool hasCrownShown;
        private static Sprite cachedCrownSprite;

        private void UpdateCrown(bool show)
        {
            hasCrownShown = show;

            // Hide legacy crownIcon
            if (crownIcon != null)
                crownIcon.SetActive(false);

            if (show)
            {
                if (crownImage == null)
                    CreateCrownImage();
                crownImage.gameObject.SetActive(true);
            }
            else if (crownImage != null)
            {
                crownImage.gameObject.SetActive(false);
            }
        }

        private void CreateCrownImage()
        {
            GameObject crownObj = new GameObject("CrownIcon");
            crownObj.transform.SetParent(transform, false);

            RectTransform rt = crownObj.AddComponent<RectTransform>();
            rt.anchorMin = new Vector2(0.5f, 0.5f);
            rt.anchorMax = new Vector2(0.5f, 0.5f);
            rt.pivot = new Vector2(0.5f, 0.5f);
            rt.anchoredPosition = new Vector2(0f, 24f);
            rt.sizeDelta = new Vector2(28f, 20f);

            crownImage = crownObj.AddComponent<Image>();
            crownImage.sprite = GetOrCreateCrownSprite();
            crownImage.color = new Color(1f, 0.843f, 0f, 1f); // Gold
            crownImage.raycastTarget = false;
            crownImage.preserveAspect = true;

            crownObj.transform.SetAsLastSibling();
        }

        private static Sprite GetOrCreateCrownSprite()
        {
            if (cachedCrownSprite != null) return cachedCrownSprite;

            int w = 56, h = 40;
            Texture2D tex = new Texture2D(w, h, TextureFormat.RGBA32, false);
            Color32[] px = new Color32[w * h];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);

            for (int i = 0; i < px.Length; i++) px[i] = clear;

            // Draw crown shape: base rect + 3 triangular points
            // Base: bottom 60% is a rectangle
            int baseTop = h * 2 / 5; // y=16
            for (int y = 0; y < baseTop; y++)
                for (int x = 4; x < w - 4; x++)
                    px[y * w + x] = white;

            // Three triangular peaks
            int peakH = h - baseTop; // 24px for peaks
            float[] peakCenters = new float[] { w * 0.18f, w * 0.5f, w * 0.82f };
            float peakHalfW = w * 0.22f;

            for (int y = baseTop; y < h; y++)
            {
                float progress = (float)(y - baseTop) / peakH; // 0 at base, 1 at tip
                float halfWidth = peakHalfW * (1f - progress);
                foreach (float cx in peakCenters)
                {
                    int xStart = Mathf.Max(0, Mathf.RoundToInt(cx - halfWidth));
                    int xEnd = Mathf.Min(w - 1, Mathf.RoundToInt(cx + halfWidth));
                    for (int x = xStart; x <= xEnd; x++)
                        px[y * w + x] = white;
                }
                // Fill between peaks at lower heights
                if (progress < 0.5f)
                {
                    int leftEnd = Mathf.RoundToInt(peakCenters[0] + halfWidth);
                    int rightStart = Mathf.RoundToInt(peakCenters[2] - halfWidth);
                    for (int x = leftEnd; x <= rightStart; x++)
                        px[y * w + x] = white;
                }
            }

            tex.SetPixels32(px);
            tex.Apply();
            cachedCrownSprite = Sprite.Create(tex, new Rect(0, 0, w, h), new Vector2(0.5f, 0.5f), 100f);
            return cachedCrownSprite;
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
