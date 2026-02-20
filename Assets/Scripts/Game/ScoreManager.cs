using System;
using UnityEngine;

namespace HexaMerge.Game
{
    public class ScoreManager
    {
        private const string HIGH_SCORE_KEY = "HighScore";

        public double CurrentScore { get; private set; }
        public double HighScore { get; private set; }

        public event Action<double> OnScoreChanged;
        public event Action<double> OnHighScoreChanged;

        public ScoreManager()
        {
            CurrentScore = 0;
            string saved = PlayerPrefs.GetString(HIGH_SCORE_KEY, "0");
            double hs;
            HighScore = double.TryParse(saved, out hs) ? hs : 0;
        }

        public void AddScore(double points)
        {
            if (points <= 0) return;

            CurrentScore += points;
            OnScoreChanged?.Invoke(CurrentScore);

            if (CurrentScore > HighScore)
            {
                HighScore = CurrentScore;
                SaveHighScore();
                OnHighScoreChanged?.Invoke(HighScore);
            }
        }

        public void Reset()
        {
            CurrentScore = 0;
            OnScoreChanged?.Invoke(CurrentScore);
        }

        /// <summary>
        /// 최고 점수를 메모리와 PlayerPrefs 양쪽에서 리셋합니다 (테스트용).
        /// </summary>
        public void ResetHighScore()
        {
            HighScore = 0;
            PlayerPrefs.SetString(HIGH_SCORE_KEY, "0");
            PlayerPrefs.Save();
            OnHighScoreChanged?.Invoke(HighScore);
        }

        /// <summary>
        /// 최고 점수를 직접 설정합니다 (테스트용).
        /// </summary>
        public void SetHighScore(double value)
        {
            HighScore = value;
            PlayerPrefs.SetString(HIGH_SCORE_KEY, value.ToString("R"));
            PlayerPrefs.Save();
            OnHighScoreChanged?.Invoke(HighScore);
        }

        public void SaveHighScore()
        {
            PlayerPrefs.SetString(HIGH_SCORE_KEY, HighScore.ToString("R"));
            PlayerPrefs.Save();
        }
    }
}
