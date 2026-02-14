# 03. 스코어링 시스템 & 게임 상태 관리 - 상세 개발 계획서

| 항목 | 내용 |
|------|------|
| **기반 설계문서** | `docs/design/01_core-system-design.md` - 4장, 5장 |
| **대상 모듈** | Score, State, Data |
| **문서 버전** | v1.0 |
| **최종 수정일** | 2026-02-13 |

---

## 목차

1. [점수 계산 시스템](#1-점수-계산-시스템)
2. [콤보/연쇄 보너스 시스템](#2-콤보연쇄-보너스-시스템)
3. [마일스톤 보너스 시스템](#3-마일스톤-보너스-시스템)
4. [점수 UI 연동](#4-점수-ui-연동)
5. [게임 상태 머신 구현](#5-게임-상태-머신-구현)
6. [게임 루프 구현](#6-게임-루프-구현)
7. [세이브/로드 시스템](#7-세이브로드-시스템)
8. [오프라인 데이터 관리](#8-오프라인-데이터-관리)
9. [리더보드 연동](#9-리더보드-연동)
10. [통합 테스트 계획](#10-통합-테스트-계획)

---

## 1. 점수 계산 시스템

### 1.1 구현 체크리스트

- [ ] `ScoreSystem` 클래스 기본 구조 생성
- [ ] `CalculateMergeScore()` 점수 계산 메서드 구현
- [ ] `AddScore()` 점수 누적 메서드 구현
- [ ] `ResetCurrentScore()` 초기화 메서드 구현
- [ ] `GetCurrentScore()` / `GetHighScore()` 조회 메서드 구현
- [ ] `OnScoreChanged` 이벤트 발행 구현
- [ ] `OnHighScoreChanged` 이벤트 발행 구현
- [ ] PlayerPrefs 기반 최고 점수 저장(`SaveHighScore`) 구현
- [ ] PlayerPrefs 기반 최고 점수 로드(`LoadHighScore`) 구현
- [ ] `ScoreConfig` ScriptableObject 설정 파일 생성
- [ ] 단위 테스트 작성 (점수 계산 공식 검증)

### 1.2 구현 설명

점수 시스템은 플레이어의 진행도를 수치로 표현하는 핵심 모듈이다. 매 머지 시 `MergeProcessor`로부터 머지 결과값과 연쇄 깊이를 전달받아 점수를 계산한다. 계산된 점수는 현재 점수에 누적되며, 최고 점수 갱신 여부를 실시간으로 체크한다.

### 1.3 점수 계산 공식 상세

#### 기본 머지 점수

```
기본 점수 = 머지 결과 값 (mergedValue)
```

| 머지 조합 | 결과 값 | 기본 점수 |
|-----------|---------|-----------|
| 2 + 2 | 4 | 4 |
| 4 + 4 | 8 | 8 |
| 8 + 8 | 16 | 16 |
| 16 + 16 | 32 | 32 |
| 32 + 32 | 64 | 64 |
| 64 + 64 | 128 | 128 |
| 128 + 128 | 256 | 256 |
| 256 + 256 | 512 | 512 |
| 512 + 512 | 1024 | 1,024 |
| 1024 + 1024 | 2048 | 2,048 |

#### 연쇄 보너스 적용 공식

```
최종 점수 = Floor(기본 점수 * 연쇄 보너스 배율)
연쇄 보너스 배율 = 1.0 + (chainDepth * 0.5)
```

| 연쇄 단계 | 배율 | 예시 (결과값 8) | 획득 점수 |
|-----------|------|----------------|-----------|
| 0단계 (일반 머지) | x1.0 | 8 * 1.0 | 8 |
| 1단계 | x1.5 | 8 * 1.5 | 12 |
| 2단계 | x2.0 | 8 * 2.0 | 16 |
| 3단계 | x2.5 | 8 * 2.5 | 20 |
| 4단계 | x3.0 | 8 * 3.0 | 24 |
| 5단계 | x3.5 | 8 * 3.5 | 28 |

### 1.4 필요한 클래스/메서드 목록

| 클래스 | 메서드 | 반환 타입 | 설명 |
|--------|--------|-----------|------|
| `ScoreSystem` | `CalculateMergeScore(int mergedValue, int chainDepth)` | `int` | 머지 점수 계산 |
| `ScoreSystem` | `AddScore(int amount)` | `void` | 점수 누적 |
| `ScoreSystem` | `GetCurrentScore()` | `int` | 현재 점수 반환 |
| `ScoreSystem` | `GetHighScore()` | `int` | 최고 점수 반환 |
| `ScoreSystem` | `ResetCurrentScore()` | `void` | 현재 점수 초기화 |
| `ScoreSystem` | `LoadHighScore()` | `void` | PlayerPrefs에서 최고 점수 로드 |
| `ScoreSystem` | `SaveHighScore()` | `void` | PlayerPrefs에 최고 점수 저장 |

### 1.5 코드 스니펫

```csharp
/// <summary>
/// 점수 계산 및 관리 시스템.
/// 경로: Assets/_Project/Scripts/Core/Score/ScoreSystem.cs
/// </summary>
public class ScoreSystem
{
    private int currentScore = 0;
    private int highScore = 0;
    private int highestBlockValue = 0;
    private HashSet<int> achievedMilestones = new HashSet<int>();

    // --- 이벤트 ---
    public System.Action<int> OnScoreChanged;
    public System.Action<int> OnHighScoreChanged;
    public System.Action<int, int> OnMilestoneAchieved;

    /// <summary>
    /// 머지 점수 계산.
    /// 기본 점수 = mergedValue, 연쇄 배율 = 1.0 + (chainDepth * 0.5)
    /// </summary>
    public int CalculateMergeScore(int mergedValue, int chainDepth)
    {
        float baseScore = mergedValue;
        float chainMultiplier = 1.0f + (chainDepth * 0.5f);
        int finalScore = Mathf.FloorToInt(baseScore * chainMultiplier);
        return finalScore;
    }

    /// <summary>
    /// 점수 누적. 최고 점수 갱신 시 자동 저장.
    /// </summary>
    public void AddScore(int amount)
    {
        currentScore += amount;
        OnScoreChanged?.Invoke(currentScore);

        if (currentScore > highScore)
        {
            highScore = currentScore;
            OnHighScoreChanged?.Invoke(highScore);
            SaveHighScore();
        }
    }

    public int GetCurrentScore() => currentScore;
    public int GetHighScore() => highScore;

    public void ResetCurrentScore()
    {
        currentScore = 0;
        OnScoreChanged?.Invoke(currentScore);
    }

    private void SaveHighScore()
    {
        PlayerPrefs.SetInt("HighScore", highScore);
        PlayerPrefs.Save();
    }

    public void LoadHighScore()
    {
        highScore = PlayerPrefs.GetInt("HighScore", 0);
    }
}
```

### 1.6 예상 난이도

**하** -- 단순한 산술 연산과 PlayerPrefs 기반 저장으로 구성되어 있어 복잡도가 낮다.

### 1.7 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `MergeProcessor` | <-- (호출받음) | 머지 완료 시 `CalculateMergeScore` 호출 |
| `PlayerPrefs` (Unity) | --> (사용) | 최고 점수 로컬 저장 |
| `ScoreConfig` (ScriptableObject) | --> (참조) | 배율 상수 등 설정값 외부화 |

---

## 2. 콤보/연쇄 보너스 시스템

### 2.1 구현 체크리스트

- [ ] `ChainProcessor` 클래스 내 연쇄 머지 감지 로직 구현
- [ ] 연쇄 깊이(chainDepth) 카운팅 로직 구현
- [ ] 연쇄 단계별 점수 계산 (`ScoreSystem.CalculateMergeScore` 연동)
- [ ] 최대 연쇄 깊이 제한 (`MAX_CHAIN_DEPTH = 20`) 적용
- [ ] 연쇄 발생 시 `OnChainMerge` 이벤트 발행
- [ ] 연쇄 이펙트 트리거 연동 (이펙트 시스템과 연결)
- [ ] 콤보 카운터 UI 연동 (`ComboDisplay` 컴포넌트)
- [ ] 연쇄 보너스 배율 ScriptableObject 설정 외부화
- [ ] 단위 테스트 작성 (연쇄 점수 누적 검증)

### 2.2 구현 설명

연쇄 머지(체인)는 머지 결과로 생긴 블록이 인접한 같은 값의 블록과 자동으로 추가 머지되는 메커니즘이다. 연쇄가 발생할 때마다 `chainDepth`가 1씩 증가하며, 보너스 배율은 `1.0 + (chainDepth * 0.5)`로 계산된다. 한 번에 하나의 인접 블록만 흡수하며, 값이 변경되면 재귀적으로 다시 인접 블록을 탐색한다.

### 2.3 연쇄 점수 계산 예시

```
시나리오: 2 + 2 -> 4 -> 4+4=8 -> 8+8=16 (3단계 연쇄)

1단계 (일반 머지): 4 * 1.0 = 4점
2단계 (연쇄 1):    8 * 1.5 = 12점
3단계 (연쇄 2):   16 * 2.0 = 32점
--------------------------------------
총 획득 점수:                 48점
```

```
시나리오: 64 + 64 -> 128 -> 128+128=256 -> 256+256=512 (3단계 연쇄)

1단계 (일반 머지): 128 * 1.0 = 128점
2단계 (연쇄 1):    256 * 1.5 = 384점
3단계 (연쇄 2):    512 * 2.0 = 1,024점
--------------------------------------
총 획득 점수:                   1,536점
```

### 2.4 필요한 클래스/메서드 목록

| 클래스 | 메서드 | 반환 타입 | 설명 |
|--------|--------|-----------|------|
| `ChainProcessor` | `ProcessChainMerge(HexCell mergedCell, int currentChainDepth)` | `UniTask<List<ChainResult>>` | 재귀적 연쇄 머지 처리 |
| `ChainProcessor` | `AnimateChainMerge(HexCell source, HexCell target)` | `UniTask` | 연쇄 머지 애니메이션 실행 |
| `HexDirection` | `GetMatchingNeighbors(CubeCoord center, int value, HexGrid grid)` | `List<HexCell>` | 인접 동일값 블록 탐색 |
| `ChainResult` | (데이터 클래스) | -- | 연쇄 결과 저장 (깊이, 좌표, 결과값) |

### 2.5 코드 스니펫

```csharp
/// <summary>
/// 연쇄 머지 처리기.
/// 경로: Assets/_Project/Scripts/Core/Merge/ChainProcessor.cs
/// </summary>
public class ChainProcessor
{
    private HexGrid grid;
    private ScoreSystem scoreSystem;
    private const int MAX_CHAIN_DEPTH = 20;

    // 이벤트
    public System.Action<ChainResult> OnChainMerge;

    /// <summary>
    /// 연쇄 머지 처리. 머지 후 인접 같은 값 블록이 있으면 자동 머지.
    /// 재귀적으로 처리하며, MAX_CHAIN_DEPTH에서 중단.
    /// </summary>
    public async UniTask<List<ChainResult>> ProcessChainMerge(
        HexCell mergedCell,
        int currentChainDepth)
    {
        List<ChainResult> chainResults = new List<ChainResult>();

        if (currentChainDepth >= MAX_CHAIN_DEPTH) return chainResults;

        // 인접 셀에서 같은 값의 블록 탐색
        List<HexCell> adjacentMatches = HexDirection.GetMatchingNeighbors(
            mergedCell.Coord,
            mergedCell.Block.Value,
            grid
        );

        if (adjacentMatches.Count == 0) return chainResults;

        foreach (var adjacentCell in adjacentMatches)
        {
            if (adjacentCell.State != CellState.Occupied) continue;
            if (adjacentCell.Block.Value != mergedCell.Block.Value) continue;

            // 연쇄 머지 실행
            ChainResult chain = new ChainResult
            {
                ChainDepth = currentChainDepth,
                AbsorbedCoord = adjacentCell.Coord,
                ResultCoord = mergedCell.Coord
            };

            adjacentCell.Lock();
            await AnimateChainMerge(adjacentCell, mergedCell);

            HexBlock absorbed = adjacentCell.RemoveBlock();
            DestroyBlock(absorbed);
            mergedCell.Block.LevelUp();

            chain.ResultValue = mergedCell.Block.Value;
            adjacentCell.Unlock();

            // 연쇄 점수 계산 및 가산
            int chainScore = scoreSystem.CalculateMergeScore(
                chain.ResultValue, currentChainDepth);
            scoreSystem.AddScore(chainScore);

            chainResults.Add(chain);
            OnChainMerge?.Invoke(chain);

            // 재귀적으로 다음 연쇄 체크
            var deeperChains = await ProcessChainMerge(
                mergedCell, currentChainDepth + 1);
            chainResults.AddRange(deeperChains);

            break; // 값이 변경되므로 한 번에 하나씩 처리
        }

        return chainResults;
    }
}

/// <summary>
/// 연쇄 머지 개별 결과 데이터.
/// </summary>
public class ChainResult
{
    public int ChainDepth;          // 연쇄 깊이 (1부터)
    public CubeCoord AbsorbedCoord; // 흡수된 블록의 좌표
    public CubeCoord ResultCoord;   // 결과 블록의 좌표
    public int ResultValue;         // 연쇄 머지 후 값
}
```

### 2.6 예상 난이도

**중** -- 재귀적 연쇄 처리, 비동기 애니메이션 대기, 상태 변경 추적 등 여러 시스템의 상호작용이 필요하다. 무한 루프 방지를 위한 안전장치도 검증해야 한다.

### 2.7 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `ScoreSystem` | --> (호출) | 연쇄 단계별 점수 계산 요청 |
| `HexGrid` | --> (조회) | 인접 셀 및 블록 상태 탐색 |
| `HexDirection` | --> (사용) | `GetMatchingNeighbors()` 인접 탐색 유틸리티 |
| `MergeProcessor` | <-- (호출받음) | 머지 실행 후 연쇄 처리 요청 |
| `EffectController` | --> (트리거) | 연쇄 이펙트 재생 |
| `ComboDisplay` (UI) | --> (이벤트) | 콤보 카운터 표시 |
| UniTask | --> (사용) | 비동기 애니메이션 대기 |

---

## 3. 마일스톤 보너스 시스템

### 3.1 구현 체크리스트

- [ ] `CheckMilestone(int blockValue)` 메서드 구현
- [ ] 마일스톤 보너스 테이블 정의 (Dictionary)
- [ ] `achievedMilestones` HashSet으로 중복 달성 방지
- [ ] `OnMilestoneAchieved` 이벤트 발행 구현
- [ ] 마일스톤 달성 시 보너스 점수 자동 가산
- [ ] 마일스톤 달성 축하 UI 팝업 트리거 구현
- [ ] 마일스톤 상태 세이브/로드 연동
- [ ] `MilestoneManager` 별도 클래스 분리 (선택적)
- [ ] 단위 테스트 작성 (마일스톤 중복 방지, 보너스 정확성)

### 3.2 구현 설명

마일스톤은 특정 값의 블록을 **최초로** 생성했을 때 1회 한정 보너스 점수를 부여하는 시스템이다. 한 번 달성한 마일스톤은 `achievedMilestones` HashSet에 기록되어 중복 보너스를 방지한다. 머지 결과가 여러 단계를 한 번에 건너뛸 경우(예: 연쇄로 64에서 256까지), 사이의 미달성 마일스톤도 일괄 지급한다.

### 3.3 마일스톤 보너스 테이블

| 달성 값 | 보너스 점수 | 누적 보너스 | 비고 |
|---------|------------|-------------|------|
| 128 | 500 | 500 | 첫 128 달성 |
| 256 | 1,000 | 1,500 | 첫 256 달성 |
| 512 | 2,500 | 4,000 | 첫 512 달성 |
| 1024 | 5,000 | 9,000 | 첫 1K 달성 |
| 2048 | 10,000 | 19,000 | 첫 2K 달성 |
| 4096 | 25,000 | 44,000 | 첫 4K 달성 |
| 8192 | 50,000 | 94,000 | 첫 8K 달성 |
| 16384 | 100,000 | 194,000 | 첫 16K 달성 |

### 3.4 필요한 클래스/메서드 목록

| 클래스 | 메서드 | 반환 타입 | 설명 |
|--------|--------|-----------|------|
| `ScoreSystem` | `CheckMilestone(int blockValue)` | `int` | 마일스톤 체크 및 보너스 반환 |
| `MilestoneManager` (선택) | `Initialize(HashSet<int> achieved)` | `void` | 세이브 데이터에서 달성 상태 복원 |
| `MilestoneManager` (선택) | `GetAchievedMilestones()` | `HashSet<int>` | 저장용 달성 목록 반환 |

### 3.5 코드 스니펫

```csharp
/// <summary>
/// 마일스톤 체크. 새로운 최고 블록 값 달성 시 호출.
/// ScoreSystem 내부 메서드 또는 MilestoneManager로 분리 가능.
/// </summary>
public int CheckMilestone(int blockValue)
{
    int bonusScore = 0;

    if (blockValue > highestBlockValue)
    {
        highestBlockValue = blockValue;

        // 사이에 있는 모든 미달성 마일스톤을 일괄 체크
        foreach (var milestone in MilestoneBonuses)
        {
            if (milestone.Key <= blockValue &&
                !achievedMilestones.Contains(milestone.Key))
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

// 마일스톤 보너스 테이블 (static readonly)
private static readonly Dictionary<int, int> MilestoneBonuses = new()
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
```

### 3.6 예상 난이도

**하** -- Dictionary 조회와 HashSet 중복 검사 기반의 단순 로직이다. 세이브/로드와의 연동만 주의하면 된다.

### 3.7 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `ScoreSystem.AddScore()` | --> (내부 호출) | 보너스 점수 가산 |
| `GameLoop.OnMergeCompleted` | <-- (호출받음) | 머지 완료 후 마일스톤 체크 트리거 |
| `SaveManager` | <-> (양방향) | 달성 마일스톤 목록 저장/복원 |
| `UIManager` | --> (이벤트) | 축하 팝업 표시 트리거 |

---

## 4. 점수 UI 연동

### 4.1 구현 체크리스트

- [ ] `ScoreDisplay` 컴포넌트 구현 (현재 점수 표시)
- [ ] 최고 점수 표시 UI 구현
- [ ] 점수 변경 시 카운트업 애니메이션 구현 (DOTween)
- [ ] 콤보 발생 시 `ComboDisplay` 팝업 구현
- [ ] 마일스톤 달성 축하 배너 구현
- [ ] 점수 증가분 플로팅 텍스트(+N) 구현
- [ ] 최고 점수 갱신 시 "NEW!" 배지 표시 구현
- [ ] 점수 표시 포맷팅 (1,000 단위 콤마, 대형 숫자 축약)

### 4.2 구현 설명

점수 UI는 `ScoreSystem`의 이벤트(`OnScoreChanged`, `OnHighScoreChanged`, `OnMilestoneAchieved`)를 구독하여 변경사항을 실시간으로 화면에 반영한다. DOTween을 활용한 카운트업 애니메이션으로 점수 변경을 시각적으로 표현하며, 연쇄 머지 시 콤보 카운터를 화면에 오버레이 표시한다.

### 4.3 필요한 클래스/메서드 목록

| 클래스 | 메서드 | 반환 타입 | 설명 |
|--------|--------|-----------|------|
| `ScoreDisplay` | `UpdateScore(int newScore)` | `void` | 점수 텍스트 갱신 (카운트업) |
| `ScoreDisplay` | `UpdateHighScore(int newHighScore)` | `void` | 최고 점수 텍스트 갱신 |
| `ScoreDisplay` | `ShowNewHighScoreBadge()` | `void` | "NEW!" 배지 표시 |
| `ComboDisplay` | `ShowCombo(int chainDepth, float multiplier)` | `void` | 콤보 카운터 표시 |
| `ComboDisplay` | `HideCombo()` | `void` | 콤보 카운터 숨김 |
| `FloatingScoreText` | `Show(Vector3 worldPos, int score)` | `void` | +N 텍스트 팝업 |

### 4.4 코드 스니펫

```csharp
/// <summary>
/// 점수 표시 UI 컴포넌트.
/// 경로: Assets/_Project/Scripts/UI/Components/ScoreDisplay.cs
/// </summary>
public class ScoreDisplay : MonoBehaviour
{
    [SerializeField] private TMP_Text currentScoreText;
    [SerializeField] private TMP_Text highScoreText;
    [SerializeField] private GameObject newHighScoreBadge;
    [SerializeField] private float countUpDuration = 0.5f;

    private int displayedScore = 0;
    private Tweener countUpTween;

    public void Initialize(ScoreSystem scoreSystem)
    {
        scoreSystem.OnScoreChanged += UpdateScore;
        scoreSystem.OnHighScoreChanged += UpdateHighScore;
    }

    /// <summary>
    /// 카운트업 애니메이션으로 점수 표시 갱신.
    /// </summary>
    public void UpdateScore(int newScore)
    {
        countUpTween?.Kill();
        countUpTween = DOTween.To(
            () => displayedScore,
            x =>
            {
                displayedScore = x;
                currentScoreText.text = FormatScore(x);
            },
            newScore,
            countUpDuration
        ).SetEase(Ease.OutQuad);
    }

    public void UpdateHighScore(int newHighScore)
    {
        highScoreText.text = FormatScore(newHighScore);
        ShowNewHighScoreBadge();
    }

    private void ShowNewHighScoreBadge()
    {
        newHighScoreBadge.SetActive(true);
        newHighScoreBadge.transform
            .DOScale(1.2f, 0.3f)
            .SetLoops(2, LoopType.Yoyo);
    }

    /// <summary>
    /// 점수 포맷팅. 1,000 단위 콤마 적용.
    /// </summary>
    private string FormatScore(int score)
    {
        return score.ToString("N0");
    }
}

/// <summary>
/// 콤보 표시 UI 컴포넌트.
/// 경로: Assets/_Project/Scripts/UI/Components/ComboDisplay.cs
/// </summary>
public class ComboDisplay : MonoBehaviour
{
    [SerializeField] private TMP_Text comboText;
    [SerializeField] private CanvasGroup canvasGroup;

    public void ShowCombo(int chainDepth, float multiplier)
    {
        canvasGroup.alpha = 1f;
        comboText.text = $"x{multiplier:F1} COMBO!";
        transform.DOScale(1.3f, 0.15f)
            .SetLoops(2, LoopType.Yoyo);
    }

    public void HideCombo()
    {
        canvasGroup.DOFade(0f, 0.5f);
    }
}
```

### 4.5 예상 난이도

**중** -- DOTween 기반 애니메이션 로직, 오브젝트 풀링(플로팅 텍스트), 이벤트 구독 관리 등이 복합적으로 필요하다.

### 4.6 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `ScoreSystem` (이벤트) | <-- (구독) | `OnScoreChanged`, `OnHighScoreChanged` |
| `ChainProcessor` (이벤트) | <-- (구독) | `OnChainMerge` 콤보 표시 |
| DOTween | --> (사용) | 카운트업, 스케일 펀치 애니메이션 |
| TextMeshPro | --> (사용) | 텍스트 렌더링 |
| `ObjectPool` | --> (사용) | 플로팅 텍스트 풀링 |

---

## 5. 게임 상태 머신 구현

### 5.1 구현 체크리스트

- [ ] `GameState` 열거형 정의 (Loading, MainMenu, Playing, Paused, Reshuffling, Tutorial)
- [ ] `GameStateManager` 클래스 구현
- [ ] `TransitionTo(GameState newState)` 상태 전환 메서드 구현
- [ ] `IsValidTransition()` 유효 전환 검증 로직 구현
- [ ] `RegisterEnterCallback()` 상태 진입 콜백 등록 구현
- [ ] `RegisterExitCallback()` 상태 이탈 콜백 등록 구현
- [ ] `OnStateChanged` 이벤트 발행 구현
- [ ] 각 상태 진입 시 시스템 동작 정의 (입력 활성화/비활성화 등)
- [ ] 유효하지 않은 전환 시 경고 로그 출력
- [ ] 상태 전환 단위 테스트 작성

### 5.2 구현 설명

게임 상태 머신은 게임 전체의 생명 주기를 제어하는 핵심 모듈이다. 허용된 상태 전환만을 수행하며, 잘못된 전환 시도는 거부하고 경고 로그를 출력한다. 각 상태에는 진입(Enter)/이탈(Exit) 콜백을 등록할 수 있어, 상태 전환 시 관련 시스템이 자동으로 활성화/비활성화된다.

### 5.3 상태 전이 다이어그램

```
[Loading] ----> [MainMenu] ----> [Playing] <----> [Paused]
    |               |                |
    +----> [Tutorial] <----+        +----> [Reshuffling]
                |                          |
                +----> [Playing] <---------+
                |
                +----> [MainMenu]
```

### 5.4 허용된 상태 전환 목록

| From 상태 | To 상태 | 트리거 |
|-----------|---------|--------|
| Loading | MainMenu | 리소스 로딩 완료 |
| Loading | Tutorial | 첫 실행 감지 |
| MainMenu | Playing | "새 게임" 또는 "이어하기" 버튼 |
| MainMenu | Tutorial | "튜토리얼" 버튼 |
| Playing | Paused | 일시정지 버튼 또는 앱 백그라운드 |
| Playing | Reshuffling | 매칭 가능한 쌍 없음 감지 |
| Playing | MainMenu | 메뉴로 돌아가기 |
| Paused | Playing | "계속하기" 버튼 |
| Paused | MainMenu | "메인 메뉴로" 버튼 |
| Reshuffling | Playing | 리셔플 완료 |
| Tutorial | Playing | 튜토리얼 완료 |
| Tutorial | MainMenu | 튜토리얼 중단 |

### 5.5 필요한 클래스/메서드 목록

| 클래스 | 메서드/속성 | 반환 타입 | 설명 |
|--------|------------|-----------|------|
| `GameStateManager` | `CurrentState` (속성) | `GameState` | 현재 상태 조회 |
| `GameStateManager` | `PreviousState` (속성) | `GameState` | 이전 상태 조회 |
| `GameStateManager` | `TransitionTo(GameState newState)` | `bool` | 상태 전환 (성공 여부 반환) |
| `GameStateManager` | `RegisterEnterCallback(GameState, Action)` | `void` | 진입 콜백 등록 |
| `GameStateManager` | `RegisterExitCallback(GameState, Action)` | `void` | 이탈 콜백 등록 |
| `GameStateManager` | `OnStateChanged` (이벤트) | `Action<GameState, GameState>` | 상태 변경 알림 |

### 5.6 코드 스니펫

```csharp
/// <summary>
/// 게임 상태 열거형.
/// 경로: Assets/_Project/Scripts/Core/State/GameStateManager.cs
/// </summary>
public enum GameState
{
    Loading,        // 리소스 로딩 중
    MainMenu,       // 메인 메뉴 화면
    Playing,        // 게임 플레이 중
    Paused,         // 일시정지
    Reshuffling,    // 리셔플 애니메이션 중
    Tutorial        // 튜토리얼 진행 중
}

/// <summary>
/// 게임 상태 머신. 유효한 전환만 허용하며,
/// 진입/이탈 콜백으로 관련 시스템을 자동 제어한다.
/// </summary>
public class GameStateManager
{
    public GameState CurrentState { get; private set; } = GameState.Loading;
    public GameState PreviousState { get; private set; }

    public System.Action<GameState, GameState> OnStateChanged;

    private Dictionary<GameState, System.Action> enterCallbacks = new();
    private Dictionary<GameState, System.Action> exitCallbacks = new();

    /// <summary>
    /// 상태 전환. 유효하지 않은 전환은 false 반환 후 무시.
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
        if (exitCallbacks.TryGetValue(CurrentState, out var exitCb))
            exitCb?.Invoke();

        CurrentState = newState;

        // 새 상태 진입 콜백
        if (enterCallbacks.TryGetValue(newState, out var enterCb))
            enterCb?.Invoke();

        OnStateChanged?.Invoke(PreviousState, CurrentState);
        return true;
    }

    /// <summary>
    /// 패턴 매칭 기반 유효 전환 검증.
    /// </summary>
    private bool IsValidTransition(GameState from, GameState to)
    {
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

    public void RegisterEnterCallback(GameState state, System.Action callback)
        => enterCallbacks[state] = callback;

    public void RegisterExitCallback(GameState state, System.Action callback)
        => exitCallbacks[state] = callback;
}
```

### 5.7 예상 난이도

**중** -- 상태 전환 자체는 단순하지만, 각 상태 진입/이탈 시 연동해야 하는 시스템(입력, UI, 저장, 오디오 등)이 많아 통합 테스트에 주의가 필요하다.

### 5.8 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `GameLoop` | <-- (소유) | GameLoop이 GameStateManager를 보유하고 상태 기반 분기 |
| `MergeInputHandler` | --> (제어) | Playing 상태에서만 입력 활성화 |
| `UIManager` | --> (이벤트) | 상태별 화면 전환 트리거 |
| `SaveManager` | --> (호출) | Paused 진입 시 자동 저장 |
| `AudioManager` | --> (제어) | Paused 상태에서 BGM 일시정지 |

---

## 6. 게임 루프 구현

### 6.1 구현 체크리스트

- [ ] `GameLoop` MonoBehaviour 클래스 구현
- [ ] `OnMergeCompleted(MergeResult)` 머지 완료 콜백 구현
- [ ] 마일스톤 체크 호출 흐름 구현
- [ ] 웨이브 생성 결과 처리 및 애니메이션 대기 구현
- [ ] 보드 매칭 가능 여부 체크 구현
- [ ] `PerformReshuffle()` 리셔플 로직 구현
- [ ] 리셔플 시 블록 재배치 알고리즘 구현
- [ ] 자동 저장 호출 타이밍 구현
- [ ] 입력 재활성화 로직 구현
- [ ] GameStateManager 연동 (Playing 상태에서만 게임 루프 작동)

### 6.2 구현 설명

게임 루프는 머지 완료 이벤트를 수신하여 후속 처리(마일스톤 체크, 웨이브 처리, 보드 상태 확인, 리셔플, 자동 저장)를 순차적으로 수행한다. `GameStateManager`의 `CurrentState`가 `Playing`인 경우에만 동작하며, 리셔플 중에는 `Reshuffling` 상태로 전환하여 입력을 차단한다. 이 게임은 게임오버가 없는 무한 플레이 구조이므로, 매칭 불가 상황에서 리셔플을 통해 플레이를 지속시킨다.

### 6.3 게임 루프 흐름

```
입력 대기 -> 블록 탭 감지 -> 매칭 판정
  |                                |
  |          실패 -> 선택 해제 -> (돌아감)
  |          성공 -> 머지 실행
  |                    |
  |              점수 계산 (ScoreSystem)
  |                    |
  |              연쇄 체크 (ChainProcessor)
  |               /          \
  |           있음            없음
  |            |               |
  |        연쇄 머지            |
  |            |               |
  |        웨이브 생성 ---------+
  |                    |
  |              보드 체크
  |             /        \
  |          여유      가득 참
  |            |          |
  |            |    매칭 가능 체크
  |            |     /        \
  |            |   있음       없음
  |            |    |          |
  |            +----+      리셔플
  |                           |
  +---- 자동 저장 <--- 입력 재활성화
```

### 6.4 필요한 클래스/메서드 목록

| 클래스 | 메서드 | 반환 타입 | 설명 |
|--------|--------|-----------|------|
| `GameLoop` | `OnMergeCompleted(MergeResult result)` | `async void` | 머지 완료 후 전체 루프 |
| `GameLoop` | `PerformReshuffle()` | `UniTask` | 리셔플 실행 |
| `GameLoop` | `RearrangeBlocksWithMatches(List<int> blockValues)` | `UniTask` | 매칭 가능하도록 재배치 |
| `GameLoop` | `SaveGameState()` | `void` | 자동 저장 트리거 |
| `GameLoop` | `PlayWaveAnimation(WaveResult)` | `UniTask` | 웨이브 애니메이션 대기 |

### 6.5 코드 스니펫

```csharp
/// <summary>
/// 메인 게임 루프. 머지 완료 이벤트를 수신하여 후속 처리를 수행.
/// 경로: Assets/_Project/Scripts/Core/State/GameLoop.cs
/// </summary>
public class GameLoop : MonoBehaviour
{
    private HexGrid grid;
    private MergeInputHandler inputHandler;
    private MergeProcessor mergeProcessor;
    private WaveSystem waveSystem;
    private ScoreSystem scoreSystem;
    private GameStateManager stateManager;
    private SaveManager saveManager;

    private void Start()
    {
        mergeProcessor.OnMergeCompleted += OnMergeCompleted;

        // 상태별 콜백 등록
        stateManager.RegisterEnterCallback(GameState.Playing, () =>
        {
            inputHandler.SetState(SelectionState.Idle);
        });

        stateManager.RegisterEnterCallback(GameState.Paused, () =>
        {
            SaveGameState();
        });
    }

    private void Update()
    {
        if (stateManager.CurrentState != GameState.Playing) return;
        // 입력은 이벤트 기반으로 MergeInputHandler에서 처리
    }

    /// <summary>
    /// 머지 완료 후 콜백. 게임 루프의 핵심.
    /// </summary>
    private async void OnMergeCompleted(MergeResult result)
    {
        // 1. 마일스톤 체크
        scoreSystem.CheckMilestone(result.MergedValue);

        // 2. 웨이브 애니메이션 대기
        await PlayWaveAnimation(result.WaveResult);

        // 3. 보드 매칭 가능 여부 확인
        if (!result.HasValidMoves)
        {
            await PerformReshuffle();
        }

        // 4. 자동 저장
        SaveGameState();

        // 5. 입력 재활성화
        inputHandler.SetState(SelectionState.Idle);
    }

    /// <summary>
    /// 리셔플: 매칭 가능한 쌍이 없을 때 블록 재배치.
    /// </summary>
    private async UniTask PerformReshuffle()
    {
        stateManager.TransitionTo(GameState.Reshuffling);
        UIManager.Instance.ShowReshuffleNotice();

        // 블록 값 수집 후 재배치
        List<int> blockValues = new List<int>();
        foreach (var cell in grid.GetOccupiedCells())
        {
            blockValues.Add(cell.Block.Level);
            cell.RemoveBlock();
        }

        ShuffleList(blockValues);
        await RearrangeBlocksWithMatches(blockValues);

        stateManager.TransitionTo(GameState.Playing);
    }

    private void SaveGameState()
    {
        saveManager.SaveGame(grid, scoreSystem, GameStats.Instance);
    }
}
```

### 6.6 예상 난이도

**상** -- 여러 비동기 시스템(애니메이션, 웨이브, 리셔플)의 순차적 처리, 상태 머신과의 연동, 에지 케이스(리셔플 중 추가 이벤트 등) 처리가 복합적으로 필요하다.

### 6.7 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `GameStateManager` | --> (조회/전환) | 상태 기반 분기, 리셔플 상태 전환 |
| `MergeProcessor` | <-- (이벤트) | `OnMergeCompleted` 구독 |
| `ScoreSystem` | --> (호출) | `CheckMilestone()` |
| `WaveSystem` | --> (호출) | 웨이브 결과 처리 |
| `MergeInputHandler` | --> (제어) | 입력 재활성화 |
| `SaveManager` | --> (호출) | 자동 저장 |
| `UIManager` | --> (호출) | 리셔플 알림 표시 |
| `MatchFinder` | --> (간접) | `HasAnyValidMatch()` 결과 수신 |
| UniTask | --> (사용) | 비동기 흐름 제어 |

---

## 7. 세이브/로드 시스템

### 7.1 구현 체크리스트

- [ ] `GameSaveData` 직렬화 데이터 구조 정의
- [ ] `CellSaveData` 셀별 저장 데이터 구조 정의
- [ ] `SaveManager` 클래스 구현
- [ ] `SaveGame()` 저장 메서드 구현 (그리드 + 점수 + 통계 직렬화)
- [ ] `LoadGame()` 로드 메서드 구현 (JSON 역직렬화)
- [ ] `HasSaveData()` 저장 파일 존재 여부 확인 구현
- [ ] `DeleteSaveData()` 저장 데이터 삭제 구현
- [ ] `GetSavePath()` 플랫폼별 저장 경로 반환 구현
- [ ] 세이브 데이터 버전 관리 (`saveVersion` 필드)
- [ ] `MigrateSaveData()` 구버전 마이그레이션 구현
- [ ] JSON 직렬화 안정성 테스트 (특수 문자, 큰 데이터)
- [ ] WebGL 플랫폼 호환 처리 (`WebGLBridge` 연동)
- [ ] Android `persistentDataPath` 저장 테스트
- [ ] 자동 저장 타이밍 구현 (머지 후, 일시정지, 백그라운드)
- [ ] `OnApplicationPause()` / `OnApplicationQuit()` 처리
- [ ] 저장/로드 실패 시 에러 처리 및 폴백 구현

### 7.2 구현 설명

세이브/로드 시스템은 게임 진행 상태를 JSON 파일로 로컬에 저장하고 복원하는 모듈이다. 그리드 상태(각 셀의 블록 레벨), 점수(현재/최고), 달성 마일스톤, 플레이 통계 등을 `GameSaveData` 구조체에 직렬화한다. 플랫폼별로 저장 경로가 다르며(Android: persistentDataPath, WebGL: IndexedDB/PlayerPrefs), `PlatformHelper`를 통해 분기 처리한다. 세이브 데이터에 버전 정보를 포함하여 향후 데이터 구조 변경 시 마이그레이션을 지원한다.

### 7.3 저장 데이터 필드 상세

| 카테고리 | 필드명 | 타입 | 설명 |
|----------|--------|------|------|
| **버전** | `saveVersion` | `int` | 세이브 포맷 버전 (현재 1) |
| **버전** | `gameVersion` | `string` | 게임 빌드 버전 |
| **버전** | `savedTimestamp` | `long` | 저장 시각 (Unix timestamp) |
| **보드** | `gridRadius` | `int` | 그리드 반지름 |
| **보드** | `cells` | `List<CellSaveData>` | 각 셀의 좌표 + 블록 레벨 |
| **점수** | `currentScore` | `int` | 현재 세션 점수 |
| **점수** | `highScore` | `int` | 역대 최고 점수 |
| **점수** | `highestBlockValue` | `int` | 역대 최고 블록 값 |
| **점수** | `achievedMilestones` | `List<int>` | 달성한 마일스톤 값 목록 |
| **통계** | `totalMergeCount` | `int` | 누적 머지 횟수 |
| **통계** | `totalPlayTimeSeconds` | `int` | 누적 플레이 시간 (초) |
| **통계** | `sessionCount` | `int` | 세션 수 |
| **설정** | `soundEnabled` | `bool` | 효과음 활성화 여부 |
| **설정** | `musicEnabled` | `bool` | 배경음악 활성화 여부 |
| **설정** | `vibrationEnabled` | `bool` | 진동 활성화 여부 |

### 7.4 자동 저장 타이밍

| 트리거 | 호출 시점 | 우선순위 |
|--------|-----------|----------|
| 머지 완료 | `GameLoop.OnMergeCompleted()` 처리 완료 후 | 보통 |
| 일시정지 | `GameStateManager` -> Paused 진입 시 | 높음 |
| 앱 백그라운드 | `OnApplicationPause(true)` | 긴급 |
| 앱 종료 | `OnApplicationQuit()` | 긴급 |

### 7.5 필요한 클래스/메서드 목록

| 클래스 | 메서드 | 반환 타입 | 설명 |
|--------|--------|-----------|------|
| `SaveManager` | `SaveGame(HexGrid, ScoreSystem, GameStats)` | `bool` | 전체 게임 상태 저장 |
| `SaveManager` | `LoadGame()` | `GameSaveData` | 저장된 게임 로드 (null이면 없음) |
| `SaveManager` | `HasSaveData()` | `bool` | 저장 파일 존재 여부 |
| `SaveManager` | `DeleteSaveData()` | `void` | 저장 파일 삭제 |
| `SaveManager` | `GetSavePath()` | `string` | 플랫폼별 저장 경로 |
| `SaveManager` | `MigrateSaveData(GameSaveData)` | `GameSaveData` | 구버전 데이터 마이그레이션 |
| `GameSaveData` | (데이터 클래스) | -- | JSON 직렬화용 데이터 구조 |
| `CellSaveData` | (데이터 클래스) | -- | 셀 개별 저장 데이터 |

### 7.6 코드 스니펫

```csharp
/// <summary>
/// 게임 세이브 데이터. JSON 직렬화 대상.
/// 경로: Assets/_Project/Scripts/Data/GameSaveData.cs
/// </summary>
[System.Serializable]
public class GameSaveData
{
    public int saveVersion = 1;
    public string gameVersion;
    public long savedTimestamp;

    public int gridRadius;
    public List<CellSaveData> cells = new List<CellSaveData>();

    public int currentScore;
    public int highScore;
    public int highestBlockValue;
    public List<int> achievedMilestones = new List<int>();

    public int totalMergeCount;
    public int totalPlayTimeSeconds;
    public int sessionCount;

    public bool soundEnabled = true;
    public bool musicEnabled = true;
    public bool vibrationEnabled = true;
}

[System.Serializable]
public class CellSaveData
{
    public int col;
    public int row;
    public int blockLevel; // 0 = 빈 셀
}

/// <summary>
/// 세이브/로드 매니저.
/// 경로: Assets/_Project/Scripts/Data/SaveManager.cs
/// </summary>
public class SaveManager
{
    private const string SAVE_FILE_NAME = "hexa_merge_save.json";
    private const int CURRENT_SAVE_VERSION = 1;

    public System.Action<bool> OnGameSaved; // 저장 성공 여부

    /// <summary>
    /// 게임 상태를 JSON 파일로 저장.
    /// </summary>
    public bool SaveGame(HexGrid grid, ScoreSystem scoreSystem, GameStats stats)
    {
        try
        {
            GameSaveData data = new GameSaveData
            {
                saveVersion = CURRENT_SAVE_VERSION,
                gameVersion = Application.version,
                savedTimestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds(),
                gridRadius = grid.Radius,
                currentScore = scoreSystem.GetCurrentScore(),
                highScore = scoreSystem.GetHighScore()
            };

            // 그리드 상태 직렬화
            foreach (var cell in grid.GetAllCells())
            {
                OffsetCoord offset = CoordConverter.CubeToOffset(cell.Coord);
                data.cells.Add(new CellSaveData
                {
                    col = offset.col,
                    row = offset.row,
                    blockLevel = (cell.State == CellState.Occupied)
                        ? cell.Block.Level : 0
                });
            }

            // 통계 직렬화
            data.totalMergeCount = stats.TotalMergeCount;
            data.totalPlayTimeSeconds = stats.TotalPlayTimeSeconds;

            // 저장 실행
            string json = JsonUtility.ToJson(data, prettyPrint: true);

#if UNITY_WEBGL && !UNITY_EDITOR
            WebGLBridge.SaveToIndexedDB("GameSave", json);
#else
            string path = GetSavePath();
            System.IO.File.WriteAllText(path, json);
#endif

            OnGameSaved?.Invoke(true);
            return true;
        }
        catch (System.Exception e)
        {
            Debug.LogError($"게임 저장 실패: {e.Message}");
            OnGameSaved?.Invoke(false);
            return false;
        }
    }

    /// <summary>
    /// 저장 데이터 로드. 파일 없거나 오류 시 null 반환.
    /// </summary>
    public GameSaveData LoadGame()
    {
        try
        {
            string json;

#if UNITY_WEBGL && !UNITY_EDITOR
            json = WebGLBridge.LoadFromIndexedDB("GameSave");
            if (string.IsNullOrEmpty(json)) return null;
#else
            string path = GetSavePath();
            if (!System.IO.File.Exists(path)) return null;
            json = System.IO.File.ReadAllText(path);
#endif

            GameSaveData data = JsonUtility.FromJson<GameSaveData>(json);

            // 버전 호환성 체크
            if (data.saveVersion != CURRENT_SAVE_VERSION)
            {
                data = MigrateSaveData(data);
            }

            return data;
        }
        catch (System.Exception e)
        {
            Debug.LogError($"게임 로드 실패: {e.Message}");
            return null;
        }
    }

    public bool HasSaveData()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        return !string.IsNullOrEmpty(
            WebGLBridge.LoadFromIndexedDB("GameSave"));
#else
        return System.IO.File.Exists(GetSavePath());
#endif
    }

    public void DeleteSaveData()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        PlayerPrefs.DeleteKey("GameSave");
#else
        string path = GetSavePath();
        if (System.IO.File.Exists(path))
            System.IO.File.Delete(path);
#endif
    }

    private string GetSavePath()
    {
        return System.IO.Path.Combine(
            Application.persistentDataPath, SAVE_FILE_NAME);
    }

    private GameSaveData MigrateSaveData(GameSaveData oldData)
    {
        // 향후 버전별 마이그레이션 로직 추가
        // v1 -> v2 마이그레이션 예시:
        // if (oldData.saveVersion == 1) { ... oldData.saveVersion = 2; }
        oldData.saveVersion = CURRENT_SAVE_VERSION;
        return oldData;
    }
}
```

### 7.7 예상 난이도

**중** -- JSON 직렬화 자체는 단순하지만, 플랫폼별 저장 경로 분기(WebGL IndexedDB vs Android File), 데이터 무결성 검증, 버전 마이그레이션 구조 설계에 신경을 써야 한다.

### 7.8 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `HexGrid` | --> (조회) | 그리드 상태 직렬화 |
| `ScoreSystem` | --> (조회) | 점수 데이터 직렬화 |
| `GameStats` | --> (조회) | 통계 데이터 직렬화 |
| `CoordConverter` | --> (사용) | 큐브 좌표 -> 오프셋 좌표 변환 |
| `JsonUtility` (Unity) | --> (사용) | JSON 직렬화/역직렬화 |
| `WebGLBridge` | --> (조건부 사용) | WebGL 플랫폼 저장 |
| `PlatformHelper` | --> (사용) | 플랫폼 분기 판단 |
| `GameLoop` | <-- (호출받음) | 자동 저장 트리거 |
| `GameStateManager` | <-- (호출받음) | Paused 진입 시 자동 저장 |

---

## 8. 오프라인 데이터 관리

### 8.1 구현 체크리스트

- [ ] `OfflineDataManager` 클래스 구현
- [ ] `OnApplicationPause(bool)` 처리 구현 (백그라운드 시 자동 저장)
- [ ] `OnApplicationQuit()` 처리 구현 (종료 시 자동 저장)
- [ ] `TrySyncWithServer()` 서버 동기화 시도 구현
- [ ] 네트워크 상태 체크 (`Application.internetReachability`) 구현
- [ ] 동기화 실패 시 재시도 플래그(`pendingSync`) 구현
- [ ] 로컬 최고 점수와 서버 최고 점수 비교 로직 구현
- [ ] 충돌 해결 정책 구현 (높은 점수 우선)
- [ ] WebGL `beforeunload` 이벤트 핸들링 구현
- [ ] 동기화 상태 로그 출력

### 8.2 구현 설명

오프라인 데이터 관리자는 "로컬 우선 원칙"에 따라 모든 게임 데이터를 로컬에 먼저 저장하고, 네트워크 연결 시 서버와 동기화하는 전략을 구현한다. 앱이 백그라운드로 전환될 때 즉시 저장하고, 포그라운드 복귀 시 서버 동기화를 시도한다. 동기화 실패 시 다음 기회에 재시도하며, 오프라인 상태에서도 완벽하게 플레이 가능하다.

### 8.3 데이터 관리 전략

```
[오프라인 데이터 흐름]

1. 게임 플레이 -> 로컬 저장 (즉시, 항상)
2. 앱 백그라운드 -> 긴급 로컬 저장
3. 앱 포그라운드 복귀 -> 서버 동기화 시도
4. 동기화 성공 -> pendingSync = false
5. 동기화 실패 -> 로그 출력, 다음 기회에 재시도

[충돌 해결 정책]
- 로컬 최고 점수 > 서버 최고 점수 -> 서버에 로컬 값 업로드
- 서버 최고 점수 > 로컬 최고 점수 -> 로컬에 서버 값 저장
- 항상 "높은 점수 우선" 원칙 적용 (last-write-wins 아님)
```

### 8.4 필요한 클래스/메서드 목록

| 클래스 | 메서드 | 반환 타입 | 설명 |
|--------|--------|-----------|------|
| `OfflineDataManager` | `OnApplicationPause(bool isPaused)` | `void` | 앱 포커스 변경 처리 |
| `OfflineDataManager` | `OnApplicationQuit()` | `void` | 앱 종료 시 저장 |
| `OfflineDataManager` | `TrySyncWithServer()` | `async void` | 서버 동기화 시도 |
| `OfflineDataManager` | `ResolveConflict(int local, int server)` | `int` | 충돌 해결 (높은 값 반환) |

### 8.5 코드 스니펫

```csharp
/// <summary>
/// 오프라인 데이터 관리자.
/// 로컬 우선 저장 + 온라인 복귀 시 서버 동기화.
/// 경로: Assets/_Project/Scripts/Data/OfflineDataManager.cs
/// </summary>
public class OfflineDataManager : MonoBehaviour
{
    [SerializeField] private SaveManager saveManager;
    private ILeaderboardService leaderboard;
    private bool pendingSync = false;

    public void Initialize(ILeaderboardService leaderboardService)
    {
        leaderboard = leaderboardService;
    }

    private void OnApplicationPause(bool isPaused)
    {
        if (isPaused)
        {
            // 백그라운드 전환 -> 즉시 저장
            saveManager.SaveGame(/* grid, scoreSystem, stats */);
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

    private void OnApplicationQuit()
    {
        saveManager.SaveGame(/* grid, scoreSystem, stats */);
    }

    /// <summary>
    /// 서버와 동기화 시도. 네트워크 불가 시 조용히 실패.
    /// </summary>
    private async void TrySyncWithServer()
    {
        if (Application.internetReachability == NetworkReachability.NotReachable)
        {
            Debug.Log("네트워크 미연결. 동기화 건너뜀.");
            pendingSync = true; // 다음 기회에 재시도
            return;
        }

        try
        {
            GameSaveData localData = saveManager.LoadGame();
            if (localData == null) return;

            int localHighScore = localData.highScore;

            // 서버에 로컬 최고 점수 제출
            await leaderboard.SubmitScore(
                LeaderboardIds.HIGHEST_SCORE, localHighScore);

            Debug.Log($"서버 동기화 완료. 점수: {localHighScore}");
        }
        catch (System.Exception e)
        {
            Debug.LogWarning(
                $"서버 동기화 실패 (다음 기회에 재시도): {e.Message}");
            pendingSync = true;
        }
    }
}
```

### 8.6 예상 난이도

**중** -- 네트워크 상태 감지, 비동기 서버 통신, 충돌 해결 정책 등이 복합적이다. 다만, 초기 버전에서는 단순한 "제출만" 구현하고 점진적으로 확장할 수 있다.

### 8.7 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `SaveManager` | --> (호출) | 로컬 저장/로드 |
| `ILeaderboardService` | --> (호출) | 서버 점수 제출 |
| `Application` (Unity) | --> (조회) | 네트워크 상태, 생명주기 이벤트 |
| `LeaderboardIds` | --> (참조) | 리더보드 ID 상수 |

---

## 9. 리더보드 연동

### 9.1 구현 체크리스트

- [ ] `ILeaderboardService` 인터페이스 정의
- [ ] `LeaderboardEntry` 데이터 클래스 정의
- [ ] `LeaderboardIds` 상수 클래스 정의
- [ ] `FirebaseLeaderboard` 구현 (WebGL용)
- [ ] `GPGLeaderboard` 구현 (Android용)
- [ ] `MockLeaderboard` 구현 (에디터 테스트용)
- [ ] `PlatformHelper.CreateLeaderboardService()` 팩토리 메서드 구현
- [ ] `SubmitScore()` 점수 제출 구현 (플랫폼별)
- [ ] `GetTopScores()` 상위 순위 조회 구현
- [ ] `GetNearbyScores()` 내 주변 순위 조회 구현
- [ ] `GetMyRank()` 내 순위 조회 구현
- [ ] `LeaderboardScreen` UI 화면 구현
- [ ] 리더보드 데이터 캐싱 (불필요한 네트워크 요청 방지)
- [ ] 리더보드 로딩 중 스피너 UI 구현
- [ ] 네트워크 오류 시 폴백 UI 구현

### 9.2 구현 설명

리더보드는 `ILeaderboardService` 인터페이스를 통해 플랫폼별 구현체를 추상화한다. WebGL은 Firebase Realtime Database를, Android는 Google Play Games Services를 사용한다. DI(의존성 주입) 패턴으로 `PlatformHelper.CreateLeaderboardService()`에서 런타임에 적절한 구현체를 생성한다. 에디터 환경에서는 `MockLeaderboard`를 사용하여 네트워크 없이도 개발/테스트가 가능하다.

### 9.3 리더보드 종류

| 리더보드 ID | 명칭 | 정렬 | 초기화 주기 |
|------------|------|------|-------------|
| `leaderboard_highest_score` | 최고 점수 | 내림차순 | 영구 |
| `leaderboard_highest_block` | 최고 블록 | 내림차순 | 영구 |
| `leaderboard_weekly_score` | 주간 점수 | 내림차순 | 매주 월요일 |

### 9.4 플랫폼별 구현 계획

| 플랫폼 | 백엔드 | 인증 | 비고 |
|--------|--------|------|------|
| WebGL | Firebase RTDB | 닉네임 (익명 가능) | REST API 기반 |
| Android | Google Play Games | Google 계정 | GPG API 기반 |
| Editor | Mock (로컬) | 없음 | 테스트용 더미 데이터 |

### 9.5 필요한 클래스/메서드 목록

| 클래스 | 메서드 | 반환 타입 | 설명 |
|--------|--------|-----------|------|
| `ILeaderboardService` | `SubmitScore(string id, int score)` | `UniTask<bool>` | 점수 제출 |
| `ILeaderboardService` | `GetTopScores(string id, int count)` | `UniTask<List<LeaderboardEntry>>` | 상위 N명 조회 |
| `ILeaderboardService` | `GetNearbyScores(string id, int range)` | `UniTask<List<LeaderboardEntry>>` | 내 주변 순위 조회 |
| `ILeaderboardService` | `GetMyRank(string id)` | `UniTask<int>` | 내 순위 조회 |
| `FirebaseLeaderboard` | (ILeaderboardService 구현) | -- | WebGL용 Firebase 구현 |
| `GPGLeaderboard` | (ILeaderboardService 구현) | -- | Android용 GPG 구현 |
| `MockLeaderboard` | (ILeaderboardService 구현) | -- | 에디터용 목업 |
| `LeaderboardScreen` | `ShowLeaderboard(string id)` | `void` | 리더보드 UI 표시 |
| `LeaderboardScreen` | `RefreshData()` | `UniTask` | 데이터 갱신 |
| `PlatformHelper` | `CreateLeaderboardService()` | `ILeaderboardService` | 팩토리 메서드 |

### 9.6 코드 스니펫

```csharp
/// <summary>
/// 리더보드 서비스 인터페이스.
/// 플랫폼별 구현체를 교체할 수 있도록 추상화.
/// 경로: Assets/_Project/Scripts/Services/ILeaderboardService.cs
/// </summary>
public interface ILeaderboardService
{
    UniTask<bool> SubmitScore(string leaderboardId, int score);
    UniTask<List<LeaderboardEntry>> GetTopScores(string leaderboardId, int count);
    UniTask<List<LeaderboardEntry>> GetNearbyScores(string leaderboardId, int range);
    UniTask<int> GetMyRank(string leaderboardId);
}

/// <summary>
/// 리더보드 항목 데이터.
/// </summary>
public class LeaderboardEntry
{
    public string PlayerId;
    public string PlayerName;
    public int Score;
    public int Rank;
    public long Timestamp;
}

/// <summary>
/// 리더보드 ID 상수.
/// </summary>
public static class LeaderboardIds
{
    public const string HIGHEST_SCORE = "leaderboard_highest_score";
    public const string HIGHEST_BLOCK = "leaderboard_highest_block";
    public const string WEEKLY_SCORE = "leaderboard_weekly_score";
}

/// <summary>
/// Firebase 기반 리더보드 구현 (WebGL용).
/// 경로: Assets/_Project/Scripts/Services/FirebaseLeaderboard.cs
/// </summary>
public class FirebaseLeaderboard : ILeaderboardService
{
    private const string BASE_URL = "https://your-project.firebaseio.com";

    public async UniTask<bool> SubmitScore(string leaderboardId, int score)
    {
        try
        {
            string url = $"{BASE_URL}/leaderboards/{leaderboardId}.json";
            var entry = new
            {
                playerId = GetPlayerId(),
                playerName = GetPlayerName(),
                score = score,
                timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
            };

            string json = JsonUtility.ToJson(entry);
            // UnityWebRequest를 사용한 REST API 호출
            using var request = UnityWebRequest.Put(url, json);
            await request.SendWebRequest();

            return request.result == UnityWebRequest.Result.Success;
        }
        catch (System.Exception e)
        {
            Debug.LogError($"점수 제출 실패: {e.Message}");
            return false;
        }
    }

    public async UniTask<List<LeaderboardEntry>> GetTopScores(
        string leaderboardId, int count)
    {
        try
        {
            string url = $"{BASE_URL}/leaderboards/{leaderboardId}.json"
                + $"?orderBy=\"score\"&limitToLast={count}";

            using var request = UnityWebRequest.Get(url);
            await request.SendWebRequest();

            // JSON 파싱하여 List<LeaderboardEntry> 반환
            // ... (Firebase JSON 구조에 맞게 파싱)
            return ParseLeaderboardResponse(request.downloadHandler.text);
        }
        catch (System.Exception e)
        {
            Debug.LogError($"리더보드 조회 실패: {e.Message}");
            return new List<LeaderboardEntry>();
        }
    }

    public async UniTask<List<LeaderboardEntry>> GetNearbyScores(
        string leaderboardId, int range)
    {
        // 내 점수 기준 +-range 범위 조회
        // Firebase에서는 복합 쿼리가 제한적이므로,
        // 전체 조회 후 클라이언트에서 필터링하는 방식 사용
        var allScores = await GetTopScores(leaderboardId, 100);
        // ... 내 순위 기준 필터링 로직
        return FilterNearbyScores(allScores, range);
    }

    public async UniTask<int> GetMyRank(string leaderboardId)
    {
        var topScores = await GetTopScores(leaderboardId, 1000);
        string myId = GetPlayerId();
        for (int i = 0; i < topScores.Count; i++)
        {
            if (topScores[i].PlayerId == myId)
                return i + 1;
        }
        return -1; // 순위 없음
    }
}

/// <summary>
/// 에디터 테스트용 목업 리더보드.
/// 경로: Assets/_Project/Scripts/Services/MockLeaderboard.cs
/// </summary>
public class MockLeaderboard : ILeaderboardService
{
    private List<LeaderboardEntry> mockData = new();

    public async UniTask<bool> SubmitScore(string leaderboardId, int score)
    {
        await UniTask.Delay(500); // 네트워크 시뮬레이션
        mockData.Add(new LeaderboardEntry
        {
            PlayerId = "mock_player",
            PlayerName = "TestUser",
            Score = score,
            Rank = mockData.Count + 1,
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeSeconds()
        });
        Debug.Log($"[Mock] 점수 제출: {score}");
        return true;
    }

    public async UniTask<List<LeaderboardEntry>> GetTopScores(
        string leaderboardId, int count)
    {
        await UniTask.Delay(300);
        return mockData
            .OrderByDescending(e => e.Score)
            .Take(count)
            .ToList();
    }

    public async UniTask<List<LeaderboardEntry>> GetNearbyScores(
        string leaderboardId, int range)
    {
        await UniTask.Delay(300);
        return mockData.Take(range * 2 + 1).ToList();
    }

    public async UniTask<int> GetMyRank(string leaderboardId)
    {
        await UniTask.Delay(200);
        return 1;
    }
}

/// <summary>
/// 플랫폼별 리더보드 서비스 팩토리.
/// </summary>
public static class PlatformHelper
{
    public static ILeaderboardService CreateLeaderboardService()
    {
#if UNITY_WEBGL && !UNITY_EDITOR
        return new FirebaseLeaderboard();
#elif UNITY_ANDROID && !UNITY_EDITOR
        return new GPGLeaderboard();
#else
        return new MockLeaderboard();
#endif
    }
}
```

### 9.7 예상 난이도

**상** -- Firebase REST API 연동, Google Play Games SDK 연동, 비동기 네트워크 통신, 에러 핸들링, 플랫폼별 분기, UI 상태 관리 등이 복합적으로 요구된다. 외부 서비스 의존으로 디버깅 난이도도 높다.

### 9.8 의존성

| 의존 대상 | 방향 | 설명 |
|-----------|------|------|
| `ScoreSystem` | <-- (데이터) | 제출할 점수 제공 |
| `OfflineDataManager` | <-- (호출) | 동기화 시 점수 제출 요청 |
| Firebase SDK | --> (외부) | WebGL 리더보드 백엔드 |
| Google Play Games SDK | --> (외부) | Android 리더보드 백엔드 |
| UniTask | --> (사용) | 비동기 네트워크 호출 |
| UnityWebRequest | --> (사용) | HTTP 통신 |
| `LeaderboardScreen` (UI) | <-- (데이터) | 조회 결과 표시 |

---

## 10. 통합 테스트 계획

### 10.1 단위 테스트 목록

| 테스트 항목 | 대상 클래스 | 검증 내용 | 우선순위 |
|------------|------------|-----------|----------|
| 기본 머지 점수 계산 | `ScoreSystem` | `CalculateMergeScore(4, 0)` == 4 | 높음 |
| 연쇄 배율 적용 | `ScoreSystem` | `CalculateMergeScore(8, 1)` == 12 | 높음 |
| 연쇄 5단계 배율 | `ScoreSystem` | `CalculateMergeScore(8, 5)` == 28 | 보통 |
| 점수 누적 | `ScoreSystem` | `AddScore` 호출 후 `GetCurrentScore` 검증 | 높음 |
| 최고 점수 갱신 | `ScoreSystem` | 현재 > 최고 시 자동 갱신 | 높음 |
| 점수 초기화 | `ScoreSystem` | `ResetCurrentScore` 후 0 확인 | 보통 |
| 마일스톤 최초 달성 | `ScoreSystem` | 128 최초 달성 시 500 보너스 | 높음 |
| 마일스톤 중복 방지 | `ScoreSystem` | 같은 값 재달성 시 보너스 0 | 높음 |
| 마일스톤 일괄 지급 | `ScoreSystem` | 64->512 점프 시 128+256+512 보너스 | 보통 |
| 유효 상태 전환 | `GameStateManager` | Loading -> MainMenu 성공 | 높음 |
| 무효 상태 전환 | `GameStateManager` | Loading -> Playing 거부 | 높음 |
| 진입 콜백 호출 | `GameStateManager` | 상태 전환 시 Enter 콜백 발동 | 보통 |
| 이탈 콜백 호출 | `GameStateManager` | 상태 전환 시 Exit 콜백 발동 | 보통 |
| 세이브 직렬화 | `SaveManager` | SaveGame 후 파일 생성 확인 | 높음 |
| 로드 역직렬화 | `SaveManager` | LoadGame 후 데이터 무결성 | 높음 |
| 빈 세이브 처리 | `SaveManager` | 파일 없을 때 null 반환 | 보통 |
| 버전 마이그레이션 | `SaveManager` | 구버전 데이터 변환 | 낮음 |

### 10.2 통합 테스트 시나리오

| 시나리오 | 흐름 | 검증 포인트 |
|----------|------|-------------|
| **정상 머지 플레이** | 블록 선택 -> 머지 -> 점수 누적 -> 웨이브 생성 | 점수 정확성, UI 갱신, 블록 생성 |
| **연쇄 머지 발생** | 머지 -> 인접 동일값 발견 -> 연쇄 -> 콤보 표시 | 연쇄 점수 배율, 콤보 UI, 깊이 제한 |
| **마일스톤 달성** | 64+64=128 머지 -> 마일스톤 체크 -> 보너스 지급 | 500점 보너스, 축하 UI, 중복 방지 |
| **리셔플 발생** | 보드 가득 참 + 매칭 불가 -> 리셔플 -> 계속 플레이 | 상태 전환, 블록 재배치, 입력 차단/해제 |
| **세이브/로드 주기** | 플레이 -> 머지 -> 자동 저장 -> 앱 종료 -> 재시작 -> 로드 | 데이터 무결성, 점수 복원, 보드 복원 |
| **일시정지 흐름** | 플레이 중 -> 일시정지 -> 자동 저장 -> 계속하기 | 상태 전환, 입력 차단/해제, 저장 |
| **백그라운드 처리** | 플레이 중 -> 앱 백그라운드 -> 자동 저장 -> 포그라운드 -> 동기화 | 긴급 저장, 동기화 시도 |
| **리더보드 제출** | 최고 점수 갱신 -> 온라인 시 자동 제출 | 제출 성공, 순위 조회 |
| **오프라인 플레이** | 네트워크 끊김 -> 정상 플레이 -> 로컬 저장 -> 네트워크 복귀 -> 동기화 | 오프라인 플레이 정상, 복귀 시 동기화 |

### 10.3 성능 테스트 항목

| 항목 | 기준값 | 측정 방법 |
|------|--------|-----------|
| 점수 계산 시간 | < 1ms | Stopwatch 측정 |
| 세이브 쓰기 시간 | < 50ms | Stopwatch 측정 |
| 세이브 로드 시간 | < 50ms | Stopwatch 측정 |
| 세이브 파일 크기 | < 10KB | 파일 크기 확인 |
| 상태 전환 시간 | < 1ms | Stopwatch 측정 |
| 리더보드 API 응답 | < 3초 | 네트워크 타임아웃 |
| 연쇄 20단계 처리 | < 500ms (애니메이션 제외) | 로직만 측정 |

---

## 부록 A. 파일 경로 요약

| 파일 | 경로 | 설명 |
|------|------|------|
| `ScoreSystem.cs` | `Assets/_Project/Scripts/Core/Score/ScoreSystem.cs` | 점수 계산 및 관리 |
| `MilestoneManager.cs` | `Assets/_Project/Scripts/Core/Score/MilestoneManager.cs` | 마일스톤 보너스 (선택적 분리) |
| `GameLoop.cs` | `Assets/_Project/Scripts/Core/State/GameLoop.cs` | 메인 게임 루프 |
| `GameStateManager.cs` | `Assets/_Project/Scripts/Core/State/GameStateManager.cs` | 상태 머신 |
| `GameStats.cs` | `Assets/_Project/Scripts/Core/State/GameStats.cs` | 게임 통계 |
| `SaveManager.cs` | `Assets/_Project/Scripts/Data/SaveManager.cs` | 세이브/로드 |
| `GameSaveData.cs` | `Assets/_Project/Scripts/Data/GameSaveData.cs` | 저장 데이터 구조 |
| `OfflineDataManager.cs` | `Assets/_Project/Scripts/Data/OfflineDataManager.cs` | 오프라인 데이터 관리 |
| `ILeaderboardService.cs` | `Assets/_Project/Scripts/Services/ILeaderboardService.cs` | 리더보드 인터페이스 |
| `FirebaseLeaderboard.cs` | `Assets/_Project/Scripts/Services/FirebaseLeaderboard.cs` | Firebase 구현 |
| `GPGLeaderboard.cs` | `Assets/_Project/Scripts/Services/GPGLeaderboard.cs` | GPG 구현 |
| `MockLeaderboard.cs` | `Assets/_Project/Scripts/Services/MockLeaderboard.cs` | 테스트용 목업 |
| `ScoreDisplay.cs` | `Assets/_Project/Scripts/UI/Components/ScoreDisplay.cs` | 점수 표시 UI |
| `ComboDisplay.cs` | `Assets/_Project/Scripts/UI/Components/ComboDisplay.cs` | 콤보 표시 UI |
| `LeaderboardScreen.cs` | `Assets/_Project/Scripts/UI/Screens/LeaderboardScreen.cs` | 리더보드 UI |
| `ScoreConfig.asset` | `Assets/_Project/ScriptableObjects/ScoreConfig.asset` | 점수 설정 |

## 부록 B. 난이도 요약

| 항목 | 난이도 | 예상 공수 | 우선순위 |
|------|--------|-----------|----------|
| 점수 계산 시스템 | 하 | 0.5일 | 1 (필수) |
| 콤보/연쇄 보너스 | 중 | 1.5일 | 1 (필수) |
| 마일스톤 보너스 | 하 | 0.5일 | 2 (높음) |
| 점수 UI 연동 | 중 | 1.5일 | 2 (높음) |
| 게임 상태 머신 | 중 | 1일 | 1 (필수) |
| 게임 루프 | 상 | 2일 | 1 (필수) |
| 세이브/로드 | 중 | 2일 | 1 (필수) |
| 오프라인 데이터 관리 | 중 | 1일 | 3 (보통) |
| 리더보드 연동 | 상 | 3일 | 3 (보통) |
| 통합 테스트 | 중 | 2일 | 2 (높음) |
| **합계** | -- | **약 15일** | -- |

## 부록 C. 의존성 그래프 (텍스트)

```
[의존성 방향: 화살표가 가리키는 쪽을 의존]

GameLoop
  ├──> GameStateManager
  ├──> MergeProcessor ──> ScoreSystem
  │                   ──> ChainProcessor ──> ScoreSystem
  │                                      ──> HexDirection
  ├──> ScoreSystem ──> PlayerPrefs
  │               ──> MilestoneBonuses (static)
  ├──> WaveSystem
  ├──> SaveManager ──> GameSaveData
  │               ──> CoordConverter
  │               ──> WebGLBridge (조건부)
  ├──> MergeInputHandler
  └──> UIManager

OfflineDataManager
  ├──> SaveManager
  └──> ILeaderboardService
       ├── FirebaseLeaderboard (WebGL)
       ├── GPGLeaderboard (Android)
       └── MockLeaderboard (Editor)

ScoreDisplay (UI)
  └──> ScoreSystem (이벤트 구독)

ComboDisplay (UI)
  └──> ChainProcessor (이벤트 구독)

LeaderboardScreen (UI)
  └──> ILeaderboardService (데이터 조회)
```

---

> 본 문서는 설계문서 `01_core-system-design.md`의 4장(스코어링 시스템)과 5장(게임 상태 관리)을 기반으로 작성된 상세 개발 계획서입니다.
> 구현 순서는 부록 B의 우선순위를 참고하되, 의존성 그래프에 따라 하위 모듈(ScoreSystem, GameStateManager)부터 상위 모듈(GameLoop, OfflineDataManager)로 순차 구현을 권장합니다.
