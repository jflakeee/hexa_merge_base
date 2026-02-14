# 머지 시스템 Playwright 테스트 계획서

| 항목 | 내용 |
|------|------|
| **대상 시스템** | 블록 시스템 + 머지(합치기) 시스템 |
| **설계문서 참조** | `docs/design/01_core-system-design.md` 섹션 2, 3 |
| **개발계획 참조** | `docs/development/02_merge-system/development-plan.md` |
| **테스트 도구** | Playwright (TypeScript) |
| **플랫폼** | Unity WebGL 빌드 -> 브라우저 |
| **문서 버전** | v1.0 |
| **최종 수정일** | 2026-02-13 |

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [테스트 환경 설정](#2-테스트-환경-설정)
3. [Unity WebGL 브릿지 인터페이스](#3-unity-webgl-브릿지-인터페이스)
4. [테스트 케이스 목록](#4-테스트-케이스-목록)
5. [테스트 케이스 상세](#5-테스트-케이스-상세)
6. [Playwright 코드 예제](#6-playwright-코드-예제)
7. [테스트 데이터 및 자동화 전략](#7-테스트-데이터-및-자동화-전략)

---

## 1. 테스트 개요

### 1.1 목적

Unity WebGL로 빌드된 Hexa Merge Basic 게임의 머지 시스템을 Playwright를 통해 브라우저 환경에서 E2E(End-to-End) 테스트한다. Unity 내부 로직을 브라우저 JavaScript 브릿지(`unityInstance.SendMessage`, `window.gameTestAPI`)를 통해 제어하고 검증한다.

### 1.2 범위

| 범위 | 포함 여부 | 설명 |
|------|-----------|------|
| 블록 생성 (BlockSpawner) | O | 올바른 레벨/값 생성 검증 |
| 블록 배치 (BlockPlacer) | O | 빈 셀 배치, 가득 찬 보드 처리 |
| 탭 매칭 (MergeInputHandler) | O | 같은 숫자 선택, 상태 전이 |
| 머지 실행 (MergeProcessor) | O | 2+2=4, 4+4=8 등 머지 결과 |
| 연쇄 머지 (ChainProcessor) | O | 인접 블록 자동 연쇄 |
| 웨이브 생성 (WaveSystem) | O | 머지 후 새 블록 생성 |
| 잘못된 매칭 시도 | O | 다른 숫자, 빈 셀 탭 |
| 에지 케이스 | O | 더블 탭, 보드 가득 참 등 |
| 스코어링 시스템 | X | 별도 테스트 계획 |
| 애니메이션 품질 | X | 시각적 검수는 수동 테스트 |
| 사운드/이펙트 | X | 별도 테스트 계획 |

### 1.3 전제조건

1. Unity WebGL 빌드가 로컬 또는 CI 서버에서 정적 파일로 서빙 가능해야 한다.
2. Unity C# 코드에 테스트용 JavaScript 브릿지(`GameTestBridge.cs`)가 구현되어 있어야 한다.
3. 브릿지를 통해 보드 상태 조회, 특정 좌표 블록 배치, 셀 탭 시뮬레이션이 가능해야 한다.
4. `window.unityInstance`가 WebGL 로드 완료 후 접근 가능해야 한다.
5. Node.js 18+ 및 Playwright 최신 버전이 설치되어 있어야 한다.

### 1.4 테스트 우선순위 정의

| 우선순위 | 의미 | 설명 |
|----------|------|------|
| P0 | 필수 (Critical) | 게임 플레이 불가 시 차단하는 핵심 기능 |
| P1 | 높음 (High) | 주요 기능이지만 우회 가능 |
| P2 | 보통 (Medium) | 부가 기능 및 에지 케이스 |
| P3 | 낮음 (Low) | 개선사항, 희귀 에지 케이스 |

---

## 2. 테스트 환경 설정

### 2.1 프로젝트 구조

```
tests/
  e2e/
    merge-system/
      merge.setup.ts          # 테스트 전역 설정
      block-spawn.spec.ts     # 블록 생성 테스트
      block-place.spec.ts     # 블록 배치 테스트
      tap-match.spec.ts       # 탭 매칭 테스트
      merge-execute.spec.ts   # 머지 실행 테스트
      chain-merge.spec.ts     # 연쇄 머지 테스트
      wave.spec.ts            # 웨이브 생성 테스트
      invalid-match.spec.ts   # 잘못된 매칭 테스트
      empty-cell.spec.ts      # 빈 셀 탭 테스트
      edge-cases.spec.ts      # 에지 케이스 테스트
    fixtures/
      unity-helper.ts         # Unity WebGL 헬퍼 함수
      test-data.ts            # 테스트 데이터 정의
    playwright.config.ts      # Playwright 설정
```

### 2.2 Playwright 설정 (`playwright.config.ts`)

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e/merge-system',
  timeout: 60_000,           // Unity WebGL 로딩 고려 60초
  expect: { timeout: 10_000 },
  fullyParallel: false,      // Unity 인스턴스 충돌 방지
  retries: 1,
  reporter: [
    ['html', { outputFolder: 'test-results/report' }],
    ['json', { outputFile: 'test-results/results.json' }],
  ],
  use: {
    baseURL: 'http://localhost:8080',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],
  webServer: {
    command: 'npx serve ./Build/WebGL -l 8080 --single',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
```

### 2.3 Unity WebGL 로딩 대기 (`merge.setup.ts`)

```typescript
import { test as setup } from '@playwright/test';

setup('Unity WebGL 로딩 대기', async ({ page }) => {
  await page.goto('/');

  // Unity 인스턴스 로딩 완료 대기
  await page.waitForFunction(
    () => (window as any).unityInstance !== undefined,
    { timeout: 30_000 }
  );

  // 게임 씬 로드 완료 대기
  await page.waitForFunction(
    () => (window as any).gameTestAPI?.isReady === true,
    { timeout: 15_000 }
  );
});
```

### 2.4 Unity 헬퍼 (`fixtures/unity-helper.ts`)

```typescript
import { Page, expect } from '@playwright/test';

/**
 * Unity WebGL 게임과 상호작용하기 위한 헬퍼 클래스.
 * window.gameTestAPI 브릿지를 통해 게임 상태를 제어하고 조회한다.
 */
export class UnityHelper {
  constructor(private page: Page) {}

  /** Unity WebGL 로딩 완료 대기 */
  async waitForUnityReady(): Promise<void> {
    await this.page.goto('/');
    await this.page.waitForFunction(
      () => (window as any).gameTestAPI?.isReady === true,
      { timeout: 45_000 }
    );
  }

  /** 보드를 빈 상태로 초기화 */
  async resetBoard(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).gameTestAPI.resetBoard();
    });
    await this.page.waitForTimeout(500);
  }

  /** 특정 좌표(q, r)에 지정 레벨 블록 배치 */
  async placeBlock(q: number, r: number, level: number): Promise<void> {
    await this.page.evaluate(
      ({ q, r, level }) => {
        (window as any).gameTestAPI.placeBlock(q, r, level);
      },
      { q, r, level }
    );
    await this.page.waitForTimeout(100);
  }

  /** 특정 좌표(q, r)의 셀을 탭 */
  async tapCell(q: number, r: number): Promise<void> {
    await this.page.evaluate(
      ({ q, r }) => {
        (window as any).gameTestAPI.tapCell(q, r);
      },
      { q, r }
    );
    await this.page.waitForTimeout(200);
  }

  /** 특정 좌표의 블록 값 조회 (없으면 0) */
  async getBlockValue(q: number, r: number): Promise<number> {
    return await this.page.evaluate(
      ({ q, r }) => {
        return (window as any).gameTestAPI.getBlockValue(q, r);
      },
      { q, r }
    );
  }

  /** 특정 좌표의 셀 상태 조회 */
  async getCellState(q: number, r: number): Promise<string> {
    return await this.page.evaluate(
      ({ q, r }) => {
        return (window as any).gameTestAPI.getCellState(q, r);
      },
      { q, r }
    );
  }

  /** 현재 선택 상태 조회 */
  async getSelectionState(): Promise<string> {
    return await this.page.evaluate(() => {
      return (window as any).gameTestAPI.getSelectionState();
    });
  }

  /** 보드 전체 블록 상태를 JSON으로 조회 */
  async getBoardSnapshot(): Promise<BoardSnapshot> {
    return await this.page.evaluate(() => {
      return JSON.parse(
        (window as any).gameTestAPI.getBoardSnapshotJson()
      );
    });
  }

  /** 빈 셀 수 조회 */
  async getEmptyCellCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return (window as any).gameTestAPI.getEmptyCellCount();
    });
  }

  /** 블록이 있는 셀 수 조회 */
  async getOccupiedCellCount(): Promise<number> {
    return await this.page.evaluate(() => {
      return (window as any).gameTestAPI.getOccupiedCellCount();
    });
  }

  /** 현재 보드 최고 블록 레벨 조회 */
  async getBoardMaxLevel(): Promise<number> {
    return await this.page.evaluate(() => {
      return (window as any).gameTestAPI.getBoardMaxLevel();
    });
  }

  /** 마지막 머지 결과 조회 */
  async getLastMergeResult(): Promise<MergeResultData | null> {
    return await this.page.evaluate(() => {
      const json = (window as any).gameTestAPI.getLastMergeResultJson();
      return json ? JSON.parse(json) : null;
    });
  }

  /** 마지막 웨이브 결과 조회 */
  async getLastWaveResult(): Promise<WaveResultData | null> {
    return await this.page.evaluate(() => {
      const json = (window as any).gameTestAPI.getLastWaveResultJson();
      return json ? JSON.parse(json) : null;
    });
  }

  /** 애니메이션 완료 대기 */
  async waitForAnimationComplete(): Promise<void> {
    await this.page.waitForFunction(
      () => (window as any).gameTestAPI.isAnimating() === false,
      { timeout: 5_000 }
    );
  }

  /** 웨이브 자동 생성 비활성화 (테스트 격리용) */
  async disableAutoWave(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).gameTestAPI.setAutoWaveEnabled(false);
    });
  }

  /** 웨이브 자동 생성 활성화 */
  async enableAutoWave(): Promise<void> {
    await this.page.evaluate(() => {
      (window as any).gameTestAPI.setAutoWaveEnabled(true);
    });
  }
}

