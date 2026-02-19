namespace HexaMerge.UI
{
    using HexaMerge.Core;
    using UnityEngine;
    using UnityEngine.UI;

    public class HUDManager : MonoBehaviour
    {
        [Header("Score")]
        [SerializeField] private Text scoreText;
        [SerializeField] private Text highScoreText;

        [Header("Buttons")]
        [SerializeField] private Button soundButton;
        [SerializeField] private Button menuButton;
        [SerializeField] private Button helpButton;
        [SerializeField] private Button gemButton;

        [Header("Icons")]
        [SerializeField] private Image soundIcon;
        [SerializeField] private Sprite soundOnSprite;
        [SerializeField] private Sprite soundOffSprite;

        [Header("Score Colors")]
        [SerializeField] private Color scoreColor = new Color(0.914f, 0.118f, 0.388f, 1f); // #E91E63
        [SerializeField] private Color highScoreColor = new Color(0.6f, 0.6f, 0.6f, 1f); // 회색

        [Header("Score Font Sizes")]
        [SerializeField] private float baseScoreFontSize = 96f;
        [SerializeField] private float minScoreFontSize = 36f;

        private bool isSoundOn = true;

        private static Sprite cachedHexButtonSprite;

        private void Start()
        {
            if (soundButton != null)
                soundButton.onClick.AddListener(OnSoundButtonClicked);

            if (menuButton != null)
                menuButton.onClick.AddListener(OnMenuButtonClicked);

            if (helpButton != null)
                helpButton.onClick.AddListener(OnHelpButtonClicked);

            if (scoreText != null)
                scoreText.color = scoreColor;

            if (highScoreText != null)
                highScoreText.color = highScoreColor;

            // Apply pink hexagon style to HUD buttons at runtime
            ApplyHexButtonStyle(soundButton, "sound");
            ApplyHexButtonStyle(menuButton, "menu");
            ApplyHexButtonStyle(helpButton, null);

            UpdateScore(0);
            UpdateHighScore(0);
        }

        private void ApplyHexButtonStyle(Button btn, string iconType)
        {
            if (btn == null) return;
            Image img = btn.GetComponent<Image>();
            if (img == null) return;

            img.color = new Color(0.914f, 0.118f, 0.388f, 1f); // #E91E63
            if (img.sprite == null)
                img.sprite = GetOrCreateHexButtonSprite(64);

            // Replace Unicode text icons with procedural sprites (Arial WebGL lacks extended Unicode)
            if (iconType != null)
            {
                // Hide existing Text child
                Text childText = btn.GetComponentInChildren<Text>();
                if (childText != null)
                    childText.gameObject.SetActive(false);

                // Create procedural icon Image
                GameObject iconObj = new GameObject("ProceduralIcon");
                iconObj.transform.SetParent(btn.transform, false);
                RectTransform iconRT = iconObj.AddComponent<RectTransform>();
                iconRT.anchorMin = new Vector2(0.2f, 0.2f);
                iconRT.anchorMax = new Vector2(0.8f, 0.8f);
                iconRT.offsetMin = Vector2.zero;
                iconRT.offsetMax = Vector2.zero;

                Image iconImg = iconObj.AddComponent<Image>();
                iconImg.raycastTarget = false;
                iconImg.preserveAspect = true;
                iconImg.color = Color.white;

                if (iconType == "sound")
                    iconImg.sprite = GetOrCreateSpeakerSprite();
                else if (iconType == "menu")
                    iconImg.sprite = GetOrCreateMenuSprite();
            }
        }

        private static Sprite GetOrCreateHexButtonSprite(int size)
        {
            if (cachedHexButtonSprite != null) return cachedHexButtonSprite;

            int texW = size;
            int texH = Mathf.RoundToInt(size * Mathf.Sqrt(3f) / 2f);
            Texture2D tex = new Texture2D(texW, texH, TextureFormat.RGBA32, false);
            Color32[] pixels = new Color32[texW * texH];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);

            float cx = texW * 0.5f;
            float cy = texH * 0.5f;
            float radiusX = texW * 0.5f;
            float radiusY = texH * 0.5f;

            float[] vx = new float[6];
            float[] vy = new float[6];
            for (int i = 0; i < 6; i++)
            {
                float angle = Mathf.Deg2Rad * (60f * i);
                vx[i] = cx + radiusX * Mathf.Cos(angle);
                vy[i] = cy + radiusY * Mathf.Sin(angle);
            }

            for (int y = 0; y < texH; y++)
            {
                for (int x = 0; x < texW; x++)
                {
                    bool inside = false;
                    for (int i = 0, j = 5; i < 6; j = i++)
                    {
                        if (((vy[i] > y + 0.5f) != (vy[j] > y + 0.5f)) &&
                            (x + 0.5f < (vx[j] - vx[i]) * (y + 0.5f - vy[i]) / (vy[j] - vy[i]) + vx[i]))
                        {
                            inside = !inside;
                        }
                    }
                    pixels[y * texW + x] = inside ? white : clear;
                }
            }

            tex.SetPixels32(pixels);
            tex.Apply();
            cachedHexButtonSprite = Sprite.Create(
                tex, new Rect(0, 0, texW, texH), new Vector2(0.5f, 0.5f), 100f);
            return cachedHexButtonSprite;
        }

        private static Sprite cachedSpeakerSprite;
        private static Sprite cachedMenuSprite;

        private static Sprite GetOrCreateSpeakerSprite()
        {
            if (cachedSpeakerSprite != null) return cachedSpeakerSprite;

            int s = 32;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, false);
            Color32[] px = new Color32[s * s];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);
            for (int i = 0; i < px.Length; i++) px[i] = clear;

            // Speaker body (left rectangle)
            for (int y = 10; y < 22; y++)
                for (int x = 4; x < 12; x++)
                    px[y * s + x] = white;

            // Speaker cone (triangle pointing right)
            for (int y = 4; y < 28; y++)
            {
                float t = Mathf.Abs(y - 16f) / 12f;
                int xEnd = Mathf.RoundToInt(Mathf.Lerp(22f, 12f, t));
                for (int x = 12; x < xEnd; x++)
                    px[y * s + x] = white;
            }

            // Sound waves (two arcs on right side)
            for (int y = 6; y < 26; y++)
            {
                float dy = (y - 16f) / 10f;
                // First arc
                int ax1 = Mathf.RoundToInt(24f + 2f * (1f - dy * dy));
                if (ax1 >= 0 && ax1 < s) px[y * s + ax1] = white;
                // Second arc
                int ax2 = Mathf.RoundToInt(27f + 2f * (1f - dy * dy));
                if (ax2 >= 0 && ax2 < s) px[y * s + ax2] = white;
            }

            tex.SetPixels32(px);
            tex.Apply();
            cachedSpeakerSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedSpeakerSprite;
        }

        private static Sprite GetOrCreateMenuSprite()
        {
            if (cachedMenuSprite != null) return cachedMenuSprite;

            int s = 32;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, false);
            Color32[] px = new Color32[s * s];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);
            for (int i = 0; i < px.Length; i++) px[i] = clear;

            // Three horizontal bars (hamburger menu)
            int barH = 3;
            int barLeft = 6;
            int barRight = 26;
            int[] barCenters = new int[] { 8, 16, 24 };

            foreach (int cy in barCenters)
            {
                for (int y = cy - barH / 2; y <= cy + barH / 2; y++)
                    for (int x = barLeft; x < barRight; x++)
                        if (y >= 0 && y < s) px[y * s + x] = white;
            }

            tex.SetPixels32(px);
            tex.Apply();
            cachedMenuSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedMenuSprite;
        }

        private void OnDestroy()
        {
            if (soundButton != null)
                soundButton.onClick.RemoveListener(OnSoundButtonClicked);

            if (menuButton != null)
                menuButton.onClick.RemoveListener(OnMenuButtonClicked);

            if (helpButton != null)
                helpButton.onClick.RemoveListener(OnHelpButtonClicked);
        }

        public void UpdateScore(int score)
        {
            if (scoreText == null) return;

            scoreText.text = TileHelper.FormatValue(score);
            scoreText.fontSize = (int)CalculateScoreFontSize(score);
        }

        public void UpdateHighScore(int score)
        {
            if (highScoreText == null) return;

            highScoreText.text = "HI-SCORE " + TileHelper.FormatValue(score);
        }

        private void OnSoundButtonClicked()
        {
            isSoundOn = !isSoundOn;

            if (soundIcon != null)
                soundIcon.sprite = isSoundOn ? soundOnSprite : soundOffSprite;

            AudioListener.volume = isSoundOn ? 1f : 0f;
        }

        private void OnMenuButtonClicked()
        {
            Debug.Log("[HUDManager] Menu button clicked");
        }

        private void OnHelpButtonClicked()
        {
            Debug.Log("[HUDManager] Help button clicked");
        }

        private float CalculateScoreFontSize(int score)
        {
            if (score < 1000) return baseScoreFontSize;
            if (score < 10000) return baseScoreFontSize * 0.9f;
            if (score < 100000) return baseScoreFontSize * 0.8f;
            if (score < 1000000) return baseScoreFontSize * 0.7f;

            return Mathf.Max(minScoreFontSize, baseScoreFontSize * 0.6f);
        }
    }
}
