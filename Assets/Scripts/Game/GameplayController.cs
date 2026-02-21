namespace HexaMerge.Game
{
    using HexaMerge.Core;
    using HexaMerge.UI;
    using HexaMerge.Audio;
    using HexaMerge.Animation;
    using UnityEngine;
    using System.Collections;
    using System.Collections.Generic;

    /// <summary>
    /// Wires together GameManager, HexBoardRenderer, HUDManager,
    /// TileAnimator, MergeEffect, and AudioManager.
    /// Attach to the main gameplay scene root.
    /// </summary>
    public class GameplayController : MonoBehaviour
    {
        [Header("References")]
        [SerializeField] private HexBoardRenderer boardRenderer;
        [SerializeField] private HUDManager hudManager;

        private GameManager gm;
        private bool isAnimating;
        private bool isFirstGameStart = true;
        private HexCoord? lastCrownCoord;

        private void Start()
        {
            gm = GameManager.Instance;
            if (gm == null)
            {
                Debug.LogError("[GameplayController] GameManager not found!");
                return;
            }

            // Subscribe to events
            gm.OnStateChanged += OnGameStateChanged;
            gm.OnMergePerformed += OnMergePerformed;
            gm.OnNewTilesSpawned += OnNewTilesSpawned;
            gm.Score.OnScoreChanged += OnScoreChanged;
            gm.Score.OnHighScoreChanged += OnHighScoreChanged;

            if (boardRenderer != null)
            {
                boardRenderer.OnCellTapped += OnCellTapped;
                boardRenderer.Initialize(gm.Grid);
            }

            // Initialize HUD
            if (hudManager != null)
            {
                hudManager.UpdateScore(gm.Score.CurrentScore);
                hudManager.UpdateHighScore(gm.Score.HighScore);
            }

            // Auto-start if ready
            if (gm.State == GameState.Ready)
            {
                gm.StartNewGame();
            }

            RefreshBoard();
        }

        private void OnDestroy()
        {
            if (gm != null)
            {
                gm.OnStateChanged -= OnGameStateChanged;
                gm.OnMergePerformed -= OnMergePerformed;
                gm.OnNewTilesSpawned -= OnNewTilesSpawned;
                gm.Score.OnScoreChanged -= OnScoreChanged;
                gm.Score.OnHighScoreChanged -= OnHighScoreChanged;
            }

            if (boardRenderer != null)
                boardRenderer.OnCellTapped -= OnCellTapped;
        }

        private void OnCellTapped(HexCoord coord)
        {
            if (isAnimating || gm.State != GameState.Playing) return;
            gm.HandleTap(coord);
        }

        private void OnMergePerformed(MergeResult result)
        {
            if (!result.Success) return;

            StartCoroutine(PlayMergeSequence(result));
        }

        private IEnumerator PlayMergeSequence(MergeResult result)
        {
            isAnimating = true;

            var targetView = boardRenderer != null
                ? boardRenderer.GetCellView(result.MergeTargetCoord) : null;

            AudioSource prevMergeSrc = null;

            // 깊이별 순차 splat: 가장 깊은(먼) 블럭부터 BFS 상위 노드로 스며드는 점성 액체 효과
            if (boardRenderer != null && result.DepthGroups != null)
            {
                Color splatColor = Color.yellow;
                if (gm.ColorConfig != null)
                    splatColor = gm.ColorConfig.GetColor(result.BaseValue);

                // 타겟 위치 (머지 결과가 놓이는 셀) — fallback용
                Vector2 targetPos = Vector2.zero;
                if (targetView != null)
                    targetPos = targetView.RectTransform.anchoredPosition;

                SFXType mergeSfx = AudioManager.GetMergeSFXType(result.ResultValue);

                int groupCount = result.DepthGroups.Count;
                for (int g = 0; g < groupCount; g++)
                {
                    var group = result.DepthGroups[g];

                    // 각 블럭 → BFS 부모 노드로 splat
                    for (int c = 0; c < group.Count; c++)
                    {
                        var sourceView = boardRenderer.GetCellView(group[c]);
                        if (sourceView == null) continue;

                        Vector2 sourcePos = sourceView.RectTransform.anchoredPosition;

                        // BFS 부모 위치 찾기
                        Vector2 parentPos = targetPos;
                        if (result.ParentMap != null && result.ParentMap.ContainsKey(group[c]))
                        {
                            var parentView = boardRenderer.GetCellView(result.ParentMap[group[c]]);
                            if (parentView != null)
                                parentPos = parentView.RectTransform.anchoredPosition;
                        }

                        if (MergeEffect.Instance != null)
                        {
                            MergeEffect.Instance.PlaySplatEffect(
                                sourcePos, parentPos, splatColor, 1);
                        }
                    }

                    // 단계별 피치 상승 사운드: 이전 사운드 중단 후 새 피치로 재생 (겹침 방지)
                    if (AudioManager.Instance != null)
                    {
                        float pitch = 1.0f + g * 0.15f;
                        AudioManager.Instance.PlaySFXExclusive(mergeSfx, pitch, ref prevMergeSrc);
                    }

                    // 소스 셀 숨기기 (splat이 마스킹)
                    for (int c = 0; c < group.Count; c++)
                    {
                        var view = boardRenderer.GetCellView(group[c]);
                        if (view != null)
                            view.gameObject.SetActive(false);
                    }

                    // 다음 깊이 그룹까지 대기 (마지막 그룹은 대기하지 않음)
                    if (g < groupCount - 1)
                        yield return new WaitForSeconds(0.17f);
                }
            }

            // 연속병합과 동일한 리듬으로 숫자증가 재생 (0.17초 간격)
            yield return new WaitForSeconds(0.17f);

            // 타겟에 최종값 표시 + 숫자증가 사운드 (이전 머지 사운드 중단 후 재생)
            if (targetView != null)
            {
                targetView.gameObject.SetActive(true);
                var highestCell = gm.Grid.GetHighestValueCell();
                double highestValue = highestCell != null ? highestCell.TileValue : 0;
                bool hasCrown = result.ResultValue == highestValue && highestValue > 0;
                targetView.UpdateView(result.ResultValue, hasCrown);

                if (AudioManager.Instance != null)
                    AudioManager.Instance.PlaySFXExclusive(SFXType.NumberUp, 1.0f, ref prevMergeSrc);
            }

            // 타겟 스케일 펀치
            if (TileAnimator.Instance != null && targetView != null)
            {
                bool punchDone = false;
                TileAnimator.Instance.PlayScalePunch(
                    targetView.RectTransform, () => punchDone = true);
                while (!punchDone) yield return null;
            }

            // SFX: 단일 셀 머지 (DepthGroups 없는 경우 fallback)
            if (AudioManager.Instance != null && (result.DepthGroups == null || result.DepthGroups.Count == 0))
            {
                SFXType sfx = AudioManager.GetMergeSFXType(result.ResultValue);
                AudioManager.Instance.PlaySFX(sfx);
            }

            // 리필 파티클: 빈 셀 위치에 컬러 파티클 흩뿌리기
            if (boardRenderer != null && MergeEffect.Instance != null && gm.ColorConfig != null)
            {
                var refillPositions = new System.Collections.Generic.List<Vector2>();
                var refillColors = new System.Collections.Generic.List<Color>();

                foreach (var coord in gm.Grid.AllCoords)
                {
                    var cell = gm.Grid.GetCell(coord);
                    if (cell != null && cell.IsEmpty)
                    {
                        var view = boardRenderer.GetCellView(coord);
                        if (view != null)
                        {
                            refillPositions.Add(view.RectTransform.anchoredPosition);
                            // Use base value color for refill particles
                            refillColors.Add(gm.ColorConfig.GetColor(result.BaseValue));
                        }
                    }
                }

                if (refillPositions.Count > 0)
                {
                    MergeEffect.Instance.PlayRefillParticles(refillPositions, refillColors);
                    yield return new WaitForSeconds(0.2f);
                }
            }

            // 보드 갱신 (리필)
            RefreshBoard();

            // 왕관 변경 감지
            CheckCrownChange();

            isAnimating = false;
        }

        private void OnNewTilesSpawned()
        {
            // 머지 애니메이션 중이면 스킵 (RefreshBoard는 애니메이션 완료 후 호출)
            if (isAnimating) return;

            // Animate new tiles
            if (boardRenderer == null || TileAnimator.Instance == null) return;

            foreach (var coord in gm.Grid.AllCoords)
            {
                var cell = gm.Grid.GetCell(coord);
                if (cell == null || cell.IsEmpty) continue;

                var view = boardRenderer.GetCellView(coord);
                if (view != null && view.RectTransform.localScale == Vector3.zero)
                {
                    TileAnimator.Instance.PlaySpawnAnimation(view.RectTransform);
                }
            }

            RefreshBoard();
        }

        private void OnScoreChanged(double score)
        {
            if (hudManager != null)
                hudManager.UpdateScore(score);
        }

        private void OnHighScoreChanged(double highScore)
        {
            if (hudManager != null)
                hudManager.UpdateHighScore(highScore);
        }

        private void OnGameStateChanged(GameState state)
        {
            switch (state)
            {
                case GameState.Playing:
                    // 초기 로드 시 GameStart 스킵 (WebGL AudioContext Suspended → 첫 클릭 시 머지 사운드와 겹침)
                    if (isFirstGameStart)
                    {
                        isFirstGameStart = false;
                    }
                    else if (AudioManager.Instance != null)
                    {
                        AudioManager.Instance.PlaySFX(SFXType.GameStart);
                    }
                    RefreshBoard();
                    UpdateCrownTracking();
                    break;

                case GameState.GameOver:
                    if (AudioManager.Instance != null)
                        AudioManager.Instance.PlaySFX(SFXType.GameOver);
                    if (TileAnimator.Instance != null && boardRenderer != null)
                        TileAnimator.Instance.PlayGameOverAnimation(
                            boardRenderer.GetComponent<RectTransform>());
                    // 리더보드에 최종 점수 등록
                    RegisterLeaderboardEntry();
                    break;
            }
        }

        private void UpdateCrownTracking()
        {
            var highest = gm.Grid.GetHighestValueCell();
            lastCrownCoord = (highest != null && !highest.IsEmpty)
                ? (HexCoord?)highest.Coord : null;
        }

        private void CheckCrownChange()
        {
            var highest = gm.Grid.GetHighestValueCell();
            HexCoord? newCrown = (highest != null && !highest.IsEmpty)
                ? (HexCoord?)highest.Coord : null;

            if (lastCrownCoord.HasValue && newCrown.HasValue
                && !lastCrownCoord.Value.Equals(newCrown.Value))
            {
                if (AudioManager.Instance != null)
                    AudioManager.Instance.PlaySFX(SFXType.CrownChange);
            }

            lastCrownCoord = newCrown;
        }

        private void RegisterLeaderboardEntry()
        {
            if (gm == null) return;
            double score = gm.Score.CurrentScore;
            if (score <= 0) return;

            LeaderboardScreen.AddEntry(score);
        }

        private void RefreshBoard()
        {
            if (boardRenderer != null && gm != null)
                boardRenderer.RefreshAll(gm.Grid);
        }
    }
}
