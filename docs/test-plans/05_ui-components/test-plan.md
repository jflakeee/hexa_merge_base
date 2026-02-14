# Hexa Merge Basic - UI 컴포넌트 Playwright 테스트 계획서

> **문서 버전:** v1.0
> **최종 수정일:** 2026-02-13
> **프로젝트명:** Hexa Merge Basic
> **참조 설계문서:** `docs/design/02_ui-ux-design.md`
> **참조 개발문서:** `docs/development/05_ui-components/development-plan.md`
> **테스트 도구:** Playwright (TypeScript)
> **테스트 대상:** Unity WebGL 빌드

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [테스트 환경 설정](#2-테스트-환경-설정)
3. [테스트 케이스 목록](#3-테스트-케이스-목록)
   - 3.1 [메인 메뉴 화면 테스트](#31-메인-메뉴-화면-테스트)
   - 3.2 [게임 플레이 화면 테스트](#32-게임-플레이-화면-테스트)
   - 3.3 [일시정지 화면 테스트](#33-일시정지-화면-테스트)
   - 3.4 [설정 화면 테스트](#34-설정-화면-테스트)
   - 3.5 [리더보드 화면 테스트](#35-리더보드-화면-테스트)
   - 3.6 [상점 화면 테스트](#36-상점-화면-테스트)
   - 3.7 [HUD 테스트](#37-hud-테스트)
   - 3.8 [반응형 레이아웃 테스트](#38-반응형-레이아웃-테스트)
   - 3.9 [화면 전환 테스트](#39-화면-전환-테스트)
   - 3.10 [팝업 및 토스트 테스트](#310-팝업-및-토스트-테스트)
4. [Playwright 코드 예제](#4-playwright-코드-예제)
5. [테스트 데이터 및 자동화 전략](#5-테스트-데이터-및-자동화-전략)

---

## 1. 테스트 개요

### 1.1 목적

Unity WebGL로 빌드된 Hexa Merge Basic 게임의 UI 컴포넌트가 설계문서(`02_ui-ux-design.md`)와 개발 계획서(`05_ui-components/development-plan.md`)의 명세대로 올바르게 동작하는지 Playwright를 통해 브라우저 환경에서 검증한다.

### 1.2 범위

| 구분 | 내용 |
|------|------|
| **포함** | 메인 메뉴, 게임 플레이, 일시정지, 설정, 리더보드, 상점, HUD, 반응형 레이아웃, 화면 전환, 팝업/토스트 |
| **제외** | Unity 에디터 내부 테스트, 네이티브 Android 빌드, 서버 사이드 로직, 결제 실제 과금 |

### 1.3 전제조건

- Unity WebGL 빌드가 로컬 또는 스테이징 서버에 배포되어 있어야 한다.
- 게임이 `<canvas>` 요소 내에서 렌더링되며, Unity-Playwright 브릿지(`window.unityInstance`)를 통해 게임 내부 상태 조회 및 명령 전달이 가능해야 한다.
- 테스트용 JavaScript 브릿지 함수가 빌드에 포함되어야 한다 (아래 2.3절 참조).

### 1.4 테스트 접근 방식

Unity WebGL 게임은 DOM 기반이 아닌 `<canvas>` 위에 렌더링되므로, 일반적인 CSS 셀렉터 기반 검증이 불가능하다. 따라서 다음의 복합 전략을 사용한다.

| 전략 | 설명 |
|------|------|
| **스크린샷 비교** | 화면 캡처 후 기준 이미지(골든 이미지)와 픽셀 비교 |
| **Unity 브릿지 호출** | `page.evaluate()`로 `unityInstance.SendMessage()`를 호출하여 게임 내부 상태를 제어하거나 조회 |
| **캔버스 좌표 클릭** | 설계문서의 좌표/비율 정보를 기반으로 `<canvas>` 내 특정 위치를 클릭 |
| **콘솔 로그 감지** | Unity `Debug.Log` 출력을 브라우저 콘솔에서 캡처하여 이벤트 발생 여부 확인 |

---

## 2. 테스트 환경 설정

### 2.1 필수 도구 및 버전

| 도구 | 버전 | 용도 |
|------|------|------|
| Node.js | >= 18.x | 런타임 |
| Playwright | >= 1.40 | 브라우저 자동화 |
| TypeScript | >= 5.x | 테스트 코드 작성 |
| @playwright/test | >= 1.40 | 테스트 러너 |

### 2.2 프로젝트 초기 설정

```bash
# 프로젝트 루트에서 실행
npm init -y
npm install -D @playwright/test typescript
npx playwright install chromium firefox webkit
```

**`playwright.config.ts`:**

```typescript
import { defineConfig, devices } from '@playwright/test';

const GAME_URL = process.env.GAME_URL || 'http://localhost:8080';

export default defineConfig({
  testDir: './tests/ui-components',
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.05,
    },
  },
  fullyParallel: false,
  retries: 1,
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],
  use: {
    baseURL: GAME_URL,
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'desktop-chrome',
      use: {
        ...devices['Desktop Chrome'],
        viewport: { width: 1920, height: 1080 },
      },
    },
    {
      name: 'mobile-portrait',
      use: {
        viewport: { width: 360, height: 800 },
        isMobile: true,
        hasTouch: true,
      },
    },
    {
      name: 'tablet-landscape',
      use: {
        viewport: { width: 1024, height: 768 },
        isMobile: true,
        hasTouch: true,
      },
    },
  ],
});
```

### 2.3 Unity-Playwright 브릿지 인터페이스

게임 빌드에 다음의 JavaScript 브릿지를 포함해야 한다. `page.evaluate()`를 통해 호출한다.

```typescript
// tests/helpers/unity-bridge.ts

import { Page } from '@playwright/test';

/** Unity WebGL 인스턴스가 완전히 로드될 때까지 대기 */
export async function waitForUnityLoad(page: Page, timeoutMs = 30_000): Promise<void> {
  await page.waitForFunction(
    () => (window as any).unityInstance !== undefined,
    { timeout: timeoutMs }
  );
  // 첫 프레임 렌더링 대기
  await page.waitForTimeout(2_000);
}

/** Unity 게임 오브젝트에 메시지 전송 */
export async function sendMessage(
  page: Page,
  objectName: string,
  methodName: string,
  value?: string
): Promise<void> {
  await page.evaluate(
    ({ obj, method, val }) => {
      (window as any).unityInstance.SendMessage(obj, method, val ?? '');
    },
    { obj: objectName, method: methodName, val: value }
  );
}

/** Unity 내부 상태 조회 (TestBridge 게임 오브젝트 필요) */
export async function queryState(page: Page, queryName: string): Promise<string> {
  return page.evaluate(async (q) => {
    return new Promise<string>((resolve) => {
      (window as any).__unityQueryCallback = resolve;
      (window as any).unityInstance.SendMessage('TestBridge', 'Query', q);
    });
  }, queryName);
}

/** 캔버스 내 특정 비율 좌표 클릭 */
export async function clickCanvasAt(
  page: Page,
  xRatio: number,
  yRatio: number
): Promise<void> {
  const canvas = page.locator('canvas').first();
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas를 찾을 수 없습니다.');
  await page.mouse.click(
    box.x + box.width * xRatio,
    box.y + box.height * yRatio
  );
}

/** 현재 활성 화면 타입 조회 */
export async function getCurrentScreen(page: Page): Promise<string> {
  return queryState(page, 'CurrentScreen');
}

/** 콘솔 로그에서 특정 메시지 대기 */
export async function waitForConsoleMessage(
  page: Page,
  pattern: string | RegExp,
  timeoutMs = 10_000
): Promise<string> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`콘솔 메시지 대기 시간 초과: ${pattern}`)),
      timeoutMs
    );
    page.on('console', (msg) => {
      const text = msg.text();
      const matched =
        typeof pattern === 'string' ? text.includes(pattern) : pattern.test(text);
      if (matched) {
        clearTimeout(timer);
        resolve(text);
      }
    });
  });
}
```

### 2.4 테스트 픽스처

```typescript
// tests/fixtures/ui-fixture.ts

import { test as base, expect } from '@playwright/test';
import { waitForUnityLoad, sendMessage, getCurrentScreen, clickCanvasAt } from '../helpers/unity-bridge';

type UIFixtures = {
  gamePage: ReturnType<typeof base['page']> extends Promise<infer T> ? T : never;
};

export const test = base.extend<UIFixtures>({
  gamePage: async ({ page }, use) => {
    await page.goto('/');
    await waitForUnityLoad(page);
    await use(page);
  },
});

export { expect };
```

---

## 3. 테스트 케이스 목록

### 3.1 메인 메뉴 화면 테스트

설계문서 1.2절, 개발문서 STEP 3 기반.

---

#### TC-UI-001: 메인 메뉴 초기 레이아웃 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-001 |
| **목적** | 게임 실행 시 메인 메뉴 화면이 설계문서대로 표시되는지 확인 |
| **사전조건** | WebGL 빌드가 로드 완료된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 게임 URL 접속 후 Unity 로드 대기 | Unity 캔버스가 화면에 표시됨 |
| 2 | 현재 활성 화면을 조회 | `MainMenu` 화면이 활성 상태 |
| 3 | 전체 화면 스크린샷 캡처 | 골든 이미지와 비교 시 차이 5% 이내 |
| 4 | 게임 타이틀 로고 영역(상단 30%) 존재 확인 | 타이틀 영역에 "HEXA MERGE" 텍스트 렌더링 |
| 5 | PLAY 버튼 영역(화면 중앙) 존재 확인 | 녹색(#4CAF50) 버튼이 화면 중앙에 위치 |
| 6 | RANK, SHOP 버튼 영역(하단) 존재 확인 | 두 버튼이 하단 영역에 나란히 표시 |
| 7 | 설정 아이콘(우측 상단), 사운드 토글(좌측 상단) 존재 확인 | 각 아이콘이 해당 위치에 표시 |
| 8 | 최고 점수 텍스트가 "Best:" 접두어와 함께 표시 확인 | "Best: 0" 또는 저장된 점수 표시 |

---

#### TC-UI-002: PLAY 버튼 클릭 동작 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-002 |
| **목적** | PLAY 버튼 클릭 시 게임 플레이 화면으로 전환되는지 확인 |
| **사전조건** | 메인 메뉴 화면이 표시된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | PLAY 버튼 좌표(화면 중앙, x:50%, y:50%)를 클릭 | 클릭 이벤트 발생 |
| 2 | 화면 전환 애니메이션 대기(0.5초) | 원형 확대(Circle Wipe) 전환 효과 재생 |
| 3 | 현재 활성 화면 조회 | `Gameplay` 화면으로 전환 완료 |
| 4 | 스크린샷 캡처하여 게임 보드 표시 확인 | 헥사곤 보드와 HUD가 화면에 렌더링 |

---

#### TC-UI-003: CONTINUE 버튼 조건부 표시 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-003 |
| **목적** | 저장 데이터 유무에 따라 CONTINUE 버튼이 표시/숨김되는지 확인 |
| **사전조건** | 메인 메뉴 화면이 표시된 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 저장 데이터를 초기화(브릿지: `SaveManager.ResetAllData`) | 저장 데이터 없음 |
| 2 | 메인 메뉴 새로고침 | CONTINUE 버튼이 표시되지 않음 |
| 3 | 게임을 시작하여 점수를 획득한 뒤 메인 메뉴로 복귀 | 게임 진행 데이터가 저장됨 |
| 4 | 메인 메뉴에서 CONTINUE 버튼 표시 확인 | CONTINUE 버튼이 PLAY 아래에 표시됨 (파란색, #2196F3) |
| 5 | CONTINUE 버튼 클릭 | 저장된 게임 상태에서 게임플레이 재개 |

---

#### TC-UI-004: PLAY 버튼 펄스 애니메이션 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-004 |
| **목적** | PLAY 버튼에 설계문서 명세의 펄스(Scale 1.0~1.05) 애니메이션이 적용되는지 확인 |
| **사전조건** | 메인 메뉴 화면이 표시된 상태 |
| **우선순위** | 낮음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 메인 메뉴 화면에서 0.5초 간격으로 3장의 스크린샷 캡처 | 3장 캡처 완료 |
| 2 | 스크린샷 간 PLAY 버튼 영역의 픽셀 차이 비교 | 버튼 크기가 미세하게 변화(펄스), 차이 > 0% |
| 3 | 브릿지로 애니메이션 상태 조회 | `PlayPulseAnimation` 재생 중 확인 |

---

#### TC-UI-005: 사운드 토글 동작 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-005 |
| **목적** | 좌측 상단 사운드 ON/OFF 토글이 올바르게 전환되는지 확인 |
| **사전조건** | 메인 메뉴 화면 표시, 사운드 기본 ON 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 사운드 토글 위치(좌측 상단, x:5%, y:3%) 클릭 | 토글 OFF 전환 |
| 2 | 브릿지로 사운드 상태 조회 | `MuteEnabled = true` |
| 3 | 스크린샷 캡처하여 토글 아이콘 변경 확인 | 음소거 아이콘으로 변경됨 |
| 4 | 동일 위치 재클릭 | 토글 ON 복원 |
| 5 | 브릿지로 사운드 상태 조회 | `MuteEnabled = false` |

---

### 3.2 게임 플레이 화면 테스트

설계문서 1.3절, 개발문서 STEP 4 기반.

---

#### TC-UI-006: 게임 플레이 화면 초기 레이아웃 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-006 |
| **목적** | 게임 시작 시 보드, HUD, HINT 버튼이 올바르게 배치되는지 확인 |
| **사전조건** | 메인 메뉴에서 PLAY 클릭 후 게임 화면 진입 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 게임 플레이 화면 진입 후 전체 스크린샷 캡처 | 화면 캡처 완료 |
| 2 | 상단 HUD 바 영역(높이 50px) 확인 | 점수("Score:"), 최고점수("Best:"), 일시정지 버튼이 상단에 표시 |
| 3 | 헥사곤 보드 영역(화면 중앙, 폭 90%) 확인 | 다이아몬드형 43셀 헥사곤 그리드가 렌더링됨 |
| 4 | HINT 버튼(좌측 하단, 60x70px) 확인 | HINT 텍스트와 광고 아이콘이 표시됨 |
| 5 | 콤보 패널이 비활성 상태인지 확인 | 콤보 카운터가 숨겨져 있음 |

---

#### TC-UI-007: 헥사곤 블록 탭 선택 피드백 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-007 |
| **목적** | 블록 탭 시 선택 피드백(글로우 + 스케일 바운스)이 표시되는지 확인 |
| **사전조건** | 게임 플레이 화면에서 블록이 배치된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 브릿지로 특정 블록 좌표 조회 | 블록이 존재하는 화면 좌표를 반환 |
| 2 | 해당 블록 위치를 캔버스에서 클릭 | 클릭 이벤트 발생 |
| 3 | 0.2초 후 스크린샷 캡처 | 클릭한 블록에 흰색 3px 글로우 테두리 표시 |
| 4 | 브릿지로 선택 상태 조회 | 해당 셀이 선택 상태 |
| 5 | 콘솔 로그에서 `[SFX] tap_select` 메시지 확인 | 탭 효과음 트리거 로그 출력 |

---

#### TC-UI-008: 콤보 카운터 UI 표시 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-008 |
| **목적** | 연속 머지 시 콤보 카운터가 올바르게 표시되고 스타일이 변경되는지 확인 |
| **사전조건** | 게임 플레이 화면, 같은 숫자 블록이 다수 존재하는 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 브릿지로 테스트용 보드를 세팅 (같은 숫자 블록 다수 배치) | 보드 세팅 완료 |
| 2 | 같은 숫자 블록 두 개를 순서대로 탭 (첫 번째 머지) | 머지 성공, 콤보 패널 비활성 |
| 3 | 2초 이내에 다시 같은 숫자 블록 두 개를 탭 (두 번째 머지) | "COMBO x2" 텍스트 표시, 흰색 |
| 4 | 2초 이내에 다시 같은 숫자 블록 두 개를 탭 (세 번째 머지) | "COMBO x3" 텍스트 표시, 노란색, 화면 미세 흔들림 |
| 5 | 스크린샷 캡처하여 콤보 패널 위치(보드 우측 하단) 확인 | 콤보 패널이 올바른 위치에 렌더링 |

---

### 3.3 일시정지 화면 테스트

설계문서 1.4절, 개발문서 STEP 7 기반.

---

#### TC-UI-009: 일시정지 오버레이 표시 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-009 |
| **목적** | 일시정지 버튼 클릭 시 반투명 오버레이와 메뉴가 올바르게 표시되는지 확인 |
| **사전조건** | 게임 플레이 화면에서 게임 진행 중 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 일시정지 버튼(좌측 상단, HUD 바) 클릭 | 일시정지 오버레이 전환 시작 |
| 2 | 0.3초 대기 (페이드인 애니메이션) | 오버레이 표시 완료 |
| 3 | 현재 활성 화면 조회 | `Pause` 화면 활성 (IsOverlay=true) |
| 4 | 스크린샷 캡처 | 반투명 검정 오버레이(#000000, 60%)가 게임 보드 위에 표시 |
| 5 | "PAUSED" 타이틀 텍스트 확인 | 중앙 패널 상단에 "PAUSED" 텍스트 렌더링 |
| 6 | 현재 점수 텍스트 확인 | "Score: X,XXX" 형식으로 현재 점수 표시 |

---

#### TC-UI-010: 일시정지 메뉴 버튼 배치 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-010 |
| **목적** | RESUME, RESTART, SETTINGS, MAIN MENU 4개 버튼이 올바르게 배치되는지 확인 |
| **사전조건** | 일시정지 화면이 표시된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 일시정지 화면 스크린샷 캡처 | 4개 버튼이 세로로 나열됨 |
| 2 | 브릿지로 각 버튼 활성 상태 조회 | RESUME(#4CAF50), RESTART(#FF9800), SETTINGS(#607D8B), MAIN MENU(#9E9E9E) 모두 활성 |
| 3 | RESUME 버튼이 가장 상단이고 가장 크게(높이 52px) 강조 확인 | RESUME이 최상단, 최대 크기 |

---

#### TC-UI-011: RESUME 버튼 동작 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-011 |
| **목적** | RESUME 클릭 시 게임이 재개되고 오버레이가 닫히는지 확인 |
| **사전조건** | 일시정지 화면 표시 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | RESUME 버튼 위치 클릭 | 오버레이 닫힘 시작 |
| 2 | 0.3초 대기 (페이드아웃 애니메이션) | 오버레이 완전히 제거 |
| 3 | 현재 화면 조회 | `Gameplay` 화면으로 복귀 |
| 4 | 브릿지로 TimeScale 조회 | `Time.timeScale = 1` (게임 재개) |

---

#### TC-UI-012: RESTART 버튼 확인 팝업 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-012 |
| **목적** | RESTART 클릭 시 확인 팝업이 표시되고, 확인 시 게임이 재시작되는지 검증 |
| **사전조건** | 일시정지 화면 표시, 현재 점수 > 0 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | RESTART 버튼 위치 클릭 | 확인 팝업 표시 ("재시작하시겠습니까?") |
| 2 | 스크린샷 캡처하여 팝업 내용 확인 | 확인/취소 버튼이 포함된 팝업 표시 |
| 3 | 취소 버튼 클릭 | 팝업 닫힘, 일시정지 화면으로 복귀 |
| 4 | RESTART 다시 클릭 후 확인 버튼 클릭 | 게임 재시작, 점수 0으로 초기화, Gameplay 화면 |

---

#### TC-UI-013: MAIN MENU 버튼 동작 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-013 |
| **목적** | MAIN MENU 클릭 시 확인 팝업 후 메인 메뉴로 이동하는지 확인 |
| **사전조건** | 일시정지 화면 표시 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | MAIN MENU 버튼 위치 클릭 | 확인 팝업 표시 ("메인 메뉴로 돌아가시겠습니까?") |
| 2 | 확인 버튼 클릭 | 게임 상태 저장 후 메인 메뉴 전환 |
| 3 | 현재 화면 조회 | `MainMenu` 화면 활성 |
| 4 | 메인 메뉴에서 CONTINUE 버튼 표시 확인 | 저장된 게임이 있으므로 CONTINUE 버튼 표시 |

---

### 3.4 설정 화면 테스트

설계문서 1.5절, 개발문서 STEP 8 기반.

---

#### TC-UI-014: 설정 화면 초기 레이아웃 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-014 |
| **목적** | 설정 화면의 모든 UI 요소가 올바르게 배치되는지 확인 |
| **사전조건** | 메인 메뉴에서 설정 아이콘 클릭 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 설정 아이콘(우측 상단) 클릭 | 설정 화면으로 전환 (슬라이드 라이트) |
| 2 | 0.3초 대기 후 스크린샷 캡처 | 설정 화면 전체 레이아웃 캡처 |
| 3 | "SETTINGS" 타이틀 확인 | 상단에 "SETTINGS" 텍스트 표시 |
| 4 | Sound 섹션 확인 | BGM/SFX 두 개 슬라이더 표시 |
| 5 | General 섹션 확인 | Vibration 토글, Notification 토글, Language 드롭다운 표시 |
| 6 | Data 섹션 확인 | "RESET ALL DATA" 빨간색(#F44336) 버튼 표시 |
| 7 | 하단 링크 확인 | "Privacy Policy", "Terms of Service" 링크 + 버전 정보("Version 1.0.0") 표시 |
| 8 | 뒤로가기 버튼(좌측 상단) 확인 | 화살표 아이콘(40x40px) 표시 |

---

#### TC-UI-015: BGM 볼륨 슬라이더 동작 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-015 |
| **목적** | BGM 슬라이더 조작 시 볼륨이 실시간으로 변경되고 퍼센트가 업데이트되는지 확인 |
| **사전조건** | 설정 화면 표시 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | BGM 슬라이더 초기값 확인 | 기본값 70% (설계문서 기준) |
| 2 | 슬라이더를 좌측 끝으로 드래그 | BGM 볼륨 0%, "0%" 텍스트 표시 |
| 3 | 브릿지로 실제 BGM 볼륨 조회 | `BGMVolume = 0` |
| 4 | 슬라이더를 우측 끝으로 드래그 | BGM 볼륨 100%, "100%" 텍스트 표시 |
| 5 | 브릿지로 실제 BGM 볼륨 조회 | `BGMVolume = 1.0` |
| 6 | 설정 화면 닫고 다시 열기 | 변경된 볼륨 값(100%)이 유지됨 (PlayerPrefs 저장) |

---

#### TC-UI-016: SFX 볼륨 슬라이더 동작 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-016 |
| **목적** | SFX 슬라이더 조작 시 효과음 볼륨이 실시간 변경되는지 확인 |
| **사전조건** | 설정 화면 표시 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | SFX 슬라이더 초기값 확인 | 기본값 100% |
| 2 | 슬라이더를 50% 위치로 드래그 | "50%" 텍스트 표시 |
| 3 | 브릿지로 실제 SFX 볼륨 조회 | `SFXVolume = 0.5` |
| 4 | 설정 화면 닫고 다시 열기 | 변경된 볼륨 값(50%) 유지 |

---

#### TC-UI-017: 진동 토글 (모바일 전용) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-017 |
| **목적** | Vibration 토글이 모바일에서만 표시되고, ON/OFF 전환이 올바른지 확인 |
| **사전조건** | 설정 화면 표시 상태 |
| **우선순위** | 낮음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 데스크톱 뷰포트(1920x1080)에서 설정 화면 확인 | Vibration 행이 숨겨져 있음 |
| 2 | 모바일 뷰포트(360x800)로 변경 후 설정 화면 확인 | Vibration 행이 표시됨 (ON 기본값) |
| 3 | Vibration 토글 클릭 | OFF로 전환, 토글 색상 #BDBDBD |
| 4 | 다시 클릭 | ON으로 복원, 토글 색상 #4CAF50 |

---

#### TC-UI-018: 언어 선택 드롭다운 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-018 |
| **목적** | 언어 드롭다운에서 한국어/English 전환이 올바르게 작동하는지 확인 |
| **사전조건** | 설정 화면 표시 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 언어 드롭다운 현재 값 확인 | 디바이스 언어 또는 기본값 표시 |
| 2 | 드롭다운 클릭하여 옵션 목록 표시 | "한국어", "English" 두 옵션 표시 |
| 3 | "English" 선택 | UI 텍스트가 영어로 변경 (예: "SETTINGS" 유지, "Sound"등) |
| 4 | "한국어" 선택 | UI 텍스트가 한국어로 변경 |

---

#### TC-UI-019: 데이터 초기화 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-019 |
| **목적** | RESET ALL DATA 버튼 클릭 시 확인 팝업이 표시되고, 확인 시 모든 데이터가 초기화되는지 확인 |
| **사전조건** | 설정 화면 표시, 게임 데이터(점수 등)가 존재하는 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | RESET ALL DATA 버튼 클릭 | 확인 팝업 표시 ("정말 초기화하시겠습니까?") |
| 2 | 취소 버튼 클릭 | 팝업 닫힘, 데이터 유지 |
| 3 | RESET ALL DATA 재클릭 후 확인 버튼 클릭 | 모든 데이터 초기화, 메인 메뉴로 이동 |
| 4 | 메인 메뉴에서 최고 점수 확인 | "Best: 0" 표시 |
| 5 | CONTINUE 버튼 표시 확인 | CONTINUE 버튼 숨겨짐 (저장 데이터 없음) |

---

#### TC-UI-020: 설정 화면 뒤로가기 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-020 |
| **목적** | 뒤로가기 버튼 클릭 시 이전 화면으로 올바르게 복귀하는지 확인 |
| **사전조건** | 메인 메뉴에서 설정 화면 진입 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 뒤로가기 버튼(좌측 상단) 클릭 | 슬라이드 레프트 전환 효과 재생 |
| 2 | 0.3초 대기 | 전환 완료 |
| 3 | 현재 화면 조회 | `MainMenu` 화면으로 복귀 |

---

### 3.5 리더보드 화면 테스트

설계문서 1.6절, 개발문서 STEP 9 기반.

---

#### TC-UI-021: 리더보드 화면 초기 표시 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-021 |
| **목적** | 리더보드 화면이 ALL 탭으로 기본 로드되며, 순위 리스트가 표시되는지 확인 |
| **사전조건** | 메인 메뉴에서 RANK 버튼 클릭 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | RANK 버튼 클릭 | 리더보드 화면으로 전환 (슬라이드 업) |
| 2 | 0.35초 대기 후 스크린샷 캡처 | 리더보드 전체 레이아웃 캡처 |
| 3 | 탭 바 확인 | "ALL" 탭이 활성(밑줄 #4CAF50), "WEEKLY"/"FRIENDS" 비활성(#9E9E9E) |
| 4 | 상위 3위 강조 확인 | #1 금색(#FFD700), #2 은색(#C0C0C0), #3 동색(#CD7F32) 별 아이콘 |
| 5 | 순위 리스트 행 높이 확인 | 각 행 높이 56px, 짝수행 배경 #FAFAFA |
| 6 | 하단 고정 내 순위 확인 | "YOU (나)" 텍스트, 배경 #E8F5E9으로 강조 |

---

#### TC-UI-022: 리더보드 탭 전환 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-022 |
| **목적** | ALL/WEEKLY/FRIENDS 탭 전환 시 데이터가 올바르게 갱신되는지 확인 |
| **사전조건** | 리더보드 화면 표시, ALL 탭 활성 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | "WEEKLY" 탭 클릭 | WEEKLY 탭 밑줄 활성, ALL 탭 비활성 |
| 2 | 순위 데이터 갱신 확인 | 주간 순위 데이터로 리스트 변경 |
| 3 | "FRIENDS" 탭 클릭 | FRIENDS 탭 밑줄 활성, 나머지 비활성 |
| 4 | 순위 데이터 갱신 확인 | 친구 순위 데이터로 리스트 변경 |
| 5 | "ALL" 탭 클릭 | 전체 순위로 복귀 |

---

#### TC-UI-023: 리더보드 스크롤 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-023 |
| **목적** | 순위 리스트가 부드럽게 스크롤되고, 내 순위가 하단에 고정 유지되는지 확인 |
| **사전조건** | 리더보드 화면에 8개 이상의 순위 항목이 있는 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 순위 리스트 영역에서 위로 스와이프(스크롤) | 리스트가 부드럽게 스크롤 |
| 2 | 스크롤 후 스크린샷 캡처 | 하위 순위 항목이 표시됨 |
| 3 | 내 순위 영역(하단 고정) 확인 | 스크롤과 무관하게 하단에 고정 유지 |
| 4 | 끝까지 스크롤 | 관성 스크롤로 부드럽게 마무리 |

---

### 3.6 상점 화면 테스트

설계문서 1.7절, 개발문서 STEP 10 기반.

---

#### TC-UI-024: 상점 화면 초기 레이아웃 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-024 |
| **목적** | 상점 화면의 카테고리 탭, 상품 카드, 보유 재화가 올바르게 표시되는지 확인 |
| **사전조건** | 메인 메뉴에서 SHOP 버튼 클릭 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | SHOP 버튼 클릭 | 상점 화면으로 전환 (슬라이드 업) |
| 2 | 0.35초 대기 후 스크린샷 캡처 | 상점 전체 레이아웃 캡처 |
| 3 | 상단 보유 재화 표시 확인 | 젬 아이콘 + 보유 젬 수량 표시 |
| 4 | 카테고리 탭 확인 | "ITEMS" 탭 활성(기본), "COINS", "NO ADS" 탭 표시 |
| 5 | 상품 카드 그리드(2열) 확인 | 2열 그리드로 상품 카드 배치, 카드 간 간격 12px |
| 6 | 하단 무료 젬 배너 확인 | "FREE GEMS! Watch Ad" 배너가 하단에 고정 표시 |

---

#### TC-UI-025: 상점 카테고리 탭 전환 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-025 |
| **목적** | ITEMS/COINS/NO ADS 탭 전환 시 해당 카테고리의 상품이 표시되는지 확인 |
| **사전조건** | 상점 화면 표시 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | "ITEMS" 탭(기본) 상품 목록 확인 | Hint x3, Undo x3, Shuffle x1, Bomb x1 카드 표시 |
| 2 | "COINS" 탭 클릭 | 젬 100개, 500개, 1200개, 3000개 팩 카드 표시 |
| 3 | "NO ADS" 탭 클릭 | 광고 제거 상품(₩5,500) 카드 표시 |
| 4 | 각 탭에서 스크린샷 캡처 | 카테고리별 상품이 정확히 구분 표시 |

---

#### TC-UI-026: 상품 카드 뱃지(BEST/HOT) 표시 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-026 |
| **목적** | 특정 상품에 BEST/HOT 뱃지가 올바른 스타일로 표시되는지 확인 |
| **사전조건** | 상점 화면 ITEMS 탭 표시 상태 |
| **우선순위** | 낮음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | "Hint x3" 카드에서 BEST 뱃지 확인 | 카드 우측 상단에 빨강/주황 배경, -15도 회전된 "BEST" 뱃지 |
| 2 | "Bomb x1" 카드에서 HOT 뱃지 확인 | 카드 우측 상단에 "HOT" 뱃지 표시 |
| 3 | 뱃지가 없는 카드 확인 | "Undo x3", "Shuffle x1"에는 뱃지 없음 |

---

#### TC-UI-027: 상점 구매 플로우 검증 (젬 결제)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-027 |
| **목적** | 젬으로 아이템 구매 시 재화가 차감되고 아이템이 지급되는지 확인 |
| **사전조건** | 상점 화면 표시, 보유 젬 >= 50 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 브릿지로 테스트 젬 100개 지급 | 보유 젬 = 100 |
| 2 | 상단 보유 재화에 "100" 표시 확인 | 젬 수량 업데이트됨 |
| 3 | "Hint x3" 카드의 BUY 버튼(#4CAF50) 클릭 | 구매 처리 시작 |
| 4 | 구매 완료 후 보유 재화 확인 | 젬 50개 차감, "50" 표시 |
| 5 | 토스트 메시지 확인 | "구매 완료!" 토스트 표시 |
| 6 | 브릿지로 힌트 보유 수량 조회 | Hint = 3 |

---

#### TC-UI-028: 재화 부족 시 구매 시도 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-028 |
| **목적** | 젬이 부족한 상태에서 구매 시 적절한 안내가 표시되는지 확인 |
| **사전조건** | 상점 화면 표시, 보유 젬 < 상품 가격 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 브릿지로 보유 젬 0으로 설정 | 젬 = 0 |
| 2 | "Hint x3" (50젬) BUY 버튼 클릭 | 구매 실패 |
| 3 | 안내 메시지 또는 코인 팩 탭 전환 확인 | "젬이 부족합니다" 안내 또는 COINS 탭으로 자동 이동 |

---

### 3.7 HUD 테스트

설계문서 3절, 개발문서 STEP 5 기반.

---

#### TC-UI-029: HUD 바 초기 레이아웃 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-029 |
| **목적** | 게임 시작 시 HUD 바의 점수, 최고점수, 일시정지 버튼이 올바르게 배치되는지 확인 |
| **사전조건** | 게임 플레이 화면 진입 직후 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | HUD 바 영역(상단 50px) 스크린샷 캡처 | HUD 바가 전체 너비로 표시 |
| 2 | 현재 점수 영역 확인 | "0" 또는 초기 점수, 폰트 24px, 색상 #FFFFFF |
| 3 | 최고 점수 영역 확인 | "Best: X,XXX", 폰트 16px, 색상 #B0BEC5 |
| 4 | 일시정지 버튼 확인 | 좌측 끝에 일시정지 아이콘(40x40px) 표시 |
| 5 | HUD 배경 확인 | 반투명 배경(#000000, 40%) 적용 |

---

#### TC-UI-030: 점수 카운트업 애니메이션 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-030 |
| **목적** | 점수 획득 시 숫자가 카운트업 애니메이션으로 올라가는지 확인 |
| **사전조건** | 게임 플레이 중 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 브릿지로 현재 점수 조회(예: 0) | 초기 점수 확인 |
| 2 | 같은 숫자 블록을 탭하여 머지 수행 | 점수 증가 이벤트 발생 |
| 3 | 0.1초 간격으로 3장 스크린샷 캡처 (0.5초 카운트업 중) | 점수 텍스트가 단계적으로 증가하는 것이 캡처됨 |
| 4 | 최종 점수 확인 | 머지 결과에 따른 정확한 점수 표시 (천 단위 콤마) |

---

#### TC-UI-031: 최고 점수 갱신 이펙트 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-031 |
| **목적** | 현재 점수가 최고 점수를 넘을 때 갱신 이펙트가 표시되는지 확인 |
| **사전조건** | 게임 플레이 중, 현재 점수가 최고 점수에 근접한 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 브릿지로 최고 점수를 10으로 낮게 설정 | Best: 10 |
| 2 | 머지를 수행하여 점수 10 초과 달성 | 최고 점수 갱신 트리거 |
| 3 | 스크린샷 캡처 | "NEW BEST" 뱃지가 표시되고, 펀치 스케일 애니메이션 재생 |
| 4 | Best 텍스트 갱신 확인 | "Best:" 값이 새 점수로 갱신됨 |
| 5 | 콘솔 로그에서 `[SFX] new_record` 메시지 확인 | 신기록 효과음 트리거 |

---

### 3.8 반응형 레이아웃 테스트

설계문서 7절, 개발문서 STEP 11 기반.

---

#### TC-UI-032: 모바일 레이아웃 (너비 < 768px) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-032 |
| **목적** | 모바일 뷰포트에서 세로 레이아웃이 올바르게 적용되는지 확인 |
| **사전조건** | 뷰포트 360x800 설정 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 뷰포트를 360x800으로 설정 | 모바일 레이아웃 트리거 |
| 2 | 게임 플레이 화면 진입 | Gameplay 화면 표시 |
| 3 | 전체 스크린샷 캡처 | 세로 모드 레이아웃 캡처 |
| 4 | 사이드바 표시 여부 확인 | 사이드바 숨겨짐 |
| 5 | 보드 크기 확인 (브릿지) | 화면 폭 90% 차지, 중앙 정렬 |
| 6 | HINT 버튼 위치 확인 | 하단 영역에 표시 |
| 7 | HUD 바 확인 | 상단 전체 너비, 50px 높이 |

---

#### TC-UI-033: 태블릿 레이아웃 (768px <= 너비 < 1200px) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-033 |
| **목적** | 태블릿 뷰포트에서 중간 레이아웃이 올바르게 적용되는지 확인 |
| **사전조건** | 뷰포트 1024x768 설정 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 뷰포트를 1024x768로 설정 | 태블릿 레이아웃 트리거 |
| 2 | 게임 플레이 화면 진입 후 스크린샷 캡처 | 태블릿 레이아웃 캡처 |
| 3 | 보드 크기 확인 | 보드가 폭 70~80%, 적당한 여백으로 중앙 배치 |
| 4 | 사이드바 표시 여부 확인 | 사이드바 숨겨짐 |
| 5 | 브릿지로 현재 Breakpoint 조회 | `Breakpoint.Tablet` |

---

#### TC-UI-034: 데스크톱 레이아웃 (너비 >= 1200px) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-034 |
| **목적** | 데스크톱 뷰포트에서 좌측 사이드바 + 보드 레이아웃이 올바르게 적용되는지 확인 |
| **사전조건** | 뷰포트 1920x1080 설정 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 뷰포트를 1920x1080으로 설정 | 데스크톱 레이아웃 트리거 |
| 2 | 게임 플레이 화면 진입 후 스크린샷 캡처 | 데스크톱 레이아웃 캡처 |
| 3 | 좌측 사이드바 확인 | 화면 폭 20%에 HINT, COMBO 등 배치 |
| 4 | 게임 보드 확인 | 화면 폭 60%, 중앙~우측 배치 |
| 5 | 브릿지로 현재 Breakpoint 조회 | `Breakpoint.Desktop` |
| 6 | 보드 헥사곤 size 확인 | size=40px (Full HD 기준) |

---

#### TC-UI-035: 뷰포트 동적 변경(리사이즈) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-035 |
| **목적** | 브라우저 창 크기를 변경할 때 레이아웃이 실시간으로 전환되는지 확인 |
| **사전조건** | 게임 플레이 화면 표시 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 초기 뷰포트 1920x1080 (데스크톱) | 사이드바 표시, 보드 60% |
| 2 | 뷰포트를 768x1024로 변경 | 태블릿 레이아웃으로 전환 |
| 3 | 0.5초 대기 후 스크린샷 캡처 | 사이드바 숨겨짐, 보드 중앙 재배치 |
| 4 | 뷰포트를 360x800으로 변경 | 모바일 레이아웃으로 전환 |
| 5 | 스크린샷 캡처 | 세로 모드, 보드 폭 90%, 하단 버튼 영역 |
| 6 | 브릿지로 게임 상태 확인 | 리사이즈 중 게임 상태 유지 (중단 없음) |

---

#### TC-UI-036: 메인 메뉴 반응형 레이아웃 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-036 |
| **목적** | 메인 메뉴 화면이 다양한 뷰포트에서 올바르게 표시되는지 확인 |
| **사전조건** | 메인 메뉴 화면 표시 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 뷰포트 360x800에서 메인 메뉴 스크린샷 | 모바일: 세로 배치, 버튼 전체 너비 |
| 2 | 뷰포트 1024x768에서 메인 메뉴 스크린샷 | 태블릿: 중앙 집중 배치 |
| 3 | 뷰포트 1920x1080에서 메인 메뉴 스크린샷 | 데스크톱: 타이틀과 버튼 적절한 스케일 |
| 4 | 각 뷰포트에서 PLAY 버튼 클릭 가능 확인 | 모든 뷰포트에서 클릭 정상 작동 |

---

### 3.9 화면 전환 테스트

설계문서 4.7절, 개발문서 STEP 2 기반.

---

#### TC-UI-037: 메인 메뉴 -> 게임 전환 (Circle Wipe) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-037 |
| **목적** | PLAY 클릭 시 원형 확대(Circle Wipe) 전환 효과가 재생되는지 확인 |
| **사전조건** | 메인 메뉴 화면 표시 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | PLAY 버튼 클릭 직후 연속 스크린샷 캡처 (0.1초 간격, 5장) | 전환 중간 프레임 캡처 |
| 2 | 프레임 비교 분석 | 원형이 점점 확대되는 전환 효과가 관찰됨 |
| 3 | 전환 총 소요 시간 측정 | 약 0.5초 소요 |
| 4 | 전환 완료 후 화면 확인 | Gameplay 화면 완전 표시 |

---

#### TC-UI-038: 게임 -> 일시정지 전환 (오버레이 페이드인) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-038 |
| **목적** | 일시정지 시 오버레이가 0.3초에 걸쳐 페이드인되는지 확인 |
| **사전조건** | 게임 플레이 중 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 일시정지 버튼 클릭 직후 0.1초 간격으로 3장 스크린샷 | 전환 중간 프레임 캡처 |
| 2 | 첫 번째 프레임: 오버레이 투명도 낮음 | 배경이 반투명하게 시작 |
| 3 | 마지막 프레임: 오버레이 투명도 60% | 완전한 반투명 오버레이 + 중앙 패널 |

---

#### TC-UI-039: 설정/리더보드/상점 슬라이드 전환 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-039 |
| **목적** | 각 화면 진입/이탈 시 올바른 슬라이드 방향의 전환이 재생되는지 확인 |
| **사전조건** | 메인 메뉴 화면 표시 상태 |
| **우선순위** | 낮음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 설정 아이콘 클릭 후 스크린샷 (전환 중) | 우측에서 슬라이드인 효과 (0.3초) |
| 2 | 설정에서 뒤로가기 후 스크린샷 (전환 중) | 좌측으로 슬라이드아웃 효과 (0.3초) |
| 3 | RANK 버튼 클릭 후 스크린샷 (전환 중) | 아래에서 위로 슬라이드업 효과 (0.35초) |
| 4 | SHOP 버튼 클릭 후 스크린샷 (전환 중) | 아래에서 위로 슬라이드업 효과 (0.35초) |

---

#### TC-UI-040: 화면 전환 중 입력 차단 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-040 |
| **목적** | 화면 전환 애니메이션 중 추가 입력이 차단되는지 확인 |
| **사전조건** | 메인 메뉴 화면 표시 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | PLAY 버튼 클릭 즉시 RANK 버튼 위치도 클릭 (빠른 연속 탭) | 첫 번째 클릭만 처리 |
| 2 | 0.5초 대기 후 현재 화면 조회 | `Gameplay` 화면 (Leaderboard 아님) |
| 3 | 브릿지로 화면 스택 깊이 조회 | 스택에 불필요한 화면이 쌓이지 않음 |

---

### 3.10 팝업 및 토스트 테스트

개발문서 STEP 13 기반.

---

#### TC-UI-041: 확인 팝업 표시 및 동작 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-041 |
| **목적** | 확인 팝업이 올바르게 표시되고, 확인/취소 버튼이 정상 동작하는지 확인 |
| **사전조건** | 설정 화면에서 RESET ALL DATA 클릭 |
| **우선순위** | 높음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | RESET ALL DATA 클릭 | 오버레이 Canvas에 확인 팝업 표시 |
| 2 | 스크린샷 캡처 | 팝업: 메시지 텍스트 + 확인/취소 버튼, 배경 반투명 |
| 3 | 팝업 바깥 영역 클릭 | 팝업 닫히지 않음 (모달 동작) |
| 4 | 취소 버튼 클릭 | 팝업 닫힘, 원래 화면 복귀, 데이터 유지 |

---

#### TC-UI-042: 토스트 메시지 표시 및 자동 소멸 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-042 |
| **목적** | 토스트 메시지가 아래에서 위로 올라오고, 일정 시간 후 자동으로 사라지는지 확인 |
| **사전조건** | 상점에서 아이템 구매 완료 직후 |
| **우선순위** | 중간 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 아이템 구매 수행 (TC-UI-027 참조) | "구매 완료!" 토스트 트리거 |
| 2 | 즉시 스크린샷 캡처 | 하단에서 위로 올라오는 토스트 메시지 표시 |
| 3 | 2초 대기 후 스크린샷 캡처 | 토스트가 페이드아웃 시작 |
| 4 | 3초 후 스크린샷 캡처 | 토스트가 완전히 사라짐 |

---

#### TC-UI-043: 토스트 연속 표시 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-UI-043 |
| **목적** | 토스트가 연속 발생 시 이전 토스트가 교체되는지 확인 |
| **사전조건** | 게임 내 토스트를 트리거할 수 있는 상태 |
| **우선순위** | 낮음 |

**테스트 단계:**

| # | 단계 | 기대결과 |
|---|------|---------|
| 1 | 브릿지로 토스트 "메시지 A" 트리거 | "메시지 A" 토스트 표시 |
| 2 | 즉시 브릿지로 토스트 "메시지 B" 트리거 | "메시지 A"가 사라지고 "메시지 B"로 교체 |
| 3 | 스크린샷 캡처 | 화면에 "메시지 B" 토스트만 표시 |

---

## 3. 테스트 케이스 요약 체크리스트

| TC-ID | 카테고리 | 테스트명 | 우선순위 |
|-------|---------|---------|---------|
| TC-UI-001 | 메인 메뉴 | 초기 레이아웃 검증 | 높음 |
| TC-UI-002 | 메인 메뉴 | PLAY 버튼 클릭 동작 | 높음 |
| TC-UI-003 | 메인 메뉴 | CONTINUE 조건부 표시 | 중간 |
| TC-UI-004 | 메인 메뉴 | PLAY 펄스 애니메이션 | 낮음 |
| TC-UI-005 | 메인 메뉴 | 사운드 토글 동작 | 중간 |
| TC-UI-006 | 게임 플레이 | 초기 레이아웃 검증 | 높음 |
| TC-UI-007 | 게임 플레이 | 블록 탭 선택 피드백 | 높음 |
| TC-UI-008 | 게임 플레이 | 콤보 카운터 UI | 중간 |
| TC-UI-009 | 일시정지 | 오버레이 표시 | 높음 |
| TC-UI-010 | 일시정지 | 버튼 배치 | 높음 |
| TC-UI-011 | 일시정지 | RESUME 동작 | 높음 |
| TC-UI-012 | 일시정지 | RESTART 확인 팝업 | 중간 |
| TC-UI-013 | 일시정지 | MAIN MENU 동작 | 중간 |
| TC-UI-014 | 설정 | 초기 레이아웃 | 높음 |
| TC-UI-015 | 설정 | BGM 볼륨 슬라이더 | 중간 |
| TC-UI-016 | 설정 | SFX 볼륨 슬라이더 | 중간 |
| TC-UI-017 | 설정 | 진동 토글 (모바일) | 낮음 |
| TC-UI-018 | 설정 | 언어 선택 드롭다운 | 중간 |
| TC-UI-019 | 설정 | 데이터 초기화 | 높음 |
| TC-UI-020 | 설정 | 뒤로가기 | 중간 |
| TC-UI-021 | 리더보드 | 초기 표시 | 높음 |
| TC-UI-022 | 리더보드 | 탭 전환 | 중간 |
| TC-UI-023 | 리더보드 | 스크롤 | 중간 |
| TC-UI-024 | 상점 | 초기 레이아웃 | 높음 |
| TC-UI-025 | 상점 | 카테고리 탭 전환 | 중간 |
| TC-UI-026 | 상점 | BEST/HOT 뱃지 | 낮음 |
| TC-UI-027 | 상점 | 구매 플로우 (젬) | 높음 |
| TC-UI-028 | 상점 | 재화 부족 구매 | 중간 |
| TC-UI-029 | HUD | 초기 레이아웃 | 높음 |
| TC-UI-030 | HUD | 점수 카운트업 | 중간 |
| TC-UI-031 | HUD | 최고 점수 갱신 이펙트 | 중간 |
| TC-UI-032 | 반응형 | 모바일 레이아웃 | 높음 |
| TC-UI-033 | 반응형 | 태블릿 레이아웃 | 중간 |
| TC-UI-034 | 반응형 | 데스크톱 레이아웃 | 높음 |
| TC-UI-035 | 반응형 | 동적 리사이즈 | 중간 |
| TC-UI-036 | 반응형 | 메인 메뉴 반응형 | 중간 |
| TC-UI-037 | 화면 전환 | Circle Wipe | 중간 |
| TC-UI-038 | 화면 전환 | 오버레이 페이드인 | 중간 |
| TC-UI-039 | 화면 전환 | 슬라이드 전환 | 낮음 |
| TC-UI-040 | 화면 전환 | 전환 중 입력 차단 | 높음 |
| TC-UI-041 | 팝업/토스트 | 확인 팝업 | 높음 |
| TC-UI-042 | 팝업/토스트 | 토스트 자동 소멸 | 중간 |
| TC-UI-043 | 팝업/토스트 | 토스트 연속 표시 | 낮음 |

---

## 4. Playwright 코드 예제

### 4.1 기본 테스트 구조 및 Unity 로드 대기

```typescript
// tests/ui-components/main-menu.spec.ts

import { test, expect } from '../fixtures/ui-fixture';
import {
  waitForUnityLoad,
  sendMessage,
  getCurrentScreen,
  clickCanvasAt,
  queryState,
  waitForConsoleMessage,
} from '../helpers/unity-bridge';

test.describe('메인 메뉴 화면 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUnityLoad(page);

    // 메인 메뉴 화면 확인
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('MainMenu');
  });

  test('TC-UI-001: 메인 메뉴 초기 레이아웃', async ({ page }) => {
    // 전체 화면 스크린샷 골든 이미지 비교
    await expect(page).toHaveScreenshot('main-menu-layout.png', {
      maxDiffPixelRatio: 0.05,
    });

    // Unity 브릿지로 UI 요소 상태 확인
    const playBtnActive = await queryState(page, 'MainMenu.PlayButton.Active');
    expect(playBtnActive).toBe('true');

    const bestScore = await queryState(page, 'MainMenu.BestScoreText');
    expect(bestScore).toMatch(/^Best: [\d,]+$/);
  });

  test('TC-UI-002: PLAY 버튼 클릭 -> 게임 화면 전환', async ({ page }) => {
    // PLAY 버튼 위치 클릭 (화면 중앙, 설계문서 기준 x:50%, y:50%)
    await clickCanvasAt(page, 0.5, 0.50);

    // 전환 애니메이션 대기
    await page.waitForTimeout(600);

    // 게임 플레이 화면으로 전환 확인
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Gameplay');

    // 게임 보드가 표시되는지 스크린샷으로 검증
    await expect(page).toHaveScreenshot('gameplay-after-play.png', {
      maxDiffPixelRatio: 0.1,
    });
  });

  test('TC-UI-005: 사운드 토글 ON/OFF', async ({ page }) => {
    // 사운드 토글 위치 클릭 (좌측 상단)
    await clickCanvasAt(page, 0.05, 0.03);
    await page.waitForTimeout(300);

    const muteState = await queryState(page, 'Settings.MuteEnabled');
    expect(muteState).toBe('true');

    // 스크린샷으로 아이콘 변경 확인
    await expect(page).toHaveScreenshot('sound-muted.png', {
      maxDiffPixelRatio: 0.05,
    });

    // 다시 클릭하여 ON 복원
    await clickCanvasAt(page, 0.05, 0.03);
    await page.waitForTimeout(300);

    const unmuteState = await queryState(page, 'Settings.MuteEnabled');
    expect(unmuteState).toBe('false');
  });
});
```

### 4.2 뷰포트 변경을 활용한 반응형 테스트

```typescript
// tests/ui-components/responsive-layout.spec.ts

import { test, expect } from '@playwright/test';
import { waitForUnityLoad, getCurrentScreen, queryState } from '../helpers/unity-bridge';

const VIEWPORTS = {
  mobile:  { width: 360,  height: 800  },
  tablet:  { width: 1024, height: 768  },
  desktop: { width: 1920, height: 1080 },
};

test.describe('반응형 레이아웃 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUnityLoad(page);
  });

  test('TC-UI-032: 모바일 레이아웃 (360x800)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(500);

    // 게임 플레이 화면 진입
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.waitForTimeout(600);

    // Breakpoint 확인
    const bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Mobile');

    // 사이드바 숨김 확인
    const sidebarVisible = await queryState(page, 'ResponsiveLayout.SidebarVisible');
    expect(sidebarVisible).toBe('false');

    // 모바일 레이아웃 스크린샷
    await expect(page).toHaveScreenshot('gameplay-mobile-360x800.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('TC-UI-034: 데스크톱 레이아웃 (1920x1080)', async ({ page }) => {
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForTimeout(500);

    // PLAY 클릭
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.waitForTimeout(600);

    const bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Desktop');

    // 사이드바 표시 확인
    const sidebarVisible = await queryState(page, 'ResponsiveLayout.SidebarVisible');
    expect(sidebarVisible).toBe('true');

    await expect(page).toHaveScreenshot('gameplay-desktop-1920x1080.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('TC-UI-035: 뷰포트 동적 변경 시 레이아웃 전환', async ({ page }) => {
    // 데스크톱으로 시작
    await page.setViewportSize(VIEWPORTS.desktop);
    await page.waitForTimeout(500);

    // 게임 시작
    const canvas = page.locator('canvas').first();
    const box = await canvas.boundingBox();
    await page.mouse.click(box!.x + box!.width * 0.5, box!.y + box!.height * 0.5);
    await page.waitForTimeout(600);

    // 데스크톱 확인
    let bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Desktop');

    // 태블릿으로 리사이즈
    await page.setViewportSize(VIEWPORTS.tablet);
    await page.waitForTimeout(500);

    bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Tablet');
    await expect(page).toHaveScreenshot('gameplay-resized-tablet.png');

    // 모바일로 리사이즈
    await page.setViewportSize(VIEWPORTS.mobile);
    await page.waitForTimeout(500);

    bp = await queryState(page, 'ResponsiveLayout.CurrentBreakpoint');
    expect(bp).toBe('Mobile');
    await expect(page).toHaveScreenshot('gameplay-resized-mobile.png');

    // 게임 상태가 유지되는지 확인
    const score = await queryState(page, 'HUD.CurrentScore');
    expect(parseInt(score)).toBeGreaterThanOrEqual(0);
  });
});
```

### 4.3 일시정지 및 팝업 테스트

```typescript
// tests/ui-components/pause-popup.spec.ts

import { test, expect } from '@playwright/test';
import {
  waitForUnityLoad,
  sendMessage,
  getCurrentScreen,
  clickCanvasAt,
  queryState,
} from '../helpers/unity-bridge';

test.describe('일시정지 및 팝업 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUnityLoad(page);

    // 게임 시작
    await clickCanvasAt(page, 0.5, 0.5);
    await page.waitForTimeout(600);
    expect(await getCurrentScreen(page)).toBe('Gameplay');
  });

  test('TC-UI-009: 일시정지 오버레이 표시', async ({ page }) => {
    // 일시정지 버튼 클릭 (좌측 상단 HUD)
    await clickCanvasAt(page, 0.05, 0.025);
    await page.waitForTimeout(400);

    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Pause');

    // 오버레이 스크린샷
    await expect(page).toHaveScreenshot('pause-overlay.png', {
      maxDiffPixelRatio: 0.05,
    });
  });

  test('TC-UI-011: RESUME 버튼으로 게임 재개', async ({ page }) => {
    // 일시정지 진입
    await clickCanvasAt(page, 0.05, 0.025);
    await page.waitForTimeout(400);

    // RESUME 버튼 클릭 (중앙 패널 상단 버튼)
    await clickCanvasAt(page, 0.5, 0.42);
    await page.waitForTimeout(400);

    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Gameplay');

    // TimeScale 복원 확인
    const timeScale = await queryState(page, 'Game.TimeScale');
    expect(timeScale).toBe('1');
  });

  test('TC-UI-012: RESTART 확인 팝업 동작', async ({ page }) => {
    // 브릿지로 점수 설정
    await sendMessage(page, 'TestBridge', 'SetScore', '500');

    // 일시정지 진입
    await clickCanvasAt(page, 0.05, 0.025);
    await page.waitForTimeout(400);

    // RESTART 버튼 클릭
    await clickCanvasAt(page, 0.5, 0.50);
    await page.waitForTimeout(300);

    // 확인 팝업 표시 확인
    await expect(page).toHaveScreenshot('restart-confirm-popup.png', {
      maxDiffPixelRatio: 0.05,
    });

    // 취소 클릭
    await clickCanvasAt(page, 0.4, 0.55);
    await page.waitForTimeout(300);

    // 일시정지 화면으로 복귀
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('Pause');

    // 점수 유지 확인
    const score = await queryState(page, 'HUD.CurrentScore');
    expect(score).toBe('500');
  });

  test('TC-UI-040: 화면 전환 중 입력 차단', async ({ page }) => {
    // 메인 메뉴로 복귀
    await clickCanvasAt(page, 0.05, 0.025);
    await page.waitForTimeout(400);

    // MAIN MENU 클릭 -> 확인 -> 전환 시작
    await clickCanvasAt(page, 0.5, 0.62);
    await page.waitForTimeout(200);
    await clickCanvasAt(page, 0.6, 0.55); // 확인 버튼

    // 전환 중 즉시 다른 버튼 클릭 시도
    await clickCanvasAt(page, 0.3, 0.7); // SHOP 위치
    await page.waitForTimeout(600);

    // 메인 메뉴에 정상 도착, 상점이 열리지 않음
    const screen = await getCurrentScreen(page);
    expect(screen).toBe('MainMenu');
  });
});
```

### 4.4 상점 구매 및 토스트 테스트

```typescript
// tests/ui-components/shop.spec.ts

import { test, expect } from '@playwright/test';
import {
  waitForUnityLoad,
  sendMessage,
  getCurrentScreen,
  clickCanvasAt,
  queryState,
  waitForConsoleMessage,
} from '../helpers/unity-bridge';

test.describe('상점 화면 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForUnityLoad(page);

    // 상점 진입 (메인 메뉴 하단 SHOP 버튼)
    await clickCanvasAt(page, 0.6, 0.77);
    await page.waitForTimeout(400);
    expect(await getCurrentScreen(page)).toBe('Shop');
  });

  test('TC-UI-024: 상점 초기 레이아웃', async ({ page }) => {
    await expect(page).toHaveScreenshot('shop-initial-layout.png', {
      maxDiffPixelRatio: 0.05,
    });

    // ITEMS 탭이 기본 활성인지 확인
    const activeTab = await queryState(page, 'Shop.CurrentTab');
    expect(activeTab).toBe('Items');
  });

  test('TC-UI-025: 카테고리 탭 전환', async ({ page }) => {
    // COINS 탭 클릭
    await clickCanvasAt(page, 0.4, 0.12);
    await page.waitForTimeout(300);

    let tab = await queryState(page, 'Shop.CurrentTab');
    expect(tab).toBe('Coins');
    await expect(page).toHaveScreenshot('shop-coins-tab.png');

    // NO ADS 탭 클릭
    await clickCanvasAt(page, 0.65, 0.12);
    await page.waitForTimeout(300);

    tab = await queryState(page, 'Shop.CurrentTab');
    expect(tab).toBe('NoAds');
    await expect(page).toHaveScreenshot('shop-noads-tab.png');
  });

  test('TC-UI-027: 젬으로 아이템 구매', async ({ page }) => {
    // 테스트 젬 지급
    await sendMessage(page, 'TestBridge', 'SetGems', '100');
    await page.waitForTimeout(200);

    const gemsBefore = await queryState(page, 'Currency.Gems');
    expect(gemsBefore).toBe('100');

    // 첫 번째 상품(Hint x3, 50젬)의 BUY 버튼 클릭
    await clickCanvasAt(page, 0.25, 0.55);
    await page.waitForTimeout(500);

    // 젬 차감 확인
    const gemsAfter = await queryState(page, 'Currency.Gems');
    expect(gemsAfter).toBe('50');

    // 힌트 수량 확인
    const hints = await queryState(page, 'Items.HintCount');
    expect(hints).toBe('3');

    // 토스트 메시지 확인 (콘솔 로그)
    const logPromise = waitForConsoleMessage(page, '구매 완료');
    await expect(logPromise).resolves.toBeTruthy();
  });
});
```

### 4.5 스크린샷 캡처 유틸리티

```typescript
// tests/helpers/screenshot-utils.ts

import { Page, expect } from '@playwright/test';

/** 특정 영역만 잘라서 스크린샷 비교 */
export async function compareRegion(
  page: Page,
  name: string,
  region: { x: number; y: number; width: number; height: number },
  maxDiffRatio = 0.05
): Promise<void> {
  const screenshot = await page.screenshot({ clip: region });
  expect(screenshot).toMatchSnapshot(`${name}.png`, {
    maxDiffPixelRatio: maxDiffRatio,
  });
}

/** 연속 스크린샷 캡처 (애니메이션 검증용) */
export async function captureSequence(
  page: Page,
  prefix: string,
  count: number,
  intervalMs: number
): Promise<Buffer[]> {
  const screenshots: Buffer[] = [];
  for (let i = 0; i < count; i++) {
    const buf = await page.screenshot();
    screenshots.push(buf);
    if (i < count - 1) await page.waitForTimeout(intervalMs);
  }
  return screenshots;
}

/** 두 스크린샷 간 픽셀 차이가 존재하는지 확인 (애니메이션 동작 검증) */
export function hasVisualDifference(bufA: Buffer, bufB: Buffer): boolean {
  if (bufA.length !== bufB.length) return true;
  for (let i = 0; i < bufA.length; i++) {
    if (bufA[i] !== bufB[i]) return true;
  }
  return false;
}
```

---

## 5. 테스트 데이터 및 자동화 전략

### 5.1 테스트 데이터

게임 상태를 제어하기 위해 Unity 빌드에 `TestBridge` 게임 오브젝트를 포함해야 한다. 다음의 브릿지 명령을 지원해야 한다.

| 브릿지 명령 | 파라미터 | 설명 |
|------------|---------|------|
| `SetScore` | `string score` | 현재 점수 강제 설정 |
| `SetBestScore` | `string score` | 최고 점수 강제 설정 |
| `SetGems` | `string count` | 보유 젬 강제 설정 |
| `SetHints` | `string count` | 보유 힌트 강제 설정 |
| `SetSaveData` | `string json` | 저장 데이터 직접 주입 |
| `ClearSaveData` | - | 모든 저장 데이터 초기화 |
| `SetBoardState` | `string json` | 보드 블록 배치 강제 설정 |
| `NavigateTo` | `string screenType` | 특정 화면으로 직접 이동 |
| `Query` | `string queryPath` | 게임 내부 상태 조회 |
| `TriggerToast` | `string message` | 토스트 메시지 강제 발생 |

**쿼리 경로 목록:**

| 경로 | 반환값 | 설명 |
|------|--------|------|
| `CurrentScreen` | `MainMenu\|Gameplay\|Pause\|Settings\|Leaderboard\|Shop` | 현재 활성 화면 |
| `HUD.CurrentScore` | 정수 문자열 | 현재 점수 |
| `HUD.BestScore` | 정수 문자열 | 최고 점수 |
| `MainMenu.PlayButton.Active` | `true\|false` | PLAY 버튼 활성 여부 |
| `MainMenu.ContinueButton.Active` | `true\|false` | CONTINUE 버튼 표시 여부 |
| `MainMenu.BestScoreText` | `Best: X,XXX` 형식 | 최고 점수 텍스트 |
| `Settings.BGMVolume` | 0~1 실수 문자열 | BGM 볼륨 |
| `Settings.SFXVolume` | 0~1 실수 문자열 | SFX 볼륨 |
| `Settings.MuteEnabled` | `true\|false` | 음소거 상태 |
| `Settings.VibrationEnabled` | `true\|false` | 진동 활성 여부 |
| `Settings.LanguageIndex` | 0=한국어, 1=English | 언어 인덱스 |
| `ResponsiveLayout.CurrentBreakpoint` | `Mobile\|Tablet\|Desktop` | 현재 브레이크포인트 |
| `ResponsiveLayout.SidebarVisible` | `true\|false` | 사이드바 표시 여부 |
| `Shop.CurrentTab` | `Items\|Coins\|NoAds` | 현재 상점 탭 |
| `Currency.Gems` | 정수 문자열 | 보유 젬 |
| `Items.HintCount` | 정수 문자열 | 보유 힌트 |
| `Game.TimeScale` | 실수 문자열 | 현재 TimeScale |
| `Leaderboard.CurrentTab` | `All\|Weekly\|Friends` | 현재 리더보드 탭 |

### 5.2 자동화 실행 전략

#### 실행 단계

```
1단계: 스모크 테스트 (우선순위 "높음" 15건)
   └─ TC-UI-001, 002, 006, 007, 009, 010, 011, 014, 019,
      021, 024, 027, 029, 032, 034, 040, 041

2단계: 기능 테스트 (우선순위 "중간" 18건)
   └─ TC-UI-003, 005, 008, 012, 013, 015, 016, 018, 020,
      022, 023, 025, 028, 030, 031, 033, 035, 036,
      037, 038, 042

3단계: 시각 품질 테스트 (우선순위 "낮음" 5건)
   └─ TC-UI-004, 017, 026, 039, 043
```

#### CI/CD 파이프라인 통합

```yaml
# .github/workflows/ui-test.yml (참고 예시)
name: UI Component Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  ui-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium

      - name: Start game server
        run: npx http-server ./Build/WebGL -p 8080 &
        env:
          GAME_URL: http://localhost:8080

      - name: Wait for server
        run: npx wait-on http://localhost:8080 --timeout 30000

      - name: Run smoke tests (높음 우선순위)
        run: npx playwright test --grep "@smoke"

      - name: Run full tests
        run: npx playwright test

      - name: Upload test report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

### 5.3 골든 이미지(기준 스크린샷) 관리

| 항목 | 전략 |
|------|------|
| **저장 위치** | `tests/ui-components/__screenshots__/` 디렉토리 |
| **갱신 정책** | UI 변경 커밋 시 `npx playwright test --update-snapshots`로 갱신 |
| **허용 오차** | 일반 레이아웃: 5%, 애니메이션 관련: 10% |
| **브라우저별 분리** | 프로젝트별로 별도 스냅샷 디렉토리 자동 생성 (`desktop-chrome/`, `mobile-portrait/` 등) |
| **버전 관리** | Git LFS로 스크린샷 파일 관리 |

### 5.4 테스트 태그 규칙

```typescript
// 테스트 태그 사용 예시
test('@smoke TC-UI-001: 메인 메뉴 초기 레이아웃', async ({ page }) => { ... });
test('@regression TC-UI-004: PLAY 펄스 애니메이션', async ({ page }) => { ... });
```

| 태그 | 대상 | 실행 시점 |
|------|------|---------|
| `@smoke` | 우선순위 높음 (15건) | 모든 PR, 매 커밋 |
| `@regression` | 우선순위 중간 (18건) | develop 머지, 릴리즈 전 |
| `@visual` | 시각 품질 검증 (5건) | 주 1회 또는 UI 변경 시 |
| `@responsive` | 반응형 관련 (5건) | UI 변경 시, 주 1회 |

### 5.5 알려진 제약사항 및 대응

| 제약사항 | 영향 | 대응 방안 |
|---------|------|---------|
| Unity WebGL 초기 로딩 시간 (10~30초) | 테스트 시작 지연 | `waitForUnityLoad()`에 30초 타임아웃, 사전 워밍업 |
| Canvas 내부 DOM 요소 없음 | CSS 셀렉터 사용 불가 | Unity 브릿지 + 좌표 기반 클릭 + 스크린샷 비교 |
| 프레임 단위 애니메이션 타이밍 불일치 | 스크린샷 비교 시 false positive | 높은 오차 허용(10%) + 상태 기반 검증 병행 |
| WebGL 폰트 렌더링 차이 | 브라우저별 스크린샷 차이 | 브라우저별 별도 골든 이미지 + TextMeshPro SDF 폰트 사용 |
| 모바일 터치 이벤트 시뮬레이션 한계 | 스와이프/드래그 정밀도 | `page.touchscreen.tap()` API 활용, 단순 탭 위주 검증 |

---

> **문서 끝**
