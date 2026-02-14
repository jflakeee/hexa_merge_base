# Hexa Merge Basic - UI 컴포넌트 상세 개발 계획서

> **문서 버전:** v1.0
> **최종 수정일:** 2026-02-13
> **참조 설계문서:** `docs/design/02_ui-ux-design.md`
> **네임스페이스:** `HexaMerge.UI`

---

## 목차

1. [아키텍처 개요](#1-아키텍처-개요)
2. [Canvas 및 기본 인프라](#2-canvas-및-기본-인프라)
3. [메인 메뉴 화면](#3-메인-메뉴-화면)
4. [게임 플레이 화면](#4-게임-플레이-화면)
5. [HUD 시스템](#5-hud-시스템)
6. [헥사곤 보드 렌더링](#6-헥사곤-보드-렌더링)
7. [일시정지 화면](#7-일시정지-화면)
8. [설정 화면](#8-설정-화면)
9. [리더보드 화면](#9-리더보드-화면)
10. [상점 화면](#10-상점-화면)
11. [반응형 레이아웃 시스템](#11-반응형-레이아웃-시스템)
12. [입력 처리 시스템](#12-입력-처리-시스템)
13. [공통 UI 컴포넌트](#13-공통-ui-컴포넌트)
14. [에지 케이스 및 주의사항](#14-에지-케이스-및-주의사항)
15. [성능 최적화](#15-성능-최적화)
16. [전체 체크리스트 요약](#16-전체-체크리스트-요약)

---

## 1. 아키텍처 개요

### 1.1 UI 계층 구조

```
UIManager (싱글톤)
├── ScreenManager         // 화면 전환 관리
│   ├── MainMenuScreen
│   ├── GameplayScreen
│   ├── PauseScreen       // 오버레이
│   ├── SettingsScreen
│   ├── LeaderboardScreen
│   └── ShopScreen
├── HUDController         // 게임 중 HUD
├── PopupManager          // 팝업/다이얼로그
├── ToastManager          // 토스트 메시지
└── ResponsiveLayoutManager // 반응형 처리
```

### 1.2 핵심 클래스 다이어그램

```
IScreen (인터페이스)
├── Show() / Hide() / OnBack()
├── IsOverlay { get; }

ScreenBase : MonoBehaviour, IScreen
├── canvasGroup: CanvasGroup
├── FadeIn() / FadeOut()

ScreenManager : MonoBehaviour
├── screens: Dictionary<ScreenType, IScreen>
├── screenStack: Stack<ScreenType>
├── ShowScreen(ScreenType)
├── GoBack()
├── GetCurrentScreen()

UIManager : MonoBehaviour (싱글톤)
├── screenManager: ScreenManager
├── hudController: HUDController
├── popupManager: PopupManager
├── responsiveManager: ResponsiveLayoutManager
```

---

## 2. Canvas 및 기본 인프라

### STEP 1: Canvas 구조 설정

- [ ] **메인 Canvas 구성**
- [ ] **이벤트 시스템 설정**
- [ ] **SafeArea 핸들러 구현**

**구현 설명:**
모든 UI의 기반이 되는 Canvas 계층 구조를 설정한다. Screen Space - Camera 모드를 사용하며, 3개의 정렬 레이어로 분리한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `UICanvasSetup` | `Initialize()` | Canvas 3단 계층 초기화 |
| `SafeAreaHandler` | `ApplyArea()` | 노치/펀치홀 대응 |
| `SafeAreaHandler` | `OnRectTransformDimensionsChange()` | 크기 변경 감지 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI
{
    /// <summary>
    /// Canvas 계층: Background(0) -> Main(1) -> Overlay(2)
    /// </summary>
    public class UICanvasSetup : MonoBehaviour
    {
        [SerializeField] private Canvas backgroundCanvas;  // sortOrder: 0
        [SerializeField] private Canvas mainCanvas;         // sortOrder: 10
        [SerializeField] private Canvas overlayCanvas;      // sortOrder: 100

        public void Initialize()
        {
            // Screen Space - Camera 설정
            var uiCamera = GetComponentInChildren<Camera>();
            backgroundCanvas.renderMode = RenderMode.ScreenSpaceCamera;
            backgroundCanvas.worldCamera = uiCamera;
            mainCanvas.renderMode = RenderMode.ScreenSpaceCamera;
            mainCanvas.worldCamera = uiCamera;
            overlayCanvas.renderMode = RenderMode.ScreenSpaceCamera;
            overlayCanvas.worldCamera = uiCamera;

            // Reference Resolution 설정 (1080x1920 기준)
            var scaler = mainCanvas.GetComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1080, 1920);
            scaler.matchWidthOrHeight = 0.5f;
        }
    }

    public class SafeAreaHandler : MonoBehaviour
    {
        private RectTransform _panel;
        private Rect _lastSafeArea;

        private void Awake() => _panel = GetComponent<RectTransform>();

        private void Update()
        {
            if (Screen.safeArea != _lastSafeArea)
                ApplyArea();
        }

        private void ApplyArea()
        {
            var safeArea = Screen.safeArea;
            var anchorMin = safeArea.position;
            var anchorMax = safeArea.position + safeArea.size;

            anchorMin.x /= Screen.width;
            anchorMin.y /= Screen.height;
            anchorMax.x /= Screen.width;
            anchorMax.y /= Screen.height;

            _panel.anchorMin = anchorMin;
            _panel.anchorMax = anchorMax;
            _lastSafeArea = safeArea;
        }
    }
}
```

**예상 난이도:** 하
**의존성:** 없음 (최우선 구현)
**구현 순서:** 1

---

### STEP 2: ScreenManager 및 화면 전환 시스템

- [ ] **ScreenBase 추상 클래스 구현**
- [ ] **ScreenManager 구현**
- [ ] **화면 전환 애니메이션 연동**

**구현 설명:**
모든 화면의 공통 기능(Show/Hide, 페이드 인/아웃)을 추상 클래스로 정의하고, ScreenManager가 스택 기반으로 화면 전환을 관리한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `ScreenBase` | `Show()` | 화면 표시 (가상 메서드) |
| `ScreenBase` | `Hide()` | 화면 숨김 |
| `ScreenBase` | `OnBack()` | 뒤로가기 처리 |
| `ScreenManager` | `ShowScreen(ScreenType)` | 화면 전환 |
| `ScreenManager` | `GoBack()` | 이전 화면 복귀 |
| `ScreenManager` | `PushOverlay(ScreenType)` | 오버레이 추가 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI
{
    public enum ScreenType
    {
        MainMenu,
        Gameplay,
        Pause,
        Settings,
        Leaderboard,
        Shop
    }

    public abstract class ScreenBase : MonoBehaviour, IScreen
    {
        [SerializeField] protected CanvasGroup canvasGroup;
        public virtual bool IsOverlay => false;

        public virtual void Show()
        {
            gameObject.SetActive(true);
            canvasGroup.alpha = 0f;
            canvasGroup.DOFade(1f, 0.3f).SetEase(Ease.OutQuad);
            canvasGroup.interactable = true;
            canvasGroup.blocksRaycasts = true;
        }

        public virtual void Hide()
        {
            canvasGroup.interactable = false;
            canvasGroup.blocksRaycasts = false;
            canvasGroup.DOFade(0f, 0.2f)
                .SetEase(Ease.InQuad)
                .OnComplete(() => gameObject.SetActive(false));
        }

        public virtual void OnBack()
        {
            UIManager.Instance.ScreenManager.GoBack();
        }
    }

    public class ScreenManager : MonoBehaviour
    {
        private Dictionary<ScreenType, ScreenBase> _screens = new();
        private Stack<ScreenType> _screenStack = new();

        public void RegisterScreen(ScreenType type, ScreenBase screen)
        {
            _screens[type] = screen;
            screen.gameObject.SetActive(false);
        }

        public void ShowScreen(ScreenType type)
        {
            if (_screenStack.Count > 0)
            {
                var current = _screens[_screenStack.Peek()];
                if (!_screens[type].IsOverlay)
                    current.Hide();
            }

            _screenStack.Push(type);
            _screens[type].Show();
        }

        public void GoBack()
        {
            if (_screenStack.Count <= 1) return;

            var current = _screens[_screenStack.Pop()];
            current.Hide();

            if (_screenStack.Count > 0)
            {
                var previous = _screens[_screenStack.Peek()];
                if (!previous.gameObject.activeSelf)
                    previous.Show();
            }
        }
    }
}
```

**예상 난이도:** 중
**의존성:** STEP 1 (Canvas 구조), DOTween (애니메이션)
**구현 순서:** 2

---

## 3. 메인 메뉴 화면

### STEP 3: MainMenuScreen 구현

- [ ] **메인 메뉴 레이아웃 구성**
- [ ] **버튼 이벤트 연결**
- [ ] **최고 점수 표시 연동**
- [ ] **이어하기 버튼 조건부 표시**
- [ ] **PLAY 버튼 펄스 애니메이션**

**구현 설명:**
설계문서 1.2절 기반. 게임 타이틀, PLAY/CONTINUE 버튼, RANK/SHOP 버튼, 설정/사운드 토글을 배치한다. 저장된 게임이 있을 때만 CONTINUE 버튼을 표시한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `MainMenuScreen` | `Show()` | 화면 초기화 및 표시 |
| `MainMenuScreen` | `OnPlayClicked()` | 새 게임 시작 |
| `MainMenuScreen` | `OnContinueClicked()` | 저장된 게임 이어하기 |
| `MainMenuScreen` | `UpdateBestScore(int)` | 최고점수 갱신 표시 |
| `MainMenuScreen` | `CheckSaveData()` | 저장 데이터 유무 확인 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI.Screens
{
    public class MainMenuScreen : ScreenBase
    {
        [Header("Buttons")]
        [SerializeField] private Button playButton;
        [SerializeField] private Button continueButton;
        [SerializeField] private Button rankButton;
        [SerializeField] private Button shopButton;
        [SerializeField] private Button settingsButton;
        [SerializeField] private Toggle soundToggle;

        [Header("Display")]
        [SerializeField] private TMP_Text bestScoreText;
        [SerializeField] private GameObject continueButtonObj;

        private Tweener _playPulseTween;

        public override void Show()
        {
            base.Show();
            UpdateBestScore(SaveManager.Instance.GetBestScore());
            CheckSaveData();
            StartPlayPulseAnimation();
        }

        private void OnEnable()
        {
            playButton.onClick.AddListener(OnPlayClicked);
            continueButton.onClick.AddListener(OnContinueClicked);
            rankButton.onClick.AddListener(() =>
                UIManager.Instance.ScreenManager.ShowScreen(ScreenType.Leaderboard));
            shopButton.onClick.AddListener(() =>
                UIManager.Instance.ScreenManager.ShowScreen(ScreenType.Shop));
            settingsButton.onClick.AddListener(() =>
                UIManager.Instance.ScreenManager.ShowScreen(ScreenType.Settings));
        }

        private void OnDisable()
        {
            playButton.onClick.RemoveAllListeners();
            continueButton.onClick.RemoveAllListeners();
            _playPulseTween?.Kill();
        }

        private void OnPlayClicked()
        {
            GameManager.Instance.StartNewGame();
            UIManager.Instance.ScreenManager.ShowScreen(ScreenType.Gameplay);
        }

        private void OnContinueClicked()
        {
            GameManager.Instance.LoadSavedGame();
            UIManager.Instance.ScreenManager.ShowScreen(ScreenType.Gameplay);
        }

        private void UpdateBestScore(int score)
        {
            bestScoreText.text = $"Best: {score:N0}";
        }

        private void CheckSaveData()
        {
            continueButtonObj.SetActive(SaveManager.Instance.HasSaveData());
        }

        private void StartPlayPulseAnimation()
        {
            var rt = playButton.GetComponent<RectTransform>();
            _playPulseTween = rt.DOScale(1.05f, 0.8f)
                .SetLoops(-1, LoopType.Yoyo)
                .SetEase(Ease.InOutSine);
        }
    }
}
```

**예상 난이도:** 중
**의존성:** STEP 2 (ScreenManager), SaveManager, GameManager
**구현 순서:** 3

---

## 4. 게임 플레이 화면

### STEP 4: GameplayScreen 구현

- [ ] **게임 플레이 화면 레이아웃 구성**
- [ ] **보드 영역 및 HUD 배치**
- [ ] **HINT 버튼 (보상형 광고) 연동**
- [ ] **콤보 카운터 UI**

**구현 설명:**
설계문서 1.3절 기반. 화면 대부분을 헥사곤 보드가 차지하고, 상단 HUD와 좌측 하단 HINT 버튼을 배치한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `GameplayScreen` | `Show()` | 게임 플레이 화면 초기화 |
| `GameplayScreen` | `OnPauseClicked()` | 일시정지 오버레이 표시 |
| `GameplayScreen` | `OnHintClicked()` | 보상 광고 → 힌트 제공 |
| `GameplayScreen` | `UpdateComboDisplay(int)` | 콤보 배수 표시 갱신 |
| `GameplayScreen` | `ShowScorePopup(int, Vector2)` | 점수 팝업 표시 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI.Screens
{
    public class GameplayScreen : ScreenBase
    {
        [Header("References")]
        [SerializeField] private Button pauseButton;
        [SerializeField] private Button hintButton;
        [SerializeField] private RectTransform boardContainer;
        [SerializeField] private TMP_Text comboText;
        [SerializeField] private GameObject comboPanel;

        [Header("Hint")]
        [SerializeField] private TMP_Text hintCountText;
        [SerializeField] private GameObject adIcon;

        public override void Show()
        {
            base.Show();
            comboPanel.SetActive(false);
            UpdateHintButton();
        }

        private void OnEnable()
        {
            pauseButton.onClick.AddListener(OnPauseClicked);
            hintButton.onClick.AddListener(OnHintClicked);
            GameEvents.OnComboChanged += UpdateComboDisplay;
            GameEvents.OnScoreAdded += ShowScorePopup;
        }

        private void OnDisable()
        {
            pauseButton.onClick.RemoveAllListeners();
            hintButton.onClick.RemoveAllListeners();
            GameEvents.OnComboChanged -= UpdateComboDisplay;
            GameEvents.OnScoreAdded -= ShowScorePopup;
        }

        private void OnPauseClicked()
        {
            GameManager.Instance.PauseGame();
            UIManager.Instance.ScreenManager.ShowScreen(ScreenType.Pause);
        }

        private async void OnHintClicked()
        {
            if (ItemManager.Instance.GetHintCount() > 0)
            {
                ItemManager.Instance.UseHint();
                GameManager.Instance.ShowHint();
            }
            else
            {
                bool rewarded = await AdRewardManager.Instance.ShowRewardedAd(
                    AdTriggerType.Hint);
                if (rewarded)
                {
                    ItemManager.Instance.AddHints(1);
                    GameManager.Instance.ShowHint();
                }
            }
            UpdateHintButton();
        }

        public void UpdateComboDisplay(int comboMultiplier)
        {
            if (comboMultiplier <= 1)
            {
                comboPanel.SetActive(false);
                return;
            }
            comboPanel.SetActive(true);
            comboText.text = $"COMBO x{comboMultiplier}";
            comboPanel.transform.DOPunchScale(Vector3.one * 0.2f, 0.3f);
        }

        private void UpdateHintButton()
        {
            int count = ItemManager.Instance.GetHintCount();
            hintCountText.text = count > 0 ? $"HINT x{count}" : "HINT";
            adIcon.SetActive(count <= 0);
        }
    }
}
```

**예상 난이도:** 중
**의존성:** STEP 2, HUD 시스템, AdRewardManager, GameManager
**구현 순서:** 4

---

## 5. HUD 시스템

### STEP 5: HUDController 구현

- [ ] **HUD 바 레이아웃 (점수, 최고점수, 일시정지 버튼)**
- [ ] **점수 카운트업 애니메이션**
- [ ] **최고점수 갱신 이펙트**

**구현 설명:**
설계문서 3절 기반. 상단 HUD 바에 현재 점수(카운트업), 최고 점수, 일시정지 버튼을 배치한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `HUDController` | `Initialize()` | HUD 초기화 |
| `HUDController` | `UpdateScore(int)` | 카운트업 애니메이션으로 점수 갱신 |
| `HUDController` | `UpdateBestScore(int)` | 최고점수 갱신 + 이펙트 |
| `HUDController` | `SetVisible(bool)` | HUD 표시/숨김 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI
{
    public class HUDController : MonoBehaviour
    {
        [SerializeField] private TMP_Text scoreText;
        [SerializeField] private TMP_Text bestScoreText;
        [SerializeField] private GameObject newBestBadge;
        [SerializeField] private CanvasGroup hudCanvasGroup;

        private int _displayedScore;
        private int _currentBestScore;
        private Tweener _scoreTween;

        public void Initialize()
        {
            _displayedScore = 0;
            _currentBestScore = SaveManager.Instance.GetBestScore();
            scoreText.text = "0";
            bestScoreText.text = $"Best: {_currentBestScore:N0}";
            newBestBadge.SetActive(false);
        }

        public void UpdateScore(int targetScore)
        {
            _scoreTween?.Kill();
            _scoreTween = DOTween.To(
                () => _displayedScore,
                x =>
                {
                    _displayedScore = x;
                    scoreText.text = x.ToString("N0");
                },
                targetScore,
                0.5f
            ).SetEase(Ease.OutQuad);

            // 최고점수 갱신 체크
            if (targetScore > _currentBestScore)
            {
                _currentBestScore = targetScore;
                UpdateBestScore(targetScore);
            }
        }

        public void UpdateBestScore(int score)
        {
            bestScoreText.text = $"Best: {score:N0}";
            if (!newBestBadge.activeSelf)
            {
                newBestBadge.SetActive(true);
                newBestBadge.transform.DOPunchScale(Vector3.one * 0.3f, 0.5f);
            }
        }

        public void SetVisible(bool visible)
        {
            hudCanvasGroup.alpha = visible ? 1f : 0f;
            hudCanvasGroup.blocksRaycasts = visible;
        }
    }
}
```

**예상 난이도:** 중
**의존성:** STEP 1 (Canvas), SaveManager, 이벤트 시스템
**구현 순서:** 5

---

## 6. 헥사곤 보드 렌더링

### STEP 6: HexBoardRenderer 구현

- [ ] **헥사곤 셀 프리팹 생성**
- [ ] **다이아몬드형 그리드 렌더링 (43셀)**
- [ ] **숫자별 색상 매핑 적용**
- [ ] **블록 내부 텍스트 자릿수별 크기 조절**
- [ ] **동적 size 계산 (화면 크기 기반)**

**구현 설명:**
설계문서 2.1~2.4절 기반. Pointy-top 헥사곤 그리드를 화면에 렌더링한다. 43셀(3-4-5-6-7-6-5-4-3) 다이아몬드 배열을 사용하고, 숫자별 12단계 색상을 적용한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `HexBoardRenderer` | `RenderBoard(HexGrid)` | 그리드 전체 렌더링 |
| `HexBoardRenderer` | `CalculateHexSize()` | 화면 기반 동적 크기 계산 |
| `HexCellView` | `UpdateDisplay(int)` | 숫자/색상 갱신 |
| `HexCellView` | `SetSelected(bool)` | 선택 상태 표시 |
| `HexColorConfig` | `GetColor(int)` | 숫자→색상 매핑 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI
{
    [CreateAssetMenu(menuName = "HexaMerge/HexColorConfig")]
    public class HexColorConfig : ScriptableObject
    {
        [System.Serializable]
        public struct ColorEntry
        {
            public int value;       // 2, 4, 8, ...
            public Color bgColor;   // 배경 색상
            public Color textColor; // 텍스트 색상
        }

        [SerializeField] private ColorEntry[] colorEntries;

        // 설계문서 2.3절 숫자별 색상 매핑
        // 2=#C8E6C9, 4=#FFF9C4, 8=#FFE0B2, 16=#F8BBD0,
        // 32=#E1BEE7, 64=#B3E5FC, 128=#B2DFDB, 256=#FFAB91,
        // 512=#D1C4E9, 1024=#FFD54F, 2048=#EF5350, 4096+=그라데이션

        private Dictionary<int, ColorEntry> _colorMap;

        public void Initialize()
        {
            _colorMap = new Dictionary<int, ColorEntry>();
            foreach (var entry in colorEntries)
                _colorMap[entry.value] = entry;
        }

        public (Color bg, Color text) GetColor(int value)
        {
            if (_colorMap.TryGetValue(value, out var entry))
                return (entry.bgColor, entry.textColor);
            // 4096+ 기본값
            return (Color.white, Color.white);
        }
    }

    public class HexCellView : MonoBehaviour
    {
        [SerializeField] private SpriteRenderer hexSprite;
        [SerializeField] private TMP_Text numberText;
        [SerializeField] private GameObject selectionGlow;
        [SerializeField] private HexColorConfig colorConfig;

        public void UpdateDisplay(int value)
        {
            if (value <= 0)
            {
                hexSprite.color = new Color(0.9f, 0.9f, 0.9f, 0.3f);
                numberText.text = "";
                return;
            }

            var (bg, text) = colorConfig.GetColor(value);
            hexSprite.color = bg;
            numberText.color = text;
            numberText.text = value.ToString();

            // 설계문서: 자릿수별 크기 조절
            int digits = value.ToString().Length;
            float scale = digits switch
            {
                1 or 2 => 1.0f,    // 기본 크기
                3 => 0.85f,         // 크기 85%
                4 => 0.70f,         // 크기 70%
                _ => 0.55f          // 크기 55%
            };
            numberText.fontSize = _baseFontSize * scale;
        }

        public void SetSelected(bool selected)
        {
            selectionGlow.SetActive(selected);
            if (selected)
            {
                // 설계문서: 흰색 테두리 3px + 글로우 효과
                transform.DOPunchScale(Vector3.one * 0.1f, 0.15f);
            }
        }

        private float _baseFontSize;
        private void Awake() => _baseFontSize = numberText.fontSize;
    }

    public class HexBoardRenderer : MonoBehaviour
    {
        [SerializeField] private HexCellView cellPrefab;
        [SerializeField] private RectTransform boardContainer;
        [SerializeField] private float gap = 4f;

        private Dictionary<CubeCoord, HexCellView> _cellViews = new();

        /// <summary>
        /// 설계문서 2.2절: size 동적 계산 공식
        /// size = (availableWidth - (maxColumns - 1) * gap) / (maxColumns * sqrt(3))
        /// </summary>
        public float CalculateHexSize()
        {
            float availableWidth = boardContainer.rect.width * 0.9f;
            int maxColumns = 7;
            float sqrt3 = Mathf.Sqrt(3f);
            return (availableWidth - (maxColumns - 1) * gap) / (maxColumns * sqrt3);
        }

        public void RenderBoard(HexGrid grid)
        {
            ClearBoard();
            float hexSize = CalculateHexSize();

            foreach (var cell in grid.GetAllCells())
            {
                var worldPos = CoordConverter.CubeToWorld(cell.Coord, hexSize);
                var view = Instantiate(cellPrefab, boardContainer);
                view.transform.localPosition = worldPos;
                view.transform.localScale = Vector3.one * (hexSize / _referenceSize);
                view.UpdateDisplay(cell.HasBlock ? cell.Block.Value : 0);
                _cellViews[cell.Coord] = view;
            }
        }

        public void UpdateCell(CubeCoord coord, int value)
        {
            if (_cellViews.TryGetValue(coord, out var view))
                view.UpdateDisplay(value);
        }

        private void ClearBoard()
        {
            foreach (var view in _cellViews.Values)
                Destroy(view.gameObject);
            _cellViews.Clear();
        }

        private float _referenceSize = 28f;
    }
}
```

**예상 난이도:** 상
**의존성:** STEP 1, Core의 HexGrid/CubeCoord/CoordConverter, HexColorConfig
**구현 순서:** 6

---

## 7. 일시정지 화면

### STEP 7: PauseScreen 구현

- [ ] **반투명 오버레이 + 중앙 패널**
- [ ] **Resume/Restart/Settings/Main Menu 버튼**
- [ ] **현재 점수 표시**

**구현 설명:**
설계문서 1.4절 기반. 게임 보드 위에 반투명(60%) 오버레이를 덮고, 중앙에 일시정지 메뉴를 표시한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `PauseScreen` | `Show()` | 오버레이 표시 + TimeScale=0 |
| `PauseScreen` | `OnResumeClicked()` | 게임 재개 |
| `PauseScreen` | `OnRestartClicked()` | 확인 팝업 후 재시작 |
| `PauseScreen` | `OnMainMenuClicked()` | 확인 팝업 후 메인 메뉴 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI.Screens
{
    public class PauseScreen : ScreenBase
    {
        public override bool IsOverlay => true;

        [SerializeField] private Image overlayBg;
        [SerializeField] private RectTransform menuPanel;
        [SerializeField] private TMP_Text currentScoreText;
        [SerializeField] private Button resumeButton;
        [SerializeField] private Button restartButton;
        [SerializeField] private Button settingsButton;
        [SerializeField] private Button mainMenuButton;

        public override void Show()
        {
            gameObject.SetActive(true);

            // 설계문서: #000000, 불투명도 60%
            overlayBg.color = new Color(0, 0, 0, 0);
            overlayBg.DOFade(0.6f, 0.3f);

            menuPanel.localScale = Vector3.one * 0.8f;
            menuPanel.DOScale(1f, 0.3f).SetEase(Ease.OutBack);

            currentScoreText.text = $"Score: {GameManager.Instance.CurrentScore:N0}";
            Time.timeScale = 0f;
        }

        public override void Hide()
        {
            Time.timeScale = 1f;
            overlayBg.DOFade(0f, 0.2f);
            menuPanel.DOScale(0.8f, 0.2f)
                .SetEase(Ease.InBack)
                .OnComplete(() => gameObject.SetActive(false));
        }

        private void OnResumeClicked()
        {
            UIManager.Instance.ScreenManager.GoBack();
        }

        private void OnRestartClicked()
        {
            PopupManager.Instance.ShowConfirm(
                "재시작하시겠습니까?",
                () =>
                {
                    Time.timeScale = 1f;
                    GameManager.Instance.RestartGame();
                    UIManager.Instance.ScreenManager.GoBack();
                });
        }

        private void OnMainMenuClicked()
        {
            PopupManager.Instance.ShowConfirm(
                "메인 메뉴로 돌아가시겠습니까?\n현재 진행 상황이 저장됩니다.",
                () =>
                {
                    Time.timeScale = 1f;
                    GameManager.Instance.SaveAndExit();
                    UIManager.Instance.ScreenManager.ShowScreen(ScreenType.MainMenu);
                });
        }
    }
}
```

**예상 난이도:** 중
**의존성:** STEP 2, PopupManager, GameManager
**구현 순서:** 7

---

## 8. 설정 화면

### STEP 8: SettingsScreen 구현

- [ ] **BGM/SFX 볼륨 슬라이더**
- [ ] **진동 토글 (모바일 전용)**
- [ ] **언어 선택 드롭다운**
- [ ] **데이터 초기화 (확인 팝업)**
- [ ] **링크 버튼 (개인정보, 이용약관)**

**구현 설명:**
설계문서 1.5절 기반. BGM/SFX 볼륨, 진동, 언어, 알림 설정 및 데이터 초기화 기능을 제공한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `SettingsScreen` | `Show()` | 현재 설정값 로드 |
| `SettingsScreen` | `OnBGMVolumeChanged(float)` | BGM 볼륨 변경 |
| `SettingsScreen` | `OnSFXVolumeChanged(float)` | SFX 볼륨 변경 |
| `SettingsScreen` | `OnVibrationToggle(bool)` | 진동 설정 |
| `SettingsScreen` | `OnLanguageChanged(int)` | 언어 변경 |
| `SettingsScreen` | `OnResetData()` | 데이터 초기화 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI.Screens
{
    public class SettingsScreen : ScreenBase
    {
        [Header("Audio")]
        [SerializeField] private Slider bgmSlider;
        [SerializeField] private Slider sfxSlider;
        [SerializeField] private TMP_Text bgmPercentText;
        [SerializeField] private TMP_Text sfxPercentText;

        [Header("General")]
        [SerializeField] private Toggle vibrationToggle;
        [SerializeField] private GameObject vibrationRow; // 모바일 전용
        [SerializeField] private Toggle notificationToggle;
        [SerializeField] private TMP_Dropdown languageDropdown;

        [Header("Data")]
        [SerializeField] private Button resetButton;
        [SerializeField] private Button privacyButton;
        [SerializeField] private Button termsButton;
        [SerializeField] private Button backButton;

        public override void Show()
        {
            base.Show();
            LoadCurrentSettings();

            // 모바일에서만 진동 옵션 표시
            #if UNITY_ANDROID || UNITY_IOS
            vibrationRow.SetActive(true);
            #else
            vibrationRow.SetActive(false);
            #endif
        }

        private void LoadCurrentSettings()
        {
            var settings = SettingsManager.Instance;
            bgmSlider.value = settings.BGMVolume;
            sfxSlider.value = settings.SFXVolume;
            vibrationToggle.isOn = settings.VibrationEnabled;
            notificationToggle.isOn = settings.NotificationEnabled;
            languageDropdown.value = settings.LanguageIndex;

            UpdatePercentText(bgmPercentText, settings.BGMVolume);
            UpdatePercentText(sfxPercentText, settings.SFXVolume);
        }

        private void OnBGMVolumeChanged(float value)
        {
            SettingsManager.Instance.SetBGMVolume(value);
            AudioManager.Instance.SetBGMVolume(value);
            UpdatePercentText(bgmPercentText, value);
        }

        private void OnSFXVolumeChanged(float value)
        {
            SettingsManager.Instance.SetSFXVolume(value);
            AudioManager.Instance.SetSFXVolume(value);
            UpdatePercentText(sfxPercentText, value);
        }

        private void OnResetData()
        {
            // 설계문서: 확인 팝업 필수 ("정말 초기화하시겠습니까?")
            PopupManager.Instance.ShowConfirm(
                "정말 초기화하시겠습니까?\n모든 게임 데이터가 삭제됩니다.",
                () =>
                {
                    SaveManager.Instance.ResetAllData();
                    UIManager.Instance.ScreenManager.ShowScreen(ScreenType.MainMenu);
                });
        }

        private void UpdatePercentText(TMP_Text text, float value)
        {
            text.text = $"{Mathf.RoundToInt(value * 100)}%";
        }
    }
}
```

**예상 난이도:** 중
**의존성:** STEP 2, AudioManager, SettingsManager, SaveManager
**구현 순서:** 8

---

## 9. 리더보드 화면

### STEP 9: LeaderboardScreen 구현

- [ ] **탭 전환 (전체/주간/친구)**
- [ ] **상위 3위 강조 표시 (금/은/동)**
- [ ] **순위 리스트 스크롤 뷰**
- [ ] **내 순위 하단 고정**

**구현 설명:**
설계문서 1.6절 기반. 3개 탭(ALL/WEEKLY/FRIENDS)과 스크롤 가능한 순위 리스트, 하단 고정 내 순위를 구현한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `LeaderboardScreen` | `Show()` | 기본 탭(ALL) 로드 |
| `LeaderboardScreen` | `OnTabChanged(LeaderboardTab)` | 탭 전환 |
| `LeaderboardScreen` | `LoadEntries(LeaderboardTab)` | 순위 데이터 로드 |
| `LeaderboardScreen` | `UpdateMyRank(LeaderboardEntry)` | 내 순위 갱신 |
| `LeaderboardEntryView` | `SetData(int rank, string name, int score)` | 항목 표시 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI.Screens
{
    public enum LeaderboardTab { All, Weekly, Friends }

    public class LeaderboardScreen : ScreenBase
    {
        [SerializeField] private Button[] tabButtons;   // ALL, WEEKLY, FRIENDS
        [SerializeField] private Image[] tabUnderlines;
        [SerializeField] private ScrollRect scrollView;
        [SerializeField] private Transform contentParent;
        [SerializeField] private LeaderboardEntryView entryPrefab;
        [SerializeField] private LeaderboardEntryView myRankView; // 하단 고정

        [Header("Colors")]
        [SerializeField] private Color activeTabColor = new Color(0.298f, 0.686f, 0.314f); // #4CAF50
        [SerializeField] private Color inactiveTabColor = new Color(0.620f, 0.620f, 0.620f); // #9E9E9E

        private LeaderboardTab _currentTab;
        private List<LeaderboardEntryView> _entries = new();

        public override void Show()
        {
            base.Show();
            OnTabChanged(LeaderboardTab.All);
        }

        public void OnTabChanged(LeaderboardTab tab)
        {
            _currentTab = tab;
            for (int i = 0; i < tabButtons.Length; i++)
            {
                bool active = i == (int)tab;
                tabUnderlines[i].gameObject.SetActive(active);
                tabButtons[i].GetComponentInChildren<TMP_Text>().color =
                    active ? activeTabColor : inactiveTabColor;
            }
            LoadEntries(tab);
        }

        private async void LoadEntries(LeaderboardTab tab)
        {
            ClearEntries();

            var data = await LeaderboardService.Instance.GetEntries(tab);

            foreach (var entry in data.entries)
            {
                var view = Instantiate(entryPrefab, contentParent);
                view.SetData(entry.rank, entry.playerName, entry.score);

                // 설계문서: 1~3위 금/은/동 강조
                if (entry.rank <= 3)
                    view.SetTopRankStyle(entry.rank);

                _entries.Add(view);
            }

            // 내 순위 하단 고정 표시
            // 설계문서: 배경 #E8F5E9, 강조 표시
            myRankView.SetData(data.myRank, data.myName, data.myScore);
            myRankView.SetHighlighted(true);
        }

        private void ClearEntries()
        {
            foreach (var entry in _entries)
                Destroy(entry.gameObject);
            _entries.Clear();
        }
    }

    public class LeaderboardEntryView : MonoBehaviour
    {
        [SerializeField] private TMP_Text rankText;
        [SerializeField] private Image rankIcon;
        [SerializeField] private TMP_Text nameText;
        [SerializeField] private TMP_Text scoreText;
        [SerializeField] private Image bgImage;

        // 설계문서: 금(#FFD700), 은(#C0C0C0), 동(#CD7F32)
        private static readonly Color[] TopColors =
        {
            new Color(1f, 0.843f, 0f),     // Gold
            new Color(0.753f, 0.753f, 0.753f), // Silver
            new Color(0.804f, 0.498f, 0.196f)  // Bronze
        };

        public void SetData(int rank, string name, int score)
        {
            rankText.text = $"#{rank}";
            nameText.text = name;
            scoreText.text = score.ToString("N0");
        }

        public void SetTopRankStyle(int rank)
        {
            rankIcon.gameObject.SetActive(true);
            rankIcon.color = TopColors[rank - 1];
        }

        public void SetHighlighted(bool highlighted)
        {
            // 설계문서: 배경 #E8F5E9
            bgImage.color = highlighted
                ? new Color(0.910f, 0.961f, 0.914f)
                : Color.white;
        }
    }
}
```

**예상 난이도:** 중
**의존성:** STEP 2, LeaderboardService
**구현 순서:** 9

---

## 10. 상점 화면

### STEP 10: ShopScreen 구현

- [ ] **카테고리 탭 (ITEMS / COINS / NO ADS)**
- [ ] **상품 카드 2열 그리드 레이아웃**
- [ ] **BEST/HOT 뱃지 표시**
- [ ] **구매 버튼 및 결제 플로우 연동**
- [ ] **무료 젬 배너 (보상 광고)**
- [ ] **보유 재화 표시**

**구현 설명:**
설계문서 1.7절 기반. 3개 카테고리 탭과 2열 그리드 상품 카드, 하단 고정 무료 젬 배너를 구현한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `ShopScreen` | `Show()` | 상품 목록 로드 |
| `ShopScreen` | `OnTabChanged(ShopTab)` | 카테고리 전환 |
| `ShopScreen` | `OnFreeGemsClicked()` | 보상 광고로 젬 획득 |
| `ShopScreen` | `UpdateCurrencyDisplay()` | 보유 재화 갱신 |
| `ShopItemCard` | `SetData(ShopItem)` | 상품 카드 표시 |
| `ShopItemCard` | `OnBuyClicked()` | 구매 처리 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI.Screens
{
    public enum ShopTab { Items, Coins, NoAds }

    public class ShopScreen : ScreenBase
    {
        [SerializeField] private Button[] tabButtons;
        [SerializeField] private TMP_Text gemCountText;
        [SerializeField] private GridLayoutGroup itemGrid;
        [SerializeField] private Transform gridContent;
        [SerializeField] private ShopItemCard cardPrefab;
        [SerializeField] private Button freeGemsButton;
        [SerializeField] private ShopCatalog catalog;

        private ShopTab _currentTab;
        private List<ShopItemCard> _cards = new();

        public override void Show()
        {
            base.Show();
            UpdateCurrencyDisplay();
            OnTabChanged(ShopTab.Items);
        }

        public void OnTabChanged(ShopTab tab)
        {
            _currentTab = tab;
            ClearCards();

            var items = catalog.GetItems(tab);
            foreach (var item in items)
            {
                var card = Instantiate(cardPrefab, gridContent);
                card.SetData(item);
                card.OnPurchase += HandlePurchase;
                _cards.Add(card);
            }
        }

        private async void HandlePurchase(ShopItem item)
        {
            bool success;
            if (item.isRealMoney)
                success = await IAPManager.Instance.Purchase(item.productId);
            else
                success = CurrencyManager.Instance.SpendGems(item.gemPrice);

            if (success)
            {
                item.OnPurchased();
                UpdateCurrencyDisplay();
                ToastManager.Instance.Show("구매 완료!");
            }
        }

        private async void OnFreeGemsClicked()
        {
            bool rewarded = await AdRewardManager.Instance.ShowRewardedAd(
                AdTriggerType.FreeGems);
            if (rewarded)
            {
                CurrencyManager.Instance.AddGems(10);
                UpdateCurrencyDisplay();
                ToastManager.Instance.Show("+10 Gems!");
            }
        }

        private void UpdateCurrencyDisplay()
        {
            gemCountText.text = CurrencyManager.Instance.Gems.ToString("N0");
        }

        private void ClearCards()
        {
            foreach (var card in _cards)
                Destroy(card.gameObject);
            _cards.Clear();
        }
    }
}
```

**예상 난이도:** 상
**의존성:** STEP 2, IAPManager, AdRewardManager, CurrencyManager, ShopCatalog
**구현 순서:** 10

---

## 11. 반응형 레이아웃 시스템

### STEP 11: ResponsiveLayoutManager 구현

- [ ] **3단계 브레이크포인트 감지 (모바일/태블릿/데스크톱)**
- [ ] **게임 보드 크기 동적 조정**
- [ ] **웹 가로/모바일 세로 레이아웃 전환**
- [ ] **세로/가로 모드 전환 처리**

**구현 설명:**
설계문서 7절 기반. 화면 크기에 따라 3단계(모바일 <768px, 태블릿 768~1024px, 데스크톱 >1024px) 브레이크포인트로 레이아웃을 조정한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `ResponsiveLayoutManager` | `DetectBreakpoint()` | 현재 브레이크포인트 감지 |
| `ResponsiveLayoutManager` | `ApplyLayout(Breakpoint)` | 레이아웃 적용 |
| `ResponsiveLayoutManager` | `OnScreenSizeChanged()` | 크기 변경 대응 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI
{
    public enum Breakpoint { Mobile, Tablet, Desktop }

    public class ResponsiveLayoutManager : MonoBehaviour
    {
        [Header("Layout Roots")]
        [SerializeField] private RectTransform gameplayRoot;
        [SerializeField] private RectTransform sidebarPanel;
        [SerializeField] private RectTransform boardContainer;
        [SerializeField] private HexBoardRenderer boardRenderer;

        [Header("Breakpoints")]
        [SerializeField] private float tabletMinWidth = 768f;
        [SerializeField] private float desktopMinWidth = 1024f;

        private Breakpoint _currentBreakpoint;
        private Vector2 _lastScreenSize;

        private void Update()
        {
            var screenSize = new Vector2(Screen.width, Screen.height);
            if (screenSize != _lastScreenSize)
            {
                _lastScreenSize = screenSize;
                OnScreenSizeChanged();
            }
        }

        private void OnScreenSizeChanged()
        {
            var bp = DetectBreakpoint();
            if (bp != _currentBreakpoint)
            {
                _currentBreakpoint = bp;
                ApplyLayout(bp);
            }
            boardRenderer.CalculateHexSize();
        }

        public Breakpoint DetectBreakpoint()
        {
            float width = Screen.width;
            if (width >= desktopMinWidth) return Breakpoint.Desktop;
            if (width >= tabletMinWidth) return Breakpoint.Tablet;
            return Breakpoint.Mobile;
        }

        public void ApplyLayout(Breakpoint bp)
        {
            switch (bp)
            {
                case Breakpoint.Mobile:
                    // 설계문서: 세로 모드, 보드 폭 90%, 사이드바 숨김
                    sidebarPanel.gameObject.SetActive(false);
                    boardContainer.anchorMin = new Vector2(0.05f, 0.1f);
                    boardContainer.anchorMax = new Vector2(0.95f, 0.85f);
                    break;

                case Breakpoint.Tablet:
                    sidebarPanel.gameObject.SetActive(false);
                    boardContainer.anchorMin = new Vector2(0.1f, 0.1f);
                    boardContainer.anchorMax = new Vector2(0.9f, 0.85f);
                    break;

                case Breakpoint.Desktop:
                    // 설계문서: 좌측 사이드바 20%, 보드 60%
                    sidebarPanel.gameObject.SetActive(true);
                    sidebarPanel.anchorMin = new Vector2(0f, 0f);
                    sidebarPanel.anchorMax = new Vector2(0.2f, 1f);
                    boardContainer.anchorMin = new Vector2(0.25f, 0.05f);
                    boardContainer.anchorMax = new Vector2(0.95f, 0.9f);
                    break;
            }
        }

        public Breakpoint CurrentBreakpoint => _currentBreakpoint;
    }
}
```

**예상 난이도:** 상
**의존성:** STEP 6 (보드 렌더러), 모든 화면
**구현 순서:** 11

---

## 12. 입력 처리 시스템

### STEP 12: InputManager 구현

- [ ] **터치 입력 처리 (모바일)**
- [ ] **마우스 클릭 입력 처리 (웹)**
- [ ] **키보드 단축키 (웹 전용)**
- [ ] **입력 추상화 레이어**

**구현 설명:**
설계문서 7절 기반. 터치와 마우스 입력을 추상화하여 동일한 인터페이스로 처리한다.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `GameInputManager` | `ProcessInput()` | 프레임별 입력 처리 |
| `GameInputManager` | `ScreenToBoard(Vector2)` | 화면좌표→보드좌표 변환 |
| `GameInputManager` | `OnCellTapped(CubeCoord)` | 셀 탭 이벤트 발생 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI
{
    public class GameInputManager : MonoBehaviour
    {
        [SerializeField] private HexBoardRenderer boardRenderer;
        [SerializeField] private Camera uiCamera;

        public event Action<CubeCoord> OnCellTapped;
        private bool _inputEnabled = true;

        public void SetInputEnabled(bool enabled) => _inputEnabled = enabled;

        private void Update()
        {
            if (!_inputEnabled) return;
            ProcessInput();
        }

        private void ProcessInput()
        {
            // 터치 입력 (모바일)
            if (Input.touchCount > 0)
            {
                var touch = Input.GetTouch(0);
                if (touch.phase == TouchPhase.Ended)
                    HandleTap(touch.position);
            }
            // 마우스 입력 (웹/에디터)
            else if (Input.GetMouseButtonUp(0))
            {
                HandleTap(Input.mousePosition);
            }

            // 키보드 단축키 (웹 전용)
            #if UNITY_WEBGL || UNITY_EDITOR
            if (Input.GetKeyDown(KeyCode.Escape))
                UIManager.Instance.ScreenManager.GoBack();
            if (Input.GetKeyDown(KeyCode.H))
                GameManager.Instance.ShowHint();
            #endif
        }

        private void HandleTap(Vector2 screenPos)
        {
            // UI 위 탭은 무시
            if (EventSystem.current.IsPointerOverGameObject()) return;

            var worldPos = uiCamera.ScreenToWorldPoint(screenPos);
            float hexSize = boardRenderer.CalculateHexSize();
            var cubeCoord = CoordConverter.WorldToCube(worldPos, hexSize);
            var roundedCoord = CoordConverter.CubeRound(cubeCoord);

            if (boardRenderer.HasCell(roundedCoord))
                OnCellTapped?.Invoke(roundedCoord);
        }
    }
}
```

**예상 난이도:** 중
**의존성:** STEP 6, Core CoordConverter, EventSystem
**구현 순서:** 12

---

## 13. 공통 UI 컴포넌트

### STEP 13: PopupManager 및 공통 위젯

- [ ] **확인 팝업 (Confirm Dialog)**
- [ ] **토스트 메시지**
- [ ] **로딩 오버레이**
- [ ] **공통 버튼 스타일**

**구현 설명:**
여러 화면에서 공통으로 사용하는 팝업, 토스트, 로딩 등의 UI 컴포넌트.

**필요한 클래스/메서드:**

| 클래스 | 메서드 | 설명 |
|--------|--------|------|
| `PopupManager` | `ShowConfirm(string, Action, Action)` | 확인/취소 팝업 |
| `PopupManager` | `ShowAlert(string)` | 알림 팝업 |
| `ToastManager` | `Show(string, float)` | 토스트 메시지 표시 |
| `LoadingOverlay` | `Show() / Hide()` | 로딩 화면 |

**C# 코드 스니펫:**

```csharp
namespace HexaMerge.UI
{
    public class PopupManager : MonoBehaviour
    {
        [SerializeField] private ConfirmPopup confirmPopupPrefab;
        [SerializeField] private Transform popupParent; // Overlay Canvas

        public void ShowConfirm(string message, Action onConfirm, Action onCancel = null)
        {
            var popup = Instantiate(confirmPopupPrefab, popupParent);
            popup.Setup(message, () =>
            {
                onConfirm?.Invoke();
                Destroy(popup.gameObject);
            },
            () =>
            {
                onCancel?.Invoke();
                Destroy(popup.gameObject);
            });
        }

        public void ShowAlert(string message)
        {
            ShowConfirm(message, null);
        }
    }

    public class ToastManager : MonoBehaviour
    {
        [SerializeField] private TMP_Text toastText;
        [SerializeField] private CanvasGroup toastGroup;
        [SerializeField] private RectTransform toastRect;

        private Sequence _currentSequence;

        public void Show(string message, float duration = 2f)
        {
            _currentSequence?.Kill();
            toastText.text = message;

            _currentSequence = DOTween.Sequence()
                .Append(toastGroup.DOFade(1f, 0.2f))
                .Join(toastRect.DOAnchorPosY(100f, 0.3f).SetEase(Ease.OutBack))
                .AppendInterval(duration)
                .Append(toastGroup.DOFade(0f, 0.3f))
                .Join(toastRect.DOAnchorPosY(0f, 0.3f));
        }
    }
}
```

**예상 난이도:** 하
**의존성:** STEP 1 (Overlay Canvas), DOTween
**구현 순서:** 13 (필요 시 더 일찍)

---

## 14. 에지 케이스 및 주의사항

| # | 카테고리 | 에지 케이스 | 대응 방안 |
|---|---------|-----------|---------|
| 1 | SafeArea | 노치/펀치홀이 있는 디바이스 | SafeAreaHandler로 동적 패딩 적용 |
| 2 | SafeArea | 화면 회전 시 SafeArea 변경 | Update에서 매 프레임 체크 |
| 3 | 화면 전환 | 빠른 연속 탭으로 중복 전환 | interactable 즉시 비활성화 |
| 4 | 화면 전환 | 애니메이션 중 뒤로가기 | 전환 중 입력 차단 |
| 5 | HUD | 점수 999,999,999 초과 | 축약 표시 (999M+) |
| 6 | 점수 팝업 | 동시 다수 팝업 발생 | 오브젝트 풀링, 위치 오프셋 |
| 7 | 보드 | 매우 작은 화면 (320px 미만) | 최소 size 제한, 스크롤 폴백 |
| 8 | 보드 | 매우 큰 화면 (4K) | 최대 size 제한 |
| 9 | 리더보드 | 네트워크 오류 | 오프라인 캐시 표시 + 에러 토스트 |
| 10 | 상점 | 결제 중 앱 종료 | 구매 대기열 + 다음 시작 시 복원 |
| 11 | 상점 | 재화 부족 상태에서 구매 시도 | 코인 팩 탭으로 안내 |
| 12 | 설정 | 데이터 초기화 후 화면 갱신 | 모든 매니저 리셋 + 메인 메뉴 이동 |
| 13 | 입력 | UI 위에서 보드 탭 | EventSystem.IsPointerOverGameObject 체크 |
| 14 | 입력 | 멀티터치 | 첫 번째 터치만 처리 |
| 15 | WebGL | Canvas 폰트 로딩 지연 | 폰트 프리로딩 + 폴백 폰트 |

---

## 15. 성능 최적화

### 15.1 Canvas 최적화

- [ ] **Canvas 분리**: 자주 변경되는 요소(점수, 콤보)와 정적 요소를 별도 Canvas에 배치하여 리빌드 최소화
- [ ] **레이캐스트 타겟 최소화**: 클릭 불필요한 Image/Text의 Raycast Target 비활성화
- [ ] **Canvas Group 활용**: SetActive 대신 CanvasGroup.alpha로 표시/숨김 (재빌드 방지)

### 15.2 텍스트 최적화

- [ ] **TextMeshPro SDF 폰트**: 해상도 독립적 렌더링, 런타임 스케일링 비용 절감
- [ ] **폰트 아틀라스 최적화**: 사용 문자만 포함 (숫자 0-9, 영문, 한글 기본 2,350자)
- [ ] **동적 폰트 비활성화**: 필요한 글리프만 사전 생성

### 15.3 이미지 최적화

- [ ] **스프라이트 아틀라스**: UI 스프라이트를 하나의 아틀라스로 통합 (드로우콜 감소)
- [ ] **9-슬라이스 스프라이트**: 버튼, 패널 등 크기 가변 요소에 사용
- [ ] **밉맵 비활성화**: UI 텍스처는 밉맵 불필요

### 15.4 스크롤 뷰 최적화

- [ ] **가상화 리스트**: 리더보드 등 긴 리스트에 오브젝트 풀링 적용
- [ ] **제한된 업데이트**: 스크롤 중에만 가시 영역 항목 갱신

---

## 16. 전체 체크리스트 요약

### 난이도별 분류

**하 (5개)**
- [ ] STEP 1: Canvas 구조 설정
- [ ] STEP 13: 공통 UI 컴포넌트 (팝업/토스트)
- [ ] SafeAreaHandler
- [ ] 스프라이트 아틀라스 구성
- [ ] 레이캐스트 타겟 최적화

**중 (12개)**
- [ ] STEP 2: ScreenManager 화면 전환 시스템
- [ ] STEP 3: 메인 메뉴 화면
- [ ] STEP 4: 게임 플레이 화면
- [ ] STEP 5: HUD 시스템
- [ ] STEP 7: 일시정지 화면
- [ ] STEP 8: 설정 화면
- [ ] STEP 9: 리더보드 화면
- [ ] STEP 12: 입력 처리 시스템
- [ ] 점수 카운트업 애니메이션
- [ ] 콤보 카운터 UI
- [ ] 가상화 스크롤 리스트
- [ ] Canvas 분리 최적화

**상 (4개)**
- [ ] STEP 6: 헥사곤 보드 렌더링
- [ ] STEP 10: 상점 화면 (결제 연동)
- [ ] STEP 11: 반응형 레이아웃 시스템
- [ ] TextMeshPro 폰트 아틀라스 최적화

### 예상 구현 순서 및 기간

| 우선순위 | STEP | 항목 | 예상 기간 |
|---------|------|------|---------|
| 1 | STEP 1 | Canvas 인프라 | 0.5일 |
| 2 | STEP 2 | ScreenManager | 1일 |
| 3 | STEP 13 | 공통 UI (팝업/토스트) | 0.5일 |
| 4 | STEP 6 | 헥사곤 보드 렌더링 | 2일 |
| 5 | STEP 12 | 입력 처리 | 1일 |
| 6 | STEP 5 | HUD 시스템 | 1일 |
| 7 | STEP 3 | 메인 메뉴 | 1일 |
| 8 | STEP 4 | 게임 플레이 화면 | 1일 |
| 9 | STEP 7 | 일시정지 화면 | 0.5일 |
| 10 | STEP 8 | 설정 화면 | 1일 |
| 11 | STEP 9 | 리더보드 | 1.5일 |
| 12 | STEP 10 | 상점 | 2일 |
| 13 | STEP 11 | 반응형 레이아웃 | 1.5일 |
| 14 | - | 성능 최적화 | 1일 |
| | | **합계** | **약 15.5일** |
