namespace HexaMerge.UI
{
    using HexaMerge.Core;
    using HexaMerge.Game;
    using HexaMerge.Audio;
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

            // Sync mute state from AudioManager
            if (AudioManager.Instance != null)
                isSoundOn = !AudioManager.Instance.IsMuted;

            // Subscribe to theme changes
            if (ThemeManager.Instance != null)
            {
                ThemeManager.Instance.OnThemeChanged += OnThemeChanged;
                ApplyThemeColors();
            }

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
                img.sprite = GetOrCreateHexButtonSprite(128);

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
                iconRT.anchorMin = new Vector2(0.1f, 0.1f);
                iconRT.anchorMax = new Vector2(0.9f, 0.9f);
                iconRT.offsetMin = Vector2.zero;
                iconRT.offsetMax = Vector2.zero;

                Image iconImg = iconObj.AddComponent<Image>();
                iconImg.raycastTarget = false;
                iconImg.preserveAspect = true;
                iconImg.color = Color.white;

                if (iconType == "sound")
                {
                    iconImg.sprite = GetOrCreateSpeakerOnSprite();
                    soundIcon = iconImg;
                    soundOnSprite = GetOrCreateSpeakerOnSprite();
                    soundOffSprite = GetOrCreateSpeakerOffSprite();
                    // Apply initial mute state
                    if (AudioManager.Instance != null && AudioManager.Instance.IsMuted)
                        iconImg.sprite = soundOffSprite;
                }
                else if (iconType == "menu")
                    iconImg.sprite = GetOrCreateMenuSprite();
            }
        }

        private static Sprite GetOrCreateHexButtonSprite(int size)
        {
            if (cachedHexButtonSprite != null) return cachedHexButtonSprite;

            int texW = size;
            int texH = Mathf.RoundToInt(size * Mathf.Sqrt(3f) / 2f);
            Texture2D tex = new Texture2D(texW, texH, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
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

        private static Sprite cachedSpeakerOnSprite;
        private static Sprite cachedSpeakerOffSprite;
        private static Sprite cachedMenuSprite;

        private static void DrawSpeakerBase(Color32[] px, int s, Color32 white)
        {
            float cx = s * 0.5f;
            float cy = s * 0.5f;

            // Speaker body (rounded rectangle, left side)
            float bodyL = s * 0.08f;
            float bodyR = s * 0.28f;
            float bodyT = cy + s * 0.14f;
            float bodyB = cy - s * 0.14f;
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                    if (x >= bodyL && x <= bodyR && y >= bodyB && y <= bodyT)
                        px[y * s + x] = white;

            // Speaker cone (trapezoid pointing right)
            float coneL = bodyR;
            float coneR = s * 0.52f;
            float coneNarrowH = s * 0.14f;
            float coneWideH = s * 0.34f;
            for (int y = 0; y < s; y++)
            {
                for (int x = (int)coneL; x <= (int)coneR && x < s; x++)
                {
                    float t = (x - coneL) / (coneR - coneL);
                    float halfH = Mathf.Lerp(coneNarrowH, coneWideH, t);
                    if (y >= cy - halfH && y <= cy + halfH)
                        px[y * s + x] = white;
                }
            }
        }

        private static void DrawArc(Color32[] px, int s, Color32 white,
            float arcCx, float cy, float radius, float thickness, float maxAngle)
        {
            for (int y = 0; y < s; y++)
            {
                for (int x = 0; x < s; x++)
                {
                    float dx = x - arcCx;
                    float dy = y - cy;
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);
                    if (Mathf.Abs(dist - radius) <= thickness)
                    {
                        float angle = Mathf.Atan2(Mathf.Abs(dy), dx);
                        if (angle <= maxAngle)
                            px[y * s + x] = white;
                    }
                }
            }
        }

        private static Sprite GetOrCreateSpeakerOnSprite()
        {
            if (cachedSpeakerOnSprite != null) return cachedSpeakerOnSprite;

            int s = 128;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
            Color32[] px = new Color32[s * s];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);
            for (int i = 0; i < px.Length; i++) px[i] = clear;

            DrawSpeakerBase(px, s, white);

            float cy = s * 0.5f;
            float arcX = s * 0.52f;
            float arcThick = s * 1.8f / 64f;
            // Inner arc
            DrawArc(px, s, white, arcX, cy, s * 0.16f, arcThick, Mathf.PI * 0.35f);
            // Outer arc
            DrawArc(px, s, white, arcX, cy, s * 0.28f, arcThick, Mathf.PI * 0.35f);

            tex.SetPixels32(px);
            tex.Apply();
            cachedSpeakerOnSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedSpeakerOnSprite;
        }

        private static Sprite GetOrCreateSpeakerOffSprite()
        {
            if (cachedSpeakerOffSprite != null) return cachedSpeakerOffSprite;

            int s = 128;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
            Color32[] px = new Color32[s * s];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);
            for (int i = 0; i < px.Length; i++) px[i] = clear;

            DrawSpeakerBase(px, s, white);

            // X mark on the right side
            float xCen = s * 0.72f;
            float yCen = s * 0.5f;
            float xLen = s * 0.15f;
            float thick = s * 2.5f / 64f;
            for (int y = 0; y < s; y++)
            {
                for (int x = 0; x < s; x++)
                {
                    float dx = x - xCen;
                    float dy = y - yCen;
                    // Diagonal 1
                    float d1 = Mathf.Abs(dx - dy) / 1.414f;
                    // Diagonal 2
                    float d2 = Mathf.Abs(dx + dy) / 1.414f;
                    if ((d1 <= thick || d2 <= thick) &&
                        Mathf.Abs(dx) <= xLen && Mathf.Abs(dy) <= xLen)
                        px[y * s + x] = white;
                }
            }

            tex.SetPixels32(px);
            tex.Apply();
            cachedSpeakerOffSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedSpeakerOffSprite;
        }

        private static Sprite GetOrCreateSpeakerSprite()
        {
            return GetOrCreateSpeakerOnSprite();
        }

        private static Sprite GetOrCreateMenuSprite()
        {
            if (cachedMenuSprite != null) return cachedMenuSprite;

            int s = 128;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
            Color32[] px = new Color32[s * s];
            Color32 white = new Color32(255, 255, 255, 255);
            Color32 clear = new Color32(0, 0, 0, 0);
            for (int i = 0; i < px.Length; i++) px[i] = clear;

            // Three horizontal bars (hamburger menu) — ratio-based
            int barH = Mathf.RoundToInt(s * 3f / 32f);
            int barLeft = Mathf.RoundToInt(s * 6f / 32f);
            int barRight = Mathf.RoundToInt(s * 26f / 32f);
            int[] barCenters = new int[] {
                Mathf.RoundToInt(s * 8f / 32f),
                Mathf.RoundToInt(s * 16f / 32f),
                Mathf.RoundToInt(s * 24f / 32f)
            };

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

            if (ThemeManager.Instance != null)
                ThemeManager.Instance.OnThemeChanged -= OnThemeChanged;
        }

        private void OnThemeChanged(bool isDark)
        {
            ApplyThemeColors();
        }

        private void ApplyThemeColors()
        {
            if (ThemeManager.Instance == null) return;

            Color sc = ThemeManager.Instance.GetScoreColor();
            Color hc = ThemeManager.Instance.GetHiScoreColor();

            if (scoreText != null)
                scoreText.color = sc;
            if (highScoreText != null)
                highScoreText.color = hc;
        }

        public void UpdateScore(double score)
        {
            if (scoreText == null) return;

            scoreText.text = TileHelper.FormatValue(score);
            scoreText.fontSize = (int)CalculateScoreFontSize(score);
        }

        public void UpdateHighScore(double score)
        {
            if (highScoreText == null) return;

            highScoreText.text = "HI-SCORE " + TileHelper.FormatValue(score);
        }

        private void OnSoundButtonClicked()
        {
            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlaySFX(SFXType.ButtonClick);
                AudioManager.Instance.ToggleMute();
                isSoundOn = !AudioManager.Instance.IsMuted;
            }
            else
            {
                isSoundOn = !isSoundOn;
                AudioListener.volume = isSoundOn ? 1f : 0f;
            }

            if (soundIcon != null)
                soundIcon.sprite = isSoundOn ? soundOnSprite : soundOffSprite;
        }

        private void OnMenuButtonClicked()
        {
            if (AudioManager.Instance != null)
                AudioManager.Instance.PlaySFX(SFXType.ButtonClick);

            if (GameManager.Instance != null)
                GameManager.Instance.PauseGame();

            if (ScreenManager.Instance != null)
                ScreenManager.Instance.ShowScreen(ScreenType.Pause);
        }

        private void OnHelpButtonClicked()
        {
            if (AudioManager.Instance != null)
                AudioManager.Instance.PlaySFX(SFXType.ButtonClick);

            if (ScreenManager.Instance != null)
                ScreenManager.Instance.ShowScreen(ScreenType.HowToPlay);
        }

        private float CalculateScoreFontSize(double score)
        {
            if (score < 1000) return baseScoreFontSize;
            if (score < 10000) return baseScoreFontSize * 0.9f;
            if (score < 100000) return baseScoreFontSize * 0.8f;
            if (score < 1000000) return baseScoreFontSize * 0.7f;

            return Mathf.Max(minScoreFontSize, baseScoreFontSize * 0.6f);
        }
    }
}