/** 보드 스냅샷 타입 */
export interface BoardSnapshot {
  cells: CellData[];
  totalCells: number;
  emptyCells: number;
  occupiedCells: number;
  boardMaxLevel: number;
}

export interface CellData {
  q: number;
  r: number;
  state: string;         // "Empty" | "Occupied" | "Locked" | "Disabled"
  blockLevel: number;    // 0이면 블록 없음
  blockValue: number;    // 0이면 블록 없음
}

export interface MergeResultData {
  sourceQ: number;
  sourceR: number;
  targetQ: number;
  targetR: number;
  originalValue: number;
  mergedValue: number;
  earnedScore: number;
  chainCount: number;
  hasValidMoves: boolean;
}

export interface WaveResultData {
  blockCount: number;
  isBoardFull: boolean;
  newBlocks: { q: number; r: number; level: number; value: number }[];
}
```

---

## 3. Unity WebGL 브릿지 인터페이스

Playwright에서 Unity 게임 내부에 접근하려면, Unity C# 측에 JavaScript 브릿지를 구현해야 한다. 아래는 필요한 브릿지 API 목록이다.

### 3.1 필수 브릿지 API

| API 메서드 | 방향 | 설명 |
|-----------|------|------|
| `gameTestAPI.isReady` | Unity -> JS | 게임 로딩 완료 여부 |
| `gameTestAPI.resetBoard()` | JS -> Unity | 보드 초기화 |
| `gameTestAPI.placeBlock(q, r, level)` | JS -> Unity | 특정 좌표에 블록 배치 |
| `gameTestAPI.tapCell(q, r)` | JS -> Unity | 셀 탭 시뮬레이션 |
| `gameTestAPI.getBlockValue(q, r)` | JS -> Unity | 블록 값 조회 |
| `gameTestAPI.getCellState(q, r)` | JS -> Unity | 셀 상태 조회 |
| `gameTestAPI.getSelectionState()` | JS -> Unity | 선택 상태 조회 |
| `gameTestAPI.getBoardSnapshotJson()` | JS -> Unity | 보드 전체 상태 JSON |
| `gameTestAPI.getEmptyCellCount()` | JS -> Unity | 빈 셀 수 |
| `gameTestAPI.getOccupiedCellCount()` | JS -> Unity | 블록 셀 수 |
| `gameTestAPI.getBoardMaxLevel()` | JS -> Unity | 보드 최고 레벨 |
| `gameTestAPI.getLastMergeResultJson()` | JS -> Unity | 마지막 머지 결과 JSON |
| `gameTestAPI.getLastWaveResultJson()` | JS -> Unity | 마지막 웨이브 결과 JSON |
| `gameTestAPI.isAnimating()` | JS -> Unity | 애니메이션 진행 여부 |
| `gameTestAPI.setAutoWaveEnabled(bool)` | JS -> Unity | 웨이브 자동 생성 토글 |

### 3.2 Unity C# 브릿지 참고 구조

```csharp
// Assets/_Project/Scripts/Test/GameTestBridge.cs
// jslib 플러그인으로 window.gameTestAPI에 메서드를 등록한다.
// 상세 구현은 별도 문서 참조.
```

---

## 4. 테스트 케이스 목록

### 4.1 전체 체크리스트

| TC-ID | 카테고리 | 테스트 이름 | 우선순위 |
|-------|---------|------------|---------|
| TC-MERGE-001 | 블록 생성 | 레벨 1 블록 생성 시 값 2 확인 | P0 |
| TC-MERGE-002 | 블록 생성 | 레벨 범위(1~7) 내 생성 확인 | P0 |
| TC-MERGE-003 | 블록 생성 | 보드 최고 레벨 기반 생성 범위 제한 확인 | P1 |
| TC-MERGE-004 | 블록 배치 | 빈 셀에 블록 배치 성공 | P0 |
| TC-MERGE-005 | 블록 배치 | 이미 차있는 셀에 배치 실패 확인 | P0 |
| TC-MERGE-006 | 블록 배치 | 보드 가득 참 상태에서 배치 실패 확인 | P1 |
| TC-MERGE-007 | 블록 배치 | 복수 블록 일괄 배치 확인 | P1 |
| TC-MERGE-008 | 탭 매칭 | 블록 첫 번째 탭 시 선택 상태 전이 | P0 |
| TC-MERGE-009 | 탭 매칭 | 같은 값 두 번째 탭 시 머지 요청 발생 | P0 |
| TC-MERGE-010 | 탭 매칭 | 같은 셀 재탭 시 선택 해제 | P0 |
| TC-MERGE-011 | 탭 매칭 | 다른 값 블록 탭 시 선택 변경 | P1 |
| TC-MERGE-012 | 머지 실행 | 2+2=4 기본 머지 | P0 |
| TC-MERGE-013 | 머지 실행 | 4+4=8 머지 | P0 |
| TC-MERGE-014 | 머지 실행 | 8+8=16 머지 | P0 |
| TC-MERGE-015 | 머지 실행 | 소스 셀 비워짐 확인 | P0 |
| TC-MERGE-016 | 머지 실행 | 타겟 셀 레벨 증가 확인 | P0 |
| TC-MERGE-017 | 머지 실행 | 높은 레벨 머지 (512+512=1024) | P1 |
| TC-MERGE-018 | 연쇄 머지 | 인접 같은 값 1회 연쇄 (4+4=8, 인접 8 흡수=16) | P0 |
| TC-MERGE-019 | 연쇄 머지 | 2회 연쇄 (4->8->16) | P1 |
| TC-MERGE-020 | 연쇄 머지 | 인접하지 않은 같은 값은 연쇄 안 함 | P0 |
| TC-MERGE-021 | 연쇄 머지 | 연쇄 후 흡수된 셀 비워짐 확인 | P1 |
| TC-MERGE-022 | 웨이브 | 머지 후 웨이브 생성 확인 | P0 |
| TC-MERGE-023 | 웨이브 | 웨이브 블록 수 기본값(3) 확인 | P1 |
| TC-MERGE-024 | 웨이브 | 테두리 셀 우선 배치 확인 | P2 |
| TC-MERGE-025 | 웨이브 | 빈 셀 부족 시 가용 셀만큼 생성 | P1 |
| TC-MERGE-026 | 잘못된 매칭 | 다른 숫자 블록 탭 시 머지 안 됨 | P0 |
| TC-MERGE-027 | 잘못된 매칭 | Processing 중 입력 무시 확인 | P1 |
| TC-MERGE-028 | 빈 셀 탭 | Idle 상태에서 빈 셀 탭 시 무시 | P0 |
| TC-MERGE-029 | 빈 셀 탭 | FirstSelected 상태에서 빈 셀 탭 시 선택 해제 | P0 |
| TC-MERGE-030 | 에지 케이스 | 보드 가득 참 + 매칭 불가 감지 | P1 |
| TC-MERGE-031 | 에지 케이스 | 연쇄 최대 깊이(20) 제한 확인 | P2 |
| TC-MERGE-032 | 에지 케이스 | 머지 후 셀 잠금 해제 확인 | P1 |
| TC-MERGE-033 | 에지 케이스 | 연속 머지 안정성 (5회 연속) | P2 |

---

## 5. 테스트 케이스 상세

### 5.1 블록 생성 테스트

#### TC-MERGE-001: 레벨 1 블록 생성 시 값 2 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-001 |
| **목적** | 레벨 1 블록이 생성되었을 때 표시 값이 2인지 검증한다 |
| **사전조건** | 보드가 빈 상태로 초기화되어 있다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 (`resetBoard`) | 모든 셀이 Empty 상태 |
| 2 | 좌표 (0,0)에 레벨 1 블록 배치 | 배치 성공 |
| 3 | 좌표 (0,0)의 블록 값 조회 | 값 = 2 |
| 4 | 좌표 (0,0)의 셀 상태 조회 | 상태 = "Occupied" |

---

#### TC-MERGE-002: 레벨 범위(1~7) 내 생성 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-002 |
| **목적** | 블록 생성기가 레벨 1~7 범위 내에서만 블록을 생성하는지 검증한다 |
| **사전조건** | 보드에 다양한 레벨의 블록이 존재한다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 | 모든 셀 Empty |
| 2 | 좌표 (0,0)에 레벨 9(값 512) 블록 배치하여 boardMaxLevel을 9로 설정 | 배치 성공 |
| 3 | 50개의 블록을 랜덤 빈 셀에 자동 배치 | 각 블록이 배치됨 |
| 4 | 보드 스냅샷 조회하여 모든 블록 레벨 확인 | 모든 블록의 레벨이 1 이상, 7 이하 |

---

#### TC-MERGE-003: 보드 최고 레벨 기반 생성 범위 제한 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-003 |
| **목적** | boardMaxLevel이 낮을 때 생성 레벨이 적절히 제한되는지 검증한다 |
| **사전조건** | 보드가 빈 상태이다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 | 모든 셀 Empty |
| 2 | 좌표 (0,0)에 레벨 3(값 8) 블록 배치하여 boardMaxLevel=3 | 배치 성공 |
| 3 | 30개의 블록을 랜덤 빈 셀에 자동 배치 | 각 블록 배치됨 |
| 4 | 보드 스냅샷 조회 | 생성된 블록 레벨이 maxSpawnLevel(=3) 이하 |

---

### 5.2 블록 배치 테스트

#### TC-MERGE-004: 빈 셀에 블록 배치 성공

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-004 |
| **목적** | 빈 셀에 블록을 배치하면 정상적으로 Occupied 상태가 되는지 검증한다 |
| **사전조건** | 보드가 빈 상태이다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 | 모든 셀 Empty |
| 2 | 좌표 (0,0)의 셀 상태 조회 | "Empty" |
| 3 | 좌표 (0,0)에 레벨 2(값 4) 블록 배치 | 배치 성공 |
| 4 | 좌표 (0,0)의 셀 상태 조회 | "Occupied" |
| 5 | 좌표 (0,0)의 블록 값 조회 | 값 = 4 |

---

#### TC-MERGE-005: 이미 차있는 셀에 배치 실패 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-005 |
| **목적** | Occupied 상태인 셀에 추가 블록 배치가 거부되는지 검증한다 |
| **사전조건** | 좌표 (0,0)에 블록이 존재한다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 | 모든 셀 Empty |
| 2 | 좌표 (0,0)에 레벨 1(값 2) 블록 배치 | 배치 성공 |
| 3 | 좌표 (0,0)에 레벨 2(값 4) 블록 추가 배치 시도 | 배치 실패 (기존 블록 유지) |
| 4 | 좌표 (0,0)의 블록 값 조회 | 값 = 2 (원래 블록 유지) |

---

#### TC-MERGE-006: 보드 가득 참 상태에서 배치 실패 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-006 |
| **목적** | 모든 셀이 Occupied일 때 추가 배치가 불가한지 검증한다 |
| **사전조건** | 보드의 모든 셀(61개)에 블록이 배치되어 있다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 후 모든 셀에 블록 배치 | 빈 셀 수 = 0 |
| 2 | 빈 셀 수 조회 | 0 |
| 3 | 추가 블록 랜덤 배치 시도 | 배치 실패 (null 반환) |
| 4 | 블록 셀 수 조회 | 여전히 61 |

---

#### TC-MERGE-007: 복수 블록 일괄 배치 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-007 |
| **목적** | PlaceMultipleBlocks로 여러 블록을 한번에 배치할 수 있는지 검증한다 |
| **사전조건** | 보드가 빈 상태이다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 | 빈 셀 = 61 |
| 2 | 10개 블록 일괄 배치 | 10개 배치됨 |
| 3 | 블록 셀 수 조회 | 10 |
| 4 | 빈 셀 수 조회 | 51 |

---

### 5.3 탭 매칭 테스트

#### TC-MERGE-008: 블록 첫 번째 탭 시 선택 상태 전이

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-008 |
| **목적** | 블록이 있는 셀을 탭하면 Idle에서 FirstSelected 상태로 전이되는지 검증한다 |
| **사전조건** | 보드에 블록이 배치되어 있고, 선택 상태가 Idle이다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 후 (0,0)에 레벨 1 블록 배치 | 배치 성공 |
| 2 | 웨이브 자동 생성 비활성화 | 비활성화됨 |
| 3 | 현재 선택 상태 조회 | "Idle" |
| 4 | 좌표 (0,0) 셀 탭 | 탭 실행 |
| 5 | 현재 선택 상태 조회 | "FirstSelected" |

---

#### TC-MERGE-009: 같은 값 두 번째 탭 시 머지 요청 발생

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-009 |
| **목적** | 첫 번째 선택 후 같은 값의 다른 블록을 탭하면 머지가 실행되는지 검증한다 |
| **사전조건** | (0,0)과 (1,0)에 같은 레벨(1) 블록이 배치되어 있다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 1 블록, (1,0)에 레벨 1 블록 배치 | 둘 다 값 2 |
| 3 | (0,0) 셀 탭 | 상태 = "FirstSelected" |
| 4 | (1,0) 셀 탭 | 머지 실행됨 |
| 5 | 애니메이션 완료 대기 | 완료 |
| 6 | (0,0) 셀 상태 조회 | "Empty" |
| 7 | (1,0) 블록 값 조회 | 값 = 4 |

---

#### TC-MERGE-010: 같은 셀 재탭 시 선택 해제

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-010 |
| **목적** | 선택된 블록을 다시 탭하면 선택이 해제되는지 검증한다 |
| **사전조건** | (0,0)에 블록이 있고 FirstSelected 상태이다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 후 (0,0)에 레벨 1 블록 배치, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0) 셀 탭 | 상태 = "FirstSelected" |
| 3 | (0,0) 셀 다시 탭 | 상태 = "Idle" |
| 4 | 선택 상태 조회 | "Idle" |

---

#### TC-MERGE-011: 다른 값 블록 탭 시 선택 변경

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-011 |
| **목적** | 첫 번째 선택 후 다른 값의 블록을 탭하면 새 블록으로 선택이 변경되는지 검증한다 |
| **사전조건** | (0,0)에 레벨 1(값 2), (1,0)에 레벨 2(값 4) 블록이 있다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 후 (0,0)에 레벨 1, (1,0)에 레벨 2 배치, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0) 셀 탭 | 상태 = "FirstSelected" |
| 3 | (1,0) 셀 탭 (다른 값) | 머지 안 됨, 선택이 (1,0)으로 변경 |
| 4 | 선택 상태 조회 | "FirstSelected" (새 블록 선택됨) |
| 5 | (0,0) 블록 값 조회 | 값 = 2 (변경 없음) |
| 6 | (1,0) 블록 값 조회 | 값 = 4 (변경 없음) |

---

### 5.4 머지 실행 테스트

#### TC-MERGE-012: 2+2=4 기본 머지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-012 |
| **목적** | 값 2인 블록 두 개를 머지하면 값 4가 되는지 검증한다 |
| **사전조건** | 보드에 값 2 블록 2개만 존재한다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 1, (1,0)에 레벨 1 배치 | 둘 다 값 2 |
| 3 | (0,0) 탭 -> (1,0) 탭 | 머지 실행 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | (0,0) 셀 상태 조회 | "Empty" |
| 6 | (1,0) 블록 값 조회 | 값 = 4 |
| 7 | 마지막 머지 결과 조회 | originalValue=2, mergedValue=4 |

---

#### TC-MERGE-013: 4+4=8 머지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-013 |
| **목적** | 값 4인 블록 두 개를 머지하면 값 8이 되는지 검증한다 |
| **사전조건** | 보드에 값 4 블록 2개만 존재한다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 2, (1,0)에 레벨 2 배치 | 둘 다 값 4 |
| 3 | (0,0) 탭 -> (1,0) 탭 | 머지 실행 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | (0,0) 셀 상태 | "Empty" |
| 6 | (1,0) 블록 값 | 값 = 8 |
| 7 | 마지막 머지 결과 | originalValue=4, mergedValue=8 |

---

#### TC-MERGE-014: 8+8=16 머지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-014 |
| **목적** | 값 8인 블록 두 개를 머지하면 값 16이 되는지 검증한다 |
| **사전조건** | 보드에 값 8 블록 2개만 존재한다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 3, (1,0)에 레벨 3 배치 | 둘 다 값 8 |
| 3 | (0,0) 탭 -> (1,0) 탭 | 머지 실행 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | (1,0) 블록 값 | 값 = 16 |

---

#### TC-MERGE-015: 소스 셀 비워짐 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-015 |
| **목적** | 머지 후 소스(첫 번째 탭) 셀이 Empty 상태로 변경되는지 검증한다 |
| **사전조건** | 두 개의 같은 값 블록이 배치되어 있다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 1, (1,0)에 레벨 1 배치 | 배치 성공 |
| 3 | (0,0) 탭 -> (1,0) 탭 | 머지 실행 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | (0,0) 셀 상태 조회 | "Empty" |
| 6 | (0,0) 블록 값 조회 | 0 (블록 없음) |

---

#### TC-MERGE-016: 타겟 셀 레벨 증가 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-016 |
| **목적** | 머지 후 타겟(두 번째 탭) 셀의 블록 레벨이 1 증가하는지 검증한다 |
| **사전조건** | 두 개의 같은 값 블록이 배치되어 있다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 3(값 8), (1,0)에 레벨 3(값 8) 배치 | 배치 성공 |
| 3 | (0,0) 탭 -> (1,0) 탭 | 머지 실행 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | (1,0) 블록 값 조회 | 값 = 16 (레벨 3 -> 4) |

---

#### TC-MERGE-017: 높은 레벨 머지 (512+512=1024)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-017 |
| **목적** | 고레벨 블록의 머지가 정상 동작하는지 검증한다 |
| **사전조건** | 값 512(레벨 9) 블록 2개가 배치되어 있다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 9, (1,0)에 레벨 9 배치 | 둘 다 값 512 |
| 3 | (0,0) 탭 -> (1,0) 탭 | 머지 실행 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | (1,0) 블록 값 조회 | 값 = 1024 |

---

### 5.5 연쇄 머지(체인) 테스트

#### TC-MERGE-018: 인접 같은 값 1회 연쇄

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-018 |
| **목적** | 머지 결과 블록의 인접 셀에 같은 값이 있으면 자동 연쇄 머지가 발생하는지 검증한다 |
| **사전조건** | (0,0)에 값 4, (-1,0)에 값 4, (1,0)에 값 8. (-1,0)과 (0,0)을 머지하면 (0,0)이 8이 되고, 인접한 (1,0)의 8과 연쇄 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (-1,0)에 레벨 2(값 4), (0,0)에 레벨 2(값 4), (1,0)에 레벨 3(값 8) 배치 | 배치 성공 |
| 3 | (-1,0) 탭 -> (0,0) 탭 | 머지: 4+4=8 at (0,0) |
| 4 | 애니메이션 완료 대기 | 완료 (연쇄 포함) |
| 5 | (-1,0) 셀 상태 | "Empty" |
| 6 | (1,0) 셀 상태 | "Empty" (연쇄로 흡수됨) |
| 7 | (0,0) 블록 값 | 값 = 16 (8+8 연쇄) |
| 8 | 마지막 머지 결과의 chainCount | 1 이상 |

---

#### TC-MERGE-019: 2회 연쇄 (4->8->16)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-019 |
| **목적** | 연쇄 머지가 2회 이상 발생하여 4->8->16으로 진행되는지 검증한다 |
| **사전조건** | 연쇄가 2회 발생할 수 있는 보드 배치. (0,0)=4, (-1,0)=4, (1,0)=8, (0,-1)=16은 불가(비인접일 수 있음). 인접 관계를 고려한 배치 필요 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (-1,0)에 레벨 2(값 4), (0,0)에 레벨 2(값 4), (1,0)에 레벨 3(값 8), (1,-1)에 레벨 4(값 16) 배치 | 배치 성공. (1,0)과 (1,-1)이 인접해야 함 |
| 3 | (-1,0) 탭 -> (0,0) 탭 | 머지: 4+4=8 at (0,0) |
| 4 | 애니메이션 완료 대기 | 연쇄 머지 진행 |
| 5 | (0,0) 블록 값 확인 | 연쇄 1: 8+8=16 |
| 6 | 최종 블록 값 확인 | 연쇄 깊이와 보드 구조에 따라 16 또는 32 |
| 7 | 마지막 머지 결과의 chainCount | 1 이상 |

---

#### TC-MERGE-020: 인접하지 않은 같은 값은 연쇄 안 함

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-020 |
| **목적** | 연쇄 머지가 인접 셀에서만 발동되며, 떨어진 같은 값 블록에는 연쇄가 발생하지 않는지 검증한다 |
| **사전조건** | (0,0)에 값 4, (-1,0)에 값 4, (3,0)에 값 8 (비인접) |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (-1,0)에 레벨 2(값 4), (0,0)에 레벨 2(값 4), (3,0)에 레벨 3(값 8) 배치 | (3,0)은 (0,0)과 비인접 |
| 3 | (-1,0) 탭 -> (0,0) 탭 | 머지: 4+4=8 at (0,0) |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | (0,0) 블록 값 | 값 = 8 (연쇄 없음) |
| 6 | (3,0) 블록 값 | 값 = 8 (변경 없음, 흡수되지 않음) |
| 7 | (3,0) 셀 상태 | "Occupied" |

---

#### TC-MERGE-021: 연쇄 후 흡수된 셀 비워짐 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-021 |
| **목적** | 연쇄 머지에서 흡수된 블록의 셀이 Empty가 되는지 검증한다 |
| **사전조건** | TC-MERGE-018과 동일 배치 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | TC-MERGE-018의 단계 1~4 실행 | 연쇄 머지 완료 |
| 2 | (1,0) 셀 상태 조회 | "Empty" |
| 3 | (1,0) 블록 값 조회 | 0 (블록 없음) |
| 4 | 보드 스냅샷 조회 | 흡수된 셀이 Empty로 기록됨 |

---

### 5.6 웨이브(파도) 생성 테스트

#### TC-MERGE-022: 머지 후 웨이브 생성 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-022 |
| **목적** | 머지가 완료된 후 웨이브로 새 블록이 생성되는지 검증한다 |
| **사전조건** | 웨이브 자동 생성이 활성화된 상태이다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 **활성화** | 준비 완료 |
| 2 | (0,0)에 레벨 1, (1,0)에 레벨 1 배치 | 블록 셀 수 = 2 |
| 3 | 머지 전 블록 셀 수 기록 | occupiedBefore = 2 |
| 4 | (0,0) 탭 -> (1,0) 탭 | 머지 실행 |
| 5 | 애니메이션 완료 대기 | 완료 (웨이브 포함) |
| 6 | 마지막 웨이브 결과 조회 | blockCount >= 1 |
| 7 | 블록 셀 수 조회 | 머지로 1개 됨 + 웨이브 블록 수 |

---

#### TC-MERGE-023: 웨이브 블록 수 기본값(3) 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-023 |
| **목적** | 초기 상태에서 웨이브 블록 수가 baseBlockCount(3)인지 검증한다 |
| **사전조건** | 누적 머지 횟수가 0이다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 1, (1,0)에 레벨 1 배치 | 배치 성공 |
| 3 | (0,0) 탭 -> (1,0) 탭 | 머지 및 웨이브 실행 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | 마지막 웨이브 결과의 blockCount | 3 (baseBlockCount) |

---

#### TC-MERGE-024: 테두리 셀 우선 배치 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-024 |
| **목적** | 웨이브 블록이 그리드 테두리(radius 거리) 빈 셀에 우선 배치되는지 검증한다 |
| **사전조건** | 테두리와 안쪽 모두 빈 셀이 존재한다 |
| **우선순위** | P2 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 활성화 | 준비 완료 |
| 2 | 중앙 영역(radius 0~2)에만 블록 배치, 테두리(radius 4)는 비워둠 | 테두리 빈 셀 존재 |
| 3 | 중앙에서 머지 수행 | 웨이브 발동 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | 웨이브 결과의 newBlocks 좌표 확인 | 대부분 테두리(radius=4) 좌표에 위치 |

---

#### TC-MERGE-025: 빈 셀 부족 시 가용 셀만큼 생성

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-025 |
| **목적** | 빈 셀이 웨이브 블록 수보다 적을 때, 가용 셀 수만큼만 생성되는지 검증한다 |
| **사전조건** | 빈 셀이 2개뿐이고 웨이브 블록 수는 3인 상태 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 후 59개 셀에 블록 배치 (2개만 비움) | 빈 셀 = 2 |
| 2 | 빈 셀 2개 중 같은 값 블록 2개를 머지용으로 남김 | 준비 |
| 3 | 머지 실행 (1개 셀 비워짐 -> 빈 셀 = 2) | 웨이브 발동 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | 웨이브 결과의 blockCount | 2 이하 (가용 셀 수 이내) |

---

### 5.7 잘못된 매칭 시도 테스트

#### TC-MERGE-026: 다른 숫자 블록 탭 시 머지 안 됨

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-026 |
| **목적** | 서로 다른 값의 블록을 탭했을 때 머지가 실행되지 않는지 검증한다 |
| **사전조건** | (0,0)에 값 2, (1,0)에 값 4 블록이 있다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 1(값 2), (1,0)에 레벨 2(값 4) 배치 | 배치 성공 |
| 3 | (0,0) 탭 | 상태 = "FirstSelected" |
| 4 | (1,0) 탭 | 머지 안 됨, 선택 변경 |
| 5 | (0,0) 블록 값 | 값 = 2 (변경 없음) |
| 6 | (1,0) 블록 값 | 값 = 4 (변경 없음) |
| 7 | 선택 상태 | "FirstSelected" ((1,0)이 새 선택) |

---

#### TC-MERGE-027: Processing 중 입력 무시 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-027 |
| **목적** | 머지/애니메이션 처리 중에 추가 탭 입력이 무시되는지 검증한다 |
| **사전조건** | 머지 애니메이션이 진행 중인 상태를 시뮬레이션한다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 1, (1,0)에 레벨 1, (0,-1)에 레벨 1, (1,-1)에 레벨 1 배치 | 4개의 값 2 블록 |
| 3 | (0,0) 탭 -> (1,0) 탭 (머지 시작) | 머지 처리 중 |
| 4 | 즉시 (0,-1) 탭 시도 | 입력 무시됨 |
| 5 | 애니메이션 완료 대기 | 머지 완료 |
| 6 | (0,-1) 블록 값 | 값 = 2 (영향 없음) |
| 7 | (1,-1) 블록 값 | 값 = 2 (영향 없음) |

---

### 5.8 빈 셀 탭 테스트

#### TC-MERGE-028: Idle 상태에서 빈 셀 탭 시 무시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-028 |
| **목적** | 대기 상태에서 빈 셀을 탭하면 아무 상태 변화가 없는지 검증한다 |
| **사전조건** | 보드에 빈 셀이 존재하고, 선택 상태가 Idle이다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 빈 보드 |
| 2 | 선택 상태 조회 | "Idle" |
| 3 | 빈 셀 좌표 (0,0) 탭 | 탭 실행 |
| 4 | 선택 상태 조회 | "Idle" (변경 없음) |

---

#### TC-MERGE-029: FirstSelected 상태에서 빈 셀 탭 시 선택 해제

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-029 |
| **목적** | 블록 선택 후 빈 셀을 탭하면 선택이 해제되는지 검증한다 |
| **사전조건** | (0,0)에 블록이 있고 (1,0)이 비어있다 |
| **우선순위** | P0 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 1 블록 배치 | 배치 성공 |
| 3 | (0,0) 탭 | 상태 = "FirstSelected" |
| 4 | (1,0) 빈 셀 탭 | 선택 해제 |
| 5 | 선택 상태 조회 | "Idle" |

---

### 5.9 에지 케이스 테스트

#### TC-MERGE-030: 보드 가득 참 + 매칭 불가 감지

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-030 |
| **목적** | 보드가 가득 차고 매칭 가능 쌍이 없을 때 정상적으로 감지되는지 검증한다 |
| **사전조건** | 모든 셀에 고유한 값의 블록이 배치되어 있다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화 | 빈 보드 |
| 2 | 모든 61개 셀에 서로 다른 레벨의 블록을 번갈아 배치 (가능한 한 중복 최소화) | 가득 참 |
| 3 | 빈 셀 수 조회 | 0 |
| 4 | 보드 스냅샷에서 hasValidMoves 확인 또는 매칭 쌍 탐색 | 매칭 불가 상태 |

---

#### TC-MERGE-031: 연쇄 최대 깊이(20) 제한 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-031 |
| **목적** | 연쇄 머지가 최대 깊이 20을 초과하지 않는지 검증한다 |
| **사전조건** | 이론상 20회 이상 연쇄가 가능한 보드 배치 (실제로는 2의 거듭제곱 특성상 불가하지만 안전장치 확인) |
| **우선순위** | P2 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | 연쇄가 최대한 길게 발생하도록 인접 셀에 순차 레벨 블록 배치 | 예: (0,0)=2, (1,0)=4, (1,-1)=8, ... |
| 3 | 머지 시작 | 연쇄 진행 |
| 4 | 애니메이션 완료 대기 | 완료 (무한 루프 없이) |
| 5 | 마지막 머지 결과의 chainCount | 20 이하 |

---

#### TC-MERGE-032: 머지 후 셀 잠금 해제 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-032 |
| **목적** | 머지 완료 후 관련 셀의 잠금(Lock)이 모두 해제되는지 검증한다 |
| **사전조건** | 머지 가능한 블록 2개가 배치되어 있다 |
| **우선순위** | P1 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | (0,0)에 레벨 1, (1,0)에 레벨 1 배치 | 배치 성공 |
| 3 | (0,0) 탭 -> (1,0) 탭 | 머지 실행 |
| 4 | 애니메이션 완료 대기 | 완료 |
| 5 | (0,0) 셀 상태 | "Empty" (Locked 아님) |
| 6 | (1,0) 셀 상태 | "Occupied" (Locked 아님) |

---

#### TC-MERGE-033: 연속 머지 안정성 (5회 연속)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-MERGE-033 |
| **목적** | 여러 번의 머지를 연속으로 수행해도 시스템이 안정적으로 동작하는지 검증한다 |
| **사전조건** | 보드에 충분한 매칭 쌍이 존재한다 |
| **우선순위** | P2 |

**테스트 단계:**

| 단계 | 행동 | 기대결과 |
|------|------|---------|
| 1 | 보드 초기화, 웨이브 비활성화 | 준비 완료 |
| 2 | 5쌍의 같은 값 블록을 각각 다른 좌표에 배치 | 10개 블록 배치 |
| 3 | 1번째 쌍 머지 실행 + 애니메이션 대기 | 머지 성공 |
| 4 | 2번째 쌍 머지 실행 + 애니메이션 대기 | 머지 성공 |
| 5 | 3번째 쌍 머지 실행 + 애니메이션 대기 | 머지 성공 |
| 6 | 4번째 쌍 머지 실행 + 애니메이션 대기 | 머지 성공 |
| 7 | 5번째 쌍 머지 실행 + 애니메이션 대기 | 머지 성공 |
| 8 | 블록 셀 수 조회 | 5 (각 머지마다 2->1) |
| 9 | 콘솔 에러 확인 | 에러 없음 |

---

## 6. Playwright 코드 예제

### 6.1 기본 머지 테스트 (`merge-execute.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../fixtures/unity-helper';

