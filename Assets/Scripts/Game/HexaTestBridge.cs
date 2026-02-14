namespace HexaMerge.Game
{
    using HexaMerge.Core;
    using HexaMerge.UI;
    using HexaMerge.Animation;
    using UnityEngine;
    using System;
    using System.Collections;
    using System.Collections.Generic;

    /// <summary>
    /// Playwright E2E 테스트용 애니메이션/보드 브릿지.
    /// window.HexaTest JS API를 통해 호출됩니다.
    ///
    /// JS 호출 형태:
    /// - void 메서드: SendMessage('HexaTestBridge', 'Method', 'param')
    /// - 콜백 메서드: SendMessage('HexaTestBridge', 'Method', 'callbackId|param')
    ///
    /// 콜백 응답은 WebGLBridge.SendToJS 로 __hexaTestCallback 이벤트를 전송합니다.
    /// </summary>
    public class HexaTestBridge : MonoBehaviour
    {
        public static HexaTestBridge Instance { get; private set; }

        // Animation state tracking
        private int activeAnimations;
        private string currentPhase = "idle";
        private bool shaking;
        private bool comboVisible;
        private string waveDirection = "";

        // Wave direction cycling for "auto" mode
        private static readonly string[] WaveDirections = { "BottomToTop", "LeftToRight", "OuterToCenter" };
        private int waveCycleIndex;

        // FPS tracking
        private float lastFPS = 60f;
        private int frameCount;
        private float fpsTimer;

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

        private void Start()
        {
            WebGLBridge.InitHexaTestAPI();
            Debug.Log("[HexaTestBridge] HexaTest JS API registered.");
        }

        private void Update()
        {
            frameCount++;
            fpsTimer += Time.unscaledDeltaTime;
            if (fpsTimer >= 0.5f)
            {
                lastFPS = frameCount / fpsTimer;
                frameCount = 0;
                fpsTimer = 0f;
            }
        }

        // ================================================================
        // Callback helpers
        // ================================================================

        private void ParseCallback(string input, out string callbackId, out string param)
        {
            int idx = input.IndexOf('|');
            if (idx >= 0)
            {
                callbackId = input.Substring(0, idx);
                param = input.Substring(idx + 1);
            }
            else
            {
                callbackId = "";
                param = input;
            }
        }

        private void ResolveCallback(string callbackId, string resultJson)
        {
            string json = "{\"__hexaTestCallback\":true,\"id\":\"" + callbackId +
                "\",\"result\":" + resultJson + "}";
            WebGLBridge.SendToJS(json);
        }

        private void BeginAnimation()
        {
            activeAnimations++;
        }

        private void EndAnimation()
        {
            activeAnimations--;
            if (activeAnimations < 0) activeAnimations = 0;
        }

        private bool IsPlaying()
        {
            return activeAnimations > 0;
        }

        private HexBoardRenderer FindBoardRenderer()
        {
            return UnityEngine.Object.FindObjectOfType<HexBoardRenderer>();
        }

        // ================================================================
        // callUnityVoid methods (fire-and-forget)
        // ================================================================

        public void TriggerSpawnAnimation(string countStr)
        {
            int count = 1;
            int.TryParse(countStr, out count);
            if (count < 1) count = 1;
            StartCoroutine(SpawnAnimationCoroutine(count));
        }

        private IEnumerator SpawnAnimationCoroutine(int count)
        {
            BeginAnimation();
            var gm = GameManager.Instance;
            var animator = TileAnimator.Instance;
            var renderer = FindBoardRenderer();

            if (gm == null || renderer == null)
            {
                EndAnimation();
                yield break;
            }

            for (int i = 0; i < count; i++)
            {
                var emptyCells = gm.Grid.GetEmptyCells();
                if (emptyCells.Count == 0) break;

                int idx = UnityEngine.Random.Range(0, emptyCells.Count);
                int value = TileHelper.GetRandomNewTileValue();
                emptyCells[idx].SetValue(value);
                renderer.RefreshAll(gm.Grid);

                if (animator != null)
                {
                    var view = renderer.GetCellView(emptyCells[idx].Coord);
                    if (view != null)
                    {
                        bool done = false;
                        animator.PlaySpawnAnimation(view.RectTransform, () => done = true);
                        while (!done) yield return null;
                    }
                }

                if (i < count - 1)
                    yield return new WaitForSeconds(0.03f);
            }

            EndAnimation();
        }

        public void TriggerMerge(string param)
        {
            var parts = param.Split(',');
            if (parts.Length != 4) return;

            int q1, r1, q2, r2;
            if (!int.TryParse(parts[0], out q1) || !int.TryParse(parts[1], out r1) ||
                !int.TryParse(parts[2], out q2) || !int.TryParse(parts[3], out r2))
                return;

            StartCoroutine(MergeAnimationCoroutine(q1, r1, q2, r2));
        }

        private IEnumerator MergeAnimationCoroutine(int q1, int r1, int q2, int r2)
        {
            BeginAnimation();
            var renderer = FindBoardRenderer();
            var animator = TileAnimator.Instance;
            var gm = GameManager.Instance;

            HexCoord coordA = new HexCoord(q1, r1);
            HexCoord coordB = new HexCoord(q2, r2);
            HexCellView viewA = renderer != null ? renderer.GetCellView(coordA) : null;
            HexCellView viewB = renderer != null ? renderer.GetCellView(coordB) : null;

            // Phase 1: moving (0~200ms)
            currentPhase = "moving";
            if (animator != null && viewA != null && viewB != null)
            {
                RectTransform rtB = viewB.RectTransform;
                Vector2 startPos = rtB.anchoredPosition;
                Vector2 targetPos = viewA.RectTransform.anchoredPosition;
                float elapsed = 0f;
                float moveDuration = 0.2f;

                while (elapsed < moveDuration)
                {
                    elapsed += Time.deltaTime;
                    float t = Mathf.Clamp01(elapsed / moveDuration);
                    rtB.anchoredPosition = Vector2.Lerp(startPos, targetPos, t);
                    float scale = Mathf.Lerp(1f, 0f, t);
                    rtB.localScale = Vector3.one * scale;
                    yield return null;
                }
                rtB.localScale = Vector3.zero;
            }
            else
            {
                yield return new WaitForSeconds(0.2f);
            }

            // Phase 2: merging / crossfade (200~300ms)
            currentPhase = "merging";
            if (viewA != null)
            {
                RectTransform rtA = viewA.RectTransform;
                float elapsed = 0f;
                float mergeDuration = 0.1f;
                while (elapsed < mergeDuration)
                {
                    elapsed += Time.deltaTime;
                    float t = Mathf.Clamp01(elapsed / mergeDuration);
                    rtA.localScale = Vector3.one * Mathf.Lerp(1f, 1.05f, t);
                    yield return null;
                }
            }
            else
            {
                yield return new WaitForSeconds(0.1f);
            }

            // Apply the merge in the model
            if (gm != null)
            {
                var cellA = gm.Grid.GetCell(coordA);
                var cellB = gm.Grid.GetCell(coordB);
                if (cellA != null && cellB != null && cellA.TileValue > 0)
                {
                    int merged = cellA.TileValue * 2;
                    cellA.SetValue(merged);
                    cellB.Clear();
                    gm.Score.AddScore(merged);
                    if (renderer != null) renderer.RefreshAll(gm.Grid);
                }
            }

            // Phase 3: expanding (300~400ms) - scale punch to 1.3
            currentPhase = "expanding";
            if (viewA != null)
            {
                RectTransform rtA = viewA.RectTransform;
                float elapsed = 0f;
                float expandDuration = 0.1f;
                while (elapsed < expandDuration)
                {
                    elapsed += Time.deltaTime;
                    float t = Mathf.Clamp01(elapsed / expandDuration);
                    rtA.localScale = Vector3.one * Mathf.Lerp(1.05f, 1.3f, t);
                    yield return null;
                }
            }
            else
            {
                yield return new WaitForSeconds(0.1f);
            }

            // Phase 4: settle (400~500ms) - 1.3 -> 1.0
            currentPhase = "complete";
            if (viewA != null)
            {
                RectTransform rtA = viewA.RectTransform;
                float elapsed = 0f;
                float settleDuration = 0.1f;
                while (elapsed < settleDuration)
                {
                    elapsed += Time.deltaTime;
                    float t = Mathf.Clamp01(elapsed / settleDuration);
                    rtA.localScale = Vector3.one * Mathf.Lerp(1.3f, 1.0f, t);
                    yield return null;
                }
                rtA.localScale = Vector3.one;
            }
            else
            {
                yield return new WaitForSeconds(0.1f);
            }

            // Restore B view position
            if (viewB != null && renderer != null)
            {
                renderer.RefreshAll(gm != null ? gm.Grid : null);
            }

            currentPhase = "idle";
            EndAnimation();
        }

        public void TriggerCombo(string countStr)
        {
            int count = 2;
            int.TryParse(countStr, out count);
            if (count < 1) count = 1;
            StartCoroutine(ComboCoroutine(count));
        }

        private IEnumerator ComboCoroutine(int count)
        {
            BeginAnimation();
            comboVisible = true;

            // x3+: shake
            if (count >= 3)
            {
                shaking = true;
                StartCoroutine(ShakeSubCoroutine(0.2f));
            }

            // Hold combo text for 2.0 seconds
            yield return new WaitForSeconds(2.0f);

            // Fade out over 0.5 seconds
            yield return new WaitForSeconds(0.5f);
            comboVisible = false;

            EndAnimation();
        }

        private IEnumerator ShakeSubCoroutine(float duration)
        {
            yield return new WaitForSeconds(duration);
            shaking = false;
        }

        public void TriggerWaveAnimation(string direction)
        {
            if (direction == "auto")
            {
                direction = WaveDirections[waveCycleIndex % WaveDirections.Length];
                waveCycleIndex++;
            }
            waveDirection = direction;
            StartCoroutine(WaveCoroutine(direction));
        }

        private IEnumerator WaveCoroutine(string direction)
        {
            BeginAnimation();

            var gm = GameManager.Instance;
            var renderer = FindBoardRenderer();
            var animator = TileAnimator.Instance;

            if (gm != null && renderer != null && animator != null)
            {
                var coords = new List<HexCoord>(gm.Grid.AllCoords);

                // Sort by direction
                if (direction == "BottomToTop")
                    coords.Sort((a, b) => b.r.CompareTo(a.r));
                else if (direction == "LeftToRight")
                    coords.Sort((a, b) => a.q.CompareTo(b.q));
                else // OuterToCenter
                    coords.Sort((a, b) =>
                    {
                        int distA = Mathf.Abs(a.q) + Mathf.Abs(a.r) + Mathf.Abs(a.s);
                        int distB = Mathf.Abs(b.q) + Mathf.Abs(b.r) + Mathf.Abs(b.s);
                        return distB.CompareTo(distA);
                    });

                foreach (var coord in coords)
                {
                    var view = renderer.GetCellView(coord);
                    if (view != null)
                    {
                        animator.PlayScalePunch(view.RectTransform);
                        yield return new WaitForSeconds(0.03f);
                    }
                }

                yield return new WaitForSeconds(0.3f);
            }
            else
            {
                yield return new WaitForSeconds(1.5f);
            }

            waveDirection = "";
            EndAnimation();
        }

        public void TriggerScreenTransition(string param)
        {
            var parts = param.Split(',');
            if (parts.Length != 2) return;
            string from = parts[0];
            string to = parts[1];
            StartCoroutine(ScreenTransitionCoroutine(from, to));
        }

        private IEnumerator ScreenTransitionCoroutine(string from, string to)
        {
            BeginAnimation();

            float duration;
            if ((from == "MainMenu" && to == "Game") || (from == "Game" && to == "MainMenu"))
                duration = 0.45f;
            else if ((from == "Game" && to == "Pause") || (from == "Pause" && to == "Game"))
                duration = 0.28f;
            else
                duration = 0.28f;

            yield return new WaitForSeconds(duration);

            var sm = ScreenManager.Instance;
            if (sm != null)
            {
                ScreenType screenType;
                if (TryParseScreenType(to, out screenType))
                    sm.ShowScreen(screenType);
            }

            EndAnimation();
        }

        public void SetBoardState(string stateJson)
        {
            var gm = GameManager.Instance;
            if (gm == null || gm.Grid == null) return;

            // Clear all cells first
            foreach (var coord in gm.Grid.AllCoords)
            {
                var cell = gm.Grid.GetCell(coord);
                if (cell != null) cell.Clear();
            }

            // Parse JSON: { "blocks": [{ "q":0, "r":0, "value":32 }, ...] }
            // Also support legacy format with "v" field
            string s = stateJson.Trim();

            // Extract blocks array content
            int blocksIdx = s.IndexOf("\"blocks\"");
            if (blocksIdx < 0) blocksIdx = s.IndexOf("blocks");

            string arrayStr = s;
            if (blocksIdx >= 0)
            {
                int arrStart = s.IndexOf('[', blocksIdx);
                int arrEnd = s.LastIndexOf(']');
                if (arrStart >= 0 && arrEnd > arrStart)
                    arrayStr = s.Substring(arrStart, arrEnd - arrStart + 1);
            }

            // Remove outer brackets
            string inner = arrayStr.Trim();
            if (inner.StartsWith("[")) inner = inner.Substring(1);
            if (inner.EndsWith("]")) inner = inner.Substring(0, inner.Length - 1);

            // Split by '}' to get individual objects
            string[] entries = inner.Split('}');
            foreach (string entry in entries)
            {
                string e = entry.Trim().TrimStart(',').Trim();
                if (!e.Contains("{")) continue;
                e = e.Substring(e.IndexOf('{') + 1);

                int q = 0, r = 0, v = 0;
                string[] fields = e.Split(',');
                foreach (string field in fields)
                {
                    string f = field.Trim().Replace("\"", "");
                    if (f.StartsWith("q:")) int.TryParse(f.Substring(2).Trim(), out q);
                    else if (f.StartsWith("r:")) int.TryParse(f.Substring(2).Trim(), out r);
                    else if (f.StartsWith("value:")) int.TryParse(f.Substring(6).Trim(), out v);
                    else if (f.StartsWith("v:")) int.TryParse(f.Substring(2).Trim(), out v);
                }

                if (v > 0)
                {
                    var cell = gm.Grid.GetCell(new HexCoord(q, r));
                    if (cell != null) cell.SetValue(v);
                }
            }

            var renderer = FindBoardRenderer();
            if (renderer != null)
                renderer.RefreshAll(gm.Grid);

            Debug.Log("[HexaTestBridge] Board state set.");
        }

        // ================================================================
        // callUnity callback methods (receive "id|param")
        // ================================================================

        public void IsAnimationPlaying(string input)
        {
            string callbackId, param;
            ParseCallback(input, out callbackId, out param);
            ResolveCallback(callbackId, IsPlaying() ? "true" : "false");
        }

        public void GetBlockScale(string input)
        {
            string callbackId, param;
            ParseCallback(input, out callbackId, out param);

            float scale = 1f;
            var parts = param.Split(',');
            if (parts.Length == 2)
            {
                int q, r;
                if (int.TryParse(parts[0], out q) && int.TryParse(parts[1], out r))
                {
                    var renderer = FindBoardRenderer();
                    if (renderer != null)
                    {
                        var view = renderer.GetCellView(new HexCoord(q, r));
                        if (view != null)
                            scale = view.RectTransform.localScale.x;
                    }
                }
            }

            ResolveCallback(callbackId, scale.ToString("F4"));
        }

        public void GetBlockAlpha(string input)
        {
            string callbackId, param;
            ParseCallback(input, out callbackId, out param);

            float alpha = 1f;
            var parts = param.Split(',');
            if (parts.Length == 2)
            {
                int q, r;
                if (int.TryParse(parts[0], out q) && int.TryParse(parts[1], out r))
                {
                    var renderer = FindBoardRenderer();
                    if (renderer != null)
                    {
                        var view = renderer.GetCellView(new HexCoord(q, r));
                        if (view != null)
                        {
                            CanvasGroup cg = view.GetComponent<CanvasGroup>();
                            if (cg != null)
                                alpha = cg.alpha;
                        }
                    }
                }
            }

            ResolveCallback(callbackId, alpha.ToString("F4"));
        }

        public void GetAnimationState(string input)
        {
            string callbackId, param;
            ParseCallback(input, out callbackId, out param);

            string json = "{" +
                "\"phase\":\"" + currentPhase + "\"," +
                "\"shaking\":" + (shaking ? "true" : "false") + "," +
                "\"comboVisible\":" + (comboVisible ? "true" : "false") + "," +
                "\"waveDirection\":\"" + waveDirection + "\"," +
                "\"isPlaying\":" + (IsPlaying() ? "true" : "false") + "," +
                "\"activeCount\":" + activeAnimations + "," +
                "\"fps\":" + lastFPS.ToString("F1") +
            "}";

            ResolveCallback(callbackId, json);
        }

        public void GetFPS(string input)
        {
            string callbackId, param;
            ParseCallback(input, out callbackId, out param);
            ResolveCallback(callbackId, lastFPS.ToString("F1"));
        }

        // ================================================================
        // Utility
        // ================================================================

        private static bool TryParseScreenType(string name, out ScreenType screenType)
        {
            screenType = ScreenType.None;
            if (name == "Game" || name == "Gameplay")
            {
                screenType = ScreenType.Gameplay;
                return true;
            }
            if (name == "MainMenu")
            {
                screenType = ScreenType.MainMenu;
                return true;
            }
            if (name == "Pause")
            {
                screenType = ScreenType.Pause;
                return true;
            }
            if (name == "Settings")
            {
                screenType = ScreenType.Settings;
                return true;
            }
            if (name == "Shop")
            {
                screenType = ScreenType.Shop;
                return true;
            }
            if (name == "Leaderboard")
            {
                screenType = ScreenType.Leaderboard;
                return true;
            }
            return false;
        }
    }
}
