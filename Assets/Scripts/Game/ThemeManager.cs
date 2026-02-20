namespace HexaMerge.Game
{
    using UnityEngine;
    using UnityEngine.UI;
    using System;

    public class ThemeManager : MonoBehaviour
    {
        public static ThemeManager Instance { get; private set; }

        public bool IsDarkMode { get; private set; } = true;

        public event Action<bool> OnThemeChanged;

        [SerializeField] private Image backgroundImage;
        [SerializeField] private Camera mainCamera;

        // Dark palette
        public static readonly Color DarkBg = Color.black;
        public static readonly Color DarkPanelBg = new Color(0f, 0f, 0f, 0.85f);
        public static readonly Color DarkScoreText = new Color(0.914f, 0.118f, 0.388f, 1f);
        public static readonly Color DarkHiScoreText = new Color(0.6f, 0.6f, 0.6f, 1f);
        public static readonly Color DarkLogoX = Color.white;
        public static readonly Color DarkHiScoreLabel = new Color(0.6f, 0.6f, 0.6f, 1f);

        // Light palette
        public static readonly Color LightBg = new Color(0.96f, 0.96f, 0.97f, 1f);
        public static readonly Color LightPanelBg = new Color(1f, 1f, 1f, 0.95f);
        public static readonly Color LightScoreText = new Color(0.55f, 0.15f, 0.72f, 1f);
        public static readonly Color LightHiScoreText = new Color(0.35f, 0.35f, 0.35f, 1f);
        public static readonly Color LightLogoX = new Color(0.55f, 0.15f, 0.72f, 1f);
        public static readonly Color LightHiScoreLabel = new Color(0.5f, 0.5f, 0.5f, 1f);

        private const string ThemeKey = "IsDarkMode";

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;

            IsDarkMode = PlayerPrefs.GetInt(ThemeKey, 1) == 1;
        }

        private void Start()
        {
            ApplyTheme();
        }

        public void ToggleTheme()
        {
            IsDarkMode = !IsDarkMode;
            PlayerPrefs.SetInt(ThemeKey, IsDarkMode ? 1 : 0);
            PlayerPrefs.Save();

            ApplyTheme();
            OnThemeChanged?.Invoke(IsDarkMode);
        }

        public void ApplyTheme()
        {
            Color bg = IsDarkMode ? DarkBg : LightBg;

            if (backgroundImage != null)
                backgroundImage.color = bg;
            if (mainCamera != null)
                mainCamera.backgroundColor = bg;
        }

        public Color GetBgColor() { return IsDarkMode ? DarkBg : LightBg; }
        public Color GetScoreColor() { return IsDarkMode ? DarkScoreText : LightScoreText; }
        public Color GetHiScoreColor() { return IsDarkMode ? DarkHiScoreText : LightHiScoreText; }
        public Color GetHiScoreLabelColor() { return IsDarkMode ? DarkHiScoreLabel : LightHiScoreLabel; }
        public Color GetLogoXColor() { return IsDarkMode ? DarkLogoX : LightLogoX; }
        public Color GetPanelBgColor() { return IsDarkMode ? DarkPanelBg : LightPanelBg; }
    }
}