test.describe('머지 실행 테스트', () => {
  let unity: UnityHelper;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    await unity.waitForUnityReady();
    await unity.resetBoard();
    await unity.disableAutoWave();
  });

  test('TC-MERGE-012: 2+2=4 기본 머지', async () => {
    // 배치: (0,0)에 값 2, (1,0)에 값 2
    await unity.placeBlock(0, 0, 1);
    await unity.placeBlock(1, 0, 1);

    // 머지 전 상태 확인
    expect(await unity.getBlockValue(0, 0)).toBe(2);
    expect(await unity.getBlockValue(1, 0)).toBe(2);

    // 머지 실행: 소스(0,0) 탭 -> 타겟(1,0) 탭
    await unity.tapCell(0, 0);
    expect(await unity.getSelectionState()).toBe('FirstSelected');

    await unity.tapCell(1, 0);
    await unity.waitForAnimationComplete();

    // 결과 검증
    expect(await unity.getCellState(0, 0)).toBe('Empty');
    expect(await unity.getBlockValue(1, 0)).toBe(4);

    const result = await unity.getLastMergeResult();
    expect(result).not.toBeNull();
    expect(result!.originalValue).toBe(2);
    expect(result!.mergedValue).toBe(4);
  });

  test('TC-MERGE-013: 4+4=8 머지', async () => {
    await unity.placeBlock(0, 0, 2);
    await unity.placeBlock(1, 0, 2);

    await unity.tapCell(0, 0);
    await unity.tapCell(1, 0);
    await unity.waitForAnimationComplete();

    expect(await unity.getCellState(0, 0)).toBe('Empty');
    expect(await unity.getBlockValue(1, 0)).toBe(8);
  });

  test('TC-MERGE-014: 8+8=16 머지', async () => {
    await unity.placeBlock(0, 0, 3);
    await unity.placeBlock(1, 0, 3);

    await unity.tapCell(0, 0);
    await unity.tapCell(1, 0);
    await unity.waitForAnimationComplete();

    expect(await unity.getCellState(0, 0)).toBe('Empty');
    expect(await unity.getBlockValue(1, 0)).toBe(16);
  });

  test('TC-MERGE-015: 소스 셀 비워짐 확인', async () => {
    await unity.placeBlock(0, 0, 1);
    await unity.placeBlock(1, 0, 1);

    await unity.tapCell(0, 0);
    await unity.tapCell(1, 0);
    await unity.waitForAnimationComplete();

    expect(await unity.getCellState(0, 0)).toBe('Empty');
    expect(await unity.getBlockValue(0, 0)).toBe(0);
  });

  test('TC-MERGE-017: 높은 레벨 머지 512+512=1024', async () => {
    await unity.placeBlock(0, 0, 9);
    await unity.placeBlock(1, 0, 9);

    await unity.tapCell(0, 0);
    await unity.tapCell(1, 0);
    await unity.waitForAnimationComplete();

    expect(await unity.getBlockValue(1, 0)).toBe(1024);
  });
});
```

### 6.2 탭 매칭 테스트 (`tap-match.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../fixtures/unity-helper';

