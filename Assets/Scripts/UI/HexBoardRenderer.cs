namespace HexaMerge.UI
{
    using HexaMerge.Core;
    using HexaMerge.Game;
    using UnityEngine;
    using System;
    using System.Collections.Generic;

    public class HexBoardRenderer : MonoBehaviour
    {
        [SerializeField] private GameObject hexCellPrefab;
        [SerializeField] private RectTransform boardContainer;
        [SerializeField] private float hexSize = 80f;
        [SerializeField] private float hexSpacing = 4f;

        private Dictionary<HexCoord, HexCellView> cellViews = new Dictionary<HexCoord, HexCellView>();

        public event Action<HexCoord> OnCellTapped;

        public void Initialize(HexGrid grid)
        {
            foreach (var view in cellViews.Values)
            {
                if (view != null)
                    Destroy(view.gameObject);
            }
            cellViews.Clear();

            foreach (HexCoord coord in grid.AllCoords)
            {
                GameObject go = Instantiate(hexCellPrefab, boardContainer);
                go.name = $"HexCell_{coord.q}_{coord.r}";

                RectTransform rt = (RectTransform)go.transform;
                rt.anchoredPosition = CalculateCellPosition(coord);
                rt.sizeDelta = new Vector2(hexSize, hexSize);

                HexCellView cellView = go.GetComponent<HexCellView>();
                var colorConfig = GameManager.Instance != null ? GameManager.Instance.ColorConfig : null;
                cellView.Initialize(coord, OnCellTappedInternal, colorConfig);

                cellViews[coord] = cellView;
            }
        }

        private Vector2 CalculateCellPosition(HexCoord coord)
        {
            float totalSize = hexSize + hexSpacing;

            // Flat-top hexagon layout:
            // x = size * 3/2 * q
            // y = size * sqrt(3) * (r + q / 2)
            float x = totalSize * 1.5f * coord.q;
            float y = totalSize * Mathf.Sqrt(3f) * (coord.r + coord.q * 0.5f);

            // Y is inverted in UI (positive r goes downward)
            return new Vector2(x, -y);
        }

        public void RefreshAll(HexGrid grid)
        {
            HexCell highestCell = grid.GetHighestValueCell();
            int highestValue = highestCell != null ? highestCell.TileValue : 0;

            foreach (HexCoord coord in grid.AllCoords)
            {
                HexCell cell = grid.GetCell(coord);
                if (cell == null || !cellViews.ContainsKey(coord)) continue;

                // Ensure cell view is active (animation may have deactivated it)
                if (!cellViews[coord].gameObject.activeSelf)
                    cellViews[coord].gameObject.SetActive(true);

                bool hasCrown = !cell.IsEmpty
                    && highestValue > 0
                    && cell.TileValue == highestValue;

                cellViews[coord].UpdateView(cell.TileValue, hasCrown);
            }
        }

        public void RefreshCell(HexCoord coord, int value, bool hasCrown)
        {
            if (cellViews.TryGetValue(coord, out HexCellView view))
                view.UpdateView(value, hasCrown);
        }

        public HexCellView GetCellView(HexCoord coord)
        {
            cellViews.TryGetValue(coord, out HexCellView view);
            return view;
        }

        private void OnCellTappedInternal(HexCoord coord)
        {
            OnCellTapped?.Invoke(coord);
        }

        public void AutoFitToContainer()
        {
            if (boardContainer == null || cellViews.Count == 0) return;

            float minX = float.MaxValue, maxX = float.MinValue;
            float minY = float.MaxValue, maxY = float.MinValue;

            foreach (var view in cellViews.Values)
            {
                Vector2 pos = view.RectTransform.anchoredPosition;
                if (pos.x < minX) minX = pos.x;
                if (pos.x > maxX) maxX = pos.x;
                if (pos.y < minY) minY = pos.y;
                if (pos.y > maxY) maxY = pos.y;
            }

            float boardWidth = (maxX - minX) + hexSize;
            float boardHeight = (maxY - minY) + hexSize;

            Vector2 containerSize = boardContainer.rect.size;
            if (containerSize.x <= 0 || containerSize.y <= 0) return;

            float scaleX = containerSize.x / boardWidth;
            float scaleY = containerSize.y / boardHeight;
            float scale = Mathf.Min(scaleX, scaleY, 1f);

            boardContainer.localScale = Vector3.one * scale;

            // Center the board
            float centerX = (minX + maxX) * 0.5f;
            float centerY = (minY + maxY) * 0.5f;

            foreach (var view in cellViews.Values)
            {
                Vector2 pos = view.RectTransform.anchoredPosition;
                view.RectTransform.anchoredPosition = new Vector2(pos.x - centerX, pos.y - centerY);
            }
        }
    }
}
