namespace HexaMerge.Game
{
    using HexaMerge.Core;
    using UnityEngine;
    using System.Collections.Generic;

    [System.Serializable]
    public class GameSaveData
    {
        public int score;
        public List<CellSaveData> cells = new List<CellSaveData>();
    }

    [System.Serializable]
    public class CellSaveData
    {
        public int q;
        public int r;
        public int value;
    }

    public static class SaveSystem
    {
        private const string SAVE_KEY = "GameSave";

        public static void Save(HexGrid grid, int score)
        {
            var data = new GameSaveData { score = score };

            foreach (var coord in grid.AllCoords)
            {
                var cell = grid.GetCell(coord);
                if (!cell.IsEmpty)
                {
                    data.cells.Add(new CellSaveData
                    {
                        q = coord.q,
                        r = coord.r,
                        value = cell.TileValue
                    });
                }
            }

            string json = JsonUtility.ToJson(data);
            PlayerPrefs.SetString(SAVE_KEY, json);
            PlayerPrefs.Save();
        }

        public static GameSaveData Load()
        {
            if (!PlayerPrefs.HasKey(SAVE_KEY))
                return null;

            string json = PlayerPrefs.GetString(SAVE_KEY);
            if (string.IsNullOrEmpty(json))
                return null;

            try
            {
                return JsonUtility.FromJson<GameSaveData>(json);
            }
            catch
            {
                return null;
            }
        }

        public static bool HasSave()
        {
            return PlayerPrefs.HasKey(SAVE_KEY);
        }

        public static void DeleteSave()
        {
            PlayerPrefs.DeleteKey(SAVE_KEY);
            PlayerPrefs.Save();
        }

        public static void ApplyToGrid(GameSaveData data, HexGrid grid)
        {
            foreach (var coord in grid.AllCoords)
            {
                grid.GetCell(coord).Clear();
            }

            foreach (var cellData in data.cells)
            {
                var coord = new HexCoord(cellData.q, cellData.r);
                var cell = grid.GetCell(coord);
                if (cell != null)
                {
                    cell.SetValue(cellData.value);
                }
            }
        }
    }
}
