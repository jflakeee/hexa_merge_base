using System;
using System.Collections.Generic;
using System.Linq;

namespace HexaMerge.Core
{
    [System.Serializable]
    public class HexGrid
    {
        private Dictionary<HexCoord, HexCell> cells = new Dictionary<HexCoord, HexCell>();

        public int CellCount => cells.Count;
        public IEnumerable<HexCoord> AllCoords => cells.Keys;

        public void Initialize()
        {
            cells.Clear();

            // 19-cell hexagonal grid (radius 2): 3-4-5-4-3
            int gridRadius = 2;

            for (int q = -gridRadius; q <= gridRadius; q++)
            {
                int r1 = Math.Max(-gridRadius, -q - gridRadius);
                int r2 = Math.Min(gridRadius, -q + gridRadius);

                for (int r = r1; r <= r2; r++)
                {
                    var coord = new HexCoord(q, r);
                    cells[coord] = new HexCell(coord);
                }
            }
        }

        public HexCell GetCell(HexCoord coord)
        {
            cells.TryGetValue(coord, out HexCell cell);
            return cell;
        }

        public List<HexCell> GetNeighbors(HexCoord coord)
        {
            var neighbors = new List<HexCell>(6);
            var neighborCoords = coord.GetNeighbors();

            for (int i = 0; i < neighborCoords.Count; i++)
            {
                if (cells.TryGetValue(neighborCoords[i], out HexCell cell))
                {
                    neighbors.Add(cell);
                }
            }

            return neighbors;
        }

        public List<HexCell> GetEmptyCells()
        {
            var empty = new List<HexCell>();
            foreach (var cell in cells.Values)
            {
                if (cell.IsEmpty) empty.Add(cell);
            }
            return empty;
        }

        public List<HexCell> GetAllCells()
        {
            return new List<HexCell>(cells.Values);
        }

        public HexCell GetHighestValueCell()
        {
            HexCell highest = null;
            double maxValue = 0;

            foreach (var cell in cells.Values)
            {
                if (cell.TileValue > maxValue)
                {
                    maxValue = cell.TileValue;
                    highest = cell;
                }
            }

            return highest;
        }

        public bool HasValidMerge()
        {
            foreach (var kvp in cells)
            {
                if (kvp.Value.IsEmpty) continue;

                var neighborCoords = kvp.Key.GetNeighbors();
                for (int i = 0; i < neighborCoords.Count; i++)
                {
                    if (cells.TryGetValue(neighborCoords[i], out HexCell neighbor)
                        && neighbor.TileValue == kvp.Value.TileValue)
                    {
                        return true;
                    }
                }
            }

            return false;
        }

        public bool IsFull()
        {
            foreach (var cell in cells.Values)
            {
                if (cell.IsEmpty) return false;
            }
            return true;
        }
    }
}
