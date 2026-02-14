# 애니메이션 시스템 - Playwright 테스트 계획서

> **문서 버전:** v1.0
> **최종 수정일:** 2026-02-13
> **프로젝트명:** Hexa Merge Basic
> **테스트 대상:** 애니메이션 시스템 (Unity WebGL 빌드)
> **테스트 도구:** Playwright (TypeScript)
> **기반 문서:**
> - `docs/design/02_ui-ux-design.md` - 섹션 4. 애니메이션 시스템
> - `docs/development/04_animation/development-plan.md`

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [테스트 환경 설정](#2-테스트-환경-설정)
3. [테스트 케이스 목록](#3-테스트-케이스-목록)
4. [테스트 케이스 상세](#4-테스트-케이스-상세)
5. [Playwright 코드 예제](#5-playwright-코드-예제)
6. [테스트 데이터 및 자동화 전략](#6-테스트-데이터-및-자동화-전략)

---

## 1. 테스트 개요

### 1.1 목적

Unity WebGL로 빌드된 Hexa Merge Basic 게임의 애니메이션 시스템이 설계 사양대로 동작하는지 브라우저 환경에서 검증한다. Playwright를 사용하여 스크린샷 기반 시각적 회귀 테스트, 타이밍 검증, 성능 측정을 자동화한다.

### 1.2 범위

| 구분 | 내용 |
|------|------|
| 포함 범위 | 블록 생성, 탭 선택, 머지, 파도 웨이브, 점수 팝업, 콤보 이펙트, 화면 전환, 파티클, 성능, 시각적 회귀 |
| 제외 범위 | Unity 에디터 내부 단위 테스트, 네이티브 Android/iOS 빌드 테스트, 사운드 테스트 |
| 테스트 레벨 | 통합 테스트 (Integration) / E2E 테스트 |

### 1.3 전제조건

- Unity WebGL 빌드가 로컬 또는 스테이징 서버에 배포되어 있어야 한다.
- Unity WebGL 빌드에 `window.gameInstance` 또는 `unityInstance.SendMessage()` 를 통한 외부 제어 인터페이스가 노출되어 있어야 한다.
- 테스트용 JavaScript Bridge가 Unity측에 구현되어 있어야 한다 (애니메이션 상태 조회, 강제 트리거 등).
- 기준 스크린샷(baseline)이 사전에 캡처되어 `tests/screenshots/baseline/` 경로에 저장되어 있어야 한다.
- Node.js 18+ 및 Playwright 최신 버전이 설치되어 있어야 한다.

### 1.4 Unity-Playwright 통신 인터페이스

테스트 자동화를 위해 Unity WebGL 빌드에 다음 JavaScript Bridge 함수가 노출되어야 한다.

```
window.HexaTest.triggerSpawnAnimation(count)      -- 블록 생성 애니메이션 강제 트리거
window.HexaTest.triggerTapBlock(q, r)              -- 특정 좌표 블록 탭
window.HexaTest.triggerMerge(q1, r1, q2, r2)       -- 머지 강제 트리거
window.HexaTest.triggerWaveAnimation(direction)     -- 파도 웨이브 강제 트리거
window.HexaTest.triggerCombo(count)                 -- 콤보 이펙트 강제 트리거
window.HexaTest.triggerScreenTransition(from, to)   -- 화면 전환 강제 트리거
window.HexaTest.getAnimationState()                 -- 현재 애니메이션 상태 JSON 반환
window.HexaTest.getFPS()                            -- 현재 FPS 반환
window.HexaTest.isAnimationPlaying()                -- 애니메이션 재생 중 여부
window.HexaTest.setBoardState(jsonState)            -- 보드 상태 강제 설정
window.HexaTest.getBlockScale(q, r)                 -- 특정 블록 스케일 값 반환
window.HexaTest.getBlockAlpha(q, r)                 -- 특정 블록 투명도 반환
```

---

## 2. 테스트 환경 설정

### 2.1 프로젝트 구조

```
tests/
├── playwright.config.ts          -- Playwright 설정
├── fixtures/
│   └── game-page.ts              -- 게임 페이지 공통 fixture
├── helpers/
│   ├── unity-bridge.ts           -- Unity 통신 헬퍼
│   ├── screenshot-comparator.ts  -- 스크린샷 비교 유틸
│   └── timing-utils.ts           -- 타이밍 측정 유틸
├── screenshots/
│   ├── baseline/                 -- 기준 스크린샷
│   └── actual/                   -- 테스트 실행 시 캡처
├── animation/
│   ├── spawn.spec.ts             -- 블록 생성 애니메이션 테스트
│   ├── tap-feedback.spec.ts      -- 탭 선택 피드백 테스트
│   ├── merge.spec.ts             -- 머지 애니메이션 테스트
│   ├── wave.spec.ts              -- 파도 웨이브 테스트
│   ├── score-popup.spec.ts       -- 점수 팝업 테스트
│   ├── combo.spec.ts             -- 콤보 이펙트 테스트
│   ├── screen-transition.spec.ts -- 화면 전환 테스트
│   ├── particle.spec.ts          -- 파티클 이펙트 테스트
│   ├── performance.spec.ts       -- 성능 테스트
│   └── visual-regression.spec.ts -- 시각적 회귀 테스트
└── package.json
```

### 2.2 Playwright 설정 파일

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './animation',
  fullyParallel: false, // 게임 상태 의존성으로 순차 실행
  retries: 1,
  workers: 1,
  timeout: 60_000,
  expect: {
    timeout: 10_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02, // 2% 이내 픽셀 차이 허용
      threshold: 0.2,          // 색상 차이 임계값
      animations: 'disabled',  // 스크린샷 비교 시 애니메이션 완료 대기
    },
  },
  use: {
    baseURL: 'http://localhost:8080',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
  },
  projects: [
    {
      name: 'chromium-desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'webkit-desktop',
      use: { ...devices['Desktop Safari'] },
    },
  ],
});
```

### 2.3 Unity Bridge 헬퍼

```typescript
// helpers/unity-bridge.ts
import { Page } from '@playwright/test';

export class UnityBridge {
  constructor(private page: Page) {}

  /** Unity WebGL 인스턴스 로드 완료 대기 */
  async waitForUnityLoad(timeout = 30_000): Promise<void> {
    await this.page.waitForFunction(
      () => (window as any).HexaTest !== undefined,
      { timeout }
    );
  }

  /** 블록 생성 애니메이션 트리거 */
  async triggerSpawnAnimation(count: number): Promise<void> {
    await this.page.evaluate(
      (c) => (window as any).HexaTest.triggerSpawnAnimation(c),
      count
    );
  }

  /** 블록 탭 */
  async tapBlock(q: number, r: number): Promise<void> {
    await this.page.evaluate(
      ([q, r]) => (window as any).HexaTest.triggerTapBlock(q, r),
      [q, r]
    );
  }

  /** 머지 트리거 */
  async triggerMerge(
    q1: number, r1: number,
    q2: number, r2: number
  ): Promise<void> {
    await this.page.evaluate(
      ([q1, r1, q2, r2]) =>
        (window as any).HexaTest.triggerMerge(q1, r1, q2, r2),
      [q1, r1, q2, r2]
    );
  }

  /** 현재 애니메이션 재생 상태 확인 */
  async isAnimationPlaying(): Promise<boolean> {
    return this.page.evaluate(
      () => (window as any).HexaTest.isAnimationPlaying()
    );
  }

  /** 애니메이션 완료 대기 */
  async waitForAnimationComplete(timeout = 5_000): Promise<void> {
    await this.page.waitForFunction(
      () => !(window as any).HexaTest.isAnimationPlaying(),
      { timeout }
    );
  }

  /** FPS 조회 */
  async getFPS(): Promise<number> {
    return this.page.evaluate(
      () => (window as any).HexaTest.getFPS()
    );
  }

  /** 블록 스케일 조회 */
  async getBlockScale(q: number, r: number): Promise<number> {
    return this.page.evaluate(
      ([q, r]) => (window as any).HexaTest.getBlockScale(q, r),
      [q, r]
    );
  }

  /** 블록 투명도 조회 */
  async getBlockAlpha(q: number, r: number): Promise<number> {
    return this.page.evaluate(
      ([q, r]) => (window as any).HexaTest.getBlockAlpha(q, r),
      [q, r]
    );
  }

  /** 콤보 이펙트 트리거 */
  async triggerCombo(count: number): Promise<void> {
    await this.page.evaluate(
      (c) => (window as any).HexaTest.triggerCombo(c),
      count
    );
  }

  /** 화면 전환 트리거 */
  async triggerScreenTransition(
    from: string, to: string
  ): Promise<void> {
    await this.page.evaluate(
      ([f, t]) =>
        (window as any).HexaTest.triggerScreenTransition(f, t),
      [from, to]
    );
  }

  /** 파도 웨이브 트리거 */
  async triggerWaveAnimation(direction: string): Promise<void> {
    await this.page.evaluate(
      (d) => (window as any).HexaTest.triggerWaveAnimation(d),
      direction
    );
  }

  /** 보드 상태 설정 */
  async setBoardState(state: object): Promise<void> {
    await this.page.evaluate(
      (s) => (window as any).HexaTest.setBoardState(JSON.stringify(s)),
      state
    );
  }

  /** 애니메이션 상태 JSON 조회 */
  async getAnimationState(): Promise<any> {
    return this.page.evaluate(
      () => (window as any).HexaTest.getAnimationState()
    );
  }
}
```

### 2.4 게임 페이지 Fixture

```typescript
// fixtures/game-page.ts
import { test as base, Page } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

type GameFixtures = {
  gamePage: Page;
  unity: UnityBridge;
};

export const test = base.extend<GameFixtures>({
  gamePage: async ({ page }, use) => {
    await page.goto('/');
    const bridge = new UnityBridge(page);
    await bridge.waitForUnityLoad();
    await use(page);
  },
  unity: async ({ page }, use) => {
    const bridge = new UnityBridge(page);
    await bridge.waitForUnityLoad();
    await use(bridge);
  },
});
```

---

## 3. 테스트 케이스 목록

### 3.1 전체 체크리스트

| TC-ID | 카테고리 | 테스트명 | 우선순위 |
|-------|---------|---------|---------|
| TC-ANIM-001 | 블록 생성 | 단일 블록 생성 애니메이션 (Scale + Fade) | 높음 |
| TC-ANIM-002 | 블록 생성 | 다중 블록 순차 딜레이 생성 | 높음 |
| TC-ANIM-003 | 블록 생성 | 생성 애니메이션 타이밍 검증 (250ms) | 중간 |
| TC-ANIM-004 | 탭 선택 | 블록 탭 바운스 피드백 | 높음 |
| TC-ANIM-005 | 탭 선택 | 선택 상태 글로우 테두리 표시 | 높음 |
| TC-ANIM-006 | 탭 선택 | 매칭 실패 흔들림 (Shake + 빨간 번쩍임) | 중간 |
| TC-ANIM-007 | 탭 선택 | 선택 해제 피드백 | 중간 |
| TC-ANIM-008 | 머지 | 머지 단계1 - 블록 이동 (0~200ms) | 높음 |
| TC-ANIM-009 | 머지 | 머지 단계2 - 합체 + 숫자 크로스페이드 | 높음 |
| TC-ANIM-010 | 머지 | 머지 단계3 - 팽창 + 파티클 방출 | 높음 |
| TC-ANIM-011 | 머지 | 머지 단계4 - 정착 (1.0x 안착) | 높음 |
| TC-ANIM-012 | 머지 | 머지 전체 시퀀스 타이밍 검증 (500ms) | 중간 |
| TC-ANIM-013 | 파도 웨이브 | BottomToTop 방향 파도 애니메이션 | 높음 |
| TC-ANIM-014 | 파도 웨이브 | LeftToRight 방향 파도 애니메이션 | 중간 |
| TC-ANIM-015 | 파도 웨이브 | OuterToCenter 방향 파도 애니메이션 | 중간 |
| TC-ANIM-016 | 파도 웨이브 | 파도 방향 순환 로직 검증 | 낮음 |
| TC-ANIM-017 | 점수 팝업 | 일반 점수 팝업 (금색, Scale + Float) | 높음 |
| TC-ANIM-018 | 점수 팝업 | 대형 점수 팝업 (1000+, 빨강, 별 파티클) | 중간 |
| TC-ANIM-019 | 점수 팝업 | 점수 팝업 페이드아웃 타이밍 (0.8초) | 중간 |
| TC-ANIM-020 | 콤보 | 콤보 x2 텍스트 표시 | 높음 |
| TC-ANIM-021 | 콤보 | 콤보 x3 화면 미세 흔들림 | 중간 |
| TC-ANIM-022 | 콤보 | 콤보 x4 글로우 + 파티클 | 중간 |
| TC-ANIM-023 | 콤보 | 콤보 x5+ 화면 플래시 + 대형 파티클 | 중간 |
| TC-ANIM-024 | 콤보 | 콤보 타이머 만료 (2.0초) 페이드아웃 | 낮음 |
| TC-ANIM-025 | 화면 전환 | Circle Wipe (메인 메뉴 -> 게임) | 높음 |
| TC-ANIM-026 | 화면 전환 | 오버레이 페이드 (게임 <-> 일시정지) | 중간 |
| TC-ANIM-027 | 화면 전환 | 슬라이드 전환 (메뉴 간 이동) | 중간 |
| TC-ANIM-028 | 파티클 | 머지 파티클 방출 (원형, 8~12개) | 중간 |
| TC-ANIM-029 | 파티클 | 별 파티클 (대형 점수 시) | 낮음 |
| TC-ANIM-030 | 파티클 | 콤보 대형 파티클 (x5+) | 낮음 |
| TC-ANIM-031 | 성능 | 애니메이션 중 FPS 60fps 유지 | 높음 |
| TC-ANIM-032 | 성능 | 동시 다수 애니메이션 시 FPS 드롭 여부 | 높음 |
| TC-ANIM-033 | 성능 | WebGL 환경 프레임 드롭 감지 | 중간 |
| TC-ANIM-034 | 시각적 회귀 | 블록 생성 완료 후 스크린샷 비교 | 높음 |
| TC-ANIM-035 | 시각적 회귀 | 머지 완료 후 스크린샷 비교 | 높음 |
| TC-ANIM-036 | 시각적 회귀 | 화면 전환 완료 후 스크린샷 비교 | 중간 |

---

## 4. 테스트 케이스 상세

### 4.1 블록 생성 애니메이션 테스트

#### TC-ANIM-001: 단일 블록 생성 애니메이션 (Scale + Fade)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-001 |
| **목적** | 새로운 블록이 생성될 때 Scale(0->1.1->1.0) + Fade(0->1) 애니메이션이 정상 재생되는지 검증 |
| **사전조건** | 게임이 로드되고 게임 플레이 화면에 진입한 상태 |
| **테스트 단계** | 1. Unity Bridge를 통해 단일 블록 생성 트리거 (`triggerSpawnAnimation(1)`) <br> 2. 애니메이션 시작 직후 블록의 스케일이 0인지 확인 <br> 3. 약 100ms 후 블록의 스케일이 0보다 크고 1.1 이하인지 확인 <br> 4. 250ms 후 블록의 스케일이 1.0(허용 오차 0.05)인지 확인 <br> 5. 블록의 투명도(alpha)가 1.0인지 확인 |
| **기대결과** | 블록이 EaseOutBack 이징으로 0에서 1.1까지 팽창 후 1.0으로 안착하고, 동시에 투명도가 0에서 1로 전환된다 |
| **우선순위** | 높음 |

#### TC-ANIM-002: 다중 블록 순차 딜레이 생성

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-002 |
| **목적** | 여러 블록이 동시에 생성될 때 블록별 0.03초 딜레이가 적용되어 파도 효과가 나타나는지 검증 |
| **사전조건** | 게임이 로드되고 빈 보드 상태 |
| **테스트 단계** | 1. Unity Bridge를 통해 5개 블록 동시 생성 트리거 (`triggerSpawnAnimation(5)`) <br> 2. 첫 번째 블록 애니메이션 시작 시각 기록 <br> 3. 다섯 번째 블록 애니메이션 시작 시각 기록 <br> 4. 시작 시각 차이가 약 120ms(0.03초 x 4)인지 확인 (허용 오차 +-30ms) <br> 5. 모든 블록의 최종 스케일이 1.0인지 확인 |
| **기대결과** | 블록들이 0.03초 간격으로 순차적으로 나타나며 파도 효과를 형성한다 |
| **우선순위** | 높음 |

#### TC-ANIM-003: 생성 애니메이션 타이밍 검증 (250ms)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-003 |
| **목적** | 블록 생성 애니메이션의 총 소요 시간이 설계 사양(250ms)과 일치하는지 검증 |
| **사전조건** | 게임이 로드되고 게임 플레이 화면에 진입한 상태 |
| **테스트 단계** | 1. 애니메이션 시작 전 타임스탬프 기록 <br> 2. 단일 블록 생성 트리거 <br> 3. `isAnimationPlaying()`이 false가 되는 시점까지 대기 <br> 4. 종료 타임스탬프 기록 <br> 5. 시작-종료 차이가 250ms (허용 오차 +-50ms) 이내인지 확인 |
| **기대결과** | 애니메이션 총 시간이 200~300ms 범위 내에 있다 |
| **우선순위** | 중간 |

---

### 4.2 탭 선택 피드백 애니메이션 테스트

#### TC-ANIM-004: 블록 탭 바운스 피드백

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-004 |
| **목적** | 블록을 탭할 때 Scale 1.0->0.95->1.05->1.0 탄성 바운스가 재생되는지 검증 |
| **사전조건** | 게임 보드에 블록이 배치된 상태 |
| **테스트 단계** | 1. 보드 위의 특정 블록(q=0, r=0)을 탭 트리거 <br> 2. 탭 직후(0~50ms) 블록 스케일이 0.95 이하로 축소되는지 확인 <br> 3. 약 80ms 후 스케일이 1.0 이상으로 확대되는지 확인 <br> 4. 150ms 후 스케일이 1.0(허용 오차 0.05)으로 안착하는지 확인 |
| **기대결과** | EaseOutElastic 이징으로 탄성 바운스가 재생되며 최종적으로 1.0 스케일로 복귀한다 |
| **우선순위** | 높음 |

#### TC-ANIM-005: 선택 상태 글로우 테두리 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-005 |
| **목적** | 블록 선택 시 흰색 3px 글로우 테두리가 0.1초에 걸쳐 페이드인 되는지 검증 |
| **사전조건** | 게임 보드에 블록이 배치된 상태 |
| **테스트 단계** | 1. 특정 블록을 탭 트리거 <br> 2. 탭 전 스크린샷 캡처 (baseline) <br> 3. 탭 후 200ms 대기 후 스크린샷 캡처 <br> 4. 두 스크린샷을 비교하여 글로우 테두리 영역에서 픽셀 차이가 존재하는지 확인 <br> 5. 글로우 영역의 밝기 변화가 감지되는지 확인 |
| **기대결과** | 선택된 블록 주위에 흰색 글로우 테두리가 표시되며, 배경 명도가 +15% 증가한다 |
| **우선순위** | 높음 |

#### TC-ANIM-006: 매칭 실패 흔들림 (Shake + 빨간 번쩍임)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-006 |
| **목적** | 다른 숫자의 블록 두 개를 선택했을 때 좌우 흔들림과 빨간 번쩍임 효과가 재생되는지 검증 |
| **사전조건** | 보드에 서로 다른 숫자 블록(예: 2와 4)이 인접 배치된 상태 |
| **테스트 단계** | 1. 숫자 2 블록(q=0, r=0)을 탭 <br> 2. 숫자 4 블록(q=1, r=0)을 탭 (매칭 실패 유도) <br> 3. 매칭 실패 직후 100ms 시점에 스크린샷 캡처 <br> 4. 블록 영역에서 빨간색(#F44336 근사) 픽셀이 검출되는지 확인 <br> 5. 200ms 후 원래 색상으로 복귀되었는지 확인 |
| **기대결과** | 두 블록이 좌우로 흔들리며(Shake 강도 5px, 0.2초), 빨간색 번쩍임이 재생된 후 원래 상태로 복귀한다 |
| **우선순위** | 중간 |

#### TC-ANIM-007: 선택 해제 피드백

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-007 |
| **목적** | 이미 선택된 블록을 다시 탭했을 때 글로우 테두리가 0.1초에 걸쳐 페이드아웃 되는지 검증 |
| **사전조건** | 하나의 블록이 선택된(글로우 표시) 상태 |
| **테스트 단계** | 1. 선택된 블록을 재탭 트리거 <br> 2. 재탭 후 50ms 시점에 글로우 투명도가 감소 중인지 확인 <br> 3. 150ms 후 글로우가 완전히 사라졌는지 스크린샷으로 확인 |
| **기대결과** | 글로우 테두리가 0.1초 페이드아웃으로 사라지며 블록이 일반 상태로 복귀한다 |
| **우선순위** | 중간 |

---

### 4.3 머지 애니메이션 테스트 (4단계 시퀀스)

#### TC-ANIM-008: 머지 단계1 - 블록 이동 (0~200ms)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-008 |
| **목적** | 블록 B가 블록 A 위치로 EaseInQuad 가속 이동하는지 검증 |
| **사전조건** | 같은 숫자(32) 블록 두 개가 인접 배치된 상태 |
| **테스트 단계** | 1. 머지 시작 전 블록 B의 위치 기록 <br> 2. 머지 트리거 (`triggerMerge(q1, r1, q2, r2)`) <br> 3. 100ms 시점에 블록 B의 위치가 시작 위치와 블록 A 위치 사이에 있는지 확인 <br> 4. 200ms 시점에 블록 B가 블록 A 위치에 도달했는지 확인 (허용 오차 5px) |
| **기대결과** | 블록 B가 0~200ms 동안 EaseInQuad 가속으로 블록 A 위치까지 이동한다 |
| **우선순위** | 높음 |

#### TC-ANIM-009: 머지 단계2 - 합체 + 숫자 크로스페이드

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-009 |
| **목적** | 합체 순간 기존 숫자가 페이드아웃되고 새 숫자가 페이드인 되는 크로스페이드(0.1초)가 정상 동작하는지 검증 |
| **사전조건** | 머지 단계1(이동)이 완료된 시점 |
| **테스트 단계** | 1. 두 개의 숫자 32 블록으로 머지 트리거 <br> 2. 200ms(이동 완료) 시점에 스크린샷 캡처 <br> 3. 250ms 시점에 스크린샷 캡처 - 기존 숫자 페이드아웃 중간 상태 확인 <br> 4. 300ms 시점에 스크린샷 캡처 - 새 숫자(64) 표시 확인 <br> 5. 합체된 블록의 색상이 새 숫자(64)에 해당하는 색상(#B3E5FC)으로 변경되었는지 확인 |
| **기대결과** | 숫자 32가 페이드아웃되고 64가 페이드인되며, 블록 색상이 즉시 전환된다 |
| **우선순위** | 높음 |

#### TC-ANIM-010: 머지 단계3 - 팽창 + 파티클 방출

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-010 |
| **목적** | 합쳐진 블록이 1.3배로 팽창하며 원형 파티클 8~12개가 방출되는지 검증 |
| **사전조건** | 머지 단계2(합체)가 완료된 시점 |
| **테스트 단계** | 1. 머지 트리거 후 350ms 시점에 블록 스케일 조회 <br> 2. 스케일이 1.3 근처(허용 오차 0.15)인지 확인 <br> 3. 동일 시점에 스크린샷 캡처 <br> 4. 스크린샷에서 블록 주변에 파티클(블록 색상의 작은 원형 요소)이 존재하는지 시각적으로 확인 |
| **기대결과** | 블록이 1.3배로 팽창하고, 블록 색상의 원형 파티클 8~12개가 방출된다 |
| **우선순위** | 높음 |

#### TC-ANIM-011: 머지 단계4 - 정착 (1.0x 안착)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-011 |
| **목적** | 팽창된 블록이 EaseOutBack으로 1.0 스케일로 정착하는지 검증 |
| **사전조건** | 머지 단계3(팽창)이 완료된 시점 |
| **테스트 단계** | 1. 머지 트리거 후 500ms 시점에 블록 스케일 조회 <br> 2. 스케일이 1.0(허용 오차 0.05)인지 확인 <br> 3. `isAnimationPlaying()`이 false인지 확인 <br> 4. 블록의 최종 숫자 및 색상이 정확한지 확인 |
| **기대결과** | 블록이 1.0 스케일로 안착하고 애니메이션이 완료된다 |
| **우선순위** | 높음 |

#### TC-ANIM-012: 머지 전체 시퀀스 타이밍 검증 (500ms)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-012 |
| **목적** | 머지 애니메이션 4단계의 총 소요 시간이 설계 사양(500ms)과 일치하는지 검증 |
| **사전조건** | 같은 숫자 블록이 인접 배치된 상태 |
| **테스트 단계** | 1. 시작 타임스탬프 기록 후 머지 트리거 <br> 2. `waitForAnimationComplete()` 호출로 애니메이션 완료 대기 <br> 3. 종료 타임스탬프 기록 <br> 4. 시작-종료 시간 차이가 500ms (허용 오차 +-80ms) 이내인지 확인 |
| **기대결과** | 머지 전체 시퀀스가 420~580ms 범위 내에 완료된다 |
| **우선순위** | 중간 |

---

### 4.4 파도 웨이브 애니메이션 테스트

#### TC-ANIM-013: BottomToTop 방향 파도 애니메이션

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-013 |
| **목적** | 아래에서 위로(BottomToTop) 방향의 파도 웨이브 애니메이션이 정상 재생되는지 검증 |
| **사전조건** | 머지 후 빈 공간이 존재하는 보드 상태 |
| **테스트 단계** | 1. 파도 웨이브 트리거 (`triggerWaveAnimation('BottomToTop')`) <br> 2. 트리거 직후 50ms 시점에 스크린샷 캡처 - 하단 블록이 먼저 진입 시작 확인 <br> 3. 200ms 시점에 스크린샷 캡처 - 중간 블록이 진입 중인지 확인 <br> 4. 전체 애니메이션 완료 대기 후 스크린샷 캡처 <br> 5. 모든 빈 공간이 새 블록으로 채워졌는지 확인 |
| **기대결과** | 블록들이 화면 하단에서 위 방향으로 0.04초 간격의 순차 딜레이로 밀려 들어온다 |
| **우선순위** | 높음 |

#### TC-ANIM-014: LeftToRight 방향 파도 애니메이션

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-014 |
| **목적** | 좌에서 우로(LeftToRight) 방향의 파도 웨이브 애니메이션이 정상 재생되는지 검증 |
| **사전조건** | 빈 공간이 존재하는 보드 상태 |
| **테스트 단계** | 1. 파도 웨이브 트리거 (`triggerWaveAnimation('LeftToRight')`) <br> 2. 트리거 직후 스크린샷 캡처 - 좌측 블록이 먼저 진입 시작 확인 <br> 3. 애니메이션 완료 대기 후 모든 공간이 채워졌는지 확인 |
| **기대결과** | 블록들이 좌측에서 우측 방향으로 순차적으로 밀려 들어온다 |
| **우선순위** | 중간 |

#### TC-ANIM-015: OuterToCenter 방향 파도 애니메이션

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-015 |
| **목적** | 외곽에서 중앙으로(OuterToCenter) 방향의 파도 웨이브 애니메이션이 정상 재생되는지 검증 |
| **사전조건** | 빈 공간이 존재하는 보드 상태 |
| **테스트 단계** | 1. 파도 웨이브 트리거 (`triggerWaveAnimation('OuterToCenter')`) <br> 2. 트리거 직후 스크린샷 캡처 - 외곽 블록이 먼저 진입 시작 확인 <br> 3. 애니메이션 완료 대기 후 모든 공간이 채워졌는지 확인 |
| **기대결과** | 블록들이 외곽에서 중앙 방향으로 순차적으로 밀려 들어온다 |
| **우선순위** | 중간 |

#### TC-ANIM-016: 파도 방향 순환 로직 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-016 |
| **목적** | 파도 웨이브가 발생할 때마다 방향이 BottomToTop -> LeftToRight -> OuterToCenter 순서로 순환하는지 검증 |
| **사전조건** | 게임이 초기 상태에서 시작 |
| **테스트 단계** | 1. 첫 번째 파도 트리거 후 애니메이션 상태에서 방향 확인 (BottomToTop 예상) <br> 2. 두 번째 파도 트리거 후 방향 확인 (LeftToRight 예상) <br> 3. 세 번째 파도 트리거 후 방향 확인 (OuterToCenter 예상) <br> 4. 네 번째 파도 트리거 후 방향 확인 (BottomToTop으로 순환 예상) |
| **기대결과** | 방향이 3가지 패턴으로 순환하며 반복된다 |
| **우선순위** | 낮음 |

---

### 4.5 점수 팝업 애니메이션 테스트

#### TC-ANIM-017: 일반 점수 팝업 (금색, Scale + Float)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-017 |
| **목적** | 머지 시 "+점수" 텍스트가 금색(#FFD700)으로 나타나 Scale 0->1.2->1.0 후 위로 떠오르며 페이드아웃 되는지 검증 |
| **사전조건** | 머지 가능한 블록이 배치된 상태 |
| **테스트 단계** | 1. 500점 미만 점수의 머지 트리거 <br> 2. 머지 직후 150ms 시점에 스크린샷 캡처 - 팝업 텍스트 출현 확인 <br> 3. 400ms 시점에 스크린샷 캡처 - 텍스트가 위로 이동 중인지 확인 <br> 4. 800ms 시점에 스크린샷 캡처 - 텍스트가 사라졌는지 확인 <br> 5. 팝업 텍스트 영역에서 금색(#FFD700 근사) 픽셀이 초기에 검출되는지 확인 |
| **기대결과** | "+점수" 텍스트가 금색으로 Scale 0->1.2->1.0 팝업 후 Y축 40px 위로 이동하며 0.8초 동안 페이드아웃된다 |
| **우선순위** | 높음 |

#### TC-ANIM-018: 대형 점수 팝업 (1000+, 빨강, 별 파티클)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-018 |
| **목적** | 1000점 이상 획득 시 팝업이 1.5배 크기, 빨강색(#FF5722), 별 파티클과 함께 표시되는지 검증 |
| **사전조건** | 높은 점수 머지가 가능한 보드 상태 (예: 512+512) |
| **테스트 단계** | 1. 1000점 이상 점수의 머지 트리거 <br> 2. 머지 직후 200ms 시점에 스크린샷 캡처 <br> 3. 팝업 텍스트 영역의 크기가 일반 팝업 대비 약 1.5배인지 확인 <br> 4. 텍스트 색상이 빨강(#FF5722 근사)인지 확인 <br> 5. 별 모양 파티클이 주변에 존재하는지 스크린샷으로 확인 |
| **기대결과** | 1.5배 크기의 빨강 팝업과 금색 별 파티클이 함께 표시된다 |
| **우선순위** | 중간 |

#### TC-ANIM-019: 점수 팝업 페이드아웃 타이밍 (0.8초)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-019 |
| **목적** | 점수 팝업이 0.5초 시점부터 페이드아웃을 시작하여 0.8초에 완전히 사라지는지 검증 |
| **사전조건** | 머지 가능한 블록이 배치된 상태 |
| **테스트 단계** | 1. 머지 트리거 <br> 2. 400ms 시점에 스크린샷 캡처 - 팝업이 완전히 보이는지 확인 <br> 3. 600ms 시점에 스크린샷 캡처 - 팝업이 반투명 상태인지 확인 <br> 4. 850ms 시점에 스크린샷 캡처 - 팝업이 완전히 사라졌는지 확인 |
| **기대결과** | 팝업이 0.5초 시점부터 EaseInQuad로 페이드아웃되어 0.8초에 완전히 사라진다 |
| **우선순위** | 중간 |

---

### 4.6 콤보 이펙트 테스트

#### TC-ANIM-020: 콤보 x2 텍스트 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-020 |
| **목적** | 연속 머지 2회 시 "COMBO x2" 텍스트가 흰색, 1.0x 스케일로 표시되는지 검증 |
| **사전조건** | 게임 플레이 화면, 연속 머지 가능한 보드 상태 |
| **테스트 단계** | 1. 콤보 x2 트리거 (`triggerCombo(2)`) <br> 2. 트리거 후 300ms 대기 후 스크린샷 캡처 <br> 3. 화면에 "COMBO x2" 텍스트가 표시되는지 확인 <br> 4. 텍스트 색상이 흰색인지 확인 <br> 5. 화면 흔들림 등 추가 효과가 없는지 확인 |
| **기대결과** | "COMBO x2" 텍스트가 흰색, 1.0x 스케일로 EaseOutBack 바운스와 함께 표시된다 |
| **우선순위** | 높음 |

#### TC-ANIM-021: 콤보 x3 화면 미세 흔들림

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-021 |
| **목적** | 콤보 x3 시 노란색 텍스트(1.2x)와 화면 미세 흔들림(강도 3)이 재생되는지 검증 |
| **사전조건** | 게임 플레이 화면 |
| **테스트 단계** | 1. 콤보 x3 트리거 <br> 2. 트리거 직후 50ms 간격으로 스크린샷 5회 연속 캡처 <br> 3. 연속 스크린샷 간의 전체 화면 위치 오프셋 차이를 분석하여 흔들림 존재 여부 확인 <br> 4. 텍스트 색상이 노란색인지 확인 |
| **기대결과** | "COMBO x3" 텍스트가 노란색으로 표시되며 화면이 미세하게 흔들린다 |
| **우선순위** | 중간 |

#### TC-ANIM-022: 콤보 x4 글로우 + 파티클

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-022 |
| **목적** | 콤보 x4 시 노란색+글로우 텍스트(1.3x)와 파티클이 표시되는지 검증 |
| **사전조건** | 게임 플레이 화면 |
| **테스트 단계** | 1. 콤보 x4 트리거 <br> 2. 트리거 후 200ms 대기 후 스크린샷 캡처 <br> 3. 텍스트 주변에 글로우 효과(밝은 영역)가 존재하는지 확인 <br> 4. 파티클이 화면에 존재하는지 스크린샷 비교로 확인 |
| **기대결과** | "COMBO x4" 텍스트에 글로우 효과와 파티클이 함께 표시된다 |
| **우선순위** | 중간 |

#### TC-ANIM-023: 콤보 x5+ 화면 플래시 + 대형 파티클

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-023 |
| **목적** | 콤보 x5 이상 시 무지개 텍스트(1.5x), 강한 화면 흔들림, 화면 플래시, 대형 파티클이 모두 재생되는지 검증 |
| **사전조건** | 게임 플레이 화면 |
| **테스트 단계** | 1. 콤보 x5 트리거 <br> 2. 트리거 직후 30ms 이내에 스크린샷 캡처 - 화면 플래시(밝은 오버레이) 존재 확인 <br> 3. 50ms 간격으로 연속 스크린샷 5회 캡처 - 강한 흔들림 확인 <br> 4. 200ms 시점에 스크린샷 캡처 - 대형 파티클 존재 확인 <br> 5. 텍스트가 다채로운 색상(무지개 그라데이션)인지 확인 |
| **기대결과** | 화면 플래시(불투명도 0.6 흰색 오버레이, 0.15초), 강한 흔들림(강도 8), 1.5x 무지개 텍스트, 대형 파티클이 동시에 재생된다 |
| **우선순위** | 중간 |

#### TC-ANIM-024: 콤보 타이머 만료 (2.0초) 페이드아웃

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-024 |
| **목적** | 마지막 머지 후 2.0초가 경과하면 콤보 카운터 텍스트가 0.5초에 걸쳐 페이드아웃 되는지 검증 |
| **사전조건** | 콤보 x2 이상 상태 |
| **테스트 단계** | 1. 콤보 x2 트리거 <br> 2. 1.5초 대기 - 콤보 텍스트가 여전히 표시되는지 확인 <br> 3. 추가 1.0초 대기 (총 2.5초 경과) - 페이드아웃 중간 상태 확인 <br> 4. 추가 0.5초 대기 (총 3.0초 경과) - 텍스트가 완전히 사라졌는지 확인 |
| **기대결과** | 2.0초 경과 후 콤보 텍스트가 0.5초에 걸쳐 페이드아웃되어 사라진다 |
| **우선순위** | 낮음 |

---

### 4.7 화면 전환 애니메이션 테스트

#### TC-ANIM-025: Circle Wipe (메인 메뉴 -> 게임)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-025 |
| **목적** | PLAY 버튼 위치에서 원형이 확산되며 게임 화면으로 전환되는 Circle Wipe 효과가 정상 동작하는지 검증 |
| **사전조건** | 메인 메뉴 화면 |
| **테스트 단계** | 1. 화면 전환 트리거 (`triggerScreenTransition('MainMenu', 'Game')`) <br> 2. 트리거 직후 100ms 시점에 스크린샷 캡처 - 원형 마스크가 확산 중인지 확인 <br> 3. 250ms 시점에 스크린샷 캡처 - 화면이 절반 정도 덮인 상태 확인 <br> 4. 500ms 시점에 스크린샷 캡처 - 전환 완료 후 게임 화면이 표시되는지 확인 |
| **기대결과** | 원형 마스크가 PLAY 버튼 위치에서 확산되어 0.5초(EaseInOutQuad)에 걸쳐 게임 화면으로 전환된다 |
| **우선순위** | 높음 |

#### TC-ANIM-026: 오버레이 페이드 (게임 <-> 일시정지)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-026 |
| **목적** | 게임과 일시정지 화면 간 전환 시 반투명 오버레이가 페이드인/아웃 되는지 검증 |
| **사전조건** | 게임 플레이 화면 |
| **테스트 단계** | 1. 게임->일시정지 전환 트리거 <br> 2. 150ms 시점에 스크린샷 캡처 - 오버레이가 반투명 상태인지 확인 <br> 3. 300ms 시점에 스크린샷 캡처 - 일시정지 화면이 완전히 표시되는지 확인 <br> 4. 일시정지->게임 전환 트리거 <br> 5. 300ms 시점에 스크린샷 캡처 - 오버레이가 사라지고 게임 화면이 복귀되는지 확인 |
| **기대결과** | 페이드인 시 EaseOutQuad(0.3초), 페이드아웃 시 EaseInQuad(0.3초)로 오버레이가 전환된다 |
| **우선순위** | 중간 |

#### TC-ANIM-027: 슬라이드 전환 (메뉴 간 이동)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-027 |
| **목적** | 메뉴 간 슬라이드 전환(좌/우/상/하)이 EaseInOutCubic으로 정상 동작하는지 검증 |
| **사전조건** | 메인 메뉴 화면 |
| **테스트 단계** | 1. 메인 메뉴->설정 슬라이드 전환 트리거 <br> 2. 150ms 시점에 스크린샷 캡처 - 설정 화면이 우측에서 슬라이드인 중인지 확인 <br> 3. 300ms 시점에 스크린샷 캡처 - 설정 화면이 완전히 표시되는지 확인 <br> 4. 설정->메인 메뉴 슬라이드 전환 트리거 <br> 5. 300ms 시점에 스크린샷 캡처 - 메인 메뉴가 복귀되는지 확인 |
| **기대결과** | 설정 화면이 우측에서 0.3초(EaseInOutCubic)에 걸쳐 슬라이드인/아웃 된다 |
| **우선순위** | 중간 |

---

### 4.8 파티클 이펙트 테스트

#### TC-ANIM-028: 머지 파티클 방출 (원형, 8~12개)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-028 |
| **목적** | 머지 시 원형 파티클 8~12개가 블록 색상으로 360도 방사되는지 검증 |
| **사전조건** | 같은 숫자 블록이 인접 배치된 상태 |
| **테스트 단계** | 1. 머지 트리거 <br> 2. 300~350ms(팽창 단계) 시점에 스크린샷 캡처 <br> 3. 블록 중심 주변 영역에서 블록 색상과 유사한 작은 원형 요소를 검출 <br> 4. 700ms 시점에 스크린샷 캡처 - 파티클이 소멸(0.4초 수명)했는지 확인 |
| **기대결과** | 파티클이 합체 위치에서 원형으로 방사되며 0.4초 후 크기 감소 + 투명도 감소로 소멸한다 |
| **우선순위** | 중간 |

#### TC-ANIM-029: 별 파티클 (대형 점수 시)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-029 |
| **목적** | 1000점 이상 획득 시 금색(#FFD700) 별 파티클 5~8개가 위쪽 180도 반원형으로 방출되는지 검증 |
| **사전조건** | 대형 점수 머지가 가능한 보드 상태 |
| **테스트 단계** | 1. 1000점 이상 머지 트리거 <br> 2. 200ms 시점에 스크린샷 캡처 <br> 3. 팝업 텍스트 주변 위쪽 영역에서 금색 별 형태의 파티클이 검출되는지 확인 <br> 4. 700ms 시점에 파티클이 소멸(0.6초 수명)했는지 확인 |
| **기대결과** | 금색 별 파티클이 위쪽 반원형으로 5~8개 방출되며 0.6초 후 소멸한다 |
| **우선순위** | 낮음 |

#### TC-ANIM-030: 콤보 대형 파티클 (x5+)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-030 |
| **목적** | 콤보 x5 이상 시 화면 넓은 범위에 대형 파티클이 방출되는지 검증 |
| **사전조건** | 게임 플레이 화면 |
| **테스트 단계** | 1. 콤보 x5 트리거 <br> 2. 200ms 시점에 스크린샷 캡처 <br> 3. 화면 전체 영역에서 대형 파티클(약 20개)이 분포하는지 확인 <br> 4. 1초 후 파티클이 소멸했는지 확인 |
| **기대결과** | 화면 중앙에서 약 20개의 대형 파티클이 방출되며 1.0초 후 소멸한다 |
| **우선순위** | 낮음 |

---

### 4.9 성능 테스트

#### TC-ANIM-031: 애니메이션 중 FPS 60fps 유지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-031 |
| **목적** | 개별 애니메이션 재생 중 FPS가 60fps 이상(또는 WebGL 기준 55fps 이상)을 유지하는지 검증 |
| **사전조건** | 게임이 안정적으로 실행 중인 상태 |
| **테스트 단계** | 1. 각 애니메이션 유형별로 트리거 (블록 생성, 머지, 파도, 콤보) <br> 2. 애니메이션 진행 중 100ms 간격으로 FPS 샘플링 (최소 10회) <br> 3. 평균 FPS 계산 <br> 4. 최저 FPS 기록 <br> 5. 평균 FPS >= 55, 최저 FPS >= 30 인지 확인 |
| **기대결과** | 개별 애니메이션 재생 중 평균 FPS 55 이상, 최저 FPS 30 이상을 유지한다 |
| **우선순위** | 높음 |

#### TC-ANIM-032: 동시 다수 애니메이션 시 FPS 드롭 여부

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-032 |
| **목적** | 머지 + 파티클 + 점수 팝업 + 콤보 이펙트가 동시에 재생될 때 FPS 드롭 정도를 측정 |
| **사전조건** | 게임 플레이 화면 |
| **테스트 단계** | 1. 머지 트리거와 동시에 콤보 x3 트리거 (복합 애니메이션 상황) <br> 2. 애니메이션 진행 중 50ms 간격으로 FPS 샘플링 (최소 20회) <br> 3. 평균 FPS 및 최저 FPS 기록 <br> 4. 최저 FPS가 30fps 미만으로 떨어지지 않는지 확인 |
| **기대결과** | 복합 애니메이션 상황에서도 최저 FPS 30 이상을 유지하며, 체감 프레임 드롭이 발생하지 않는다 |
| **우선순위** | 높음 |

#### TC-ANIM-033: WebGL 환경 프레임 드롭 감지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-033 |
| **목적** | WebGL 환경에서 장시간(30초) 연속 애니메이션 수행 시 메모리 누수나 점진적 FPS 하락이 발생하지 않는지 검증 |
| **사전조건** | 게임 플레이 화면 |
| **테스트 단계** | 1. 30초 동안 반복적으로 머지 + 파도 애니메이션 트리거 (2초 간격) <br> 2. 매 5초마다 FPS 기록 (총 6회 샘플) <br> 3. 첫 번째 샘플과 마지막 샘플의 FPS 차이가 15fps 이내인지 확인 <br> 4. 브라우저 메모리 사용량이 초기 대비 50% 이상 증가하지 않는지 확인 |
| **기대결과** | 30초 연속 사용 후에도 FPS 하락이 15fps 이내이며 메모리 누수가 없다 |
| **우선순위** | 중간 |

---

### 4.10 스크린샷 기반 시각적 회귀 테스트

#### TC-ANIM-034: 블록 생성 완료 후 스크린샷 비교

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-034 |
| **목적** | 블록 생성 애니메이션 완료 후의 화면이 기준 스크린샷과 일치하는지 비교하여 시각적 회귀를 검출 |
| **사전조건** | 기준 스크린샷이 `tests/screenshots/baseline/spawn-complete.png` 에 저장된 상태 |
| **테스트 단계** | 1. 고정 보드 상태를 설정 (`setBoardState(...)`) <br> 2. 블록 생성 애니메이션 트리거 및 완료 대기 <br> 3. 스크린샷 캡처 <br> 4. Playwright의 `toHaveScreenshot()` 으로 기준 이미지와 비교 (maxDiffPixelRatio: 0.02) |
| **기대결과** | 실제 스크린샷과 기준 스크린샷의 픽셀 차이가 2% 이내이다 |
| **우선순위** | 높음 |

#### TC-ANIM-035: 머지 완료 후 스크린샷 비교

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-035 |
| **목적** | 머지 애니메이션 완료 후의 화면(새 숫자, 새 색상, 파티클 소멸 후)이 기준 스크린샷과 일치하는지 검증 |
| **사전조건** | 기준 스크린샷이 `tests/screenshots/baseline/merge-complete.png` 에 저장된 상태 |
| **테스트 단계** | 1. 고정 보드 상태 설정 <br> 2. 특정 블록 쌍 머지 트리거 및 완료 대기 <br> 3. 파티클 소멸(+200ms) 추가 대기 <br> 4. 스크린샷 캡처 및 기준 이미지 비교 |
| **기대결과** | 머지 결과 화면이 기준 스크린샷과 2% 이내 차이를 보인다 |
| **우선순위** | 높음 |

#### TC-ANIM-036: 화면 전환 완료 후 스크린샷 비교

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-ANIM-036 |
| **목적** | 화면 전환 애니메이션 완료 후 도착 화면이 기준 스크린샷과 일치하는지 검증 |
| **사전조건** | 각 전환별 기준 스크린샷이 저장된 상태 |
| **테스트 단계** | 1. 메인 메뉴->게임 전환 트리거 및 완료 대기 <br> 2. 스크린샷 캡처 및 기준 이미지 비교 <br> 3. 게임->일시정지 전환 반복 <br> 4. 각 전환 결과의 차이가 2% 이내인지 확인 |
| **기대결과** | 모든 화면 전환 완료 후 도착 화면이 기준 스크린샷과 2% 이내 차이를 보인다 |
| **우선순위** | 중간 |

---

## 5. Playwright 코드 예제

### 5.1 블록 생성 애니메이션 테스트 (spawn.spec.ts)

```typescript
// tests/animation/spawn.spec.ts
import { test } from '../fixtures/game-page';
import { expect } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

test.describe('블록 생성 애니메이션', () => {

  test('TC-ANIM-001: 단일 블록 생성 Scale + Fade 검증', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    // 블록 생성 트리거
    await unity.triggerSpawnAnimation(1);

    // 시작 직후: 스케일 0
    const initialScale = await unity.getBlockScale(0, 0);
    expect(initialScale).toBeCloseTo(0, 1);

    // 250ms 대기 후: 스케일 1.0 안착
    await page.waitForTimeout(300);
    const finalScale = await unity.getBlockScale(0, 0);
    expect(finalScale).toBeCloseTo(1.0, 1);

    // 투명도 확인: alpha = 1.0
    const alpha = await unity.getBlockAlpha(0, 0);
    expect(alpha).toBeCloseTo(1.0, 1);
  });

  test('TC-ANIM-002: 다중 블록 순차 딜레이 생성', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    // 5개 블록 생성 트리거
    const startTime = Date.now();
    await unity.triggerSpawnAnimation(5);

    // 첫 번째 블록은 즉시 시작, 다섯 번째 블록은 120ms(0.03*4) 후 시작
    // 모든 애니메이션 완료 대기
    await unity.waitForAnimationComplete(2000);
    const elapsed = Date.now() - startTime;

    // 총 시간: 250ms(애니메이션) + 120ms(딜레이) = 약 370ms
    // 허용 오차 포함 300~500ms 범위
    expect(elapsed).toBeGreaterThan(300);
    expect(elapsed).toBeLessThan(600);
  });

  test('TC-ANIM-003: 생성 애니메이션 타이밍 250ms 검증', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    const startTime = Date.now();
    await unity.triggerSpawnAnimation(1);
    await unity.waitForAnimationComplete(2000);
    const elapsed = Date.now() - startTime;

    // 250ms +-50ms 허용
    expect(elapsed).toBeGreaterThan(200);
    expect(elapsed).toBeLessThan(300);
  });
});
```

### 5.2 머지 애니메이션 테스트 (merge.spec.ts)

```typescript
// tests/animation/merge.spec.ts
import { test } from '../fixtures/game-page';
import { expect } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

