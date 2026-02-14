namespace HexaMerge.UI
{
    using HexaMerge.Audio;
    using UnityEngine;
    using UnityEngine.UI;
    using TMPro;
    using System;
    using System.Collections.Generic;

    /// <summary>
    /// 리더보드 화면. 상위 점수를 표시하고 PlayerPrefs에 JSON으로 저장합니다.
    /// </summary>
    public class LeaderboardScreen : MonoBehaviour
    {
        [Serializable]
        public struct LeaderboardEntry
        {
            public int rank;
            public int score;
            public string date;
        }

        [Serializable]
        private struct LeaderboardData
        {
            public List<LeaderboardEntry> entries;
        }

        [SerializeField] private Transform entryContainer;
        [SerializeField] private GameObject entryPrefab;
        [SerializeField] private Button closeButton;
        [SerializeField] private Button clearButton;
        [SerializeField] private TextMeshProUGUI titleText;
        [SerializeField] private int maxEntries = 10;

        private List<LeaderboardEntry> entries = new List<LeaderboardEntry>();
        private readonly List<GameObject> spawnedEntries = new List<GameObject>();

        private const string LEADERBOARD_KEY = "Leaderboard";

        private void OnEnable()
        {
            LoadEntries();
            RefreshUI();

            if (closeButton != null)
                closeButton.onClick.AddListener(OnCloseClicked);
            if (clearButton != null)
                clearButton.onClick.AddListener(OnClearClicked);
        }

        private void OnDisable()
        {
            if (closeButton != null)
                closeButton.onClick.RemoveListener(OnCloseClicked);
            if (clearButton != null)
                clearButton.onClick.RemoveListener(OnClearClicked);
        }

        /// <summary>
        /// 새 점수를 리더보드에 추가합니다.
        /// 자동으로 정렬하고 maxEntries 이상이면 하위 항목을 제거합니다.
        /// </summary>
        public void AddEntry(int score)
        {
            LoadEntries();

            var newEntry = new LeaderboardEntry
            {
                rank = 0,
                score = score,
                date = DateTime.Now.ToString("yyyy-MM-dd HH:mm")
            };

            entries.Add(newEntry);

            // 점수 내림차순 정렬
            entries.Sort((a, b) => b.score.CompareTo(a.score));

            // 최대 개수 제한
            if (entries.Count > maxEntries)
            {
                entries.RemoveRange(maxEntries, entries.Count - maxEntries);
            }

            // 순위 재할당
            ReassignRanks();

            SaveEntries();

            // UI가 활성화 상태이면 즉시 갱신
            if (gameObject.activeInHierarchy)
            {
                RefreshUI();
            }
        }

        /// <summary>
        /// PlayerPrefs에서 리더보드 데이터를 JSON으로 로드합니다.
        /// </summary>
        private void LoadEntries()
        {
            entries.Clear();

            string json = PlayerPrefs.GetString(LEADERBOARD_KEY, "");
            if (string.IsNullOrEmpty(json))
            {
                return;
            }

            try
            {
                var data = JsonUtility.FromJson<LeaderboardData>(json);
                if (data.entries != null)
                {
                    entries.AddRange(data.entries);
                }
            }
            catch (Exception e)
            {
                Debug.LogWarning("[LeaderboardScreen] JSON 파싱 실패: " + e.Message);
                entries.Clear();
            }
        }

        /// <summary>
        /// 리더보드 데이터를 PlayerPrefs에 JSON으로 저장합니다.
        /// </summary>
        private void SaveEntries()
        {
            var data = new LeaderboardData { entries = entries };
            string json = JsonUtility.ToJson(data);
            PlayerPrefs.SetString(LEADERBOARD_KEY, json);
            PlayerPrefs.Save();
        }

        /// <summary>
        /// UI를 갱신합니다. 기존 엔트리를 제거하고 새로 인스턴스화합니다.
        /// </summary>
        private void RefreshUI()
        {
            // 기존 엔트리 제거
            ClearSpawnedEntries();

            if (titleText != null)
            {
                titleText.text = "Leaderboard";
            }

            if (entryContainer == null || entryPrefab == null)
            {
                return;
            }

            for (int i = 0; i < entries.Count; i++)
            {
                var entry = entries[i];
                GameObject entryObj = Instantiate(entryPrefab, entryContainer);
                entryObj.SetActive(true);
                spawnedEntries.Add(entryObj);

                // 순위 텍스트
                var rankText = FindChildText(entryObj, "RankText");
                if (rankText != null)
                {
                    rankText.text = "#" + entry.rank;
                }

                // 점수 텍스트
                var scoreText = FindChildText(entryObj, "ScoreText");
                if (scoreText != null)
                {
                    scoreText.text = entry.score.ToString("N0");
                }

                // 날짜 텍스트
                var dateText = FindChildText(entryObj, "DateText");
                if (dateText != null)
                {
                    dateText.text = entry.date;
                }
            }

            // 엔트리가 없으면 빈 메시지 표시
            if (entries.Count == 0)
            {
                GameObject emptyObj = Instantiate(entryPrefab, entryContainer);
                emptyObj.SetActive(true);
                spawnedEntries.Add(emptyObj);

                var scoreText = FindChildText(emptyObj, "ScoreText");
                if (scoreText != null)
                {
                    scoreText.text = "No records yet";
                }

                var rankText = FindChildText(emptyObj, "RankText");
                if (rankText != null)
                {
                    rankText.text = "-";
                }

                var dateText = FindChildText(emptyObj, "DateText");
                if (dateText != null)
                {
                    dateText.text = "";
                }
            }
        }

        /// <summary>닫기 버튼 핸들러</summary>
        private void OnCloseClicked()
        {
            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlaySFX(SFXType.ButtonClick);
            }

            if (ScreenManager.Instance != null)
            {
                ScreenManager.Instance.GoBack();
            }
            else
            {
                gameObject.SetActive(false);
            }
        }

        /// <summary>리더보드 초기화 버튼 핸들러</summary>
        private void OnClearClicked()
        {
            if (AudioManager.Instance != null)
            {
                AudioManager.Instance.PlaySFX(SFXType.ButtonClick);
            }

            entries.Clear();
            PlayerPrefs.DeleteKey(LEADERBOARD_KEY);
            PlayerPrefs.Save();

            RefreshUI();

            Debug.Log("[LeaderboardScreen] 리더보드 초기화 완료");
        }

        /// <summary>순위를 1부터 다시 할당합니다.</summary>
        private void ReassignRanks()
        {
            for (int i = 0; i < entries.Count; i++)
            {
                var entry = entries[i];
                entry.rank = i + 1;
                entries[i] = entry;
            }
        }

        /// <summary>생성된 엔트리 게임 오브젝트를 모두 제거합니다.</summary>
        private void ClearSpawnedEntries()
        {
            for (int i = 0; i < spawnedEntries.Count; i++)
            {
                if (spawnedEntries[i] != null)
                {
                    Destroy(spawnedEntries[i]);
                }
            }
            spawnedEntries.Clear();
        }

        /// <summary>자식에서 이름으로 TextMeshProUGUI를 찾습니다.</summary>
        private static TextMeshProUGUI FindChildText(GameObject parent, string childName)
        {
            Transform child = parent.transform.Find(childName);
            if (child != null)
            {
                return child.GetComponent<TextMeshProUGUI>();
            }
            return null;
        }
    }
}