test.describe('탭 매칭 테스트', () => {
  let unity: UnityHelper;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    await unity.waitForUnityReady();
    await unity.resetBoard();
    await unity.disableAutoWave();
  });

  test('TC-MERGE-008: 블록 첫 번째 탭 시 선택 상태 전이', async () => {
    await unity.placeBlock(0, 0, 1);

    expect(await unity.getSelectionState()).toBe('Idle');
    await unity.tapCell(0, 0);
    expect(await unity.getSelectionState()).toBe('FirstSelected');
  });

  test('TC-MERGE-010: 같은 셀 재탭 시 선택 해제', async () => {
    await unity.placeBlock(0, 0, 1);

    await unity.tapCell(0, 0);
    expect(await unity.getSelectionState()).toBe('FirstSelected');

    await unity.tapCell(0, 0);
    expect(await unity.getSelectionState()).toBe('Idle');
  });

  test('TC-MERGE-011: 다른 값 블록 탭 시 선택 변경', async () => {
    await unity.placeBlock(0, 0, 1); // 값 2
    await unity.placeBlock(1, 0, 2); // 값 4

    await unity.tapCell(0, 0);
    expect(await unity.getSelectionState()).toBe('FirstSelected');

    await unity.tapCell(1, 0);
    // 머지 되지 않고 선택만 변경
    expect(await unity.getSelectionState()).toBe('FirstSelected');
    expect(await unity.getBlockValue(0, 0)).toBe(2);
    expect(await unity.getBlockValue(1, 0)).toBe(4);
  });

  test('TC-MERGE-026: 다른 숫자 블록 탭 시 머지 안 됨', async () => {
    await unity.placeBlock(0, 0, 1); // 값 2
    await unity.placeBlock(1, 0, 2); // 값 4

    await unity.tapCell(0, 0);
    await unity.tapCell(1, 0);

    // 블록 값이 변하지 않아야 함
    expect(await unity.getBlockValue(0, 0)).toBe(2);
    expect(await unity.getBlockValue(1, 0)).toBe(4);
  });
});
```

### 6.3 연쇄 머지 테스트 (`chain-merge.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../fixtures/unity-helper';