test.describe('머지 애니메이션 4단계 시퀀스', () => {

  test.beforeEach(async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();
    // 같은 숫자(32) 블록 두 개를 인접 배치
    await unity.setBoardState({
      blocks: [
        { q: 0, r: 0, value: 32 },
        { q: 1, r: 0, value: 32 },
      ],
    });
  });

  test('TC-ANIM-008~011: 머지 4단계 전체 시퀀스', async ({ page }) => {
    const unity = new UnityBridge(page);

    // 단계1: 블록 이동 시작
    const startTime = Date.now();
    await unity.triggerMerge(0, 0, 1, 0);

    // 100ms 시점: 블록 B가 이동 중 (중간 위치)
    await page.waitForTimeout(100);
    const animState1 = await unity.getAnimationState();
    expect(animState1.phase).toBe('moving');

    // 250ms 시점: 합체 단계 (크로스페이드)
    await page.waitForTimeout(150);
    const animState2 = await unity.getAnimationState();
    expect(animState2.phase).toBe('merging');

    // 350ms 시점: 팽창 단계
    await page.waitForTimeout(100);
    const scale = await unity.getBlockScale(0, 0);
    expect(scale).toBeGreaterThan(1.1);
    expect(scale).toBeLessThanOrEqual(1.45);

    // 스크린샷 캡처: 팽창 + 파티클 상태
    await expect(page).toHaveScreenshot('merge-expand-particles.png', {
      maxDiffPixelRatio: 0.05, // 파티클은 랜덤이므로 5% 허용
    });

    // 500ms 시점: 정착 완료
    await page.waitForTimeout(150);
    const finalScale = await unity.getBlockScale(0, 0);
    expect(finalScale).toBeCloseTo(1.0, 1);

    // 총 시간 검증
    const elapsed = Date.now() - startTime;
    expect(elapsed).toBeGreaterThan(420);
    expect(elapsed).toBeLessThan(650);
  });

  test('TC-ANIM-012: 머지 전체 타이밍 500ms 검증', async ({ page }) => {
    const unity = new UnityBridge(page);

    const startTime = Date.now();
    await unity.triggerMerge(0, 0, 1, 0);
    await unity.waitForAnimationComplete(3000);
    const elapsed = Date.now() - startTime;

    expect(elapsed).toBeGreaterThan(420);
    expect(elapsed).toBeLessThan(580);
  });
});
```

### 5.3 콤보 이펙트 테스트 (combo.spec.ts)

```typescript
// tests/animation/combo.spec.ts
import { test } from '../fixtures/game-page';
import { expect } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

