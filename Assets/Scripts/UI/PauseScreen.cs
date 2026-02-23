namespace HexaMerge.UI
{
    using HexaMerge.Game;
    using HexaMerge.Audio;
    using UnityEngine;
    using UnityEngine.UI;

    public class PauseScreen : MonoBehaviour
    {
        [SerializeField] private Button continueButton;
        [SerializeField] private Button restartButton;
        [SerializeField] private Button rateButton;
        [SerializeField] private Button favoriteButton;
        [SerializeField] private Button themeButton;
        [SerializeField] private Button leaderboardButton;
        [SerializeField] private Image themeButtonImage;
        [SerializeField] private Image rateIconImage;
        [SerializeField] private Image favoriteIconImage;
        [SerializeField] private Image leaderboardIconImage;

        private static Sprite cachedSunSprite;
        private static Sprite cachedMoonSprite;
        private static Sprite cachedStarSprite;
        private static Sprite cachedFilledHeartSprite;
        private static Sprite cachedEmptyHeartSprite;
        private static Sprite cachedTrophySprite;

        private bool isFavorited;

        private void OnEnable()
        {
            if (continueButton != null)
                continueButton.onClick.AddListener(OnContinueClicked);
            if (restartButton != null)
                restartButton.onClick.AddListener(OnRestartClicked);
            if (themeButton != null)
                themeButton.onClick.AddListener(OnThemeClicked);
            if (leaderboardButton != null)
                leaderboardButton.onClick.AddListener(OnLeaderboardClicked);
            if (rateButton != null)
                rateButton.onClick.AddListener(OnRateClicked);
            if (favoriteButton != null)
                favoriteButton.onClick.AddListener(OnFavoriteClicked);

            isFavorited = PlayerPrefs.GetInt("IsFavorite", 0) == 1;
            InitializeIcons();
            UpdateThemeIcon();
        }

        private void OnDisable()
        {
            if (continueButton != null)
                continueButton.onClick.RemoveListener(OnContinueClicked);
            if (restartButton != null)
                restartButton.onClick.RemoveListener(OnRestartClicked);
            if (themeButton != null)
                themeButton.onClick.RemoveListener(OnThemeClicked);
            if (leaderboardButton != null)
                leaderboardButton.onClick.RemoveListener(OnLeaderboardClicked);
            if (rateButton != null)
                rateButton.onClick.RemoveListener(OnRateClicked);
            if (favoriteButton != null)
                favoriteButton.onClick.RemoveListener(OnFavoriteClicked);
        }

        private void InitializeIcons()
        {
            if (rateIconImage != null)
                rateIconImage.sprite = GetOrCreateStarSprite();
            if (leaderboardIconImage != null)
                leaderboardIconImage.sprite = GetOrCreateTrophySprite();
            UpdateFavoriteIcon();
        }

        private void OnContinueClicked()
        {
            PlayClick();
            if (GameManager.Instance != null)
                GameManager.Instance.ResumeGame();
            if (ScreenManager.Instance != null)
                ScreenManager.Instance.ShowScreen(ScreenType.Gameplay);
        }

        private void OnRestartClicked()
        {
            PlayClick();
            if (GameManager.Instance != null)
                GameManager.Instance.StartNewGame();
            if (ScreenManager.Instance != null)
                ScreenManager.Instance.ShowScreen(ScreenType.Gameplay);
        }

        private void OnThemeClicked()
        {
            PlayClick();
            if (ThemeManager.Instance != null)
                ThemeManager.Instance.ToggleTheme();
            UpdateThemeIcon();
        }

        private void OnLeaderboardClicked()
        {
            PlayClick();
            if (ScreenManager.Instance != null)
                ScreenManager.Instance.ShowScreen(ScreenType.Leaderboard);
        }

        private void OnRateClicked()
        {
            PlayClick();
            Application.OpenURL("https://jflakeee.github.io/hexa_merge_base/");
        }

        private void OnFavoriteClicked()
        {
            PlayClick();
            isFavorited = !isFavorited;
            PlayerPrefs.SetInt("IsFavorite", isFavorited ? 1 : 0);
            PlayerPrefs.Save();
            UpdateFavoriteIcon();
        }

        private void UpdateFavoriteIcon()
        {
            if (favoriteIconImage != null)
                favoriteIconImage.sprite = isFavorited
                    ? GetOrCreateFilledHeartSprite()
                    : GetOrCreateEmptyHeartSprite();
        }

        private void UpdateThemeIcon()
        {
            if (themeButtonImage == null) return;
            bool isDark = ThemeManager.Instance == null || ThemeManager.Instance.IsDarkMode;
            themeButtonImage.sprite = isDark ? GetOrCreateMoonSprite() : GetOrCreateSunSprite();
        }

        private void PlayClick()
        {
            if (AudioManager.Instance != null)
                AudioManager.Instance.PlaySFX(SFXType.ButtonClick);
        }

        // ==================== Star Sprite (Rate) ====================

        private static Sprite GetOrCreateStarSprite()
        {
            if (cachedStarSprite != null) return cachedStarSprite;
            int s = 128;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
            Color32[] px = new Color32[s * s];
            Color32 w = new Color32(255, 255, 255, 255);
            Color32 cl = new Color32(0, 0, 0, 0);
            float cx = s * 0.5f, cy = s * 0.5f;
            float outerR = s * 0.42f;
            float innerR = s * 0.18f;

            float[] vx = new float[10];
            float[] vy = new float[10];
            for (int i = 0; i < 10; i++)
            {
                float angle = Mathf.Deg2Rad * (i * 36f - 90f);
                float r = (i % 2 == 0) ? outerR : innerR;
                vx[i] = cx + r * Mathf.Cos(angle);
                vy[i] = cy + r * Mathf.Sin(angle);
            }

            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                    px[y * s + x] = PointInPolygon(x + 0.5f, y + 0.5f, vx, vy, 10) ? w : cl;

            tex.SetPixels32(px);
            tex.Apply();
            cachedStarSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedStarSprite;
        }

        // ==================== Heart Sprites (Favorite) ====================

        private static Sprite GetOrCreateFilledHeartSprite()
        {
            if (cachedFilledHeartSprite != null) return cachedFilledHeartSprite;
            cachedFilledHeartSprite = CreateHeartSprite(true);
            return cachedFilledHeartSprite;
        }

        private static Sprite GetOrCreateEmptyHeartSprite()
        {
            if (cachedEmptyHeartSprite != null) return cachedEmptyHeartSprite;
            cachedEmptyHeartSprite = CreateHeartSprite(false);
            return cachedEmptyHeartSprite;
        }

        private static Sprite CreateHeartSprite(bool filled)
        {
            int s = 128;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
            Color32[] px = new Color32[s * s];
            Color32 w = new Color32(255, 255, 255, 255);
            Color32 cl = new Color32(0, 0, 0, 0);
            float centerX = s * 0.5f;
            float centerY = s * 0.48f;
            float scale = s * 0.3f;

            bool[] inside = new bool[s * s];
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    float nx = (x - centerX) / scale;
                    float ny = -(y - centerY) / scale;
                    inside[y * s + x] = HeartImplicit(nx, ny) <= 0f;
                }

            if (filled)
            {
                for (int i = 0; i < s * s; i++)
                    px[i] = inside[i] ? w : cl;
            }
            else
            {
                int thickness = Mathf.Max(3, Mathf.RoundToInt(s * 3f / 64f));
                for (int y = 0; y < s; y++)
                    for (int x = 0; x < s; x++)
                    {
                        if (!inside[y * s + x]) { px[y * s + x] = cl; continue; }
                        bool isEdge = false;
                        for (int dy = -thickness; dy <= thickness && !isEdge; dy++)
                            for (int dx = -thickness; dx <= thickness && !isEdge; dx++)
                            {
                                int ny2 = y + dy, nx2 = x + dx;
                                if (nx2 < 0 || nx2 >= s || ny2 < 0 || ny2 >= s)
                                    isEdge = true;
                                else if (!inside[ny2 * s + nx2])
                                    isEdge = true;
                            }
                        px[y * s + x] = isEdge ? w : cl;
                    }
            }

            tex.SetPixels32(px);
            tex.Apply();
            return Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
        }

        private static float HeartImplicit(float x, float y)
        {
            float x2 = x * x;
            float y2 = y * y;
            float sum = x2 + y2 - 1f;
            return sum * sum * sum - x2 * y2 * y;
        }

        // ==================== Trophy Sprite (Leaderboard) ====================

        private static Sprite GetOrCreateTrophySprite()
        {
            if (cachedTrophySprite != null) return cachedTrophySprite;
            int s = 128;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
            Color32[] px = new Color32[s * s];
            Color32 w = new Color32(255, 255, 255, 255);
            Color32 cl = new Color32(0, 0, 0, 0);
            float cx = s * 0.5f;
            float sc = s / 64f; // scale factor for absolute coords

            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    px[y * s + x] = cl;
                    float fy = s - 1 - y; // flip Y (0 = bottom of texture)

                    // Base plate
                    if (fy >= 8f * sc && fy <= 12f * sc)
                    {
                        if (Mathf.Abs(x - cx) <= 15f * sc)
                            px[y * s + x] = w;
                    }
                    // Pedestal (tapering up)
                    if (fy >= 12f * sc && fy <= 18f * sc)
                    {
                        float t = (fy - 12f * sc) / (6f * sc);
                        float halfW = Mathf.Lerp(12f * sc, 7f * sc, t);
                        if (Mathf.Abs(x - cx) <= halfW)
                            px[y * s + x] = w;
                    }
                    // Stem
                    if (fy >= 18f * sc && fy <= 26f * sc)
                    {
                        if (Mathf.Abs(x - cx) <= 3f * sc)
                            px[y * s + x] = w;
                    }
                    // Cup body (widening up)
                    if (fy >= 26f * sc && fy <= 50f * sc)
                    {
                        float t = (fy - 26f * sc) / (24f * sc);
                        float halfW = Mathf.Lerp(10f * sc, 18f * sc, t);
                        if (Mathf.Abs(x - cx) <= halfW)
                            px[y * s + x] = w;
                    }
                    // Cup rim
                    if (fy >= 48f * sc && fy <= 52f * sc)
                    {
                        if (Mathf.Abs(x - cx) <= 20f * sc)
                            px[y * s + x] = w;
                    }
                    // Handles: arcs at sides
                    if (fy >= 32f * sc && fy <= 48f * sc)
                    {
                        float hcy = 40f * sc;
                        float hdy = fy - hcy;
                        float lhcx = cx - 18f * sc;
                        float lhdx = x - lhcx;
                        float ldist = Mathf.Sqrt(lhdx * lhdx + hdy * hdy);
                        if (ldist >= 7f * sc && ldist <= 11f * sc && x < cx - 10f * sc)
                            px[y * s + x] = w;
                        float rhcx = cx + 18f * sc;
                        float rhdx = x - rhcx;
                        float rdist = Mathf.Sqrt(rhdx * rhdx + hdy * hdy);
                        if (rdist >= 7f * sc && rdist <= 11f * sc && x > cx + 10f * sc)
                            px[y * s + x] = w;
                    }
                }

            tex.SetPixels32(px);
            tex.Apply();
            cachedTrophySprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedTrophySprite;
        }

        // ==================== Moon Sprite (Theme) ====================

        private static Sprite GetOrCreateMoonSprite()
        {
            if (cachedMoonSprite != null) return cachedMoonSprite;
            int s = 128;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
            Color32[] px = new Color32[s * s];
            Color32 w = new Color32(255, 255, 255, 255);
            Color32 cl = new Color32(0, 0, 0, 0);
            float cx = s * 0.5f, cy = s * 0.5f;
            float r1 = s * 0.38f;
            float r2 = s * 0.3f;
            float ox = s * 0.2f;
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    float dx1 = x - cx, dy1 = y - cy;
                    float dx2 = x - (cx + ox), dy2 = y - cy;
                    bool inMoon = (dx1 * dx1 + dy1 * dy1 <= r1 * r1) &&
                                  (dx2 * dx2 + dy2 * dy2 > r2 * r2);
                    px[y * s + x] = inMoon ? w : cl;
                }
            tex.SetPixels32(px);
            tex.Apply();
            cachedMoonSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedMoonSprite;
        }

        // ==================== Sun Sprite (Theme) ====================

        private static Sprite GetOrCreateSunSprite()
        {
            if (cachedSunSprite != null) return cachedSunSprite;
            int s = 128;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, true);
            tex.filterMode = FilterMode.Bilinear;
            Color32[] px = new Color32[s * s];
            Color32 w = new Color32(255, 255, 255, 255);
            Color32 cl = new Color32(0, 0, 0, 0);
            float cx = s * 0.5f, cy = s * 0.5f;
            float coreR = s * 0.22f;
            float rayInner = s * 0.3f, rayOuter = s * 0.42f;
            for (int y = 0; y < s; y++)
                for (int x = 0; x < s; x++)
                {
                    float dx = x - cx, dy = y - cy;
                    float dist = Mathf.Sqrt(dx * dx + dy * dy);
                    if (dist <= coreR) { px[y * s + x] = w; continue; }
                    if (dist >= rayInner && dist <= rayOuter)
                    {
                        float angle = Mathf.Atan2(dy, dx) * Mathf.Rad2Deg;
                        if (angle < 0) angle += 360f;
                        float seg = angle % 45f;
                        if (seg < 15f) { px[y * s + x] = w; continue; }
                    }
                    px[y * s + x] = cl;
                }
            tex.SetPixels32(px);
            tex.Apply();
            cachedSunSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedSunSprite;
        }

        // ==================== Geometry Helpers ====================

        private static bool PointInPolygon(float px, float py, float[] vx, float[] vy, int n)
        {
            bool inside = false;
            for (int i = 0, j = n - 1; i < n; j = i++)
            {
                if (((vy[i] > py) != (vy[j] > py)) &&
                    (px < (vx[j] - vx[i]) * (py - vy[i]) / (vy[j] - vy[i]) + vx[i]))
                    inside = !inside;
            }
            return inside;
        }
    }
}
