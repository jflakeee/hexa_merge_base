namespace HexaMerge.Game
{
    using HexaMerge.Core;
    using UnityEngine;
    using System.Runtime.InteropServices;

    /// <summary>
    /// Unity ↔ JavaScript bridge for WebGL builds.
    /// Used by Playwright E2E tests to interact with the game.
    /// </summary>
    public class WebGLBridge : MonoBehaviour
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        [DllImport("__Internal")]
        private static extern void SendMessageToJS(string message);

        [DllImport("__Internal")]
        private static extern void SetWindowProperty(string key, string value);

        [DllImport("__Internal")]
        private static extern void CallWindowCallback(string callbackName, string value);

        [DllImport("__Internal")]
        private static extern void RegisterHexaTestAPI();
#else
        private static void SendMessageToJS(string message)
        {
            Debug.Log($"[WebGLBridge] SendToJS: {message}");
        }

        private static void SetWindowProperty(string key, string value)
        {
            Debug.Log($"[WebGLBridge] SetWindowProperty: {key} = {value}");
        }

        private static void CallWindowCallback(string callbackName, string value)
        {
            Debug.Log($"[WebGLBridge] CallWindowCallback: {callbackName}({value})");
        }

        private static void RegisterHexaTestAPI()
        {
            Debug.Log("[WebGLBridge] RegisterHexaTestAPI (Editor stub)");
        }
#endif

        public static WebGLBridge Instance { get; private set; }

        /// <summary>
        /// 다른 매니저에서 JS로 메시지를 보낼 때 사용하는 public 래퍼.
        /// </summary>
        public static void SendToJS(string json)
        {
            SendMessageToJS(json);
        }

        /// <summary>
        /// JS window 프로퍼티를 설정합니다 (예: window.__unityAudioState).
        /// </summary>
        public static void SetJSProperty(string key, string jsonValue)
        {
            SetWindowProperty(key, jsonValue);
        }

        /// <summary>
        /// JS window 콜백 함수를 호출합니다 (예: window.__unityQueryCallback).
        /// </summary>
        public static void CallJSCallback(string callbackName, string value)
        {
            CallWindowCallback(callbackName, value);
        }

        /// <summary>
        /// HexaTest JS API를 등록합니다 (애니메이션 테스트용).
        /// </summary>
        public static void InitHexaTestAPI()
        {
            RegisterHexaTestAPI();
        }

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
        }

        private void Start()
        {
            if (GameManager.Instance != null)
            {
                GameManager.Instance.OnStateChanged += state =>
                    SendMessageToJS($"{{\"event\":\"stateChanged\",\"state\":\"{state}\"}}");

                GameManager.Instance.OnMergePerformed += result =>
                    SendMessageToJS($"{{\"event\":\"merge\",\"value\":{result.ResultValue},\"count\":{result.MergedCount},\"score\":{result.ScoreGained}}}");

                GameManager.Instance.Score.OnScoreChanged += score =>
                    SendMessageToJS($"{{\"event\":\"scoreChanged\",\"score\":{score}}}");
            }
        }

        // Called from JavaScript
        public void JS_StartNewGame()
        {
            GameManager.Instance?.StartNewGame();
        }

        // Called from JavaScript
        public void JS_TapCell(string coordJson)
        {
            // Expected format: "q,r"
            var parts = coordJson.Split(',');
            if (parts.Length == 2 &&
                int.TryParse(parts[0], out int q) &&
                int.TryParse(parts[1], out int r))
            {
                GameManager.Instance?.HandleTap(new HexCoord(q, r));
            }
        }

        // Called from JavaScript: 게임 일시정지
        public void JS_PauseGame(string _unused)
        {
            GameManager.Instance?.PauseGame();
        }

        // Called from JavaScript: 게임 재개
        public void JS_ResumeGame(string _unused)
        {
            GameManager.Instance?.ResumeGame();
        }

        // Called from JavaScript: 게임 오버 강제 트리거 (테스트용)
        public void JS_TriggerGameOver(string _unused)
        {
            GameManager.Instance?.ForceGameOver();
        }

        // Called from JavaScript: 상점 화면 열기
        public void JS_OpenShop(string _unused)
        {
            var sm = HexaMerge.UI.ScreenManager.Instance;
            if (sm != null)
                sm.ShowScreen(HexaMerge.UI.ScreenType.Shop);
        }

        // Called from JavaScript: 상점 화면 닫기
        public void JS_CloseShop(string _unused)
        {
            var sm = HexaMerge.UI.ScreenManager.Instance;
            if (sm != null)
                sm.GoBack();
        }

        // Called from JavaScript
        public void JS_GetGameState(string callbackId)
        {
            var gm = GameManager.Instance;
            if (gm == null) return;

            string cellsJson = "[";
            bool first = true;
            foreach (var coord in gm.Grid.AllCoords)
            {
                var cell = gm.Grid.GetCell(coord);
                if (!first) cellsJson += ",";
                cellsJson += $"{{\"q\":{coord.q},\"r\":{coord.r},\"v\":{cell.TileValue}}}";
                first = false;
            }
            cellsJson += "]";

            string json = $"{{\"callbackId\":\"{callbackId}\",\"state\":\"{gm.State}\",\"score\":{gm.Score.CurrentScore},\"highScore\":{gm.Score.HighScore},\"cells\":{cellsJson}}}";
            SendMessageToJS(json);
        }
    }
}