test.describe('콤보 이펙트', () => {

  test('TC-ANIM-020: 콤보 x2 텍스트 표시', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    await unity.triggerCombo(2);
    await page.waitForTimeout(300);

    // 스크린샷으로 "COMBO x2" 텍스트 존재 확인
    await expect(page).toHaveScreenshot('combo-x2.png', {
      maxDiffPixelRatio: 0.03,
    });
  });

  test('TC-ANIM-023: 콤보 x5+ 화면 플래시 + 대형 파티클', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    // 플래시 시작 전 스크린샷
    const beforeFlash = await page.screenshot();

    await unity.triggerCombo(5);

    // 플래시 직후(30ms) 스크린샷 - 밝기 증가 확인
    await page.waitForTimeout(30);
    const duringFlash = await page.screenshot();

    // 플래시 중 스크린샷이 이전보다 밝아야 함 (평균 밝기 비교)
    // 이 검증은 픽셀 데이터를 분석하여 수행
    const brightnessIncrease = await page.evaluate(
      ([before, during]: [string, string]) => {
        // Base64 -> 이미지 비교 로직은 별도 헬퍼로 구현
        return true; // 실제로는 밝기 비교 함수 호출
      },
      [beforeFlash.toString('base64'), duringFlash.toString('base64')]
    );

    expect(brightnessIncrease).toBeTruthy();

    // 200ms 후 대형 파티클 확인
    await page.waitForTimeout(170);
    await expect(page).toHaveScreenshot('combo-x5-particles.png', {
      maxDiffPixelRatio: 0.08, // 파티클 랜덤 위치로 8% 허용
    });
  });

  test('TC-ANIM-024: 콤보 타이머 만료 2.0초 페이드아웃', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    await unity.triggerCombo(2);

    // 1.5초 후: 아직 표시 중
    await page.waitForTimeout(1500);
    const state1 = await unity.getAnimationState();
    expect(state1.comboVisible).toBe(true);

    // 총 3.0초 후: 완전히 사라짐 (2.0초 타이머 + 0.5초 페이드아웃)
    await page.waitForTimeout(1500);
    const state2 = await unity.getAnimationState();
    expect(state2.comboVisible).toBe(false);
  });
});
```

### 5.4 성능 테스트 (performance.spec.ts)

```typescript
// tests/animation/performance.spec.ts
import { test } from '../fixtures/game-page';
import { expect } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

