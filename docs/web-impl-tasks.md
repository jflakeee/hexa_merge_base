# Hexa Merge - 순수 웹 버전 구현 태스크 목록

> 작성일: 2026-02-23
> 기술 스택: JavaScript ES2020+, ES Modules, Canvas 2D, Web Audio API, HTML+CSS
> 벤치마크: XUP - Brain Training Game
> 참고: Unity C# 37파일 → JavaScript ~20파일

---

## 파일 구조

```
index.html                    ← 단일 진입점
src/
├── main.js                   ← 앱 부트스트랩, 게임 루프
├── core/
│   ├── HexCoord.js           ← 큐브 좌표계 (q, r)
│   ├── HexCell.js            ← 셀 데이터 모델
│   ├── HexGrid.js            ← 19셀 그리드 (Map 기반)
│   ├── MergeSystem.js        ← BFS 병합 알고리즘
│   └── TileHelper.js         ← 값 검증, 포맷팅, 랜덤 생성
├── game/
│   ├── GameManager.js        ← 상태 머신 + 탭 핸들링
│   ├── ScoreManager.js       ← 점수 계산, 최고 점수
│   ├── SaveSystem.js         ← localStorage 직렬화
│   └── InputManager.js       ← PointerEvent 처리
├── render/
│   ├── Renderer.js           ← 메인 Canvas 렌더러 + 게임 루프
│   ├── HexCellView.js        ← 셀 그리기 (색상, 텍스트, 왕관)
│   └── ProceduralSprites.js  ← 아이콘 프로시저럴 생성
├── ui/
│   ├── ScreenManager.js      ← 화면 전환 (fade 0.3s)
│   ├── HUDManager.js         ← 점수, 버튼 표시
│   ├── GameOverScreen.js     ← 게임오버 오버레이
│   ├── PauseScreen.js        ← 일시정지 오버레이
│   └── HowToPlayScreen.js   ← 도움말 오버레이
├── animation/
│   ├── TileAnimator.js       ← 스폰, 머지이동, 점수팝업
│   └── MergeEffect.js        ← 스플래시, 파티클, 스플랫
├── audio/
│   └── ProceduralSFX.js      ← 13종 크리스탈 SFX 합성
└── config/
    └── tileColors.js         ← 16색 타일 색상 상수
```

---

## Phase 1: Core 로직 (순수 JavaScript, Unity 의존성 0)

### 1-1. HexCoord.js
- **원본**: Assets/Scripts/Core/HexCoord.cs (111줄)
- **구현**:
  - `class HexCoord { constructor(q, r) }` - 큐브 좌표
  - `static DIRECTIONS` - 6방향 상수 (NE, E, SE, SW, W, NW)
  - `getNeighbors()` - 인접 6셀 좌표 반환
  - `distanceTo(other)` - 큐브 거리 계산
  - `equals(other)` - 좌표 비교
  - `toKey()` - Map 키 문자열 `"q,r"`
  - `static fromKey(key)` - 키 → 좌표 역변환
  - `toPixel(hexSize)` - 화면 좌표 변환 (flat-top)
  - `static pixelToHex(x, y, hexSize)` - 역변환 (히트테스트용)
- **주의**: s = -q - r 제약조건 유지

### 1-2. HexCell.js
- **원본**: Assets/Scripts/Core/HexCell.cs
- **구현**:
  - `class HexCell { constructor(coord) }` - coord, value, isEmpty
  - `setValue(val)` / `clear()` / `getValue()`
  - `isEmpty` getter

### 1-3. HexGrid.js
- **원본**: Assets/Scripts/Core/HexGrid.cs (119줄)
- **구현**:
  - `class HexGrid` - `Map<string, HexCell>` 기반
  - `static createDiamond(radius)` - 19셀(반지름2) 그리드 생성
  - `getCell(coord)` / `setCell(coord, value)`
  - `getNeighbors(coord)` - 그리드 범위 내 인접셀
  - `getEmptyCells()` / `isFull()`
  - `hasValidMerge()` - 병합 가능 여부
  - `getHighestValueCell()` / `getMinDisplayedValue()`
  - `getAllCells()` - 이터레이터
  - `clone()` - 깊은 복사 (저장용)

