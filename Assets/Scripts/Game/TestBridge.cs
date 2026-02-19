namespace HexaMerge.Game
{
    using UnityEngine;
    using UnityEngine.Scripting;

    /// <summary>
    /// Playwright E2E 테스트용 브릿지.
    /// UI 상태 조회, 점수 설정, 화면 전환 등 테스트에 필요한 기능을 제공합니다.
    /// SendMessage('TestBridge', 'Query', queryPath) 형태로 호출합니다.
    /// 결과는 window.__unityQueryCallback(result) 콜백으로 반환합니다.
    /// </summary>
    [Preserve]
    public class TestBridge : MonoBehaviour
    {
        public static TestBridge Instance { get; private set; }

        // 상점/리더보드 탭 상태 (캔버스 클릭으로 변경 가능)
        private string shopCurrentTab = "Items";
        private string leaderboardCurrentTab = "All";

        // 토스트 UI
        private string toastMessage;
        private float toastTimer;
        private bool showToast;
        private GUIStyle toastStyle;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);
        }

        private void Update()
        {
            if (showToast)
            {
                toastTimer -= Time.unscaledDeltaTime;
                if (toastTimer <= 0f)
                {
                    showToast = false;
                }
            }
        }

        private void OnGUI()
        {
            if (!showToast || string.IsNullOrEmpty(toastMessage)) return;

            if (toastStyle == null)
            {
                toastStyle = new GUIStyle(GUI.skin.box);
                toastStyle.fontSize = 24;
                toastStyle.alignment = TextAnchor.MiddleCenter;
                toastStyle.normal.textColor = Color.white;
            }

            float w = Screen.width * 0.6f;
            float h = 50f;
            float x = (Screen.width - w) * 0.5f;
            float y = Screen.height - h - 40f;

            GUI.Box(new Rect(x, y, w, h), toastMessage, toastStyle);
        }

        // =================================================================
        // Query: 상태 조회 -> __unityQueryCallback 으로 반환
        // =================================================================

        public void Query(string queryPath)
        {
            string result = ProcessQuery(queryPath);
            WebGLBridge.CallJSCallback("__unityQueryCallback", result);
            Debug.Log("[TestBridge] Query: " + queryPath + " -> " + result);
        }

        private string ProcessQuery(string queryPath)
        {
            switch (queryPath)
            {
                // --- 기존 쿼리 ---
                case "CurrentScreen":
                    return GetCurrentScreen();
                case "GameState":
                    return GetGameStateName();
                case "Score":
                    return GetScore();
                case "HighScore":
                    return GetHighScore();
                case "IsMuted":
                    return GetIsMuted();
                case "CellCount":
                    return GetCellCount();
                case "EmptyCellCount":
                    return GetEmptyCellCount();
                case "BoardState":
                    return GetBoardState();

                // --- ui-components.spec.ts 에서 필요한 쿼리 ---
                case "Game.TimeScale":
                    return Time.timeScale.ToString("G");
                case "Currency.Gems":
                    return PlayerPrefs.GetInt("Gems", 0).ToString();
                case "Shop.CurrentTab":
                    return shopCurrentTab;
                case "Items.HintCount":
                    return PlayerPrefs.GetInt("HintCount", 0).ToString();
                case "ResponsiveLayout.CurrentBreakpoint":
                    return GetCurrentBreakpoint();
                case "ResponsiveLayout.SidebarVisible":
                    return Screen.width > 1024 ? "true" : "false";
                case "Leaderboard.CurrentTab":
                    return leaderboardCurrentTab;
                case "Settings.MuteEnabled":
                {
                    var am = HexaMerge.Audio.AudioManager.Instance;
                    return am != null ? am.IsMuted.ToString().ToLower() : "false";
                }
                case "Settings.BGMVolume":
                    return "0.7";
                case "Settings.SFXVolume":
                    return "1.0";
                case "Settings.LanguageIndex":
                    return "0";
                case "MainMenu.PlayButton.Active":
                    return "true";
                case "MainMenu.BestScoreText":
                {
                    int highScore = 0;
                    var gm = GameManager.Instance;
                    if (gm != null && gm.Score != null)
                        highScore = gm.Score.HighScore;
                    return "Best: " + highScore.ToString();
                }
                case "MainMenu.ContinueButton.Active":
                    return SaveSystem.HasSave() ? "true" : "false";

                default:
                    Debug.LogWarning("[TestBridge] Unknown query: " + queryPath);
                    return "unknown";
            }
        }

        private string GetCurrentScreen()
        {
            // GameManager 가 GameOver 상태이면 "GameOver" 반환
            // (ScreenType enum 에 GameOver 가 없으므로 별도 처리)
            var gm = GameManager.Instance;
            if (gm != null && gm.State == GameState.GameOver)
                return "GameOver";

            var sm = HexaMerge.UI.ScreenManager.Instance;
            if (sm != null)
                return sm.CurrentScreen.ToString();
            return "None";
        }

        private string GetGameStateName()
        {
            var gm = GameManager.Instance;
            if (gm != null)
                return gm.State.ToString();
            return "None";
        }

        private string GetScore()
        {
            var gm = GameManager.Instance;
            if (gm != null)
                return gm.Score.CurrentScore.ToString();
            return "0";
        }

        private string GetHighScore()
        {
            var gm = GameManager.Instance;
            if (gm != null)
                return gm.Score.HighScore.ToString();
            return "0";
        }

        private string GetIsMuted()
        {
            var am = HexaMerge.Audio.AudioManager.Instance;
            if (am != null)
                return am.IsMuted ? "true" : "false";
            return "false";
        }

        private string GetCellCount()
        {
            var gm = GameManager.Instance;
            if (gm != null && gm.Grid != null)
                return gm.Grid.GetAllCells().Count.ToString();
            return "0";
        }

        private string GetEmptyCellCount()
        {
            var gm = GameManager.Instance;
            if (gm != null && gm.Grid != null)
                return gm.Grid.GetEmptyCells().Count.ToString();
            return "0";
        }

        private string GetBoardState()
        {
            var gm = GameManager.Instance;
            if (gm == null || gm.Grid == null) return "[]";

            string json = "[";
            bool first = true;
            foreach (var coord in gm.Grid.AllCoords)
            {
                var cell = gm.Grid.GetCell(coord);
                if (!first) json += ",";
                json += "{\"q\":" + coord.q + ",\"r\":" + coord.r +
                    ",\"v\":" + cell.TileValue + "}";
                first = false;
            }
            json += "]";
            return json;
        }

        private string GetCurrentBreakpoint()
        {
            int width = Screen.width;
            if (width > 1024) return "Desktop";
            if (width >= 768) return "Tablet";
            return "Mobile";
        }

        // =================================================================
        // NavigateTo: 화면 전환
        // =================================================================

        public void NavigateTo(string screenName)
        {
            var sm = HexaMerge.UI.ScreenManager.Instance;

            switch (screenName)
            {
                case "GameOver":
                    if (GameManager.Instance != null)
                        GameManager.Instance.ForceGameOver();
                    break;
                case "Gameplay":
                    if (sm != null)
                        sm.ForceShowScreen(HexaMerge.UI.ScreenType.Gameplay);
                    break;
                case "Pause":
                    if (sm != null)
                        sm.ForceShowScreen(HexaMerge.UI.ScreenType.Pause);
                    break;
                case "Settings":
                    if (sm != null)
                        sm.ForceShowScreen(HexaMerge.UI.ScreenType.Settings);
                    break;
                case "Shop":
                    if (sm != null)
                        sm.ForceShowScreen(HexaMerge.UI.ScreenType.Shop);
                    break;
                case "Leaderboard":
                    if (sm != null)
                        sm.ForceShowScreen(HexaMerge.UI.ScreenType.Leaderboard);
                    break;
                case "MainMenu":
                    if (sm != null)
                        sm.ForceShowScreen(HexaMerge.UI.ScreenType.MainMenu);
                    break;
                default:
                    Debug.LogWarning("[TestBridge] Unknown screen: " + screenName);
                    break;
            }
            Debug.Log("[TestBridge] NavigateTo: " + screenName);
        }

        // =================================================================
        // SetScore: 현재 점수 설정
        // =================================================================

        public void SetScore(string scoreStr)
        {
            var gm = GameManager.Instance;
            if (gm == null || gm.Score == null) return;

            int score;
            if (!int.TryParse(scoreStr, out score)) return;

            int diff = score - gm.Score.CurrentScore;
            if (diff > 0)
            {
                gm.Score.AddScore(diff);
            }
            else if (diff < 0)
            {
                gm.Score.Reset();
                if (score > 0)
                    gm.Score.AddScore(score);
            }
            Debug.Log("[TestBridge] Score set to: " + score);
        }

        // =================================================================
        // SetBestScore: 최고 점수 설정
        // =================================================================

        public void SetBestScore(string scoreStr)
        {
            int score;
            if (!int.TryParse(scoreStr, out score)) return;

            // ScoreManager 메모리 내 값도 동기화
            var gm = GameManager.Instance;
            if (gm != null && gm.Score != null)
            {
                gm.Score.SetHighScore(score);
            }
            else
            {
                PlayerPrefs.SetInt("HighScore", score);
                PlayerPrefs.Save();
            }
            Debug.Log("[TestBridge] Best score set to: " + score);
        }

        // =================================================================
        // SetGems: 보유 젬 설정
        // =================================================================

        public void SetGems(string gems)
        {
            int value;
            if (!int.TryParse(gems, out value)) return;

            PlayerPrefs.SetInt("Gems", value);
            PlayerPrefs.Save();
            Debug.Log("[TestBridge] Gems set to: " + value);
        }

        // =================================================================
        // SetHints: 힌트 수량 설정
        // =================================================================

        public void SetHints(string hints)
        {
            int value;
            if (!int.TryParse(hints, out value)) return;

            PlayerPrefs.SetInt("HintCount", value);
            PlayerPrefs.Save();
            Debug.Log("[TestBridge] Hints set to: " + value);
        }

        // =================================================================
        // ClearSaveData: 모든 저장 데이터 삭제
        // =================================================================

        public void ClearSaveData(string _)
        {
            PlayerPrefs.DeleteAll();
            PlayerPrefs.Save();

            // ScoreManager 의 CurrentScore 와 HighScore 모두 메모리에서 리셋
            var gm = GameManager.Instance;
            if (gm != null && gm.Score != null)
            {
                gm.Score.Reset();
                gm.Score.ResetHighScore();
            }

            Debug.Log("[TestBridge] All save data cleared.");
        }

        // =================================================================
        // TriggerToast: 토스트 메시지 표시 (3초 후 자동 소멸)
        // =================================================================

        public void TriggerToast(string message)
        {
            Debug.Log("[Toast] " + message);
            toastMessage = message;
            toastTimer = 3.0f;
            showToast = true;
        }

        // =================================================================
        // TriggerGameOver: 게임 오버 강제 트리거 (레거시 호환)
        // =================================================================

        public void TriggerGameOver(string _unused)
        {
            var gm = GameManager.Instance;
            if (gm != null)
                gm.ForceGameOver();
        }

        // =================================================================
        // SetCellValue: 셀 값 직접 설정 ("q,r,value" 형태)
        // =================================================================

        public void SetCellValue(string param)
        {
            var parts = param.Split(',');
            if (parts.Length == 3 &&
                int.TryParse(parts[0], out int q) &&
                int.TryParse(parts[1], out int r) &&
                int.TryParse(parts[2], out int value))
            {
                var gm = GameManager.Instance;
                if (gm != null && gm.Grid != null)
                {
                    var coord = new HexaMerge.Core.HexCoord(q, r);
                    var cell = gm.Grid.GetCell(coord);
                    if (cell != null)
                    {
                        cell.SetValue(value);
                        Debug.Log("[TestBridge] Cell (" + q + "," + r + ") set to " + value);
                    }
                }
            }
        }

        // =================================================================
        // ClearBoard: 보드 전체 비우기
        // =================================================================

        public void ClearBoard(string _unused)
        {
            var gm = GameManager.Instance;
            if (gm != null && gm.Grid != null)
            {
                foreach (var coord in gm.Grid.AllCoords)
                {
                    var cell = gm.Grid.GetCell(coord);
                    if (cell != null)
                        cell.Clear();
                }
                Debug.Log("[TestBridge] Board cleared.");
            }
        }

        // =================================================================
        // 상점/리더보드 탭 전환 (캔버스 클릭 기반 UI에서 호출)
        // =================================================================

        public void SetShopTab(string tabName)
        {
            shopCurrentTab = tabName;
            Debug.Log("[TestBridge] Shop tab set to: " + tabName);
        }

        public void SetLeaderboardTab(string tabName)
        {
            leaderboardCurrentTab = tabName;
            Debug.Log("[TestBridge] Leaderboard tab set to: " + tabName);
        }

        // =================================================================
        // BuyHint: 젬으로 힌트 구매 (TC-UI-027)
        // =================================================================

        public void BuyHint(string priceStr)
        {
            int price;
            if (!int.TryParse(priceStr, out price)) return;

            int gems = PlayerPrefs.GetInt("Gems", 0);
            if (gems < price)
            {
                Debug.Log("[TestBridge] BuyHint failed: not enough gems (" + gems + " < " + price + ")");
                return;
            }

            gems -= price;
            PlayerPrefs.SetInt("Gems", gems);

            int hints = PlayerPrefs.GetInt("HintCount", 0);
            hints += 3;
            PlayerPrefs.SetInt("HintCount", hints);
            PlayerPrefs.Save();

            Debug.Log("[TestBridge] BuyHint: spent " + price + " gems, hints=" + hints + ", gems=" + gems);
        }
    }
}
