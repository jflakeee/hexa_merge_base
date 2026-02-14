using System;
using UnityEngine;

namespace HexaMerge.Game
{
    public class ScoreManager
    {
        private const string HIGH_SCORE_KEY = "HighScore";

        public int CurrentScore { get; private set; }
        public int HighScore { get; private set; }

        public event Action<int> OnScoreChanged;
        public event Action<int> OnHighScoreChanged;

        public ScoreManager()
        {
            CurrentScore = 0;
            HighScore = PlayerPrefs.GetInt(HIGH_SCORE_KEY, 0);
        }

        public void AddScore(int points)
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
            PlayerPrefs.SetInt(HIGH_SCORE_KEY, 0);
            PlayerPrefs.Save();
            OnHighScoreChanged?.Invoke(HighScore);
        }

        /// <summary>
        /// 최고 점수를 직접 설정합니다 (테스트용).
        /// </summary>
        public void SetHighScore(int value)
        {
            HighScore = value;
            PlayerPrefs.SetInt(HIGH_SCORE_KEY, value);
            PlayerPrefs.Save();
            OnHighScoreChanged?.Invoke(HighScore);
        }

        public void SaveHighScore()
        {
            PlayerPrefs.SetInt(HIGH_SCORE_KEY, HighScore);
            PlayerPrefs.Save();
        }
    }
}
