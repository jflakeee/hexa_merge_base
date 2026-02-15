namespace HexaMerge.UI
{
    using HexaMerge.Game;
    using HexaMerge.Audio;
    using UnityEngine;
    using UnityEngine.UI;

    public class PauseScreen : MonoBehaviour
    {
        [SerializeField] private Button resumeButton;
        [SerializeField] private Button restartButton;
        [SerializeField] private Button soundToggleButton;
        [SerializeField] private Image soundToggleIcon;
        [SerializeField] private Sprite soundOnSprite;
        [SerializeField] private Sprite soundOffSprite;
        [SerializeField] private Text currentScoreText;

        private void OnEnable()
        {
            if (resumeButton != null)
                resumeButton.onClick.AddListener(OnResumeClicked);
            if (restartButton != null)
                restartButton.onClick.AddListener(OnRestartClicked);
            if (soundToggleButton != null)
                soundToggleButton.onClick.AddListener(OnSoundToggleClicked);

            UpdateUI();
        }

        private void OnDisable()
        {
            if (resumeButton != null)
                resumeButton.onClick.RemoveListener(OnResumeClicked);
            if (restartButton != null)
                restartButton.onClick.RemoveListener(OnRestartClicked);
            if (soundToggleButton != null)
                soundToggleButton.onClick.RemoveListener(OnSoundToggleClicked);
        }

        private void UpdateUI()
        {
            if (GameManager.Instance != null && currentScoreText != null)
                currentScoreText.text = GameManager.Instance.Score.CurrentScore.ToString("N0");

            UpdateSoundIcon();
        }

        private void UpdateSoundIcon()
        {
            if (soundToggleIcon == null) return;
            bool muted = AudioManager.Instance != null && AudioManager.Instance.IsMuted;
            soundToggleIcon.sprite = muted ? soundOffSprite : soundOnSprite;
        }

        private void OnResumeClicked()
        {
            GameManager.Instance.ResumeGame();
            ScreenManager.Instance.ShowScreen(ScreenType.Gameplay);
        }

        private void OnRestartClicked()
        {
            GameManager.Instance.StartNewGame();
            ScreenManager.Instance.ShowScreen(ScreenType.Gameplay);
        }

        private void OnSoundToggleClicked()
        {
            if (AudioManager.Instance != null)
                AudioManager.Instance.ToggleMute();
            UpdateSoundIcon();
        }
    }
}
