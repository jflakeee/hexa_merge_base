using System;
using System.Collections.Generic;
using UnityEngine;
using HexaMerge.Core;

namespace HexaMerge.Game
{
    public enum GameState { Ready, Playing, Paused, GameOver }

    public class GameManager : MonoBehaviour
    {
        public static GameManager Instance { get; private set; }

        [SerializeField] private TileColorConfig tileColorConfig;
        [SerializeField] private int initialTileCount = 5;

        public GameState State { get; private set; }
        public HexGrid Grid { get; private set; }
        public MergeSystem MergeSystem { get; private set; }
        public ScoreManager Score { get; private set; }
        public TileColorConfig ColorConfig => tileColorConfig;

        public event Action<GameState> OnStateChanged;
        public event Action<MergeResult> OnMergePerformed;
        public event Action OnNewTilesSpawned;

        private void Awake()
        {
            if (Instance != null && Instance != this)
            {
                Destroy(gameObject);
                return;
            }
            Instance = this;
            DontDestroyOnLoad(gameObject);

            Initialize();
        }

        private void Initialize()
        {
            Grid = new HexGrid();
            Grid.Initialize();
            MergeSystem = new MergeSystem(Grid);
            Score = new ScoreManager();
            SetState(GameState.Ready);
        }

        public void StartNewGame()
        {
            Grid.Initialize();
            Score.Reset();

            FillAllEmptyCells(useInitialWeights: true);

            UpdateCrowns();
            SetState(GameState.Playing);
        }

        // JS에서 호출 가능한 문자열 기반 탭 핸들러 (예: "0,0")
        public void HandleTapString(string coordStr)
        {
            var parts = coordStr.Split(',');
            if (parts.Length != 2) return;
            int q, r;
            if (!int.TryParse(parts[0].Trim(), out q) || !int.TryParse(parts[1].Trim(), out r)) return;
            HandleTap(new HexCoord(q, r));
        }

        public void HandleTap(HexCoord coord)
        {
            if (State != GameState.Playing) return;

            // 머지 전 최고값 기록 (32배 소멸 규칙 판정용)
            int previousMax = GetHighestValue();

            MergeResult result = MergeSystem.TryMerge(coord);
            if (!result.Success) return;

            Score.AddScore(result.ScoreGained);
            OnMergePerformed?.Invoke(result);

            // 32배 소멸 규칙: 새 최대값 블럭 생성 시, 32배 작은 블럭 일괄 소멸
            if (result.ResultValue > previousMax)
            {
                DestroySmallBlocks(result.ResultValue);
            }

            FillAllEmptyCells(useInitialWeights: false);
            OnNewTilesSpawned?.Invoke();

            UpdateCrowns();
            CheckGameOver();
        }

        public void SpawnNewTile()
        {
            List<HexCell> emptyCells = Grid.GetEmptyCells();
            if (emptyCells.Count == 0) return;

            int index = UnityEngine.Random.Range(0, emptyCells.Count);
            int value = TileHelper.GetRandomNewTileValue();
            emptyCells[index].SetValue(value);
        }

        public void PauseGame()
        {
            if (State == GameState.Playing)
                SetState(GameState.Paused);
        }

        public void ResumeGame()
        {
            if (State == GameState.Paused)
                SetState(GameState.Playing);
        }

        private void CheckGameOver()
        {
            if (Grid.IsFull() && !Grid.HasValidMerge())
            {
                Score.SaveHighScore();
                SetState(GameState.GameOver);
            }
        }

        public void FillAllEmptyCells(bool useInitialWeights = false)
        {
            int minDisplayed = GetMinDisplayedValue();
            List<HexCell> emptyCells = Grid.GetEmptyCells();
            for (int i = 0; i < emptyCells.Count; i++)
            {
                int value = useInitialWeights
                    ? TileHelper.GetRandomInitialTileValue()
                    : TileHelper.GetRandomRefillValue(minDisplayed);
                emptyCells[i].SetValue(value);
            }
        }

