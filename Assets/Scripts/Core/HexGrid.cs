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

            // Diamond grid: rows 1-2-3-4-5-4-3-2-1 (total 25 cells)
            // Center at r=0, grid spans r from -4 to +4
            // Row widths: r=-4:1, r=-3:2, r=-2:3, r=-1:4, r=0:5, r=1:4, r=2:3, r=3:2, r=4:1
            int gridRadius = 4;

            for (int r = -gridRadius; r <= gridRadius; r++)
            {
                int rowWidth = gridRadius + 1 - Math.Abs(r); // 1,2,3,4,5,4,3,2,1

                // Center each row horizontally in q-axis
                int qStart = -(rowWidth - 1) / 2;
                int qEnd = rowWidth / 2;

                for (int q = qStart; q <= qEnd; q++)
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
            int maxValue = 0;

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
