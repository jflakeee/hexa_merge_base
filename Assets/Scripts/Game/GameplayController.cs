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

            // 1) 타겟에 최종 결과값 즉시 표시
            if (targetView != null)
            {
                var highestCell = gm.Grid.GetHighestValueCell();
                int highestValue = highestCell != null ? highestCell.TileValue : 0;
                bool hasCrown = result.ResultValue == highestValue && highestValue > 0;
                targetView.UpdateView(result.ResultValue, hasCrown);
            }

            // 2) Splat 이펙트 시작 (소스 타일 소멸을 마스킹)
            if (MergeEffect.Instance != null && targetView != null && gm.ColorConfig != null)
            {
                Color baseColor = gm.ColorConfig.GetColor(result.ResultValue);
                MergeEffect.Instance.PlaySplatEffect(
                    targetView.RectTransform.anchoredPosition, baseColor,
                    result.MergedCount);
            }

            // 3) 소스 타일 동시 소멸 (제자리 축소, 0.15초)
            if (TileAnimator.Instance != null && boardRenderer != null)
            {
                var sourceViews = new List<RectTransform>();
                foreach (var coord in result.MergedCoords)
                {
                    if (coord == result.MergeTargetCoord) continue;
                    var view = boardRenderer.GetCellView(coord);
                    if (view != null) sourceViews.Add(view.RectTransform);
                }

                bool disappearDone = false;
                TileAnimator.Instance.PlaySimultaneousDisappear(
                    sourceViews, () => disappearDone = true);
                while (!disappearDone) yield return null;
            }

            // 4) Splat 페이드 대기 (0.3초)
            yield return new WaitForSeconds(0.3f);

            // 5) 타겟 스케일 펀치
            if (TileAnimator.Instance != null && targetView != null)
            {
                bool punchDone = false;
                TileAnimator.Instance.PlayScalePunch(
                    targetView.RectTransform, () => punchDone = true);
                while (!punchDone) yield return null;
            }

            // 6) SFX
            if (AudioManager.Instance != null)
            {
                SFXType sfx = AudioManager.GetMergeSFXType(result.ResultValue);
                AudioManager.Instance.PlaySFX(sfx);
            }

            // 7) 보드 갱신 (리필 트리거)
            RefreshBoard();
            isAnimating = false;
        }

        private void OnNewTilesSpawned()
        {
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

        private void OnScoreChanged(int score)
        {
            if (hudManager != null)
                hudManager.UpdateScore(score);
        }

        private void OnHighScoreChanged(int highScore)
        {
            if (hudManager != null)
                hudManager.UpdateHighScore(highScore);
        }

        private void OnGameStateChanged(GameState state)
        {
            switch (state)
            {
                case GameState.Playing:
                    RefreshBoard();
                    break;

                case GameState.GameOver:
                    if (AudioManager.Instance != null)
                        AudioManager.Instance.PlaySFX(SFXType.GameOver);
                    if (TileAnimator.Instance != null && boardRenderer != null)
                        TileAnimator.Instance.PlayGameOverAnimation(
                            boardRenderer.GetComponent<RectTransform>());
                    break;
            }
        }

        private void RefreshBoard()
        {
            if (boardRenderer != null && gm != null)
                boardRenderer.RefreshAll(gm.Grid);
        }
    }
}
