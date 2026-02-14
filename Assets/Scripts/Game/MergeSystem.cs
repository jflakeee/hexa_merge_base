using System;
using System.Collections.Generic;
using HexaMerge.Core;

namespace HexaMerge.Game
{
    public struct MergeResult
    {
        public bool Success;
        public HexCoord MergeTargetCoord;
        public int ResultValue;
        public int MergedCount;
        public int ScoreGained;
        public List<HexCoord> MergedCoords;
    }

    public class MergeSystem
    {
        private readonly HexGrid grid;

        public MergeSystem(HexGrid grid)
        {
            this.grid = grid;
        }

        public List<HexCell> FindConnectedGroup(HexCoord startCoord)
        {
            var result = new List<HexCell>();
            HexCell startCell = grid.GetCell(startCoord);
            if (startCell == null || startCell.IsEmpty) return result;

            int targetValue = startCell.TileValue;
            var visited = new HashSet<HexCoord>();
            var queue = new Queue<HexCoord>();

            queue.Enqueue(startCoord);
            visited.Add(startCoord);

            while (queue.Count > 0)
            {
                HexCoord current = queue.Dequeue();
                HexCell cell = grid.GetCell(current);
                result.Add(cell);

                var neighbors = current.GetNeighbors();
                for (int i = 0; i < neighbors.Count; i++)
                {
                    HexCoord nCoord = neighbors[i];
                    if (visited.Contains(nCoord)) continue;

                    HexCell nCell = grid.GetCell(nCoord);
                    if (nCell == null || nCell.TileValue != targetValue) continue;

                    visited.Add(nCoord);
                    queue.Enqueue(nCoord);
                }
            }

            return result;
        }

        public MergeResult TryMerge(HexCoord tapCoord)
        {
            var result = new MergeResult
            {
                Success = false,
                MergeTargetCoord = tapCoord,
                MergedCoords = new List<HexCoord>()
            };

            HexCell tapCell = grid.GetCell(tapCoord);
            if (tapCell == null || tapCell.IsEmpty) return result;

            List<HexCell> group = FindConnectedGroup(tapCoord);
            if (group.Count < 2) return result;

            int baseValue = tapCell.TileValue;
            int count = group.Count;
            int mergedValue = CalculateMergeValue(baseValue, count);

            var mergedCoords = new List<HexCoord>(count);
            for (int i = 0; i < group.Count; i++)
            {
                mergedCoords.Add(group[i].Coord);
                group[i].Clear();
            }

            tapCell.SetValue(mergedValue);

            result.Success = true;
            result.MergeTargetCoord = tapCoord;
            result.ResultValue = mergedValue;
            result.MergedCount = count;
            result.ScoreGained = mergedValue * count;
            result.MergedCoords = mergedCoords;

            return result;
        }

        public bool CanMerge(HexCoord coord)
        {
            HexCell cell = grid.GetCell(coord);
            if (cell == null || cell.IsEmpty) return false;
            return FindConnectedGroup(coord).Count >= 2;
        }

        private int CalculateMergeValue(int baseValue, int count)
        {
            // n개 머지 시 value * 2^(n-1), MaxValue 제한
            long value = baseValue;
            for (int i = 1; i < count; i++)
            {
                value *= 2;
                if (value >= TileHelper.MaxValue)
                    return TileHelper.MaxValue;
            }
            return (int)value;
        }
    }
}