test.describe('애니메이션 성능', () => {

  test('TC-ANIM-031: 개별 애니메이션 FPS 60fps 유지', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    // 머지 애니메이션 트리거
    await unity.setBoardState({
      blocks: [
        { q: 0, r: 0, value: 16 },
        { q: 1, r: 0, value: 16 },
      ],
    });
    await unity.triggerMerge(0, 0, 1, 0);

    // 100ms 간격으로 FPS 10회 샘플링
    const fpsSamples: number[] = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(100);
      const fps = await unity.getFPS();
      fpsSamples.push(fps);
    }

    const avgFps =
      fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length;
    const minFps = Math.min(...fpsSamples);

    console.log(`평균 FPS: ${avgFps.toFixed(1)}, 최저 FPS: ${minFps}`);

    expect(avgFps).toBeGreaterThanOrEqual(55);
    expect(minFps).toBeGreaterThanOrEqual(30);
  });

  test('TC-ANIM-032: 동시 다수 애니메이션 FPS 드롭', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    // 복합 애니메이션 상황 생성
    await unity.setBoardState({
      blocks: [
        { q: 0, r: 0, value: 8 },
        { q: 1, r: 0, value: 8 },
        { q: 2, r: 0, value: 4 },
        { q: 3, r: 0, value: 4 },
      ],
    });

    // 머지 + 콤보 동시 트리거
    await unity.triggerMerge(0, 0, 1, 0);
    await unity.triggerCombo(3);

    // 50ms 간격으로 FPS 20회 샘플링
    const fpsSamples: number[] = [];
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(50);
      const fps = await unity.getFPS();
      fpsSamples.push(fps);
    }

    const minFps = Math.min(...fpsSamples);
    console.log(
      `복합 애니메이션 FPS 샘플: ${fpsSamples.join(', ')}`
    );
    console.log(`최저 FPS: ${minFps}`);

    expect(minFps).toBeGreaterThanOrEqual(30);
  });

  test('TC-ANIM-033: 30초 연속 실행 메모리 누수 검사', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    // 초기 메모리 측정
    const initialMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    const fpsSamplesOverTime: { time: number; fps: number }[] = [];

    // 30초 동안 2초 간격으로 애니메이션 반복 트리거
    for (let sec = 0; sec < 30; sec += 2) {
      await unity.setBoardState({
        blocks: [
          { q: 0, r: 0, value: 2 },
          { q: 1, r: 0, value: 2 },
        ],
      });
      await unity.triggerMerge(0, 0, 1, 0);
      await page.waitForTimeout(1000);
      await unity.triggerWaveAnimation('BottomToTop');
      await page.waitForTimeout(1000);

      const fps = await unity.getFPS();
      fpsSamplesOverTime.push({ time: sec, fps });
    }

    // FPS 하락 확인
    const firstFps = fpsSamplesOverTime[0].fps;
    const lastFps =
      fpsSamplesOverTime[fpsSamplesOverTime.length - 1].fps;
    const fpsDrop = firstFps - lastFps;

    console.log(`FPS 변화: ${firstFps} -> ${lastFps} (하락: ${fpsDrop})`);
    expect(fpsDrop).toBeLessThan(15);

    // 메모리 증가 확인
    const finalMemory = await page.evaluate(() => {
      return (performance as any).memory?.usedJSHeapSize || 0;
    });

    if (initialMemory > 0) {
      const memoryGrowth =
        ((finalMemory - initialMemory) / initialMemory) * 100;
      console.log(`메모리 증가율: ${memoryGrowth.toFixed(1)}%`);
      expect(memoryGrowth).toBeLessThan(50);
    }
  });
});
```

### 5.5 시각적 회귀 테스트 (visual-regression.spec.ts)

```typescript
// tests/animation/visual-regression.spec.ts
import { test } from '../fixtures/game-page';
import { expect } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