test.describe('연쇄 머지 테스트', () => {
  let unity: UnityHelper;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    await unity.waitForUnityReady();
    await unity.resetBoard();
    await unity.disableAutoWave();
  });

  test('TC-MERGE-018: 인접 같은 값 1회 연쇄', async () => {
    // 배치: (-1,0)=4, (0,0)=4, (1,0)=8
    // 머지: (-1,0)과 (0,0) -> (0,0)=8 -> 인접 (1,0)=8 연쇄 -> (0,0)=16
    await unity.placeBlock(-1, 0, 2); // 값 4
    await unity.placeBlock(0, 0, 2);  // 값 4
    await unity.placeBlock(1, 0, 3);  // 값 8

    await unity.tapCell(-1, 0);
    await unity.tapCell(0, 0);
    await unity.waitForAnimationComplete();

    // 소스 비워짐
    expect(await unity.getCellState(-1, 0)).toBe('Empty');
    // 연쇄로 흡수된 셀 비워짐
    expect(await unity.getCellState(1, 0)).toBe('Empty');
    // 타겟에 연쇄 결과
    expect(await unity.getBlockValue(0, 0)).toBe(16);

    const result = await unity.getLastMergeResult();
    expect(result).not.toBeNull();
    expect(result!.chainCount).toBeGreaterThanOrEqual(1);
  });

  test('TC-MERGE-020: 인접하지 않은 같은 값은 연쇄 안 함', async () => {
    // 배치: (-1,0)=4, (0,0)=4, (3,0)=8 (비인접)
    await unity.placeBlock(-1, 0, 2); // 값 4
    await unity.placeBlock(0, 0, 2);  // 값 4
    await unity.placeBlock(3, 0, 3);  // 값 8 (비인접)

    await unity.tapCell(-1, 0);
    await unity.tapCell(0, 0);
    await unity.waitForAnimationComplete();

    // 머지 결과: (0,0)=8, 연쇄 없음
    expect(await unity.getBlockValue(0, 0)).toBe(8);
    // 비인접 블록은 영향 없음
    expect(await unity.getBlockValue(3, 0)).toBe(8);
    expect(await unity.getCellState(3, 0)).toBe('Occupied');
  });
});
```

### 6.4 빈 셀 탭 테스트 (`empty-cell.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../fixtures/unity-helper';