### 1-4. TileHelper.js
- **원본**: Assets/Scripts/Core/TileHelper.cs
- **구현**:
  - `getNewTileValue()` - 90%→2, 10%→4
  - `getInitialValue()` - 50%→2, 30%→4, 15%→8, 5%→16
  - `getRefillValue(minDisplayed)` - min~min×8 가중 랜덤(1/i)
  - `formatValue(val)` - 천단위 축약 (1k, 1.5m, 2b)
  - `isValidValue(val)` - 2의 거듭제곱 검증
  - `getTileColor(val)` - 값→색상 매핑

### 1-5. MergeSystem.js
- **원본**: Assets/Scripts/Game/MergeSystem.cs (199줄)
- **구현**:
  - `tryMerge(grid, tapCoord)` → `{ merged, result }` 또는 `null`
  - `findConnectedGroup(grid, startCoord)` - BFS 탐색
    - `visited Set`, `depthMap`, `parentMap`
    - 깊이별 그룹화 → `depthGroups`
  - `calculateMergeValue(baseValue, depthLevels)` - `baseValue × 2^depthLevels`
  - `MergeResult` 객체: `{ tapCoord, baseValue, resultValue, scoreGained, mergedCells, depthGroups }`
- **핵심 알고리즘**: BFS 트리 + 깊이 레벨 수 기반 값 계산

---

## Phase 2: 게임 상태 관리

### 2-1. GameManager.js
- **원본**: Assets/Scripts/Game/GameManager.cs (276줄) + GameplayController.cs
- **구현**:
  - `class GameManager extends EventTarget`
  - 상태 머신: `Ready → Playing ↔ Paused → GameOver`
  - `startNewGame()` - 그리드 초기화, 초기 타일 배치
  - `handleTap(coord)` - 머지 시도 → 점수 갱신 → 128x 소멸 → 리필 → 왕관 → 게임오버 체크
  - `destroySmallBlocks(maxValue)` - threshold = maxValue/128
  - `fillAllEmptyCells()` - 리필 로직
  - `updateCrowns()` - 최고값 셀에 왕관 표시
  - `checkGameOver()` - 빈셀 없음 + 머지 불가
  - `continueAfterGameOver()` - 랜덤 3타일 제거
  - `pauseGame()` / `resumeGame()`
  - 이벤트 발송: `merge`, `scoreUpdate`, `gameOver`, `crownChange`, `tileSpawn`

### 2-2. ScoreManager.js
- **원본**: Assets/Scripts/Game/ScoreManager.cs
- **구현**:
  - `score` / `highScore` 프로퍼티
  - `addScore(points)` - 점수 추가 + 최고점 갱신
  - `reset()` - 현재 점수 초기화
  - `saveHighScore()` / `loadHighScore()` - localStorage

### 2-3. SaveSystem.js
- **원본**: Assets/Scripts/Game/SaveSystem.cs
- **구현**:
  - `saveGame(gameState)` - JSON 직렬화 → localStorage
  - `loadGame()` → gameState 또는 null
  - `hasSavedGame()` - 저장 데이터 존재 여부
  - `deleteSave()` - 저장 데이터 삭제
  - 저장 데이터: `{ grid, score, highScore, timestamp }`

### 2-4. InputManager.js
- **원본**: Assets/Scripts/Input/InputManager.cs
- **구현**:
  - PointerEvent 기반 (마우스+터치 통합)
  - `canvas.addEventListener('pointerdown', handler)`
  - 화면 좌표 → Canvas 좌표 → 큐브 좌표 변환
  - `pixelToHex()` 히트테스트로 탭된 셀 판별
  - DPR 보정: `(clientX - rect.left) * (canvas.width / rect.width)`
  - `touch-action: none` CSS로 기본 터치 동작 방지

---

## Phase 3: Canvas 2D 렌더링