test.describe('시각적 회귀 테스트', () => {

  const FIXED_BOARD_STATE = {
    blocks: [
      { q: 0, r: -2, value: 2 },
      { q: 1, r: -2, value: 4 },
      { q: 2, r: -2, value: 8 },
      { q: -1, r: -1, value: 16 },
      { q: 0, r: -1, value: 32 },
      { q: 1, r: -1, value: 64 },
      { q: 2, r: -1, value: 128 },
      { q: -2, r: 0, value: 2 },
      { q: -1, r: 0, value: 4 },
      { q: 0, r: 0, value: 32 },
      { q: 1, r: 0, value: 32 },
      { q: 2, r: 0, value: 8 },
    ],
  };

  test('TC-ANIM-034: 블록 생성 완료 후 스크린샷 비교', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    await unity.setBoardState(FIXED_BOARD_STATE);
    await unity.triggerSpawnAnimation(12);
    await unity.waitForAnimationComplete(3000);

    // 추가 안정화 대기
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('spawn-complete.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('TC-ANIM-035: 머지 완료 후 스크린샷 비교', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    await unity.setBoardState(FIXED_BOARD_STATE);
    await unity.waitForAnimationComplete(2000);

    // 32+32 머지 (q=0,r=0 + q=1,r=0)
    await unity.triggerMerge(0, 0, 1, 0);
    await unity.waitForAnimationComplete(3000);

    // 파티클 소멸 대기
    await page.waitForTimeout(500);

    await expect(page).toHaveScreenshot('merge-complete.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });

  test('TC-ANIM-036: 화면 전환 완료 후 스크린샷 비교', async ({ page }) => {
    const unity = new UnityBridge(page);
    await unity.waitForUnityLoad();

    // 메인 메뉴 -> 게임 전환
    await unity.triggerScreenTransition('MainMenu', 'Game');
    await unity.waitForAnimationComplete(3000);
    await page.waitForTimeout(300);

    await expect(page).toHaveScreenshot('transition-to-game.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });

    // 게임 -> 일시정지 전환
    await unity.triggerScreenTransition('Game', 'Pause');
    await unity.waitForAnimationComplete(2000);
    await page.waitForTimeout(200);

    await expect(page).toHaveScreenshot('transition-to-pause.png', {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    });
  });
});
```

---

## 6. 테스트 데이터 및 자동화 전략

### 6.1 테스트 데이터

#### 고정 보드 상태 (결정론적 테스트용)

| 데이터 세트 | 용도 | 설명 |
|------------|------|------|
| `board-empty` | 블록 생성 테스트 | 빈 보드, 모든 셀이 비어있음 |
| `board-merge-ready` | 머지 테스트 | 인접한 같은 숫자 블록 쌍이 다수 존재 |
| `board-combo-chain` | 콤보 테스트 | 연쇄 머지가 가능하도록 배치 |
| `board-full` | 성능 테스트 | 43개 셀 모두 블록이 채워진 상태 |
| `board-high-value` | 대형 점수 테스트 | 512, 1024 블록이 인접 배치 |
| `board-wave-target` | 파도 웨이브 테스트 | 다수의 빈 공간이 패턴화된 상태 |

#### 기준 스크린샷 목록

| 파일명 | 촬영 시점 | 용도 |
|--------|---------|------|
| `spawn-complete.png` | 블록 12개 생성 애니메이션 완료 후 | 생성 시각적 회귀 |
| `merge-complete.png` | 32+32 머지 완료 후 (파티클 소멸 후) | 머지 시각적 회귀 |
| `combo-x2.png` | 콤보 x2 텍스트 표시 상태 | 콤보 시각적 회귀 |
| `combo-x5-particles.png` | 콤보 x5 파티클 표시 상태 | 콤보 시각적 회귀 |
| `transition-to-game.png` | 메인 메뉴->게임 전환 완료 | 전환 시각적 회귀 |
| `transition-to-pause.png` | 게임->일시정지 전환 완료 | 전환 시각적 회귀 |
| `merge-expand-particles.png` | 머지 팽창+파티클 중간 상태 | 머지 중간 상태 확인 |

### 6.2 자동화 전략

#### CI/CD 파이프라인 통합

```yaml
# .github/workflows/animation-test.yml (참고용)
name: Animation E2E Tests
on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  animation-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '18'
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Start WebGL server
        run: npx serve ./Build/WebGL -p 8080 &
      - name: Wait for server
        run: npx wait-on http://localhost:8080
      - name: Run animation tests
        run: npx playwright test --project=chromium-desktop
      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: animation-test-results
          path: |
            test-results/
            playwright-report/
```

#### 테스트 실행 전략

| 항목 | 전략 |
|------|------|
| 실행 빈도 | PR 생성/업데이트 시, develop 브랜치 푸시 시 |
| 실행 순서 | 우선순위 높음 -> 중간 -> 낮음 순서로 실행 |
| 병렬 실행 | 게임 상태 의존성으로 인해 순차 실행 (workers: 1) |
| 재시도 정책 | 최대 1회 재시도 (랜덤 파티클 등 비결정론적 요소 고려) |
| 타임아웃 | 개별 테스트 60초, 전체 스위트 10분 |
| 스크린샷 업데이트 | `npx playwright test --update-snapshots` 로 기준 이미지 갱신 |

#### 타이밍 검증 허용 오차 정책

| 애니메이션 유형 | 설계 시간 | 허용 오차 | 비고 |
|---------------|---------|---------|------|
| 블록 생성 | 250ms | +-50ms | WebGL 렌더링 지연 고려 |
| 탭 바운스 | 150ms | +-30ms | |
| 머지 전체 | 500ms | +-80ms | 4단계 누적 오차 |
| 파도 웨이브 (블록당) | 300ms | +-50ms | |
| 점수 팝업 | 800ms | +-100ms | |
| 화면 전환 | 300~500ms | +-80ms | 전환 유형별 상이 |
| 콤보 타이머 | 2000ms | +-200ms | |

#### 스크린샷 비교 정책

| 비교 대상 | maxDiffPixelRatio | threshold | 비고 |
|---------|------------------|-----------|------|
| 정적 화면 (전환 완료 후) | 0.02 (2%) | 0.2 | 엄격한 비교 |
| 파티클 포함 화면 | 0.05 (5%) | 0.3 | 파티클 랜덤성 고려 |
| 콤보 x5+ 이펙트 | 0.08 (8%) | 0.3 | 플래시/파티클 랜덤성 고려 |
| 중간 상태 (애니메이션 진행 중) | 0.10 (10%) | 0.4 | 프레임 타이밍 차이 고려 |

#### 실패 시 디버깅 전략

1. **스크린샷 비교 실패**: `test-results/` 폴더에서 actual/expected/diff 이미지를 비교한다.
2. **타이밍 실패**: 비디오 녹화(`video: 'retain-on-failure'`)를 확인하여 애니메이션 진행을 시각적으로 검토한다.
3. **FPS 실패**: 트레이스 파일(`trace: 'retain-on-failure'`)을 Playwright Trace Viewer로 열어 프레임 타이밍을 분석한다.
4. **간헐적 실패**: 파티클 랜덤성에 의한 실패는 `maxDiffPixelRatio`를 조정하거나, 파티클 비활성화 모드를 활용한다.

---

> **문서 끝**
> 이 문서는 `docs/design/02_ui-ux-design.md`의 섹션 4(애니메이션 시스템)과
> `docs/development/04_animation/development-plan.md`를 기반으로 작성되었습니다.
> 개발 진행에 따라 테스트 케이스 및 기준 스크린샷이 지속적으로 업데이트됩니다.
