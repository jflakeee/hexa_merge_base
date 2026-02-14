namespace HexaMerge.UI
{
    using UnityEngine;
    using UnityEngine.UI;
    using TMPro;

    public class HUDManager : MonoBehaviour
    {
        [Header("Score")]
        [SerializeField] private TextMeshProUGUI scoreText;
        [SerializeField] private TextMeshProUGUI highScoreText;

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
        [SerializeField] private Color scoreColor = new Color(1f, 0.41f, 0.71f, 1f); // #FF69B4 핑크
        [SerializeField] private Color highScoreColor = new Color(0.6f, 0.6f, 0.6f, 1f); // 회색

        [Header("Score Font Sizes")]
        [SerializeField] private float baseScoreFontSize = 64f;
        [SerializeField] private float minScoreFontSize = 36f;

        private bool isSoundOn = true;

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

            UpdateScore(0);
            UpdateHighScore(0);
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

            scoreText.text = score.ToString("N0");
            scoreText.fontSize = CalculateScoreFontSize(score);
        }

        public void UpdateHighScore(int score)
        {
            if (highScoreText == null) return;

            highScoreText.text = $"HI-SCORE {score:N0}";
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
