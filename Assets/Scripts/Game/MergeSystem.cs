using System;
using System.Collections.Generic;
using UnityEngine;
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
        public List<int> StepValues;
        public List<List<HexCoord>> DepthGroups;
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

            int baseValue = tapCell.TileValue;

            // BFS with depth tracking (트리 구조 형태로 거리 계산)
            var visited = new HashSet<HexCoord>();
            var queue = new Queue<HexCoord>();
            var depthMap = new Dictionary<HexCoord, int>();

            queue.Enqueue(tapCoord);
            visited.Add(tapCoord);
            depthMap[tapCoord] = 0;

            while (queue.Count > 0)
            {
                HexCoord current = queue.Dequeue();
                int currentDepth = depthMap[current];

                var neighbors = current.GetNeighbors();
                for (int i = 0; i < neighbors.Count; i++)
                {
                    HexCoord nCoord = neighbors[i];
                    if (visited.Contains(nCoord)) continue;

                    HexCell nCell = grid.GetCell(nCoord);
                    if (nCell == null || nCell.TileValue != baseValue) continue;

                    visited.Add(nCoord);
                    depthMap[nCoord] = currentDepth + 1;
                    queue.Enqueue(nCoord);
                }
            }

            int totalCells = visited.Count;
            if (totalCells < 2) return result;

            // 깊이별 그룹 생성 (depth 0 = tapCoord 제외)
            var depthGroupsMap = new Dictionary<int, List<HexCoord>>();
            int maxDepth = 0;

            foreach (var kvp in depthMap)
            {
                if (kvp.Value == 0) continue; // skip tap cell
                if (!depthGroupsMap.ContainsKey(kvp.Value))
                    depthGroupsMap[kvp.Value] = new List<HexCoord>();
                depthGroupsMap[kvp.Value].Add(kvp.Key);
                if (kvp.Value > maxDepth) maxDepth = kvp.Value;
            }

            // 깊이 레벨 수 = 값 계산 기준
            // 다른 깊이에 있는 블럭만 계산에 포함
            // 동일한 깊이에 있는 블럭은 계산에서 제외 (하나의 단계로 처리)
            int depthLevels = depthGroupsMap.Count;
            int mergedValue = CalculateMergeValueByDepth(baseValue, depthLevels);

            // StepValues (깊이 레벨당 1개, 단계별 2배 증가)
            var stepValues = new List<int>();
            int stepValue = baseValue;
            for (int d = 0; d < depthLevels; d++)
            {
                stepValue = Mathf.Min(stepValue * 2, TileHelper.MaxValue);
                stepValues.Add(stepValue);
            }

            // 모든 셀 클리어 후 타겟에 최종값 설정
            foreach (var coord in visited)
            {
                grid.GetCell(coord).Clear();
            }
            tapCell.SetValue(mergedValue);

            // DepthGroups 리스트 (깊이 깊은 것부터 = 가장 먼 블럭부터)
            var depthGroups = new List<List<HexCoord>>();
            for (int d = maxDepth; d >= 1; d--)
            {
                if (depthGroupsMap.ContainsKey(d))
                    depthGroups.Add(depthGroupsMap[d]);
            }

            // MergedCoords (tapCoord 첫 번째, 나머지 깊이 깊은 순)
            var mergedCoords = new List<HexCoord>();
            mergedCoords.Add(tapCoord);
            for (int i = 0; i < depthGroups.Count; i++)
            {
                mergedCoords.AddRange(depthGroups[i]);
            }

            result.Success = true;
            result.MergeTargetCoord = tapCoord;
            result.ResultValue = mergedValue;
            result.MergedCount = totalCells;
            result.ScoreGained = mergedValue * depthLevels;
            result.MergedCoords = mergedCoords;
            result.StepValues = stepValues;
            result.DepthGroups = depthGroups;

            return result;
        }

        public bool CanMerge(HexCoord coord)
        {
            HexCell cell = grid.GetCell(coord);
            if (cell == null || cell.IsEmpty) return false;
            return FindConnectedGroup(coord).Count >= 2;
        }

        private int CalculateMergeValueByDepth(int baseValue, int depthLevels)
        {
            long value = (long)baseValue;
            for (int i = 0; i < depthLevels; i++)
            {
                value *= 2;
                if (value >= TileHelper.MaxValue)
                    return TileHelper.MaxValue;
            }
            return (int)value;
        }
    }
}
