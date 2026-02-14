# 헥사 그리드 시스템 - Playwright E2E 테스트 계획서

| 항목 | 내용 |
|------|------|
| **대상 시스템** | 헥사 그리드 시스템 (Hex Grid System) |
| **기반 설계문서** | `docs/design/01_core-system-design.md` - 섹션 1 |
| **기반 개발계획** | `docs/development/01_hex-grid/development-plan.md` |
| **테스트 프레임워크** | Playwright (TypeScript) |
| **문서 버전** | v1.0 |
| **최종 수정일** | 2026-02-13 |

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [테스트 환경 설정](#2-테스트-환경-설정)
3. [테스트 카테고리별 테스트 케이스](#3-테스트-카테고리별-테스트-케이스)
   - 3.1 [그리드 초기화 테스트](#31-그리드-초기화-테스트)
   - 3.2 [그리드 렌더링 테스트](#32-그리드-렌더링-테스트)
   - 3.3 [셀 좌표 정확성 테스트](#33-셀-좌표-정확성-테스트)
   - 3.4 [셀 클릭/탭 인터랙션 테스트](#34-셀-클릭탭-인터랙션-테스트)
   - 3.5 [반응형 그리드 크기 조절 테스트](#35-반응형-그리드-크기-조절-테스트)
   - 3.6 [시각적 회귀 테스트](#36-시각적-회귀-테스트)
4. [Playwright 코드 스니펫](#4-playwright-코드-스니펫)
5. [테스트 데이터](#5-테스트-데이터)
6. [자동화 전략](#6-자동화-전략)

---

## 1. 테스트 개요

### 1.1 테스트 범위

본 테스트 계획은 Hexa Merge Basic 게임의 **헥사 그리드 시스템**에 대한 E2E(End-to-End) 테스트를 다룬다. Unity WebGL 빌드로 출력된 게임을 웹 브라우저에서 Playwright를 통해 자동화 테스트한다.

**테스트 범위 (In-Scope):**

- 그리드 초기화 및 생성 (radius=4 기준 61셀)
- 그리드 렌더링 정상 표시 여부
- 헥사곤 셀 좌표 체계 정확성 (큐브 좌표, 오프셋 좌표, 월드 좌표)
- 셀 클릭/탭 인터랙션 (스크린 좌표 -> 셀 판별)
- 다양한 뷰포트 크기에서의 반응형 그리드 표시
- 시각적 회귀 테스트 (스크린샷 비교 기반)

**테스트 범위 외 (Out-of-Scope):**

- 블록 시스템 (별도 테스트 계획)
- 머지(합치기) 로직 (별도 테스트 계획)
- 스코어링 시스템 (별도 테스트 계획)
- 사운드/이펙트

### 1.2 테스트 목적

| 목적 | 설명 |
|------|------|
| 기능 검증 | 그리드가 설계문서 사양(61셀, radius=4)대로 정확히 생성되는지 검증 |
| 렌더링 검증 | WebGL 빌드에서 모든 셀이 화면에 올바르게 표시되는지 검증 |
| 인터랙션 검증 | 사용자의 클릭/탭이 올바른 셀에 정확히 매핑되는지 검증 |
| 호환성 검증 | 주요 브라우저(Chromium, Firefox, WebKit)에서 동일하게 동작하는지 검증 |
| 회귀 방지 | 코드 변경 시 시각적/기능적 회귀가 발생하지 않는지 검증 |

### 1.3 전제조건

| 항목 | 조건 |
|------|------|
| Unity WebGL 빌드 | 게임이 WebGL로 빌드되어 로컬 또는 스테이징 서버에서 접근 가능해야 한다 |
| 디버그 인터페이스 | Unity WebGL 빌드가 JavaScript 인터페이스(`unityInstance.SendMessage()`)를 통해 게임 상태를 조회/제어할 수 있어야 한다 |
| WebGL 지원 브라우저 | 테스트 대상 브라우저가 WebGL 2.0을 지원해야 한다 |
| 테스트 서버 | WebGL 빌드를 서빙할 로컬 HTTP 서버가 실행 중이어야 한다 |
| 게임 디버그 모듈 | 그리드 상태를 외부에서 조회할 수 있는 `GameDebugBridge` JavaScript 인터페이스가 구현되어 있어야 한다 |

### 1.4 Unity-Playwright 브릿지 인터페이스

WebGL 빌드된 Unity 게임과 Playwright 테스트 간 통신을 위해 다음 JavaScript 브릿지 함수가 필요하다.

```
// Unity -> JavaScript (게임 상태 조회)
window.gameDebug.getGridState()       // 그리드 전체 상태 JSON 반환
window.gameDebug.getCellCount()       // 총 셀 수 반환
window.gameDebug.getCellState(q, r)   // 특정 좌표 셀 상태 반환
window.gameDebug.getGridRadius()      // 그리드 반지름 반환
window.gameDebug.getCellAtScreen(x, y) // 스크린 좌표의 셀 좌표 반환

// JavaScript -> Unity (게임 제어)
window.gameDebug.resetGrid()          // 그리드 초기화
window.gameDebug.setGridRadius(r)     // 그리드 반지름 변경
```

---

## 2. 테스트 환경 설정

### 2.1 Playwright 프로젝트 구성

```
tests/
  e2e/
    hex-grid/
      grid-init.spec.ts          # 그리드 초기화 테스트
      grid-rendering.spec.ts     # 그리드 렌더링 테스트
      grid-coordinates.spec.ts   # 셀 좌표 정확성 테스트
      grid-interaction.spec.ts   # 셀 클릭/탭 인터랙션 테스트
      grid-responsive.spec.ts    # 반응형 그리드 크기 조절 테스트
      grid-visual.spec.ts        # 시각적 회귀 테스트
    fixtures/
      unity-helpers.ts           # Unity WebGL 헬퍼 함수
      grid-test-data.ts          # 테스트 데이터 정의
    screenshots/
      baseline/                  # 기준 스크린샷 (최초 실행 시 생성)
      actual/                    # 실제 스크린샷 (비교 대상)
  playwright.config.ts           # Playwright 설정 파일
```

### 2.2 Playwright 설정 파일

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,              // Unity WebGL 로딩 시간 고려하여 60초
  expect: {
    timeout: 15_000,            // 어서션 타임아웃 15초
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.01,  // 스크린샷 비교 허용 오차 1%
    },
  },
  retries: 1,                   // 실패 시 1회 재시도
  fullyParallel: false,         // WebGL 리소스 경합 방지를 위해 순차 실행

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // WebGL 렌더링을 위한 GPU 설정
        launchOptions: {
          args: [
            '--enable-webgl',
            '--enable-gpu',
            '--use-gl=angle',
            '--no-sandbox',
          ],
        },
        viewport: { width: 1280, height: 720 },
      },
    },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        viewport: { width: 1280, height: 720 },
        launchOptions: {
          firefoxUserPrefs: {
            'webgl.force-enabled': true,
          },
        },
      },
    },
    {
      name: 'webkit',
      use: {
        ...devices['Desktop Safari'],
        viewport: { width: 1280, height: 720 },
      },
    },
    // 모바일 뷰포트 테스트
    {
      name: 'mobile-chrome',
      use: {
        ...devices['Pixel 7'],
      },
    },
    {
      name: 'mobile-safari',
      use: {
        ...devices['iPhone 14'],
      },
    },
  ],

  // 테스트 전 로컬 서버 자동 시작
  webServer: {
    command: 'npx serve ./Build/WebGL -l 8080 --cors',
    port: 8080,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2.3 Unity WebGL 로딩 대기 처리

Unity WebGL 빌드는 초기 로딩에 상당한 시간이 소요된다. 다음과 같은 대기 전략을 사용한다.

```typescript
// tests/e2e/fixtures/unity-helpers.ts
import { Page, expect } from '@playwright/test';

/**
 * Unity WebGL 게임이 완전히 로딩될 때까지 대기한다.
 * Unity 인스턴스가 생성되고 게임 씬이 준비될 때까지 기다린다.
 */
export async function waitForUnityLoad(page: Page, timeoutMs = 45_000): Promise<void> {
  // 1단계: Unity 로더 완료 대기
  await page.waitForFunction(
    () => typeof (window as any).unityInstance !== 'undefined',
    { timeout: timeoutMs }
  );

  // 2단계: 게임 디버그 브릿지 준비 대기
  await page.waitForFunction(
    () => typeof (window as any).gameDebug !== 'undefined'
      && typeof (window as any).gameDebug.getGridState === 'function',
    { timeout: 15_000 }
  );

  // 3단계: 그리드 초기화 완료 대기
  await page.waitForFunction(
    () => {
      const debug = (window as any).gameDebug;
      if (!debug) return false;
      const cellCount = debug.getCellCount();
      return cellCount > 0;
    },
    { timeout: 15_000 }
  );

  // 4단계: 렌더링 안정화를 위한 추가 대기
  await page.waitForTimeout(1_000);
}

/**
 * Unity 게임에서 그리드 상태를 JSON으로 가져온다.
 */
export async function getGridState(page: Page): Promise<GridState> {
  return await page.evaluate(() => {
    return (window as any).gameDebug.getGridState();
  });
}

/**
 * Unity 게임의 특정 셀 상태를 가져온다.
 */
export async function getCellState(page: Page, q: number, r: number): Promise<CellInfo> {
  return await page.evaluate(([q, r]) => {
    return (window as any).gameDebug.getCellState(q, r);
  }, [q, r]);
}

/**
 * 스크린 좌표에 해당하는 셀 좌표를 반환한다.
 */
export async function getCellAtScreen(page: Page, x: number, y: number): Promise<CellCoord | null> {
  return await page.evaluate(([x, y]) => {
    return (window as any).gameDebug.getCellAtScreen(x, y);
  }, [x, y]);
}

/**
 * Unity Canvas 요소의 바운딩 박스를 반환한다.
 */
export async function getCanvasBounds(page: Page) {
  return await page.evaluate(() => {
    const canvas = document.querySelector('#unity-canvas') as HTMLCanvasElement;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    return {
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
      centerX: rect.x + rect.width / 2,
      centerY: rect.y + rect.height / 2,
    };
  });
}

// 타입 정의
export interface GridState {
  radius: number;
  cellCount: number;
  cells: CellInfo[];
}

export interface CellInfo {
  q: number;
  r: number;
  s: number;
  state: 'Empty' | 'Occupied' | 'Locked' | 'Disabled';
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
}

export interface CellCoord {
  q: number;
  r: number;
  s: number;
}
```

### 2.4 브라우저별 WebGL 호환성 참고사항

| 브라우저 | WebGL 지원 | 참고 |
|----------|-----------|------|
| Chromium | WebGL 2.0 완전 지원 | `--use-gl=angle` 플래그로 하드웨어 가속 보장 |
| Firefox | WebGL 2.0 지원 | `webgl.force-enabled` 프리퍼런스 필요 가능 |
| WebKit | WebGL 2.0 부분 지원 | macOS에서만 테스트 가능, CI 환경 제한 주의 |

---

## 3. 테스트 카테고리별 테스트 케이스

### 3.1 그리드 초기화 테스트

그리드가 설계 사양에 따라 올바르게 생성되는지 검증한다.

---

#### TC-GRID-001: 기본 그리드 생성 - 셀 수 확인 (radius=4)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-001 |
| **테스트 목적** | 기본 반지름(4)으로 그리드를 생성했을 때 총 61개 셀이 정확히 생성되는지 확인 |
| **우선순위** | P0 |
| **사전 조건** | Unity WebGL 빌드가 로딩 완료된 상태 |

**테스트 단계:**

1. 게임 페이지로 이동하여 Unity WebGL 로딩을 완료한다.
2. 디버그 브릿지를 통해 그리드 반지름 값을 조회한다.
3. 디버그 브릿지를 통해 총 셀 수를 조회한다.
4. 셀 수 공식 `3 * radius * (radius + 1) + 1`과 비교한다.

**기대 결과:**

- [ ] 그리드 반지름이 4이다.
- [ ] 총 셀 수가 61개이다 (`3 * 4 * 5 + 1 = 61`).

---

#### TC-GRID-002: 그리드 초기 상태 - 모든 셀이 Empty

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-002 |
| **테스트 목적** | 그리드 생성 직후 모든 셀의 초기 상태가 `Empty`인지 확인 |
| **우선순위** | P0 |
| **사전 조건** | 그리드가 방금 생성된 초기 상태 (블록 배치 전) |

**테스트 단계:**

1. 게임을 초기화한다 (`gameDebug.resetGrid()` 호출).
2. 전체 그리드 상태를 조회한다.
3. 모든 셀의 `state` 값을 확인한다.

**기대 결과:**

- [ ] 61개 셀 전부 `state === 'Empty'`이다.
- [ ] `Occupied`, `Locked`, `Disabled` 상태의 셀이 0개이다.

---

#### TC-GRID-003: 원점 셀 존재 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-003 |
| **테스트 목적** | 큐브 좌표 원점 `(0, 0, 0)`에 셀이 존재하는지 확인 |
| **우선순위** | P0 |
| **사전 조건** | Unity WebGL 빌드가 로딩 완료된 상태 |

**테스트 단계:**

1. 디버그 브릿지를 통해 좌표 `(0, 0)`의 셀 상태를 조회한다.
2. 반환 값이 null이 아닌지 확인한다.
3. 셀의 `q`, `r`, `s` 값이 모두 0인지 확인한다.

**기대 결과:**

- [ ] `getCellState(0, 0)` 반환 값이 유효한 셀 정보이다.
- [ ] `q === 0`, `r === 0`, `s === 0`이다.

---

#### TC-GRID-004: 경계 좌표 셀 존재 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-004 |
| **테스트 목적** | 그리드 경계(반지름 거리 = 4)에 위치한 셀들이 모두 존재하는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | Unity WebGL 빌드가 로딩 완료된 상태 |

**테스트 단계:**

1. 반지름 4에 위치한 대표 경계 좌표 6개를 조회한다:
   - `(4, 0, -4)`, `(0, 4, -4)`, `(-4, 4, 0)`
   - `(-4, 0, 4)`, `(0, -4, 4)`, `(4, -4, 0)`
2. 각 좌표의 셀이 유효한지 확인한다.

**기대 결과:**

- [ ] 6개 경계 좌표 모두에서 유효한 셀 정보가 반환된다.
- [ ] 각 좌표의 원점과의 큐브 거리가 4이다.

---

#### TC-GRID-005: 범위 밖 좌표 접근 시 null 반환

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-005 |
| **테스트 목적** | 그리드 범위를 벗어난 좌표를 조회했을 때 null(또는 무효 응답)이 반환되는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | Unity WebGL 빌드가 로딩 완료된 상태 |

**테스트 단계:**

1. 범위 밖 좌표 `(5, 0)` (반지름 4 초과)를 조회한다.
2. 범위 밖 좌표 `(0, 5)` 를 조회한다.
3. 범위 밖 좌표 `(-5, 0)` 를 조회한다.

**기대 결과:**

- [ ] 세 좌표 모두 null 또는 무효 응답이 반환된다.
- [ ] 에러/예외가 발생하지 않는다.

---

#### TC-GRID-006: 다양한 반지름으로 그리드 생성

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-006 |
| **테스트 목적** | 다양한 반지름 값에서 셀 수 공식 `3r(r+1)+1`이 정확히 적용되는지 확인 |
| **우선순위** | P2 |
| **사전 조건** | 디버그 브릿지의 `setGridRadius()` 함수가 동작하는 상태 |

**테스트 단계:**

1. 반지름을 2로 설정하고 셀 수를 확인한다.
2. 반지름을 3으로 설정하고 셀 수를 확인한다.
3. 반지름을 5로 설정하고 셀 수를 확인한다.

**기대 결과:**

- [ ] radius=2: 셀 수 19개
- [ ] radius=3: 셀 수 37개
- [ ] radius=5: 셀 수 91개

---

### 3.2 그리드 렌더링 테스트

WebGL 빌드에서 그리드가 시각적으로 올바르게 표시되는지 검증한다.

---

#### TC-GRID-007: 43셀 이상 화면에 표시 확인 (Canvas 렌더링)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-007 |
| **테스트 목적** | Unity WebGL Canvas에서 최소 43개 이상의 셀이 화면 내에 렌더링되는지 확인 (뷰포트 크기에 따라 외곽 셀이 잘릴 수 있음을 허용) |
| **우선순위** | P0 |
| **사전 조건** | 뷰포트 크기 1280x720, Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 뷰포트를 1280x720으로 설정한다.
2. 게임을 로딩한다.
3. 디버그 브릿지를 통해 각 셀의 스크린 좌표를 조회한다.
4. 스크린 좌표가 Canvas 영역 내에 있는 셀의 수를 카운트한다.

**기대 결과:**

- [ ] 화면 내에 표시되는 셀이 43개 이상이다 (1280x720 기준 전체 61셀이 보여야 한다).
- [ ] Canvas 요소가 DOM에 존재하며 가시 상태이다.

---

#### TC-GRID-008: 모든 61셀 렌더링 완료 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-008 |
| **테스트 목적** | 기본 뷰포트(1280x720)에서 61개 셀 전부가 화면 내에 렌더링되는지 확인 |
| **우선순위** | P0 |
| **사전 조건** | 뷰포트 1280x720, 카메라 자동 줌 기능(FitCamera)이 동작하는 상태 |

**테스트 단계:**

1. 게임을 로딩하고 그리드 초기화를 완료한다.
2. 디버그 브릿지를 통해 전체 셀의 스크린 좌표 목록을 가져온다.
3. Canvas 바운딩 박스를 구한다.
4. 모든 셀의 스크린 좌표가 Canvas 바운딩 박스 내에 있는지 확인한다.

**기대 결과:**

- [ ] 61개 셀 모두의 스크린 좌표가 Canvas 바운딩 박스 안에 포함된다.
- [ ] 셀이 겹쳐지거나 Canvas 밖으로 벗어나지 않는다.

---

#### TC-GRID-009: 그리드 육각형 배치 형태 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-009 |
| **테스트 목적** | 그리드가 직사각형이 아닌 정육각형 형태로 배치되는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | Unity WebGL 로딩 완료, 전체 셀 좌표 조회 가능 |

**테스트 단계:**

1. 전체 셀의 스크린 좌표를 조회한다.
2. 셀 좌표의 분포 범위(바운딩 박스)를 계산한다.
3. 분포가 정사각형에 가까운 형태인지 확인한다 (가로세로 비율이 극단적이지 않은지).
4. 중심 셀이 분포의 중앙 근처에 위치하는지 확인한다.

**기대 결과:**

- [ ] 셀 분포의 가로/세로 비율이 0.8~1.2 범위 내이다 (정육각형 형태).
- [ ] 원점 셀의 스크린 좌표가 전체 셀 분포의 중심부에 위치한다.

---

#### TC-GRID-010: 셀 간 간격 균일성 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-010 |
| **테스트 목적** | 인접 셀 간의 스크린 좌표 거리가 균일한지 확인 (hexSize + hexSpacing 적용 검증) |
| **우선순위** | P1 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 원점 셀 `(0, 0, 0)` 과 인접 6개 셀의 스크린 좌표를 조회한다.
2. 원점과 각 인접 셀 간의 스크린 거리를 계산한다.
3. 6개 거리 값의 편차를 계산한다.

**기대 결과:**

- [ ] 6개 인접 셀까지의 거리가 모두 동일하다 (허용 오차: 2px 이내).
- [ ] 거리가 0이 아니다 (셀 간에 실제 간격이 존재한다).

---

#### TC-GRID-011: 셀 상태별 시각적 구분 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-011 |
| **테스트 목적** | Empty, Occupied, Locked 상태의 셀이 시각적으로 구분되는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | 디버그 브릿지로 셀 상태를 강제 변경할 수 있는 상태 |

**테스트 단계:**

1. 그리드를 초기화한다 (모든 셀 Empty).
2. 원점 셀의 스크린샷을 촬영한다 (Empty 상태 기준).
3. 원점 셀에 블록을 배치하여 Occupied 상태로 만든다.
4. Occupied 상태의 스크린샷을 촬영한다.
5. 두 스크린샷을 비교한다.

**기대 결과:**

- [ ] Empty 상태와 Occupied 상태의 스크린샷이 시각적으로 다르다.
- [ ] 상태 변경이 화면에 즉시 반영된다.

---

### 3.3 셀 좌표 정확성 테스트

큐브 좌표, 오프셋 좌표, 월드 좌표 간 변환의 정확성을 검증한다.

---

#### TC-GRID-012: 큐브 좌표 제약 조건 확인 (q + r + s = 0)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-012 |
| **테스트 목적** | 모든 셀의 큐브 좌표가 `q + r + s = 0` 제약 조건을 만족하는지 확인 |
| **우선순위** | P0 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 전체 그리드 상태를 조회한다.
2. 각 셀의 `q`, `r`, `s` 값을 가져온다.
3. 모든 셀에 대해 `q + r + s === 0`을 확인한다.

**기대 결과:**

- [ ] 61개 셀 전부 `q + r + s === 0`을 만족한다.
- [ ] 제약 위반 셀이 0개이다.

---

#### TC-GRID-013: 셀 좌표 유일성 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-013 |
| **테스트 목적** | 모든 셀의 큐브 좌표가 중복 없이 유일한지 확인 |
| **우선순위** | P0 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 전체 셀의 좌표 목록을 조회한다.
2. 좌표를 문자열로 변환하여 Set에 저장한다.
3. Set 크기와 셀 수를 비교한다.

**기대 결과:**

- [ ] Set 크기가 정확히 61개이다 (중복 좌표 없음).
- [ ] 총 셀 수와 Set 크기가 일치한다.

---

#### TC-GRID-014: 원점 셀의 월드 좌표 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-014 |
| **테스트 목적** | 원점 `(0, 0, 0)`의 월드 좌표가 `(0, 0)`인지 확인 |
| **우선순위** | P1 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 원점 셀의 상태를 조회한다.
2. 반환된 `worldX`, `worldY` 값을 확인한다.

**기대 결과:**

- [ ] `worldX === 0` (또는 그리드 오프셋만큼 이동된 값).
- [ ] `worldY === 0` (또는 그리드 오프셋만큼 이동된 값).

---

#### TC-GRID-015: 모든 셀의 원점 거리가 반지름 이내 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-015 |
| **테스트 목적** | 모든 셀의 큐브 좌표가 원점으로부터 반지름(4) 이내에 있는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 전체 셀의 좌표 목록을 조회한다.
2. 각 셀에 대해 `max(|q|, |r|, |s|)`를 계산한다 (큐브 거리).
3. 모든 셀의 거리가 4 이하인지 확인한다.

**기대 결과:**

- [ ] 모든 셀의 큐브 거리가 4 이하이다.
- [ ] 거리가 정확히 4인 셀이 존재한다 (경계 셀).

---

#### TC-GRID-016: 좌표 변환 왕복 정합성 (Cube -> Offset -> Cube)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-016 |
| **테스트 목적** | 큐브 좌표에서 오프셋 좌표로 변환 후 다시 큐브 좌표로 역변환했을 때 원래 값과 일치하는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | 디버그 브릿지에서 좌표 변환 함수를 호출할 수 있는 상태 |

**테스트 단계:**

1. 전체 셀의 큐브 좌표 목록을 가져온다.
2. 각 좌표를 오프셋 좌표로 변환한다.
3. 오프셋 좌표를 다시 큐브 좌표로 역변환한다.
4. 원래 큐브 좌표와 비교한다.

**기대 결과:**

- [ ] 61개 셀 전부 왕복 변환 후 원래 좌표와 일치한다.
- [ ] 변환 과정에서 데이터 손실이 없다.

---

### 3.4 셀 클릭/탭 인터랙션 테스트

사용자 입력이 올바른 셀에 매핑되는지 검증한다.

---

#### TC-GRID-017: 원점 셀 클릭 인식

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-017 |
| **테스트 목적** | 원점 셀의 스크린 좌표를 클릭했을 때 해당 셀이 올바르게 인식되는지 확인 |
| **우선순위** | P0 |
| **사전 조건** | Unity WebGL 로딩 완료, 그리드에 블록이 배치된 상태 |

**테스트 단계:**

1. 원점 셀의 스크린 좌표를 조회한다.
2. Canvas 상의 해당 위치를 Playwright `page.click()`으로 클릭한다.
3. 디버그 브릿지를 통해 마지막 탭된 셀 좌표를 확인한다.

**기대 결과:**

- [ ] 탭된 셀이 `(0, 0, 0)` 좌표이다.
- [ ] 클릭 이벤트가 Unity 게임 내부에 정상 전달되었다.

---

#### TC-GRID-018: 경계 셀 클릭 인식

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-018 |
| **테스트 목적** | 그리드 가장자리 셀을 클릭했을 때 올바르게 인식되는지 확인 |
| **우선순위** | P0 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 경계 셀 `(4, 0, -4)` 의 스크린 좌표를 조회한다.
2. 해당 위치를 클릭한다.
3. 인식된 셀 좌표를 확인한다.
4. 나머지 5개 꼭짓점 셀에도 동일 테스트를 반복한다.

**기대 결과:**

- [ ] 6개 꼭짓점 셀 모두 클릭 시 올바른 좌표가 인식된다.
- [ ] 클릭 위치와 인식된 좌표가 정확히 일치한다.

---

#### TC-GRID-019: 셀 밖 영역 클릭 시 무반응

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-019 |
| **테스트 목적** | 그리드 밖 빈 영역을 클릭했을 때 어떤 셀도 선택되지 않는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. Canvas의 모서리 영역 (그리드 밖)의 좌표를 계산한다.
2. 해당 위치를 클릭한다.
3. 디버그 브릿지를 통해 셀 선택 상태를 확인한다.

**기대 결과:**

- [ ] 셀이 선택되지 않는다 (null 반환 또는 무반응).
- [ ] 에러/예외가 발생하지 않는다.
- [ ] 기존 선택 상태가 유지되거나 초기화된다.

---

#### TC-GRID-020: 셀 경계 부분 클릭 시 가장 가까운 셀 인식

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-020 |
| **테스트 목적** | 두 셀의 경계 부분을 클릭했을 때 가장 가까운 셀이 올바르게 인식되는지 확인 (CubeRound 반올림 동작 검증) |
| **우선순위** | P2 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 원점 셀과 인접 셀 `(1, 0, -1)` 의 스크린 좌표를 조회한다.
2. 두 셀의 중간 지점에서 원점 쪽으로 1px 이동한 좌표를 계산한다.
3. 해당 위치를 클릭한다.
4. 인식된 셀이 원점인지 확인한다.

**기대 결과:**

- [ ] 경계 근처에서도 결정론적으로 하나의 셀이 선택된다.
- [ ] 선택된 셀이 클릭 위치와 더 가까운 셀이다.

---

#### TC-GRID-021: 터치 이벤트 인식 (모바일 에뮬레이션)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-021 |
| **테스트 목적** | 모바일 뷰포트에서 터치 이벤트가 올바르게 셀에 매핑되는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | Playwright 모바일 디바이스 에뮬레이션 설정 |

**테스트 단계:**

1. Pixel 7 뷰포트로 설정한다.
2. 게임을 로딩한다.
3. 원점 셀의 스크린 좌표를 조회한다.
4. `page.tap()`으로 해당 위치를 탭한다.
5. 인식된 셀 좌표를 확인한다.

**기대 결과:**

- [ ] 터치 탭이 클릭과 동일하게 동작한다.
- [ ] 원점 셀이 올바르게 인식된다.

---

#### TC-GRID-022: 빠른 연속 클릭 시 안정성

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-022 |
| **테스트 목적** | 여러 셀을 빠르게 연속 클릭했을 때 게임이 안정적으로 동작하는지 확인 |
| **우선순위** | P2 |
| **사전 조건** | Unity WebGL 로딩 완료, 그리드에 블록이 배치된 상태 |

**테스트 단계:**

1. 5개의 서로 다른 셀 좌표를 준비한다.
2. 각 셀을 100ms 간격으로 연속 클릭한다.
3. 게임이 정상 동작하는지 확인한다 (오류/멈춤 없음).
4. 브라우저 콘솔에 에러가 없는지 확인한다.

**기대 결과:**

- [ ] 게임이 멈추거나 충돌하지 않는다.
- [ ] 브라우저 콘솔에 JavaScript 에러가 없다.
- [ ] 마지막 클릭이 정상 처리된다.

---

### 3.5 반응형 그리드 크기 조절 테스트

다양한 뷰포트 크기에서 그리드가 올바르게 표시되는지 검증한다.

---

#### TC-GRID-023: 데스크톱 기본 뷰포트 (1280x720)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-023 |
| **테스트 목적** | 1280x720 뷰포트에서 그리드가 완전히 표시되는지 확인 |
| **우선순위** | P0 |
| **사전 조건** | 없음 |

**테스트 단계:**

1. 뷰포트를 1280x720으로 설정한다.
2. 게임을 로딩한다.
3. 전체 61셀의 스크린 좌표가 Canvas 내에 있는지 확인한다.
4. 스크린샷을 촬영한다.

**기대 결과:**

- [ ] 61개 셀 전부가 화면 내에 표시된다.
- [ ] 셀이 잘리거나 화면 밖으로 벗어나지 않는다.

---

#### TC-GRID-024: 넓은 뷰포트 (1920x1080)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-024 |
| **테스트 목적** | Full HD 해상도에서 그리드가 정상 표시되는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | 없음 |

**테스트 단계:**

1. 뷰포트를 1920x1080으로 설정한다.
2. 게임을 로딩한다.
3. 그리드가 화면 중앙에 배치되는지 확인한다.
4. 셀 간 간격이 유지되는지 확인한다.

**기대 결과:**

- [ ] 그리드가 화면 중앙에 배치된다.
- [ ] 셀이 과도하게 작거나 크지 않다.

---

#### TC-GRID-025: 모바일 세로 뷰포트 (390x844, iPhone 14)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-025 |
| **테스트 목적** | 모바일 세로 화면에서 그리드가 올바르게 맞춰지는지 확인 |
| **우선순위** | P0 |
| **사전 조건** | 없음 |

**테스트 단계:**

1. iPhone 14 에뮬레이션 (390x844)으로 설정한다.
2. 게임을 로딩한다.
3. 전체 셀이 화면 내에 보이는지 확인한다.
4. 셀 크기가 터치 가능한 최소 크기(44px) 이상인지 확인한다.

**기대 결과:**

- [ ] 그리드가 세로 화면에 맞춰 축소된다.
- [ ] 모든 셀이 화면 내에 표시된다.
- [ ] 셀이 터치 가능한 크기이다.

---

#### TC-GRID-026: 모바일 가로 뷰포트 (844x390)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-026 |
| **테스트 목적** | 모바일 가로 화면에서 그리드가 올바르게 표시되는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | 없음 |

**테스트 단계:**

1. 뷰포트를 844x390 (가로 모드)으로 설정한다.
2. 게임을 로딩한다.
3. 그리드가 잘리지 않는지 확인한다.

**기대 결과:**

- [ ] 그리드가 가로 화면에도 올바르게 맞춰진다.
- [ ] 셀이 잘리지 않는다.

---

#### TC-GRID-027: 뷰포트 크기 동적 변경 시 그리드 재조정

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-027 |
| **테스트 목적** | 게임 실행 중 브라우저 크기가 변경될 때 그리드가 올바르게 재조정되는지 확인 |
| **우선순위** | P2 |
| **사전 조건** | Unity WebGL 로딩 완료 |

**테스트 단계:**

1. 1280x720 뷰포트에서 게임을 로딩한다.
2. 뷰포트를 640x480으로 축소한다.
3. 1초 대기 후 그리드 상태를 확인한다.
4. 뷰포트를 1920x1080으로 확대한다.
5. 1초 대기 후 그리드 상태를 확인한다.

**기대 결과:**

- [ ] 두 경우 모두 그리드가 화면에 맞춰 재조정된다.
- [ ] 셀의 상대적 위치 관계가 유지된다.
- [ ] 화면 전환 시 에러가 발생하지 않는다.

---

### 3.6 시각적 회귀 테스트

스크린샷 비교를 통해 시각적 변경이 없는지 검증한다.

---

#### TC-GRID-028: 초기 그리드 스크린샷 비교

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-028 |
| **테스트 목적** | 그리드 초기 상태의 스크린샷이 기준(baseline) 이미지와 일치하는지 확인 |
| **우선순위** | P1 |
| **사전 조건** | 기준 스크린샷이 `screenshots/baseline/` 에 저장되어 있어야 한다 |

**테스트 단계:**

1. 게임을 로딩하고 그리드를 초기화한다.
2. 렌더링 안정화를 위해 2초 대기한다.
3. 전체 페이지 스크린샷을 촬영한다.
4. 기준 스크린샷과 비교한다.

**기대 결과:**

- [ ] 픽셀 차이 비율이 1% 이내이다 (`maxDiffPixelRatio: 0.01`).
- [ ] 그리드 레이아웃, 셀 색상, 간격이 기준과 동일하다.

---

#### TC-GRID-029: 셀 상태 변경 후 스크린샷 비교

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-029 |
| **테스트 목적** | 특정 셀에 블록을 배치한 후의 스크린샷이 기준 이미지와 일치하는지 확인 |
| **우선순위** | P2 |
| **사전 조건** | 기준 스크린샷이 존재해야 한다 |

**테스트 단계:**

1. 그리드를 초기화한다.
2. 원점 셀에 레벨 1 블록(값 2)을 배치한다.
3. 렌더링 안정화를 위해 1초 대기한다.
4. 스크린샷을 촬영하고 기준과 비교한다.

**기대 결과:**

- [ ] 픽셀 차이 비율이 1% 이내이다.
- [ ] 블록이 올바른 위치에 표시된다.

---

#### TC-GRID-030: 크로스 브라우저 시각적 일관성

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-GRID-030 |
| **테스트 목적** | Chromium, Firefox, WebKit에서 그리드의 시각적 표현이 일관되는지 확인 |
| **우선순위** | P2 |
| **사전 조건** | 세 브라우저에서 WebGL 게임이 실행 가능한 상태 |

**테스트 단계:**

1. Chromium에서 게임을 로딩하고 스크린샷을 촬영한다.
2. Firefox에서 동일하게 촬영한다.
3. WebKit에서 동일하게 촬영한다.
4. 세 스크린샷의 그리드 레이아웃(셀 위치, 크기, 간격)을 비교한다.

**기대 결과:**

- [ ] 세 브라우저에서 셀 배치 패턴이 동일하다.
- [ ] WebGL 렌더링 차이로 인한 미세한 색상 차이는 허용한다 (5% 이내).

---

## 4. Playwright 코드 스니펫

### 4.1 그리드 초기화 테스트 코드

```typescript
// tests/e2e/hex-grid/grid-init.spec.ts
import { test, expect } from '@playwright/test';
import { waitForUnityLoad, getGridState, getCellState } from '../fixtures/unity-helpers';

const GAME_URL = 'http://localhost:8080';
const EXPECTED_RADIUS = 4;
const EXPECTED_CELL_COUNT = 3 * EXPECTED_RADIUS * (EXPECTED_RADIUS + 1) + 1; // 61

test.describe('헥사 그리드 초기화', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForUnityLoad(page);
  });

  test('TC-GRID-001: 기본 그리드 생성 - 61셀 확인', async ({ page }) => {
    const cellCount = await page.evaluate(() => {
      return (window as any).gameDebug.getCellCount();
    });

    expect(cellCount).toBe(EXPECTED_CELL_COUNT);
  });

  test('TC-GRID-002: 그리드 초기 상태 - 모든 셀 Empty', async ({ page }) => {
    // 그리드 리셋
    await page.evaluate(() => {
      (window as any).gameDebug.resetGrid();
    });
    await page.waitForTimeout(500);

    const gridState = await getGridState(page);

    expect(gridState.cells.length).toBe(EXPECTED_CELL_COUNT);

    const nonEmptyCells = gridState.cells.filter(c => c.state !== 'Empty');
    expect(nonEmptyCells.length).toBe(0);
  });

  test('TC-GRID-003: 원점 셀 존재 확인', async ({ page }) => {
    const originCell = await getCellState(page, 0, 0);

    expect(originCell).not.toBeNull();
    expect(originCell.q).toBe(0);
    expect(originCell.r).toBe(0);
    expect(originCell.s).toBe(0);
  });

  test('TC-GRID-004: 경계 좌표 셀 존재 확인', async ({ page }) => {
    const borderCoords = [
      { q: 4, r: 0 },
      { q: 0, r: 4 },
      { q: -4, r: 4 },
      { q: -4, r: 0 },
      { q: 0, r: -4 },
      { q: 4, r: -4 },
    ];

    for (const coord of borderCoords) {
      const cell = await getCellState(page, coord.q, coord.r);
      expect(cell, `셀 (${coord.q}, ${coord.r})이 존재해야 한다`).not.toBeNull();
    }
  });

  test('TC-GRID-005: 범위 밖 좌표 접근 시 null 반환', async ({ page }) => {
    const outOfBoundsCoords = [
      { q: 5, r: 0 },
      { q: 0, r: 5 },
      { q: -5, r: 0 },
    ];

    for (const coord of outOfBoundsCoords) {
      const cell = await getCellState(page, coord.q, coord.r);
      expect(cell, `셀 (${coord.q}, ${coord.r})은 null이어야 한다`).toBeNull();
    }
  });
});
```

### 4.2 그리드 렌더링 테스트 코드

```typescript
// tests/e2e/hex-grid/grid-rendering.spec.ts
import { test, expect } from '@playwright/test';
import { waitForUnityLoad, getGridState, getCanvasBounds } from '../fixtures/unity-helpers';

const GAME_URL = 'http://localhost:8080';

test.describe('헥사 그리드 렌더링', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForUnityLoad(page);
  });

  test('TC-GRID-008: 모든 61셀 렌더링 완료 확인', async ({ page }) => {
    const gridState = await getGridState(page);
    const canvasBounds = await getCanvasBounds(page);

    expect(canvasBounds).not.toBeNull();

    let visibleCount = 0;
    for (const cell of gridState.cells) {
      const inBounds =
        cell.screenX >= canvasBounds!.x &&
        cell.screenX <= canvasBounds!.x + canvasBounds!.width &&
        cell.screenY >= canvasBounds!.y &&
        cell.screenY <= canvasBounds!.y + canvasBounds!.height;

      if (inBounds) visibleCount++;
    }

    expect(visibleCount).toBe(61);
  });

  test('TC-GRID-010: 셀 간 간격 균일성 확인', async ({ page }) => {
    const originCell = await page.evaluate(() => {
      return (window as any).gameDebug.getCellState(0, 0);
    });

    // 6개 인접 셀 좌표 (flat-top 기준)
    const neighborCoords = [
      { q: 1, r: 0 },   // 동
      { q: 1, r: -1 },  // 북동
      { q: 0, r: -1 },  // 북서
      { q: -1, r: 0 },  // 서
      { q: -1, r: 1 },  // 남서
      { q: 0, r: 1 },   // 남동
    ];

    const distances: number[] = [];
    for (const coord of neighborCoords) {
      const neighbor = await page.evaluate(([q, r]) => {
        return (window as any).gameDebug.getCellState(q, r);
      }, [coord.q, coord.r]);

      const dx = neighbor.screenX - originCell.screenX;
      const dy = neighbor.screenY - originCell.screenY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      distances.push(distance);
    }

    // 모든 인접 셀까지의 거리가 균일한지 확인 (허용 오차 2px)
    const avgDistance = distances.reduce((a, b) => a + b, 0) / distances.length;
    for (const dist of distances) {
      expect(Math.abs(dist - avgDistance)).toBeLessThan(2);
    }

    // 거리가 0이 아닌지 확인
    expect(avgDistance).toBeGreaterThan(0);
  });
});
```

### 4.3 셀 클릭 인터랙션 테스트 코드

```typescript
// tests/e2e/hex-grid/grid-interaction.spec.ts
import { test, expect } from '@playwright/test';
import { waitForUnityLoad, getCellState, getCellAtScreen } from '../fixtures/unity-helpers';

const GAME_URL = 'http://localhost:8080';

test.describe('셀 클릭/탭 인터랙션', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForUnityLoad(page);
  });

  test('TC-GRID-017: 원점 셀 클릭 인식', async ({ page }) => {
    // 원점 셀의 스크린 좌표 조회
    const originCell = await getCellState(page, 0, 0);

    // Canvas 요소에서 클릭 위치 계산
    const canvas = await page.locator('#unity-canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // 스크린 좌표를 Canvas 내 상대 좌표로 변환하여 클릭
    await canvas.click({
      position: {
        x: originCell.screenX - canvasBox!.x,
        y: originCell.screenY - canvasBox!.y,
      },
    });

    // 클릭 처리 대기
    await page.waitForTimeout(300);

    // 마지막 탭된 셀 확인
    const lastTapped = await page.evaluate(() => {
      return (window as any).gameDebug.getLastTappedCell();
    });

    expect(lastTapped).not.toBeNull();
    expect(lastTapped.q).toBe(0);
    expect(lastTapped.r).toBe(0);
  });

  test('TC-GRID-019: 셀 밖 영역 클릭 시 무반응', async ({ page }) => {
    const canvas = await page.locator('#unity-canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // 이전 탭 상태 초기화
    await page.evaluate(() => {
      (window as any).gameDebug.clearLastTapped();
    });

    // Canvas 왼쪽 상단 모서리 클릭 (그리드 밖 영역)
    await canvas.click({
      position: { x: 5, y: 5 },
    });
    await page.waitForTimeout(300);

    const lastTapped = await page.evaluate(() => {
      return (window as any).gameDebug.getLastTappedCell();
    });

    expect(lastTapped).toBeNull();
  });

  test('TC-GRID-022: 빠른 연속 클릭 시 안정성', async ({ page }) => {
    const canvas = await page.locator('#unity-canvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();

    // 5개 셀의 스크린 좌표 준비
    const testCoords = [
      { q: 0, r: 0 },
      { q: 1, r: 0 },
      { q: -1, r: 0 },
      { q: 0, r: 1 },
      { q: 0, r: -1 },
    ];

    // 100ms 간격으로 연속 클릭
    for (const coord of testCoords) {
      const cell = await getCellState(page, coord.q, coord.r);
      await canvas.click({
        position: {
          x: cell.screenX - canvasBox!.x,
          y: cell.screenY - canvasBox!.y,
        },
      });
      await page.waitForTimeout(100);
    }

    // 브라우저 콘솔 에러 확인
    const consoleErrors: string[] = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });

    await page.waitForTimeout(500);

    // Unity 관련 에러가 없는지 확인
    const unityErrors = consoleErrors.filter(e =>
      !e.includes('favicon') && !e.includes('manifest')
    );
    expect(unityErrors.length).toBe(0);
  });
});
```

### 4.4 반응형 뷰포트 테스트 코드

```typescript
// tests/e2e/hex-grid/grid-responsive.spec.ts
import { test, expect } from '@playwright/test';
import { waitForUnityLoad, getGridState, getCanvasBounds } from '../fixtures/unity-helpers';

const GAME_URL = 'http://localhost:8080';

test.describe('반응형 그리드 크기 조절', () => {

  test('TC-GRID-025: 모바일 세로 뷰포트 (iPhone 14)', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    });
    const page = await context.newPage();

    await page.goto(GAME_URL);
    await waitForUnityLoad(page);

    const gridState = await getGridState(page);
    const canvasBounds = await getCanvasBounds(page);

    expect(canvasBounds).not.toBeNull();

    // 모든 셀이 화면 내에 있는지 확인
    let visibleCount = 0;
    for (const cell of gridState.cells) {
      const inBounds =
        cell.screenX >= canvasBounds!.x &&
        cell.screenX <= canvasBounds!.x + canvasBounds!.width &&
        cell.screenY >= canvasBounds!.y &&
        cell.screenY <= canvasBounds!.y + canvasBounds!.height;

      if (inBounds) visibleCount++;
    }

    expect(visibleCount).toBe(61);

    // 셀 크기가 터치 가능한 최소 크기인지 확인
    const originCell = gridState.cells.find(c => c.q === 0 && c.r === 0);
    const neighborCell = gridState.cells.find(c => c.q === 1 && c.r === 0);

    if (originCell && neighborCell) {
      const dx = neighborCell.screenX - originCell.screenX;
      const dy = neighborCell.screenY - originCell.screenY;
      const cellSpacing = Math.sqrt(dx * dx + dy * dy);

      // 셀 간격이 최소 20px 이상 (터치 가능 크기)
      expect(cellSpacing).toBeGreaterThan(20);
    }

    await context.close();
  });

  test('TC-GRID-027: 뷰포트 크기 동적 변경 시 그리드 재조정', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto(GAME_URL);
    await waitForUnityLoad(page);

    // 1단계: 현재 상태 기록
    const beforeState = await getGridState(page);
    expect(beforeState.cellCount).toBe(61);

    // 2단계: 뷰포트 축소
    await page.setViewportSize({ width: 640, height: 480 });
    await page.waitForTimeout(1500); // 재조정 대기

    const afterShrink = await getGridState(page);
    expect(afterShrink.cellCount).toBe(61); // 셀 수는 변하지 않아야 함

    // 3단계: 뷰포트 확대
    await page.setViewportSize({ width: 1920, height: 1080 });
    await page.waitForTimeout(1500);

    const afterExpand = await getGridState(page);
    expect(afterExpand.cellCount).toBe(61);
  });
});
```

### 4.5 시각적 회귀 테스트 코드

```typescript
// tests/e2e/hex-grid/grid-visual.spec.ts
import { test, expect } from '@playwright/test';
import { waitForUnityLoad } from '../fixtures/unity-helpers';

const GAME_URL = 'http://localhost:8080';

test.describe('시각적 회귀 테스트', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForUnityLoad(page);

    // 그리드 리셋 (일관된 초기 상태)
    await page.evaluate(() => {
      (window as any).gameDebug.resetGrid();
    });
    await page.waitForTimeout(2000); // 렌더링 안정화 대기
  });

  test('TC-GRID-028: 초기 그리드 스크린샷 비교', async ({ page }) => {
    await expect(page).toHaveScreenshot('grid-initial-state.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });

  test('TC-GRID-029: 셀 상태 변경 후 스크린샷 비교', async ({ page }) => {
    // 원점 셀에 블록 배치
    await page.evaluate(() => {
      (window as any).gameDebug.placeBlock(0, 0, 1); // 원점에 레벨 1 블록
    });
    await page.waitForTimeout(1000);

    await expect(page).toHaveScreenshot('grid-with-block-at-origin.png', {
      maxDiffPixelRatio: 0.01,
      animations: 'disabled',
    });
  });

  test('TC-GRID-030: 크로스 브라우저 레이아웃 일관성', async ({ page }) => {
    // 그리드 셀의 위치 분포를 검증 (스크린샷 대신 데이터 기반)
    const gridState = await page.evaluate(() => {
      return (window as any).gameDebug.getGridState();
    });

    // 셀 위치의 통계적 특성 확인
    const screenXs = gridState.cells.map((c: any) => c.screenX);
    const screenYs = gridState.cells.map((c: any) => c.screenY);

    const avgX = screenXs.reduce((a: number, b: number) => a + b, 0) / screenXs.length;
    const avgY = screenYs.reduce((a: number, b: number) => a + b, 0) / screenYs.length;

    // 중심이 Canvas 중앙 근처에 있는지 확인
    const canvasBounds = await page.evaluate(() => {
      const canvas = document.querySelector('#unity-canvas') as HTMLCanvasElement;
      const rect = canvas.getBoundingClientRect();
      return { centerX: rect.x + rect.width / 2, centerY: rect.y + rect.height / 2 };
    });

    // 그리드 중심이 Canvas 중심에서 50px 이내에 있어야 함
    expect(Math.abs(avgX - canvasBounds.centerX)).toBeLessThan(50);
    expect(Math.abs(avgY - canvasBounds.centerY)).toBeLessThan(50);
  });
});
```

### 4.6 좌표 정확성 테스트 코드

```typescript
// tests/e2e/hex-grid/grid-coordinates.spec.ts
import { test, expect } from '@playwright/test';
import { waitForUnityLoad, getGridState } from '../fixtures/unity-helpers';

const GAME_URL = 'http://localhost:8080';

test.describe('셀 좌표 정확성', () => {

  test.beforeEach(async ({ page }) => {
    await page.goto(GAME_URL);
    await waitForUnityLoad(page);
  });

  test('TC-GRID-012: 큐브 좌표 제약 조건 확인 (q + r + s = 0)', async ({ page }) => {
    const gridState = await getGridState(page);

    for (const cell of gridState.cells) {
      expect(
        cell.q + cell.r + cell.s,
        `셀 (${cell.q}, ${cell.r}, ${cell.s})의 큐브 좌표 제약 위반`
      ).toBe(0);
    }
  });

  test('TC-GRID-013: 셀 좌표 유일성 확인', async ({ page }) => {
    const gridState = await getGridState(page);

    const coordSet = new Set<string>();
    for (const cell of gridState.cells) {
      const key = `${cell.q},${cell.r},${cell.s}`;
      expect(coordSet.has(key), `중복 좌표 발견: ${key}`).toBe(false);
      coordSet.add(key);
    }

    expect(coordSet.size).toBe(61);
  });

  test('TC-GRID-015: 모든 셀의 원점 거리가 반지름 이내 확인', async ({ page }) => {
    const gridState = await getGridState(page);

    let maxDistance = 0;
    for (const cell of gridState.cells) {
      const distance = Math.max(
        Math.abs(cell.q),
        Math.abs(cell.r),
        Math.abs(cell.s)
      );

      expect(distance).toBeLessThanOrEqual(4);
      if (distance > maxDistance) maxDistance = distance;
    }

    // 경계 셀이 존재해야 함
    expect(maxDistance).toBe(4);
  });
});
```

---

## 5. 테스트 데이터

### 5.1 그리드 파라미터 기본값

| 파라미터 | 기본값 | 설명 |
|----------|--------|------|
| `gridRadius` | 4 | 그리드 반지름 |
| `hexSize` | 0.6f | 헥사곤 한 변의 길이 (Unity 월드 단위) |
| `hexSpacing` | 0.05f | 셀 간 간격 |
| `totalCellCount` | 61 | 총 셀 수 (`3 * 4 * 5 + 1`) |

### 5.2 반지름별 예상 셀 수

| 반지름 | 총 셀 수 | 경계 셀 수 | 내부 셀 수 |
|--------|----------|-----------|-----------|
| 1 | 7 | 6 | 1 |
| 2 | 19 | 12 | 7 |
| 3 | 37 | 18 | 19 |
| **4 (기본값)** | **61** | **24** | **37** |
| 5 | 91 | 30 | 61 |

### 5.3 대표 셀 좌표 (테스트용)

```typescript
// tests/e2e/fixtures/grid-test-data.ts

/** 원점 좌표 */
export const ORIGIN = { q: 0, r: 0, s: 0 };

/** 6개 꼭짓점 좌표 (radius=4 경계) */
export const VERTEX_COORDS = [
  { q: 4, r: 0, s: -4 },    // 동쪽 꼭짓점
  { q: 4, r: -4, s: 0 },    // 북동쪽 꼭짓점
  { q: 0, r: -4, s: 4 },    // 북서쪽 꼭짓점
  { q: -4, r: 0, s: 4 },    // 서쪽 꼭짓점
  { q: -4, r: 4, s: 0 },    // 남서쪽 꼭짓점
  { q: 0, r: 4, s: -4 },    // 남동쪽 꼭짓점
];

/** 원점의 인접 6셀 좌표 */
export const ORIGIN_NEIGHBORS = [
  { q: 1, r: 0, s: -1 },    // 동 (E)
  { q: 1, r: -1, s: 0 },    // 북동 (NE)
  { q: 0, r: -1, s: 1 },    // 북서 (NW)
  { q: -1, r: 0, s: 1 },    // 서 (W)
  { q: -1, r: 1, s: 0 },    // 남서 (SW)
  { q: 0, r: 1, s: -1 },    // 남동 (SE)
];

/** 범위 밖 좌표 (테스트용) */
export const OUT_OF_BOUNDS_COORDS = [
  { q: 5, r: 0, s: -5 },
  { q: 0, r: 5, s: -5 },
  { q: -5, r: 0, s: 5 },
  { q: 3, r: 3, s: -6 },    // 큐브 거리 > 4
];

/** 경계 변 중간 셀 좌표 (인접 셀이 4개인 셀 예시) */
export const EDGE_MID_COORDS = [
  { q: 2, r: -4, s: 2 },
  { q: -2, r: 4, s: -2 },
  { q: 4, r: -2, s: -2 },
];

/** 뷰포트 크기 테스트 데이터 */
export const VIEWPORT_SIZES = [
  { name: 'desktop-hd', width: 1280, height: 720 },
  { name: 'desktop-fhd', width: 1920, height: 1080 },
  { name: 'mobile-portrait', width: 390, height: 844 },
  { name: 'mobile-landscape', width: 844, height: 390 },
  { name: 'tablet-portrait', width: 768, height: 1024 },
  { name: 'small-desktop', width: 640, height: 480 },
];
```

### 5.4 셀 상태 전이 테스트 데이터

| 초기 상태 | 동작 | 기대 결과 상태 |
|-----------|------|---------------|
| Empty | PlaceBlock | Occupied |
| Occupied | RemoveBlock | Empty |
| Empty | Lock | Locked |
| Occupied | Lock | Locked |
| Locked (블록 있음) | Unlock | Occupied |
| Locked (블록 없음) | Unlock | Empty |
| Disabled | PlaceBlock | 실패 (Assert) |

---

## 6. 자동화 전략

### 6.1 CI/CD 파이프라인 연동

```yaml
# .github/workflows/e2e-tests.yml
name: E2E Tests - Hex Grid

on:
  push:
    branches: [main, develop]
    paths:
      - 'Assets/_Project/Scripts/Core/Grid/**'
      - 'Assets/_Project/Scripts/View/**'
      - 'tests/e2e/hex-grid/**'
  pull_request:
    branches: [main]

jobs:
  e2e-test:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium firefox

      - name: Download WebGL build artifact
        uses: actions/download-artifact@v4
        with:
          name: webgl-build
          path: ./Build/WebGL

      - name: Run Playwright E2E tests
        run: npx playwright test tests/e2e/hex-grid/ --reporter=html
        env:
          CI: true

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
          retention-days: 14

      - name: Upload screenshots
        if: failure()
        uses: actions/upload-artifact@v4
        with:
          name: test-screenshots
          path: tests/e2e/screenshots/actual/
          retention-days: 7
```

### 6.2 테스트 실행 전략

| 단계 | 트리거 | 테스트 범위 | 브라우저 |
|------|--------|------------|---------|
| PR 검증 | Pull Request 생성/갱신 | P0 테스트만 | Chromium |
| 일일 빌드 | 매일 새벽 2시 | P0 + P1 | Chromium + Firefox |
| 릴리즈 전 | 릴리즈 브랜치 생성 | 전체 (P0 + P1 + P2) | Chromium + Firefox + WebKit |
| 회귀 테스트 | WebGL 빌드 후 | 시각적 회귀 테스트만 | Chromium |

### 6.3 테스트 우선순위별 분류 요약

#### P0 (필수 - 매 PR마다 실행)

| TC-ID | 테스트명 |
|-------|---------|
| TC-GRID-001 | 기본 그리드 생성 - 61셀 확인 |
| TC-GRID-002 | 그리드 초기 상태 - 모든 셀 Empty |
| TC-GRID-003 | 원점 셀 존재 확인 |
| TC-GRID-007 | 43셀 이상 화면에 표시 확인 |
| TC-GRID-008 | 모든 61셀 렌더링 완료 확인 |
| TC-GRID-012 | 큐브 좌표 제약 조건 확인 |
| TC-GRID-013 | 셀 좌표 유일성 확인 |
| TC-GRID-017 | 원점 셀 클릭 인식 |
| TC-GRID-018 | 경계 셀 클릭 인식 |
| TC-GRID-023 | 데스크톱 기본 뷰포트 확인 |
| TC-GRID-025 | 모바일 세로 뷰포트 확인 |

#### P1 (중요 - 일일 빌드)

| TC-ID | 테스트명 |
|-------|---------|
| TC-GRID-004 | 경계 좌표 셀 존재 확인 |
| TC-GRID-005 | 범위 밖 좌표 접근 시 null 반환 |
| TC-GRID-009 | 그리드 육각형 배치 형태 확인 |
| TC-GRID-010 | 셀 간 간격 균일성 확인 |
| TC-GRID-011 | 셀 상태별 시각적 구분 확인 |
| TC-GRID-014 | 원점 셀의 월드 좌표 확인 |
| TC-GRID-015 | 모든 셀의 원점 거리가 반지름 이내 확인 |
| TC-GRID-016 | 좌표 변환 왕복 정합성 확인 |
| TC-GRID-019 | 셀 밖 영역 클릭 시 무반응 |
| TC-GRID-021 | 터치 이벤트 인식 (모바일 에뮬레이션) |
| TC-GRID-024 | 넓은 뷰포트 확인 |
| TC-GRID-026 | 모바일 가로 뷰포트 확인 |
| TC-GRID-028 | 초기 그리드 스크린샷 비교 |

#### P2 (보조 - 릴리즈 전)

| TC-ID | 테스트명 |
|-------|---------|
| TC-GRID-006 | 다양한 반지름으로 그리드 생성 |
| TC-GRID-020 | 셀 경계 부분 클릭 시 가장 가까운 셀 인식 |
| TC-GRID-022 | 빠른 연속 클릭 시 안정성 |
| TC-GRID-027 | 뷰포트 크기 동적 변경 시 그리드 재조정 |
| TC-GRID-029 | 셀 상태 변경 후 스크린샷 비교 |
| TC-GRID-030 | 크로스 브라우저 시각적 일관성 |

### 6.4 기준 스크린샷 관리 전략

| 항목 | 방침 |
|------|------|
| **저장 위치** | `tests/e2e/screenshots/baseline/` 디렉토리, Git으로 버전 관리 |
| **갱신 시점** | 의도적인 UI 변경 시에만 갱신 (`npx playwright test --update-snapshots`) |
| **갱신 절차** | 1) 변경 PR에서 기준 스크린샷 갱신 포함 2) 리뷰어가 시각적 변경을 확인 후 승인 |
| **비교 임계값** | `maxDiffPixelRatio: 0.01` (1% 이내 차이 허용) |
| **플랫폼 분리** | 브라우저별로 별도 기준 스크린샷 유지 (`-chromium.png`, `-firefox.png`) |

### 6.5 실패 시 디버그 전략

| 실패 유형 | 디버그 방법 |
|-----------|------------|
| WebGL 로딩 실패 | Playwright 트레이스(trace) 활성화, 브라우저 콘솔 로그 수집 |
| 셀 수 불일치 | 디버그 브릿지를 통해 개별 셀 좌표 덤프, 생성 알고리즘 로그 확인 |
| 클릭 위치 불일치 | 클릭 전후 스크린샷 저장, 스크린/월드/큐브 좌표 변환 값 로그 출력 |
| 스크린샷 불일치 | 기준/실제 스크린샷 및 차이 이미지(diff image) 아티팩트로 업로드 |
| 타임아웃 | 네트워크 상태 확인, WebGL 빌드 크기 최적화, 타임아웃 값 조정 |

---

## 부록: 테스트 케이스 전체 목록

| TC-ID | 카테고리 | 테스트명 | 우선순위 |
|-------|---------|---------|---------|
| TC-GRID-001 | 초기화 | 기본 그리드 생성 - 61셀 확인 | P0 |
| TC-GRID-002 | 초기화 | 그리드 초기 상태 - 모든 셀 Empty | P0 |
| TC-GRID-003 | 초기화 | 원점 셀 존재 확인 | P0 |
| TC-GRID-004 | 초기화 | 경계 좌표 셀 존재 확인 | P1 |
| TC-GRID-005 | 초기화 | 범위 밖 좌표 접근 시 null 반환 | P1 |
| TC-GRID-006 | 초기화 | 다양한 반지름으로 그리드 생성 | P2 |
| TC-GRID-007 | 렌더링 | 43셀 이상 화면에 표시 확인 | P0 |
| TC-GRID-008 | 렌더링 | 모든 61셀 렌더링 완료 확인 | P0 |
| TC-GRID-009 | 렌더링 | 그리드 육각형 배치 형태 확인 | P1 |
| TC-GRID-010 | 렌더링 | 셀 간 간격 균일성 확인 | P1 |
| TC-GRID-011 | 렌더링 | 셀 상태별 시각적 구분 확인 | P1 |
| TC-GRID-012 | 좌표 | 큐브 좌표 제약 조건 확인 | P0 |
| TC-GRID-013 | 좌표 | 셀 좌표 유일성 확인 | P0 |
| TC-GRID-014 | 좌표 | 원점 셀의 월드 좌표 확인 | P1 |
| TC-GRID-015 | 좌표 | 모든 셀의 원점 거리가 반지름 이내 확인 | P1 |
| TC-GRID-016 | 좌표 | 좌표 변환 왕복 정합성 확인 | P1 |
| TC-GRID-017 | 인터랙션 | 원점 셀 클릭 인식 | P0 |
| TC-GRID-018 | 인터랙션 | 경계 셀 클릭 인식 | P0 |
| TC-GRID-019 | 인터랙션 | 셀 밖 영역 클릭 시 무반응 | P1 |
| TC-GRID-020 | 인터랙션 | 셀 경계 부분 클릭 시 가장 가까운 셀 인식 | P2 |
| TC-GRID-021 | 인터랙션 | 터치 이벤트 인식 (모바일 에뮬레이션) | P1 |
| TC-GRID-022 | 인터랙션 | 빠른 연속 클릭 시 안정성 | P2 |
| TC-GRID-023 | 반응형 | 데스크톱 기본 뷰포트 (1280x720) | P0 |
| TC-GRID-024 | 반응형 | 넓은 뷰포트 (1920x1080) | P1 |
| TC-GRID-025 | 반응형 | 모바일 세로 뷰포트 (iPhone 14) | P0 |
| TC-GRID-026 | 반응형 | 모바일 가로 뷰포트 (844x390) | P1 |
| TC-GRID-027 | 반응형 | 뷰포트 크기 동적 변경 시 그리드 재조정 | P2 |
| TC-GRID-028 | 시각회귀 | 초기 그리드 스크린샷 비교 | P1 |
| TC-GRID-029 | 시각회귀 | 셀 상태 변경 후 스크린샷 비교 | P2 |
| TC-GRID-030 | 시각회귀 | 크로스 브라우저 시각적 일관성 | P2 |
