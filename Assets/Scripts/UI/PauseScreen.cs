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

        private static Sprite cachedSunSprite;
        private static Sprite cachedMoonSprite;

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
        }

        private void OnFavoriteClicked()
        {
            PlayClick();
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

        private static Sprite GetOrCreateMoonSprite()
        {
            if (cachedMoonSprite != null) return cachedMoonSprite;
            int s = 64;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, false);
            Color32[] px = new Color32[s * s];
            Color32 w = new Color32(255, 255, 255, 255);
            Color32 c = new Color32(0, 0, 0, 0);
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
                    px[y * s + x] = inMoon ? w : c;
                }
            tex.SetPixels32(px);
            tex.Apply();
            cachedMoonSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedMoonSprite;
        }

        private static Sprite GetOrCreateSunSprite()
        {
            if (cachedSunSprite != null) return cachedSunSprite;
            int s = 64;
            Texture2D tex = new Texture2D(s, s, TextureFormat.RGBA32, false);
            Color32[] px = new Color32[s * s];
            Color32 w = new Color32(255, 255, 255, 255);
            Color32 c = new Color32(0, 0, 0, 0);
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
                    px[y * s + x] = c;
                }
            tex.SetPixels32(px);
            tex.Apply();
            cachedSunSprite = Sprite.Create(tex, new Rect(0, 0, s, s), new Vector2(0.5f, 0.5f), 100f);
            return cachedSunSprite;
        }
    }
}
