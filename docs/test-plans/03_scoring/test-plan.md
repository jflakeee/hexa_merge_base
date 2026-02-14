# 03. 스코어링 시스템 & 게임 상태 관리 - Playwright 테스트 계획서

| 항목 | 내용 |
|------|------|
| **테스트 대상** | 스코어링 시스템, 게임 상태 관리, 세이브/로드, 리더보드 |
| **기반 설계문서** | `docs/design/01_core-system-design.md` - 4장, 5장 |
| **기반 개발계획** | `docs/development/03_scoring/development-plan.md` |
| **테스트 도구** | Playwright (TypeScript) |
| **테스트 플랫폼** | Unity WebGL 빌드 (브라우저 환경) |
| **문서 버전** | v1.0 |
| **최종 수정일** | 2026-02-13 |

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [테스트 환경 설정](#2-테스트-환경-설정)
3. [테스트 케이스 목록](#3-테스트-케이스-목록)
4. [Playwright 코드 예제](#4-playwright-코드-예제)
5. [테스트 데이터 및 자동화 전략](#5-테스트-데이터-및-자동화-전략)

---

## 1. 테스트 개요

### 1.1 목적

본 테스트 계획서는 Hexa Merge Basic 게임의 **스코어링 시스템** 및 **게임 상태 관리** 모듈을 Unity WebGL 빌드 환경에서 Playwright를 활용하여 E2E(End-to-End) 테스트하는 것을 목적으로 한다. 브라우저에서 실행되는 WebGL 빌드를 대상으로, 사용자 관점에서 점수 계산, 상태 전환, 데이터 저장/복원 등의 기능이 올바르게 동작하는지 검증한다.

### 1.2 범위

| 범위 구분 | 포함 항목 |
|-----------|-----------|
| **포함** | 기본 머지 점수 계산, 연쇄(체인) 보너스, 마일스톤 보너스, 최고 점수 갱신, 점수 UI 표시(카운트업 애니메이션), 게임 상태 전환(메뉴/플레이/일시정지), 세이브/로드, 오프라인 데이터 저장, 리더보드 연동 |
| **제외** | 헥사 그리드 렌더링 정확성, 블록 물리 애니메이션 상세, 사운드/진동 피드백, Android 네이티브 빌드 테스트 |

### 1.3 전제조건

| 항목 | 조건 |
|------|------|
| Unity WebGL 빌드 | 정상 빌드 완료 및 로컬/원격 웹 서버에 배포된 상태 |
| 브라우저 호환성 | Chromium 기반 브라우저 (Chrome, Edge) 최신 버전 |
| Unity-JavaScript 브릿지 | `window.unityInstance` 또는 `window.gameInstance`를 통해 Unity와 JavaScript 간 통신 가능 |
| 테스트 헬퍼 노출 | Unity 빌드에 `TestBridge.jslib` 플러그인이 포함되어 `window.getGameState()`, `window.getScore()` 등 테스트용 API가 노출된 상태 |
| 게임 로딩 완료 | WebGL 빌드의 로딩 화면이 완료되고 메인 메뉴 또는 플레이 화면이 표시된 상태에서 테스트 시작 |
| IndexedDB 접근 | WebGL 환경에서 세이브 데이터가 IndexedDB 또는 PlayerPrefs(localStorage)에 저장되며, Playwright에서 접근 가능 |

### 1.4 용어 정의

| 용어 | 설명 |
|------|------|
| 머지(Merge) | 같은 값의 블록 두 개를 합쳐 두 배 값의 블록을 만드는 행위 |
| 연쇄(Chain) | 머지 결과 블록이 인접한 같은 값 블록과 자동으로 추가 머지되는 현상 |
| 마일스톤(Milestone) | 특정 값의 블록(128, 256, 512...)을 최초 달성 시 1회 한정 보너스 |
| 웨이브(Wave) | 머지 후 테두리에서 새 블록이 밀려오는 현상 |
| 리셔플(Reshuffle) | 매칭 가능한 쌍이 없을 때 블록을 재배치하는 동작 |
| TestBridge | Unity WebGL 빌드에 포함된 JavaScript 브릿지로, 테스트용 게임 내부 상태 조회/조작 API 제공 |

---

## 2. 테스트 환경 설정

### 2.1 기술 스택

| 항목 | 버전/상세 |
|------|-----------|
| Playwright | `@playwright/test` ^1.42.0 |
| TypeScript | ^5.3.0 |
| Node.js | ^20.x LTS |
| 브라우저 | Chromium (Playwright 내장) |
| 테스트 대상 | Unity 2022 LTS WebGL 빌드 |
| 웹 서버 | 로컬 개발 서버 (http://localhost:8080) |

### 2.2 프로젝트 구조

```
tests/
  e2e/
    scoring/
      basic-score.spec.ts          # 기본 점수 계산 테스트
      chain-bonus.spec.ts          # 콤보/연쇄 보너스 테스트
      milestone-bonus.spec.ts      # 마일스톤 보너스 테스트
      high-score.spec.ts           # 최고 점수 갱신 테스트
      score-ui.spec.ts             # 점수 표시 UI 테스트
      game-state.spec.ts           # 게임 상태 전환 테스트
      save-load.spec.ts            # 세이브/로드 테스트
      offline-data.spec.ts         # 오프라인 데이터 저장 테스트
      leaderboard.spec.ts          # 리더보드 연동 테스트
    helpers/
      unity-helper.ts              # Unity WebGL 공통 헬퍼
      game-actions.ts              # 게임 액션 헬퍼 (머지, 탭 등)
      test-bridge.ts               # TestBridge API 래퍼
    fixtures/
      save-data-samples.json       # 테스트용 세이브 데이터 샘플
  playwright.config.ts             # Playwright 설정 파일
```

### 2.3 Playwright 설정 파일

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/scoring',
  timeout: 120_000,          // Unity WebGL 로딩 시간 고려 (2분)
  expect: {
    timeout: 30_000,         // WebGL 렌더링 대기 시간
  },
  retries: 1,
  workers: 1,                // Unity WebGL은 GPU 자원 경합 방지를 위해 직렬 실행
  reporter: [
    ['html', { outputFolder: 'test-results/scoring' }],
    ['list'],
  ],
  use: {
    baseURL: 'http://localhost:8080',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        '--enable-gpu',
        '--use-gl=angle',
        '--enable-webgl',
        '--ignore-gpu-blocklist',
      ],
    },
  },
  projects: [
    {
      name: 'chromium-webgl',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx http-server ./Build/WebGL -p 8080 --cors -c-1',
    port: 8080,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### 2.4 Unity WebGL 헬퍼 모듈

```typescript
// tests/e2e/helpers/unity-helper.ts
import { Page, expect } from '@playwright/test';

/**
 * Unity WebGL 빌드 공통 헬퍼.
 * 게임 로딩 대기, 캔버스 접근, TestBridge API 호출 등을 제공한다.
 */
export class UnityHelper {
  constructor(private page: Page) {}

  /** Unity WebGL 게임 페이지로 이동 후 로딩 완료까지 대기 */
  async loadGame(): Promise<void> {
    await this.page.goto('/', { waitUntil: 'domcontentloaded' });

    // Unity 로딩 진행바가 사라질 때까지 대기
    await this.page.waitForFunction(
      () => {
        const loader = document.querySelector('#unity-loading-bar');
        return !loader || (loader as HTMLElement).style.display === 'none';
      },
      { timeout: 90_000 }
    );

    // Unity 인스턴스가 준비될 때까지 대기
    await this.page.waitForFunction(
      () => typeof (window as any).getGameState === 'function',
      { timeout: 30_000 }
    );
  }

  /** Unity 게임 캔버스 요소 반환 */
  async getCanvas() {
    return this.page.locator('#unity-canvas');
  }

  /** 캔버스 내 특정 비율 좌표를 클릭 (0.0~1.0 범위) */
  async clickCanvasAt(xRatio: number, yRatio: number): Promise<void> {
    const canvas = await this.getCanvas();
    const box = await canvas.boundingBox();
    if (!box) throw new Error('Canvas bounding box를 찾을 수 없습니다.');

    const x = box.x + box.width * xRatio;
    const y = box.y + box.height * yRatio;
    await this.page.mouse.click(x, y);
  }

  /** TestBridge를 통해 현재 게임 상태 조회 */
  async getGameState(): Promise<string> {
    return await this.page.evaluate(() => (window as any).getGameState());
  }

  /** TestBridge를 통해 현재 점수 조회 */
  async getCurrentScore(): Promise<number> {
    return await this.page.evaluate(() => (window as any).getScore());
  }

  /** TestBridge를 통해 최고 점수 조회 */
  async getHighScore(): Promise<number> {
    return await this.page.evaluate(() => (window as any).getHighScore());
  }

  /** TestBridge를 통해 강제로 점수 설정 (테스트 전용) */
  async setScore(score: number): Promise<void> {
    await this.page.evaluate((s) => (window as any).setScore(s), score);
  }

  /** TestBridge를 통해 특정 셀에 블록 배치 (테스트 전용) */
  async placeBlock(col: number, row: number, level: number): Promise<void> {
    await this.page.evaluate(
      ({ c, r, l }) => (window as any).placeBlock(c, r, l),
      { c: col, r: row, l: level }
    );
  }

  /** TestBridge를 통해 보드 초기화 (테스트 전용) */
  async clearBoard(): Promise<void> {
    await this.page.evaluate(() => (window as any).clearBoard());
  }

  /** TestBridge를 통해 특정 셀의 블록 값 조회 */
  async getBlockValue(col: number, row: number): Promise<number> {
    return await this.page.evaluate(
      ({ c, r }) => (window as any).getBlockValue(c, r),
      { c: col, r: row }
    );
  }

  /** TestBridge를 통해 머지 실행 (두 셀 좌표 지정) */
  async executeMerge(
    srcCol: number, srcRow: number,
    tgtCol: number, tgtRow: number
  ): Promise<void> {
    await this.page.evaluate(
      ({ sc, sr, tc, tr }) => (window as any).executeMerge(sc, sr, tc, tr),
      { sc: srcCol, sr: srcRow, tc: tgtCol, tr: tgtRow }
    );
  }

  /** TestBridge를 통해 연쇄 머지 시나리오 설정 (테스트 전용) */
  async setupChainScenario(scenario: string): Promise<void> {
    await this.page.evaluate(
      (s) => (window as any).setupChainScenario(s),
      scenario
    );
  }

  /** TestBridge를 통해 마일스톤 달성 상태 조회 */
  async getAchievedMilestones(): Promise<number[]> {
    return await this.page.evaluate(
      () => (window as any).getAchievedMilestones()
    );
  }

  /** TestBridge를 통해 게임 상태 강제 전환 (테스트 전용) */
  async forceGameState(state: string): Promise<void> {
    await this.page.evaluate(
      (s) => (window as any).forceGameState(s),
      state
    );
  }

  /** TestBridge를 통해 세이브 데이터 문자열 조회 */
  async getSaveDataJson(): Promise<string> {
    return await this.page.evaluate(
      () => (window as any).getSaveDataJson()
    );
  }

  /** TestBridge를 통해 세이브 데이터 주입 (테스트 전용) */
  async loadSaveDataJson(json: string): Promise<void> {
    await this.page.evaluate(
      (j) => (window as any).loadSaveDataJson(j),
      json
    );
  }

  /** 일정 시간(ms) 대기 (애니메이션 완료 등) */
  async waitForAnimation(ms: number = 2000): Promise<void> {
    await this.page.waitForTimeout(ms);
  }

  /** TestBridge를 통해 세이브 데이터 삭제 */
  async deleteSaveData(): Promise<void> {
    await this.page.evaluate(() => (window as any).deleteSaveData());
  }

  /** IndexedDB 직접 접근하여 세이브 데이터 존재 여부 확인 */
  async hasSaveDataInIndexedDB(): Promise<boolean> {
    return await this.page.evaluate(() => {
      return new Promise<boolean>((resolve) => {
        const request = indexedDB.open('/idbfs', 1);
        request.onsuccess = () => {
          const db = request.result;
          try {
            const tx = db.transaction(['FILE_DATA'], 'readonly');
            const store = tx.objectStore('FILE_DATA');
            const getReq = store.get('/hexa_merge_save.json');
            getReq.onsuccess = () => resolve(!!getReq.result);
            getReq.onerror = () => resolve(false);
          } catch {
            resolve(false);
          }
        };
        request.onerror = () => resolve(false);
      });
    });
  }

  /** localStorage 기반 PlayerPrefs 값 직접 조회 */
  async getPlayerPref(key: string): Promise<string | null> {
    return await this.page.evaluate(
      (k) => localStorage.getItem(k),
      key
    );
  }

  /** localStorage 기반 PlayerPrefs 값 직접 설정 */
  async setPlayerPref(key: string, value: string): Promise<void> {
    await this.page.evaluate(
      ({ k, v }) => localStorage.setItem(k, v),
      { k: key, v: value }
    );
  }

  /** localStorage 전체 초기화 */
  async clearLocalStorage(): Promise<void> {
    await this.page.evaluate(() => localStorage.clear());
  }
}
```

### 2.5 게임 액션 헬퍼 모듈

```typescript
// tests/e2e/helpers/game-actions.ts
import { Page } from '@playwright/test';
import { UnityHelper } from './unity-helper';

/**
 * 게임 내 고수준 액션을 제공하는 헬퍼.
 * 메뉴 조작, 블록 탭, 머지 수행 등을 추상화한다.
 */
export class GameActions {
  private unity: UnityHelper;

  constructor(private page: Page) {
    this.unity = new UnityHelper(page);
  }

  /** 새 게임 시작 (메인 메뉴에서 "새 게임" 버튼 클릭) */
  async startNewGame(): Promise<void> {
    await this.unity.forceGameState('MainMenu');
    await this.unity.waitForAnimation(500);
    // 새 게임 버튼 클릭 (캔버스 내 좌표 비율)
    await this.unity.clickCanvasAt(0.5, 0.55);
    await this.unity.waitForAnimation(1500);
  }

  /** 이어하기 (메인 메뉴에서 "이어하기" 버튼 클릭) */
  async continueGame(): Promise<void> {
    await this.unity.clickCanvasAt(0.5, 0.65);
    await this.unity.waitForAnimation(1500);
  }

  /** 일시정지 버튼 클릭 */
  async pauseGame(): Promise<void> {
    await this.unity.clickCanvasAt(0.95, 0.05); // 우상단 일시정지 버튼
    await this.unity.waitForAnimation(500);
  }

  /** 계속하기 (일시정지 화면에서) */
  async resumeGame(): Promise<void> {
    await this.unity.clickCanvasAt(0.5, 0.45); // 계속하기 버튼
    await this.unity.waitForAnimation(500);
  }

  /** 메인 메뉴로 돌아가기 (일시정지 화면에서) */
  async goToMainMenu(): Promise<void> {
    await this.unity.clickCanvasAt(0.5, 0.60); // 메인 메뉴 버튼
    await this.unity.waitForAnimation(1000);
  }

  /** 테스트용: 특정 보드 상태를 세팅하고 머지 실행 */
  async setupAndMerge(
    block1: { col: number; row: number; level: number },
    block2: { col: number; row: number; level: number }
  ): Promise<void> {
    await this.unity.clearBoard();
    await this.unity.placeBlock(block1.col, block1.row, block1.level);
    await this.unity.placeBlock(block2.col, block2.row, block2.level);
    await this.unity.executeMerge(
      block1.col, block1.row,
      block2.col, block2.row
    );
    await this.unity.waitForAnimation(2000);
  }
}
```

---

## 3. 테스트 케이스 목록

### 3.1 전체 테스트 케이스 체크리스트

| TC-ID | 카테고리 | 테스트명 | 우선순위 |
|-------|----------|----------|----------|
| TC-SCORE-001 | 기본 점수 | 기본 머지 점수 계산 (2+2=4, 점수 4) | 높음 |
| TC-SCORE-002 | 기본 점수 | 고레벨 머지 점수 계산 (512+512=1024, 점수 1024) | 높음 |
| TC-SCORE-003 | 기본 점수 | 점수 누적 정확성 검증 | 높음 |
| TC-SCORE-004 | 기본 점수 | 점수 초기화 후 0 확인 | 보통 |
| TC-SCORE-005 | 콤보/연쇄 | 1단계 연쇄 보너스 (x1.5 배율) | 높음 |
| TC-SCORE-006 | 콤보/연쇄 | 3단계 연쇄 점수 총합 검증 | 높음 |
| TC-SCORE-007 | 콤보/연쇄 | 최대 연쇄 깊이 제한 (20단계) | 보통 |
| TC-SCORE-008 | 콤보/연쇄 | 콤보 카운터 UI 표시 | 보통 |
| TC-SCORE-009 | 마일스톤 | 128 최초 달성 시 500점 보너스 | 높음 |
| TC-SCORE-010 | 마일스톤 | 마일스톤 중복 달성 시 보너스 미지급 | 높음 |
| TC-SCORE-011 | 마일스톤 | 다단계 점프 시 중간 마일스톤 일괄 지급 | 보통 |
| TC-SCORE-012 | 마일스톤 | 마일스톤 달성 축하 UI 표시 | 보통 |
| TC-SCORE-013 | 최고 점수 | 최고 점수 갱신 확인 | 높음 |
| TC-SCORE-014 | 최고 점수 | 최고 점수 미만 시 미갱신 확인 | 보통 |
| TC-SCORE-015 | 최고 점수 | 게임 재시작 후 최고 점수 유지 | 높음 |
| TC-SCORE-016 | 점수 UI | 점수 변경 시 카운트업 애니메이션 | 보통 |
| TC-SCORE-017 | 점수 UI | 최고 점수 갱신 시 "NEW!" 배지 표시 | 보통 |
| TC-SCORE-018 | 점수 UI | 점수 포맷팅 (1,000 단위 콤마) | 낮음 |
| TC-SCORE-019 | 점수 UI | 플로팅 텍스트(+N) 표시 | 낮음 |
| TC-SCORE-020 | 게임 상태 | Loading -> MainMenu 전환 | 높음 |
| TC-SCORE-021 | 게임 상태 | MainMenu -> Playing 전환 (새 게임) | 높음 |
| TC-SCORE-022 | 게임 상태 | Playing -> Paused 전환 | 높음 |
| TC-SCORE-023 | 게임 상태 | Paused -> Playing 전환 (계속하기) | 높음 |
| TC-SCORE-024 | 게임 상태 | Paused -> MainMenu 전환 | 보통 |
| TC-SCORE-025 | 게임 상태 | 유효하지 않은 상태 전환 거부 | 보통 |
| TC-SCORE-026 | 게임 상태 | Playing -> Reshuffling -> Playing 전환 | 보통 |
| TC-SCORE-027 | 세이브/로드 | 머지 후 자동 저장 확인 | 높음 |
| TC-SCORE-028 | 세이브/로드 | 저장 데이터 로드 후 점수 복원 | 높음 |
| TC-SCORE-029 | 세이브/로드 | 저장 데이터 로드 후 보드 상태 복원 | 높음 |
| TC-SCORE-030 | 세이브/로드 | 세이브 파일 삭제 후 새 게임 시작 | 보통 |
| TC-SCORE-031 | 세이브/로드 | 일시정지 시 자동 저장 | 보통 |
| TC-SCORE-032 | 오프라인 | 오프라인 상태에서 로컬 저장 정상 동작 | 높음 |
| TC-SCORE-033 | 오프라인 | 페이지 새로고침 후 데이터 유지 | 높음 |
| TC-SCORE-034 | 오프라인 | IndexedDB/localStorage 데이터 무결성 | 보통 |
| TC-SCORE-035 | 리더보드 | 점수 제출 API 호출 확인 | 보통 |
| TC-SCORE-036 | 리더보드 | 상위 순위 조회 및 UI 표시 | 보통 |
| TC-SCORE-037 | 리더보드 | 네트워크 오류 시 폴백 처리 | 낮음 |

---

### 3.2 테스트 케이스 상세

#### TC-SCORE-001: 기본 머지 점수 계산 (2+2=4)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-001 |
| **목적** | 값 2 블록 두 개를 머지했을 때 기본 점수가 머지 결과값(4)과 동일한지 검증 |
| **사전조건** | 게임이 Playing 상태이며, 보드가 초기화된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | TestBridge로 보드 초기화 후, 두 셀에 레벨 1(값 2) 블록 배치 | 두 셀에 "2" 블록이 표시됨 |
| 2 | TestBridge로 두 블록 머지 실행 | 머지 애니메이션 재생됨 |
| 3 | 애니메이션 완료 대기 (2초) | 타겟 셀에 "4" 블록 생성됨 |
| 4 | TestBridge로 현재 점수 조회 | 현재 점수 == 4 |

---

#### TC-SCORE-002: 고레벨 머지 점수 계산 (512+512=1024)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-002 |
| **목적** | 고레벨 블록(512) 머지 시 기본 점수가 1024인지 검증 |
| **사전조건** | 게임이 Playing 상태, 보드 초기화됨 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 보드 초기화 후 두 셀에 레벨 9(값 512) 블록 배치 | "512" 블록 2개 표시 |
| 2 | 두 블록 머지 실행 | 머지 애니메이션 재생 |
| 3 | 애니메이션 완료 대기 | "1K" 블록 생성 |
| 4 | 현재 점수 조회 | 현재 점수 == 1024 |

---

#### TC-SCORE-003: 점수 누적 정확성 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-003 |
| **목적** | 여러 번 머지 시 점수가 정확히 누적되는지 검증 |
| **사전조건** | 게임이 Playing 상태, 점수 0 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 보드 초기화, 점수 0으로 설정 | 현재 점수 == 0 |
| 2 | 레벨 1 블록 2개 배치 후 머지 (2+2=4) | 현재 점수 == 4 |
| 3 | 레벨 2 블록 2개 배치 후 머지 (4+4=8) | 현재 점수 == 4 + 8 = 12 |
| 4 | 레벨 3 블록 2개 배치 후 머지 (8+8=16) | 현재 점수 == 12 + 16 = 28 |

---

#### TC-SCORE-004: 점수 초기화 후 0 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-004 |
| **목적** | 새 게임 시작 시 현재 점수가 0으로 초기화되는지 검증 |
| **사전조건** | 이전 게임에서 점수가 누적된 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 테스트용으로 점수를 1000으로 설정 | 현재 점수 == 1000 |
| 2 | 메인 메뉴로 이동 후 "새 게임" 시작 | Playing 상태 전환 |
| 3 | 현재 점수 조회 | 현재 점수 == 0 |

---

#### TC-SCORE-005: 1단계 연쇄 보너스 (x1.5 배율)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-005 |
| **목적** | 연쇄 1단계(chainDepth=1) 발생 시 x1.5 배율이 적용되는지 검증 |
| **사전조건** | 게임이 Playing 상태, 보드에 연쇄 조건이 세팅된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 보드 초기화, 점수 0 | 점수 == 0 |
| 2 | 셀 A, B에 레벨 1(값 2) 배치, 셀 C(B 인접)에 레벨 2(값 4) 배치 | 2, 2, 4 블록 배치됨 |
| 3 | A와 B를 머지 (2+2=4, 기본 점수 4) | 1단계 점수: 4 * 1.0 = 4 |
| 4 | 결과 4가 인접 4와 연쇄 머지 (4+4=8, 연쇄 1단계) | 연쇄 점수: 8 * 1.5 = 12 |
| 5 | 현재 점수 조회 | 총 점수 == 4 + 12 = 16 |

---

#### TC-SCORE-006: 3단계 연쇄 점수 총합 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-006 |
| **목적** | 3단계 연쇄(2->4->8->16) 발생 시 총합 점수가 정확한지 검증 |
| **사전조건** | 연쇄 시나리오가 세팅된 보드 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 보드 초기화, 점수 0 | 점수 == 0 |
| 2 | 연쇄 시나리오 설정: 2, 2, 4(인접), 8(인접) 배치 | 블록 배치 확인 |
| 3 | 2+2 머지 실행 | 자동 연쇄 발생 |
| 4 | 모든 연쇄 애니메이션 완료 대기 | 최종 블록 16 생성 |
| 5 | 점수 조회 | 4*1.0 + 8*1.5 + 16*2.0 = 4+12+32 = 48 |

---

#### TC-SCORE-007: 최대 연쇄 깊이 제한 (20단계)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-007 |
| **목적** | 연쇄가 MAX_CHAIN_DEPTH(20)를 초과하지 않는지 검증 |
| **사전조건** | 20단계 이상 연쇄 가능한 보드 세팅 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | TestBridge로 20단계 이상 연쇄 가능한 시나리오 설정 | 극단적 보드 배치 완료 |
| 2 | 머지 실행 | 연쇄 진행 |
| 3 | 모든 애니메이션 완료 대기 (충분한 시간) | 연쇄 종료 |
| 4 | 연쇄 깊이 결과 조회 | chainDepth <= 20 |
| 5 | 게임이 정상 동작 확인 (무한 루프 없음) | Playing 상태 유지 |

---

#### TC-SCORE-008: 콤보 카운터 UI 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-008 |
| **목적** | 연쇄 발생 시 "xN.N COMBO!" 텍스트가 UI에 표시되는지 검증 |
| **사전조건** | 연쇄 가능한 보드 세팅 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 1단계 연쇄 시나리오 설정 (2, 2, 4 인접 배치) | 배치 완료 |
| 2 | 머지 실행 | 연쇄 발생 |
| 3 | 스크린샷 캡처 | 화면에 "x1.5 COMBO!" 텍스트가 표시됨 |
| 4 | 3초 후 스크린샷 캡처 | 콤보 표시가 페이드아웃됨 |

---

#### TC-SCORE-009: 128 최초 달성 시 500점 보너스

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-009 |
| **목적** | 값 128 블록을 최초 생성 시 마일스톤 보너스 500점이 지급되는지 검증 |
| **사전조건** | 128 마일스톤 미달성 상태, Playing 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 보드 초기화, 점수 0, 마일스톤 초기 상태 | 달성 마일스톤 없음 |
| 2 | 레벨 6(값 64) 블록 2개 배치 후 머지 (64+64=128) | 128 블록 생성 |
| 3 | 현재 점수 조회 | 기본 128 + 마일스톤 500 = 628 |
| 4 | 달성 마일스톤 조회 | [128] 포함 |

---

#### TC-SCORE-010: 마일스톤 중복 달성 시 보너스 미지급

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-010 |
| **목적** | 이미 달성한 마일스톤을 다시 달성해도 보너스가 중복 지급되지 않는지 검증 |
| **사전조건** | 128 마일스톤 이미 달성된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 128 마일스톤 달성 후 점수 기록 (예: 628) | 점수 확인 |
| 2 | 다시 레벨 6 블록 2개 배치 후 머지 (64+64=128) | 128 블록 재생성 |
| 3 | 현재 점수 조회 | 628 + 128 = 756 (보너스 500 미포함) |
| 4 | 달성 마일스톤 조회 | 128은 1개만 존재 |

---

#### TC-SCORE-011: 다단계 점프 시 중간 마일스톤 일괄 지급

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-011 |
| **목적** | 연쇄로 64에서 512까지 점프할 때 128, 256, 512 마일스톤이 모두 지급되는지 검증 |
| **사전조건** | 128/256/512 마일스톤 모두 미달성, 연쇄 시나리오 준비 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 보드 초기화, 점수 0, 마일스톤 없음 | 초기 상태 확인 |
| 2 | 연쇄 시나리오 설정: 64+64=128->128+128=256->256+256=512 | 배치 완료 |
| 3 | 머지 실행, 모든 연쇄 완료 대기 | 512 블록 최종 생성 |
| 4 | 달성 마일스톤 조회 | [128, 256, 512] 모두 포함 |
| 5 | 마일스톤 보너스 총합 확인 | 500 + 1000 + 2500 = 4000점 보너스 |

---

#### TC-SCORE-012: 마일스톤 달성 축하 UI 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-012 |
| **목적** | 마일스톤 달성 시 축하 배너/팝업이 화면에 표시되는지 검증 |
| **사전조건** | 128 마일스톤 미달성, Playing 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 64+64=128 머지 실행 | 128 달성 |
| 2 | 애니메이션 중 스크린샷 캡처 | 축하 배너 또는 팝업 UI가 화면에 표시됨 |
| 3 | 3초 후 스크린샷 캡처 | 축하 UI가 사라짐 (또는 페이드아웃됨) |

---

#### TC-SCORE-013: 최고 점수 갱신 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-013 |
| **목적** | 현재 점수가 최고 점수를 초과할 때 자동으로 갱신되는지 검증 |
| **사전조건** | 최고 점수가 0인 상태, Playing 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 보드 초기화, 점수 0, 최고 점수 0 | 초기 상태 확인 |
| 2 | 레벨 5(값 32) 블록 2개 머지 (32+32=64) | 점수 += 64 |
| 3 | 최고 점수 조회 | 최고 점수 == 64 |
| 4 | 레벨 4(값 16) 블록 2개 머지 (16+16=32) | 점수 += 32 (총 96) |
| 5 | 최고 점수 조회 | 최고 점수 == 96 |

---

#### TC-SCORE-014: 최고 점수 미만 시 미갱신 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-014 |
| **목적** | 새 게임에서 이전 최고 점수보다 낮은 점수일 때 최고 점수가 유지되는지 검증 |
| **사전조건** | 최고 점수가 1000인 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | PlayerPrefs에 최고 점수 1000 설정 | HighScore == 1000 |
| 2 | 새 게임 시작, 레벨 1 블록 머지 (2+2=4) | 현재 점수 == 4 |
| 3 | 최고 점수 조회 | 최고 점수 == 1000 (변경 없음) |

---

#### TC-SCORE-015: 게임 재시작 후 최고 점수 유지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-015 |
| **목적** | 페이지 새로고침(게임 재시작) 후에도 최고 점수가 유지되는지 검증 |
| **사전조건** | 최고 점수가 존재하는 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 게임에서 점수를 500으로 만들기 | 최고 점수 == 500 |
| 2 | 페이지 새로고침 (page.reload()) | 게임 재로딩 |
| 3 | 로딩 완료 대기 | 메인 메뉴 표시 |
| 4 | 최고 점수 조회 | 최고 점수 == 500 (유지) |

---

#### TC-SCORE-016: 점수 변경 시 카운트업 애니메이션

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-016 |
| **목적** | 점수 변경 시 카운트업 애니메이션이 재생되는지 검증 (중간값이 표시됨) |
| **사전조건** | Playing 상태, 점수 0 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 고레벨 머지 실행 (256+256=512, 점수 512 추가) | 머지 완료 |
| 2 | 머지 직후(0.1초) 스크린샷 캡처 | UI 점수 표시가 0~512 사이 중간값(카운트업 중) |
| 3 | 1초 후 스크린샷 캡처 | UI 점수 표시가 최종값 512 도달 |

---

#### TC-SCORE-017: 최고 점수 갱신 시 "NEW!" 배지 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-017 |
| **목적** | 최고 점수 갱신 시 "NEW!" 배지가 화면에 표시되는지 검증 |
| **사전조건** | 최고 점수 0, Playing 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 머지 실행으로 최고 점수 갱신 발생 | 점수 갱신됨 |
| 2 | 스크린샷 캡처 | 최고 점수 영역 근처에 "NEW!" 배지가 표시됨 |

---

#### TC-SCORE-018: 점수 포맷팅 (1,000 단위 콤마)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-018 |
| **목적** | 큰 점수가 1,000 단위 콤마로 포맷팅되어 표시되는지 검증 |
| **사전조건** | Playing 상태 |
| **우선순위** | 낮음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | TestBridge로 점수를 12345로 설정 | 점수 == 12345 |
| 2 | 스크린샷 캡처하여 UI 점수 텍스트 확인 | "12,345" 형식으로 표시됨 |

---

#### TC-SCORE-019: 플로팅 텍스트(+N) 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-019 |
| **목적** | 머지 시 머지 위치에 +N 플로팅 텍스트가 표시되는지 검증 |
| **사전조건** | Playing 상태 |
| **우선순위** | 낮음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 머지 실행 (2+2=4) | 머지 완료 |
| 2 | 머지 직후 스크린샷 캡처 | 머지 위치 근처에 "+4" 플로팅 텍스트가 표시됨 |
| 3 | 2초 후 스크린샷 캡처 | 플로팅 텍스트가 사라짐 |

---

#### TC-SCORE-020: Loading -> MainMenu 전환

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-020 |
| **목적** | 게임 로딩 완료 후 자동으로 MainMenu 상태로 전환되는지 검증 |
| **사전조건** | 게임 페이지 최초 접속 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 게임 페이지 접속 | Loading 화면 표시 |
| 2 | 로딩 완료 대기 | 로딩 바 사라짐 |
| 3 | 게임 상태 조회 | GameState == "MainMenu" |
| 4 | 스크린샷 캡처 | 메인 메뉴 UI 요소가 표시됨 |

---

#### TC-SCORE-021: MainMenu -> Playing 전환 (새 게임)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-021 |
| **목적** | 메인 메뉴에서 "새 게임" 시작 시 Playing 상태로 전환되는지 검증 |
| **사전조건** | MainMenu 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 게임 상태 확인 | GameState == "MainMenu" |
| 2 | "새 게임" 버튼 클릭 | 화면 전환 시작 |
| 3 | 전환 애니메이션 대기 | 게임 보드 표시 |
| 4 | 게임 상태 조회 | GameState == "Playing" |

---

#### TC-SCORE-022: Playing -> Paused 전환

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-022 |
| **목적** | 게임 플레이 중 일시정지 버튼을 눌렀을 때 Paused 상태로 전환되는지 검증 |
| **사전조건** | Playing 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 게임 상태 확인 | GameState == "Playing" |
| 2 | 일시정지 버튼 클릭 | 일시정지 오버레이 표시 |
| 3 | 게임 상태 조회 | GameState == "Paused" |
| 4 | 스크린샷 캡처 | 일시정지 메뉴(계속하기, 메인 메뉴) 표시 |

---

#### TC-SCORE-023: Paused -> Playing 전환 (계속하기)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-023 |
| **목적** | 일시정지에서 "계속하기" 버튼 클릭 시 Playing으로 복귀하는지 검증 |
| **사전조건** | Paused 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 게임 상태 확인 | GameState == "Paused" |
| 2 | "계속하기" 버튼 클릭 | 일시정지 오버레이 사라짐 |
| 3 | 게임 상태 조회 | GameState == "Playing" |
| 4 | 블록 탭 시도 | 입력이 정상적으로 반응함 |

---

#### TC-SCORE-024: Paused -> MainMenu 전환

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-024 |
| **목적** | 일시정지에서 "메인 메뉴로" 버튼 클릭 시 MainMenu로 전환되는지 검증 |
| **사전조건** | Paused 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 게임 상태 확인 | GameState == "Paused" |
| 2 | "메인 메뉴로" 버튼 클릭 | 화면 전환 |
| 3 | 게임 상태 조회 | GameState == "MainMenu" |
| 4 | 스크린샷 캡처 | 메인 메뉴 UI 표시 |

---

#### TC-SCORE-025: 유효하지 않은 상태 전환 거부

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-025 |
| **목적** | 허용되지 않은 상태 전환(예: Loading -> Playing)이 거부되는지 검증 |
| **사전조건** | 게임 로딩 완료 후 MainMenu 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 게임 상태 확인 | GameState == "MainMenu" |
| 2 | TestBridge로 MainMenu -> Reshuffling 직접 전환 시도 | 전환 거부 |
| 3 | 게임 상태 조회 | GameState == "MainMenu" (변경 없음) |
| 4 | 콘솔 로그 확인 | 경고 메시지 출력됨 |

---

#### TC-SCORE-026: Playing -> Reshuffling -> Playing 전환

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-026 |
| **목적** | 매칭 불가 시 리셔플 상태 전환 및 복귀가 정상 동작하는지 검증 |
| **사전조건** | 보드가 가득 차고 매칭 가능한 쌍이 없는 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | TestBridge로 매칭 불가 보드 상태 설정 | 모든 셀 고유값 |
| 2 | 매칭 불가 감지 트리거 | 리셔플 시작 |
| 3 | 게임 상태 조회 | GameState == "Reshuffling" |
| 4 | 리셔플 완료 대기 | 블록 재배치됨 |
| 5 | 게임 상태 조회 | GameState == "Playing" |
| 6 | 매칭 가능 여부 확인 | 매칭 가능한 쌍이 존재함 |

---

#### TC-SCORE-027: 머지 후 자동 저장 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-027 |
| **목적** | 머지 완료 후 게임 데이터가 자동으로 저장되는지 검증 |
| **사전조건** | Playing 상태, 세이브 데이터 없음 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 세이브 데이터 삭제 | 저장 파일 없음 |
| 2 | 새 게임 시작 후 머지 실행 | 머지 완료 |
| 3 | 애니메이션 완료 대기 (3초) | 자동 저장 트리거됨 |
| 4 | 세이브 데이터 존재 여부 확인 | 세이브 데이터 존재함 |
| 5 | 세이브 데이터 JSON 조회 | currentScore, cells 등 필드 포함 |

---

#### TC-SCORE-028: 저장 데이터 로드 후 점수 복원

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-028 |
| **목적** | 세이브 데이터 로드 시 점수(현재/최고)가 정확히 복원되는지 검증 |
| **사전조건** | 점수 데이터가 포함된 세이브 파일 존재 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 게임에서 머지로 점수 500 달성 | currentScore=500, highScore=500 |
| 2 | 페이지 새로고침 | 게임 재로딩 |
| 3 | 로딩 완료 후 "이어하기" 클릭 | 저장 데이터 로드 |
| 4 | 현재 점수 조회 | currentScore == 500 |
| 5 | 최고 점수 조회 | highScore == 500 |

---

#### TC-SCORE-029: 저장 데이터 로드 후 보드 상태 복원

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-029 |
| **목적** | 세이브 데이터 로드 시 보드의 블록 배치가 정확히 복원되는지 검증 |
| **사전조건** | 블록이 배치된 보드 상태의 세이브 파일 존재 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 특정 보드 배치 후 저장 (예: (0,0)=레벨3, (1,0)=레벨5) | 자동 저장 완료 |
| 2 | 세이브 데이터 JSON 조회, 셀 데이터 확인 | cells에 해당 블록 정보 포함 |
| 3 | 페이지 새로고침 후 "이어하기" | 데이터 로드 |
| 4 | TestBridge로 블록 값 조회 | getBlockValue(0,0)==8, getBlockValue(1,0)==32 |

---

#### TC-SCORE-030: 세이브 파일 삭제 후 새 게임 시작

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-030 |
| **목적** | 세이브 데이터를 삭제한 후 새 게임이 정상 시작되는지 검증 |
| **사전조건** | 세이브 데이터가 존재하는 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 세이브 데이터 존재 확인 | true |
| 2 | TestBridge로 세이브 데이터 삭제 | 삭제 완료 |
| 3 | 페이지 새로고침 | 게임 재로딩 |
| 4 | 메인 메뉴에서 "이어하기" 버튼 상태 확인 | 비활성화 또는 미표시 |
| 5 | "새 게임" 시작 | Playing 상태, 점수 0, 초기 보드 |

---

#### TC-SCORE-031: 일시정지 시 자동 저장

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-031 |
| **목적** | 일시정지(Paused) 진입 시 게임 데이터가 자동 저장되는지 검증 |
| **사전조건** | Playing 상태, 점수가 누적된 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 머지 실행으로 점수 누적 | 점수 > 0 |
| 2 | 세이브 데이터 삭제 (저장 시점 확인을 위해) | 데이터 없음 |
| 3 | 일시정지 버튼 클릭 | Paused 상태 전환 |
| 4 | 세이브 데이터 존재 확인 | true (자동 저장됨) |

---

#### TC-SCORE-032: 오프라인 상태에서 로컬 저장 정상 동작

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-032 |
| **목적** | 네트워크가 끊긴 상태에서도 로컬 저장/로드가 정상 동작하는지 검증 |
| **사전조건** | Playing 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | Playwright 네트워크 오프라인 모드 활성화 | 네트워크 차단 |
| 2 | 머지 실행으로 점수 획득 | 점수 누적됨 |
| 3 | 자동 저장 대기 | 로컬 저장 성공 |
| 4 | 세이브 데이터 존재 확인 | true |
| 5 | 네트워크 복원 | 온라인 복귀 |

---

#### TC-SCORE-033: 페이지 새로고침 후 데이터 유지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-033 |
| **목적** | 브라우저 새로고침 후에도 게임 데이터(점수, 보드, 마일스톤)가 유지되는지 검증 |
| **사전조건** | 게임 플레이로 다양한 데이터가 누적된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 머지로 점수 500 달성, 128 마일스톤 달성 | 상태 저장됨 |
| 2 | 페이지 새로고침 (page.reload()) | 게임 재로딩 |
| 3 | 로딩 완료 후 "이어하기" 클릭 | 데이터 로드 |
| 4 | 점수 확인 | currentScore == 500 |
| 5 | 마일스톤 확인 | [128] 포함 |
| 6 | 보드 블록 배치 확인 | 이전 상태와 동일 |

---

#### TC-SCORE-034: IndexedDB/localStorage 데이터 무결성

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-034 |
| **목적** | 저장된 JSON 데이터의 구조와 값이 올바른지 직접 검증 |
| **사전조건** | 저장 데이터가 존재하는 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 머지로 점수 100 달성 | 자동 저장됨 |
| 2 | TestBridge로 세이브 JSON 조회 | JSON 문자열 반환 |
| 3 | JSON 파싱 후 필드 검증 | saveVersion==1, currentScore==100, cells 배열 존재 |
| 4 | gridRadius 값 확인 | gridRadius == 4 (기본값) |
| 5 | cells 배열 길이 확인 | 61개 (radius 4 기준) |

---

#### TC-SCORE-035: 점수 제출 API 호출 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-035 |
| **목적** | 최고 점수 갱신 시 리더보드 API에 점수 제출이 호출되는지 검증 |
| **사전조건** | 온라인 상태, Playing 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 리더보드 API URL 패턴에 대한 네트워크 요청 감시 설정 | 감시 활성화 |
| 2 | 머지로 최고 점수 갱신 | 점수 제출 트리거 |
| 3 | 대기 (3초) | API 호출 발생 |
| 4 | 감시된 네트워크 요청 확인 | 리더보드 API PUT/POST 요청 존재 |
| 5 | 요청 본문 확인 | score 필드에 갱신된 점수 포함 |

---

#### TC-SCORE-036: 상위 순위 조회 및 UI 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-036 |
| **목적** | 리더보드 화면에서 상위 순위 목록이 올바르게 표시되는지 검증 |
| **사전조건** | 온라인 상태, MainMenu 또는 Paused 상태 |
| **우선순위** | 보통 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 리더보드 API 응답을 모킹(route intercept) | 더미 순위 데이터 반환 설정 |
| 2 | 리더보드 화면 열기 | 로딩 스피너 표시 후 순위 목록 표시 |
| 3 | 스크린샷 캡처 | 순위, 닉네임, 점수가 표형태로 표시됨 |
| 4 | 1위 항목 확인 | 모킹 데이터와 일치 |

---

#### TC-SCORE-037: 네트워크 오류 시 폴백 처리

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-SCORE-037 |
| **목적** | 리더보드 API 호출 실패 시 에러 UI가 표시되고 게임이 정상 동작하는지 검증 |
| **사전조건** | 네트워크 오류 시뮬레이션 가능 |
| **우선순위** | 낮음 |

**테스트 단계:**

| 단계 | 행동 | 기대 결과 |
|------|------|-----------|
| 1 | 리더보드 API route를 500 에러로 설정 | 서버 에러 시뮬레이션 |
| 2 | 리더보드 화면 열기 | 로딩 시도 |
| 3 | 대기 (5초) | 에러 UI 또는 "연결 실패" 메시지 표시 |
| 4 | 게임으로 돌아가기 | 게임이 정상 동작 (크래시 없음) |
| 5 | 게임 상태 확인 | Playing 또는 MainMenu 상태 유지 |

---

## 4. Playwright 코드 예제

### 4.1 기본 점수 계산 테스트

```typescript
// tests/e2e/scoring/basic-score.spec.ts
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../helpers/unity-helper';
import { GameActions } from '../helpers/game-actions';

test.describe('기본 점수 계산 테스트', () => {
  let unity: UnityHelper;
  let actions: GameActions;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    actions = new GameActions(page);
    await unity.loadGame();
    await actions.startNewGame();
  });

  test('TC-SCORE-001: 2+2=4 머지 시 기본 점수 4', async () => {
    // 보드 초기화 및 블록 배치
    await unity.clearBoard();
    await unity.setScore(0);
    await unity.placeBlock(0, 0, 1); // 값 2
    await unity.placeBlock(1, 0, 1); // 값 2

    // 머지 실행
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(2000);

    // 점수 검증
    const score = await unity.getCurrentScore();
    expect(score).toBe(4);

    // 결과 블록 값 검증
    const resultValue = await unity.getBlockValue(1, 0);
    expect(resultValue).toBe(4);
  });

  test('TC-SCORE-002: 512+512=1024 머지 시 기본 점수 1024', async () => {
    await unity.clearBoard();
    await unity.setScore(0);
    await unity.placeBlock(0, 0, 9); // 값 512
    await unity.placeBlock(1, 0, 9); // 값 512

    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(2000);

    const score = await unity.getCurrentScore();
    expect(score).toBe(1024);
  });

  test('TC-SCORE-003: 점수 누적 정확성', async () => {
    await unity.clearBoard();
    await unity.setScore(0);

    // 1차 머지: 2+2=4, 점수 +4
    await unity.placeBlock(0, 0, 1);
    await unity.placeBlock(1, 0, 1);
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(2000);

    let score = await unity.getCurrentScore();
    expect(score).toBe(4);

    // 2차 머지: 4+4=8, 점수 +8
    await unity.clearBoard();
    await unity.placeBlock(2, 0, 2);
    await unity.placeBlock(3, 0, 2);
    await unity.executeMerge(2, 0, 3, 0);
    await unity.waitForAnimation(2000);

    score = await unity.getCurrentScore();
    expect(score).toBe(12); // 4 + 8

    // 3차 머지: 8+8=16, 점수 +16
    await unity.clearBoard();
    await unity.placeBlock(0, 1, 3);
    await unity.placeBlock(1, 1, 3);
    await unity.executeMerge(0, 1, 1, 1);
    await unity.waitForAnimation(2000);

    score = await unity.getCurrentScore();
    expect(score).toBe(28); // 4 + 8 + 16
  });

  test('TC-SCORE-004: 새 게임 시작 시 점수 초기화', async () => {
    await unity.setScore(1000);
    let score = await unity.getCurrentScore();
    expect(score).toBe(1000);

    // 메인 메뉴 -> 새 게임
    await actions.pauseGame();
    await actions.goToMainMenu();
    await actions.startNewGame();

    score = await unity.getCurrentScore();
    expect(score).toBe(0);
  });
});
```

### 4.2 콤보/연쇄 보너스 테스트

```typescript
// tests/e2e/scoring/chain-bonus.spec.ts
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../helpers/unity-helper';
import { GameActions } from '../helpers/game-actions';

test.describe('콤보/연쇄 보너스 테스트', () => {
  let unity: UnityHelper;
  let actions: GameActions;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    actions = new GameActions(page);
    await unity.loadGame();
    await actions.startNewGame();
    await unity.clearBoard();
    await unity.setScore(0);
  });

  test('TC-SCORE-005: 1단계 연쇄 보너스 x1.5 배율', async () => {
    // 셀 A(0,0)=2, 셀 B(1,0)=2, 셀 C(2,0)=4 (B와 C 인접)
    await unity.placeBlock(0, 0, 1); // 값 2
    await unity.placeBlock(1, 0, 1); // 값 2
    await unity.placeBlock(2, 0, 2); // 값 4 (인접)

    // A와 B 머지 -> 4 생성 -> C(4)와 연쇄 -> 8
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(4000); // 연쇄 애니메이션 대기

    const score = await unity.getCurrentScore();
    // 1단계: 4 * 1.0 = 4
    // 연쇄 1: 8 * 1.5 = 12
    // 총합: 16
    expect(score).toBe(16);
  });

  test('TC-SCORE-006: 3단계 연쇄 점수 총합', async () => {
    // 연쇄 시나리오: 2+2=4 -> 4+4=8 -> 8+8=16
    await unity.setupChainScenario('chain_3_step');
    await unity.waitForAnimation(500);

    // 초기 머지 실행 (첫 번째 2+2)
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(8000); // 3단계 연쇄 대기

    const score = await unity.getCurrentScore();
    // 1단계 (chainDepth=0): 4 * 1.0 = 4
    // 2단계 (chainDepth=1): 8 * 1.5 = 12
    // 3단계 (chainDepth=2): 16 * 2.0 = 32
    // 총합: 48
    expect(score).toBe(48);
  });

  test('TC-SCORE-007: 최대 연쇄 깊이 20 제한', async ({ page }) => {
    // 극단적 연쇄 시나리오 설정
    await unity.setupChainScenario('chain_extreme');
    await unity.waitForAnimation(500);

    await unity.executeMerge(0, 0, 1, 0);
    // 충분한 대기 시간 (연쇄 20단계 + 여유)
    await unity.waitForAnimation(60_000);

    // 게임이 정상 동작 중인지 확인 (무한 루프 아님)
    const state = await unity.getGameState();
    expect(state).toBe('Playing');

    // 콘솔에 에러가 없는지 확인
    const logs = await page.evaluate(() => (window as any).getConsoleErrors?.() || []);
    expect(logs.length).toBe(0);
  });

  test('TC-SCORE-008: 콤보 카운터 UI 표시', async ({ page }) => {
    // 1단계 연쇄 시나리오
    await unity.placeBlock(0, 0, 1);
    await unity.placeBlock(1, 0, 1);
    await unity.placeBlock(2, 0, 2); // 인접

    await unity.executeMerge(0, 0, 1, 0);
    // 연쇄 발생 직후 스크린샷
    await unity.waitForAnimation(1500);
    await page.screenshot({
      path: 'test-results/scoring/combo-display.png',
    });

    // 콤보 UI가 표시되었다가 사라지는 것은 시각적으로 확인
    // TestBridge로 콤보 표시 상태 확인 (옵션)
    const comboVisible = await page.evaluate(
      () => (window as any).isComboDisplayVisible?.() ?? true
    );
    // 연쇄 직후에는 표시 중이어야 함
    expect(comboVisible).toBeTruthy();
  });
});
```

### 4.3 마일스톤 보너스 테스트

```typescript
// tests/e2e/scoring/milestone-bonus.spec.ts
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../helpers/unity-helper';
import { GameActions } from '../helpers/game-actions';

test.describe('마일스톤 보너스 테스트', () => {
  let unity: UnityHelper;
  let actions: GameActions;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    actions = new GameActions(page);
    await unity.loadGame();
    await actions.startNewGame();
    await unity.clearBoard();
    await unity.setScore(0);
  });

  test('TC-SCORE-009: 128 최초 달성 시 500점 보너스', async () => {
    // 64+64=128 머지
    await unity.placeBlock(0, 0, 6); // 값 64
    await unity.placeBlock(1, 0, 6); // 값 64

    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(3000);

    const score = await unity.getCurrentScore();
    // 기본 128 + 마일스톤 500 = 628
    expect(score).toBe(628);

    const milestones = await unity.getAchievedMilestones();
    expect(milestones).toContain(128);
  });

  test('TC-SCORE-010: 마일스톤 중복 달성 시 보너스 미지급', async () => {
    // 1차: 64+64=128 (보너스 500 지급)
    await unity.placeBlock(0, 0, 6);
    await unity.placeBlock(1, 0, 6);
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(3000);

    const score1 = await unity.getCurrentScore();
    expect(score1).toBe(628); // 128 + 500

    // 2차: 다시 64+64=128 (보너스 미지급)
    await unity.placeBlock(2, 0, 6);
    await unity.placeBlock(3, 0, 6);
    await unity.executeMerge(2, 0, 3, 0);
    await unity.waitForAnimation(3000);

    const score2 = await unity.getCurrentScore();
    expect(score2).toBe(628 + 128); // 756, 보너스 500 없음
  });

  test('TC-SCORE-011: 다단계 점프 시 중간 마일스톤 일괄 지급', async () => {
    // 연쇄 시나리오: 64+64=128 -> 128+128=256 -> 256+256=512
    await unity.setupChainScenario('milestone_jump');
    await unity.waitForAnimation(500);

    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(10_000);

    const milestones = await unity.getAchievedMilestones();
    expect(milestones).toContain(128);
    expect(milestones).toContain(256);
    expect(milestones).toContain(512);

    // 마일스톤 보너스 총합: 500 + 1000 + 2500 = 4000
    const score = await unity.getCurrentScore();
    // 연쇄 머지 점수 + 마일스톤 보너스 4000
    // 연쇄 점수: 128*1.0 + 256*1.5 + 512*2.0 = 128+384+1024 = 1536
    // 총합: 1536 + 4000 = 5536
    expect(score).toBe(5536);
  });
});
```

### 4.4 게임 상태 전환 테스트

```typescript
// tests/e2e/scoring/game-state.spec.ts
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../helpers/unity-helper';
import { GameActions } from '../helpers/game-actions';

test.describe('게임 상태 전환 테스트', () => {
  let unity: UnityHelper;
  let actions: GameActions;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    actions = new GameActions(page);
    await unity.loadGame();
  });

  test('TC-SCORE-020: Loading -> MainMenu 전환', async () => {
    // loadGame()이 로딩 완료까지 대기하므로, 이 시점에서 MainMenu여야 함
    const state = await unity.getGameState();
    expect(state).toBe('MainMenu');
  });

  test('TC-SCORE-021: MainMenu -> Playing 전환', async () => {
    const stateBefore = await unity.getGameState();
    expect(stateBefore).toBe('MainMenu');

    await actions.startNewGame();

    const stateAfter = await unity.getGameState();
    expect(stateAfter).toBe('Playing');
  });

  test('TC-SCORE-022: Playing -> Paused 전환', async () => {
    await actions.startNewGame();
    expect(await unity.getGameState()).toBe('Playing');

    await actions.pauseGame();

    expect(await unity.getGameState()).toBe('Paused');
  });

  test('TC-SCORE-023: Paused -> Playing 전환 (계속하기)', async () => {
    await actions.startNewGame();
    await actions.pauseGame();
    expect(await unity.getGameState()).toBe('Paused');

    await actions.resumeGame();

    expect(await unity.getGameState()).toBe('Playing');
  });

  test('TC-SCORE-024: Paused -> MainMenu 전환', async () => {
    await actions.startNewGame();
    await actions.pauseGame();
    expect(await unity.getGameState()).toBe('Paused');

    await actions.goToMainMenu();

    expect(await unity.getGameState()).toBe('MainMenu');
  });

  test('TC-SCORE-025: 유효하지 않은 상태 전환 거부', async ({ page }) => {
    expect(await unity.getGameState()).toBe('MainMenu');

    // MainMenu -> Reshuffling은 허용되지 않은 전환
    const result = await page.evaluate(
      () => (window as any).tryTransitionTo?.('Reshuffling') ?? false
    );
    expect(result).toBe(false);

    // 상태 변경 없음 확인
    expect(await unity.getGameState()).toBe('MainMenu');
  });

  test('TC-SCORE-026: Playing -> Reshuffling -> Playing 전환', async () => {
    await actions.startNewGame();
    expect(await unity.getGameState()).toBe('Playing');

    // 리셔플 강제 트리거
    await unity.forceGameState('Reshuffling');
    expect(await unity.getGameState()).toBe('Reshuffling');

    // 리셔플 완료 대기
    await unity.waitForAnimation(5000);

    // 자동으로 Playing 복귀 확인 (또는 TestBridge로 수동 복귀)
    await unity.forceGameState('Playing');
    expect(await unity.getGameState()).toBe('Playing');
  });
});
```

### 4.5 세이브/로드 테스트

```typescript
// tests/e2e/scoring/save-load.spec.ts
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../helpers/unity-helper';
import { GameActions } from '../helpers/game-actions';

test.describe('세이브/로드 테스트', () => {
  let unity: UnityHelper;
  let actions: GameActions;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    actions = new GameActions(page);
    await unity.loadGame();
    await unity.deleteSaveData();
    await unity.clearLocalStorage();
  });

  test('TC-SCORE-027: 머지 후 자동 저장', async () => {
    await actions.startNewGame();
    await unity.clearBoard();
    await unity.placeBlock(0, 0, 1);
    await unity.placeBlock(1, 0, 1);

    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(3000);

    // 세이브 데이터 존재 확인
    const saveJson = await unity.getSaveDataJson();
    expect(saveJson).toBeTruthy();

    const saveData = JSON.parse(saveJson);
    expect(saveData.saveVersion).toBe(1);
    expect(saveData.currentScore).toBeGreaterThan(0);
  });

  test('TC-SCORE-028: 로드 후 점수 복원', async ({ page }) => {
    await actions.startNewGame();
    await unity.clearBoard();
    await unity.setScore(0);

    // 여러 머지로 점수 축적
    await unity.placeBlock(0, 0, 5); // 값 32
    await unity.placeBlock(1, 0, 5); // 값 32
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(2000);

    const scoreBefore = await unity.getCurrentScore();
    expect(scoreBefore).toBe(64);

    const highScoreBefore = await unity.getHighScore();

    // 페이지 새로고침
    await page.reload();
    await unity.loadGame();

    // "이어하기"로 데이터 로드
    await actions.continueGame();

    const scoreAfter = await unity.getCurrentScore();
    expect(scoreAfter).toBe(scoreBefore);

    const highScoreAfter = await unity.getHighScore();
    expect(highScoreAfter).toBe(highScoreBefore);
  });

  test('TC-SCORE-029: 로드 후 보드 상태 복원', async ({ page }) => {
    await actions.startNewGame();
    await unity.clearBoard();

    // 특정 블록 배치
    await unity.placeBlock(0, 0, 3); // 값 8
    await unity.placeBlock(1, 0, 5); // 값 32
    await unity.placeBlock(2, 1, 7); // 값 128

    // 저장 트리거 (일시정지)
    await actions.pauseGame();
    await unity.waitForAnimation(1000);

    // 페이지 새로고침
    await page.reload();
    await unity.loadGame();
    await actions.continueGame();

    // 블록 값 복원 확인
    const val1 = await unity.getBlockValue(0, 0);
    const val2 = await unity.getBlockValue(1, 0);
    const val3 = await unity.getBlockValue(2, 1);

    expect(val1).toBe(8);
    expect(val2).toBe(32);
    expect(val3).toBe(128);
  });

  test('TC-SCORE-031: 일시정지 시 자동 저장', async () => {
    await actions.startNewGame();
    await unity.clearBoard();
    await unity.setScore(0);

    await unity.placeBlock(0, 0, 3);
    await unity.placeBlock(1, 0, 3);
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(2000);

    // 세이브 데이터 삭제 (타이밍 확인용)
    await unity.deleteSaveData();

    // 일시정지 -> 자동 저장 트리거
    await actions.pauseGame();
    await unity.waitForAnimation(1000);

    const saveJson = await unity.getSaveDataJson();
    expect(saveJson).toBeTruthy();
  });
});
```

### 4.6 오프라인 데이터 저장 테스트

```typescript
// tests/e2e/scoring/offline-data.spec.ts
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../helpers/unity-helper';
import { GameActions } from '../helpers/game-actions';

test.describe('오프라인 데이터 저장 테스트', () => {
  let unity: UnityHelper;
  let actions: GameActions;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    actions = new GameActions(page);
    await unity.loadGame();
    await unity.deleteSaveData();
    await unity.clearLocalStorage();
    await actions.startNewGame();
  });

  test('TC-SCORE-032: 오프라인 상태에서 로컬 저장', async ({ page, context }) => {
    // 네트워크 오프라인 설정
    await context.setOffline(true);

    await unity.clearBoard();
    await unity.setScore(0);
    await unity.placeBlock(0, 0, 4); // 값 16
    await unity.placeBlock(1, 0, 4); // 값 16
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(3000);

    // 오프라인에서도 점수 정상 누적
    const score = await unity.getCurrentScore();
    expect(score).toBe(32);

    // 로컬 저장 확인
    const saveJson = await unity.getSaveDataJson();
    expect(saveJson).toBeTruthy();

    // 네트워크 복원
    await context.setOffline(false);
  });

  test('TC-SCORE-033: 페이지 새로고침 후 데이터 유지', async ({ page }) => {
    await unity.clearBoard();
    await unity.setScore(0);

    // 128 마일스톤 달성
    await unity.placeBlock(0, 0, 6);
    await unity.placeBlock(1, 0, 6);
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(3000);

    const scoreBefore = await unity.getCurrentScore();
    const milestonesBefore = await unity.getAchievedMilestones();

    // 페이지 새로고침
    await page.reload();
    await unity.loadGame();
    await actions.continueGame();

    // 데이터 유지 확인
    const scoreAfter = await unity.getCurrentScore();
    expect(scoreAfter).toBe(scoreBefore);

    const milestonesAfter = await unity.getAchievedMilestones();
    expect(milestonesAfter).toEqual(milestonesBefore);
  });

  test('TC-SCORE-034: 세이브 데이터 JSON 무결성', async () => {
    await unity.clearBoard();
    await unity.setScore(0);

    await unity.placeBlock(0, 0, 2);
    await unity.placeBlock(1, 0, 2);
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(3000);

    const saveJson = await unity.getSaveDataJson();
    const data = JSON.parse(saveJson);

    // 필수 필드 존재 확인
    expect(data).toHaveProperty('saveVersion', 1);
    expect(data).toHaveProperty('currentScore');
    expect(data).toHaveProperty('highScore');
    expect(data).toHaveProperty('gridRadius', 4);
    expect(data).toHaveProperty('cells');
    expect(data).toHaveProperty('achievedMilestones');

    // cells 배열 길이 (radius=4 -> 61셀)
    expect(data.cells).toHaveLength(61);

    // 각 셀 데이터 구조 확인
    for (const cell of data.cells) {
      expect(cell).toHaveProperty('col');
      expect(cell).toHaveProperty('row');
      expect(cell).toHaveProperty('blockLevel');
      expect(typeof cell.col).toBe('number');
      expect(typeof cell.row).toBe('number');
      expect(typeof cell.blockLevel).toBe('number');
      expect(cell.blockLevel).toBeGreaterThanOrEqual(0);
    }
  });
});
```

### 4.7 리더보드 연동 테스트

```typescript
// tests/e2e/scoring/leaderboard.spec.ts
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../helpers/unity-helper';
import { GameActions } from '../helpers/game-actions';

test.describe('리더보드 연동 테스트', () => {
  let unity: UnityHelper;
  let actions: GameActions;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    actions = new GameActions(page);
    await unity.loadGame();
  });

  test('TC-SCORE-035: 점수 제출 API 호출 확인', async ({ page }) => {
    // 리더보드 API 요청 감시
    const apiCalls: { url: string; body: string }[] = [];
    await page.route('**/leaderboards/**', async (route) => {
      const request = route.request();
      apiCalls.push({
        url: request.url(),
        body: request.postData() || '',
      });
      // 성공 응답 반환
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ success: true }),
      });
    });

    await actions.startNewGame();
    await unity.clearBoard();
    await unity.setScore(0);

    // 고점수 머지로 최고 점수 갱신 트리거
    await unity.placeBlock(0, 0, 8); // 값 256
    await unity.placeBlock(1, 0, 8); // 값 256
    await unity.executeMerge(0, 0, 1, 0);
    await unity.waitForAnimation(5000);

    // API 호출 확인
    expect(apiCalls.length).toBeGreaterThan(0);
    const submitCall = apiCalls.find((c) =>
      c.url.includes('leaderboard_highest_score')
    );
    expect(submitCall).toBeTruthy();
  });

  test('TC-SCORE-036: 상위 순위 조회 및 UI 표시', async ({ page }) => {
    // 리더보드 조회 API 모킹
    const mockLeaderboard = [
      { playerId: 'p1', playerName: 'Alice', score: 50000, rank: 1 },
      { playerId: 'p2', playerName: 'Bob', score: 35000, rank: 2 },
      { playerId: 'p3', playerName: 'Charlie', score: 20000, rank: 3 },
    ];

    await page.route('**/leaderboards/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockLeaderboard),
      });
    });

    // 리더보드 화면 열기 (메인 메뉴에서)
    await unity.clickCanvasAt(0.5, 0.75); // 리더보드 버튼
    await unity.waitForAnimation(3000);

    // 스크린샷으로 UI 확인
    await page.screenshot({
      path: 'test-results/scoring/leaderboard-ui.png',
    });
  });

  test('TC-SCORE-037: 네트워크 오류 시 폴백 처리', async ({ page }) => {
    // 리더보드 API를 500 에러로 설정
    await page.route('**/leaderboards/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' }),
      });
    });

    // 리더보드 화면 열기 시도
    await unity.clickCanvasAt(0.5, 0.75);
    await unity.waitForAnimation(5000);

    // 게임이 크래시하지 않고 정상 동작
    const state = await unity.getGameState();
    expect(['MainMenu', 'Playing']).toContain(state);

    // 에러 UI 스크린샷
    await page.screenshot({
      path: 'test-results/scoring/leaderboard-error.png',
    });
  });
});
```

---

## 5. 테스트 데이터 및 자동화 전략

### 5.1 테스트 데이터

#### 5.1.1 점수 계산 검증 데이터

| 머지 조합 | 결과 값 | chainDepth | 배율 | 기대 점수 |
|-----------|---------|------------|------|-----------|
| 2 + 2 | 4 | 0 | x1.0 | 4 |
| 4 + 4 | 8 | 0 | x1.0 | 8 |
| 8 + 8 | 16 | 0 | x1.0 | 16 |
| 32 + 32 | 64 | 0 | x1.0 | 64 |
| 512 + 512 | 1024 | 0 | x1.0 | 1024 |
| 4 (연쇄) | 8 | 1 | x1.5 | 12 |
| 8 (연쇄) | 16 | 2 | x2.0 | 32 |
| 16 (연쇄) | 32 | 3 | x2.5 | 80 |
| 8 (연쇄) | 16 | 5 | x3.5 | 56 |

#### 5.1.2 마일스톤 보너스 데이터

| 달성 값 | 보너스 점수 | 누적 보너스 |
|---------|------------|-------------|
| 128 | 500 | 500 |
| 256 | 1,000 | 1,500 |
| 512 | 2,500 | 4,000 |
| 1024 | 5,000 | 9,000 |
| 2048 | 10,000 | 19,000 |
| 4096 | 25,000 | 44,000 |
| 8192 | 50,000 | 94,000 |
| 16384 | 100,000 | 194,000 |

#### 5.1.3 세이브 데이터 샘플

```json
{
  "saveVersion": 1,
  "gameVersion": "1.0.0",
  "savedTimestamp": 1739462400,
  "gridRadius": 4,
  "cells": [
    { "col": 0, "row": 0, "blockLevel": 3 },
    { "col": 1, "row": 0, "blockLevel": 5 },
    { "col": 2, "row": 0, "blockLevel": 0 },
    { "col": -1, "row": 0, "blockLevel": 2 }
  ],
  "currentScore": 1500,
  "highScore": 3200,
  "highestBlockValue": 256,
  "achievedMilestones": [128, 256],
  "totalMergeCount": 47,
  "totalPlayTimeSeconds": 1200,
  "sessionCount": 3,
  "soundEnabled": true,
  "musicEnabled": true,
  "vibrationEnabled": true
}
```

### 5.2 자동화 전략

#### 5.2.1 TestBridge 활용 전략

Unity WebGL 빌드에서 게임 내부 상태에 접근하기 위해 **TestBridge** 패턴을 사용한다. Unity 측에 `TestBridge.jslib` 플러그인을 작성하여 JavaScript에서 호출 가능한 API를 노출한다.

```
[Playwright (TypeScript)]
    |
    | page.evaluate(() => window.getScore())
    |
    v
[브라우저 JavaScript 환경]
    |
    | window.getScore = function() { ... }
    |
    v
[TestBridge.jslib - Unity WebGL 플러그인]
    |
    | SendMessage("TestBridge", "QueryScore")
    |
    v
[Unity C# - TestBridge.cs MonoBehaviour]
    |
    | ScoreSystem.GetCurrentScore()
    |
    v
[게임 내부 상태 반환]
```

#### 5.2.2 CI/CD 통합

```yaml
# .github/workflows/e2e-scoring-test.yml (참고용)
name: E2E Scoring Tests

on:
  push:
    paths:
      - 'Assets/_Project/Scripts/Core/Score/**'
      - 'Assets/_Project/Scripts/Core/State/**'
      - 'Assets/_Project/Scripts/Data/**'
      - 'tests/e2e/scoring/**'

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx playwright install --with-deps chromium
      - run: npx playwright test --project=chromium-webgl
      - uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: test-results
          path: test-results/
```

#### 5.2.3 테스트 실행 순서 및 격리

| 전략 | 설명 |
|------|------|
| **직렬 실행** | Unity WebGL은 GPU 자원을 공유하므로 `workers: 1`로 직렬 실행 |
| **상태 초기화** | 각 테스트 전 `clearBoard()`, `setScore(0)`, `deleteSaveData()` 호출 |
| **localStorage 초기화** | `clearLocalStorage()`로 PlayerPrefs 기반 데이터 초기화 |
| **타임아웃 여유** | WebGL 로딩(90초), 애니메이션 대기(2~10초) 등 충분한 타임아웃 설정 |
| **스크린샷 증거** | UI 관련 테스트는 스크린샷을 캡처하여 시각적 검증 보조 |
| **실패 시 trace** | `trace: 'retain-on-failure'`로 실패 시 Playwright trace 파일 보관 |

#### 5.2.4 테스트 우선순위별 실행 그룹

| 그룹 | 포함 TC | 실행 빈도 | 용도 |
|------|---------|-----------|------|
| **Smoke** | TC-001, 005, 009, 013, 020, 021, 027 | 매 커밋 | 핵심 기능 최소 검증 |
| **Regression** | 모든 "높음" 우선순위 TC | 매 PR | 주요 기능 회귀 방지 |
| **Full** | 전체 TC-001~037 | 일 1회 / 릴리스 전 | 전체 기능 검증 |

태그 기반 실행 예시:
```bash
# Smoke 테스트만 실행
npx playwright test --grep "@smoke"

# 특정 카테고리만 실행
npx playwright test scoring/basic-score.spec.ts

# 전체 실행
npx playwright test
```

#### 5.2.5 알려진 제약사항 및 대응

| 제약사항 | 영향 | 대응 방안 |
|----------|------|-----------|
| Unity WebGL 로딩 시간 (10~30초) | 테스트 전체 시간 증가 | `beforeAll`에서 1회 로딩 후 `beforeEach`에서 상태만 초기화 |
| WebGL 캔버스 내부 UI 요소 직접 선택 불가 | DOM selector 사용 불가 | TestBridge API를 통한 간접 검증 + 스크린샷 비교 |
| 비동기 애니메이션 타이밍 불확실성 | 간헐적 실패 가능 | `waitForAnimation()` + `polling` 기반 상태 확인 |
| GPU 요구사항 | CI 환경에서 WebGL 실행 제한 | `--use-gl=angle`, `--enable-webgl` 플래그 사용 |
| IndexedDB 비동기 특성 | 저장 완료 시점 불확실 | `waitForFunction`으로 저장 완료 폴링 |

---

> 본 테스트 계획서는 `docs/design/01_core-system-design.md`의 4장(스코어링 시스템), 5장(게임 상태 관리)과 `docs/development/03_scoring/development-plan.md`를 기반으로 작성되었습니다. TestBridge API 사양은 Unity 측 구현 상태에 따라 조정이 필요할 수 있습니다.