### 3-1. Renderer.js (메인 렌더러)
- **원본**: Assets/Scripts/UI/HexBoardRenderer.cs + ResponsiveLayout.cs
- **구현**:
  - `class Renderer` - 메인 Canvas 관리
  - 다중 레이어: 배경(정적) + 타일(부분갱신) + 이펙트(매프레임)
  - `init(canvas)` - DPR 설정, 리사이즈 핸들러
  - `resize()` - 반응형 크기 재계산
    - hexSize = `Math.min(containerW, containerH) / gridSpan * 0.85`
    - 중앙 정렬 오프셋 계산
  - `render(gameState, animations)` - 전체 프레임 렌더
  - `renderBackground()` - 배경 그리드 (OffscreenCanvas 캐시)
  - `renderTiles(grid)` - 각 셀 렌더링 (HexCellView 위임)
  - `renderEffects(effects)` - 파티클, 스플래시
  - 좌표 변환: `hexToPixel(q, r)` / `pixelToHex(x, y)`

### 3-2. HexCellView.js (셀 비주얼)
- **원본**: Assets/Scripts/UI/HexCellView.cs (493줄)
- **구현**:
  - `drawCell(ctx, x, y, size, value, options)` - 단일 셀 그리기
  - 육각형 Path2D: flat-top, 6꼭짓점 계산
  - 색상 채우기: `tileColors[value]` 기반 그라디언트
  - 텍스트: `ctx.fillText()` + 동적 폰트 크기 (자릿수 기반)
  - 왕관 아이콘: 최고값 셀 위에 왕관 그리기
  - 하이라이트: 유리 효과 (반투명 그라디언트)
  - **OffscreenCanvas 캐시**: 값별 타일 이미지 사전 생성

### 3-3. ProceduralSprites.js
- **원본**: Assets/Scripts/UI/HUDManager.cs 일부
- **구현**:
  - `createSpeakerIcon(size)` - 스피커 아이콘 (사운드 토글)
  - `createMenuIcon(size)` - 햄버거 메뉴 아이콘
  - `createStarIcon(size)` - 별 아이콘
  - `createHeartIcon(size)` - 하트 아이콘
  - `createCrownSprite(size)` - 왕관 스프라이트
  - 모두 Canvas Path2D로 프로시저럴 생성, OffscreenCanvas 캐시

---

## Phase 4: UI 시스템 (HTML/CSS + DOM)

### 4-1. ScreenManager.js
- **원본**: Assets/Scripts/UI/ScreenManager.cs
- **구현**:
  - 7개 화면: gameplay, gameOver, pause, leaderboard, shop, howToPlay, mainMenu
  - `showScreen(name)` - CSS opacity transition (0.3s)
  - `hideScreen(name)` - 페이드아웃
  - `getCurrentScreen()` - 현재 활성 화면
  - 화면 = DOM div 요소 (display:none ↔ flex)

