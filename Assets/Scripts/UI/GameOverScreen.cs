namespace HexaMerge.UI
{
    using HexaMerge.Game;
    using UnityEngine;
    using UnityEngine.UI;

    public class GameOverScreen : MonoBehaviour
    {
        [SerializeField] private GameObject panel;
        [SerializeField] private Text finalScoreText;
        [SerializeField] private Text highScoreText;
        [SerializeField] private Text newRecordLabel;
        [SerializeField] private Button restartButton;
        [SerializeField] private Button watchAdButton;
        [SerializeField] private CanvasGroup canvasGroup;

        private void Start()
        {
            if (restartButton != null)
                restartButton.onClick.AddListener(OnRestartClicked);
            if (watchAdButton != null)
                watchAdButton.onClick.AddListener(OnWatchAdClicked);

            Hide();

            if (GameManager.Instance != null)
                GameManager.Instance.OnStateChanged += OnGameStateChanged;
        }

        private void OnDestroy()
        {
            if (GameManager.Instance != null)
                GameManager.Instance.OnStateChanged -= OnGameStateChanged;
        }

        private void OnGameStateChanged(GameState state)
        {
            if (state == GameState.GameOver)
                Show();
            else
                Hide();
        }

        public void Show()
        {
            panel.SetActive(true);

            var score = GameManager.Instance.Score;
            if (finalScoreText != null)
                finalScoreText.text = score.CurrentScore.ToString("N0");
            if (highScoreText != null)
                highScoreText.text = score.HighScore.ToString("N0");
            if (newRecordLabel != null)
                newRecordLabel.gameObject.SetActive(score.CurrentScore >= score.HighScore);

            if (canvasGroup != null)
                StartCoroutine(FadeIn());
        }

        public void Hide()
        {
            panel.SetActive(false);
            if (canvasGroup != null)
                canvasGroup.alpha = 0f;
        }

        private System.Collections.IEnumerator FadeIn()
        {
            canvasGroup.alpha = 0f;
            float elapsed = 0f;
            float duration = 0.5f;
            while (elapsed < duration)
            {
                elapsed += Time.deltaTime;
                canvasGroup.alpha = Mathf.Clamp01(elapsed / duration);
                yield return null;
            }
            canvasGroup.alpha = 1f;
        }

        private void OnRestartClicked()
        {
            GameManager.Instance.StartNewGame();
        }

        private void OnWatchAdClicked()
        {
            // TODO: 보상형 광고 연동
            Debug.Log("[GameOverScreen] Watch ad for continue - not implemented");
        }
    }
}
