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

            // 깊이별 순차 splat: 가장 깊은(먼) 블럭부터 소스 위치에 splat 생성
            if (boardRenderer != null && result.DepthGroups != null)
            {
                Color splatColor = Color.yellow;
                if (gm.ColorConfig != null)
                    splatColor = gm.ColorConfig.GetColor(result.BaseValue);

                for (int g = 0; g < result.DepthGroups.Count; g++)
                {
                    var group = result.DepthGroups[g];

                    // 그룹 중심 위치 계산
                    Vector2 centerPos = Vector2.zero;
                    int validCount = 0;
                    for (int c = 0; c < group.Count; c++)
                    {
                        var view = boardRenderer.GetCellView(group[c]);
                        if (view != null)
                        {
                            centerPos += view.RectTransform.anchoredPosition;
                            validCount++;
                        }
                    }
                    if (validCount > 0) centerPos /= validCount;

                    // Splat 이펙트 (소스 위치에)
                    if (MergeEffect.Instance != null)
                    {
                        MergeEffect.Instance.PlaySplatEffect(
                            centerPos, splatColor, group.Count);
                    }

                    // 소스 셀 숨기기 (splat이 마스킹)
                    for (int c = 0; c < group.Count; c++)
                    {
                        var view = boardRenderer.GetCellView(group[c]);
                        if (view != null)
                            view.gameObject.SetActive(false);
                    }

                    // 다음 깊이 그룹까지 대기 (벤치마크: ~0.17초)
                    yield return new WaitForSeconds(0.17f);
                }
            }

            // splat 페이드 대기
            yield return new WaitForSeconds(0.15f);

            // 타겟에 최종값 표시
            if (targetView != null)
            {
                targetView.gameObject.SetActive(true);
                var highestCell = gm.Grid.GetHighestValueCell();
                int highestValue = highestCell != null ? highestCell.TileValue : 0;
                bool hasCrown = result.ResultValue == highestValue && highestValue > 0;
                targetView.UpdateView(result.ResultValue, hasCrown);
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
