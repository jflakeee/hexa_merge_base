using System;
using System.Collections.Generic;
using UnityEngine;

namespace HexaMerge.Core
{
    public enum Direction
    {
        NE = 0,
        E  = 1,
        SE = 2,
        SW = 3,
        W  = 4,
        NW = 5
    }

    [System.Serializable]
    public readonly struct HexCoord : IEquatable<HexCoord>
    {
        public readonly int q;
        public readonly int r;
        public int s => -q - r;

        private static readonly HexCoord[] Directions = new HexCoord[]
        {
            new HexCoord(+1, -1), // NE
            new HexCoord(+1,  0), // E
            new HexCoord( 0, +1), // SE
            new HexCoord(-1, +1), // SW
            new HexCoord(-1,  0), // W
            new HexCoord( 0, -1), // NW
        };

        public HexCoord(int q, int r)
        {
            this.q = q;
            this.r = r;
        }

        public HexCoord GetNeighbor(Direction direction)
        {
            HexCoord offset = Directions[(int)direction];
            return new HexCoord(q + offset.q, r + offset.r);
        }

        public IReadOnlyList<HexCoord> GetNeighbors()
        {
            var neighbors = new HexCoord[6];
            for (int i = 0; i < 6; i++)
            {
                neighbors[i] = new HexCoord(q + Directions[i].q, r + Directions[i].r);
            }
            return neighbors;
        }

        public int Distance(HexCoord other)
        {
            return (Mathf.Abs(q - other.q) + Mathf.Abs(r - other.r) + Mathf.Abs(s - other.s)) / 2;
        }

        // Cube -> Offset (odd-r layout)
        public Vector2Int ToOffset()
        {
            int col = q + (r - (r & 1)) / 2;
            int row = r;
            return new Vector2Int(col, row);
        }

        // Offset (odd-r) -> Cube
        public static HexCoord FromOffset(int col, int row)
        {
            int q = col - (row - (row & 1)) / 2;
            int r = row;
            return new HexCoord(q, r);
        }

        // Cube -> World position (pointy-top hex)
        public Vector3 ToWorldPosition(float hexSize)
        {
            float x = hexSize * (Mathf.Sqrt(3f) * q + Mathf.Sqrt(3f) / 2f * r);
            float y = hexSize * (3f / 2f * r);
            return new Vector3(x, y, 0f);
        }

        public bool Equals(HexCoord other)
        {
            return q == other.q && r == other.r;
        }

        public override bool Equals(object obj)
        {
            return obj is HexCoord other && Equals(other);
        }

        public override int GetHashCode()
        {
            return q * 397 ^ r;
        }

        public override string ToString()
        {
            return $"({q}, {r}, {s})";
        }

        public static bool operator ==(HexCoord a, HexCoord b) => a.Equals(b);
        public static bool operator !=(HexCoord a, HexCoord b) => !a.Equals(b);
        public static HexCoord operator +(HexCoord a, HexCoord b) => new HexCoord(a.q + b.q, a.r + b.r);
        public static HexCoord operator -(HexCoord a, HexCoord b) => new HexCoord(a.q - b.q, a.r - b.r);
    }
}
