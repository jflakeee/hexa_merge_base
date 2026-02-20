namespace HexaMerge.UI
{
    using HexaMerge.Audio;
    using HexaMerge.Core;
    using UnityEngine;
    using UnityEngine.UI;
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
            public double score;
            public string date;
        }

        [Serializable]
        private struct LeaderboardData
        {
            public List<LeaderboardEntry> entries;
        }

        private static readonly int StaticMaxEntries = 10;

        [SerializeField] private Transform entryContainer;
        [SerializeField] private GameObject entryPrefab;
        [SerializeField] private Button closeButton;
        [SerializeField] private Button clearButton;
        [SerializeField] private Text titleText;
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
        /// 새 점수를 리더보드에 추가합니다 (정적 메서드 — 비활성 객체에서도 호출 가능).
        /// PlayerPrefs에 직접 저장하고, 화면이 활성화되면 OnEnable에서 자동 로드됩니다.
        /// </summary>
        public static void AddEntry(double score)
        {
            Debug.Log("[LeaderboardScreen] AddEntry called with score: " + score);

            string json = PlayerPrefs.GetString(LEADERBOARD_KEY, "");
            List<LeaderboardEntry> list = new List<LeaderboardEntry>();

            if (!string.IsNullOrEmpty(json))
            {
                LeaderboardData data = JsonUtility.FromJson<LeaderboardData>(json);
                if (data.entries != null)
                    list.AddRange(data.entries);
            }

            LeaderboardEntry newEntry = new LeaderboardEntry();
            newEntry.rank = 0;
            newEntry.score = score;
            newEntry.date = DateTime.Now.ToString("yyyy-MM-dd HH:mm");
            list.Add(newEntry);

            list.Sort((a, b) => b.score.CompareTo(a.score));

            if (list.Count > StaticMaxEntries)
                list.RemoveRange(StaticMaxEntries, list.Count - StaticMaxEntries);

            for (int i = 0; i < list.Count; i++)
            {
                LeaderboardEntry e = list[i];
                e.rank = i + 1;
                list[i] = e;
            }

            LeaderboardData saveData = new LeaderboardData();
            saveData.entries = list;
            string saveJson = JsonUtility.ToJson(saveData);
            PlayerPrefs.SetString(LEADERBOARD_KEY, saveJson);
            PlayerPrefs.Save();

            Debug.Log("[LeaderboardScreen] Saved " + list.Count + " entries: " + saveJson);
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
                    scoreText.text = TileHelper.FormatValue(entry.score);
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

        /// <summary>자식에서 이름으로 Text를 찾습니다.</summary>
        private static Text FindChildText(GameObject parent, string childName)
        {
            Transform child = parent.transform.Find(childName);
            if (child != null)
            {
                return child.GetComponent<Text>();
            }
            return null;
        }
    }
}