test.describe('빈 셀 탭 테스트', () => {
  let unity: UnityHelper;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    await unity.waitForUnityReady();
    await unity.resetBoard();
    await unity.disableAutoWave();
  });

  test('TC-MERGE-028: Idle 상태에서 빈 셀 탭 시 무시', async () => {
    expect(await unity.getSelectionState()).toBe('Idle');
    await unity.tapCell(0, 0); // 빈 셀
    expect(await unity.getSelectionState()).toBe('Idle');
  });

  test('TC-MERGE-029: FirstSelected 상태에서 빈 셀 탭 시 선택 해제',
    async () => {
      await unity.placeBlock(0, 0, 1);

      await unity.tapCell(0, 0);
      expect(await unity.getSelectionState()).toBe('FirstSelected');

      await unity.tapCell(1, 0); // 빈 셀
      expect(await unity.getSelectionState()).toBe('Idle');
    }
  );
});
```

### 6.5 에지 케이스 테스트 (`edge-cases.spec.ts`)

```typescript
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../fixtures/unity-helper';

test.describe('에지 케이스 테스트', () => {
  let unity: UnityHelper;

  test.beforeEach(async ({ page }) => {
    unity = new UnityHelper(page);
    await unity.waitForUnityReady();
    await unity.resetBoard();
    await unity.disableAutoWave();
  });

  test('TC-MERGE-032: 머지 후 셀 잠금 해제 확인', async () => {
    await unity.placeBlock(0, 0, 1);
    await unity.placeBlock(1, 0, 1);

    await unity.tapCell(0, 0);
    await unity.tapCell(1, 0);
    await unity.waitForAnimationComplete();

    // 잠금이 아닌 정상 상태여야 함
    expect(await unity.getCellState(0, 0)).toBe('Empty');
    expect(await unity.getCellState(1, 0)).toBe('Occupied');
    // Locked 상태가 아닌지 확인
    expect(await unity.getCellState(0, 0)).not.toBe('Locked');
    expect(await unity.getCellState(1, 0)).not.toBe('Locked');
  });

  test('TC-MERGE-033: 연속 머지 안정성 (5회 연속)', async ({ page }) => {
    // 5쌍의 블록 배치 (큐브 좌표 기준 인접 쌍)
    const pairs = [
      { s: { q: 0, r: 0 }, t: { q: 1, r: 0 }, level: 1 },
      { s: { q: -1, r: 0 }, t: { q: -1, r: 1 }, level: 2 },
      { s: { q: 0, r: -1 }, t: { q: 1, r: -1 }, level: 1 },
      { s: { q: -1, r: -1 }, t: { q: 0, r: -2 }, level: 3 },
      { s: { q: 2, r: -1 }, t: { q: 2, r: 0 }, level: 2 },
    ];

    for (const pair of pairs) {
      await unity.placeBlock(pair.s.q, pair.s.r, pair.level);
      await unity.placeBlock(pair.t.q, pair.t.r, pair.level);
    }

    // 5회 연속 머지
    for (const pair of pairs) {
      await unity.tapCell(pair.s.q, pair.s.r);
      await unity.tapCell(pair.t.q, pair.t.r);
      await unity.waitForAnimationComplete();
    }

    // 콘솔 에러가 없어야 함
    const logs = await page.evaluate(() => {
      return (window as any).gameTestAPI.getConsoleErrors?.() ?? [];
    });
    expect(logs.length).toBe(0);
  });
});
```

---

## 7. 테스트 데이터 및 자동화 전략

### 7.1 테스트 데이터 (`fixtures/test-data.ts`)

```typescript
/**
 * 머지 시스템 테스트에 사용되는 정적 데이터.
 */