        private int GetHighestValue()
        {
            int max = 0;
            foreach (var coord in Grid.AllCoords)
            {
                var cell = Grid.GetCell(coord);
                if (cell != null && cell.TileValue > max)
                    max = cell.TileValue;
            }
            return max;
        }

        private int GetMinDisplayedValue()
        {
            int min = int.MaxValue;
            foreach (var coord in Grid.AllCoords)
            {
                var cell = Grid.GetCell(coord);
                if (cell != null && !cell.IsEmpty && cell.TileValue < min)
                    min = cell.TileValue;
            }
            return min == int.MaxValue ? 2 : min;
        }

        private void DestroySmallBlocks(int maxValue)
        {
            int threshold = maxValue / 32;
            if (threshold < TileHelper.MinValue) return;

            int destroyed = 0;
            foreach (var coord in Grid.AllCoords)
            {
                var cell = Grid.GetCell(coord);
                if (cell != null && !cell.IsEmpty && cell.TileValue <= threshold)
                {
                    cell.Clear();
                    destroyed++;
                }
            }

            if (destroyed > 0)
                Debug.Log(string.Format("[GameManager] 32x rule: destroyed {0} blocks <= {1}", destroyed, threshold));
        }

        private void UpdateCrowns()
        {
            List<HexCell> allCells = Grid.GetAllCells();
            int highestValue = 0;
            for (int i = 0; i < allCells.Count; i++)
            {
                if (allCells[i].TileValue > highestValue)
                    highestValue = allCells[i].TileValue;
            }
            for (int i = 0; i < allCells.Count; i++)
            {
                allCells[i].HasCrown = (highestValue > 0 && allCells[i].TileValue == highestValue);
            }
        }

        /// <summary>
        /// 게임 오버 후 Continue 보상: 빈 셀이 없으면 랜덤 3개 타일을 제거하고 Playing으로 전환.
        /// </summary>
        public void ContinueAfterGameOver()
        {
            if (State != GameState.GameOver) return;

            // 빈 셀이 없으면 랜덤 3개 타일 제거
            if (Grid.GetEmptyCells().Count == 0)
            {
                List<HexCell> nonEmpty = new List<HexCell>();
                foreach (var coord in Grid.AllCoords)
                {
                    var cell = Grid.GetCell(coord);
                    if (cell != null && !cell.IsEmpty)
                        nonEmpty.Add(cell);
                }

                int removeCount = Mathf.Min(3, nonEmpty.Count);
                for (int i = 0; i < removeCount; i++)
                {
                    int idx = UnityEngine.Random.Range(0, nonEmpty.Count);
                    nonEmpty[idx].Clear();
                    nonEmpty.RemoveAt(idx);
                }
            }

            SetState(GameState.Playing);
            Debug.Log("[GameManager] ContinueAfterGameOver: resumed playing.");
        }

        /// <summary>
        /// RemoveTile 보상: 비어있지 않은 셀 중 랜덤 1개를 제거.
        /// </summary>
        public void RemoveRandomTile()
        {
            List<HexCell> nonEmpty = new List<HexCell>();
            foreach (var coord in Grid.AllCoords)
            {
                var cell = Grid.GetCell(coord);
                if (cell != null && !cell.IsEmpty)
                    nonEmpty.Add(cell);
            }

            if (nonEmpty.Count == 0) return;

            int idx = UnityEngine.Random.Range(0, nonEmpty.Count);
            nonEmpty[idx].Clear();
            Debug.Log("[GameManager] RemoveRandomTile: removed 1 tile.");
        }

        /// <summary>
        /// 게임 오버를 강제로 트리거합니다 (테스트용).
        /// </summary>
        public void ForceGameOver()
        {
            if (State == GameState.GameOver) return;
            Score.SaveHighScore();
            SetState(GameState.GameOver);
        }

        private void SetState(GameState newState)
        {
            if (State == newState) return;
            State = newState;
            OnStateChanged?.Invoke(State);
        }

        private void OnDestroy()
        {
            if (Instance == this)
            {
                Instance = null;
            }
        }
    }
}