### 4-2. HUDManager.js
- **원본**: Assets/Scripts/UI/HUDManager.cs
- **구현**:
  - DOM 기반 점수 표시 (#score, #hi-score)
  - 동적 폰트 크기: 자릿수 기반 `calculateScoreFontSize()`
  - 좌측 버튼: 사운드 토글, 다이아몬드
  - 우측 버튼: 메뉴(≡), 도움말(?)
  - 로고 텍스트: "HEXA MERGE" (핑크, 볼드)

### 4-3. GameOverScreen.js
- **원본**: Assets/Scripts/UI/GameOverScreen.cs
- **구현**:
  - 최종 점수 / 최고 점수 표시
  - "NEW RECORD" 라벨 (조건부)
  - "Continue" 버튼 (광고 시청 → 3타일 제거)
  - "Play Again" 버튼 (새 게임)
  - CSS 페이드인 애니메이션

### 4-4. PauseScreen.js
- **원본**: Assets/Scripts/UI/PauseScreen.cs
- **구현**:
  - "Resume" 버튼
  - "Restart" 버튼
  - 테마 토글 (다크/라이트)
  - 리더보드 버튼
  - 배경 흐림 효과 (backdrop-filter: blur)

### 4-5. HowToPlayScreen.js
- **원본**: Assets/Scripts/UI/HowToPlayScreen.cs
- **구현**:
  - 게임 설명 텍스트
  - "Got It!" 버튼

---

## Phase 5: 애니메이션 시스템 (requestAnimationFrame)

### 5-1. TileAnimator.js
- **원본**: Assets/Scripts/Animation/TileAnimator.cs
- **구현**:
  - `class TileAnimator` - 애니메이션 큐 관리
  - `playSpawnAnimation(cell)` - 스케일 0→1 (0.35s, EaseOutElastic)
  - `playMergeAnimation(cells, target)` - 타겟으로 이동 (0.25s, EaseOutQuad) + ScalePunch
  - `playScorePopup(x, y, score)` - 상승 + 페이드 (0.80s)
  - `playCrownTransition(oldCell, newCell)` - 페이드아웃→바운스인 (0.35s)
  - `playGameOverAnimation()` - 보드 진동 (0.50s, sin/cos 조합)
  - **이징 함수**: easeOutQuad, easeOutElastic, easeInQuad, easeInOutCubic
  - **Promise 기반**: `await animator.playMergeAnimation(...)` 순차 실행

### 5-2. MergeEffect.js
- **원본**: Assets/Scripts/Animation/MergeEffect.cs (641줄)
- **구현**:
  - `playSplash(x, y, color)` - 스케일 0→2.5, 알파 0.8→0 (0.40s)
  - `playSplat(srcX, srcY, tgtX, tgtY, color)` - 3단계:
    - 출현(0.1s) → 타겟으로 흐름(0.22s, EaseIn) → 흡수(0.12s)
  - `playParticleBurst(x, y, color)` - 6입자 방사형, ±15° 분산 (0.50s)
  - `playRefillParticles(x, y)` - 리필 시 작은 파티클
  - **오브젝트 풀**: 파티클 재사용 (최대 ~200개)
  - Canvas 2D 직접 그리기: `ctx.arc()`, `ctx.beginPath()`, 그라디언트

---

## Phase 6: 오디오 시스템 (Web Audio API)

### 6-1. ProceduralSFX.js
- **원본**: Assets/Scripts/Audio/ProceduralSFX.cs (403줄) + AudioManager.cs + SFXInitializer.cs
- **구현**:
  - `class ProceduralSFX` - AudioContext 관리
  - `init()` - AudioContext 생성 (사용자 제스처 시)
  - `crystalNote(freq, duration, t, phase)` - 크리스탈 유리 음색
    - 비정수 배음: [1, 2.76, 5.4, 8.93]
    - 지수 감쇠: `Math.exp(-decay * t)`
  - `createBuffer(name, duration, waveFunc)` - AudioBuffer 사전 생성
  - `play(name, volume)` - BufferSourceNode 1회 재생
  - 13종 SFX:
    - `createTapSound()` - E5(659Hz), 0.07s, vol 0.50
    - `createMergeBasicSound()` - C5(523Hz), 0.20s, vol 0.80
    - `createMergeMidSound()` - E5(659Hz), 0.20s, vol 0.80
    - `createMergeHighSound()` - G5(784Hz), 0.25s, vol 0.85
    - `createMergeUltraSound()` - C6(1047Hz), 0.25s, vol 0.90
    - `createChainComboSound()` - C5→E5→G5 아르페지오, 0.25s
    - `createMilestoneSound()` - C5→E5→G5→C6, 0.35s
    - `createCrownChangeSound()` - Cmaj7 화음, 0.20s
    - `createGameOverSound()` - E4→C4→A3 글리산도, 1.20s
    - `createGameStartSound()` - C5→E5→G5, 0.30s
    - `createButtonClickSound()` - C6(1047Hz), 0.06s
    - `createTileDropSound()` - G4(392Hz), 0.10s
    - `createNumberUpSound()` - C5→C6 글리산도, 0.15s
  - `setMuted(bool)` / `setVolume(0~1)` - 음량 제어
  - **iOS 대응**: 첫 pointerdown에서 `audioContext.resume()`

---

## Phase 7: 진입점 + 설정

### 7-1. index.html
- **원본**: Assets/WebGLTemplates/HexaMerge/index.html
- **구현**:
  - `<canvas id="game-canvas">` - 게임 보드
  - `<div id="ui-root">` - DOM 기반 UI 오버레이
  - 7개 화면 div (gameplay, gameOver, pause 등)
  - HUD div (점수, 버튼)
  - 로딩 화면 (CSS 애니메이션)
  - `<script type="module" src="src/main.js">`
  - CSS: 검정 배경, 반응형, Nunito/Roboto 폰트

### 7-2. main.js
- **구현**:
  - 모듈 import
  - Canvas/DPR 초기화
  - GameManager, Renderer, InputManager, ProceduralSFX 생성
  - 저장 데이터 로드 (SaveSystem)
  - 이벤트 연결 (merge → SFX + 이펙트 + 점수갱신)
  - 게임 루프: `requestAnimationFrame` (고정 타임스텝 16.67ms)
  - resize 핸들러

### 7-3. tileColors.js
- **원본**: Assets/Scripts/Core/TileColorConfig.cs
- **구현**: 16색 상수 매핑
  ```
  2→#EBF5FF, 4→#B3D9FF, 8→#FFD6E0, 16→#FFB3C6,
  32→#C6F5D3, 64→#8BEAA0, 128→#FFF0B3, 256→#FFE066,
  512→#E0CCFF, 1024→#C299FF, 2048→#FFD4B3, 4096→#FFB380,
  8192→#B3FFF0, 16384→#80FFE0, 32768→#FFB3E6, 65536→#FF80CC
  ```

---

## 구현 순서 및 의존성

```
Phase 1: Core (HexCoord → HexCell → HexGrid → TileHelper → MergeSystem)
    ↓
Phase 2: Game State (GameManager → ScoreManager → SaveSystem → InputManager)
    ↓
Phase 3: Rendering (Renderer → HexCellView → ProceduralSprites)
    ↓  ↕ (Phase 3~5 병렬 가능)
Phase 4: UI (ScreenManager → HUDManager → 각 Screen)
    ↓
Phase 5: Animation (TileAnimator → MergeEffect)
    ↓
Phase 6: Audio (ProceduralSFX)
    ↓
Phase 7: Integration (index.html + main.js + tileColors.js)
```

---

## Unity C# → JavaScript 전환 주의사항

| 항목 | C# | JavaScript | 주의 |
|------|-----|-----------|------|
| 값 타입 | struct HexCoord | class (참조) | equals() 메서드 필수 |
| Dictionary | `Dictionary<HexCoord, HexCell>` | `Map<string, HexCell>` | 키를 `"q,r"` 문자열로 |
| HashSet | `HashSet<HexCoord>` | `Set<string>` | toKey() 사용 |
| Queue | `Queue<HexCoord>` | `Array` (push/shift) | shift는 O(n) 주의 |
| readonly | `readonly struct` | `Object.freeze()` 선택적 | 성능 영향 미미 |
| event | `event Action<T>` | EventTarget + CustomEvent | 또는 콜백 배열 |
| Coroutine | `yield return` | async/await + rAF | Promise 기반 |
| Mathf | `Mathf.Sqrt` 등 | `Math.sqrt` 등 | 거의 1:1 매핑 |
| PlayerPrefs | `PlayerPrefs.SetInt` | `localStorage.setItem` | JSON 직렬화 |
| Color | `new Color(r,g,b,a)` | `"rgba(r,g,b,a)"` 또는 hex | CSS 색상 문자열 |
| Vector2 | `new Vector2(x,y)` | `{x, y}` 객체 | 불변 패턴 권장 |

---

## 테스트 전략

### 기존 Playwright 테스트 재활용
- tests/ 폴더의 10개 spec, 263 TC 존재
- Unity WebGL Bridge 의존 부분을 웹 직접 API로 교체
- `helpers/unity-bridge.ts` → `helpers/web-bridge.ts` 리팩토링

### 코어 로직 단위 테스트 (신규)
- HexCoord, HexGrid, MergeSystem, TileHelper는 DOM 비의존
- Playwright에서 `page.evaluate()` 내 모듈 import 후 직접 테스트 가능

### E2E 테스트 시나리오
1. 게임 시작 → 보드 19셀 렌더링 확인
2. 타일 탭 → 머지 발생 → 점수 변경 확인
3. 게임오버 → 화면 전환 → 재시작 확인
4. 저장/로드 → localStorage 데이터 검증
5. 사운드 토글 → 오디오 상태 확인

---

## 예상 파일 수 및 코드량

| 영역 | 파일 수 | 예상 줄 수 |
|------|---------|-----------|
| Core | 5 | ~500줄 |
| Game | 4 | ~600줄 |
| Render | 3 | ~800줄 |
| UI | 5 | ~500줄 |
| Animation | 2 | ~600줄 |
| Audio | 1 | ~400줄 |
| Config + Entry | 3 | ~300줄 |
| **총합** | **~23** | **~3,700줄** |
