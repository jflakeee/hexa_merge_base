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

            // 깊이별 순차 머지: 가장 깊은(먼) 블럭부터 타겟으로 이동
            if (TileAnimator.Instance != null && boardRenderer != null && targetView != null
                && result.DepthGroups != null)
            {
                int stepIndex = 0;
                for (int g = 0; g < result.DepthGroups.Count; g++)
                {
                    var group = result.DepthGroups[g];

                    // 이 깊이의 블럭들을 하나씩 타겟으로 이동
                    for (int c = 0; c < group.Count; c++)
                    {
                        var sourceView = boardRenderer.GetCellView(group[c]);
                        if (sourceView == null) continue;

                        bool stepDone = false;
                        TileAnimator.Instance.PlaySingleMergeStep(
                            sourceView.RectTransform,
                            targetView.RectTransform,
                            () => stepDone = true);
                        while (!stepDone) yield return null;
                    }

                    // 깊이 레벨 완료 → 단계별 값 갱신 (2배)
                    if (stepIndex < result.StepValues.Count)
                    {
                        targetView.UpdateView(result.StepValues[stepIndex], false);
                    }
                    stepIndex++;
                }
            }

            // Splat 이펙트
            if (MergeEffect.Instance != null && targetView != null && gm.ColorConfig != null)
            {
                Color baseColor = gm.ColorConfig.GetColor(result.ResultValue);
                MergeEffect.Instance.PlaySplatEffect(
                    targetView.RectTransform.anchoredPosition, baseColor,
                    result.MergedCount);
            }

            // 타겟 스케일 펀치
            if (TileAnimator.Instance != null && targetView != null)
            {
                bool punchDone = false;
                TileAnimator.Instance.PlayScalePunch(
                    targetView.RectTransform, () => punchDone = true);
                while (!punchDone) yield return null;
            }

            // SFX
            if (AudioManager.Instance != null)
            {
                SFXType sfx = AudioManager.GetMergeSFXType(result.ResultValue);
                AudioManager.Instance.PlaySFX(sfx);
            }

            // 보드 갱신 (모든 병합 완료 후 리필 타일 표시)
            RefreshBoard();
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