/** 블록 레벨-값 대응표 */
export const BLOCK_VALUES: Record<number, number> = {
  1: 2,
  2: 4,
  3: 8,
  4: 16,
  5: 32,
  6: 64,
  7: 128,
  8: 256,
  9: 512,
  10: 1024,
  11: 2048,
  12: 4096,
  13: 8192,
};

/** 그리드 설정 상수 */
export const GRID_CONFIG = {
  radius: 4,
  totalCells: 61,       // 3 * 4 * 5 + 1
  hexSize: 0.6,
  hexSpacing: 0.05,
};

/** 웨이브 설정 기본값 */
export const WAVE_CONFIG = {
  baseBlockCount: 3,
  maxBlockCount: 7,
  difficultyScale: 0.1,
};

/** 생성기 설정 */
export const SPAWNER_CONFIG = {
  minSpawnLevel: 1,
  maxSpawnLevelCap: 7,
  decayRate: 0.45,
};

/** 연쇄 머지 설정 */
export const CHAIN_CONFIG = {
  maxChainDepth: 20,
};

/**
 * 큐브 좌표 기준 6방향 인접 오프셋.
 * 테스트에서 인접 셀을 계산할 때 사용한다.
 */
export const HEX_DIRECTIONS = [
  { q: +1, r:  0 }, // 동 (E)
  { q: +1, r: -1 }, // 북동 (NE)
  { q:  0, r: -1 }, // 북서 (NW)
  { q: -1, r:  0 }, // 서 (W)
  { q: -1, r: +1 }, // 남서 (SW)
  { q:  0, r: +1 }, // 남동 (SE)
];

