# Hexa Merge Basic - 게임 코어 시스템 설계문서

| 항목 | 내용 |
|------|------|
| **게임명** | Hexa Merge Basic |
| **참고 게임** | XUP - Brain Training Game (com.gamegos.viral.simple) |
| **플랫폼** | 웹(HTML5/WebGL) + Android |
| **엔진** | Unity 2022 LTS (WebGL + Android 빌드) |
| **문서 버전** | v1.0 |
| **최종 수정일** | 2026-02-13 |

---

## 목차

1. [헥사 그리드 시스템](#1-헥사-그리드-시스템)
2. [블록 시스템](#2-블록-시스템)
3. [머지(합치기) 시스템](#3-머지합치기-시스템)
4. [스코어링 시스템](#4-스코어링-시스템)
5. [게임 상태 관리](#5-게임-상태-관리)
6. [기술 스택 및 아키텍처](#6-기술-스택-및-아키텍처)

---

## 1. 헥사 그리드 시스템

### 1.1 개요

헥사곤 그리드는 게임의 핵심 플레이 공간이다. 정육각형 셀들이 벌집 형태로 배치되며, 각 셀에 숫자 블록이 놓인다. 플레이어는 이 그리드 위에서 같은 숫자를 가진 블록 두 개를 탭하여 머지(합치기)를 수행한다.

### 1.2 좌표 체계

헥사곤 그리드에는 여러 좌표 체계가 존재한다. 본 프로젝트에서는 **큐브 좌표(Cube Coordinates)** 를 내부 연산용으로 사용하고, **오프셋 좌표(Offset Coordinates)** 를 화면 배치 및 직렬화용으로 사용한다.

#### 1.2.1 큐브 좌표 (Cube Coordinates)

큐브 좌표는 세 축(q, r, s)을 사용하며, 항상 `q + r + s = 0` 제약 조건을 만족한다. 인접 셀 탐색과 거리 계산에 유리하다.

```
        (-1,-1,2) (0,-1,1)  (1,-1,0)
      (-1,0,1)  [0,0,0]  (1,0,-1)
        (-1,1,0)  (0,1,-1)  (1,1,-2)
```

```csharp
/// <summary>
/// 큐브 좌표를 표현하는 구조체.
/// q + r + s = 0 제약 조건을 항상 만족해야 한다.
/// </summary>
[System.Serializable]
public struct CubeCoord : System.IEquatable<CubeCoord>
{
    public int q; // 열 방향 (동-서)
    public int r; // 행 방향 (남동-북서)
    public int s; // 대각선 방향 (남서-북동), 항상 s = -q - r

    public CubeCoord(int q, int r, int s)
    {
        Debug.Assert(q + r + s == 0, "큐브 좌표 제약 위반: q + r + s != 0");
        this.q = q;
        this.r = r;
        this.s = s;
    }

    public CubeCoord(int q, int r)
    {
        this.q = q;
        this.r = r;
        this.s = -q - r;
    }

    // 두 좌표 간 헥사 거리
    public static int Distance(CubeCoord a, CubeCoord b)
    {
        return Mathf.Max(
            Mathf.Abs(a.q - b.q),
            Mathf.Abs(a.r - b.r),
            Mathf.Abs(a.s - b.s)
        );
    }

    public bool Equals(CubeCoord other)
        => q == other.q && r == other.r && s == other.s;

    public override int GetHashCode()
        => (q * 397) ^ (r * 31) ^ s;
}
```

#### 1.2.2 오프셋 좌표 (Offset Coordinates)

화면 렌더링과 저장(직렬화)에는 2D 배열에 매핑하기 쉬운 오프셋 좌표를 사용한다. 본 프로젝트에서는 **짝수 열 오프셋(even-q offset)** 방식(flat-top 헥사곤)을 채택한다.

```csharp
/// <summary>
/// 오프셋 좌표. 2D 배열 인덱싱 및 직렬화에 사용.
/// </summary>
[System.Serializable]
public struct OffsetCoord
{
    public int col; // 열 (x 방향)
    public int row; // 행 (y 방향)

    public OffsetCoord(int col, int row)
    {
        this.col = col;
        this.row = row;
    }
}
```

#### 1.2.3 좌표 변환

```csharp
public static class CoordConverter
{
    /// 큐브 좌표 -> 오프셋 좌표 (even-q 방식)
    public static OffsetCoord CubeToOffset(CubeCoord cube)
    {
        int col = cube.q;
        int row = cube.r + (cube.q + (cube.q & 1)) / 2;
        return new OffsetCoord(col, row);
    }

    /// 오프셋 좌표 -> 큐브 좌표 (even-q 방식)
    public static CubeCoord OffsetToCube(OffsetCoord offset)
    {
        int q = offset.col;
        int r = offset.row - (offset.col + (offset.col & 1)) / 2;
        int s = -q - r;
        return new CubeCoord(q, r, s);
    }

    /// 큐브 좌표 -> 월드 좌표 (flat-top 헥사곤)
    public static Vector2 CubeToWorld(CubeCoord cube, float hexSize)
    {
        float x = hexSize * (3f / 2f * cube.q);
        float y = hexSize * (Mathf.Sqrt(3f) / 2f * cube.q + Mathf.Sqrt(3f) * cube.r);
        return new Vector2(x, y);
    }

    /// 월드 좌표 -> 큐브 좌표 (반올림 처리)
    public static CubeCoord WorldToCube(Vector2 worldPos, float hexSize)
    {
        float q = (2f / 3f * worldPos.x) / hexSize;
        float r = (-1f / 3f * worldPos.x + Mathf.Sqrt(3f) / 3f * worldPos.y) / hexSize;
        return CubeRound(q, r, -q - r);
    }

    /// 실수 큐브 좌표를 정수로 반올림
    private static CubeCoord CubeRound(float fq, float fr, float fs)
    {
        int q = Mathf.RoundToInt(fq);
        int r = Mathf.RoundToInt(fr);
        int s = Mathf.RoundToInt(fs);

        float qDiff = Mathf.Abs(q - fq);
        float rDiff = Mathf.Abs(r - fr);
        float sDiff = Mathf.Abs(s - fs);

        if (qDiff > rDiff && qDiff > sDiff)
            q = -r - s;
        else if (rDiff > sDiff)
            r = -q - s;
        else
            s = -q - r;

        return new CubeCoord(q, r, s);
    }
}
```

### 1.3 그리드 크기 및 셀 배치

#### 1.3.1 그리드 형태

참고 게임(XUP)의 그리드 형태를 분석하면, **정육각형 모양의 보드**가 사용된다. 중심 셀로부터 반지름 N만큼 확장된 육각형 보드 형태이다.

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `gridRadius` | 4 | 중심(0,0,0)으로부터의 반지름. 반지름 4이면 총 61셀 |
| `hexSize` | 0.6f | 헥사곤 한 변의 길이 (Unity 월드 단위) |
| `hexSpacing` | 0.05f | 셀 간 간격 |

#### 1.3.2 총 셀 수 계산 공식

```
총 셀 수 = 3 * radius * (radius + 1) + 1

예시:
  radius=2 -> 19셀
  radius=3 -> 37셀
  radius=4 -> 61셀  (기본값)
  radius=5 -> 91셀
```

#### 1.3.3 그리드 생성 의사코드

```csharp
public class HexGrid
{
    private Dictionary<CubeCoord, HexCell> cells = new Dictionary<CubeCoord, HexCell>();
    private int radius;

    /// <summary>
    /// 반지름 기반 육각형 그리드 생성.
    /// 중심 (0,0,0)으로부터 radius 거리 이내의 모든 큐브 좌표에 셀을 배치한다.
    /// </summary>
    public void GenerateGrid(int radius)
    {
        this.radius = radius;
        cells.Clear();

        for (int q = -radius; q <= radius; q++)
        {
            int r1 = Mathf.Max(-radius, -q - radius);
            int r2 = Mathf.Min(radius, -q + radius);

            for (int r = r1; r <= r2; r++)
            {
                CubeCoord coord = new CubeCoord(q, r);
                HexCell cell = new HexCell(coord);
                cells.Add(coord, cell);
            }
        }
    }

    /// 특정 좌표의 셀을 반환 (없으면 null)
    public HexCell GetCell(CubeCoord coord)
    {
        cells.TryGetValue(coord, out HexCell cell);
        return cell;
    }

    /// 그리드에 포함된 좌표인지 확인
    public bool IsValidCoord(CubeCoord coord)
    {
        return cells.ContainsKey(coord);
    }

    /// 모든 셀 목록 반환
    public IEnumerable<HexCell> GetAllCells() => cells.Values;

    /// 빈 셀 목록 반환
    public List<HexCell> GetEmptyCells()
    {
        return cells.Values.Where(c => c.State == CellState.Empty).ToList();
    }

    /// 블록이 있는 셀 목록 반환
    public List<HexCell> GetOccupiedCells()
    {
        return cells.Values.Where(c => c.State == CellState.Occupied).ToList();
    }
}
```

### 1.4 인접 셀 탐색 알고리즘

헥사곤 그리드에서 각 셀은 최대 6개의 인접 셀을 가진다.

#### 1.4.1 6방향 인접 오프셋 (큐브 좌표 기준)

```
방향 인덱스 | 방향명    | q변화 | r변화 | s변화
-----------|----------|-------|-------|------
    0      | 동(E)    |  +1   |   0   |  -1
    1      | 북동(NE) |  +1   |  -1   |   0
    2      | 북서(NW) |   0   |  -1   |  +1
    3      | 서(W)    |  -1   |   0   |  +1
    4      | 남서(SW) |  -1   |  +1   |   0
    5      | 남동(SE) |   0   |  +1   |  -1
```

```csharp
public static class HexDirection
{
    // 6방향 인접 오프셋 (큐브 좌표)
    public static readonly CubeCoord[] Directions = new CubeCoord[]
    {
        new CubeCoord(+1,  0, -1), // 동 (E)
        new CubeCoord(+1, -1,  0), // 북동 (NE)
        new CubeCoord( 0, -1, +1), // 북서 (NW)
        new CubeCoord(-1,  0, +1), // 서 (W)
        new CubeCoord(-1, +1,  0), // 남서 (SW)
        new CubeCoord( 0, +1, -1), // 남동 (SE)
    };

    /// 특정 좌표의 인접 좌표 목록 반환 (그리드 범위 내)
    public static List<CubeCoord> GetNeighbors(CubeCoord center, HexGrid grid)
    {
        List<CubeCoord> neighbors = new List<CubeCoord>(6);
        foreach (var dir in Directions)
        {
            CubeCoord neighbor = new CubeCoord(
                center.q + dir.q,
                center.r + dir.r,
                center.s + dir.s
            );
            if (grid.IsValidCoord(neighbor))
            {
                neighbors.Add(neighbor);
            }
        }
        return neighbors;
    }

    /// 특정 좌표 주변에서 같은 값의 블록이 있는 인접 셀 탐색
    public static List<HexCell> GetMatchingNeighbors(CubeCoord center, int value, HexGrid grid)
    {
        List<HexCell> matches = new List<HexCell>();
        foreach (var neighborCoord in GetNeighbors(center, grid))
        {
            HexCell cell = grid.GetCell(neighborCoord);
            if (cell != null && cell.State == CellState.Occupied && cell.Block.Value == value)
            {
                matches.Add(cell);
            }
        }
        return matches;
    }

    /// BFS 기반 연결된 같은 값 블록 그룹 탐색
    public static List<HexCell> FindConnectedGroup(CubeCoord start, int value, HexGrid grid)
    {
        List<HexCell> group = new List<HexCell>();
        HashSet<CubeCoord> visited = new HashSet<CubeCoord>();
        Queue<CubeCoord> queue = new Queue<CubeCoord>();

        queue.Enqueue(start);
        visited.Add(start);

        while (queue.Count > 0)
        {
            CubeCoord current = queue.Dequeue();
            HexCell cell = grid.GetCell(current);

            if (cell != null && cell.State == CellState.Occupied && cell.Block.Value == value)
            {
                group.Add(cell);
                foreach (var neighbor in GetNeighbors(current, grid))
                {
                    if (!visited.Contains(neighbor))
                    {
                        visited.Add(neighbor);
                        queue.Enqueue(neighbor);
                    }
                }
            }
        }
        return group;
    }
}
```

### 1.5 셀 상태 관리

각 헥사곤 셀은 명확한 상태를 가진다.

#### 1.5.1 셀 상태 열거형

```csharp
public enum CellState
{
    Empty,      // 빈 셀 - 새 블록을 배치할 수 있음
    Occupied,   // 블록이 존재하는 셀
    Locked,     // 잠긴 셀 - 애니메이션 중이거나 머지 처리 중
    Disabled    // 비활성 셀 - 사용 불가 영역 (확장용 예약)
}
```

#### 1.5.2 셀 데이터 구조

```csharp
public class HexCell
{
    public CubeCoord Coord { get; private set; }
    public CellState State { get; private set; }
    public HexBlock Block { get; private set; }

    // 시각 요소 참조 (MVC 패턴)
    public HexCellView View { get; set; }

    public HexCell(CubeCoord coord)
    {
        Coord = coord;
        State = CellState.Empty;
        Block = null;
    }

    /// 셀에 블록 배치
    public void PlaceBlock(HexBlock block)
    {
        Debug.Assert(State == CellState.Empty, "빈 셀에만 블록을 배치할 수 있습니다.");
        Block = block;
        block.Cell = this;
        State = CellState.Occupied;
    }

    /// 셀에서 블록 제거
    public HexBlock RemoveBlock()
    {
        Debug.Assert(State == CellState.Occupied, "블록이 있는 셀에서만 제거할 수 있습니다.");
        HexBlock removed = Block;
        removed.Cell = null;
        Block = null;
        State = CellState.Empty;
        return removed;
    }

    /// 셀 잠금 (애니메이션/처리 중)
    public void Lock() => State = CellState.Locked;

    /// 셀 잠금 해제
    public void Unlock()
    {
        State = (Block != null) ? CellState.Occupied : CellState.Empty;
    }

    /// 셀이 비어있는지 확인
    public bool IsEmpty => State == CellState.Empty;

    /// 셀이 상호작용 가능한지 확인
    public bool IsInteractable => State == CellState.Occupied;
}
```

### 1.6 구현 체크리스트

- [ ] `CubeCoord` 구조체 구현 및 단위 테스트
- [ ] `OffsetCoord` 구조체 구현
- [ ] `CoordConverter` 좌표 변환 유틸리티 구현 및 단위 테스트
- [ ] `HexGrid` 클래스 구현 (그리드 생성, 셀 조회)
- [ ] `HexDirection` 인접 셀 탐색 구현 및 단위 테스트
- [ ] `HexCell` 클래스 구현 (상태 관리, 블록 배치/제거)
- [ ] 월드 좌표 변환 및 터치/클릭 좌표에서 셀 역변환 테스트
- [ ] 그리드 시각화 프로토타입 (에디터 기즈모 또는 런타임)

---

## 2. 블록 시스템

### 2.1 개요

블록은 헥사곤 셀 위에 놓이는 숫자 타일이다. 각 블록은 2의 거듭제곱 값(2, 4, 8, 16, ...)을 가지며, 같은 값의 블록 두 개를 머지하면 두 배 값의 블록이 생성된다.

### 2.2 블록 데이터 구조

```csharp
/// <summary>
/// 블록의 값 레벨.
/// Level 1 = 값 2, Level 2 = 값 4, ..., Level N = 값 2^N
/// </summary>
public class HexBlock
{
    public int Level { get; private set; }          // 레벨 (1부터 시작)
    public int Value => 1 << Level;                 // 실제 값 (2^Level)
    public HexCell Cell { get; set; }               // 현재 위치한 셀
    public string UniqueId { get; private set; }    // 고유 식별자

    // 시각 요소 참조
    public HexBlockView View { get; set; }

    public HexBlock(int level)
    {
        Debug.Assert(level >= 1, "블록 레벨은 1 이상이어야 합니다.");
        Level = level;
        UniqueId = System.Guid.NewGuid().ToString();
    }

    /// 머지 후 레벨 증가
    public void LevelUp()
    {
        Level++;
    }

    /// 현재 값의 표시 문자열 (1024 이상은 K 단위)
    public string GetDisplayText()
    {
        int val = Value;
        if (val >= 1048576) return (val / 1048576) + "M";
        if (val >= 1024) return (val / 1024) + "K";
        return val.ToString();
    }
}
```

#### 2.2.1 블록 레벨과 값 대응표

| 레벨 | 값 | 표시 | 색상 참조(예시) |
|------|----|------|----------------|
| 1 | 2 | "2" | #FFE0B2 (연한 주황) |
| 2 | 4 | "4" | #FFCC80 (주황) |
| 3 | 8 | "8" | #FF9800 (진한 주황) |
| 4 | 16 | "16" | #FF7043 (레드 오렌지) |
| 5 | 32 | "32" | #EF5350 (레드) |
| 6 | 64 | "64" | #E53935 (진한 레드) |
| 7 | 128 | "128" | #AB47BC (보라) |
| 8 | 256 | "256" | #7E57C2 (진한 보라) |
| 9 | 512 | "512" | #5C6BC0 (인디고) |
| 10 | 1024 | "1K" | #42A5F5 (블루) |
| 11 | 2048 | "2K" | #26C6DA (시안) |
| 12 | 4096 | "4K" | #66BB6A (그린) |
| 13+ | 8192+ | "8K+" | #FFEE58 (골드) |

### 2.3 블록 생성 규칙

새 블록이 생성될 때 어떤 숫자(레벨)의 블록이 나올지를 결정하는 규칙이다. 현재 보드에서 가장 높은 블록의 레벨에 따라 생성 가능한 범위가 달라진다.

#### 2.3.1 생성 레벨 범위 결정

```csharp
public class BlockSpawner
{
    // 최소 생성 레벨
    private const int MIN_SPAWN_LEVEL = 1; // 값 2

    // 현재 보드 상태에 따른 최대 생성 레벨
    // 보드 최고 레벨의 약 60%까지 생성 가능 (최소 레벨 3 = 값 8)
    private int GetMaxSpawnLevel(int boardMaxLevel)
    {
        int maxSpawn = Mathf.Max(3, Mathf.FloorToInt(boardMaxLevel * 0.6f));
        return Mathf.Clamp(maxSpawn, MIN_SPAWN_LEVEL, 7); // 최대 128까지만 직접 생성
    }

    /// <summary>
    /// 생성 확률 테이블.
    /// 낮은 레벨일수록 높은 확률로 생성된다.
    /// </summary>
    private int SelectSpawnLevel(int boardMaxLevel)
    {
        int maxLevel = GetMaxSpawnLevel(boardMaxLevel);

        // 가중치 배열 생성 (레벨이 높을수록 낮은 가중치)
        float[] weights = new float[maxLevel];
        for (int i = 0; i < maxLevel; i++)
        {
            // 레벨 1(값2)의 가중치가 가장 높고, 레벨이 올라갈수록 감소
            weights[i] = Mathf.Pow(0.45f, i); // 0.45 비율로 감소
        }

        // 가중치 기반 랜덤 선택
        float totalWeight = weights.Sum();
        float random = UnityEngine.Random.Range(0f, totalWeight);
        float cumulative = 0f;

        for (int i = 0; i < weights.Length; i++)
        {
            cumulative += weights[i];
            if (random <= cumulative)
            {
                return i + 1; // 레벨은 1부터 시작
            }
        }

        return 1; // 폴백: 레벨 1(값 2)
    }
}
```

#### 2.3.2 생성 확률 예시 (보드 최고값 기준)

보드 최고값이 512(레벨 9)일 때 (`maxSpawnLevel = 5`, 즉 최대 32까지 생성):

| 레벨 | 값 | 대략적 확률 |
|------|----|------------|
| 1 | 2 | 약 42% |
| 2 | 4 | 약 27% |
| 3 | 8 | 약 17% |
| 4 | 16 | 약 10% |
| 5 | 32 | 약 4% |

### 2.4 블록 배치 로직

```csharp
public class BlockPlacer
{
    private HexGrid grid;
    private BlockSpawner spawner;

    /// <summary>
    /// 단일 블록을 랜덤 빈 셀에 배치
    /// </summary>
    public HexBlock PlaceSingleBlock()
    {
        List<HexCell> emptyCells = grid.GetEmptyCells();
        if (emptyCells.Count == 0) return null;

        // 랜덤 빈 셀 선택
        HexCell targetCell = emptyCells[UnityEngine.Random.Range(0, emptyCells.Count)];

        // 보드 최고 레벨 계산
        int boardMaxLevel = GetBoardMaxLevel();

        // 블록 생성 및 배치
        int spawnLevel = spawner.SelectSpawnLevel(boardMaxLevel);
        HexBlock newBlock = new HexBlock(spawnLevel);
        targetCell.PlaceBlock(newBlock);

        return newBlock;
    }

    /// 현재 보드에서 가장 높은 블록 레벨 반환
    private int GetBoardMaxLevel()
    {
        int maxLevel = 1;
        foreach (var cell in grid.GetOccupiedCells())
        {
            if (cell.Block.Level > maxLevel)
                maxLevel = cell.Block.Level;
        }
        return maxLevel;
    }
}
```

### 2.5 블록 파도(웨이브) 생성 시스템

매칭이 완료될 때마다 새로운 블록들이 보드 바깥 테두리에서 안쪽으로 "파도"처럼 밀려 들어온다. 이것이 게임의 핵심 긴장감을 만드는 메커니즘이다.

#### 2.5.1 웨이브 시스템 설계

```csharp
public class WaveSystem
{
    private HexGrid grid;
    private BlockSpawner spawner;

    /// <summary>
    /// 웨이브 설정 데이터.
    /// 게임 진행에 따라 웨이브의 강도가 달라진다.
    /// </summary>
    [System.Serializable]
    public class WaveConfig
    {
        public int baseBlockCount = 3;      // 기본 생성 블록 수
        public int maxBlockCount = 7;       // 최대 생성 블록 수
        public float difficultyScale = 0.1f; // 난이도 스케일링 계수
    }

    private WaveConfig config;
    private int totalMergeCount = 0; // 누적 머지 횟수 (난이도 판단)

    /// <summary>
    /// 머지 후 호출되는 웨이브 생성.
    /// 테두리 빈 셀을 우선으로 블록을 배치한다.
    /// </summary>
    public WaveResult GenerateWave()
    {
        // 1. 생성할 블록 수 결정
        int blockCount = CalculateWaveBlockCount();

        // 2. 배치 가능한 셀 목록 (테두리 우선)
        List<HexCell> candidates = GetWaveCandidateCells();

        if (candidates.Count == 0)
        {
            return new WaveResult(0, false); // 빈 셀이 없음
        }

        // 3. 블록 수를 후보 셀 수 이내로 제한
        blockCount = Mathf.Min(blockCount, candidates.Count);

        // 4. 후보 셀에서 랜덤으로 blockCount개 선택하여 블록 배치
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

        // 5. 결과 반환 (빈 셀이 0이면 게임 체크 필요)
        bool boardFull = (grid.GetEmptyCells().Count == 0);
        return new WaveResult(blockCount, boardFull, newBlocks);
    }

    /// 웨이브 블록 수 계산 (누적 머지 횟수에 따라 증가)
    private int CalculateWaveBlockCount()
    {
        int count = config.baseBlockCount
                  + Mathf.FloorToInt(totalMergeCount * config.difficultyScale);
        return Mathf.Clamp(count, config.baseBlockCount, config.maxBlockCount);
    }

    /// <summary>
    /// 테두리 셀을 우선으로 웨이브 후보 셀 목록 반환.
    /// 테두리 = 그리드 반지름과 같은 거리에 있는 셀.
    /// 테두리에 빈 셀이 부족하면 안쪽 셀도 포함.
    /// </summary>
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

        // 테두리 우선, 부족하면 안쪽 추가
        List<HexCell> result = new List<HexCell>(borderEmpty);
        result.AddRange(innerEmpty);
        return result;
    }
}

/// 웨이브 결과 데이터
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

#### 2.5.2 웨이브 방향 및 애니메이션

파도가 밀려오는 방향은 6방향 중 랜덤 또는 순차적으로 결정된다. 시각적으로 블록이 해당 방향에서 슬라이드 인(slide-in)하는 애니메이션을 적용한다.

```
웨이브 방향 패턴:
  1) 랜덤 방향 - 매번 랜덤한 방향에서 밀려옴
  2) 순환 방향 - E -> NE -> NW -> W -> SW -> SE 순환
  3) 분산 배치 - 모든 방향에서 균등하게 밀려옴 (기본 채택)
```

### 2.6 구현 체크리스트

- [ ] `HexBlock` 클래스 구현 (레벨, 값, 표시 텍스트)
- [ ] `BlockSpawner` 블록 생성 규칙 구현 및 확률 테스트
- [ ] `BlockPlacer` 단일 블록 배치 로직 구현
- [ ] `WaveSystem` 웨이브 생성 시스템 구현
- [ ] 웨이브 블록 수 밸런싱 테이블 튜닝
- [ ] 생성 확률 테이블 밸런싱 테스트
- [ ] 웨이브 방향 결정 및 애니메이션 방향 연동
- [ ] 보드 가득 참 감지 로직 구현

---

## 3. 머지(합치기) 시스템

### 3.1 개요

머지 시스템은 게임의 핵심 인터랙션이다. 플레이어가 같은 숫자를 가진 두 블록을 순서대로 탭하면, 두 번째 탭한 블록 위치에서 합쳐져 두 배 값의 블록이 된다. 인접하지 않아도 같은 값이면 매칭이 가능하다.

### 3.2 탭 기반 매칭 로직

#### 3.2.1 입력 상태 머신

```
[대기 상태] --탭--> [첫 번째 블록 선택] --같은 값 블록 탭--> [머지 실행]
                          |                                        |
                          |--다른 값 블록 탭--> [선택 변경]         |
                          |                       |                |
                          |--빈 셀/같은 블록 탭--> [선택 해제]     |
                          |                                        |
                          +<--- [머지 완료] <--- [웨이브 생성] <---+
```

```csharp
public enum SelectionState
{
    Idle,           // 아무것도 선택되지 않은 대기 상태
    FirstSelected,  // 첫 번째 블록이 선택된 상태
    Processing      // 머지 또는 웨이브 처리 중 (입력 불가)
}

public class MergeInputHandler
{
    private SelectionState state = SelectionState.Idle;
    private HexCell firstSelectedCell = null;

    /// <summary>
    /// 셀 탭 처리. 게임의 메인 입력 핸들러.
    /// </summary>
    public void OnCellTapped(HexCell tappedCell)
    {
        if (state == SelectionState.Processing) return; // 처리 중에는 입력 무시

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
        // 빈 셀 탭 -> 무시
        if (!cell.IsInteractable) return;

        // 블록이 있는 셀 탭 -> 첫 번째 선택
        firstSelectedCell = cell;
        state = SelectionState.FirstSelected;

        // 같은 값의 블록들 하이라이트 표시
        HighlightMatchingBlocks(cell.Block.Value);

        // 이벤트 발생: 선택 효과 표시
        OnBlockSelected?.Invoke(cell);
    }

    private void HandleSecondTap(HexCell cell)
    {
        // 같은 셀을 다시 탭 -> 선택 해제
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

        // 다른 값의 블록 탭 -> 선택 변경
        if (cell.Block.Value != firstSelectedCell.Block.Value)
        {
            ClearSelection();
            HandleIdleTap(cell); // 새로 선택
            return;
        }

        // 같은 값의 블록 탭 -> 머지 실행!
        state = SelectionState.Processing;
        ExecuteMerge(firstSelectedCell, cell);
    }

    private void ClearSelection()
    {
        ClearHighlights();
        firstSelectedCell = null;
        state = SelectionState.Idle;
    }

    // 이벤트 델리게이트
    public System.Action<HexCell> OnBlockSelected;
    public System.Action OnSelectionCleared;
    public System.Action<MergeResult> OnMergeCompleted;
}
```

### 3.3 같은 숫자 탐색 알고리즘

첫 번째 블록이 선택되면, 보드 전체에서 같은 값의 블록을 탐색하여 하이라이트한다. 인접 여부와 관계없이 모든 같은 값 블록이 매칭 대상이다.

```csharp
public class MatchFinder
{
    private HexGrid grid;

    /// <summary>
    /// 특정 값과 같은 값을 가진 모든 블록 셀 반환.
    /// 선택된 셀 자신은 제외한다.
    /// </summary>
    public List<HexCell> FindAllMatchingCells(int value, CubeCoord excludeCoord)
    {
        List<HexCell> matches = new List<HexCell>();

        foreach (var cell in grid.GetOccupiedCells())
        {
            if (cell.Coord.Equals(excludeCoord)) continue;
            if (cell.Block.Value == value)
            {
                matches.Add(cell);
            }
        }

        return matches;
    }

    /// <summary>
    /// 보드에 매칭 가능한 쌍이 하나라도 존재하는지 확인.
    /// 같은 값의 블록이 2개 이상 있으면 매칭 가능.
    /// </summary>
    public bool HasAnyValidMatch()
    {
        Dictionary<int, int> valueCounts = new Dictionary<int, int>();

        foreach (var cell in grid.GetOccupiedCells())
        {
            int value = cell.Block.Value;
            if (valueCounts.ContainsKey(value))
            {
                return true; // 같은 값이 2개 이상 -> 매칭 가능
            }
            valueCounts[value] = 1;
        }

        return false; // 모든 블록이 고유한 값 -> 매칭 불가
    }

    /// <summary>
    /// 각 값별 블록 수를 집계하여 반환.
    /// UI에서 힌트를 표시하거나 AI 분석에 사용.
    /// </summary>
    public Dictionary<int, List<HexCell>> GroupBlocksByValue()
    {
        Dictionary<int, List<HexCell>> groups = new Dictionary<int, List<HexCell>>();

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

### 3.4 머지 실행 프로세스

두 블록이 매칭되었을 때의 머지 실행 흐름이다.

```
[머지 실행 흐름]

1. 두 셀 모두 잠금(Lock) - 추가 입력 방지
2. 첫 번째 블록의 이동 애니메이션 (첫 번째 셀 -> 두 번째 셀)
3. 첫 번째 셀에서 블록 제거
4. 두 번째 블록 레벨 증가 (Value * 2)
5. 머지 이펙트 재생 (파티클, 스케일 펀치 등)
6. 점수 계산 및 추가
7. 연쇄 머지 체크
8. 두 셀 모두 잠금 해제
9. 웨이브 생성
10. 보드 상태 확인
```

```csharp
public class MergeProcessor
{
    private HexGrid grid;
    private ScoreSystem scoreSystem;
    private WaveSystem waveSystem;
    private MatchFinder matchFinder;

    /// <summary>
    /// 머지 실행. 비동기로 애니메이션과 함께 처리된다.
    /// sourceCell의 블록이 targetCell로 이동하여 합쳐진다.
    /// </summary>
    public async UniTask<MergeResult> ExecuteMerge(HexCell sourceCell, HexCell targetCell)
    {
        MergeResult result = new MergeResult();
        result.SourceCoord = sourceCell.Coord;
        result.TargetCoord = targetCell.Coord;
        result.OriginalValue = sourceCell.Block.Value;

        // 1. 셀 잠금
        sourceCell.Lock();
        targetCell.Lock();

        // 2. 이동 애니메이션 (소스 -> 타겟)
        await AnimateBlockMove(sourceCell, targetCell);

        // 3. 소스 셀에서 블록 제거
        HexBlock sourceBlock = sourceCell.RemoveBlock();
        DestroyBlock(sourceBlock);

        // 4. 타겟 블록 레벨 증가
        targetCell.Block.LevelUp();
        result.MergedValue = targetCell.Block.Value;

        // 5. 머지 이펙트
        await PlayMergeEffect(targetCell);

        // 6. 점수 계산
        int earnedScore = scoreSystem.CalculateMergeScore(
            result.MergedValue,
            result.ChainCount
        );
        result.EarnedScore = earnedScore;
        scoreSystem.AddScore(earnedScore);

        // 7. 연쇄 머지 체크 및 실행
        result.ChainResults = await ProcessChainMerge(targetCell, 1);

        // 8. 셀 잠금 해제
        sourceCell.Unlock();
        targetCell.Unlock();

        // 9. 웨이브 생성
        WaveResult waveResult = waveSystem.GenerateWave();
        result.WaveResult = waveResult;

        // 10. 보드 상태 확인
        result.HasValidMoves = matchFinder.HasAnyValidMatch();

        return result;
    }
}

/// 머지 결과 데이터
public class MergeResult
{
    public CubeCoord SourceCoord;       // 소스(이동하는) 블록 좌표
    public CubeCoord TargetCoord;       // 타겟(남는) 블록 좌표
    public int OriginalValue;           // 머지 전 값
    public int MergedValue;             // 머지 후 값
    public int EarnedScore;             // 획득 점수
    public int ChainCount;             // 연쇄 횟수
    public List<ChainResult> ChainResults;  // 연쇄 머지 결과들
    public WaveResult WaveResult;       // 웨이브 결과
    public bool HasValidMoves;          // 머지 후 유효한 수가 있는지
}
```

### 3.5 연쇄 머지(체인) 처리

머지 결과로 생긴 새 값의 블록이 인접 셀에 같은 값의 블록과 만나면 자동으로 연쇄 머지가 발생한다. 연쇄 머지는 인접한 경우에만 발동된다.

```csharp
public class ChainProcessor
{
    private HexGrid grid;

    /// <summary>
    /// 연쇄 머지 처리.
    /// 머지 후 타겟 셀 주변에 같은 값의 인접 블록이 있으면 자동 머지.
    /// 연쇄는 인접 셀에서만 발생한다.
    /// </summary>
    public async UniTask<List<ChainResult>> ProcessChainMerge(
        HexCell mergedCell,
        int currentChainDepth)
    {
        List<ChainResult> chainResults = new List<ChainResult>();

        // 최대 연쇄 깊이 제한 (무한 루프 방지)
        const int MAX_CHAIN_DEPTH = 20;
        if (currentChainDepth >= MAX_CHAIN_DEPTH) return chainResults;

        // 인접 셀에서 같은 값의 블록 탐색
        List<HexCell> adjacentMatches = HexDirection.GetMatchingNeighbors(
            mergedCell.Coord,
            mergedCell.Block.Value,
            grid
        );

        if (adjacentMatches.Count == 0) return chainResults;

        // 인접한 같은 값 블록들을 순차적으로 머지
        // (가장 가까운 것부터, 또는 시계 방향 순으로)
        foreach (var adjacentCell in adjacentMatches)
        {
            if (adjacentCell.State != CellState.Occupied) continue;
            if (adjacentCell.Block.Value != mergedCell.Block.Value) continue;

            // 연쇄 머지 실행
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

            // 재귀적으로 다음 연쇄 체크
            var deeperChains = await ProcessChainMerge(
                mergedCell,
                currentChainDepth + 1
            );
            chainResults.AddRange(deeperChains);

            // 중요: 연쇄 중 값이 변했으므로 남은 인접 블록은 다시 체크해야 함
            // -> 재귀가 이를 처리함
            break; // 한 번에 하나씩 연쇄 처리 (값이 바뀌므로)
        }

        return chainResults;
    }
}

/// 연쇄 머지 개별 결과
public class ChainResult
{
    public int ChainDepth;          // 연쇄 깊이 (1부터)
    public CubeCoord AbsorbedCoord; // 흡수된 블록의 좌표
    public CubeCoord ResultCoord;   // 결과 블록의 좌표
    public int ResultValue;         // 연쇄 머지 후 값
}
```

#### 3.5.1 연쇄 머지 시각 예시

```
상황: 타겟 위치에 4가 생성되었고, 인접에 4가 있는 경우

  [2] [4] [8]          [2] [_] [8]          [2] [_] [8]
    [4] [2]     ->       [8] [2]     ->       [16] [2]
  [8] [4] [2]          [8] [4] [2]          [8] [_] [2]

  (4+4=8 머지)        (인접 4와 8 연쇄)     (인접 8과 없음, 종료)
                       -> 8+8=16!
```

### 3.6 머지 결과 계산 요약

```
머지 결과 = {
    합쳐진 값: 원래 값 * 2^(1 + 연쇄횟수)
    예시:
      2 + 2 = 4                    (연쇄 없음)
      2 + 2 = 4, 4 + 4 = 8        (1회 연쇄)
      2 + 2 = 4, 4 + 4 = 8, 8 + 8 = 16  (2회 연쇄)
}
```

### 3.7 구현 체크리스트

- [ ] `SelectionState` 상태 열거형 및 `MergeInputHandler` 구현
- [ ] 첫 번째 탭 / 두 번째 탭 / 선택 해제 로직 구현
- [ ] `MatchFinder` 같은 값 블록 전체 탐색 구현
- [ ] `MatchFinder.HasAnyValidMatch()` 유효 수 확인 구현
- [ ] `MergeProcessor.ExecuteMerge()` 머지 실행 파이프라인 구현
- [ ] 블록 이동 애니메이션 연동 (DOTween 또는 Unity Animation)
- [ ] `ChainProcessor` 연쇄 머지 로직 구현 및 재귀 안전성 테스트
- [ ] 머지 이펙트 (파티클, 사운드) 트리거 연동
- [ ] 머지 후 웨이브 생성 연동
- [ ] 하이라이트/힌트 시스템 구현 (선택 시 같은 값 블록 표시)

---

## 4. 스코어링 시스템

### 4.1 개요

점수 시스템은 플레이어의 진행도를 측정하고 리더보드 경쟁의 기반이 된다. 머지할 때마다 점수가 누적되며, 높은 값의 머지와 연쇄 머지에 보너스가 부여된다.

### 4.2 점수 계산 공식

#### 4.2.1 기본 머지 점수

```
기본 점수 = 머지 결과 값

예시:
  2 + 2 = 4    ->  기본 점수 = 4
  32 + 32 = 64 ->  기본 점수 = 64
  1024 + 1024 = 2048 -> 기본 점수 = 2048
```

#### 4.2.2 연쇄(체인) 보너스

연쇄 머지가 발생하면 각 연쇄 단계마다 보너스 배율이 적용된다.

```
연쇄 보너스 배율 = 1.0 + (chainDepth * 0.5)

연쇄 단계별 배율:
  연쇄 0단계 (일반 머지): x1.0
  연쇄 1단계: x1.5
  연쇄 2단계: x2.0
  연쇄 3단계: x2.5
  ...
```

```
연쇄 점수 = 각 연쇄 결과 값 * 연쇄 보너스 배율

예시 (2+2=4 -> 4+4=8 -> 8+8=16):
  1단계: 4  * 1.0 = 4
  2단계: 8  * 1.5 = 12
  3단계: 16 * 2.0 = 32
  총 획득 점수 = 4 + 12 + 32 = 48
```

#### 4.2.3 마일스톤 보너스

특정 값의 블록을 처음 달성할 때 추가 보너스를 부여한다.

| 달성 값 | 보너스 점수 | 설명 |
|---------|------------|------|
| 128 | 500 | 첫 128 달성 |
| 256 | 1,000 | 첫 256 달성 |
| 512 | 2,500 | 첫 512 달성 |
| 1024 | 5,000 | 첫 1K 달성 |
| 2048 | 10,000 | 첫 2K 달성 |
| 4096 | 25,000 | 첫 4K 달성 |
| 8192 | 50,000 | 첫 8K 달성 |

### 4.3 스코어링 시스템 구현

```csharp
public class ScoreSystem
{
    private int currentScore = 0;
    private int highScore = 0;
    private int highestBlockValue = 0; // 역대 최고 블록 값
    private HashSet<int> achievedMilestones = new HashSet<int>();

    // 마일스톤 보너스 테이블
    private static readonly Dictionary<int, int> MilestoneBonuses = new Dictionary<int, int>
    {
        { 128,   500 },
        { 256,   1000 },
        { 512,   2500 },
        { 1024,  5000 },
        { 2048,  10000 },
        { 4096,  25000 },
        { 8192,  50000 },
        { 16384, 100000 },
    };

    // 이벤트
    public System.Action<int> OnScoreChanged;          // 점수 변경 시
    public System.Action<int> OnHighScoreChanged;       // 최고 점수 갱신 시
    public System.Action<int, int> OnMilestoneAchieved; // 마일스톤 달성 시 (값, 보너스)

    /// <summary>
    /// 머지 점수 계산.
    /// </summary>
    /// <param name="mergedValue">머지 결과 값</param>
    /// <param name="chainDepth">연쇄 깊이 (0 = 일반 머지)</param>
    /// <returns>획득 점수</returns>
    public int CalculateMergeScore(int mergedValue, int chainDepth)
    {
        // 기본 점수
        float baseScore = mergedValue;

        // 연쇄 보너스 배율
        float chainMultiplier = 1.0f + (chainDepth * 0.5f);

        // 최종 점수 (소수점 버림)
        int finalScore = Mathf.FloorToInt(baseScore * chainMultiplier);

        return finalScore;
    }

    /// <summary>
    /// 점수 추가 및 관련 처리.
    /// </summary>
    public void AddScore(int amount)
    {
        currentScore += amount;
        OnScoreChanged?.Invoke(currentScore);

        // 최고 점수 갱신 체크
        if (currentScore > highScore)
        {
            highScore = currentScore;
            OnHighScoreChanged?.Invoke(highScore);
            SaveHighScore();
        }
    }

    /// <summary>
    /// 마일스톤 체크. 새로운 최고 블록 값 달성 시 호출.
    /// </summary>
    public int CheckMilestone(int blockValue)
    {
        int bonusScore = 0;

        if (blockValue > highestBlockValue)
        {
            highestBlockValue = blockValue;

            // 사이에 있는 모든 마일스톤 체크 (한 번에 여러 단계 건너뛸 수 있음)
            foreach (var milestone in MilestoneBonuses)
            {
                if (milestone.Key <= blockValue && !achievedMilestones.Contains(milestone.Key))
                {
                    achievedMilestones.Add(milestone.Key);
                    bonusScore += milestone.Value;
                    OnMilestoneAchieved?.Invoke(milestone.Key, milestone.Value);
                }
            }

            if (bonusScore > 0)
            {
                AddScore(bonusScore);
            }
        }

        return bonusScore;
    }

    /// 현재 점수 반환
    public int GetCurrentScore() => currentScore;

    /// 최고 점수 반환
    public int GetHighScore() => highScore;

    /// 게임 재시작 시 점수 초기화
    public void ResetCurrentScore()
    {
        currentScore = 0;
        OnScoreChanged?.Invoke(currentScore);
    }

    /// 최고 점수 저장 (PlayerPrefs 사용)
    private void SaveHighScore()
    {
        PlayerPrefs.SetInt("HighScore", highScore);
        PlayerPrefs.Save();
    }

    /// 최고 점수 로드
    public void LoadHighScore()
    {
        highScore = PlayerPrefs.GetInt("HighScore", 0);
    }
}
```

### 4.4 최고 점수 저장

최고 점수는 두 가지 경로로 저장된다.

```
1. 로컬 저장 (오프라인)
   - Unity PlayerPrefs 사용
   - 키: "HighScore" (정수)
   - 게임 종료/일시정지 시마다 저장
   - 앱 삭제 시 데이터 소실

2. 클라우드 저장 (온라인, 확장 시)
   - Firebase Realtime Database 또는 PlayFab
   - 사용자 인증 후 서버에 저장
   - 기기 변경 시에도 유지
```

### 4.5 리더보드 연동 구조

```csharp
/// <summary>
/// 리더보드 인터페이스.
/// 플랫폼별 구현을 교체할 수 있도록 인터페이스로 추상화.
/// </summary>
public interface ILeaderboardService
{
    /// 점수 제출
    UniTask<bool> SubmitScore(string leaderboardId, int score);

    /// 상위 N명의 점수 조회
    UniTask<List<LeaderboardEntry>> GetTopScores(string leaderboardId, int count);

    /// 내 주변 순위 조회
    UniTask<List<LeaderboardEntry>> GetNearbyScores(string leaderboardId, int range);

    /// 내 순위 조회
    UniTask<int> GetMyRank(string leaderboardId);
}

/// 리더보드 항목
public class LeaderboardEntry
{
    public string PlayerId;
    public string PlayerName;
    public int Score;
    public int Rank;
    public long Timestamp;
}

/// 리더보드 ID 상수
public static class LeaderboardIds
{
    public const string HIGHEST_SCORE = "leaderboard_highest_score";
    public const string HIGHEST_BLOCK = "leaderboard_highest_block";
    public const string WEEKLY_SCORE = "leaderboard_weekly_score";
}
```

#### 4.5.1 리더보드 플랫폼별 구현 계획

```
[WebGL]
  - Firebase Realtime Database 또는 자체 백엔드 API
  - 닉네임 기반 (익명 가능)
  - REST API로 점수 제출/조회

[Android]
  - Google Play Games Services 리더보드
  - Google 계정 연동
  - GPG API를 통한 점수 제출/조회

[공통]
  - ILeaderboardService 인터페이스를 통한 추상화
  - 플랫폼별 구현체 DI(의존성 주입)로 교체
```

### 4.6 구현 체크리스트

- [ ] `ScoreSystem` 기본 구조 구현
- [ ] 머지 점수 계산 공식 구현 및 단위 테스트
- [ ] 연쇄 보너스 배율 적용 테스트
- [ ] 마일스톤 보너스 시스템 구현
- [ ] PlayerPrefs 기반 최고 점수 저장/로드
- [ ] 점수 UI 연동 (현재 점수, 최고 점수)
- [ ] 점수 변경 애니메이션 (카운트업 효과)
- [ ] `ILeaderboardService` 인터페이스 정의
- [ ] WebGL용 리더보드 서비스 구현 (Firebase)
- [ ] Android용 리더보드 서비스 구현 (Google Play Games)
- [ ] 리더보드 UI 화면 구현

---

## 5. 게임 상태 관리

### 5.1 개요

게임 상태 관리는 게임의 전체 생명 주기를 제어한다. 메뉴, 플레이, 일시정지 등의 상태 전환과 저장/로드, 게임 루프를 포함한다. 게임오버가 없는 무한 플레이 구조이므로, 전통적인 게임오버 상태 대신 "매칭 불가" 상태에서의 리셔플(재배치) 메커니즘을 포함한다.

### 5.2 게임 루프

```
[게임 루프 흐름도]

                    +---> [입력 대기] <---+
                    |         |           |
                    |    [블록 탭 감지]    |
                    |         |           |
                    |    [매칭 판정]       |
                    |     /       \       |
                    |   실패      성공     |
                    |    |         |       |
                    |  [선택해제]  [머지 실행]
                    |    |         |       |
                    +----+    [점수 계산]  |
                              |           |
                         [연쇄 체크]       |
                          /       \       |
                        있음      없음     |
                         |         |       |
                     [연쇄 머지]   |       |
                         |         |       |
                     [웨이브 생성]---------+
                         |
                    [보드 체크]
                     /       \
                   여유      가득 참
                    |         |
                    +    [매칭 가능 체크]
                          /         \
                        있음        없음
                         |           |
                         +      [리셔플]
                                   |
                              [계속 플레이]
```

```csharp
public class GameLoop : MonoBehaviour
{
    private HexGrid grid;
    private MergeInputHandler inputHandler;
    private MergeProcessor mergeProcessor;
    private WaveSystem waveSystem;
    private ScoreSystem scoreSystem;
    private GameStateManager stateManager;

    private void Update()
    {
        if (stateManager.CurrentState != GameState.Playing) return;

        // 입력은 이벤트 기반으로 처리됨 (Update에서 폴링하지 않음)
        // MergeInputHandler가 터치/클릭 이벤트를 받아 처리
    }

    /// <summary>
    /// 머지 완료 후 콜백. 전체 게임 루프의 핵심 흐름.
    /// </summary>
    private async void OnMergeCompleted(MergeResult result)
    {
        // 1. 점수 갱신은 MergeProcessor에서 이미 처리됨

        // 2. 마일스톤 체크
        scoreSystem.CheckMilestone(result.MergedValue);

        // 3. 웨이브 결과 처리 (애니메이션 대기)
        await PlayWaveAnimation(result.WaveResult);

        // 4. 보드 상태 확인
        if (!result.HasValidMoves)
        {
            // 매칭 가능한 수가 없음 -> 리셔플
            await PerformReshuffle();
        }

        // 5. 자동 저장
        SaveGameState();

        // 6. 입력 재활성화
        inputHandler.SetState(SelectionState.Idle);
    }

    /// <summary>
    /// 리셔플: 보드에 매칭 가능한 쌍이 없을 때 블록들을 재배치.
    /// 게임오버 없이 계속 플레이할 수 있게 한다.
    /// </summary>
    private async UniTask PerformReshuffle()
    {
        // 리셔플 알림 UI 표시
        UIManager.Instance.ShowReshuffleNotice();

        // 현재 블록들의 값 목록 수집
        List<int> blockValues = new List<int>();
        foreach (var cell in grid.GetOccupiedCells())
        {
            blockValues.Add(cell.Block.Level);
            cell.RemoveBlock();
        }

        // 셔플
        ShuffleList(blockValues);

        // 같은 값끼리 인접하도록 재배치 시도
        await RearrangeBlocksWithMatches(blockValues);
    }
}
```

### 5.3 상태 머신 (Game State Machine)

```
[상태 전이 다이어그램]

  [앱 시작] --> [로딩] --> [메인 메뉴]
                              |
                    +---------+---------+
                    |                   |
              [새 게임 시작]       [이어하기]
                    |                   |
                    +----> [플레이] <----+
                              |
                    +---------+---------+
                    |                   |
              [일시정지 버튼]      [앱 백그라운드]
                    |                   |
                    +-> [일시정지] <-----+
                          |
                +---------+---------+
                |                   |
           [계속하기]          [메인 메뉴로]
                |                   |
           [플레이]           [메인 메뉴]
```

```csharp
public enum GameState
{
    Loading,        // 리소스 로딩 중
    MainMenu,       // 메인 메뉴 화면
    Playing,        // 게임 플레이 중
    Paused,         // 일시정지
    Reshuffling,    // 리셔플 애니메이션 중
    Tutorial        // 튜토리얼 진행 중
}

public class GameStateManager
{
    public GameState CurrentState { get; private set; }
    public GameState PreviousState { get; private set; }

    // 상태 변경 이벤트
    public System.Action<GameState, GameState> OnStateChanged; // (이전, 현재)

    // 상태별 진입/이탈 콜백 맵
    private Dictionary<GameState, System.Action> enterCallbacks = new();
    private Dictionary<GameState, System.Action> exitCallbacks = new();

    /// <summary>
    /// 상태 전환. 유효하지 않은 전환은 거부한다.
    /// </summary>
    public bool TransitionTo(GameState newState)
    {
        if (!IsValidTransition(CurrentState, newState))
        {
            Debug.LogWarning($"유효하지 않은 상태 전환: {CurrentState} -> {newState}");
            return false;
        }

        PreviousState = CurrentState;

        // 현재 상태 이탈 콜백
        if (exitCallbacks.ContainsKey(CurrentState))
            exitCallbacks[CurrentState]?.Invoke();

        CurrentState = newState;

        // 새 상태 진입 콜백
        if (enterCallbacks.ContainsKey(newState))
            enterCallbacks[newState]?.Invoke();

        OnStateChanged?.Invoke(PreviousState, CurrentState);
        return true;
    }

    /// <summary>
    /// 유효한 상태 전환인지 검증.
    /// </summary>
    private bool IsValidTransition(GameState from, GameState to)
    {
        // 허용된 전환 목록
        return (from, to) switch
        {
            (GameState.Loading, GameState.MainMenu) => true,
            (GameState.Loading, GameState.Tutorial) => true,
            (GameState.MainMenu, GameState.Playing) => true,
            (GameState.MainMenu, GameState.Tutorial) => true,
            (GameState.Playing, GameState.Paused) => true,
            (GameState.Playing, GameState.Reshuffling) => true,
            (GameState.Playing, GameState.MainMenu) => true,
            (GameState.Paused, GameState.Playing) => true,
            (GameState.Paused, GameState.MainMenu) => true,
            (GameState.Reshuffling, GameState.Playing) => true,
            (GameState.Tutorial, GameState.Playing) => true,
            (GameState.Tutorial, GameState.MainMenu) => true,
            _ => false,
        };
    }

    /// 상태별 콜백 등록
    public void RegisterEnterCallback(GameState state, System.Action callback)
    {
        enterCallbacks[state] = callback;
    }

    public void RegisterExitCallback(GameState state, System.Action callback)
    {
        exitCallbacks[state] = callback;
    }
}
```

### 5.4 세이브/로드 시스템

오프라인 플레이를 지원하므로, 게임 진행 상태를 로컬에 저장하여 언제든 이어서 플레이할 수 있어야 한다.

#### 5.4.1 저장 데이터 구조

```csharp
/// <summary>
/// 게임 세이브 데이터.
/// JSON 직렬화하여 로컬 파일에 저장한다.
/// </summary>
[System.Serializable]
public class GameSaveData
{
    // 버전 정보 (호환성 관리)
    public int saveVersion = 1;
    public string gameVersion;
    public long savedTimestamp; // Unix timestamp

    // 보드 상태
    public int gridRadius;
    public List<CellSaveData> cells = new List<CellSaveData>();

    // 점수 상태
    public int currentScore;
    public int highScore;
    public int highestBlockValue;
    public List<int> achievedMilestones = new List<int>();

    // 게임 진행 상태
    public int totalMergeCount;     // 누적 머지 횟수
    public int totalPlayTimeSeconds; // 누적 플레이 시간
    public int sessionCount;         // 세션 수

    // 설정
    public bool soundEnabled;
    public bool musicEnabled;
    public bool vibrationEnabled;
}

[System.Serializable]
public class CellSaveData
{
    public int col;     // 오프셋 좌표 열
    public int row;     // 오프셋 좌표 행
    public int blockLevel; // 블록 레벨 (0이면 빈 셀)
}
```

#### 5.4.2 세이브/로드 매니저

```csharp
public class SaveManager
{
    private const string SAVE_FILE_NAME = "hexa_merge_save.json";
    private const int CURRENT_SAVE_VERSION = 1;

    /// <summary>
    /// 현재 게임 상태를 저장.
    /// 자동 저장: 머지 후, 일시정지 시, 앱 백그라운드 전환 시 호출.
    /// </summary>
    public bool SaveGame(HexGrid grid, ScoreSystem scoreSystem, GameStats stats)
    {
        try
        {
            GameSaveData data = new GameSaveData();
            data.saveVersion = CURRENT_SAVE_VERSION;
            data.gameVersion = Application.version;
            data.savedTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds();

            // 그리드 상태 직렬화
            data.gridRadius = grid.Radius;
            foreach (var cell in grid.GetAllCells())
            {
                OffsetCoord offset = CoordConverter.CubeToOffset(cell.Coord);
                CellSaveData cellData = new CellSaveData
                {
                    col = offset.col,
                    row = offset.row,
                    blockLevel = (cell.State == CellState.Occupied) ? cell.Block.Level : 0
                };
                data.cells.Add(cellData);
            }

            // 점수 직렬화
            data.currentScore = scoreSystem.GetCurrentScore();
            data.highScore = scoreSystem.GetHighScore();

            // 통계
            data.totalMergeCount = stats.TotalMergeCount;
            data.totalPlayTimeSeconds = stats.TotalPlayTimeSeconds;

            // JSON으로 변환 및 파일 저장
            string json = JsonUtility.ToJson(data, true);
            string path = GetSavePath();
            System.IO.File.WriteAllText(path, json);

            Debug.Log($"게임 저장 완료: {path}");
            return true;
        }
        catch (System.Exception e)
        {
            Debug.LogError($"게임 저장 실패: {e.Message}");
            return false;
        }
    }

    /// <summary>
    /// 저장된 게임 데이터 로드.
    /// </summary>
    public GameSaveData LoadGame()
    {
        string path = GetSavePath();

        if (!System.IO.File.Exists(path))
        {
            Debug.Log("저장 파일 없음. 새 게임 시작.");
            return null;
        }

        try
        {
            string json = System.IO.File.ReadAllText(path);
            GameSaveData data = JsonUtility.FromJson<GameSaveData>(json);

            // 버전 호환성 체크
            if (data.saveVersion != CURRENT_SAVE_VERSION)
            {
                data = MigrateSaveData(data);
            }

            Debug.Log($"게임 로드 완료. 점수: {data.currentScore}");
            return data;
        }
        catch (System.Exception e)
        {
            Debug.LogError($"게임 로드 실패: {e.Message}");
            return null;
        }
    }

    /// 저장 파일 존재 여부 확인
    public bool HasSaveData()
    {
        return System.IO.File.Exists(GetSavePath());
    }

    /// 저장 데이터 삭제
    public void DeleteSaveData()
    {
        string path = GetSavePath();
        if (System.IO.File.Exists(path))
        {
            System.IO.File.Delete(path);
        }
    }

    /// 플랫폼별 저장 경로
    private string GetSavePath()
    {
        return System.IO.Path.Combine(Application.persistentDataPath, SAVE_FILE_NAME);
    }

    /// 구버전 세이브 데이터 마이그레이션
    private GameSaveData MigrateSaveData(GameSaveData oldData)
    {
        // 버전별 마이그레이션 로직
        // 현재는 v1만 존재하므로 그대로 반환
        oldData.saveVersion = CURRENT_SAVE_VERSION;
        return oldData;
    }
}
```

### 5.5 오프라인 데이터 관리

```
[오프라인 데이터 관리 전략]

1. 로컬 우선 원칙
   - 모든 게임 데이터는 로컬에 먼저 저장
   - 네트워크 연결 시 서버와 동기화
   - 오프라인에서도 완벽하게 플레이 가능

2. 자동 저장 타이밍
   - 매 머지 완료 후
   - 일시정지 시
   - 앱이 백그라운드로 전환될 때 (OnApplicationPause)
   - 앱 종료 시 (OnApplicationQuit)

3. 데이터 동기화 (온라인 복귀 시)
   - 로컬 최고 점수와 서버 최고 점수 비교
   - 높은 쪽을 양쪽에 동기화
   - 충돌 시 높은 점수 우선 (last-write-wins 아님)

4. 저장 위치
   - Unity Application.persistentDataPath 사용
   - Android: /data/data/[패키지명]/files/
   - WebGL: IndexedDB (브라우저 로컬 스토리지)
```

```csharp
public class OfflineDataManager
{
    private SaveManager saveManager;
    private ILeaderboardService leaderboard;
    private bool pendingSync = false;

    /// <summary>
    /// 앱 포커스 변경 시 호출.
    /// 백그라운드 전환 시 자동 저장, 포그라운드 복귀 시 동기화.
    /// </summary>
    public void OnApplicationPause(bool isPaused)
    {
        if (isPaused)
        {
            // 백그라운드로 전환 -> 즉시 저장
            saveManager.SaveGame(/* ... */);
            pendingSync = true;
        }
        else
        {
            // 포그라운드 복귀 -> 동기화 시도
            if (pendingSync)
            {
                TrySyncWithServer();
                pendingSync = false;
            }
        }
    }

    /// <summary>
    /// 서버와 동기화 시도.
    /// 네트워크 불가 시 조용히 실패 (다음 기회에 재시도).
    /// </summary>
    private async void TrySyncWithServer()
    {
        if (Application.internetReachability == NetworkReachability.NotReachable)
            return;

        try
        {
            int localHighScore = saveManager.LoadGame()?.highScore ?? 0;
            int serverRank = await leaderboard.GetMyRank(LeaderboardIds.HIGHEST_SCORE);

            // 로컬 점수를 서버에 제출
            await leaderboard.SubmitScore(LeaderboardIds.HIGHEST_SCORE, localHighScore);
        }
        catch (System.Exception e)
        {
            Debug.LogWarning($"서버 동기화 실패 (다음 기회에 재시도): {e.Message}");
        }
    }
}
```

### 5.6 구현 체크리스트

- [ ] `GameLoop` 메인 게임 루프 구현
- [ ] `GameStateManager` 상태 머신 구현 및 전환 테스트
- [ ] 상태별 진입/이탈 콜백 시스템 구현
- [ ] `GameSaveData` 직렬화 데이터 구조 정의
- [ ] `SaveManager` 세이브/로드 구현 및 테스트
- [ ] JSON 직렬화/역직렬화 안정성 테스트
- [ ] 세이브 데이터 버전 관리 및 마이그레이션 구조
- [ ] 자동 저장 타이밍 구현 (머지 후, 일시정지, 백그라운드)
- [ ] `OfflineDataManager` 오프라인 동기화 구현
- [ ] WebGL IndexedDB 저장 호환성 테스트
- [ ] Android persistentDataPath 저장 테스트
- [ ] 리셔플 로직 구현 (매칭 불가 시 블록 재배치)
- [ ] OnApplicationPause / OnApplicationQuit 처리

---

## 6. 기술 스택 및 아키텍처

### 6.1 기술 스택

| 구분 | 기술 | 버전/비고 |
|------|------|----------|
| **엔진** | Unity | 2022.3 LTS (WebGL + Android) |
| **언어** | C# | .NET Standard 2.1 |
| **비동기** | UniTask | Cysharp/UniTask (코루틴 대체) |
| **애니메이션** | DOTween | 트윈 애니메이션 |
| **UI** | Unity UI (uGUI) | Canvas 기반 |
| **오디오** | Unity AudioMixer | 효과음 + 배경음 |
| **광고** | Google AdMob | 리워드 광고, 전면 광고 |
| **인앱결제** | Unity IAP | Android 결제 |
| **분석** | Firebase Analytics | 사용자 행동 분석 |
| **리더보드(Web)** | Firebase RTDB | 웹용 리더보드 |
| **리더보드(Android)** | Google Play Games | 안드로이드용 리더보드 |
| **빌드** | Unity Cloud Build | CI/CD |

### 6.2 Unity 프로젝트 구조

```
Assets/
├── _Project/                      # 프로젝트 메인 폴더
│   ├── Scripts/
│   │   ├── Core/                  # 코어 게임 로직
│   │   │   ├── Grid/
│   │   │   │   ├── CubeCoord.cs           # 큐브 좌표 구조체
│   │   │   │   ├── OffsetCoord.cs         # 오프셋 좌표 구조체
│   │   │   │   ├── CoordConverter.cs      # 좌표 변환 유틸리티
│   │   │   │   ├── HexCell.cs             # 셀 데이터 클래스
│   │   │   │   ├── HexGrid.cs            # 그리드 관리 클래스
│   │   │   │   └── HexDirection.cs        # 방향 및 인접 탐색
│   │   │   ├── Block/
│   │   │   │   ├── HexBlock.cs            # 블록 데이터 클래스
│   │   │   │   ├── BlockSpawner.cs        # 블록 생성 규칙
│   │   │   │   ├── BlockPlacer.cs         # 블록 배치 로직
│   │   │   │   └── WaveSystem.cs          # 파도 웨이브 시스템
│   │   │   ├── Merge/
│   │   │   │   ├── MergeInputHandler.cs   # 탭 입력 처리
│   │   │   │   ├── MatchFinder.cs         # 매칭 탐색
│   │   │   │   ├── MergeProcessor.cs      # 머지 실행
│   │   │   │   └── ChainProcessor.cs      # 연쇄 머지 처리
│   │   │   ├── Score/
│   │   │   │   ├── ScoreSystem.cs         # 점수 계산 및 관리
│   │   │   │   └── MilestoneManager.cs    # 마일스톤 보너스
│   │   │   └── State/
│   │   │       ├── GameLoop.cs            # 메인 게임 루프
│   │   │       ├── GameStateManager.cs    # 상태 머신
│   │   │       └── GameStats.cs           # 게임 통계
│   │   │
│   │   ├── Data/                  # 데이터 관리
│   │   │   ├── SaveManager.cs             # 세이브/로드
│   │   │   ├── GameSaveData.cs            # 저장 데이터 구조
│   │   │   └── OfflineDataManager.cs      # 오프라인 데이터
│   │   │
│   │   ├── View/                  # 시각 표현 (MVC의 View)
│   │   │   ├── HexCellView.cs             # 셀 시각 표현
│   │   │   ├── HexBlockView.cs            # 블록 시각 표현
│   │   │   ├── GridRenderer.cs            # 그리드 렌더링
│   │   │   └── EffectController.cs        # 이펙트 관리
│   │   │
│   │   ├── UI/                    # UI 관련
│   │   │   ├── Screens/
│   │   │   │   ├── MainMenuScreen.cs      # 메인 메뉴
│   │   │   │   ├── GamePlayScreen.cs      # 게임 플레이 HUD
│   │   │   │   ├── PauseScreen.cs         # 일시정지 팝업
│   │   │   │   └── LeaderboardScreen.cs   # 리더보드 화면
│   │   │   ├── Components/
│   │   │   │   ├── ScoreDisplay.cs        # 점수 표시
│   │   │   │   └── ComboDisplay.cs        # 콤보 표시
│   │   │   └── UIManager.cs               # UI 전체 관리
│   │   │
│   │   ├── Audio/                 # 오디오 관리
│   │   │   ├── AudioManager.cs            # 사운드 관리
│   │   │   └── SoundBank.cs              # 효과음 데이터
│   │   │
│   │   ├── Services/              # 외부 서비스 연동
│   │   │   ├── ILeaderboardService.cs     # 리더보드 인터페이스
│   │   │   ├── FirebaseLeaderboard.cs     # Firebase 구현
│   │   │   ├── GPGLeaderboard.cs          # Google Play Games 구현
│   │   │   ├── AdManager.cs              # 광고 관리
│   │   │   └── AnalyticsManager.cs        # 분석 이벤트
│   │   │
│   │   └── Utils/                 # 유틸리티
│   │       ├── Singleton.cs               # 싱글톤 베이스
│   │       ├── ObjectPool.cs             # 오브젝트 풀링
│   │       └── Extensions.cs             # 확장 메서드
│   │
│   ├── Prefabs/                   # 프리팹
│   │   ├── HexCell.prefab                # 셀 프리팹
│   │   ├── HexBlock.prefab               # 블록 프리팹
│   │   └── Effects/                      # 이펙트 프리팹
│   │
│   ├── ScriptableObjects/         # 설정 데이터
│   │   ├── GridConfig.asset              # 그리드 설정
│   │   ├── BlockColorTable.asset         # 블록 색상 테이블
│   │   ├── WaveConfig.asset              # 웨이브 설정
│   │   └── ScoreConfig.asset             # 점수 설정
│   │
│   ├── Scenes/
│   │   ├── BootScene.unity               # 초기화 씬
│   │   └── GameScene.unity               # 메인 게임 씬
│   │
│   ├── Art/                       # 아트 에셋
│   │   ├── Sprites/                      # 2D 스프라이트
│   │   ├── Fonts/                        # 폰트
│   │   └── Materials/                    # 머티리얼
│   │
│   └── Audio/                     # 오디오 에셋
│       ├── SFX/                          # 효과음
│       └── BGM/                          # 배경음악
│
├── Plugins/                       # 서드파티 플러그인
│   ├── UniTask/
│   ├── DOTween/
│   └── GoogleMobileAds/
│
└── StreamingAssets/                # 런타임 데이터
```

### 6.3 주요 클래스 다이어그램 (텍스트 형태)

```
[클래스 의존성 다이어그램]

                          +------------------+
                          |   GameManager    |  (싱글톤, 앱 생명주기)
                          | (MonoBehaviour)  |
                          +--------+---------+
                                   |
                    +--------------+--------------+
                    |                             |
           +--------+--------+          +---------+---------+
           | GameStateManager |          |    SaveManager    |
           | (상태 머신)       |          | (세이브/로드)      |
           +--------+--------+          +---------+---------+
                    |                             |
                    v                             v
           +--------+--------+          +---------+---------+
           |    GameLoop     |          |   GameSaveData    |
           | (게임 루프)      |          | (직렬화 데이터)    |
           +--------+--------+          +-------------------+
                    |
       +------------+------------+------------------+
       |            |            |                  |
+------+------+ +---+---+ +-----+------+  +--------+-------+
|   HexGrid   | | Score | |   Merge    |  |     Wave       |
|  (그리드)    | | System| | Processor  |  |    System      |
+------+------+ +---+---+ +-----+------+  +--------+-------+
       |            |            |                  |
       v            v            v                  v
+------+------+ +---+---+ +-----+------+  +--------+-------+
|   HexCell   | |Leader-| |   Match    |  |   Block        |
|  (셀 데이터) | | board | |   Finder   |  |   Spawner      |
+------+------+ +-------+ +-----+------+  +--------+-------+
       |                         |                  |
       v                         v                  v
+------+------+          +------+------+   +--------+-------+
|  HexBlock   |          |   Chain     |   |   HexBlock     |
| (블록 데이터)|          | Processor   |   | (생성된 블록)   |
+-------------+          +-------------+   +----------------+


[View 레이어 (시각 표현)]

+-------------------+     +-------------------+     +-------------------+
|  HexCellView     |     |  HexBlockView    |     | EffectController  |
| (셀 시각화)       |     | (블록 시각화)     |     | (이펙트 관리)      |
+-------------------+     +-------------------+     +-------------------+
        |                         |                         |
        +-------------------------+-------------------------+
                                  |
                          +-------+-------+
                          | GridRenderer  |
                          | (그리드 렌더링)|
                          +---------------+


[서비스 레이어 (외부 연동)]

+-------------------+     +-------------------+     +-------------------+
| ILeaderboard     |     |   AdManager      |     |  Analytics        |
|   Service        |     | (광고 관리)       |     |   Manager         |
+--------+---------+     +-------------------+     +-------------------+
         |
    +----+----+
    |         |
+---+---+ +---+---+
|Firebase| | GPG   |
|Leader- | |Leader-|
| board  | | board |
+--------+ +-------+
```

### 6.4 데이터 흐름도

```
[입력에서 렌더링까지의 데이터 흐름]

+-------------+     +------------------+     +------------------+
|   Input     | --> | MergeInputHandler| --> | MergeProcessor   |
| (터치/클릭)  |     | (입력 해석)       |     | (머지 로직 실행)  |
+-------------+     +------------------+     +--------+---------+
                                                      |
                         +----------------------------+
                         |
            +------------+------------+------------------+
            |            |            |                  |
            v            v            v                  v
      +-----+----+ +----+----+ +-----+------+  +--------+-------+
      | HexGrid  | | Score   | |   Chain    |  |     Wave       |
      | (상태변경)| | System  | | Processor  |  |    System      |
      +-----+----+ +----+----+ +-----+------+  +--------+-------+
            |            |            |                  |
            v            v            v                  v
      +-----+----+ +----+----+ +-----+------+  +--------+-------+
      |GridRender| | ScoreUI | |  Effect    |  |  BlockView     |
      | (갱신)   | | (갱신)  | | Controller |  |  (생성/이동)    |
      +----------+ +---------+ +------------+  +----------------+


[세이브/로드 데이터 흐름]

+-------------+     +------------------+     +------------------+
|  HexGrid   | --> |   SaveManager    | --> |  JSON 파일       |
|  (런타임)   |     | (직렬화)         |     | (persistentData) |
+-------------+     +------------------+     +------------------+
|  ScoreSystem|                                      |
+-------------+                                      |
                                                     v
+-------------+     +------------------+     +------------------+
|  HexGrid   | <-- |   SaveManager    | <-- |  JSON 파일       |
|  (복원)     |     | (역직렬화)       |     | (persistentData) |
+-------------+     +------------------+     +------------------+
|  ScoreSystem|
+-------------+


[이벤트 흐름 (옵저버 패턴)]

MergeProcessor.OnMergeCompleted
    ├── ScoreSystem.OnScoreChanged
    │       └── ScoreDisplay.UpdateUI()
    ├── EffectController.PlayMergeEffect()
    ├── AudioManager.PlayMergeSFX()
    ├── WaveSystem.GenerateWave()
    │       └── BlockView.PlaySpawnAnimation()
    ├── SaveManager.AutoSave()
    └── AnalyticsManager.LogMergeEvent()
```

### 6.5 WebGL/Android 빌드 설정

#### 6.5.1 WebGL 빌드 설정

```
[Player Settings - WebGL]

  Resolution and Presentation:
    - WebGL Template: Custom (반응형 풀스크린)
    - Default Canvas Width: 1080
    - Default Canvas Height: 1920
    - Run In Background: true

  Other Settings:
    - Color Space: Gamma (WebGL 호환성)
    - Auto Graphics API: WebGL 2.0
    - Lightmap Encoding: Normal Quality
    - Managed Stripping Level: Medium

  Publishing Settings:
    - Compression Format: Brotli (최적)
    - Decompression Fallback: true
    - Data Caching: true
    - Initial Memory Size: 64 (MB)
    - Maximum Memory Size: 256 (MB)

  최적화 주의사항:
    - 텍스처 크기 최소화 (Atlas 사용)
    - AudioClip은 가능한 한 짧게
    - 폰트는 Dynamic이 아닌 Static 사용
    - GC 할당 최소화 (오브젝트 풀링 필수)
```

#### 6.5.2 Android 빌드 설정

```
[Player Settings - Android]

  Resolution and Presentation:
    - Default Orientation: Portrait
    - Allowed Orientations: Portrait, Portrait Upside Down

  Other Settings:
    - Color Space: Linear
    - Auto Graphics API: false
      - OpenGLES 3.0
      - Vulkan (폴백)
    - Minimum API Level: Android 7.0 (API 24)
    - Target API Level: Android 14 (API 34)
    - Scripting Backend: IL2CPP
    - Target Architectures: ARM64 (필수), ARMv7 (선택)
    - Managed Stripping Level: Medium

  Publishing Settings:
    - Keystore 설정 (릴리즈 빌드 시)
    - Build App Bundle (AAB) for Google Play

  Optimization:
    - Texture Compression: ASTC
    - Mesh Compression: Medium
    - Strip Engine Code: true
```

#### 6.5.3 플랫폼 분기 처리

```csharp
public static class PlatformHelper
{
    /// 현재 플랫폼이 WebGL인지 확인
    public static bool IsWebGL
    {
        get
        {
#if UNITY_WEBGL && !UNITY_EDITOR
            return true;
#else
            return false;
#endif
        }
    }

    /// 현재 플랫폼이 Android인지 확인
    public static bool IsAndroid
    {
        get
        {
#if UNITY_ANDROID && !UNITY_EDITOR
            return true;
#else
            return false;
#endif
        }
    }

    /// 플랫폼별 리더보드 서비스 생성
    public static ILeaderboardService CreateLeaderboardService()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        return new FirebaseLeaderboard();
#elif UNITY_ANDROID && !UNITY_EDITOR
        return new GPGLeaderboard();
#else
        return new MockLeaderboard(); // 에디터용 목업
#endif
    }

    /// 플랫폼별 저장 경로 확인
    public static string GetPersistentPath()
    {
        // Unity Application.persistentDataPath가 플랫폼별로 자동 처리
        // WebGL: IndexedDB
        // Android: /data/data/[package]/files/
        return Application.persistentDataPath;
    }
}
```

#### 6.5.4 WebGL 특수 처리

```csharp
public class WebGLBridge
{
    /// <summary>
    /// WebGL에서는 System.IO.File이 직접 동작하지 않으므로
    /// PlayerPrefs 또는 JavaScript interop을 통해 IndexedDB에 저장한다.
    /// </summary>
    public static void SaveToIndexedDB(string key, string jsonData)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        PlayerPrefs.SetString(key, jsonData);
        PlayerPrefs.Save();
        // WebGL에서 PlayerPrefs는 자동으로 IndexedDB에 저장됨
#endif
    }

    public static string LoadFromIndexedDB(string key)
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        return PlayerPrefs.GetString(key, null);
#else
        return null;
#endif
    }

    /// WebGL에서는 Application.Quit()이 동작하지 않음
    /// 대신 브라우저 탭 닫기를 감지하여 자동 저장
    [System.Runtime.InteropServices.DllImport("__Internal")]
    private static extern void RegisterBeforeUnloadCallback();
}
```

### 6.6 구현 체크리스트

- [ ] Unity 프로젝트 초기 설정 (2022.3 LTS)
- [ ] 폴더 구조 생성
- [ ] UniTask 패키지 임포트
- [ ] DOTween 패키지 임포트 및 설정
- [ ] WebGL Player Settings 설정
- [ ] Android Player Settings 설정
- [ ] 플랫폼 분기 유틸리티(`PlatformHelper`) 구현
- [ ] WebGL 저장 브릿지(`WebGLBridge`) 구현
- [ ] ScriptableObject 설정 파일 생성 (GridConfig, BlockColorTable 등)
- [ ] 오브젝트 풀링 시스템 구현 (블록, 이펙트)
- [ ] 이벤트 시스템 기반 모듈 간 통신 구조 구현
- [ ] WebGL 빌드 테스트 (브라우저 호환성)
- [ ] Android 빌드 테스트 (기기 호환성)
- [ ] CI/CD 파이프라인 설정 (Unity Cloud Build)

---

## 부록 A. 핵심 설정값 요약

| 파라미터 | 기본값 | 범위 | 설명 |
|----------|--------|------|------|
| `gridRadius` | 4 | 2~6 | 그리드 반지름 (61셀) |
| `hexSize` | 0.6 | 0.3~1.0 | 헥사곤 한 변 길이 |
| `hexSpacing` | 0.05 | 0.0~0.1 | 셀 간 간격 |
| `baseWaveBlockCount` | 3 | 1~5 | 기본 웨이브 블록 수 |
| `maxWaveBlockCount` | 7 | 5~12 | 최대 웨이브 블록 수 |
| `waveDifficultyScale` | 0.1 | 0.05~0.3 | 웨이브 난이도 증가율 |
| `spawnLevelDecayRate` | 0.45 | 0.3~0.6 | 생성 확률 감소 비율 |
| `maxSpawnLevel` | 7 | 3~10 | 직접 생성 최대 레벨 (128) |
| `chainBonusMultiplier` | 0.5 | 0.3~1.0 | 연쇄 보너스 배율 증가분 |
| `maxChainDepth` | 20 | 10~50 | 최대 연쇄 깊이 |

## 부록 B. 이벤트 목록

| 이벤트명 | 발행자 | 파라미터 | 설명 |
|----------|--------|----------|------|
| `OnBlockSelected` | MergeInputHandler | HexCell | 블록 선택 시 |
| `OnSelectionCleared` | MergeInputHandler | - | 선택 해제 시 |
| `OnMergeCompleted` | MergeProcessor | MergeResult | 머지 완료 시 |
| `OnChainMerge` | ChainProcessor | ChainResult | 연쇄 머지 발생 시 |
| `OnWaveGenerated` | WaveSystem | WaveResult | 웨이브 생성 시 |
| `OnScoreChanged` | ScoreSystem | int (현재점수) | 점수 변경 시 |
| `OnHighScoreChanged` | ScoreSystem | int (최고점수) | 최고 점수 갱신 시 |
| `OnMilestoneAchieved` | ScoreSystem | int, int (값, 보너스) | 마일스톤 달성 시 |
| `OnStateChanged` | GameStateManager | GameState, GameState | 상태 전환 시 |
| `OnGameSaved` | SaveManager | bool (성공여부) | 저장 완료 시 |
| `OnReshuffleStarted` | GameLoop | - | 리셔플 시작 시 |

## 부록 C. 용어 사전

| 용어 | 정의 |
|------|------|
| **큐브 좌표** | 3축(q,r,s) 기반 헥사곤 좌표 체계. q+r+s=0 제약 |
| **오프셋 좌표** | 2D 배열 매핑용 (col, row) 좌표 체계 |
| **셀(Cell)** | 헥사곤 그리드의 개별 칸. 블록을 담는 컨테이너 |
| **블록(Block)** | 셀 위에 놓이는 숫자 타일. 2의 거듭제곱 값을 가짐 |
| **머지(Merge)** | 같은 값의 블록 2개를 합쳐 2배 값으로 만드는 행위 |
| **연쇄(Chain)** | 머지 결과 인접한 같은 값 블록과 자동 머지되는 현상 |
| **웨이브(Wave)** | 머지 후 새 블록들이 보드 테두리에서 밀려오는 것 |
| **마일스톤** | 특정 블록 값을 최초 달성했을 때의 보너스 이벤트 |
| **리셔플(Reshuffle)** | 매칭 가능한 쌍이 없을 때 블록 재배치 |
| **레벨(Level)** | 블록의 단계. Level N = 값 2^N |

---

> 본 문서는 게임의 코어 시스템 설계를 다룹니다.
> 애니메이션, UI 컴포넌트, 오디오, 광고/리워드, 인앱 결제 등의 상세 설계는 별도 문서에서 다룹니다.
