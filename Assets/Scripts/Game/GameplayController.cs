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

            // Cache source cell original positions and coords
            var sourcePositions = new Dictionary<HexCoord, Vector2>();
            var sourceCoords = new List<HexCoord>();
            if (boardRenderer != null)
            {
                foreach (var coord in result.MergedCoords)
                {
                    if (coord == result.MergeTargetCoord) continue;
                    var view = boardRenderer.GetCellView(coord);
                    if (view != null)
                    {
                        sourcePositions[coord] = view.RectTransform.anchoredPosition;
                        sourceCoords.Add(coord);
                    }
                }
            }

            // Sequential merge animation (farthest first)
            var targetView = boardRenderer.GetCellView(result.MergeTargetCoord);
            if (TileAnimator.Instance != null && targetView != null)
            {
                int stepIndex = 0;
                foreach (var coord in sourceCoords)
                {
                    var sourceView = boardRenderer.GetCellView(coord);
                    if (sourceView == null) continue;

                    // 1) Source -> Target move animation
                    bool done = false;
                    TileAnimator.Instance.PlaySingleMergeStep(
                        sourceView.RectTransform, targetView.RectTransform,
                        () => done = true);
                    while (!done) yield return null;

                    // 2) Update target value (step-by-step doubling)
                    if (result.StepValues != null && stepIndex < result.StepValues.Count)
                    {
                        int stepValue = result.StepValues[stepIndex];
                        targetView.UpdateView(stepValue, false);
                    }
                    stepIndex++;
                }
            }

            // Restore source cells after animation
            foreach (var kvp in sourcePositions)
            {
                var view = boardRenderer.GetCellView(kvp.Key);
                if (view != null)
                {
                    view.gameObject.SetActive(true);
                    view.RectTransform.anchoredPosition = kvp.Value;
                    view.RectTransform.localScale = Vector3.one;
                }
            }

            // Play splash effect
            if (MergeEffect.Instance != null && targetView != null && gm.ColorConfig != null)
            {
                Color tileColor = gm.ColorConfig.GetColor(result.ResultValue);
                MergeEffect.Instance.PlayMergeEffect(
                    targetView.RectTransform.anchoredPosition, tileColor);
            }

            // Play SFX
            if (AudioManager.Instance != null)
            {
                SFXType sfx = AudioManager.GetMergeSFXType(result.ResultValue);
                AudioManager.Instance.PlaySFX(sfx);
            }

            // Refresh board after animation
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
