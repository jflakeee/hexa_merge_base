using System;

namespace HexaMerge.Core
{
    [System.Serializable]
    public class HexCell
    {
        public HexCoord Coord { get; private set; }
        public int TileValue { get; private set; }

        public bool IsEmpty => TileValue == 0;
        public bool HasCrown { get; set; }

        public event Action OnValueChanged;

        public HexCell(HexCoord coord)
        {
            Coord = coord;
            TileValue = 0;
        }

        public void SetValue(int value)
        {
            if (TileValue == value) return;
            TileValue = value;
            OnValueChanged?.Invoke();
        }

        public void Clear()
        {
            SetValue(0);
        }

        public string GetDisplayText()
        {
            if (TileValue == 0) return string.Empty;
            return TileHelper.FormatValue(TileValue);
        }
    }
}
