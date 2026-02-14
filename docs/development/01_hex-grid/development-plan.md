# 헥사 그리드 시스템 - 상세 개발 계획서

| 항목 | 내용 |
|------|------|
| **기반 설계문서** | `docs/design/01_core-system-design.md` - 섹션 1 |
| **담당 모듈** | `Assets/_Project/Scripts/Core/Grid/` |
| **문서 버전** | v1.0 |
| **최종 수정일** | 2026-02-13 |

---

## 목차

1. [구현 항목 체크리스트 총괄](#1-구현-항목-체크리스트-총괄)
2. [STEP 1: CubeCoord 구조체](#2-step-1-cubecoord-구조체)
3. [STEP 2: OffsetCoord 구조체](#3-step-2-offsetcoord-구조체)
4. [STEP 3: CoordConverter 좌표 변환 유틸리티](#4-step-3-coordconverter-좌표-변환-유틸리티)
5. [STEP 4: HexCell 셀 데이터 클래스](#5-step-4-hexcell-셀-데이터-클래스)
6. [STEP 5: HexGrid 그리드 관리 클래스](#6-step-5-hexgrid-그리드-관리-클래스)
7. [STEP 6: HexDirection 방향 및 인접 탐색](#7-step-6-hexdirection-방향-및-인접-탐색)
8. [STEP 7: 월드 좌표 변환 및 역변환](#8-step-7-월드-좌표-변환-및-역변환)
9. [STEP 8: 그리드 시각화 프로토타입](#9-step-8-그리드-시각화-프로토타입)
10. [에지 케이스 및 주의사항](#10-에지-케이스-및-주의사항)
11. [성능 최적화 고려사항](#11-성능-최적화-고려사항)
12. [단위 테스트 포인트](#12-단위-테스트-포인트)

---

## 1. 구현 항목 체크리스트 총괄

아래는 전체 구현 항목의 요약 체크리스트이다. 각 항목의 상세 내용은 이후 섹션에서 다룬다.

| 순서 | 항목 | 난이도 | 의존성 | 파일 |
|------|------|--------|--------|------|
| STEP 1 | `CubeCoord` 구조체 | 하 | 없음 | `CubeCoord.cs` |
| STEP 2 | `OffsetCoord` 구조체 | 하 | 없음 | `OffsetCoord.cs` |
| STEP 3 | `CoordConverter` 좌표 변환 | 중 | STEP 1, 2 | `CoordConverter.cs` |
| STEP 4 | `HexCell` 셀 데이터 | 중 | STEP 1 | `HexCell.cs` |
| STEP 5 | `HexGrid` 그리드 관리 | 중 | STEP 1, 4 | `HexGrid.cs` |
| STEP 6 | `HexDirection` 인접 탐색 | 중 | STEP 1, 4, 5 | `HexDirection.cs` |
| STEP 7 | 월드 좌표 변환/역변환 | 상 | STEP 1, 3 | `CoordConverter.cs` (확장) |
| STEP 8 | 그리드 시각화 프로토타입 | 상 | STEP 1~7 전체 | `GridRenderer.cs`, `HexCellView.cs` |

---

## 2. STEP 1: CubeCoord 구조체

### 체크리스트

- [ ] 구조체 선언 및 필드 정의 (`q`, `r`, `s`)
- [ ] 2-파라미터 생성자 (`q`, `r` -> `s` 자동 계산)
- [ ] 3-파라미터 생성자 (제약 조건 검증 포함)
- [ ] `IEquatable<CubeCoord>` 인터페이스 구현
- [ ] `GetHashCode()` 오버라이드
- [ ] `Equals(object)` 오버라이드
- [ ] `==`, `!=` 연산자 오버로드
- [ ] `+`, `-` 연산자 오버로드 (좌표 간 덧셈/뺄셈)
- [ ] `Distance()` 정적 메서드
- [ ] `ToString()` 오버라이드
- [ ] 단위 테스트 작성

### 구현 설명

큐브 좌표는 헥사 그리드의 **내부 연산 핵심**이다. 세 축(`q`, `r`, `s`)을 사용하며 항상 `q + r + s = 0` 제약 조건을 만족해야 한다. 인접 셀 탐색, 거리 계산, 좌표 산술에 직접 사용되므로, 불변성(immutability)과 값 동등성(value equality)을 정확하게 구현해야 한다.

### 필요한 클래스/메서드 목록

| 분류 | 이름 | 설명 |
|------|------|------|
| 구조체 | `CubeCoord` | 큐브 좌표 표현 |
| 필드 | `q`, `r`, `s` | 세 축 정수 좌표 |
| 생성자 | `CubeCoord(int q, int r, int s)` | 3축 명시 (제약 검증) |
| 생성자 | `CubeCoord(int q, int r)` | 2축 명시, `s` 자동 계산 |
| 메서드 | `Distance(CubeCoord a, CubeCoord b)` | 두 좌표 간 헥사 거리 |
| 메서드 | `Equals(CubeCoord other)` | 값 동등성 비교 |
| 메서드 | `GetHashCode()` | Dictionary 키 사용을 위한 해시 |
| 연산자 | `+`, `-`, `==`, `!=` | 좌표 산술 및 비교 |
| 메서드 | `ToString()` | 디버그용 문자열 표현 |

### 코드 스니펫

```csharp
[System.Serializable]
public struct CubeCoord : System.IEquatable<CubeCoord>
{
    public readonly int q; // 열 방향 (동-서)
    public readonly int r; // 행 방향 (남동-북서)
    public readonly int s; // 대각선 방향, 항상 s = -q - r

    /// <summary>
    /// 3축 명시 생성자. q + r + s = 0 제약 조건을 검증한다.
    /// </summary>
    public CubeCoord(int q, int r, int s)
    {
        Debug.Assert(q + r + s == 0, $"큐브 좌표 제약 위반: q({q}) + r({r}) + s({s}) = {q + r + s} != 0");
        this.q = q;
        this.r = r;
        this.s = s;
    }

    /// <summary>
    /// 2축 생성자. s를 자동으로 계산한다.
    /// </summary>
    public CubeCoord(int q, int r)
    {
        this.q = q;
        this.r = r;
        this.s = -q - r;
    }

    /// <summary>
    /// 두 큐브 좌표 간 헥사 거리.
    /// 큐브 좌표에서 거리 = max(|dq|, |dr|, |ds|)
    /// </summary>
    public static int Distance(CubeCoord a, CubeCoord b)
    {
        return Mathf.Max(
            Mathf.Abs(a.q - b.q),
            Mathf.Abs(a.r - b.r),
            Mathf.Abs(a.s - b.s)
        );
    }

    // --- 연산자 오버로드 ---
    public static CubeCoord operator +(CubeCoord a, CubeCoord b)
        => new CubeCoord(a.q + b.q, a.r + b.r, a.s + b.s);

    public static CubeCoord operator -(CubeCoord a, CubeCoord b)
        => new CubeCoord(a.q - b.q, a.r - b.r, a.s - b.s);

    public static bool operator ==(CubeCoord a, CubeCoord b)
        => a.q == b.q && a.r == b.r && a.s == b.s;

    public static bool operator !=(CubeCoord a, CubeCoord b)
        => !(a == b);

    // --- IEquatable 구현 ---
    public bool Equals(CubeCoord other)
        => q == other.q && r == other.r && s == other.s;

    public override bool Equals(object obj)
        => obj is CubeCoord other && Equals(other);

    /// <summary>
    /// Dictionary 키로 사용하기 위한 해시코드.
    /// 충돌을 최소화하는 소수 기반 해시 결합.
    /// </summary>
    public override int GetHashCode()
        => (q * 397) ^ (r * 31) ^ s;

    public override string ToString()
        => $"CubeCoord({q}, {r}, {s})";

    /// <summary>
    /// 원점 좌표 상수.
    /// </summary>
    public static readonly CubeCoord Zero = new CubeCoord(0, 0, 0);
}
```

### 예상 난이도

**하** - 기본 구조체 구현이며 복잡한 로직이 없다. 다만 `GetHashCode`의 품질과 `IEquatable` 올바른 구현이 중요하다.

### 의존성

- **선행 의존성**: 없음 (독립적 구현 가능)
- **후행 의존성**: 거의 모든 그리드 관련 클래스가 `CubeCoord`에 의존한다 (`CoordConverter`, `HexCell`, `HexGrid`, `HexDirection`)

### 예상 구현 순서

**1번째** - 가장 먼저 구현하며, 이후 모든 작업의 기반이 된다.

---

## 3. STEP 2: OffsetCoord 구조체

### 체크리스트

- [ ] 구조체 선언 및 필드 정의 (`col`, `row`)
- [ ] 생성자
- [ ] `IEquatable<OffsetCoord>` 인터페이스 구현
- [ ] `GetHashCode()` 오버라이드
- [ ] `Equals(object)` 오버라이드
- [ ] `==`, `!=` 연산자 오버로드
- [ ] `ToString()` 오버라이드

### 구현 설명

오프셋 좌표는 **화면 렌더링**과 **직렬화(세이브/로드)** 전용 좌표 체계이다. 2D 배열 인덱싱에 직접 대응되므로, 저장 데이터 구조(`CellSaveData`)에서 사용된다. 내부 연산에는 사용하지 않으며, `CubeCoord`와의 상호 변환을 통해 활용된다.

본 프로젝트에서는 **짝수 열 오프셋(even-q offset)** 방식을 채택한다 (flat-top 헥사곤 기준).

### 필요한 클래스/메서드 목록

| 분류 | 이름 | 설명 |
|------|------|------|
| 구조체 | `OffsetCoord` | 오프셋 좌표 표현 |
| 필드 | `col`, `row` | 열/행 정수 좌표 |
| 생성자 | `OffsetCoord(int col, int row)` | 열/행 지정 |
| 메서드 | `Equals`, `GetHashCode`, `ToString` | 기본 오버라이드 |

### 코드 스니펫

```csharp
[System.Serializable]
public struct OffsetCoord : System.IEquatable<OffsetCoord>
{
    public readonly int col; // 열 (x 방향)
    public readonly int row; // 행 (y 방향)

    public OffsetCoord(int col, int row)
    {
        this.col = col;
        this.row = row;
    }

    public bool Equals(OffsetCoord other)
        => col == other.col && row == other.row;

    public override bool Equals(object obj)
        => obj is OffsetCoord other && Equals(other);

    public override int GetHashCode()
        => (col * 397) ^ row;

    public static bool operator ==(OffsetCoord a, OffsetCoord b)
        => a.col == b.col && a.row == b.row;

    public static bool operator !=(OffsetCoord a, OffsetCoord b)
        => !(a == b);

    public override string ToString()
        => $"OffsetCoord(col:{col}, row:{row})";
}
```

### 예상 난이도

**하** - `CubeCoord`보다 더 단순한 구조체이다.

### 의존성

- **선행 의존성**: 없음 (독립적 구현 가능)
- **후행 의존성**: `CoordConverter`가 `OffsetCoord`를 사용한다. `GameSaveData`의 `CellSaveData`가 `col`, `row`를 직접 참조한다.

### 예상 구현 순서

**2번째** - `CubeCoord`와 동시에 또는 직후에 구현한다.

---

## 4. STEP 3: CoordConverter 좌표 변환 유틸리티

### 체크리스트

- [ ] `CubeToOffset()` 큐브 -> 오프셋 변환 (even-q 방식)
- [ ] `OffsetToCube()` 오프셋 -> 큐브 변환 (even-q 방식)
- [ ] `CubeToWorld()` 큐브 -> 월드 좌표 변환 (flat-top)
- [ ] `WorldToCube()` 월드 -> 큐브 좌표 역변환 (반올림)
- [ ] `CubeRound()` 실수 큐브 좌표 반올림 (private)
- [ ] 왕복 변환 정합성 테스트 (Cube -> Offset -> Cube)
- [ ] 월드 좌표 왕복 변환 테스트 (Cube -> World -> Cube)

### 구현 설명

좌표 변환기는 세 좌표 체계(큐브, 오프셋, 월드) 간의 양방향 변환을 담당하는 **정적 유틸리티 클래스**이다. 게임 전반에서 빈번하게 호출되므로, 정확성이 매우 중요하다.

핵심 변환 관계:
```
큐브 좌표 (CubeCoord)  <-->  오프셋 좌표 (OffsetCoord)
     |                              |
     v                              v
  월드 좌표 (Vector2)         2D 배열 인덱스 / 직렬화
```

특히 `WorldToCube()` 역변환에서는 실수 좌표를 정수로 반올림할 때 `CubeRound` 알고리즘이 핵심이다. 단순 반올림 시 `q + r + s = 0` 제약이 깨질 수 있으므로, 가장 큰 오차를 가진 축을 나머지 두 축으로부터 재계산하는 보정 로직이 필수이다.

### 필요한 클래스/메서드 목록

| 분류 | 이름 | 설명 |
|------|------|------|
| 정적 클래스 | `CoordConverter` | 좌표 변환 유틸리티 |
| 메서드 | `CubeToOffset(CubeCoord)` | 큐브 -> 오프셋 (even-q) |
| 메서드 | `OffsetToCube(OffsetCoord)` | 오프셋 -> 큐브 (even-q) |
| 메서드 | `CubeToWorld(CubeCoord, float hexSize)` | 큐브 -> 월드 좌표 |
| 메서드 | `WorldToCube(Vector2, float hexSize)` | 월드 -> 큐브 좌표 |
| private | `CubeRound(float fq, float fr, float fs)` | 실수 반올림 보정 |

### 코드 스니펫

```csharp
public static class CoordConverter
{
    // ========================================
    // 큐브 <-> 오프셋 변환 (even-q 방식)
    // ========================================

    /// <summary>
    /// 큐브 좌표 -> 오프셋 좌표 (even-q 방식).
    /// even-q: 짝수 열이 아래로 반 칸 밀림.
    /// </summary>
    public static OffsetCoord CubeToOffset(CubeCoord cube)
    {
        int col = cube.q;
        int row = cube.r + (cube.q + (cube.q & 1)) / 2;
        return new OffsetCoord(col, row);
    }

    /// <summary>
    /// 오프셋 좌표 -> 큐브 좌표 (even-q 방식).
    /// </summary>
    public static CubeCoord OffsetToCube(OffsetCoord offset)
    {
        int q = offset.col;
        int r = offset.row - (offset.col + (offset.col & 1)) / 2;
        return new CubeCoord(q, r);
    }

    // ========================================
    // 큐브 <-> 월드 좌표 변환 (flat-top 헥사곤)
    // ========================================

    /// <summary>
    /// 큐브 좌표 -> 월드 좌표 (flat-top 헥사곤).
    /// hexSize = 헥사곤 한 변의 길이.
    /// flat-top 공식:
    ///   x = hexSize * (3/2 * q)
    ///   y = hexSize * (sqrt(3)/2 * q + sqrt(3) * r)
    /// </summary>
    public static Vector2 CubeToWorld(CubeCoord cube, float hexSize)
    {
        float x = hexSize * (1.5f * cube.q);
        float y = hexSize * (Mathf.Sqrt(3f) * 0.5f * cube.q + Mathf.Sqrt(3f) * cube.r);
        return new Vector2(x, y);
    }

    /// <summary>
    /// 월드 좌표 -> 큐브 좌표 (역변환, 반올림 포함).
    /// 터치/클릭 좌표에서 어떤 셀을 탭했는지 판별할 때 사용.
    /// </summary>
    public static CubeCoord WorldToCube(Vector2 worldPos, float hexSize)
    {
        float q = (2f / 3f * worldPos.x) / hexSize;
        float r = (-1f / 3f * worldPos.x + Mathf.Sqrt(3f) / 3f * worldPos.y) / hexSize;
        float s = -q - r;
        return CubeRound(q, r, s);
    }

    /// <summary>
    /// 실수 큐브 좌표 -> 정수 큐브 좌표 반올림.
    /// 단순 반올림 시 q+r+s=0 제약이 깨질 수 있으므로,
    /// 가장 큰 반올림 오차를 가진 축을 나머지 두 축으로부터 재계산한다.
    /// </summary>
    private static CubeCoord CubeRound(float fq, float fr, float fs)
    {
        int q = Mathf.RoundToInt(fq);
        int r = Mathf.RoundToInt(fr);
        int s = Mathf.RoundToInt(fs);

        float qDiff = Mathf.Abs(q - fq);
        float rDiff = Mathf.Abs(r - fr);
        float sDiff = Mathf.Abs(s - fs);

        // 가장 큰 오차를 가진 축을 나머지로부터 재계산
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

### 예상 난이도

**중** - 변환 공식 자체는 정립되어 있으나, even-q 오프셋의 비트 연산(`& 1`)과 `CubeRound` 반올림 보정 로직의 정확한 이해가 필요하다.

### 의존성

- **선행 의존성**: `CubeCoord` (STEP 1), `OffsetCoord` (STEP 2)
- **후행 의존성**: `HexGrid` (월드 좌표 배치), 입력 처리 (터치 -> 셀 역변환), `SaveManager` (직렬화 시 오프셋 변환)

### 예상 구현 순서

**3번째** - 두 좌표 구조체 완성 후 즉시 구현한다.

---

## 5. STEP 4: HexCell 셀 데이터 클래스

### 체크리스트

- [ ] `CellState` 열거형 정의 (`Empty`, `Occupied`, `Locked`, `Disabled`)
- [ ] `HexCell` 클래스 선언 (좌표, 상태, 블록 참조)
- [ ] `PlaceBlock()` 블록 배치 메서드
- [ ] `RemoveBlock()` 블록 제거 메서드
- [ ] `Lock()` / `Unlock()` 잠금 제어 메서드
- [ ] `IsEmpty`, `IsInteractable` 프로퍼티
- [ ] `View` 참조 연결 (MVC 패턴)
- [ ] 상태 전이 유효성 검증 (잘못된 전이 방지)

### 구현 설명

`HexCell`은 그리드의 개별 셀을 나타내는 **데이터 클래스**이다. MVC 패턴에서 Model 역할을 하며, 자신의 좌표(`CubeCoord`), 현재 상태(`CellState`), 그리고 위에 놓인 블록(`HexBlock`)에 대한 참조를 관리한다.

셀 상태 전이 규칙:
```
Empty  --PlaceBlock-->  Occupied
Occupied  --RemoveBlock-->  Empty
Occupied  --Lock-->  Locked
Empty  --Lock-->  Locked
Locked  --Unlock-->  Occupied (블록 있으면) 또는 Empty (블록 없으면)
Disabled  -- (상태 변경 불가, 초기 설정 시에만 지정)
```

### 필요한 클래스/메서드 목록

| 분류 | 이름 | 설명 |
|------|------|------|
| 열거형 | `CellState` | 셀 상태 (Empty/Occupied/Locked/Disabled) |
| 클래스 | `HexCell` | 셀 데이터 |
| 프로퍼티 | `Coord` | 큐브 좌표 (읽기 전용) |
| 프로퍼티 | `State` | 현재 셀 상태 (읽기 전용) |
| 프로퍼티 | `Block` | 블록 참조 (읽기 전용) |
| 프로퍼티 | `View` | 시각 요소 참조 |
| 메서드 | `PlaceBlock(HexBlock)` | 블록 배치 |
| 메서드 | `RemoveBlock()` | 블록 제거, 제거된 블록 반환 |
| 메서드 | `Lock()` | 셀 잠금 |
| 메서드 | `Unlock()` | 셀 잠금 해제 |
| 프로퍼티 | `IsEmpty` | 빈 셀 여부 |
| 프로퍼티 | `IsInteractable` | 상호작용 가능 여부 |

### 코드 스니펫

```csharp
/// <summary>
/// 셀의 현재 상태를 나타내는 열거형.
/// </summary>
public enum CellState
{
    Empty,      // 빈 셀 - 새 블록을 배치할 수 있음
    Occupied,   // 블록이 존재하는 셀
    Locked,     // 잠긴 셀 - 애니메이션 중이거나 머지 처리 중
    Disabled    // 비활성 셀 - 사용 불가 영역 (확장용 예약)
}

/// <summary>
/// 헥사곤 그리드의 개별 셀 데이터.
/// Model 역할을 하며 View(HexCellView)와 분리된다.
/// </summary>
public class HexCell
{
    public CubeCoord Coord { get; private set; }
    public CellState State { get; private set; }
    public HexBlock Block { get; private set; }
    public HexCellView View { get; set; }

    public HexCell(CubeCoord coord)
    {
        Coord = coord;
        State = CellState.Empty;
        Block = null;
    }

    /// <summary>
    /// 셀에 블록 배치. Empty 상태에서만 가능하다.
    /// </summary>
    public void PlaceBlock(HexBlock block)
    {
        Debug.Assert(State == CellState.Empty,
            $"빈 셀에만 블록을 배치할 수 있습니다. 현재 상태: {State}, 좌표: {Coord}");
        Debug.Assert(block != null, "null 블록을 배치할 수 없습니다.");

        Block = block;
        block.Cell = this;
        State = CellState.Occupied;
    }

    /// <summary>
    /// 셀에서 블록 제거. Occupied 상태에서만 가능하다.
    /// 제거된 블록을 반환한다.
    /// </summary>
    public HexBlock RemoveBlock()
    {
        Debug.Assert(State == CellState.Occupied,
            $"블록이 있는 셀에서만 제거할 수 있습니다. 현재 상태: {State}, 좌표: {Coord}");

        HexBlock removed = Block;
        removed.Cell = null;
        Block = null;
        State = CellState.Empty;
        return removed;
    }

    /// <summary>
    /// 셀 잠금. 애니메이션이나 머지 처리 중 추가 입력을 방지한다.
    /// Disabled 상태에서는 잠금 불가.
    /// </summary>
    public void Lock()
    {
        Debug.Assert(State != CellState.Disabled,
            $"비활성 셀은 잠글 수 없습니다. 좌표: {Coord}");
        State = CellState.Locked;
    }

    /// <summary>
    /// 셀 잠금 해제. 블록 유무에 따라 상태가 결정된다.
    /// </summary>
    public void Unlock()
    {
        State = (Block != null) ? CellState.Occupied : CellState.Empty;
    }

    /// <summary>셀이 비어있는지 확인.</summary>
    public bool IsEmpty => State == CellState.Empty;

    /// <summary>셀이 상호작용 가능한지 확인 (Occupied 상태에서만 탭 가능).</summary>
    public bool IsInteractable => State == CellState.Occupied;
}
```

### 예상 난이도

**중** - 상태 전이 로직이 핵심이며, 잘못된 상태에서의 조작을 방어하는 Assert/예외 처리가 중요하다.

### 의존성

- **선행 의존성**: `CubeCoord` (STEP 1)
- **후행 의존성**: `HexGrid` (STEP 5)가 `HexCell`의 컬렉션을 관리한다. `HexBlock` (블록 시스템)과 양방향 참조를 갖는다. `HexCellView` (시각화)와 연결된다.
- **주의**: `HexBlock` 클래스가 블록 시스템 모듈에서 구현되므로, `HexCell` 구현 시 `HexBlock`의 최소 인터페이스(또는 null 허용 참조)가 필요하다. 초기 구현에서는 `HexBlock`을 null로 두고 셀 상태 전이만 검증할 수 있다.

### 예상 구현 순서

**4번째** - `CubeCoord` 이후, `HexGrid` 이전에 구현한다.

---

## 6. STEP 5: HexGrid 그리드 관리 클래스

### 체크리스트

- [ ] `Dictionary<CubeCoord, HexCell>` 기반 셀 저장소
- [ ] `GenerateGrid(int radius)` 육각형 보드 생성
- [ ] `GetCell(CubeCoord)` 셀 조회
- [ ] `IsValidCoord(CubeCoord)` 유효 좌표 확인
- [ ] `GetAllCells()` 전체 셀 반환
- [ ] `GetEmptyCells()` 빈 셀 목록 반환
- [ ] `GetOccupiedCells()` 블록 있는 셀 목록 반환
- [ ] `Radius` 프로퍼티
- [ ] `CellCount` 프로퍼티 (총 셀 수)
- [ ] `ClearAllBlocks()` 전체 블록 제거 (리셔플용)
- [ ] 그리드 생성 후 셀 수 검증 (공식: `3 * r * (r+1) + 1`)

### 구현 설명

`HexGrid`는 헥사곤 보드 전체를 관리하는 **핵심 컨테이너**이다. 중심 `(0,0,0)`으로부터 주어진 반지름(기본값 4) 이내의 모든 큐브 좌표에 `HexCell`을 생성하여 Dictionary로 관리한다.

그리드 생성 알고리즘 핵심:
```
for q in [-radius, +radius]:
    r_min = max(-radius, -q - radius)
    r_max = min(+radius, -q + radius)
    for r in [r_min, r_max]:
        셀 생성 at CubeCoord(q, r)
```

이 이중 루프는 육각형 모양의 보드를 생성한다. `r`의 범위가 `q`에 따라 달라지기 때문에 직사각형이 아닌 육각형 형태가 된다.

### 필요한 클래스/메서드 목록

| 분류 | 이름 | 설명 |
|------|------|------|
| 클래스 | `HexGrid` | 그리드 관리 |
| 필드 | `cells` (Dictionary) | 좌표->셀 매핑 |
| 프로퍼티 | `Radius` | 그리드 반지름 |
| 프로퍼티 | `CellCount` | 총 셀 수 |
| 메서드 | `GenerateGrid(int radius)` | 그리드 생성 |
| 메서드 | `GetCell(CubeCoord)` | 좌표로 셀 조회 |
| 메서드 | `IsValidCoord(CubeCoord)` | 유효 좌표 여부 |
| 메서드 | `GetAllCells()` | 전체 셀 열거 |
| 메서드 | `GetEmptyCells()` | 빈 셀 목록 |
| 메서드 | `GetOccupiedCells()` | 점유 셀 목록 |
| 메서드 | `ClearAllBlocks()` | 전체 블록 제거 |

### 코드 스니펫

```csharp
/// <summary>
/// 헥사곤 보드 전체를 관리하는 그리드 클래스.
/// 중심 (0,0,0)으로부터 radius 거리 이내에 셀을 배치한다.
/// </summary>
public class HexGrid
{
    private Dictionary<CubeCoord, HexCell> cells = new Dictionary<CubeCoord, HexCell>();
    private int radius;

    public int Radius => radius;
    public int CellCount => cells.Count;

    /// <summary>
    /// 반지름 기반 육각형 그리드 생성.
    /// 총 셀 수 = 3 * radius * (radius + 1) + 1
    /// </summary>
    public void GenerateGrid(int radius)
    {
        Debug.Assert(radius > 0, $"그리드 반지름은 1 이상이어야 합니다. 입력: {radius}");

        this.radius = radius;
        cells.Clear();

        for (int q = -radius; q <= radius; q++)
        {
            // q 값에 따른 r 범위 계산 (육각형 형태)
            int r1 = Mathf.Max(-radius, -q - radius);
            int r2 = Mathf.Min(radius, -q + radius);

            for (int r = r1; r <= r2; r++)
            {
                CubeCoord coord = new CubeCoord(q, r);
                HexCell cell = new HexCell(coord);
                cells.Add(coord, cell);
            }
        }

        // 생성 결과 검증
        int expectedCount = 3 * radius * (radius + 1) + 1;
        Debug.Assert(cells.Count == expectedCount,
            $"셀 수 불일치: 기대 {expectedCount}, 실제 {cells.Count}");
    }

    /// <summary>
    /// 특정 좌표의 셀을 반환. 없으면 null.
    /// </summary>
    public HexCell GetCell(CubeCoord coord)
    {
        cells.TryGetValue(coord, out HexCell cell);
        return cell;
    }

    /// <summary>
    /// 그리드에 포함된 좌표인지 확인.
    /// </summary>
    public bool IsValidCoord(CubeCoord coord)
    {
        return cells.ContainsKey(coord);
    }

    /// <summary>모든 셀 열거.</summary>
    public IEnumerable<HexCell> GetAllCells() => cells.Values;

    /// <summary>빈 셀 목록 반환.</summary>
    public List<HexCell> GetEmptyCells()
    {
        return cells.Values.Where(c => c.State == CellState.Empty).ToList();
    }

    /// <summary>블록이 있는 셀 목록 반환.</summary>
    public List<HexCell> GetOccupiedCells()
    {
        return cells.Values.Where(c => c.State == CellState.Occupied).ToList();
    }

    /// <summary>
    /// 모든 블록 제거 (리셔플 등에 사용).
    /// 블록 데이터를 수집한 후 모든 셀을 Empty로 만든다.
    /// </summary>
    public List<HexBlock> ClearAllBlocks()
    {
        List<HexBlock> removedBlocks = new List<HexBlock>();
        foreach (var cell in cells.Values)
        {
            if (cell.State == CellState.Occupied)
            {
                removedBlocks.Add(cell.RemoveBlock());
            }
        }
        return removedBlocks;
    }
}
```

### 예상 난이도

**중** - 그리드 생성 알고리즘의 `r` 범위 계산이 핵심이다. 나머지 메서드는 Dictionary 조회 기반이므로 단순하다.

### 의존성

- **선행 의존성**: `CubeCoord` (STEP 1), `HexCell` (STEP 4)
- **후행 의존성**: `HexDirection` (STEP 6)이 `HexGrid`를 매개변수로 받는다. `MergeProcessor`, `WaveSystem`, `BlockPlacer`, `MatchFinder` 등 대부분의 게임 로직이 `HexGrid`에 의존한다. `SaveManager`가 그리드 상태를 직렬화한다.

### 예상 구현 순서

**5번째** - `HexCell` 직후에 구현한다.

---

## 7. STEP 6: HexDirection 방향 및 인접 탐색

### 체크리스트

- [ ] 6방향 인접 오프셋 상수 배열 (`Directions`)
- [ ] `GetNeighbors()` 특정 좌표의 인접 좌표 목록 반환
- [ ] `GetMatchingNeighbors()` 같은 값의 인접 블록 탐색
- [ ] `FindConnectedGroup()` BFS 기반 연결된 같은 값 블록 그룹 탐색
- [ ] 경계 셀의 인접 셀 개수 정확성 테스트 (6개 미만)
- [ ] BFS 무한 루프 방지 검증 (visited 셋)

### 구현 설명

`HexDirection`은 헥사곤 그리드의 **6방향 인접 관계**를 정의하고, 인접 셀 탐색 알고리즘을 제공하는 정적 유틸리티 클래스이다.

6방향 (flat-top 기준, 시계 방향):
```
방향 0: 동(E)     -> (+1,  0, -1)
방향 1: 북동(NE)  -> (+1, -1,  0)
방향 2: 북서(NW)  -> ( 0, -1, +1)
방향 3: 서(W)     -> (-1,  0, +1)
방향 4: 남서(SW)  -> (-1, +1,  0)
방향 5: 남동(SE)  -> ( 0, +1, -1)
```

`FindConnectedGroup()`은 BFS(너비 우선 탐색)를 사용하여 연결된 같은 값 블록 그룹을 찾는다. 이 메서드는 연쇄 머지 시스템에서 핵심적으로 사용된다.

### 필요한 클래스/메서드 목록

| 분류 | 이름 | 설명 |
|------|------|------|
| 정적 클래스 | `HexDirection` | 방향 및 인접 탐색 유틸리티 |
| 상수 | `Directions` (CubeCoord[]) | 6방향 오프셋 배열 |
| 메서드 | `GetNeighbors(CubeCoord, HexGrid)` | 인접 좌표 목록 (그리드 범위 내) |
| 메서드 | `GetMatchingNeighbors(CubeCoord, int value, HexGrid)` | 같은 값 인접 블록 셀 |
| 메서드 | `FindConnectedGroup(CubeCoord, int value, HexGrid)` | BFS 연결 그룹 |

### 코드 스니펫

```csharp
/// <summary>
/// 헥사곤 그리드의 6방향 및 인접 셀 탐색 유틸리티.
/// </summary>
public static class HexDirection
{
    /// <summary>
    /// 6방향 인접 오프셋 (큐브 좌표 기준, 시계 방향).
    /// 인덱스 0=동, 1=북동, 2=북서, 3=서, 4=남서, 5=남동
    /// </summary>
    public static readonly CubeCoord[] Directions = new CubeCoord[]
    {
        new CubeCoord(+1,  0, -1), // 0: 동 (E)
        new CubeCoord(+1, -1,  0), // 1: 북동 (NE)
        new CubeCoord( 0, -1, +1), // 2: 북서 (NW)
        new CubeCoord(-1,  0, +1), // 3: 서 (W)
        new CubeCoord(-1, +1,  0), // 4: 남서 (SW)
        new CubeCoord( 0, +1, -1), // 5: 남동 (SE)
    };

    /// <summary>
    /// 특정 좌표의 인접 좌표 목록 반환 (그리드 범위 내만).
    /// 경계 셀은 6개 미만이 반환될 수 있다.
    /// </summary>
    public static List<CubeCoord> GetNeighbors(CubeCoord center, HexGrid grid)
    {
        List<CubeCoord> neighbors = new List<CubeCoord>(6);
        for (int i = 0; i < Directions.Length; i++)
        {
            CubeCoord neighbor = center + Directions[i];
            if (grid.IsValidCoord(neighbor))
            {
                neighbors.Add(neighbor);
            }
        }
        return neighbors;
    }

    /// <summary>
    /// 특정 좌표 주변에서 같은 값의 블록이 있는 인접 셀 탐색.
    /// 연쇄 머지 판정에 사용된다.
    /// </summary>
    public static List<HexCell> GetMatchingNeighbors(
        CubeCoord center, int value, HexGrid grid)
    {
        List<HexCell> matches = new List<HexCell>();
        foreach (var neighborCoord in GetNeighbors(center, grid))
        {
            HexCell cell = grid.GetCell(neighborCoord);
            if (cell != null
                && cell.State == CellState.Occupied
                && cell.Block.Value == value)
            {
                matches.Add(cell);
            }
        }
        return matches;
    }

    /// <summary>
    /// BFS 기반 연결된 같은 값 블록 그룹 탐색.
    /// 시작점에서 인접한 같은 값 블록들을 재귀적으로 탐색한다.
    /// visited HashSet으로 무한 루프를 방지한다.
    /// </summary>
    public static List<HexCell> FindConnectedGroup(
        CubeCoord start, int value, HexGrid grid)
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

            if (cell != null
                && cell.State == CellState.Occupied
                && cell.Block.Value == value)
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

### 예상 난이도

**중** - 6방향 오프셋 값은 이미 정의되어 있으므로, 핵심은 BFS 알고리즘의 올바른 구현과 경계 조건 처리이다.

### 의존성

- **선행 의존성**: `CubeCoord` (STEP 1), `HexCell` (STEP 4), `HexGrid` (STEP 5)
- **후행 의존성**: `ChainProcessor` (연쇄 머지)가 `GetMatchingNeighbors()`를 사용한다. `WaveSystem`이 테두리 셀 판별에 `Distance()`를 사용한다.

### 예상 구현 순서

**6번째** - `HexGrid` 직후에 구현한다.

---

## 8. STEP 7: 월드 좌표 변환 및 역변환

### 체크리스트

- [ ] `CubeToWorld()` 정확성 검증 (각 셀 간 간격이 균일한지)
- [ ] `WorldToCube()` 역변환 정확성 검증
- [ ] `hexSpacing` (셀 간 간격) 적용 로직
- [ ] 셀 중심에서 벗어난 위치의 역변환 정확성 (경계 테스트)
- [ ] 화면 해상도/카메라 설정에 따른 좌표 변환 통합
- [ ] 터치/클릭 스크린 좌표 -> 월드 좌표 -> 큐브 좌표 파이프라인

### 구현 설명

이 단계는 STEP 3에서 구현한 `CoordConverter`의 월드 좌표 변환 부분을 **실제 게임 환경**에 통합하는 것이다. 핵심 과제는 다음과 같다:

1. **셀 간 간격(`hexSpacing`) 반영**: 설계문서에서 `hexSpacing = 0.05f`를 정의하고 있으며, 이 값이 월드 좌표 변환에 가산되어야 한다.
2. **스크린 좌표 -> 월드 좌표 변환**: 사용자의 터치/클릭은 스크린 좌표로 들어오므로, `Camera.ScreenToWorldPoint()`를 거쳐 월드 좌표로 변환한 뒤 `WorldToCube()`를 호출해야 한다.
3. **그리드 오프셋**: 그리드가 화면 중앙에 배치되도록 그리드 전체에 오프셋을 적용할 수 있다.

### 필요한 클래스/메서드 목록

| 분류 | 이름 | 설명 |
|------|------|------|
| 확장 | `CoordConverter.CubeToWorld()` | hexSpacing 파라미터 추가 |
| 새 메서드 | `CoordConverter.CubeToWorldWithSpacing()` | 간격 포함 월드 좌표 |
| 새 메서드 | `CoordConverter.ScreenToCube()` | 스크린 -> 큐브 변환 |
| 새 클래스 | `GridInputHelper` | 터치/클릭 입력에서 셀 판별 |

### 코드 스니펫

```csharp
// CoordConverter에 추가할 메서드들

/// <summary>
/// 셀 간 간격(spacing)을 포함한 월드 좌표 변환.
/// 실제 렌더링 시에는 이 메서드를 사용한다.
/// </summary>
public static Vector2 CubeToWorldWithSpacing(
    CubeCoord cube, float hexSize, float hexSpacing)
{
    // 간격을 포함한 유효 크기
    float effectiveSize = hexSize + hexSpacing;
    return CubeToWorld(cube, effectiveSize);
}

/// <summary>
/// 스크린 좌표 -> 큐브 좌표 변환.
/// 카메라를 통해 스크린 좌표를 월드 좌표로 변환한 뒤 역변환한다.
/// gridOffset: 그리드 중심의 월드 좌표 오프셋.
/// </summary>
public static CubeCoord ScreenToCube(
    Vector2 screenPos, Camera camera,
    float hexSize, float hexSpacing, Vector2 gridOffset)
{
    // 스크린 -> 월드
    Vector3 worldPos3D = camera.ScreenToWorldPoint(
        new Vector3(screenPos.x, screenPos.y, camera.nearClipPlane));
    Vector2 worldPos = new Vector2(worldPos3D.x, worldPos3D.y);

    // 그리드 오프셋 보정
    worldPos -= gridOffset;

    // 월드 -> 큐브 (간격 포함 크기 사용)
    float effectiveSize = hexSize + hexSpacing;
    return WorldToCube(worldPos, effectiveSize);
}
```

```csharp
/// <summary>
/// 터치/클릭 입력에서 셀을 판별하는 헬퍼 클래스.
/// MonoBehaviour에서 사용한다.
/// </summary>
public class GridInputHelper
{
    private HexGrid grid;
    private Camera mainCamera;
    private float hexSize;
    private float hexSpacing;
    private Vector2 gridOffset;

    public GridInputHelper(
        HexGrid grid, Camera camera,
        float hexSize, float hexSpacing, Vector2 gridOffset)
    {
        this.grid = grid;
        this.mainCamera = camera;
        this.hexSize = hexSize;
        this.hexSpacing = hexSpacing;
        this.gridOffset = gridOffset;
    }

    /// <summary>
    /// 스크린 좌표로부터 해당 셀을 반환.
    /// 그리드 범위 밖이면 null.
    /// </summary>
    public HexCell GetCellAtScreenPosition(Vector2 screenPos)
    {
        CubeCoord coord = CoordConverter.ScreenToCube(
            screenPos, mainCamera, hexSize, hexSpacing, gridOffset);

        if (!grid.IsValidCoord(coord))
            return null;

        return grid.GetCell(coord);
    }
}
```

### 예상 난이도

**상** - 수학적 변환 자체는 정립되어 있지만, 카메라 설정, 화면 해상도, 그리드 오프셋 등 **실제 환경 변수**와의 통합이 복잡하다. 특히 `hexSpacing` 적용 시 역변환의 일관성을 보장해야 한다.

### 의존성

- **선행 의존성**: `CubeCoord` (STEP 1), `CoordConverter` (STEP 3), `HexGrid` (STEP 5)
- **후행 의존성**: `MergeInputHandler` (탭 입력 처리)가 `GridInputHelper`를 사용한다. `GridRenderer` (STEP 8)가 `CubeToWorldWithSpacing()`을 사용하여 셀을 배치한다.

### 예상 구현 순서

**7번째** - 그리드 로직이 모두 완성된 후, 시각화 전에 구현한다.

---

## 9. STEP 8: 그리드 시각화 프로토타입

### 체크리스트

- [ ] `HexCellView` 셀 시각 표현 컴포넌트
- [ ] `GridRenderer` 그리드 전체 렌더링 관리자
- [ ] 헥사곤 셀 프리팹 (`HexCell.prefab`) 제작
- [ ] 셀 상태별 시각 표현 (Empty/Occupied/Locked 색상 구분)
- [ ] 에디터 기즈모(Gizmos)를 통한 디버그 시각화
- [ ] 카메라 자동 줌/위치 조정 (그리드 전체가 화면에 맞도록)
- [ ] 그리드 반지름 변경 시 동적 재생성 테스트

### 구현 설명

그리드 시각화는 데이터 모델(`HexGrid`, `HexCell`)을 실제 Unity 씬에서 **눈에 보이게** 만드는 단계이다. MVC 패턴의 View 계층에 해당하며, Model과 분리되어야 한다.

두 가지 시각화 방식을 모두 구현한다:

1. **에디터 기즈모**: 개발 중 디버그 용도. Scene 뷰에서 그리드 형태를 확인한다.
2. **런타임 렌더링**: 실제 게임 화면. 프리팹 인스턴스로 셀과 블록을 배치한다.

### 필요한 클래스/메서드 목록

| 분류 | 이름 | 설명 |
|------|------|------|
| MonoBehaviour | `GridRenderer` | 그리드 시각화 관리자 |
| MonoBehaviour | `HexCellView` | 개별 셀 시각 표현 |
| 메서드 | `GridRenderer.RenderGrid()` | 전체 그리드 렌더링 |
| 메서드 | `GridRenderer.OnDrawGizmos()` | 에디터 기즈모 |
| 메서드 | `HexCellView.UpdateVisual()` | 셀 상태에 따른 시각 갱신 |
| 메서드 | `GridRenderer.FitCamera()` | 카메라 자동 조정 |
| ScriptableObject | `GridConfig` | 그리드 설정 (radius, hexSize, spacing) |

### 코드 스니펫

```csharp
/// <summary>
/// 그리드 설정 ScriptableObject.
/// 에디터에서 값을 조정할 수 있다.
/// </summary>
[CreateAssetMenu(fileName = "GridConfig", menuName = "HexaMerge/GridConfig")]
public class GridConfig : ScriptableObject
{
    [Header("그리드 크기")]
    [Range(1, 8)]
    public int gridRadius = 4;

    [Header("헥사곤 크기")]
    [Tooltip("헥사곤 한 변의 길이 (Unity 월드 단위)")]
    public float hexSize = 0.6f;

    [Tooltip("셀 간 간격")]
    public float hexSpacing = 0.05f;

    /// <summary>총 셀 수 계산.</summary>
    public int TotalCellCount => 3 * gridRadius * (gridRadius + 1) + 1;
}
```

```csharp
/// <summary>
/// 그리드 시각화 및 관리를 담당하는 MonoBehaviour.
/// </summary>
public class GridRenderer : MonoBehaviour
{
    [SerializeField] private GridConfig config;
    [SerializeField] private GameObject hexCellPrefab;
    [SerializeField] private Transform cellContainer;

    private HexGrid grid;
    private Dictionary<CubeCoord, HexCellView> cellViews
        = new Dictionary<CubeCoord, HexCellView>();

    /// <summary>
    /// 그리드 초기화 및 시각적 셀 배치.
    /// </summary>
    public void Initialize()
    {
        // 1. 데이터 그리드 생성
        grid = new HexGrid();
        grid.GenerateGrid(config.gridRadius);

        // 2. 시각적 셀 배치
        foreach (var cell in grid.GetAllCells())
        {
            Vector2 worldPos = CoordConverter.CubeToWorldWithSpacing(
                cell.Coord, config.hexSize, config.hexSpacing);

            GameObject cellObj = Instantiate(
                hexCellPrefab,
                new Vector3(worldPos.x, worldPos.y, 0f),
                Quaternion.identity,
                cellContainer);

            cellObj.name = $"Cell_{cell.Coord}";

            HexCellView view = cellObj.GetComponent<HexCellView>();
            view.Initialize(cell, config.hexSize);
            cell.View = view;
            cellViews.Add(cell.Coord, view);
        }

        // 3. 카메라 조정
        FitCamera();
    }

    /// <summary>
    /// 그리드 전체가 화면에 보이도록 카메라 크기 조정.
    /// Orthographic 카메라 기준.
    /// </summary>
    private void FitCamera()
    {
        if (Camera.main == null || !Camera.main.orthographic) return;

        float effectiveSize = config.hexSize + config.hexSpacing;
        // 그리드의 대략적 높이 (반지름 기반)
        float gridHeight = effectiveSize * Mathf.Sqrt(3f) * config.gridRadius * 2f;
        float gridWidth = effectiveSize * 1.5f * config.gridRadius * 2f;

        float screenRatio = (float)Screen.width / Screen.height;
        float targetOrthoSize = Mathf.Max(
            gridHeight * 0.6f,
            gridWidth * 0.6f / screenRatio);

        Camera.main.orthographicSize = targetOrthoSize;
        Camera.main.transform.position = new Vector3(0, 0, -10);
    }

    /// <summary>
    /// 에디터 기즈모로 그리드 형태 확인 (Scene 뷰 전용).
    /// </summary>
    private void OnDrawGizmos()
    {
        if (config == null) return;

        float effectiveSize = config.hexSize + config.hexSpacing;
        int r = config.gridRadius;

        for (int q = -r; q <= r; q++)
        {
            int r1 = Mathf.Max(-r, -q - r);
            int r2 = Mathf.Min(r, -q + r);

            for (int ri = r1; ri <= r2; ri++)
            {
                CubeCoord coord = new CubeCoord(q, ri);
                Vector2 pos = CoordConverter.CubeToWorld(coord, effectiveSize);

                // 헥사곤 외곽선 그리기
                Gizmos.color = (q == 0 && ri == 0)
                    ? Color.yellow  // 중심 셀
                    : Color.white;

                DrawHexGizmo(
                    new Vector3(pos.x, pos.y, 0), config.hexSize);
            }
        }
    }

    /// <summary>기즈모로 헥사곤 한 개를 그린다.</summary>
    private void DrawHexGizmo(Vector3 center, float size)
    {
        // flat-top 헥사곤의 6꼭짓점
        for (int i = 0; i < 6; i++)
        {
            float angle1 = 60f * i * Mathf.Deg2Rad;
            float angle2 = 60f * (i + 1) * Mathf.Deg2Rad;

            Vector3 p1 = center + new Vector3(
                size * Mathf.Cos(angle1),
                size * Mathf.Sin(angle1), 0);
            Vector3 p2 = center + new Vector3(
                size * Mathf.Cos(angle2),
                size * Mathf.Sin(angle2), 0);

            Gizmos.DrawLine(p1, p2);
        }
    }
}
```

```csharp
/// <summary>
/// 개별 셀의 시각 표현 컴포넌트.
/// HexCell(Model)의 상태 변경을 시각적으로 반영한다.
/// </summary>
public class HexCellView : MonoBehaviour
{
    [SerializeField] private SpriteRenderer hexSprite;
    [SerializeField] private SpriteRenderer highlightSprite;

    private HexCell cell;

    // 상태별 색상 (ScriptableObject로 분리 가능)
    private static readonly Color EmptyColor = new Color(0.9f, 0.9f, 0.9f, 1f);
    private static readonly Color LockedColor = new Color(0.5f, 0.5f, 0.5f, 0.5f);
    private static readonly Color DisabledColor = new Color(0.3f, 0.3f, 0.3f, 0.3f);

    public void Initialize(HexCell cell, float hexSize)
    {
        this.cell = cell;
        transform.localScale = Vector3.one * hexSize * 2f;
        UpdateVisual();
    }

    /// <summary>
    /// 셀 상태에 따라 시각 요소를 갱신한다.
    /// </summary>
    public void UpdateVisual()
    {
        switch (cell.State)
        {
            case CellState.Empty:
                hexSprite.color = EmptyColor;
                break;
            case CellState.Occupied:
                // 블록이 자체 시각을 담당하므로, 셀은 배경만 표시
                hexSprite.color = EmptyColor;
                break;
            case CellState.Locked:
                hexSprite.color = LockedColor;
                break;
            case CellState.Disabled:
                hexSprite.color = DisabledColor;
                break;
        }
    }

    /// <summary>하이라이트 표시 (매칭 가능 블록 강조).</summary>
    public void SetHighlight(bool active)
    {
        if (highlightSprite != null)
            highlightSprite.enabled = active;
    }
}
```

### 예상 난이도

**상** - Unity 씬 통합, 프리팹 제작, 카메라 설정, 오브젝트 풀링 고려 등 다양한 요소가 관련된다. 특히 다양한 화면 해상도에서 그리드가 올바르게 표시되도록 하는 반응형 처리가 까다롭다.

### 의존성

- **선행 의존성**: STEP 1~7 전체 (모든 데이터 모델과 변환 로직이 필요)
- **후행 의존성**: `HexBlockView` (블록 시각화)가 `HexCellView` 위에 표시된다. `MergeInputHandler`가 `GridInputHelper`와 함께 셀 탭을 감지한다. `EffectController`가 셀 위치 기반으로 이펙트를 재생한다.

### 예상 구현 순서

**8번째 (마지막)** - 모든 데이터 로직 완성 후 최종 통합 단계에서 구현한다.

---

## 10. 에지 케이스 및 주의사항

### 10.1 CubeCoord 관련

| 에지 케이스 | 설명 | 대응 방안 |
|-------------|------|----------|
| 제약 조건 위반 | 3-파라미터 생성자에서 `q+r+s != 0`인 값이 전달됨 | `Debug.Assert` + 에디터에서 즉시 발견. 릴리즈 빌드에서는 `s = -q - r`로 강제 보정 검토 |
| GetHashCode 충돌 | 서로 다른 좌표가 같은 해시값을 가짐 | `Dictionary`의 정확성에는 영향 없음 (Equals 비교가 보완). 다만 성능 저하 가능. 해시 품질 모니터링 |
| int 오버플로우 | 매우 큰 반지름의 좌표 연산 | 실제 게임에서 radius는 최대 8 수준이므로 발생하지 않음. 방어 코드 불필요 |

### 10.2 좌표 변환 관련

| 에지 케이스 | 설명 | 대응 방안 |
|-------------|------|----------|
| 왕복 변환 불일치 | `CubeToOffset -> OffsetToCube`가 원래 값과 다름 | 단위 테스트에서 모든 그리드 좌표에 대해 왕복 변환 검증 |
| WorldToCube 경계 | 두 셀의 정확한 경계 지점에서 어느 셀이 선택되는지 | `CubeRound`의 결정론적 동작에 의존. 사용자 경험상 무시 가능 |
| hexSize = 0 | 헥사곤 크기가 0이면 0으로 나누기 발생 | `GridConfig`에서 `[Min(0.01f)]` 속성으로 최솟값 보장 |
| 음수 hexSize | 음수 크기 입력 | `Debug.Assert(hexSize > 0)` 추가 |

### 10.3 HexGrid 관련

| 에지 케이스 | 설명 | 대응 방안 |
|-------------|------|----------|
| radius = 0 | 반지름 0이면 셀 1개 (중심만) | 허용하되, 게임 플레이는 사실상 불가. 최소 radius 1 이상으로 제한 |
| 중복 GenerateGrid 호출 | 그리드를 두 번 생성하면 이전 데이터 유실 | `cells.Clear()` 호출 전 경고 로그. 기존 View 오브젝트 정리 필요 |
| 빈 셀이 0개인 상태 | `GetEmptyCells()` 빈 리스트 반환 시 블록 배치 불가 | 호출자에서 빈 리스트 체크 필수. `WaveSystem`에서 이미 처리됨 |

### 10.4 HexDirection / 인접 탐색 관련

| 에지 케이스 | 설명 | 대응 방안 |
|-------------|------|----------|
| 경계 셀의 인접 셀 | 보드 가장자리 셀은 인접 셀이 6개 미만 | `IsValidCoord()` 검사로 범위 밖 좌표 자동 제외 |
| BFS 시작점이 빈 셀 | `FindConnectedGroup`에 빈 셀 좌표를 전달 | 빈 리스트 반환 (정상 동작). 호출자에서 사전 체크 권장 |
| 그리드 전체가 같은 값 | 이론적으로 전체 61셀이 하나의 그룹 | BFS가 모든 셀을 방문하므로 정상 동작. 성능 문제 없음 (최대 61회 반복) |
| 잠긴(Locked) 셀의 인접 탐색 | 잠긴 셀을 인접 매칭에서 포함할지 | `GetMatchingNeighbors`에서 `CellState.Occupied`만 필터링하므로 Locked 셀은 자동 제외 |

### 10.5 시각화 관련

| 에지 케이스 | 설명 | 대응 방안 |
|-------------|------|----------|
| 화면 비율 극단값 | 매우 좁거나 넓은 화면에서 그리드가 잘림 | `FitCamera()`에서 가로/세로 모두 고려하여 `orthographicSize` 결정 |
| 셀 프리팹 누락 | Inspector에서 프리팹 미할당 | `[SerializeField]` 필드의 null 체크 + 에디터 경고 |
| View 없는 Cell | `cell.View`가 null인 상태에서 시각 갱신 시도 | null 체크 추가. 데이터 전용 테스트에서는 View 없이 동작 가능해야 함 |

---

## 11. 성능 최적화 고려사항

### 11.1 Dictionary vs 배열

| 항목 | Dictionary 방식 (현재 설계) | 2D 배열 방식 |
|------|---------------------------|-------------|
| 조회 속도 | O(1) 평균 | O(1) |
| 메모리 | 해시 테이블 오버헤드 | 낭비 영역 존재 (직사각형에 육각형 매핑) |
| 유연성 | 비정형 보드 지원 | 직사각형만 |
| 결론 | **채택** | 보류 |

radius 4 기준 61셀은 매우 적은 수이므로, Dictionary의 해시 오버헤드는 무시할 수 있다. 유연성을 위해 Dictionary 방식을 유지한다.

### 11.2 GetEmptyCells / GetOccupiedCells 최적화

현재 설계는 매 호출마다 LINQ `Where().ToList()`를 수행한다. 빈번한 호출 시 GC 압력이 될 수 있다.

**최적화 방안:**

```csharp
// 캐시 기반 접근: 셀 상태 변경 시 캐시 갱신
private List<HexCell> emptyCellsCache = new List<HexCell>();
private List<HexCell> occupiedCellsCache = new List<HexCell>();
private bool isCacheDirty = true;

public void InvalidateCache() => isCacheDirty = true;

public List<HexCell> GetEmptyCells()
{
    if (isCacheDirty) RebuildCache();
    return emptyCellsCache;
}

private void RebuildCache()
{
    emptyCellsCache.Clear();
    occupiedCellsCache.Clear();
    foreach (var cell in cells.Values)
    {
        if (cell.State == CellState.Empty) emptyCellsCache.Add(cell);
        else if (cell.State == CellState.Occupied) occupiedCellsCache.Add(cell);
    }
    isCacheDirty = false;
}
```

**주의**: 캐시 무효화 시점을 정확히 관리해야 한다. `PlaceBlock()`, `RemoveBlock()`, `Lock()`, `Unlock()` 호출 시 `InvalidateCache()`를 트리거해야 한다.

**권장**: 초기에는 LINQ 방식으로 구현하되, 프로파일링 결과에 따라 캐시 방식으로 전환한다. 61셀 규모에서는 LINQ도 충분히 빠르다.

### 11.3 BFS (FindConnectedGroup) 최적화

| 항목 | 설명 |
|------|------|
| 현재 구현 | 매 호출마다 `HashSet`, `Queue`, `List` 할당 |
| 최대 반복 | 61회 (radius 4 기준 전체 셀 수) |
| GC 영향 | 미미함 (매 프레임 호출되지 않음, 머지 시에만) |
| 최적화 방안 | 필요 시 오브젝트 풀 또는 정적 버퍼 사용 |

```csharp
// 정적 버퍼 활용 (GC 최소화)
private static readonly HashSet<CubeCoord> s_visited = new HashSet<CubeCoord>();
private static readonly Queue<CubeCoord> s_queue = new Queue<CubeCoord>();
private static readonly List<HexCell> s_result = new List<HexCell>();

public static List<HexCell> FindConnectedGroup(
    CubeCoord start, int value, HexGrid grid)
{
    s_visited.Clear();
    s_queue.Clear();
    s_result.Clear();

    // ... BFS 로직 동일 ...

    // 주의: 반환된 리스트는 다음 호출 시 덮어써짐
    // 호출자가 결과를 보관해야 하면 ToList() 복사 필요
    return new List<HexCell>(s_result);
}
```

**권장**: 61셀 규모에서는 과도한 최적화가 불필요하다. 코드 가독성을 우선하여 초기에는 매 호출 할당 방식을 유지한다.

### 11.4 시각화 오브젝트 풀링

```
셀 오브젝트: radius 4 -> 61개 (고정, 풀링 불필요)
블록 오브젝트: 최대 61개 (동적 생성/파괴 빈번 -> 풀링 권장)
이펙트 오브젝트: 머지/연쇄 시 생성 (풀링 강력 권장)
```

셀 프리팹은 그리드 생성 시 한 번만 인스턴스화하므로 풀링이 불필요하다. 블록과 이펙트 프리팹은 `ObjectPool` 패턴을 적용한다.

### 11.5 Sqrt(3) 사전 계산

`CoordConverter`에서 `Mathf.Sqrt(3f)`가 반복 호출된다. 상수로 캐싱한다:

```csharp
public static class CoordConverter
{
    private static readonly float SQRT3 = Mathf.Sqrt(3f);
    private static readonly float SQRT3_HALF = SQRT3 * 0.5f;
    private static readonly float SQRT3_THIRD = SQRT3 / 3f;

    public static Vector2 CubeToWorld(CubeCoord cube, float hexSize)
    {
        float x = hexSize * 1.5f * cube.q;
        float y = hexSize * (SQRT3_HALF * cube.q + SQRT3 * cube.r);
        return new Vector2(x, y);
    }
}
```

---

## 12. 단위 테스트 포인트

### 12.1 CubeCoord 테스트

| 테스트 ID | 테스트 항목 | 기대 결과 |
|-----------|------------|----------|
| CC-01 | 2-파라미터 생성자 `s` 자동 계산 | `CubeCoord(1, -1)` -> `s == 0` |
| CC-02 | 3-파라미터 제약 조건 위반 | `CubeCoord(1, 1, 1)` -> Assert 발생 |
| CC-03 | Distance: 인접 셀 | `Distance((0,0,0), (1,0,-1)) == 1` |
| CC-04 | Distance: 대각선 2칸 | `Distance((0,0,0), (2,-1,-1)) == 2` |
| CC-05 | Distance: 동일 좌표 | `Distance(a, a) == 0` |
| CC-06 | Equals: 같은 좌표 | `(1,0,-1).Equals((1,0,-1)) == true` |
| CC-07 | Equals: 다른 좌표 | `(1,0,-1).Equals((0,1,-1)) == false` |
| CC-08 | GetHashCode: 같은 좌표 동일 해시 | `a.GetHashCode() == b.GetHashCode()` (a == b일 때) |
| CC-09 | 연산자 `+` | `(1,0,-1) + (-1,0,1) == (0,0,0)` |
| CC-10 | 연산자 `-` | `(1,0,-1) - (1,0,-1) == (0,0,0)` |
| CC-11 | Dictionary 키로 사용 | 같은 좌표로 저장/조회 성공 |

### 12.2 OffsetCoord 테스트

| 테스트 ID | 테스트 항목 | 기대 결과 |
|-----------|------------|----------|
| OC-01 | 생성자 | `OffsetCoord(3, 2)` -> `col==3, row==2` |
| OC-02 | Equals | 같은 값이면 true |
| OC-03 | 다른 값 비교 | 다르면 false |

### 12.3 CoordConverter 테스트

| 테스트 ID | 테스트 항목 | 기대 결과 |
|-----------|------------|----------|
| CV-01 | 원점 Cube->Offset | `CubeToOffset((0,0,0)) == (0,0)` |
| CV-02 | 원점 Offset->Cube | `OffsetToCube((0,0)) == (0,0,0)` |
| CV-03 | 왕복 변환 (전체 그리드) | 모든 셀에 대해 `OffsetToCube(CubeToOffset(c)) == c` |
| CV-04 | 역왕복 변환 | 모든 오프셋에 대해 `CubeToOffset(OffsetToCube(o)) == o` |
| CV-05 | 원점 월드 좌표 | `CubeToWorld((0,0,0), 1.0) == (0,0)` |
| CV-06 | WorldToCube 정확한 중심 | `WorldToCube(CubeToWorld(c, size), size) == c` |
| CV-07 | WorldToCube 약간 벗어난 위치 | 셀 중심에서 소량 벗어나도 같은 셀 반환 |
| CV-08 | CubeRound 경계값 | 세 축의 반올림 오차가 동일한 극단 사례 |

### 12.4 HexCell 테스트

| 테스트 ID | 테스트 항목 | 기대 결과 |
|-----------|------------|----------|
| HC-01 | 초기 상태 | `State == Empty`, `Block == null`, `IsEmpty == true` |
| HC-02 | PlaceBlock | 상태 Occupied, Block 참조 설정 |
| HC-03 | PlaceBlock on Occupied | Assert 발생 |
| HC-04 | RemoveBlock | 상태 Empty, Block null, 제거된 블록 반환 |
| HC-05 | RemoveBlock on Empty | Assert 발생 |
| HC-06 | Lock -> Unlock (블록 있음) | Occupied로 복귀 |
| HC-07 | Lock -> Unlock (블록 없음) | Empty로 복귀 |
| HC-08 | IsInteractable | Occupied일 때만 true |

### 12.5 HexGrid 테스트

| 테스트 ID | 테스트 항목 | 기대 결과 |
|-----------|------------|----------|
| HG-01 | radius=2 셀 수 | 19개 |
| HG-02 | radius=3 셀 수 | 37개 |
| HG-03 | radius=4 셀 수 | 61개 (기본값) |
| HG-04 | radius=5 셀 수 | 91개 |
| HG-05 | 원점 셀 존재 | `GetCell((0,0,0)) != null` |
| HG-06 | 범위 밖 좌표 | `GetCell((radius+1, 0, -radius-1)) == null` |
| HG-07 | IsValidCoord 경계 | 반지름 거리 셀은 유효, 반지름+1은 무효 |
| HG-08 | 초기 GetEmptyCells | 모든 셀이 Empty -> 전체 셀 수 반환 |
| HG-09 | GetOccupiedCells 초기 | 빈 리스트 반환 |
| HG-10 | ClearAllBlocks | 블록 배치 후 ClearAllBlocks -> 모든 셀 Empty |

### 12.6 HexDirection 테스트

| 테스트 ID | 테스트 항목 | 기대 결과 |
|-----------|------------|----------|
| HD-01 | 중심 셀 인접 수 | `GetNeighbors((0,0,0), grid)` -> 6개 |
| HD-02 | 꼭짓점 셀 인접 수 | 보드 꼭짓점 셀 -> 3개 |
| HD-03 | 변 중간 셀 인접 수 | 보드 변 중간 셀 -> 4개 (또는 상황에 따라 다름) |
| HD-04 | GetMatchingNeighbors | 인접에 같은 값 있으면 포함, 다른 값은 제외 |
| HD-05 | FindConnectedGroup 단일 셀 | 인접에 같은 값 없으면 그룹 크기 1 |
| HD-06 | FindConnectedGroup 체인 | 같은 값으로 연결된 3개 셀 -> 그룹 크기 3 |
| HD-07 | FindConnectedGroup 분리 | 같은 값이지만 연결되지 않은 경우 -> 별도 그룹 |
| HD-08 | BFS 방문 중복 방지 | 순환 구조에서 무한 루프 없음 |

### 12.7 통합 테스트

| 테스트 ID | 테스트 항목 | 기대 결과 |
|-----------|------------|----------|
| IT-01 | 그리드 생성 -> 블록 배치 -> 인접 탐색 | 전체 파이프라인 정상 동작 |
| IT-02 | 좌표 변환 -> 셀 조회 일관성 | Cube->World->Cube->GetCell 올바른 셀 반환 |
| IT-03 | 다양한 radius 값 테스트 | 1~8 모든 반지름에서 그리드 생성/탐색 정상 |
| IT-04 | 전체 셀 블록 배치 -> GetEmptyCells 0개 | 빈 셀 없음 확인 |
| IT-05 | 셀 잠금 중 PlaceBlock 시도 | Assert 또는 실패 반환 |

---

## 부록: 파일 구조 요약

```
Assets/_Project/Scripts/Core/Grid/
    CubeCoord.cs           # STEP 1 - 큐브 좌표 구조체
    OffsetCoord.cs         # STEP 2 - 오프셋 좌표 구조체
    CoordConverter.cs      # STEP 3, 7 - 좌표 변환 유틸리티
    HexCell.cs             # STEP 4 - 셀 데이터 클래스 (CellState 포함)
    HexGrid.cs             # STEP 5 - 그리드 관리 클래스
    HexDirection.cs        # STEP 6 - 방향 및 인접 탐색

Assets/_Project/Scripts/View/
    HexCellView.cs         # STEP 8 - 셀 시각 표현
    GridRenderer.cs        # STEP 8 - 그리드 렌더링 관리자

Assets/_Project/ScriptableObjects/
    GridConfig.asset       # STEP 8 - 그리드 설정 데이터

Assets/_Project/Scripts/Utils/
    GridInputHelper.cs     # STEP 7 - 입력 좌표 변환 헬퍼
```
