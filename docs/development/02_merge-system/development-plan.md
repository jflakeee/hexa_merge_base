# 머지 시스템 상세 개발 계획서

| 항목 | 내용 |
|------|------|
| **모듈명** | 블록 시스템 + 머지(합치기) 시스템 |
| **설계문서 참조** | `docs/design/01_core-system-design.md` 섹션 2, 3 |
| **문서 버전** | v1.0 |
| **최종 수정일** | 2026-02-13 |
| **예상 총 구현 기간** | 약 15~20일 |

---

## 목차

1. [구현 순서 총괄](#1-구현-순서-총괄)
2. [Phase 1: 블록 데이터 모델](#2-phase-1-블록-데이터-모델)
3. [Phase 2: 블록 생성 시스템](#3-phase-2-블록-생성-시스템)
4. [Phase 3: 블록 배치 로직](#4-phase-3-블록-배치-로직)
5. [Phase 4: 웨이브 시스템](#5-phase-4-웨이브-시스템)
6. [Phase 5: 탭 입력 및 선택 상태 관리](#6-phase-5-탭-입력-및-선택-상태-관리)
7. [Phase 6: 매칭 탐색 시스템](#7-phase-6-매칭-탐색-시스템)
8. [Phase 7: 머지 실행 프로세서](#8-phase-7-머지-실행-프로세서)
9. [Phase 8: 연쇄 머지(체인) 처리](#9-phase-8-연쇄-머지체인-처리)
10. [Phase 9: 하이라이트 및 힌트 시스템](#10-phase-9-하이라이트-및-힌트-시스템)
11. [Phase 10: 통합 및 게임 루프 연동](#11-phase-10-통합-및-게임-루프-연동)
12. [에지 케이스 및 주의사항](#12-에지-케이스-및-주의사항)
13. [성능 최적화 고려사항](#13-성능-최적화-고려사항)
14. [테스트 계획](#14-테스트-계획)

---

## 1. 구현 순서 총괄

아래는 전체 구현 항목의 의존성 그래프와 권장 구현 순서이다.

```
Phase 1: HexBlock (블록 데이터)
   |
   +---> Phase 2: BlockSpawner (블록 생성 규칙)
   |        |
   |        +---> Phase 3: BlockPlacer (블록 배치)
   |        |        |
   |        |        +---> Phase 4: WaveSystem (웨이브 생성)
   |        |                  |
   +--------+------------------+
   |
Phase 5: MergeInputHandler (탭 입력 처리)
   |
   +---> Phase 6: MatchFinder (매칭 탐색)
   |        |
   |        +---> Phase 7: MergeProcessor (머지 실행)
   |                  |
   |                  +---> Phase 8: ChainProcessor (연쇄 머지)
   |
   +---> Phase 9: 하이라이트/힌트 시스템
   |
Phase 10: 통합 및 게임 루프 연동 (Phase 4 + Phase 7 + Phase 8 결합)
```

> **선행 의존성**: Phase 1~10 모두 `01_hex-grid` 모듈(HexGrid, HexCell, CubeCoord, HexDirection)의 완성을 전제로 한다.

---

## 2. Phase 1: 블록 데이터 모델

### 2.1 개요

블록은 헥사곤 셀 위에 놓이는 숫자 타일이다. 각 블록은 **레벨(Level)** 을 가지며, 실제 값은 `2^Level`로 계산된다. 레벨 1 = 값 2, 레벨 2 = 값 4 등이다.

### 2.2 구현 체크리스트

- [ ] **2.2.1 `HexBlock` 클래스 구현**
  - **구현 설명**: 블록의 핵심 데이터 모델. 레벨, 값, 고유 ID, 소속 셀 참조, 표시 텍스트를 관리한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Block/HexBlock.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `Level` | `int` (property, private set) | 블록 레벨 (1부터 시작) |
    | `Value` | `int` (computed property) | 실제 값 = `1 << Level` |
    | `Cell` | `HexCell` (property) | 현재 위치한 셀 참조 |
    | `UniqueId` | `string` (property, private set) | GUID 기반 고유 식별자 |
    | `View` | `HexBlockView` (property) | 시각 요소 참조 (MVC) |
    | `HexBlock(int level)` | 생성자 | 레벨 검증 후 초기화 |
    | `LevelUp()` | `void` | 레벨 1 증가 (머지 시 호출) |
    | `GetDisplayText()` | `string` | 값의 표시 문자열 반환 |
  - **의사코드**:
    ```csharp
    public class HexBlock
    {
        public int Level { get; private set; }
        public int Value => 1 << Level;  // 2의 거듭제곱
        public HexCell Cell { get; set; }
        public string UniqueId { get; private set; }
        public HexBlockView View { get; set; }

        public HexBlock(int level)
        {
            Debug.Assert(level >= 1, "블록 레벨은 1 이상이어야 합니다.");
            Level = level;
            UniqueId = System.Guid.NewGuid().ToString();
        }

        public void LevelUp()
        {
            Level++;
        }

        public string GetDisplayText()
        {
            int val = Value;
            if (val >= 1048576) return (val / 1048576) + "M";
            if (val >= 1024) return (val / 1024) + "K";
            return val.ToString();
        }
    }
    ```
  - **예상 난이도**: 하
  - **의존성**: 없음 (HexCell 참조만 존재하며 순환 의존은 약한 참조로 처리)
  - **예상 구현 순서**: 1번째

- [ ] **2.2.2 블록 레벨-값 대응표 검증 단위 테스트**
  - **구현 설명**: 레벨 1~20까지 `Value` 프로퍼티가 올바른 2의 거듭제곱 값을 반환하는지 검증한다.
  - **파일 위치**: `Assets/_Project/Tests/EditMode/Block/HexBlockTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_Level1_Returns_Value2()` | 레벨 1 = 값 2 |
    | `Test_Level10_Returns_Value1024()` | 레벨 10 = 값 1024 |
    | `Test_LevelUp_DoublesValue()` | LevelUp 호출 후 값이 2배 |
    | `Test_GetDisplayText_KFormat()` | 1024 이상일 때 "1K" 형식 |
    | `Test_GetDisplayText_MFormat()` | 1048576 이상일 때 "1M" 형식 |
    | `Test_InvalidLevel_ThrowsAssert()` | 레벨 0 이하 시 Assert 실패 |
  - **의사코드**:
    ```csharp
    [Test]
    public void Test_LevelUp_DoublesValue()
    {
        var block = new HexBlock(3); // 값 = 8
        Assert.AreEqual(8, block.Value);

        block.LevelUp(); // 레벨 4, 값 = 16
        Assert.AreEqual(16, block.Value);
        Assert.AreEqual(4, block.Level);
    }

    [Test]
    public void Test_GetDisplayText_KFormat()
    {
        var block = new HexBlock(10); // 값 = 1024
        Assert.AreEqual("1K", block.GetDisplayText());
    }
    ```
  - **예상 난이도**: 하
  - **의존성**: HexBlock
  - **예상 구현 순서**: 2번째

---

## 3. Phase 2: 블록 생성 시스템

### 3.1 개요

새 블록이 생성될 때 어떤 레벨의 블록이 나올지 결정하는 시스템이다. 현재 보드의 최고 블록 레벨에 따라 생성 가능한 범위가 동적으로 조정되며, 낮은 레벨일수록 높은 확률로 생성된다.

### 3.2 구현 체크리스트

- [ ] **3.2.1 `BlockSpawner` 클래스 구현**
  - **구현 설명**: 보드 최고 레벨에 따른 생성 레벨 범위 결정 + 가중치 기반 랜덤 레벨 선택 로직을 구현한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Block/BlockSpawner.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `MIN_SPAWN_LEVEL` | `const int = 1` | 최소 생성 레벨 (값 2) |
    | `MAX_SPAWN_LEVEL_CAP` | `const int = 7` | 직접 생성 가능 최대 레벨 (값 128) |
    | `DECAY_RATE` | `const float = 0.45f` | 레벨별 가중치 감소율 |
    | `GetMaxSpawnLevel(int boardMaxLevel)` | `int` | 현재 보드 상태 기반 최대 생성 레벨 계산 |
    | `SelectSpawnLevel(int boardMaxLevel)` | `int` | 가중치 랜덤으로 생성 레벨 선택 |
    | `GetSpawnWeights(int maxLevel)` | `float[]` | 레벨별 가중치 배열 생성 (테스트용 public) |
  - **의사코드**:
    ```csharp
    public class BlockSpawner
    {
        private const int MIN_SPAWN_LEVEL = 1;
        private const int MAX_SPAWN_LEVEL_CAP = 7;
        private const float DECAY_RATE = 0.45f;

        /// 보드 최고 레벨의 약 60%까지 생성 가능 (최소 3, 최대 7)
        public int GetMaxSpawnLevel(int boardMaxLevel)
        {
            int maxSpawn = Mathf.Max(3, Mathf.FloorToInt(boardMaxLevel * 0.6f));
            return Mathf.Clamp(maxSpawn, MIN_SPAWN_LEVEL, MAX_SPAWN_LEVEL_CAP);
        }

        /// 가중치 기반 랜덤 레벨 선택
        public int SelectSpawnLevel(int boardMaxLevel)
        {
            int maxLevel = GetMaxSpawnLevel(boardMaxLevel);
            float[] weights = GetSpawnWeights(maxLevel);
            float totalWeight = 0f;
            foreach (var w in weights) totalWeight += w;

            float random = UnityEngine.Random.Range(0f, totalWeight);
            float cumulative = 0f;

            for (int i = 0; i < weights.Length; i++)
            {
                cumulative += weights[i];
                if (random <= cumulative)
                    return i + 1; // 레벨은 1부터 시작
            }
            return 1; // 폴백
        }

        public float[] GetSpawnWeights(int maxLevel)
        {
            float[] weights = new float[maxLevel];
            for (int i = 0; i < maxLevel; i++)
                weights[i] = Mathf.Pow(DECAY_RATE, i);
            return weights;
        }
    }
    ```
  - **예상 난이도**: 중
  - **의존성**: 없음 (순수 로직, HexGrid에 간접 의존)
  - **예상 구현 순서**: 3번째

- [ ] **3.2.2 생성 확률 분포 검증 테스트**
  - **구현 설명**: 10,000회 이상 `SelectSpawnLevel`을 호출하여 각 레벨의 생성 확률이 설계값(42%/27%/17%/10%/4%)에 근사하는지 통계적으로 검증한다.
  - **파일 위치**: `Assets/_Project/Tests/EditMode/Block/BlockSpawnerTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_GetMaxSpawnLevel_WithLowBoard()` | boardMaxLevel=3일 때 maxSpawn=3 |
    | `Test_GetMaxSpawnLevel_WithHighBoard()` | boardMaxLevel=9일 때 maxSpawn=5 |
    | `Test_GetMaxSpawnLevel_Clamped()` | boardMaxLevel=20일 때 maxSpawn=7 (캡) |
    | `Test_SelectSpawnLevel_Distribution()` | 10000회 호출, 각 레벨 비율 오차 5% 이내 |
    | `Test_SelectSpawnLevel_NeverExceedsMax()` | 생성 레벨이 maxSpawnLevel을 초과하지 않음 |
    | `Test_SelectSpawnLevel_AlwaysAtLeastOne()` | 반환값이 항상 1 이상 |
  - **의사코드**:
    ```csharp
    [Test]
    public void Test_SelectSpawnLevel_Distribution()
    {
        var spawner = new BlockSpawner();
        int[] counts = new int[6]; // 레벨 1~5 + 기타
        int trials = 10000;

        for (int i = 0; i < trials; i++)
        {
            int level = spawner.SelectSpawnLevel(9); // boardMax=9 -> maxSpawn=5
            counts[level]++;
        }

        // 레벨 1은 약 42% (오차 5%)
        float ratio1 = (float)counts[1] / trials;
        Assert.IsTrue(ratio1 > 0.37f && ratio1 < 0.47f,
            $"레벨1 비율: {ratio1:P1}, 기대: 42%");
    }
    ```
  - **예상 난이도**: 중
  - **의존성**: BlockSpawner
  - **예상 구현 순서**: 4번째

---

## 4. Phase 3: 블록 배치 로직

### 4.1 개요

생성된 블록을 보드 위의 빈 셀에 배치하는 로직이다. 단일 블록 배치는 랜덤 빈 셀을 선택하며, 보드 최고 레벨을 참조하여 생성 레벨을 결정한다.

### 4.2 구현 체크리스트

- [ ] **4.2.1 `BlockPlacer` 클래스 구현**
  - **구현 설명**: HexGrid에서 빈 셀 목록을 가져와 랜덤 선택 후, BlockSpawner로 레벨을 결정하고 HexBlock을 생성하여 배치한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Block/BlockPlacer.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `grid` | `HexGrid` (private) | 그리드 참조 |
    | `spawner` | `BlockSpawner` (private) | 생성기 참조 |
    | `BlockPlacer(HexGrid, BlockSpawner)` | 생성자 | 의존성 주입 |
    | `PlaceSingleBlock()` | `HexBlock` | 랜덤 빈 셀에 블록 1개 배치, 빈 셀 없으면 null 반환 |
    | `PlaceBlockAt(CubeCoord, int level)` | `HexBlock` | 특정 좌표에 지정 레벨 블록 배치 |
    | `GetBoardMaxLevel()` | `int` | 현재 보드 최고 블록 레벨 반환 |
    | `PlaceMultipleBlocks(int count)` | `List<HexBlock>` | 지정 개수만큼 블록 일괄 배치 |
  - **의사코드**:
    ```csharp
    public class BlockPlacer
    {
        private HexGrid grid;
        private BlockSpawner spawner;

        public BlockPlacer(HexGrid grid, BlockSpawner spawner)
        {
            this.grid = grid;
            this.spawner = spawner;
        }

        public HexBlock PlaceSingleBlock()
        {
            List<HexCell> emptyCells = grid.GetEmptyCells();
            if (emptyCells.Count == 0) return null;

            HexCell targetCell = emptyCells[Random.Range(0, emptyCells.Count)];
            int boardMaxLevel = GetBoardMaxLevel();
            int spawnLevel = spawner.SelectSpawnLevel(boardMaxLevel);

            HexBlock newBlock = new HexBlock(spawnLevel);
            targetCell.PlaceBlock(newBlock);
            return newBlock;
        }

        public HexBlock PlaceBlockAt(CubeCoord coord, int level)
        {
            HexCell cell = grid.GetCell(coord);
            if (cell == null || !cell.IsEmpty) return null;

            HexBlock block = new HexBlock(level);
            cell.PlaceBlock(block);
            return block;
        }

        public int GetBoardMaxLevel()
        {
            int maxLevel = 1;
            foreach (var cell in grid.GetOccupiedCells())
            {
                if (cell.Block.Level > maxLevel)
                    maxLevel = cell.Block.Level;
            }
            return maxLevel;
        }

        public List<HexBlock> PlaceMultipleBlocks(int count)
        {
            List<HexBlock> placed = new List<HexBlock>();
            for (int i = 0; i < count; i++)
            {
                HexBlock block = PlaceSingleBlock();
                if (block == null) break; // 빈 셀 소진
                placed.Add(block);
            }
            return placed;
        }
    }
    ```
  - **예상 난이도**: 하
  - **의존성**: HexGrid, HexCell, HexBlock, BlockSpawner
  - **예상 구현 순서**: 5번째

- [ ] **4.2.2 `BlockPlacer` 단위 테스트**
  - **구현 설명**: 빈 셀이 있을 때/없을 때의 배치 동작, 보드 최고 레벨 계산 정확성을 검증한다.
  - **파일 위치**: `Assets/_Project/Tests/EditMode/Block/BlockPlacerTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_PlaceSingleBlock_OnEmptyBoard()` | 빈 보드에 블록 배치 성공 |
    | `Test_PlaceSingleBlock_OnFullBoard()` | 가득 찬 보드에서 null 반환 |
    | `Test_PlaceBlockAt_ValidCoord()` | 유효 좌표에 배치 성공 |
    | `Test_PlaceBlockAt_OccupiedCell()` | 이미 차있는 셀에 배치 시 null 반환 |
    | `Test_GetBoardMaxLevel_EmptyBoard()` | 빈 보드일 때 1 반환 |
    | `Test_GetBoardMaxLevel_WithBlocks()` | 블록이 있을 때 최고 레벨 정확 반환 |
    | `Test_PlaceMultipleBlocks_Count()` | 요청 개수만큼 배치되는지 확인 |
  - **예상 난이도**: 하
  - **의존성**: BlockPlacer, HexGrid (테스트용 그리드 생성 필요)
  - **예상 구현 순서**: 6번째

---

## 5. Phase 4: 웨이브 시스템

### 5.1 개요

매칭이 완료될 때마다 새로운 블록들이 보드 바깥 테두리에서 안쪽으로 밀려 들어오는 "파도(웨이브)" 시스템이다. 게임의 핵심 긴장감 메커니즘으로, 누적 머지 횟수에 따라 한 번에 생성되는 블록 수가 점진적으로 증가한다.

### 5.2 구현 체크리스트

- [ ] **5.2.1 `WaveConfig` 설정 데이터 클래스 구현**
  - **구현 설명**: 웨이브의 기본 블록 수, 최대 블록 수, 난이도 스케일링 계수 등의 설정값을 ScriptableObject로 관리한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Block/WaveConfig.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `baseBlockCount` | `int = 3` | 기본 웨이브 블록 수 |
    | `maxBlockCount` | `int = 7` | 최대 웨이브 블록 수 |
    | `difficultyScale` | `float = 0.1f` | 머지 횟수당 난이도 증가 계수 |
  - **의사코드**:
    ```csharp
    [CreateAssetMenu(fileName = "WaveConfig", menuName = "HexaMerge/WaveConfig")]
    public class WaveConfig : ScriptableObject
    {
        [Header("웨이브 블록 수")]
        public int baseBlockCount = 3;
        public int maxBlockCount = 7;

        [Header("난이도 스케일링")]
        [Range(0.01f, 0.5f)]
        public float difficultyScale = 0.1f;
    }
    ```
  - **예상 난이도**: 하
  - **의존성**: 없음
  - **예상 구현 순서**: 7번째

- [ ] **5.2.2 `WaveResult` 결과 데이터 클래스 구현**
  - **구현 설명**: 웨이브 생성 결과를 담는 데이터 클래스. 생성된 블록 수, 보드 가득 참 여부, 새 블록 목록을 포함한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Block/WaveResult.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `BlockCount` | `int` | 이번 웨이브에서 생성된 블록 수 |
    | `IsBoardFull` | `bool` | 웨이브 후 보드가 가득 찼는지 |
    | `NewBlocks` | `List<HexBlock>` | 새로 생성된 블록 목록 |
  - **의사코드**:
    ```csharp
    public class WaveResult
    {
        public int BlockCount { get; private set; }
        public bool IsBoardFull { get; private set; }
        public List<HexBlock> NewBlocks { get; private set; }

        public WaveResult(int count, bool isFull, List<HexBlock> blocks = null)
        {
            BlockCount = count;
            IsBoardFull = isFull;
            NewBlocks = blocks ?? new List<HexBlock>();
        }
    }
    ```
  - **예상 난이도**: 하
  - **의존성**: HexBlock
  - **예상 구현 순서**: 8번째

- [ ] **5.2.3 `WaveSystem` 핵심 로직 구현**
  - **구현 설명**: 머지 후 호출되어 테두리 빈 셀 우선으로 블록을 생성/배치하는 핵심 시스템. 웨이브 블록 수 계산, 후보 셀 선정(테두리 우선 -> 안쪽 폴백), 블록 생성 및 배치를 수행한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Block/WaveSystem.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `grid` | `HexGrid` (private) | 그리드 참조 |
    | `spawner` | `BlockSpawner` (private) | 블록 생성기 |
    | `config` | `WaveConfig` (private) | 웨이브 설정 |
    | `totalMergeCount` | `int` (private) | 누적 머지 횟수 |
    | `WaveSystem(HexGrid, BlockSpawner, WaveConfig)` | 생성자 | 의존성 주입 |
    | `GenerateWave()` | `WaveResult` | 웨이브 실행 메인 메서드 |
    | `CalculateWaveBlockCount()` | `int` (private) | 현재 난이도 기반 블록 수 계산 |
    | `GetWaveCandidateCells()` | `List<HexCell>` (private) | 테두리 우선 후보 셀 목록 |
    | `IncrementMergeCount()` | `void` | 머지 카운트 증가 |
    | `GetTotalMergeCount()` | `int` | 현재 누적 머지 수 반환 |
    | `SetTotalMergeCount(int)` | `void` | 로드 시 머지 수 복원 |
  - **의사코드**:
    ```csharp
    public class WaveSystem
    {
        private HexGrid grid;
        private BlockSpawner spawner;
        private WaveConfig config;
        private int totalMergeCount = 0;

        public WaveSystem(HexGrid grid, BlockSpawner spawner, WaveConfig config)
        {
            this.grid = grid;
            this.spawner = spawner;
            this.config = config;
        }

        public WaveResult GenerateWave()
        {
            int blockCount = CalculateWaveBlockCount();
            List<HexCell> candidates = GetWaveCandidateCells();

            if (candidates.Count == 0)
                return new WaveResult(0, true); // 빈 셀 없음

            blockCount = Mathf.Min(blockCount, candidates.Count);

            // 후보 셀 셔플 후 상위 blockCount개 선택
            ShuffleList(candidates);
            List<HexBlock> newBlocks = new List<HexBlock>();

            int boardMaxLevel = GetBoardMaxLevel();
            for (int i = 0; i < blockCount; i++)
            {
                int level = spawner.SelectSpawnLevel(boardMaxLevel);
                HexBlock block = new HexBlock(level);
                candidates[i].PlaceBlock(block);
                newBlocks.Add(block);
            }

            totalMergeCount++;

            bool boardFull = (grid.GetEmptyCells().Count == 0);
            return new WaveResult(blockCount, boardFull, newBlocks);
        }

        private int CalculateWaveBlockCount()
        {
            int count = config.baseBlockCount
                + Mathf.FloorToInt(totalMergeCount * config.difficultyScale);
            return Mathf.Clamp(count, config.baseBlockCount, config.maxBlockCount);
        }

        /// 테두리(radius 거리) 빈 셀을 우선 반환, 부족하면 안쪽도 포함
        private List<HexCell> GetWaveCandidateCells()
        {
            List<HexCell> borderEmpty = new List<HexCell>();
            List<HexCell> innerEmpty = new List<HexCell>();

            foreach (var cell in grid.GetAllCells())
            {
                if (cell.State != CellState.Empty) continue;

                int distance = CubeCoord.Distance(cell.Coord, new CubeCoord(0, 0, 0));
                if (distance == grid.Radius)
                    borderEmpty.Add(cell);
                else
                    innerEmpty.Add(cell);
            }

            List<HexCell> result = new List<HexCell>(borderEmpty);
            result.AddRange(innerEmpty);
            return result;
        }

        private void ShuffleList<T>(List<T> list) { /* Fisher-Yates 셔플 */ }
        private int GetBoardMaxLevel() { /* 보드 최고 레벨 */ }
    }
    ```
  - **예상 난이도**: 중
  - **의존성**: HexGrid, HexCell, HexBlock, BlockSpawner, WaveConfig, CubeCoord
  - **예상 구현 순서**: 9번째

- [ ] **5.2.4 웨이브 방향 결정 로직 구현**
  - **구현 설명**: 웨이브가 밀려오는 방향을 결정한다. 기본은 "분산 배치(모든 방향 균등)"이며, 선택적으로 랜덤 방향/순환 방향을 지원한다. View 레이어에서 슬라이드 인 애니메이션의 시작 방향을 결정하는 데 사용된다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Block/WaveSystem.cs` (기존 파일에 추가)
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `WaveDirection` | `enum` | Random, Sequential, Distributed |
    | `currentDirectionIndex` | `int` (private) | 순환 방향용 현재 인덱스 |
    | `DetermineWaveDirection()` | `int` | 웨이브 방향 인덱스(0~5) 반환 |
    | `GetBlockEntryPosition(HexCell, int direction)` | `Vector2` | 블록의 애니메이션 시작 월드 좌표 |
  - **예상 난이도**: 중
  - **의존성**: WaveSystem, HexDirection, CoordConverter
  - **예상 구현 순서**: 10번째

- [ ] **5.2.5 `WaveSystem` 단위 테스트**
  - **구현 설명**: 웨이브 블록 수 계산, 후보 셀 선정(테두리 우선), 보드 가득 참 감지를 검증한다.
  - **파일 위치**: `Assets/_Project/Tests/EditMode/Block/WaveSystemTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_CalculateWaveBlockCount_InitialValue()` | 초기 머지 0회 -> baseBlockCount |
    | `Test_CalculateWaveBlockCount_Scaling()` | 머지 10회 -> base + 1 |
    | `Test_CalculateWaveBlockCount_MaxCap()` | 많은 머지 -> maxBlockCount 초과 안함 |
    | `Test_GetWaveCandidateCells_BorderPriority()` | 테두리 셀이 목록 앞에 위치 |
    | `Test_GenerateWave_BoardFullDetection()` | 가득 찬 보드 정확 감지 |
    | `Test_GenerateWave_NoCandidates()` | 빈 셀 0일 때 blockCount=0 반환 |
    | `Test_GenerateWave_BlockCountLimit()` | 후보 셀 < 요청 수일 때 후보 수만큼 생성 |
  - **예상 난이도**: 중
  - **의존성**: WaveSystem, HexGrid (테스트용 설정)
  - **예상 구현 순서**: 11번째

---

## 6. Phase 5: 탭 입력 및 선택 상태 관리

### 6.1 개요

플레이어의 탭 입력을 처리하는 상태 머신이다. Idle(대기) -> FirstSelected(첫 블록 선택) -> Processing(머지 처리 중) 세 가지 상태를 순환하며, 첫 번째 탭으로 블록을 선택하고 두 번째 탭으로 머지를 시도한다.

### 6.2 구현 체크리스트

- [ ] **6.2.1 `SelectionState` 열거형 정의**
  - **구현 설명**: 탭 입력의 세 가지 상태를 정의한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Merge/SelectionState.cs`
  - **클래스/메서드 목록**:
    | 값 | 설명 |
    |----|------|
    | `Idle` | 아무것도 선택되지 않은 대기 상태 |
    | `FirstSelected` | 첫 번째 블록이 선택된 상태 |
    | `Processing` | 머지 또는 웨이브 처리 중 (입력 불가) |
  - **의사코드**:
    ```csharp
    public enum SelectionState
    {
        Idle,
        FirstSelected,
        Processing
    }
    ```
  - **예상 난이도**: 하
  - **의존성**: 없음
  - **예상 구현 순서**: 12번째

- [ ] **6.2.2 `MergeInputHandler` 클래스 구현**
  - **구현 설명**: 셀 탭 이벤트를 받아 상태에 따라 분기 처리하는 핵심 입력 핸들러. 첫 번째 탭(블록 선택), 두 번째 탭(머지 시도/선택 변경/선택 해제), Processing 중 입력 무시 로직을 포함한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Merge/MergeInputHandler.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `state` | `SelectionState` (private) | 현재 선택 상태 |
    | `firstSelectedCell` | `HexCell` (private) | 첫 번째 선택된 셀 |
    | `OnBlockSelected` | `Action<HexCell>` | 블록 선택 이벤트 |
    | `OnSelectionCleared` | `Action` | 선택 해제 이벤트 |
    | `OnMergeRequested` | `Action<HexCell, HexCell>` | 머지 요청 이벤트 (source, target) |
    | `OnCellTapped(HexCell)` | `void` | 셀 탭 시 호출되는 메인 핸들러 |
    | `HandleIdleTap(HexCell)` | `void` (private) | Idle 상태에서 탭 처리 |
    | `HandleSecondTap(HexCell)` | `void` (private) | FirstSelected 상태에서 탭 처리 |
    | `ClearSelection()` | `void` (private) | 선택 해제 |
    | `SetState(SelectionState)` | `void` | 외부에서 상태 강제 설정 (머지 완료 후) |
    | `GetState()` | `SelectionState` | 현재 상태 조회 |
    | `GetFirstSelectedCell()` | `HexCell` | 현재 선택된 셀 조회 |
  - **의사코드**:
    ```csharp
    public class MergeInputHandler
    {
        private SelectionState state = SelectionState.Idle;
        private HexCell firstSelectedCell = null;

        public Action<HexCell> OnBlockSelected;
        public Action OnSelectionCleared;
        public Action<HexCell, HexCell> OnMergeRequested;

        public void OnCellTapped(HexCell tappedCell)
        {
            if (state == SelectionState.Processing) return;

            switch (state)
            {
                case SelectionState.Idle:
                    HandleIdleTap(tappedCell);
                    break;
                case SelectionState.FirstSelected:
                    HandleSecondTap(tappedCell);
                    break;
            }
        }

        private void HandleIdleTap(HexCell cell)
        {
            if (!cell.IsInteractable) return;

            firstSelectedCell = cell;
            state = SelectionState.FirstSelected;
            OnBlockSelected?.Invoke(cell);
        }

        private void HandleSecondTap(HexCell cell)
        {
            // 같은 셀 재탭 -> 선택 해제
            if (cell == firstSelectedCell)
            {
                ClearSelection();
                return;
            }

            // 빈 셀 탭 -> 선택 해제
            if (!cell.IsInteractable)
            {
                ClearSelection();
                return;
            }

            // 다른 값 블록 -> 선택 변경
            if (cell.Block.Value != firstSelectedCell.Block.Value)
            {
                ClearSelection();
                HandleIdleTap(cell);
                return;
            }

            // 같은 값 블록 -> 머지 요청!
            state = SelectionState.Processing;
            OnMergeRequested?.Invoke(firstSelectedCell, cell);
        }

        private void ClearSelection()
        {
            firstSelectedCell = null;
            state = SelectionState.Idle;
            OnSelectionCleared?.Invoke();
        }

        public void SetState(SelectionState newState)
        {
            state = newState;
            if (newState == SelectionState.Idle)
                firstSelectedCell = null;
        }
    }
    ```
  - **예상 난이도**: 중
  - **의존성**: SelectionState, HexCell, HexBlock
  - **예상 구현 순서**: 13번째

- [ ] **6.2.3 `MergeInputHandler` 단위 테스트**
  - **구현 설명**: 모든 탭 시나리오(첫 탭, 같은 값 두 번째 탭, 다른 값 탭, 빈 셀 탭, 같은 셀 재탭, Processing 중 탭)를 검증한다.
  - **파일 위치**: `Assets/_Project/Tests/EditMode/Merge/MergeInputHandlerTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_IdleTap_EmptyCell_StaysIdle()` | 빈 셀 탭 시 Idle 유지 |
    | `Test_IdleTap_OccupiedCell_SelectsFirst()` | 블록 셀 탭 시 FirstSelected |
    | `Test_SecondTap_SameCell_ClearsSelection()` | 같은 셀 재탭 시 Idle |
    | `Test_SecondTap_EmptyCell_ClearsSelection()` | 빈 셀 탭 시 Idle |
    | `Test_SecondTap_DifferentValue_ChangesSelection()` | 다른 값 탭 시 선택 변경 |
    | `Test_SecondTap_SameValue_RequestsMerge()` | 같은 값 탭 시 머지 요청 |
    | `Test_Processing_IgnoresInput()` | Processing 상태에서 모든 입력 무시 |
    | `Test_SetState_Idle_ClearsSelectedCell()` | Idle 설정 시 선택 초기화 |
  - **예상 난이도**: 중
  - **의존성**: MergeInputHandler, HexCell, HexBlock (목 객체 필요)
  - **예상 구현 순서**: 14번째

---

## 7. Phase 6: 매칭 탐색 시스템

### 7.1 개요

보드 전체에서 같은 값의 블록을 탐색하는 시스템이다. 인접 여부와 관계없이 보드 어디에 있든 같은 값이면 매칭 대상이 된다. 또한 유효한 매칭 쌍이 존재하는지 판별하여 리셔플 필요 여부를 결정한다.

### 7.2 구현 체크리스트

- [ ] **7.2.1 `MatchFinder` 클래스 구현**
  - **구현 설명**: 보드 전체 탐색으로 같은 값의 블록 목록을 반환하고, 유효 매칭 존재 여부를 판별하며, 블록을 값별로 그룹화한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Merge/MatchFinder.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `grid` | `HexGrid` (private) | 그리드 참조 |
    | `MatchFinder(HexGrid)` | 생성자 | 의존성 주입 |
    | `FindAllMatchingCells(int value, CubeCoord excludeCoord)` | `List<HexCell>` | 특정 값과 같은 블록 셀 목록 (자신 제외) |
    | `HasAnyValidMatch()` | `bool` | 보드에 매칭 쌍이 존재하는지 확인 |
    | `GroupBlocksByValue()` | `Dictionary<int, List<HexCell>>` | 값별 블록 그룹화 |
    | `GetMatchCount(int value)` | `int` | 특정 값의 블록 수 반환 |
  - **의사코드**:
    ```csharp
    public class MatchFinder
    {
        private HexGrid grid;

        public MatchFinder(HexGrid grid)
        {
            this.grid = grid;
        }

        public List<HexCell> FindAllMatchingCells(int value, CubeCoord excludeCoord)
        {
            List<HexCell> matches = new List<HexCell>();
            foreach (var cell in grid.GetOccupiedCells())
            {
                if (cell.Coord.Equals(excludeCoord)) continue;
                if (cell.Block.Value == value)
                    matches.Add(cell);
            }
            return matches;
        }

        /// 같은 값이 2개 이상 있으면 매칭 가능
        public bool HasAnyValidMatch()
        {
            Dictionary<int, int> valueCounts = new Dictionary<int, int>();
            foreach (var cell in grid.GetOccupiedCells())
            {
                int value = cell.Block.Value;
                if (valueCounts.ContainsKey(value))
                    return true;
                valueCounts[value] = 1;
            }
            return false;
        }

        public Dictionary<int, List<HexCell>> GroupBlocksByValue()
        {
            var groups = new Dictionary<int, List<HexCell>>();
            foreach (var cell in grid.GetOccupiedCells())
            {
                int value = cell.Block.Value;
                if (!groups.ContainsKey(value))
                    groups[value] = new List<HexCell>();
                groups[value].Add(cell);
            }
            return groups;
        }
    }
    ```
  - **예상 난이도**: 중
  - **의존성**: HexGrid, HexCell, HexBlock
  - **예상 구현 순서**: 15번째

- [ ] **7.2.2 `MatchFinder` 단위 테스트**
  - **구현 설명**: 다양한 보드 상태에서 매칭 탐색 정확성을 검증한다.
  - **파일 위치**: `Assets/_Project/Tests/EditMode/Merge/MatchFinderTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_FindAllMatching_MultipleMatches()` | 같은 값 3개 중 자신 제외 2개 반환 |
    | `Test_FindAllMatching_NoMatches()` | 같은 값 없을 때 빈 목록 |
    | `Test_FindAllMatching_ExcludesCoord()` | 자기 좌표 제외 확인 |
    | `Test_HasAnyValidMatch_TwoSameValue()` | 같은 값 2개 -> true |
    | `Test_HasAnyValidMatch_AllUnique()` | 모두 고유값 -> false |
    | `Test_HasAnyValidMatch_EmptyBoard()` | 빈 보드 -> false |
    | `Test_GroupBlocksByValue_Correct()` | 그룹화 정확성 |
  - **예상 난이도**: 하
  - **의존성**: MatchFinder, HexGrid
  - **예상 구현 순서**: 16번째

---

## 8. Phase 7: 머지 실행 프로세서

### 8.1 개요

두 블록이 매칭된 후 실제 머지를 수행하는 핵심 프로세서이다. 소스 블록이 타겟 블록 위치로 이동하여 합쳐지며, 타겟 블록의 레벨이 1 증가한다. 비동기(UniTask) 기반으로 애니메이션과 함께 처리된다.

### 8.2 머지 실행 흐름

```
1. 두 셀 잠금(Lock) - 추가 입력 방지
2. 소스 블록 이동 애니메이션 (소스 -> 타겟)
3. 소스 셀에서 블록 제거 및 파괴
4. 타겟 블록 레벨 증가 (Value x 2)
5. 머지 이펙트 재생 (파티클, 스케일 펀치)
6. 점수 계산 및 추가
7. 연쇄 머지 체크 (Phase 8)
8. 두 셀 잠금 해제
9. 웨이브 생성 (Phase 4)
10. 보드 상태 확인 (유효 수 존재 여부)
```

### 8.3 구현 체크리스트

- [ ] **8.3.1 `MergeResult` 결과 데이터 클래스 구현**
  - **구현 설명**: 머지 실행의 모든 결과를 담는 데이터 클래스.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Merge/MergeResult.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `SourceCoord` | `CubeCoord` | 소스 블록 좌표 |
    | `TargetCoord` | `CubeCoord` | 타겟 블록 좌표 |
    | `OriginalValue` | `int` | 머지 전 값 |
    | `MergedValue` | `int` | 머지 후 값 |
    | `EarnedScore` | `int` | 획득 점수 |
    | `ChainCount` | `int` | 연쇄 횟수 |
    | `ChainResults` | `List<ChainResult>` | 연쇄 머지 결과 목록 |
    | `WaveResult` | `WaveResult` | 웨이브 결과 |
    | `HasValidMoves` | `bool` | 머지 후 유효한 수 존재 여부 |
  - **의사코드**:
    ```csharp
    public class MergeResult
    {
        public CubeCoord SourceCoord;
        public CubeCoord TargetCoord;
        public int OriginalValue;
        public int MergedValue;
        public int EarnedScore;
        public int ChainCount;
        public List<ChainResult> ChainResults = new List<ChainResult>();
        public WaveResult WaveResult;
        public bool HasValidMoves;
    }
    ```
  - **예상 난이도**: 하
  - **의존성**: CubeCoord, ChainResult, WaveResult
  - **예상 구현 순서**: 17번째

- [ ] **8.3.2 `MergeProcessor` 클래스 구현**
  - **구현 설명**: 머지의 전체 파이프라인을 관리하는 핵심 클래스. 셀 잠금, 블록 이동, 블록 제거/레벨업, 점수 계산, 연쇄 체크, 웨이브 생성, 보드 상태 확인을 순차적으로 수행한다. 비동기(UniTask) 기반이다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Merge/MergeProcessor.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `grid` | `HexGrid` (private) | 그리드 참조 |
    | `scoreSystem` | `ScoreSystem` (private) | 점수 시스템 참조 |
    | `waveSystem` | `WaveSystem` (private) | 웨이브 시스템 참조 |
    | `matchFinder` | `MatchFinder` (private) | 매칭 탐색기 참조 |
    | `chainProcessor` | `ChainProcessor` (private) | 연쇄 머지 프로세서 참조 |
    | `OnMergeStarted` | `Action<HexCell, HexCell>` | 머지 시작 이벤트 |
    | `OnMergeCompleted` | `Action<MergeResult>` | 머지 완료 이벤트 |
    | `ExecuteMerge(HexCell source, HexCell target)` | `UniTask<MergeResult>` | 머지 실행 메인 메서드 |
    | `AnimateBlockMove(HexCell source, HexCell target)` | `UniTask` (private) | 블록 이동 애니메이션 |
    | `PlayMergeEffect(HexCell cell)` | `UniTask` (private) | 머지 이펙트 재생 |
    | `DestroyBlock(HexBlock block)` | `void` (private) | 블록 파괴 (오브젝트 풀 반환) |
  - **의사코드**:
    ```csharp
    public class MergeProcessor
    {
        private HexGrid grid;
        private ScoreSystem scoreSystem;
        private WaveSystem waveSystem;
        private MatchFinder matchFinder;
        private ChainProcessor chainProcessor;

        public Action<HexCell, HexCell> OnMergeStarted;
        public Action<MergeResult> OnMergeCompleted;

        public MergeProcessor(
            HexGrid grid,
            ScoreSystem scoreSystem,
            WaveSystem waveSystem,
            MatchFinder matchFinder,
            ChainProcessor chainProcessor)
        {
            this.grid = grid;
            this.scoreSystem = scoreSystem;
            this.waveSystem = waveSystem;
            this.matchFinder = matchFinder;
            this.chainProcessor = chainProcessor;
        }

        public async UniTask<MergeResult> ExecuteMerge(HexCell sourceCell, HexCell targetCell)
        {
            MergeResult result = new MergeResult();
            result.SourceCoord = sourceCell.Coord;
            result.TargetCoord = targetCell.Coord;
            result.OriginalValue = sourceCell.Block.Value;

            OnMergeStarted?.Invoke(sourceCell, targetCell);

            // 1. 셀 잠금
            sourceCell.Lock();
            targetCell.Lock();

            // 2. 이동 애니메이션
            await AnimateBlockMove(sourceCell, targetCell);

            // 3. 소스 블록 제거
            HexBlock sourceBlock = sourceCell.RemoveBlock();
            DestroyBlock(sourceBlock);

            // 4. 타겟 블록 레벨업
            targetCell.Block.LevelUp();
            result.MergedValue = targetCell.Block.Value;

            // 5. 머지 이펙트
            await PlayMergeEffect(targetCell);

            // 6. 점수 계산
            int earnedScore = scoreSystem.CalculateMergeScore(result.MergedValue, 0);
            result.EarnedScore = earnedScore;
            scoreSystem.AddScore(earnedScore);

            // 7. 연쇄 머지
            result.ChainResults = await chainProcessor.ProcessChainMerge(targetCell, 1);
            result.ChainCount = result.ChainResults.Count;

            // 연쇄 머지 점수 추가
            foreach (var chain in result.ChainResults)
            {
                int chainScore = scoreSystem.CalculateMergeScore(
                    chain.ResultValue, chain.ChainDepth);
                result.EarnedScore += chainScore;
                scoreSystem.AddScore(chainScore);
            }

            // 8. 셀 잠금 해제
            sourceCell.Unlock();
            targetCell.Unlock();

            // 9. 웨이브 생성
            result.WaveResult = waveSystem.GenerateWave();

            // 10. 보드 상태 확인
            result.HasValidMoves = matchFinder.HasAnyValidMatch();

            OnMergeCompleted?.Invoke(result);
            return result;
        }

        private async UniTask AnimateBlockMove(HexCell source, HexCell target)
        {
            // DOTween을 사용한 블록 이동 애니메이션
            // source.Block.View.transform -> target 위치로 이동
            // 약 0.2~0.3초 소요
        }

        private async UniTask PlayMergeEffect(HexCell cell)
        {
            // 파티클 이펙트 + 스케일 펀치 애니메이션
            // 약 0.15~0.2초 소요
        }

        private void DestroyBlock(HexBlock block)
        {
            // View 오브젝트를 오브젝트 풀로 반환
            // block 데이터 참조 해제
            if (block.View != null)
            {
                block.View.ReturnToPool();
                block.View = null;
            }
            block.Cell = null;
        }
    }
    ```
  - **예상 난이도**: 상
  - **의존성**: HexGrid, HexCell, HexBlock, ScoreSystem, WaveSystem, MatchFinder, ChainProcessor, UniTask, DOTween
  - **예상 구현 순서**: 18번째

- [ ] **8.3.3 `MergeProcessor` 통합 테스트**
  - **구현 설명**: 머지 실행 전체 파이프라인의 정확성을 검증한다. 애니메이션은 즉시 완료로 대체한다.
  - **파일 위치**: `Assets/_Project/Tests/EditMode/Merge/MergeProcessorTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_ExecuteMerge_SourceRemovedTargetLevelUp()` | 소스 제거, 타겟 레벨 증가 |
    | `Test_ExecuteMerge_CorrectMergedValue()` | 머지 결과 값 = 원래 값 x 2 |
    | `Test_ExecuteMerge_ScoreCalculated()` | 점수 정확 계산 |
    | `Test_ExecuteMerge_WaveGenerated()` | 웨이브 생성 호출됨 |
    | `Test_ExecuteMerge_HasValidMovesChecked()` | 유효 수 확인됨 |
    | `Test_ExecuteMerge_CellsUnlockedAfter()` | 머지 후 셀 잠금 해제됨 |
    | `Test_ExecuteMerge_EventsFired()` | OnMergeStarted, OnMergeCompleted 이벤트 발생 |
  - **예상 난이도**: 상
  - **의존성**: MergeProcessor + 모든 의존 클래스
  - **예상 구현 순서**: 19번째

---

## 9. Phase 8: 연쇄 머지(체인) 처리

### 9.1 개요

머지 결과로 생긴 새 값의 블록이 **인접 셀**에 같은 값의 블록과 만나면 자동으로 연쇄 머지가 발생한다. 일반 머지와 달리 연쇄 머지는 **인접한 경우에만** 발동된다. 한 번에 하나의 인접 블록만 흡수하며, 값이 변하므로 재귀적으로 다음 연쇄를 체크한다.

### 9.2 연쇄 머지 규칙 상세

```
[핵심 규칙]
1. 연쇄 머지는 "인접 셀"에서만 발동 (일반 머지는 보드 전체)
2. 한 번에 인접 블록 1개만 흡수 (순차 처리)
3. 흡수 후 값이 변하므로 재귀적으로 다시 인접 체크
4. 최대 연쇄 깊이 제한: 20회 (무한 루프 방지)
5. 연쇄 중 흡수된 블록의 셀은 비워짐

[시각 예시]
  [2] [4] [8]     ->    [2] [_] [8]     ->    [2] [_] [8]
    [4] [2]                [8] [2]                [16] [2]
  [8] [4] [2]           [8] [4] [2]            [8] [_] [2]

  4+4=8 머지           인접 4 없음             인접 8 있음 -> 8+8=16
                       인접 8 있음 -> 흡수      연쇄 종료 (인접 16 없음)
```

### 9.3 구현 체크리스트

- [ ] **9.3.1 `ChainResult` 데이터 클래스 구현**
  - **구현 설명**: 각 연쇄 머지 단계의 결과를 담는 데이터 클래스.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Merge/ChainResult.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `ChainDepth` | `int` | 연쇄 깊이 (1부터 시작) |
    | `AbsorbedCoord` | `CubeCoord` | 흡수된 블록의 좌표 |
    | `ResultCoord` | `CubeCoord` | 결과 블록의 좌표 (항상 머지 타겟 셀) |
    | `ResultValue` | `int` | 연쇄 머지 후 결과 값 |
  - **의사코드**:
    ```csharp
    public class ChainResult
    {
        public int ChainDepth;
        public CubeCoord AbsorbedCoord;
        public CubeCoord ResultCoord;
        public int ResultValue;
    }
    ```
  - **예상 난이도**: 하
  - **의존성**: CubeCoord
  - **예상 구현 순서**: 20번째

- [ ] **9.3.2 `ChainProcessor` 클래스 구현**
  - **구현 설명**: 머지 후 타겟 셀 주변의 인접 셀을 탐색하여 같은 값의 블록을 자동으로 연쇄 머지하는 프로세서. 재귀 기반으로 동작하며 최대 깊이 제한이 있다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/Merge/ChainProcessor.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `MAX_CHAIN_DEPTH` | `const int = 20` | 최대 연쇄 깊이 |
    | `grid` | `HexGrid` (private) | 그리드 참조 |
    | `OnChainMerge` | `Action<ChainResult>` | 개별 연쇄 머지 이벤트 |
    | `ChainProcessor(HexGrid)` | 생성자 | 의존성 주입 |
    | `ProcessChainMerge(HexCell, int depth)` | `UniTask<List<ChainResult>>` | 연쇄 머지 재귀 처리 |
    | `AnimateChainMerge(HexCell absorbed, HexCell target)` | `UniTask` (private) | 연쇄 머지 애니메이션 |
    | `DestroyBlock(HexBlock)` | `void` (private) | 흡수된 블록 파괴 |
  - **의사코드**:
    ```csharp
    public class ChainProcessor
    {
        private const int MAX_CHAIN_DEPTH = 20;
        private HexGrid grid;

        public Action<ChainResult> OnChainMerge;

        public ChainProcessor(HexGrid grid)
        {
            this.grid = grid;
        }

        public async UniTask<List<ChainResult>> ProcessChainMerge(
            HexCell mergedCell,
            int currentChainDepth)
        {
            List<ChainResult> chainResults = new List<ChainResult>();

            if (currentChainDepth >= MAX_CHAIN_DEPTH) return chainResults;

            // 인접 셀에서 같은 값 블록 탐색
            List<HexCell> adjacentMatches = HexDirection.GetMatchingNeighbors(
                mergedCell.Coord,
                mergedCell.Block.Value,
                grid
            );

            if (adjacentMatches.Count == 0) return chainResults;

            // 인접 매칭 블록을 하나씩 순차 처리
            foreach (var adjacentCell in adjacentMatches)
            {
                // 이전 연쇄로 상태가 바뀌었을 수 있으므로 재확인
                if (adjacentCell.State != CellState.Occupied) continue;
                if (adjacentCell.Block.Value != mergedCell.Block.Value) continue;

                ChainResult chain = new ChainResult();
                chain.ChainDepth = currentChainDepth;
                chain.AbsorbedCoord = adjacentCell.Coord;
                chain.ResultCoord = mergedCell.Coord;

                // 인접 블록 흡수
                adjacentCell.Lock();
                await AnimateChainMerge(adjacentCell, mergedCell);

                HexBlock absorbed = adjacentCell.RemoveBlock();
                DestroyBlock(absorbed);
                mergedCell.Block.LevelUp();

                chain.ResultValue = mergedCell.Block.Value;
                adjacentCell.Unlock();

                chainResults.Add(chain);
                OnChainMerge?.Invoke(chain);

                // 재귀: 값이 변했으므로 새 값에 대해 다시 체크
                var deeperChains = await ProcessChainMerge(
                    mergedCell,
                    currentChainDepth + 1
                );
                chainResults.AddRange(deeperChains);

                // 중요: 한 번에 하나만 흡수 후 재귀
                // (값이 변하면 나머지 인접 블록은 더 이상 매칭 안 됨)
                break;
            }

            return chainResults;
        }

        private async UniTask AnimateChainMerge(HexCell absorbed, HexCell target)
        {
            // DOTween 기반 흡수 애니메이션
            // absorbed.Block.View -> target 위치로 이동 + 축소
            // 약 0.15~0.2초
        }

        private void DestroyBlock(HexBlock block)
        {
            if (block.View != null)
            {
                block.View.ReturnToPool();
                block.View = null;
            }
            block.Cell = null;
        }
    }
    ```
  - **예상 난이도**: 상
  - **의존성**: HexGrid, HexCell, HexBlock, HexDirection, UniTask, DOTween
  - **예상 구현 순서**: 21번째

- [ ] **9.3.3 `ChainProcessor` 단위 테스트**
  - **구현 설명**: 다양한 연쇄 머지 시나리오를 검증한다. 특히 재귀 안전성과 에지 케이스를 중점적으로 테스트한다.
  - **파일 위치**: `Assets/_Project/Tests/EditMode/Merge/ChainProcessorTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_NoAdjacentMatch_EmptyResult()` | 인접 매칭 없을 때 빈 결과 |
    | `Test_SingleChain_OneAdjacentMatch()` | 인접 1개 매칭 -> 연쇄 1회 |
    | `Test_DoubleChain_SequentialMatches()` | 4->8->16 연쇄 2회 |
    | `Test_MaxDepth_DoesNotExceed()` | 깊이 20 초과 시 중단 |
    | `Test_ChainBreaks_WhenValueChanges()` | 값 변경 후 비매칭 인접 무시 |
    | `Test_Chain_CorrectResultValues()` | 각 단계별 결과 값 정확 |
    | `Test_Chain_AbsorbedCellBecomesEmpty()` | 흡수된 셀이 Empty가 됨 |
    | `Test_Chain_OnlyAdjacentTriggers()` | 비인접 같은 값은 연쇄 안 함 |
  - **의사코드**:
    ```csharp
    [Test]
    public async void Test_DoubleChain_SequentialMatches()
    {
        // 그리드 설정: 중앙에 4, 인접에 4, 그 인접에 8
        var grid = CreateTestGrid(radius: 2);
        var center = new CubeCoord(0, 0);
        var adj1 = new CubeCoord(1, 0, -1); // 동쪽
        var adj2 = new CubeCoord(2, -1, -1); // adj1의 동쪽

        PlaceBlock(grid, center, level: 2); // 값 4
        PlaceBlock(grid, adj1, level: 2);   // 값 4
        PlaceBlock(grid, adj2, level: 3);   // 값 8

        var processor = new ChainProcessor(grid);
        // 중앙 블록이 4->8 머지 후 연쇄 시작
        grid.GetCell(center).Block.LevelUp(); // 값 8로 변경

        var results = await processor.ProcessChainMerge(
            grid.GetCell(center), 1);

        // 기대: adj2의 8과 연쇄 -> 16 (adj1은 값4이므로 무시)
        // 실제로는 center가 8이 된 후, adj1은 4이므로 매칭 안 됨
        // adj2는 인접이 아닐 수 있음 (거리 2) -> 연쇄 없음
        // 테스트 시나리오를 adj1에 8을 배치하는 것으로 수정
    }
    ```
  - **예상 난이도**: 상
  - **의존성**: ChainProcessor, HexGrid, HexDirection
  - **예상 구현 순서**: 22번째

---

## 10. Phase 9: 하이라이트 및 힌트 시스템

### 10.1 개요

첫 번째 블록이 선택되면 보드 전체에서 같은 값의 블록을 시각적으로 하이라이트하여 플레이어에게 매칭 가능 대상을 보여준다.

### 10.2 구현 체크리스트

- [ ] **10.2.1 하이라이트 표시 로직 구현**
  - **구현 설명**: MergeInputHandler의 OnBlockSelected 이벤트에 연결하여, MatchFinder로 같은 값 블록을 탐색하고 해당 블록들의 View에 하이라이트 효과를 적용한다.
  - **파일 위치**: `Assets/_Project/Scripts/View/HighlightController.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `matchFinder` | `MatchFinder` (private) | 매칭 탐색기 |
    | `highlightedCells` | `List<HexCell>` (private) | 현재 하이라이트된 셀 목록 |
    | `HighlightMatchingBlocks(HexCell selected)` | `void` | 같은 값 블록 하이라이트 |
    | `ClearHighlights()` | `void` | 모든 하이라이트 해제 |
    | `PulseAnimation(HexBlockView view)` | `void` (private) | 펄스 애니메이션 적용 |
  - **의사코드**:
    ```csharp
    public class HighlightController
    {
        private MatchFinder matchFinder;
        private List<HexCell> highlightedCells = new List<HexCell>();

        public void HighlightMatchingBlocks(HexCell selectedCell)
        {
            ClearHighlights();

            var matches = matchFinder.FindAllMatchingCells(
                selectedCell.Block.Value,
                selectedCell.Coord
            );

            foreach (var cell in matches)
            {
                cell.View?.SetHighlight(true);
                highlightedCells.Add(cell);
            }

            // 선택된 셀 자체에도 선택 표시
            selectedCell.View?.SetSelected(true);
        }

        public void ClearHighlights()
        {
            foreach (var cell in highlightedCells)
            {
                cell.View?.SetHighlight(false);
                cell.View?.SetSelected(false);
            }
            highlightedCells.Clear();
        }
    }
    ```
  - **예상 난이도**: 중
  - **의존성**: MatchFinder, HexCellView, HexBlockView, MergeInputHandler
  - **예상 구현 순서**: 23번째

- [ ] **10.2.2 비매칭 블록 딤(어두운) 처리 구현**
  - **구현 설명**: 하이라이트 시 매칭되지 않는 블록들을 반투명하게 처리하여 매칭 가능 블록을 더 돋보이게 한다.
  - **파일 위치**: `Assets/_Project/Scripts/View/HighlightController.cs` (기존 파일 확장)
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `DimNonMatchingBlocks(int matchValue)` | `void` | 비매칭 블록 딤 처리 |
    | `RestoreAllBlocks()` | `void` | 모든 블록 원래 밝기 복원 |
  - **예상 난이도**: 하
  - **의존성**: HighlightController, HexBlockView
  - **예상 구현 순서**: 24번째

---

## 11. Phase 10: 통합 및 게임 루프 연동

### 11.1 개요

Phase 1~9의 모든 시스템을 GameLoop에 통합하고, 머지->점수->연쇄->웨이브->보드 체크의 전체 사이클이 올바르게 동작하도록 연결한다.

### 11.2 구현 체크리스트

- [ ] **11.2.1 GameLoop에 머지 시스템 연동**
  - **구현 설명**: MergeInputHandler -> MergeProcessor -> WaveSystem -> 보드 체크의 전체 흐름을 GameLoop에서 오케스트레이션한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/State/GameLoop.cs`
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `inputHandler` | `MergeInputHandler` | 입력 핸들러 |
    | `mergeProcessor` | `MergeProcessor` | 머지 프로세서 |
    | `waveSystem` | `WaveSystem` | 웨이브 시스템 |
    | `matchFinder` | `MatchFinder` | 매칭 탐색기 |
    | `highlightController` | `HighlightController` | 하이라이트 컨트롤러 |
    | `InitializeMergeSystem()` | `void` | 머지 관련 시스템 초기화 및 이벤트 바인딩 |
    | `OnMergeRequested(HexCell, HexCell)` | `async void` | 머지 요청 처리 |
    | `OnMergeCompleted(MergeResult)` | `async void` | 머지 완료 후 처리 |
    | `CheckBoardState(MergeResult)` | `void` | 보드 상태 확인 (리셔플 필요 여부) |
  - **의사코드**:
    ```csharp
    // GameLoop 내부
    private void InitializeMergeSystem()
    {
        matchFinder = new MatchFinder(grid);
        var spawner = new BlockSpawner();
        waveSystem = new WaveSystem(grid, spawner, waveConfig);
        var chainProcessor = new ChainProcessor(grid);
        mergeProcessor = new MergeProcessor(
            grid, scoreSystem, waveSystem, matchFinder, chainProcessor);

        inputHandler = new MergeInputHandler();
        highlightController = new HighlightController(matchFinder);

        // 이벤트 바인딩
        inputHandler.OnBlockSelected += highlightController.HighlightMatchingBlocks;
        inputHandler.OnSelectionCleared += highlightController.ClearHighlights;
        inputHandler.OnMergeRequested += OnMergeRequested;
        mergeProcessor.OnMergeCompleted += OnMergeCompleted;
    }

    private async void OnMergeRequested(HexCell source, HexCell target)
    {
        highlightController.ClearHighlights();
        await mergeProcessor.ExecuteMerge(source, target);
    }

    private async void OnMergeCompleted(MergeResult result)
    {
        // 마일스톤 체크
        scoreSystem.CheckMilestone(result.MergedValue);

        // 웨이브 애니메이션
        await PlayWaveAnimation(result.WaveResult);

        // 보드 상태 확인
        if (!result.HasValidMoves)
        {
            await PerformReshuffle();
        }

        // 자동 저장
        SaveGameState();

        // 입력 재활성화
        inputHandler.SetState(SelectionState.Idle);
    }
    ```
  - **예상 난이도**: 상
  - **의존성**: 모든 Phase의 클래스
  - **예상 구현 순서**: 25번째

- [ ] **11.2.2 초기 보드 설정 (게임 시작 시 블록 배치)**
  - **구현 설명**: 새 게임 시작 시 보드에 초기 블록을 배치하는 로직. 빈 보드에 일정 수의 블록을 랜덤 배치한다.
  - **파일 위치**: `Assets/_Project/Scripts/Core/State/GameLoop.cs` (기존 파일 확장)
  - **클래스/메서드 목록**:
    | 멤버 | 타입 | 설명 |
    |------|------|------|
    | `initialBlockCount` | `int = 10` | 초기 배치 블록 수 |
    | `SetupInitialBoard()` | `void` | 초기 보드 구성 |
  - **의사코드**:
    ```csharp
    private void SetupInitialBoard()
    {
        var placer = new BlockPlacer(grid, new BlockSpawner());
        List<HexBlock> initialBlocks = placer.PlaceMultipleBlocks(initialBlockCount);

        // 매칭 가능 쌍이 최소 1개 이상 되도록 보장
        if (!matchFinder.HasAnyValidMatch())
        {
            // 마지막 블록의 레벨과 같은 블록 1개 추가
            int lastLevel = initialBlocks[initialBlocks.Count - 1].Level;
            placer.PlaceSingleBlock(); // 추가 블록
        }
    }
    ```
  - **예상 난이도**: 중
  - **의존성**: BlockPlacer, MatchFinder
  - **예상 구현 순서**: 26번째

- [ ] **11.2.3 전체 통합 테스트**
  - **구현 설명**: 전체 게임 사이클(블록 배치 -> 탭 -> 머지 -> 연쇄 -> 웨이브 -> 보드 체크)을 시뮬레이션하여 정상 동작을 검증한다.
  - **파일 위치**: `Assets/_Project/Tests/PlayMode/Integration/MergeSystemIntegrationTests.cs`
  - **클래스/메서드 목록**:
    | 메서드 | 설명 |
    |--------|------|
    | `Test_FullMergeCycle_CompletesSuccessfully()` | 전체 사이클 완주 |
    | `Test_ChainMerge_TriggersAutomatically()` | 연쇄 머지 자동 발동 |
    | `Test_WaveGeneration_AfterMerge()` | 머지 후 웨이브 생성됨 |
    | `Test_BoardFull_TriggersReshuffle()` | 보드 가득 참 시 리셔플 |
    | `Test_NoValidMoves_TriggersReshuffle()` | 유효 수 없을 때 리셔플 |
    | `Test_MultipleConsecutiveMerges()` | 연속 머지 안정성 |
    | `Test_HighScoreUpdate_AfterMerge()` | 머지 후 최고 점수 갱신 |
  - **예상 난이도**: 상
  - **의존성**: 전체 머지 시스템
  - **예상 구현 순서**: 27번째 (최종)

---

## 12. 에지 케이스 및 주의사항

### 12.1 입력 관련 에지 케이스

| 번호 | 에지 케이스 | 설명 | 대응 방안 |
|------|------------|------|----------|
| E-01 | **더블 탭 경쟁 상태** | 같은 블록을 매우 빠르게 두 번 탭하면 두 번째 탭이 ClearSelection 대신 머지를 시도할 수 있음 | `Processing` 상태 진입 후 모든 입력을 즉시 차단. 상태 전환은 원자적(atomic)으로 처리 |
| E-02 | **애니메이션 중 탭** | 머지/웨이브 애니메이션 중에 추가 탭 발생 | `Processing` 상태에서 모든 입력 무시. `SetState(Idle)`은 반드시 모든 애니메이션 완료 후 호출 |
| E-03 | **동시 터치 (멀티 터치)** | 두 손가락으로 동시에 다른 블록을 탭 | 첫 번째 감지된 터치만 처리. `Input.touchCount > 1`일 때 두 번째 이후 무시 |
| E-04 | **잠긴 셀 탭** | Lock 상태의 셀을 탭 | `IsInteractable` 체크로 필터링 (Locked 상태는 Interactable이 아님) |

### 12.2 머지 관련 에지 케이스

| 번호 | 에지 케이스 | 설명 | 대응 방안 |
|------|------------|------|----------|
| E-05 | **소스/타겟이 같은 셀** | 동일 블록을 두 번 탭하여 자기 자신과 머지 시도 | `HandleSecondTap`에서 `cell == firstSelectedCell` 조건으로 선택 해제 처리 |
| E-06 | **머지 중 블록 상태 변경** | 연쇄 처리 중에 이미 제거된 블록에 접근 | 연쇄 루프 내에서 `cell.State != CellState.Occupied` 재확인 |
| E-07 | **연쇄 무한 루프** | 이론적으로 불가능하지만 데이터 오류 시 발생 가능 | `MAX_CHAIN_DEPTH = 20` 제한. 각 연쇄에서 값이 반드시 증가하므로 이론적 최대 = log2(최대값) |
| E-08 | **빈 셀에 머지 시도** | 머지 실행 시점에 타겟 셀이 비어있는 경우 | `ExecuteMerge` 시작 시 양쪽 셀의 Occupied 상태 재검증 |
| E-09 | **동일 값 3개 이상 동시 존재** | 같은 값의 블록이 3개 이상일 때 어느 것과 머지하느냐 | 플레이어가 두 번째 탭으로 명시적 선택. 연쇄는 인접한 것 중 첫 번째(방향 순) 선택 |

### 12.3 웨이브 관련 에지 케이스

| 번호 | 에지 케이스 | 설명 | 대응 방안 |
|------|------------|------|----------|
| E-10 | **빈 셀 없는 웨이브** | 웨이브 시점에 빈 셀이 0개 | `WaveResult(0, true)` 반환, 보드 가득 참 체크로 이어짐 |
| E-11 | **후보 셀 < 웨이브 블록 수** | 빈 셀 3개인데 웨이브 블록 5개 | `Mathf.Min(blockCount, candidates.Count)`로 가용 셀 수 이내 배치 |
| E-12 | **웨이브 후 매칭 불가** | 웨이브로 생성된 블록들이 모두 고유 값이어서 매칭 쌍이 없음 | 웨이브 후 `HasAnyValidMatch()` 체크 -> false면 리셔플 |
| E-13 | **머지 1회로 셀 1개 비움 + 웨이브 3개 추가** | 셀이 점점 차는 문제 | 설계 의도대로 동작. 이것이 게임의 긴장감 핵심 메커니즘 |

### 12.4 점수 관련 에지 케이스

| 번호 | 에지 케이스 | 설명 | 대응 방안 |
|------|------------|------|----------|
| E-14 | **int 오버플로우** | 매우 높은 점수 도달 시 정수 오버플로우 | `long` 타입 사용 검토. 또는 `int.MaxValue` 캡 처리 |
| E-15 | **연쇄 보너스 누적 오류** | 연쇄 중 점수 계산 순서 오류 | 각 연쇄 단계에서 독립적으로 점수 계산 후 합산 |

---

## 13. 성능 최적화 고려사항

### 13.1 메모리 최적화

| 항목 | 설명 | 우선순위 |
|------|------|---------|
| **오브젝트 풀링 (블록)** | HexBlock의 View 오브젝트(GameObject)를 매번 생성/파괴하지 않고 풀에서 재사용. 웨이브마다 최대 7개의 블록이 생성되므로 풀 크기는 최소 61개(전체 셀 수) 권장 | 상 |
| **이펙트 풀링** | 머지 이펙트(파티클)도 오브젝트 풀 적용. 연쇄 머지 시 동시 다수 이펙트 가능 | 상 |
| **GC 할당 최소화** | `GetEmptyCells()`, `GetOccupiedCells()` 등에서 매번 List를 new하지 않고 캐시된 리스트를 Clear/재사용. `foreach`에서 LINQ 사용 자제 | 상 |
| **리스트 사전 할당** | `new List<HexCell>(6)` 등 예상 크기를 미리 지정하여 내부 배열 재할당 방지 | 중 |
| **문자열 할당 최소화** | `GetDisplayText()`의 결과를 캐싱. 블록 값이 변할 때만 재생성 | 중 |

### 13.2 연산 최적화

| 항목 | 설명 | 우선순위 |
|------|------|---------|
| **매칭 탐색 캐싱** | `FindAllMatchingCells()` 결과를 보드 상태 변경 시까지 캐싱. 같은 탭 선택 중 반복 호출 방지 | 중 |
| **HasAnyValidMatch 조기 종료** | 같은 값이 2개 발견되면 즉시 true 반환 (현재 설계대로) | 중 |
| **Dictionary 기반 값별 인덱싱** | 블록 배치/제거 시마다 `Dictionary<int, HashSet<CubeCoord>>`를 업데이트하여 O(1) 매칭 조회 가능 | 하 (향후 최적화) |
| **BFS 탐색 최적화** | `FindConnectedGroup`에서 HashSet 대신 비트마스크 사용 검토 (그리드 크기가 고정이므로) | 하 |

### 13.3 렌더링 최적화

| 항목 | 설명 | 우선순위 |
|------|------|---------|
| **스프라이트 아틀라스** | 모든 블록 스프라이트를 하나의 아틀라스에 패킹하여 드로우콜 최소화 | 상 |
| **블록 텍스트 갱신 최소화** | TextMeshPro 텍스트는 값이 변할 때만 갱신 | 중 |
| **하이라이트 셰이더** | 하이라이트/딤 효과를 머티리얼 프로퍼티 블록으로 처리 (인스턴스별 머티리얼 생성 방지) | 중 |
| **애니메이션 배칭** | 동시에 발생하는 웨이브 블록 스폰 애니메이션을 일괄 시작하되 약간의 딜레이를 두어 시각적 효과와 성능을 동시 확보 | 하 |

### 13.4 WebGL 전용 최적화

| 항목 | 설명 | 우선순위 |
|------|------|---------|
| **async/await 호환성** | UniTask의 WebGL 호환성 확인. PlayerLoop 기반 Task는 문제 없으나 Thread 기반은 사용 불가 | 상 |
| **GC 압박 최소화** | WebGL의 GC는 싱글 스레드이므로 프레임 드랍 유발. 머지/웨이브 처리 중 할당량 최소화 필수 | 상 |
| **메모리 제한** | WebGL 최대 256MB 메모리. 오브젝트 풀 크기와 텍스처 크기 제한 | 중 |

---

## 14. 테스트 계획

### 14.1 테스트 단계별 계획

| 단계 | 범위 | 종류 | 설명 |
|------|------|------|------|
| 1 | HexBlock | 단위 테스트 (EditMode) | 레벨/값 계산, 표시 텍스트 |
| 2 | BlockSpawner | 단위 테스트 (EditMode) | 생성 확률 분포 통계 검증 |
| 3 | BlockPlacer | 단위 테스트 (EditMode) | 배치 로직, 빈 셀 처리 |
| 4 | WaveSystem | 단위 테스트 (EditMode) | 웨이브 블록 수, 후보 셀 |
| 5 | MergeInputHandler | 단위 테스트 (EditMode) | 상태 전이, 탭 시나리오 |
| 6 | MatchFinder | 단위 테스트 (EditMode) | 매칭 탐색, 유효 수 판별 |
| 7 | ChainProcessor | 단위 테스트 (EditMode) | 연쇄 로직, 재귀 안전성 |
| 8 | MergeProcessor | 통합 테스트 (PlayMode) | 전체 머지 파이프라인 |
| 9 | GameLoop 연동 | 통합 테스트 (PlayMode) | 전체 게임 사이클 |
| 10 | 성능 프로파일링 | 프로파일링 (PlayMode) | GC 할당, 프레임 레이트 |

### 14.2 밸런싱 테스트 체크리스트

- [ ] 초기 보드에 매칭 가능 쌍이 최소 1개 이상 존재하는지 확인
- [ ] 웨이브 블록 수가 게임 진행에 따라 적절히 증가하는지 확인
- [ ] 생성 확률 테이블이 설계 의도대로 분포하는지 확인
- [ ] 연쇄 머지가 게임 밸런스를 해치지 않는 빈도로 발생하는지 확인
- [ ] 리셔플이 발생하는 빈도가 적절한지 확인 (너무 잦으면 생성 확률 조정)
- [ ] 보드 radius=4(61셀) 기준으로 평균 플레이 세션이 적절한 길이인지 확인

### 14.3 자동화 테스트 시뮬레이션

```csharp
/// 자동 플레이 시뮬레이션 (밸런싱 검증용)
public class AutoPlaySimulator
{
    public SimulationResult RunSimulation(int maxTurns = 1000)
    {
        var result = new SimulationResult();
        // 1. 그리드 생성 및 초기 블록 배치
        // 2. 매 턴: 랜덤으로 매칭 가능한 쌍 선택 -> 머지 실행
        // 3. 통계 수집: 턴 수, 최고 블록, 총 점수, 연쇄 빈도, 리셔플 횟수
        // 4. 빈 셀 없음 + 매칭 불가 시 리셔플
        // 5. 결과 반환
        return result;
    }
}
```

---

## 부록 A: 파일 경로 요약

| 파일 경로 | Phase | 설명 |
|-----------|-------|------|
| `Scripts/Core/Block/HexBlock.cs` | 1 | 블록 데이터 모델 |
| `Scripts/Core/Block/BlockSpawner.cs` | 2 | 블록 생성 규칙 |
| `Scripts/Core/Block/BlockPlacer.cs` | 3 | 블록 배치 로직 |
| `Scripts/Core/Block/WaveConfig.cs` | 4 | 웨이브 설정 ScriptableObject |
| `Scripts/Core/Block/WaveResult.cs` | 4 | 웨이브 결과 데이터 |
| `Scripts/Core/Block/WaveSystem.cs` | 4 | 웨이브 시스템 핵심 로직 |
| `Scripts/Core/Merge/SelectionState.cs` | 5 | 선택 상태 열거형 |
| `Scripts/Core/Merge/MergeInputHandler.cs` | 5 | 탭 입력 처리 |
| `Scripts/Core/Merge/MatchFinder.cs` | 6 | 매칭 탐색 |
| `Scripts/Core/Merge/MergeResult.cs` | 7 | 머지 결과 데이터 |
| `Scripts/Core/Merge/MergeProcessor.cs` | 7 | 머지 실행 프로세서 |
| `Scripts/Core/Merge/ChainResult.cs` | 8 | 연쇄 머지 결과 데이터 |
| `Scripts/Core/Merge/ChainProcessor.cs` | 8 | 연쇄 머지 처리 |
| `Scripts/View/HighlightController.cs` | 9 | 하이라이트/힌트 시스템 |
| `Scripts/Core/State/GameLoop.cs` | 10 | 통합 게임 루프 |

## 부록 B: 구현 순서 요약 (27단계)

| 순서 | 항목 | Phase | 난이도 | 예상 소요 |
|------|------|-------|--------|----------|
| 1 | HexBlock 클래스 | 1 | 하 | 0.5일 |
| 2 | HexBlock 단위 테스트 | 1 | 하 | 0.5일 |
| 3 | BlockSpawner 클래스 | 2 | 중 | 1일 |
| 4 | BlockSpawner 확률 테스트 | 2 | 중 | 0.5일 |
| 5 | BlockPlacer 클래스 | 3 | 하 | 0.5일 |
| 6 | BlockPlacer 단위 테스트 | 3 | 하 | 0.5일 |
| 7 | WaveConfig ScriptableObject | 4 | 하 | 0.5일 |
| 8 | WaveResult 데이터 클래스 | 4 | 하 | 0.5일 |
| 9 | WaveSystem 핵심 로직 | 4 | 중 | 1.5일 |
| 10 | 웨이브 방향 결정 로직 | 4 | 중 | 1일 |
| 11 | WaveSystem 단위 테스트 | 4 | 중 | 1일 |
| 12 | SelectionState 열거형 | 5 | 하 | 0.5일 |
| 13 | MergeInputHandler 클래스 | 5 | 중 | 1일 |
| 14 | MergeInputHandler 테스트 | 5 | 중 | 0.5일 |
| 15 | MatchFinder 클래스 | 6 | 중 | 1일 |
| 16 | MatchFinder 단위 테스트 | 6 | 하 | 0.5일 |
| 17 | MergeResult 데이터 클래스 | 7 | 하 | 0.5일 |
| 18 | MergeProcessor 클래스 | 7 | 상 | 2일 |
| 19 | MergeProcessor 통합 테스트 | 7 | 상 | 1일 |
| 20 | ChainResult 데이터 클래스 | 8 | 하 | 0.5일 |
| 21 | ChainProcessor 클래스 | 8 | 상 | 2일 |
| 22 | ChainProcessor 단위 테스트 | 8 | 상 | 1일 |
| 23 | HighlightController | 9 | 중 | 1일 |
| 24 | 비매칭 블록 딤 처리 | 9 | 하 | 0.5일 |
| 25 | GameLoop 통합 연동 | 10 | 상 | 1.5일 |
| 26 | 초기 보드 설정 | 10 | 중 | 0.5일 |
| 27 | 전체 통합 테스트 | 10 | 상 | 1일 |
| | **합계** | | | **약 22일** |