/** 머지 테스트 시나리오 데이터 */
export const MERGE_SCENARIOS = [
  { name: '2+2=4',       sourceLevel: 1, targetLevel: 1, expectedValue: 4 },
  { name: '4+4=8',       sourceLevel: 2, targetLevel: 2, expectedValue: 8 },
  { name: '8+8=16',      sourceLevel: 3, targetLevel: 3, expectedValue: 16 },
  { name: '16+16=32',    sourceLevel: 4, targetLevel: 4, expectedValue: 32 },
  { name: '32+32=64',    sourceLevel: 5, targetLevel: 5, expectedValue: 64 },
  { name: '64+64=128',   sourceLevel: 6, targetLevel: 6, expectedValue: 128 },
  { name: '128+128=256', sourceLevel: 7, targetLevel: 7, expectedValue: 256 },
  { name: '256+256=512', sourceLevel: 8, targetLevel: 8, expectedValue: 512 },
  { name: '512+512=1K',  sourceLevel: 9, targetLevel: 9, expectedValue: 1024 },
];
```

### 7.2 자동화 전략

#### 7.2.1 CI/CD 통합

```
[CI 파이프라인 흐름]

1. Unity WebGL 빌드 (GitHub Actions / Jenkins)
   -> Build/WebGL/ 디렉토리에 출력

2. 정적 파일 서버 시작
   -> npx serve ./Build/WebGL -l 8080

3. Playwright 테스트 실행
   -> npx playwright test --project=chromium

4. 테스트 결과 리포트 생성
   -> test-results/report/index.html

5. 아티팩트 업로드 (실패 시 스크린샷/영상 포함)
```

#### 7.2.2 데이터 기반 테스트 (Parameterized)

`MERGE_SCENARIOS` 배열을 활용하여 모든 레벨 조합의 머지를 반복 테스트한다.

```typescript
import { test, expect } from '@playwright/test';
import { UnityHelper } from '../fixtures/unity-helper';
import { MERGE_SCENARIOS } from '../fixtures/test-data';

for (const scenario of MERGE_SCENARIOS) {
  test(`머지 검증: ${scenario.name}`, async ({ page }) => {
    const unity = new UnityHelper(page);
    await unity.waitForUnityReady();
    await unity.resetBoard();
    await unity.disableAutoWave();

    await unity.placeBlock(0, 0, scenario.sourceLevel);
    await unity.placeBlock(1, 0, scenario.targetLevel);

    await unity.tapCell(0, 0);
    await unity.tapCell(1, 0);
    await unity.waitForAnimationComplete();

    expect(await unity.getBlockValue(1, 0)).toBe(scenario.expectedValue);
  });
}
```

#### 7.2.3 테스트 격리 원칙

| 원칙 | 설명 |
|------|------|
| **보드 초기화** | 매 테스트 시작 시 `resetBoard()`로 빈 보드 상태에서 시작 |
| **웨이브 비활성화** | 머지 로직만 테스트할 때는 `disableAutoWave()`로 웨이브 간섭 제거 |
| **애니메이션 대기** | 모든 머지/웨이브 후 `waitForAnimationComplete()`로 동기화 |
| **독립적 배치** | 테스트마다 필요한 블록만 명시적으로 배치하여 상태 의존성 제거 |

#### 7.2.4 실행 명령어

```bash
# 전체 테스트 실행
npx playwright test

# 머지 시스템만 실행
npx playwright test e2e/merge-system/

# 특정 테스트 파일 실행
npx playwright test e2e/merge-system/merge-execute.spec.ts

# Chromium에서만 실행
npx playwright test --project=chromium

# 디버그 모드 (브라우저 표시)
npx playwright test --headed --debug

# 리포트 확인
npx playwright show-report test-results/report
```

#### 7.2.5 실패 디버깅 전략

| 상황 | 대응 |
|------|------|
| Unity 로딩 실패 | timeout 증가, WebGL 빌드 로그 확인, `waitForUnityReady` 재시도 로직 |
| 애니메이션 타이밍 이슈 | `waitForAnimationComplete` timeout 증가, 프레임 단위 대기 추가 |
| 상태 불일치 | 보드 스냅샷 로깅, 실패 시 스크린샷 자동 저장 |
| 브릿지 API 미응답 | `page.evaluate` timeout 확인, Unity 콘솔 에러 로그 수집 |
| 간헐적 실패 (Flaky) | `retries: 1` 설정, 실패 패턴 분석 후 대기 시간 조정 |
