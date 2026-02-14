# 07. 광고 보상 시스템 - Playwright 테스트 계획서

> **프로젝트**: Hexa Merge Basic
> **테스트 대상**: 광고 보상 시스템 (설계문서 `03_monetization-platform-design.md` 섹션 1)
> **개발 계획서**: `docs/development/07_ad-reward/development-plan.md`
> **테스트 방식**: Playwright (TypeScript) 기반 브라우저 E2E 테스트
> **플랫폼**: Unity WebGL 빌드
> **작성일**: 2026-02-13
> **문서 버전**: 1.0

---

## 목차

1. [테스트 개요](#1-테스트-개요)
2. [테스트 환경 설정](#2-테스트-환경-설정)
3. [테스트 케이스 목록](#3-테스트-케이스-목록)
4. [테스트 케이스 상세](#4-테스트-케이스-상세)
5. [Playwright TypeScript 코드 예제](#5-playwright-typescript-코드-예제)
6. [테스트 데이터 및 자동화 전략](#6-테스트-데이터-및-자동화-전략)

---

## 1. 테스트 개요

### 1.1 목적

Unity WebGL 빌드로 배포되는 Hexa Merge Basic 게임의 광고 보상 시스템이 설계문서에 정의된 요구사항대로 정상 동작하는지 검증한다. Playwright를 이용해 브라우저 환경에서 실제 사용자 시나리오를 자동화하며, 광고 SDK는 Mock으로 대체하여 테스트 환경에서의 결정적(deterministic) 결과를 보장한다.

### 1.2 범위

| 범위 | 포함 항목 |
|------|----------|
| **포함** | 보상형 광고 트리거 6종(T1~T6) 동작, 광고 시청 완료/취소 처리, 쿨다운/일일 제한, 폴백 처리, 오프라인 처리, GDPR 동의 |
| **제외** | 실제 AdMob/Unity Ads SDK 연동 (Mock 사용), Android 네이티브 빌드, 인앱 결제 시스템, 서버 영수증 검증 |

### 1.3 전제조건

| 항목 | 설명 |
|------|------|
| **Unity WebGL 빌드** | 테스트용 WebGL 빌드가 로컬 또는 스테이징 서버에 배포되어 있어야 한다 |
| **Mock Ad SDK** | 실제 광고 SDK 대신 `EditorAdsService` 기반의 Mock 광고 서비스가 WebGL 빌드에 활성화되어야 한다 |
| **테스트 모드 플래그** | Unity 빌드 시 `TEST_MODE` 스크립팅 심볼이 정의되어 Mock 서비스 및 시간 조작 API가 노출되어야 한다 |
| **JavaScript Bridge** | Unity WebGL의 `unityInstance.SendMessage()`를 통해 게임 상태를 외부에서 제어할 수 있어야 한다 |
| **브라우저 환경** | Chromium 기반 브라우저, 뷰포트 1280x720 |
| **네트워크 제어** | Playwright의 `page.route()` 또는 `context.setOffline()`을 통한 네트워크 상태 시뮬레이션 가능 |

### 1.4 참조 문서

- 설계문서: `docs/design/03_monetization-platform-design.md` -- 섹션 1. 광고 보상 시스템
- 개발 계획서: `docs/development/07_ad-reward/development-plan.md`

---

## 2. 테스트 환경 설정

### 2.1 Mock Ad SDK 구성

테스트 환경에서는 실제 광고 네트워크에 의존하지 않고, 게임 내부의 Mock 광고 서비스를 사용한다. WebGL 빌드에 `TEST_MODE` 심볼이 정의되면 `EditorAdsService`(Mock)가 자동으로 선택된다.

```
[테스트 환경 광고 SDK 구조]

Playwright (브라우저)
    |
    |-- unityInstance.SendMessage() --> Unity WebGL 게임
    |                                       |
    |                                       v
    |                                 AdRewardManager
    |                                       |
    |                                       v
    |                              MockAdsService (테스트용)
    |                                 - 설정 가능한 딜레이
    |                                 - 성공/실패 시뮬레이션
    |                                 - 결과를 JS 콜백으로 반환
    |
    |<-- window.gamebridge 이벤트 -- Unity -> JS 브릿지
```

**Mock 서비스 제어 API** (JavaScript Bridge):

| JS 호출 | 설명 |
|---------|------|
| `SendMessage('AdRewardManager', 'SetMockAdDelay', '2')` | Mock 광고 시뮬레이션 딜레이(초) 설정 |
| `SendMessage('AdRewardManager', 'SetMockAdResult', 'success')` | 다음 광고 결과를 성공으로 설정 |
| `SendMessage('AdRewardManager', 'SetMockAdResult', 'fail')` | 다음 광고 결과를 실패로 설정 |
| `SendMessage('AdRewardManager', 'SetMockAdResult', 'cancel')` | 다음 광고 결과를 사용자 취소로 설정 |
| `SendMessage('AdRewardManager', 'SetMockAdResult', 'no_fill')` | 다음 광고 결과를 광고 없음(NoFill)으로 설정 |
| `SendMessage('AdRewardManager', 'SetMockAdResult', 'network_error')` | 다음 광고 결과를 네트워크 오류로 설정 |
| `SendMessage('AdRewardManager', 'ResetDailyAdCount', '')` | 일일 광고 시청 횟수 초기화 |
| `SendMessage('AdRewardManager', 'SetDailyAdCount', '19')` | 일일 광고 시청 횟수를 특정 값으로 설정 |
| `SendMessage('AdRewardManager', 'ResetAllCooldowns', '')` | 모든 쿨다운 타이머 초기화 |
| `SendMessage('AdRewardManager', 'SetConsecutiveFailures', '0')` | 연속 실패 횟수 초기화 |
| `SendMessage('AdRewardManager', 'SimulateUTCMidnight', '')` | UTC 자정 리셋 시뮬레이션 |
| `SendMessage('GDPRConsentManager', 'ResetConsent', '')` | GDPR 동의 상태 초기화 |

**게임 상태 조회 API** (JS -> Unity 브릿지):

| JS 호출 | 반환 | 설명 |
|---------|------|------|
| `window.gamebridge.getDailyAdCount()` | `number` | 오늘 광고 시청 횟수 |
| `window.gamebridge.getPlayerCoins()` | `number` | 보유 코인 수 |
| `window.gamebridge.getPlayerHints()` | `number` | 보유 힌트 수 |
| `window.gamebridge.getCooldownRemaining(triggerType)` | `number` | 남은 쿨다운(초) |
| `window.gamebridge.isAdButtonVisible(triggerType)` | `boolean` | 광고 버튼 표시 여부 |
| `window.gamebridge.getConsecutiveFailures()` | `number` | 연속 실패 횟수 |
| `window.gamebridge.getLastRewardType()` | `string` | 마지막 지급된 보상 유형 |
| `window.gamebridge.isGDPRConsented()` | `boolean` | GDPR 동의 여부 |

### 2.2 테스트 광고 ID

테스트 환경에서는 실제 광고 단위 ID를 사용하지 않는다. Mock 서비스가 활성화되므로 광고 ID는 무시되지만, 설정 파일(`AdRewardConfig`)에는 다음 테스트 ID를 사용한다.

| 플랫폼 | 항목 | 테스트 ID |
|--------|------|----------|
| WebGL (Unity Ads) | Game ID | `test_game_9999999` |
| WebGL (Unity Ads) | Rewarded Placement ID | `test_rewardedVideo` |
| Android (AdMob) | Rewarded Ad Unit ID | `ca-app-pub-3940256099942544/5224354917` (Google 테스트 ID) |

### 2.3 Playwright 프로젝트 설정

```
tests/
  e2e/
    ad-reward/
      fixtures/
        ad-reward.fixture.ts    # 공통 테스트 픽스처
        unity-bridge.ts         # Unity WebGL 브릿지 헬퍼
      ad-trigger.spec.ts        # TC-AD-001 ~ TC-AD-006 (트리거 테스트)
      ad-completion.spec.ts     # TC-AD-007 ~ TC-AD-008 (완료/취소 테스트)
      ad-cooldown.spec.ts       # TC-AD-009 ~ TC-AD-010 (쿨다운 테스트)
      ad-daily-limit.spec.ts    # TC-AD-011 ~ TC-AD-012 (일일 제한 테스트)
      ad-fallback.spec.ts       # TC-AD-013 ~ TC-AD-015 (폴백 테스트)
      ad-offline.spec.ts        # TC-AD-016 ~ TC-AD-017 (오프라인 테스트)
      ad-gdpr.spec.ts           # TC-AD-018 (GDPR 동의 테스트)
```

### 2.4 playwright.config.ts 설정

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60_000,
  retries: 1,
  fullyParallel: false, // Unity WebGL은 단일 인스턴스 권장
  use: {
    baseURL: 'http://localhost:8080', // WebGL 빌드 서빙 주소
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npx serve ./Build/WebGL -l 8080 --single',
    port: 8080,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
```

---

## 3. 테스트 케이스 목록

### 3.1 체크리스트 요약

#### 보상형 광고 트리거 (T1~T6)

- [ ] **TC-AD-001**: T1 게임 오버 후 "이어하기" 광고 트리거 동작
- [ ] **TC-AD-002**: T2 힌트 충전 광고 트리거 동작
- [ ] **TC-AD-003**: T3 점수 부스터 활성화 광고 트리거 동작
- [ ] **TC-AD-004**: T4 특수 아이템 획득 광고 트리거 동작
- [ ] **TC-AD-005**: T5 일일 보너스 2배 광고 트리거 동작
- [ ] **TC-AD-006**: T6 코인 보너스 광고 트리거 동작

#### 광고 시청 완료/취소

- [ ] **TC-AD-007**: 광고 시청 완료 후 보상 정상 지급
- [ ] **TC-AD-008**: 광고 시청 중 취소 시 보상 미지급

#### 쿨다운 타이머

- [ ] **TC-AD-009**: 동일 트리거 쿨다운 (3분) 검증
- [ ] **TC-AD-010**: 서로 다른 트리거 쿨다운 (1분) 검증

#### 일일 제한

- [ ] **TC-AD-011**: 일일 제한 (20회) 도달 시 광고 차단
- [ ] **TC-AD-012**: 일일 제한 리셋 (UTC 자정) 검증

#### 광고 실패 폴백

- [ ] **TC-AD-013**: 광고 로드 실패 시 2차 SDK 전환 및 코인 대체
- [ ] **TC-AD-014**: 연속 3회 실패 시 광고 버튼 비활성화
- [ ] **TC-AD-015**: 네트워크 오류 시 1회 재시도 동작

#### 오프라인 처리

- [ ] **TC-AD-016**: 오프라인 시 광고 버튼 숨김 및 툴팁 표시
- [ ] **TC-AD-017**: 오프라인 대체 보상 (코인 1.5배 가격) 구매

#### GDPR 동의

- [ ] **TC-AD-018**: GDPR 동의 팝업 표시 및 동의/거부 처리

---

## 4. 테스트 케이스 상세

---

### TC-AD-001: T1 게임 오버 후 "이어하기" 광고 트리거

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-001 |
| **목적** | 게임 오버 상태에서 "이어하기" 광고 버튼이 표시되고, 클릭 시 광고가 재생되며, 보상으로 보드 상태가 유지된 채 게임이 계속되는지 검증한다 |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드가 로드된 상태 2. Mock 광고 서비스가 `success` 모드 3. 게임 플레이 중 |
| **테스트 단계** | 1. 게임을 시작하고 의도적으로 게임 오버 상태를 유도한다 (SendMessage로 게임 오버 트리거) 2. 게임 오버 화면에서 "이어하기" 광고 버튼이 표시되는지 확인한다 3. "이어하기" 버튼을 클릭한다 4. Mock 광고가 재생되는 동안 대기한다 (2초 시뮬레이션) 5. 광고 완료 후 게임 상태를 확인한다 |
| **기대결과** | 1. 게임 오버 화면에 "이어하기" 광고 버튼이 표시된다 2. 버튼 클릭 후 광고 재생 UI가 표시된다 3. 광고 완료 후 게임이 이어서 진행된다 (보드 상태 유지) 4. "이어하기" 버튼이 비활성화된다 (게임당 1회 제한) |

---

### TC-AD-002: T2 힌트 충전 광고 트리거

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-002 |
| **목적** | 힌트가 0개일 때 힌트 충전 광고 버튼이 표시되고, 광고 시청 완료 시 힌트 3개가 지급되는지 검증한다 |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 3. 플레이어 힌트 수가 0개 |
| **테스트 단계** | 1. 플레이어 힌트를 0개로 설정한다 (SendMessage) 2. 힌트 UI 영역에서 광고 버튼이 표시되는지 확인한다 3. 힌트 광고 버튼을 클릭한다 4. Mock 광고 완료를 대기한다 5. 플레이어 힌트 수를 조회한다 |
| **기대결과** | 1. 힌트 0개일 때 광고 버튼이 표시된다 2. 광고 완료 후 힌트가 3개 증가한다 3. 힌트가 0보다 큰 상태에서는 광고 버튼이 숨겨진다 |

---

### TC-AD-003: T3 점수 부스터 활성화 광고 트리거

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-003 |
| **목적** | 스테이지 시작 전 점수 부스터 광고 버튼이 표시되고, 광고 시청 완료 시 60초간 점수 2배 부스터가 활성화되는지 검증한다 |
| **우선순위** | 중간 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 3. 스테이지 시작 전 화면 |
| **테스트 단계** | 1. 새 게임 시작 전 화면으로 이동한다 2. 점수 부스터 광고 버튼이 표시되는지 확인한다 3. 점수 부스터 광고 버튼을 클릭한다 4. Mock 광고 완료를 대기한다 5. 부스터 활성화 UI 및 타이머를 확인한다 |
| **기대결과** | 1. 스테이지 시작 전 부스터 광고 버튼이 표시된다 2. 광고 완료 후 "2x" 부스터 UI가 표시된다 3. 60초 카운트다운 타이머가 동작한다 |

---

### TC-AD-004: T4 특수 아이템 획득 광고 트리거

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-004 |
| **목적** | 아이템 슬롯이 비어있을 때 특수 아이템 광고 버튼이 표시되고, 광고 시청 완료 시 랜덤 특수 아이템 1개가 지급되는지 검증한다 |
| **우선순위** | 중간 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 3. 아이템 슬롯이 비어있는 상태 |
| **테스트 단계** | 1. 아이템 슬롯을 비운다 (SendMessage) 2. 아이템 영역에서 광고 버튼이 표시되는지 확인한다 3. 아이템 광고 버튼을 클릭한다 4. Mock 광고 완료를 대기한다 5. 아이템 슬롯 상태를 확인한다 |
| **기대결과** | 1. 아이템 슬롯이 비었을 때 광고 버튼이 표시된다 2. 광고 완료 후 특수 아이템(셔플/폭탄/무지개 블록 중 1개)이 지급된다 3. 아이템 슬롯에 지급된 아이템이 표시된다 |

---

### TC-AD-005: T5 일일 보너스 2배 광고 트리거

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-005 |
| **목적** | 일일 출석 보상 수령 시 2배 광고 버튼이 표시되고, 광고 시청 완료 시 보상이 2배로 지급되는지 검증한다 |
| **우선순위** | 낮음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 3. 일일 출석 보상 수령 가능 상태 |
| **테스트 단계** | 1. 일일 출석 보상 팝업을 트리거한다 (SendMessage) 2. 보상 팝업에서 "2배 받기" 광고 버튼이 표시되는지 확인한다 3. 광고 버튼 클릭 전 기본 보상 수량을 기록한다 4. "2배 받기" 버튼을 클릭한다 5. Mock 광고 완료를 대기한다 6. 최종 지급된 보상 수량을 확인한다 |
| **기대결과** | 1. 출석 보상 팝업에 "2배 받기" 광고 버튼이 표시된다 2. 광고 완료 후 보상이 기본의 2배로 지급된다 3. 보상 지급 완료 애니메이션이 표시된다 |

---

### TC-AD-006: T6 코인 보너스 광고 트리거

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-006 |
| **목적** | 메인 화면의 코인 보너스 광고 버튼을 클릭하면 광고가 재생되고, 완료 시 코인 100개가 지급되는지 검증한다 |
| **우선순위** | 낮음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 3. 메인 화면 상태 |
| **테스트 단계** | 1. 메인 화면으로 이동한다 2. 코인 보너스 광고 버튼이 표시되는지 확인한다 3. 현재 코인 수를 기록한다 4. 코인 보너스 버튼을 클릭한다 5. Mock 광고 완료를 대기한다 6. 코인 수 변화를 확인한다 |
| **기대결과** | 1. 메인 화면에 코인 보너스 광고 버튼이 표시된다 2. 광고 완료 후 코인이 100개 증가한다 3. 코인 수 변경이 UI에 즉시 반영된다 |

---

### TC-AD-007: 광고 시청 완료 후 보상 정상 지급

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-007 |
| **목적** | 보상형 광고를 끝까지 시청(Mock에서 `success` 반환)했을 때, 트리거별로 올바른 보상이 정확한 수량으로 지급되는지 검증한다 |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 3. 모든 쿨다운 초기화 상태 |
| **테스트 단계** | 1. T2(힌트) 트리거의 사전 상태를 설정한다: 힌트 0개 2. T2 광고 버튼을 클릭하고 광고 완료를 대기한다 3. 힌트 수를 확인한다 4. T6(코인 보너스) 트리거의 사전 상태를 기록한다: 현재 코인 수 5. 쿨다운을 초기화하고 T6 광고 버튼을 클릭하고 광고 완료를 대기한다 6. 코인 수 변화를 확인한다 |
| **기대결과** | 1. T2 광고 완료 후 힌트가 정확히 3개 증가한다 2. T6 광고 완료 후 코인이 정확히 100개 증가한다 3. 일일 광고 시청 카운터가 2 증가한다 4. 각 트리거의 쿨다운 타이머가 시작된다 |

---

### TC-AD-008: 광고 시청 중 취소 시 보상 미지급

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-008 |
| **목적** | 사용자가 광고를 중간에 닫거나 건너뛰었을 때(Mock에서 `cancel` 반환) 보상이 지급되지 않는지 검증한다 |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `cancel` 모드로 설정 3. 플레이어 힌트 0개 |
| **테스트 단계** | 1. Mock 광고 결과를 `cancel`로 설정한다 2. 현재 힌트 수와 코인 수를 기록한다 3. T2(힌트) 광고 버튼을 클릭한다 4. Mock 광고 취소 콜백 대기 5. 힌트 수와 코인 수를 재확인한다 |
| **기대결과** | 1. 광고 취소 후 힌트 수가 변하지 않는다 (여전히 0개) 2. 코인 수가 변하지 않는다 3. 일일 광고 시청 카운터가 증가하지 않는다 4. 쿨다운 타이머가 시작되지 않는다 5. 광고 버튼이 다시 클릭 가능한 상태로 복원된다 |

---

### TC-AD-009: 동일 트리거 쿨다운 (3분) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-009 |
| **목적** | 동일 트리거(예: T6)에서 광고 시청 후 3분 쿨다운이 적용되어, 3분 이내에는 같은 트리거의 광고를 시청할 수 없는지 검증한다. T1(이어하기)은 쿨다운이 없음을 함께 검증한다. |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 3. 모든 쿨다운 초기화 상태 |
| **테스트 단계** | 1. T6(코인 보너스) 광고를 시청 완료한다 2. 즉시 T6 광고 버튼 상태를 확인한다 3. 남은 쿨다운 시간을 조회한다 4. T6 버튼을 클릭하고 결과를 확인한다 5. 시간을 조작하여 3분을 경과시킨다 (SendMessage) 6. T6 버튼 상태를 다시 확인한다 |
| **기대결과** | 1. T6 광고 시청 직후 T6 버튼이 비활성화된다 2. 남은 쿨다운이 약 180초로 표시된다 3. 3분 이내 T6 클릭 시 "잠시 후 다시 시도" 팝업이 표시된다 4. 3분 경과 후 T6 버튼이 다시 활성화된다 5. T1(이어하기)은 쿨다운 없이 즉시 사용 가능하다 (게임당 1회 제한만 적용) |

---

### TC-AD-010: 서로 다른 트리거 쿨다운 (1분) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-010 |
| **목적** | 하나의 트리거에서 광고 시청 후 서로 다른 트리거에도 1분 쿨다운이 적용되는지 검증한다 |
| **우선순위** | 중간 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 3. 모든 쿨다운 초기화 상태 |
| **테스트 단계** | 1. T6(코인 보너스) 광고를 시청 완료한다 2. 즉시 T2(힌트) 광고 버튼 상태를 확인한다 3. T2의 남은 쿨다운 시간을 조회한다 4. T2 버튼을 클릭하고 결과를 확인한다 5. 시간을 1분 경과시킨다 (SendMessage) 6. T2 버튼 상태를 다시 확인한다 |
| **기대결과** | 1. T6 시청 직후 T2 버튼이 비활성화된다 (서로 다른 트리거 1분 쿨다운) 2. T2의 남은 쿨다운이 약 60초로 표시된다 3. 1분 이내 T2 클릭 시 "잠시 후 다시 시도" 팝업이 표시된다 4. 1분 경과 후 T2 버튼이 활성화된다 (단, T6은 여전히 3분 쿨다운 중) |

---

### TC-AD-011: 일일 제한 (20회) 도달 시 광고 차단

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-011 |
| **목적** | 일일 광고 시청 횟수가 20회에 도달하면 추가 광고 시청이 차단되고 안내 팝업이 표시되는지 검증한다 |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `success` 모드 |
| **테스트 단계** | 1. 일일 광고 시청 횟수를 19회로 설정한다 (SendMessage) 2. 쿨다운을 초기화한다 3. T6 광고를 시청 완료한다 (20회째) 4. 일일 시청 횟수가 20회인지 확인한다 5. 쿨다운을 초기화한다 6. T6 광고 버튼을 클릭한다 (21회째 시도) 7. 결과를 확인한다 |
| **기대결과** | 1. 20회째 광고는 정상 시청되고 보상이 지급된다 2. 일일 시청 카운터가 20으로 기록된다 3. 21회째 시도 시 "오늘의 광고 시청 한도에 도달했습니다" 팝업이 표시된다 4. 모든 광고 버튼이 비활성화된다 5. 보상이 지급되지 않는다 |

---

### TC-AD-012: 일일 제한 리셋 (UTC 자정) 검증

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-012 |
| **목적** | UTC 자정이 지나면 일일 광고 시청 카운터가 0으로 리셋되고 광고 버튼이 다시 활성화되는지 검증한다 |
| **우선순위** | 중간 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. 일일 광고 시청 횟수가 20회(한도 도달) 상태 |
| **테스트 단계** | 1. 일일 시청 횟수를 20회로 설정한다 2. 모든 광고 버튼이 비활성화되었는지 확인한다 3. UTC 자정 리셋을 시뮬레이션한다 (SendMessage: `SimulateUTCMidnight`) 4. 일일 시청 횟수를 조회한다 5. T6 광고 버튼 상태를 확인한다 |
| **기대결과** | 1. UTC 자정 리셋 후 일일 시청 횟수가 0으로 초기화된다 2. 모든 쿨다운 타이머도 초기화된다 3. 광고 버튼이 다시 활성화된다 4. 광고 시청이 다시 가능하다 |

---

### TC-AD-013: 광고 로드 실패 시 2차 SDK 전환 및 코인 대체

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-013 |
| **목적** | 1차 광고 SDK가 실패하면 2차 SDK로 자동 전환을 시도하고, 2차도 실패하면 코인 50개로 동일 보상을 구매할 수 있는 대체 옵션이 제공되는지 검증한다 |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `fail` 모드로 설정 3. 플레이어 코인 100개 이상 보유 |
| **테스트 단계** | 1. Mock 광고 결과를 `fail`로 설정한다 2. T6(코인 보너스) 광고 버튼을 클릭한다 3. 1차 SDK 실패 후 폴백 처리를 관찰한다 4. 2차 SDK도 실패 시 코인 대체 팝업이 표시되는지 확인한다 5. 코인 대체 팝업에서 "코인 50개로 구매" 버튼을 클릭한다 6. 보상 지급 및 코인 차감을 확인한다 |
| **기대결과** | 1. 1차 SDK 실패 시 자동으로 2차 SDK 전환을 시도한다 2. 모든 SDK 실패 시 "코인으로 대체 구매" 팝업이 표시된다 3. 코인 50개로 동일 보상을 구매할 수 있다 4. "나중에 다시" 버튼도 함께 제공된다 |

---

### TC-AD-014: 연속 3회 실패 시 광고 버튼 비활성화

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-014 |
| **목적** | 광고가 연속 3회 실패하면 해당 세션에서 모든 광고 버튼이 비활성화되는지 검증한다 |
| **우선순위** | 중간 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 광고 서비스 `fail` 모드 3. 연속 실패 횟수 0회 |
| **테스트 단계** | 1. Mock 광고 결과를 `fail`로 설정한다 2. 연속 실패 횟수를 0으로 초기화한다 3. 광고 버튼을 3회 연속 클릭하고 각각의 실패를 확인한다 (쿨다운 초기화 필요) 4. 3회째 실패 후 연속 실패 횟수를 조회한다 5. 모든 광고 버튼 상태를 확인한다 |
| **기대결과** | 1. 1회, 2회 실패 시 광고 버튼이 여전히 활성화 상태이다 2. 3회 연속 실패 후 모든 광고 버튼이 비활성화된다 3. 연속 실패 카운터가 3으로 기록된다 4. 세션이 유지되는 동안 광고 버튼이 비활성화 상태로 유지된다 |

---

### TC-AD-015: 네트워크 오류 시 1회 재시도 동작

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-015 |
| **목적** | 광고 로드 중 네트워크 오류가 발생하면 자동으로 1회 재시도가 수행되는지 검증한다 |
| **우선순위** | 중간 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. Mock 서비스가 첫 번째 호출에서 `network_error`, 두 번째 호출에서 `success`를 반환하도록 설정 |
| **테스트 단계** | 1. Mock 광고 결과를 `network_error`로 설정한다 (첫 호출만) 2. T6 광고 버튼을 클릭한다 3. 재시도 동작을 관찰한다 4. 재시도 후 결과를 확인한다 |
| **기대결과** | 1. 첫 번째 시도에서 네트워크 오류가 발생한다 2. 자동으로 1회 재시도가 수행된다 3. 재시도 성공 시 보상이 정상 지급된다 4. 재시도도 실패하면 폴백 처리(2차 SDK -> 코인 대체)로 이동한다 |

---

### TC-AD-016: 오프라인 시 광고 버튼 숨김 및 툴팁 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-016 |
| **목적** | 네트워크가 오프라인 상태일 때 모든 광고 버튼이 숨겨지고 "오프라인 상태" 툴팁이 표시되며, 온라인 복귀 시 자동으로 복원되는지 검증한다 |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. 초기에는 온라인 상태 |
| **테스트 단계** | 1. 메인 화면에서 광고 버튼(T6)이 표시되는지 확인한다 2. Playwright `context.setOffline(true)`로 오프라인 상태로 전환한다 3. 네트워크 상태 감지 대기 (최대 5초) 4. 모든 광고 버튼 표시 상태를 확인한다 5. "오프라인 상태" 툴팁 표시를 확인한다 6. `context.setOffline(false)`로 온라인으로 복귀한다 7. 네트워크 복귀 감지 대기 (최대 5초) 8. 광고 버튼 재활성화 및 툴팁 숨김을 확인한다 |
| **기대결과** | 1. 오프라인 전환 시 모든 광고 버튼이 숨겨진다 2. "오프라인 상태" 툴팁이 표시된다 3. 온라인 복귀 시 광고 버튼이 다시 표시된다 4. 온라인 복귀 시 광고가 자동으로 미리 로드된다 5. 툴팁이 숨겨진다 |

---

### TC-AD-017: 오프라인 대체 보상 (코인 1.5배 가격) 구매

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-017 |
| **목적** | 오프라인 상태에서 코인으로 보상을 구매할 수 있으며, 가격이 온라인 대비 1.5배(75코인)인지 검증한다 |
| **우선순위** | 중간 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. 오프라인 상태 3. 플레이어 코인 100개 이상 보유 |
| **테스트 단계** | 1. 플레이어 코인을 200개로 설정한다 2. `context.setOffline(true)`로 오프라인 전환한다 3. 오프라인 감지 대기 4. 오프라인 대체 보상 UI에서 힌트 구매 옵션을 찾는다 5. 표시된 가격이 75코인(50 x 1.5배)인지 확인한다 6. 구매 버튼을 클릭한다 7. 코인 차감 및 보상 지급을 확인한다 |
| **기대결과** | 1. 오프라인 상태에서 코인 대체 구매 UI가 제공된다 2. 가격이 온라인(50코인)의 1.5배인 75코인으로 표시된다 3. 구매 시 코인 75개가 차감된다 (200 -> 125) 4. 해당 보상(예: 힌트 3개)이 정상 지급된다 |

---

### TC-AD-018: GDPR 동의 팝업 표시 및 동의/거부 처리

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AD-018 |
| **목적** | 최초 실행 시 GDPR 동의 팝업이 표시되고, 동의/거부 선택이 저장되며, 광고 SDK에 올바르게 전달되는지 검증한다 |
| **우선순위** | 높음 |
| **사전조건** | 1. WebGL 빌드 로드 완료 2. GDPR 동의 상태가 초기화된 상태 (미확인) |
| **테스트 단계** | **시나리오 A: 동의** 1. GDPR 동의 상태를 초기화한다 (SendMessage: `ResetConsent`) 2. 페이지를 새로고침한다 3. GDPR 동의 팝업이 표시되는지 확인한다 4. "동의" 버튼을 클릭한다 5. 동의 상태를 조회한다 6. 광고 버튼이 활성화되는지 확인한다 **시나리오 B: 거부** 7. GDPR 동의 상태를 다시 초기화한다 8. 페이지를 새로고침한다 9. "거부" 버튼을 클릭한다 10. 동의 상태를 조회한다 11. 광고 기능의 동작을 확인한다 |
| **기대결과** | **시나리오 A (동의):** 1. GDPR 팝업에 개인정보 수집 목적, 동의/거부 버튼이 표시된다 2. "동의" 클릭 후 동의 상태가 `true`로 저장된다 3. 팝업이 닫힌다 4. 광고 SDK에 동의 상태가 전달된다 5. 이후 재방문 시 팝업이 다시 표시되지 않는다 **시나리오 B (거부):** 6. "거부" 클릭 후 동의 상태가 `false`로 저장된다 7. 광고 SDK에 비동의 상태가 전달된다 8. 광고는 여전히 시청 가능하되 개인화 광고가 비활성화된다 |

---

## 5. Playwright TypeScript 코드 예제

### 5.1 공통 픽스처 (ad-reward.fixture.ts)

```typescript
import { test as base, Page, expect } from '@playwright/test';

/**
 * Unity WebGL 게임과의 브릿지 통신 헬퍼.
 * unityInstance.SendMessage()를 통해 게임 상태를 제어하고,
 * window.gamebridge를 통해 게임 상태를 조회한다.
 */
class UnityBridge {
  constructor(private page: Page) {}

  /**
   * Unity 게임 인스턴스가 완전히 로드될 때까지 대기한다.
   * Unity WebGL 로더가 완료되면 window.unityInstance가 설정된다.
   */
  async waitForUnityLoad(timeout = 30_000): Promise<void> {
    await this.page.waitForFunction(
      () => (window as any).unityInstance !== undefined,
      { timeout }
    );
    // 게임 초기화 완료 대기 (gamebridge 객체 생성)
    await this.page.waitForFunction(
      () => (window as any).gamebridge !== undefined,
      { timeout }
    );
  }

  /**
   * Unity에 SendMessage를 보낸다.
   */
  async sendMessage(
    gameObject: string,
    method: string,
    param: string = ''
  ): Promise<void> {
    await this.page.evaluate(
      ({ go, m, p }) => {
        (window as any).unityInstance.SendMessage(go, m, p);
      },
      { go: gameObject, m: method, p: param }
    );
  }

  /**
   * Mock 광고의 다음 결과를 설정한다.
   * @param result 'success' | 'fail' | 'cancel' | 'no_fill' | 'network_error'
   */
  async setMockAdResult(
    result: 'success' | 'fail' | 'cancel' | 'no_fill' | 'network_error'
  ): Promise<void> {
    await this.sendMessage('AdRewardManager', 'SetMockAdResult', result);
  }

  /**
   * Mock 광고 시뮬레이션 딜레이(초)를 설정한다.
   */
  async setMockAdDelay(seconds: number): Promise<void> {
    await this.sendMessage(
      'AdRewardManager',
      'SetMockAdDelay',
      seconds.toString()
    );
  }

  /** 일일 광고 시청 횟수를 설정한다. */
  async setDailyAdCount(count: number): Promise<void> {
    await this.sendMessage(
      'AdRewardManager',
      'SetDailyAdCount',
      count.toString()
    );
  }

  /** 일일 광고 시청 횟수를 초기화한다. */
  async resetDailyAdCount(): Promise<void> {
    await this.sendMessage('AdRewardManager', 'ResetDailyAdCount', '');
  }

  /** 모든 쿨다운 타이머를 초기화한다. */
  async resetAllCooldowns(): Promise<void> {
    await this.sendMessage('AdRewardManager', 'ResetAllCooldowns', '');
  }

  /** 연속 실패 횟수를 설정한다. */
  async setConsecutiveFailures(count: number): Promise<void> {
    await this.sendMessage(
      'AdRewardManager',
      'SetConsecutiveFailures',
      count.toString()
    );
  }

  /** UTC 자정 리셋을 시뮬레이션한다. */
  async simulateUTCMidnight(): Promise<void> {
    await this.sendMessage('AdRewardManager', 'SimulateUTCMidnight', '');
  }

  /** GDPR 동의 상태를 초기화한다. */
  async resetGDPRConsent(): Promise<void> {
    await this.sendMessage('GDPRConsentManager', 'ResetConsent', '');
  }

  /** 게임 오버를 트리거한다. */
  async triggerGameOver(): Promise<void> {
    await this.sendMessage('GameManager', 'TriggerGameOver', '');
  }

  /** 플레이어 힌트를 설정한다. */
  async setPlayerHints(count: number): Promise<void> {
    await this.sendMessage(
      'PlayerInventory',
      'SetHints',
      count.toString()
    );
  }

  /** 플레이어 코인을 설정한다. */
  async setPlayerCoins(count: number): Promise<void> {
    await this.sendMessage(
      'PlayerInventory',
      'SetCoins',
      count.toString()
    );
  }

  // --- 상태 조회 메서드 ---

  /** 오늘 광고 시청 횟수를 반환한다. */
  async getDailyAdCount(): Promise<number> {
    return this.page.evaluate(
      () => (window as any).gamebridge.getDailyAdCount()
    );
  }

  /** 플레이어 코인 수를 반환한다. */
  async getPlayerCoins(): Promise<number> {
    return this.page.evaluate(
      () => (window as any).gamebridge.getPlayerCoins()
    );
  }

  /** 플레이어 힌트 수를 반환한다. */
  async getPlayerHints(): Promise<number> {
    return this.page.evaluate(
      () => (window as any).gamebridge.getPlayerHints()
    );
  }

  /** 특정 트리거의 남은 쿨다운(초)을 반환한다. */
  async getCooldownRemaining(triggerType: string): Promise<number> {
    return this.page.evaluate(
      (t) => (window as any).gamebridge.getCooldownRemaining(t),
      triggerType
    );
  }

  /** 특정 트리거의 광고 버튼 표시 여부를 반환한다. */
  async isAdButtonVisible(triggerType: string): Promise<boolean> {
    return this.page.evaluate(
      (t) => (window as any).gamebridge.isAdButtonVisible(t),
      triggerType
    );
  }

  /** 연속 실패 횟수를 반환한다. */
  async getConsecutiveFailures(): Promise<number> {
    return this.page.evaluate(
      () => (window as any).gamebridge.getConsecutiveFailures()
    );
  }

  /** GDPR 동의 여부를 반환한다. */
  async isGDPRConsented(): Promise<boolean> {
    return this.page.evaluate(
      () => (window as any).gamebridge.isGDPRConsented()
    );
  }

  /** 마지막 지급된 보상 유형을 반환한다. */
  async getLastRewardType(): Promise<string> {
    return this.page.evaluate(
      () => (window as any).gamebridge.getLastRewardType()
    );
  }
}

/**
 * 광고 보상 테스트 전용 픽스처.
 * Unity WebGL 로드 + Mock 광고 초기 설정을 포함한다.
 */
type AdRewardFixtures = {
  unity: UnityBridge;
};

export const test = base.extend<AdRewardFixtures>({
  unity: async ({ page }, use) => {
    // WebGL 빌드 페이지로 이동
    await page.goto('/');

    const unity = new UnityBridge(page);

    // Unity 게임이 완전히 로드될 때까지 대기
    await unity.waitForUnityLoad();

    // 테스트 초기 상태 설정
    await unity.setMockAdResult('success');
    await unity.setMockAdDelay(0.5); // 테스트 시 빠른 진행
    await unity.resetDailyAdCount();
    await unity.resetAllCooldowns();
    await unity.setConsecutiveFailures(0);

    await use(unity);
  },
});

export { expect };
```

### 5.2 트리거 테스트 (ad-trigger.spec.ts)

```typescript
import { test, expect } from '../fixtures/ad-reward.fixture';

test.describe('보상형 광고 트리거 포인트 (T1~T6)', () => {
  /**
   * TC-AD-001: T1 게임 오버 후 "이어하기" 광고 트리거
   */
  test('TC-AD-001: 게임 오버 시 이어하기 광고 버튼이 표시되고 시청 완료 시 게임이 계속된다', async ({
    unity,
    page,
  }) => {
    // 게임 오버 트리거
    await unity.triggerGameOver();

    // 게임 오버 화면에서 이어하기 버튼 확인
    const continueAdBtn = page.locator('[data-testid="ad-btn-t1-continue"]');
    await expect(continueAdBtn).toBeVisible({ timeout: 5_000 });

    // 이어하기 버튼 클릭
    await continueAdBtn.click();

    // 광고 시뮬레이션 완료 대기
    await page.waitForFunction(
      () => (window as any).gamebridge.getLastRewardType() === 'T1_Continue',
      { timeout: 10_000 }
    );

    // 게임이 계속 진행되는지 확인 (게임 오버 화면이 사라짐)
    const gameOverScreen = page.locator('[data-testid="game-over-screen"]');
    await expect(gameOverScreen).not.toBeVisible();

    // 이어하기 버튼이 비활성화(게임당 1회 제한) 확인
    // 다시 게임 오버를 유도한 후 확인
    await unity.triggerGameOver();
    const continueAdBtnAfter = page.locator(
      '[data-testid="ad-btn-t1-continue"]'
    );
    await expect(continueAdBtnAfter).not.toBeVisible();
  });

  /**
   * TC-AD-002: T2 힌트 충전 광고 트리거
   */
  test('TC-AD-002: 힌트 0개일 때 광고 버튼이 표시되고 시청 완료 시 힌트 3개가 지급된다', async ({
    unity,
    page,
  }) => {
    // 힌트를 0개로 설정
    await unity.setPlayerHints(0);

    // 힌트 광고 버튼 확인
    const hintAdBtn = page.locator('[data-testid="ad-btn-t2-hint"]');
    await expect(hintAdBtn).toBeVisible({ timeout: 5_000 });

    // 시청 전 힌트 수 기록
    const hintsBefore = await unity.getPlayerHints();
    expect(hintsBefore).toBe(0);

    // 광고 버튼 클릭
    await hintAdBtn.click();

    // 광고 완료 대기
    await page.waitForFunction(
      () => (window as any).gamebridge.getPlayerHints() > 0,
      { timeout: 10_000 }
    );

    // 힌트 3개 지급 확인
    const hintsAfter = await unity.getPlayerHints();
    expect(hintsAfter).toBe(3);

    // 힌트가 0보다 크면 광고 버튼 숨김 확인
    await expect(hintAdBtn).not.toBeVisible();
  });

  /**
   * TC-AD-006: T6 코인 보너스 광고 트리거
   */
  test('TC-AD-006: 코인 보너스 광고 시청 완료 시 코인 100개가 지급된다', async ({
    unity,
    page,
  }) => {
    // 현재 코인 기록
    const coinsBefore = await unity.getPlayerCoins();

    // 코인 보너스 버튼 확인
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible({ timeout: 5_000 });

    // 버튼 클릭
    await coinAdBtn.click();

    // 광고 완료 대기
    await page.waitForFunction(
      (before) =>
        (window as any).gamebridge.getPlayerCoins() > before,
      coinsBefore,
      { timeout: 10_000 }
    );

    // 코인 100개 증가 확인
    const coinsAfter = await unity.getPlayerCoins();
    expect(coinsAfter).toBe(coinsBefore + 100);

    // 일일 시청 카운터 증가 확인
    const dailyCount = await unity.getDailyAdCount();
    expect(dailyCount).toBe(1);
  });
});
```

### 5.3 광고 완료/취소 테스트 (ad-completion.spec.ts)

```typescript
import { test, expect } from '../fixtures/ad-reward.fixture';

test.describe('광고 시청 완료 및 취소', () => {
  /**
   * TC-AD-007: 광고 시청 완료 후 보상 정상 지급
   */
  test('TC-AD-007: 광고 시청 완료 시 트리거별 올바른 보상이 지급된다', async ({
    unity,
    page,
  }) => {
    // T2(힌트) 보상 검증
    await unity.setPlayerHints(0);
    await unity.setMockAdResult('success');

    const hintAdBtn = page.locator('[data-testid="ad-btn-t2-hint"]');
    await expect(hintAdBtn).toBeVisible();
    await hintAdBtn.click();

    await page.waitForFunction(
      () => (window as any).gamebridge.getPlayerHints() === 3,
      { timeout: 10_000 }
    );

    const hints = await unity.getPlayerHints();
    expect(hints).toBe(3);

    // 쿨다운 초기화 후 T6(코인) 보상 검증
    await unity.resetAllCooldowns();
    const coinsBefore = await unity.getPlayerCoins();

    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible();
    await coinAdBtn.click();

    await page.waitForFunction(
      (before) =>
        (window as any).gamebridge.getPlayerCoins() === before + 100,
      coinsBefore,
      { timeout: 10_000 }
    );

    const coinsAfter = await unity.getPlayerCoins();
    expect(coinsAfter).toBe(coinsBefore + 100);

    // 일일 카운터가 2 증가했는지 확인
    const dailyCount = await unity.getDailyAdCount();
    expect(dailyCount).toBe(2);
  });

  /**
   * TC-AD-008: 광고 시청 중 취소 시 보상 미지급
   */
  test('TC-AD-008: 광고 취소 시 보상이 지급되지 않는다', async ({
    unity,
    page,
  }) => {
    // Mock 결과를 cancel로 설정
    await unity.setMockAdResult('cancel');
    await unity.setPlayerHints(0);

    const hintsBefore = await unity.getPlayerHints();
    const coinsBefore = await unity.getPlayerCoins();

    // 힌트 광고 버튼 클릭
    const hintAdBtn = page.locator('[data-testid="ad-btn-t2-hint"]');
    await expect(hintAdBtn).toBeVisible();
    await hintAdBtn.click();

    // Mock 광고 취소 처리 대기
    await page.waitForTimeout(2_000);

    // 보상 미지급 확인
    const hintsAfter = await unity.getPlayerHints();
    const coinsAfter = await unity.getPlayerCoins();
    expect(hintsAfter).toBe(hintsBefore);
    expect(coinsAfter).toBe(coinsBefore);

    // 일일 카운터 미증가 확인
    const dailyCount = await unity.getDailyAdCount();
    expect(dailyCount).toBe(0);

    // 버튼이 다시 클릭 가능한 상태인지 확인
    await expect(hintAdBtn).toBeVisible();
    await expect(hintAdBtn).toBeEnabled();
  });
});
```

### 5.4 쿨다운 타이머 테스트 (ad-cooldown.spec.ts)

```typescript
import { test, expect } from '../fixtures/ad-reward.fixture';

test.describe('쿨다운 타이머', () => {
  /**
   * TC-AD-009: 동일 트리거 쿨다운 (3분)
   */
  test('TC-AD-009: 동일 트리거에서 3분 쿨다운이 적용된다', async ({
    unity,
    page,
  }) => {
    // T6 광고 시청 완료
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible();
    await coinAdBtn.click();

    // 광고 완료 대기
    await page.waitForTimeout(1_500);

    // T6 버튼 비활성화 확인
    const isT6Visible = await unity.isAdButtonVisible('T6_CoinBonus');
    expect(isT6Visible).toBe(false);

    // 남은 쿨다운 확인 (약 180초)
    const cooldown = await unity.getCooldownRemaining('T6_CoinBonus');
    expect(cooldown).toBeGreaterThan(170);
    expect(cooldown).toBeLessThanOrEqual(180);

    // T6 강제 클릭 시도 - "잠시 후 다시 시도" 팝업 확인
    // (버튼이 숨겨져 있으므로 SendMessage로 직접 요청)
    await unity.sendMessage(
      'AdRewardManager',
      'RequestAdByTrigger',
      'T6_CoinBonus'
    );
    const cooldownPopup = page.locator('[data-testid="cooldown-popup"]');
    await expect(cooldownPopup).toBeVisible({ timeout: 3_000 });

    // 시간 조작: 3분 경과 시뮬레이션
    await unity.sendMessage('AdRewardManager', 'AdvanceTime', '180');

    // T6 버튼 재활성화 확인
    const isT6VisibleAfter = await unity.isAdButtonVisible('T6_CoinBonus');
    expect(isT6VisibleAfter).toBe(true);
  });

  /**
   * TC-AD-010: 서로 다른 트리거 쿨다운 (1분)
   */
  test('TC-AD-010: 서로 다른 트리거에 1분 쿨다운이 적용된다', async ({
    unity,
    page,
  }) => {
    // T6 광고 시청 완료
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible();
    await coinAdBtn.click();
    await page.waitForTimeout(1_500);

    // T2(힌트) 버튼 비활성화 확인 (1분 쿨다운)
    await unity.setPlayerHints(0);
    const isT2Visible = await unity.isAdButtonVisible('T2_Hint');
    expect(isT2Visible).toBe(false);

    // T2의 남은 쿨다운 확인 (약 60초)
    const cooldown = await unity.getCooldownRemaining('T2_Hint');
    expect(cooldown).toBeGreaterThan(50);
    expect(cooldown).toBeLessThanOrEqual(60);

    // 시간 조작: 1분 경과
    await unity.sendMessage('AdRewardManager', 'AdvanceTime', '60');

    // T2 활성화, T6은 여전히 비활성화 확인
    const isT2VisibleAfter = await unity.isAdButtonVisible('T2_Hint');
    expect(isT2VisibleAfter).toBe(true);

    const isT6StillCooldown = await unity.isAdButtonVisible('T6_CoinBonus');
    expect(isT6StillCooldown).toBe(false); // 아직 2분 남음
  });
});
```

### 5.5 일일 제한 테스트 (ad-daily-limit.spec.ts)

```typescript
import { test, expect } from '../fixtures/ad-reward.fixture';

test.describe('일일 광고 시청 제한', () => {
  /**
   * TC-AD-011: 일일 제한 (20회) 도달 시 광고 차단
   */
  test('TC-AD-011: 20회 시청 후 추가 광고가 차단된다', async ({
    unity,
    page,
  }) => {
    // 19회로 설정
    await unity.setDailyAdCount(19);
    await unity.resetAllCooldowns();

    // 20회째 광고 시청 (정상)
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible();
    const coinsBefore = await unity.getPlayerCoins();
    await coinAdBtn.click();

    await page.waitForFunction(
      (before) =>
        (window as any).gamebridge.getPlayerCoins() === before + 100,
      coinsBefore,
      { timeout: 10_000 }
    );

    // 일일 카운터가 20인지 확인
    const count = await unity.getDailyAdCount();
    expect(count).toBe(20);

    // 쿨다운 초기화 후 21회째 시도
    await unity.resetAllCooldowns();

    // 21회째 시도 - 한도 초과 팝업 확인
    await unity.sendMessage(
      'AdRewardManager',
      'RequestAdByTrigger',
      'T6_CoinBonus'
    );

    const limitPopup = page.locator('[data-testid="daily-limit-popup"]');
    await expect(limitPopup).toBeVisible({ timeout: 5_000 });
    await expect(limitPopup).toContainText('광고 시청 한도');

    // 코인이 추가로 증가하지 않았는지 확인
    const coinsAfter = await unity.getPlayerCoins();
    expect(coinsAfter).toBe(coinsBefore + 100); // 20회째 보상만 반영
  });

  /**
   * TC-AD-012: 일일 제한 리셋 (UTC 자정)
   */
  test('TC-AD-012: UTC 자정에 일일 카운터가 리셋된다', async ({
    unity,
    page,
  }) => {
    // 20회로 설정 (한도 도달)
    await unity.setDailyAdCount(20);

    // 광고 버튼 비활성화 확인
    const isVisible = await unity.isAdButtonVisible('T6_CoinBonus');
    expect(isVisible).toBe(false);

    // UTC 자정 리셋 시뮬레이션
    await unity.simulateUTCMidnight();

    // 카운터 리셋 확인
    const count = await unity.getDailyAdCount();
    expect(count).toBe(0);

    // 광고 버튼 재활성화 확인
    const isVisibleAfter = await unity.isAdButtonVisible('T6_CoinBonus');
    expect(isVisibleAfter).toBe(true);

    // 광고 시청이 다시 가능한지 확인
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible();
  });
});
```

### 5.6 폴백 테스트 (ad-fallback.spec.ts)

```typescript
import { test, expect } from '../fixtures/ad-reward.fixture';

test.describe('광고 실패 폴백 처리', () => {
  /**
   * TC-AD-013: 광고 로드 실패 시 2차 SDK 전환 및 코인 대체
   */
  test('TC-AD-013: 모든 SDK 실패 시 코인 대체 구매 옵션이 제공된다', async ({
    unity,
    page,
  }) => {
    // Mock 결과를 fail로 설정
    await unity.setMockAdResult('fail');
    await unity.setPlayerCoins(200);

    // T6 광고 버튼 클릭
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible();
    await coinAdBtn.click();

    // 폴백 후 코인 대체 팝업 확인
    const coinAlternativePopup = page.locator(
      '[data-testid="coin-alternative-popup"]'
    );
    await expect(coinAlternativePopup).toBeVisible({ timeout: 10_000 });

    // "코인 50개로 구매" 버튼 확인
    const buyWithCoinsBtn = page.locator(
      '[data-testid="buy-with-coins-btn"]'
    );
    await expect(buyWithCoinsBtn).toBeVisible();
    await expect(buyWithCoinsBtn).toContainText('50');

    // "나중에 다시" 버튼 확인
    const laterBtn = page.locator('[data-testid="later-btn"]');
    await expect(laterBtn).toBeVisible();

    // 코인으로 구매
    const coinsBefore = await unity.getPlayerCoins();
    await buyWithCoinsBtn.click();

    // 코인 차감 확인
    await page.waitForFunction(
      (before) =>
        (window as any).gamebridge.getPlayerCoins() === before - 50,
      coinsBefore,
      { timeout: 5_000 }
    );

    const coinsAfter = await unity.getPlayerCoins();
    expect(coinsAfter).toBe(coinsBefore - 50);
  });

  /**
   * TC-AD-014: 연속 3회 실패 시 광고 버튼 비활성화
   */
  test('TC-AD-014: 3회 연속 실패 후 광고 버튼이 비활성화된다', async ({
    unity,
    page,
  }) => {
    await unity.setMockAdResult('fail');
    await unity.setConsecutiveFailures(0);

    // 3회 연속 실패 시뮬레이션
    for (let i = 0; i < 3; i++) {
      await unity.resetAllCooldowns();
      await unity.sendMessage(
        'AdRewardManager',
        'RequestAdByTrigger',
        'T6_CoinBonus'
      );
      // 폴백 처리 완료 대기
      await page.waitForTimeout(3_000);

      // 코인 대체 팝업이 표시되면 "나중에 다시" 클릭
      const laterBtn = page.locator('[data-testid="later-btn"]');
      if (await laterBtn.isVisible()) {
        await laterBtn.click();
      }
    }

    // 연속 실패 카운터 확인
    const failures = await unity.getConsecutiveFailures();
    expect(failures).toBe(3);

    // 모든 광고 버튼 비활성화 확인
    const isT2Visible = await unity.isAdButtonVisible('T2_Hint');
    const isT6Visible = await unity.isAdButtonVisible('T6_CoinBonus');
    expect(isT2Visible).toBe(false);
    expect(isT6Visible).toBe(false);
  });

  /**
   * TC-AD-015: 네트워크 오류 시 1회 재시도
   */
  test('TC-AD-015: 네트워크 오류 시 자동 재시도가 수행된다', async ({
    unity,
    page,
  }) => {
    // 첫 호출: network_error, 이후 success
    await unity.setMockAdResult('network_error');
    await unity.sendMessage(
      'AdRewardManager',
      'SetMockAdSequence',
      'network_error,success'
    );

    const coinsBefore = await unity.getPlayerCoins();
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible();
    await coinAdBtn.click();

    // 재시도 후 성공하면 보상 지급
    await page.waitForFunction(
      (before) =>
        (window as any).gamebridge.getPlayerCoins() === before + 100,
      coinsBefore,
      { timeout: 15_000 }
    );

    const coinsAfter = await unity.getPlayerCoins();
    expect(coinsAfter).toBe(coinsBefore + 100);
  });
});
```

### 5.7 오프라인 처리 테스트 (ad-offline.spec.ts)

```typescript
import { test, expect } from '../fixtures/ad-reward.fixture';

test.describe('오프라인 광고 처리', () => {
  /**
   * TC-AD-016: 오프라인 시 광고 버튼 숨김 및 툴팁 표시
   */
  test('TC-AD-016: 오프라인에서 광고 버튼이 숨겨지고 온라인 복귀 시 복원된다', async ({
    unity,
    page,
    context,
  }) => {
    // 온라인 상태에서 광고 버튼 확인
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible();

    // 오프라인 전환
    await context.setOffline(true);

    // 네트워크 감지 대기 (폴링 주기 3초 + 여유)
    await page.waitForTimeout(5_000);

    // 광고 버튼 숨김 확인
    await expect(coinAdBtn).not.toBeVisible();

    // 오프라인 툴팁 확인
    const offlineTooltip = page.locator(
      '[data-testid="offline-tooltip"]'
    );
    await expect(offlineTooltip).toBeVisible();
    await expect(offlineTooltip).toContainText('오프라인');

    // 온라인 복귀
    await context.setOffline(false);
    await page.waitForTimeout(5_000);

    // 광고 버튼 재활성화 확인
    await expect(coinAdBtn).toBeVisible();

    // 오프라인 툴팁 숨김 확인
    await expect(offlineTooltip).not.toBeVisible();
  });

  /**
   * TC-AD-017: 오프라인 대체 보상 (코인 1.5배 가격)
   */
  test('TC-AD-017: 오프라인에서 코인 1.5배 가격으로 보상 구매가 가능하다', async ({
    unity,
    page,
    context,
  }) => {
    await unity.setPlayerCoins(200);
    await unity.setPlayerHints(0);

    // 오프라인 전환
    await context.setOffline(true);
    await page.waitForTimeout(5_000);

    // 오프라인 대체 구매 UI 확인
    const offlinePurchaseBtn = page.locator(
      '[data-testid="offline-purchase-hint"]'
    );

    // 오프라인에서 힌트 구매 옵션이 있는지 확인
    if (await offlinePurchaseBtn.isVisible()) {
      // 1.5배 가격 (50 * 1.5 = 75) 확인
      await expect(offlinePurchaseBtn).toContainText('75');

      const coinsBefore = await unity.getPlayerCoins();
      await offlinePurchaseBtn.click();

      // 코인 75개 차감 확인
      await page.waitForFunction(
        (before) =>
          (window as any).gamebridge.getPlayerCoins() === before - 75,
        coinsBefore,
        { timeout: 5_000 }
      );

      const coinsAfter = await unity.getPlayerCoins();
      expect(coinsAfter).toBe(coinsBefore - 75);

      // 힌트 지급 확인
      const hints = await unity.getPlayerHints();
      expect(hints).toBe(3);
    }
  });
});
```

### 5.8 GDPR 동의 테스트 (ad-gdpr.spec.ts)

```typescript
import { test, expect } from '../fixtures/ad-reward.fixture';

test.describe('GDPR 동의 팝업', () => {
  /**
   * TC-AD-018: GDPR 동의 팝업 - 동의 시나리오
   */
  test('TC-AD-018-A: GDPR 동의 시 광고가 정상 작동한다', async ({
    unity,
    page,
  }) => {
    // 동의 상태 초기화
    await unity.resetGDPRConsent();

    // 페이지 새로고침 (동의 팝업 트리거)
    await page.reload();
    await unity.waitForUnityLoad();

    // GDPR 동의 팝업 표시 확인
    const consentPopup = page.locator('[data-testid="gdpr-consent-popup"]');
    await expect(consentPopup).toBeVisible({ timeout: 10_000 });

    // 동의 버튼 클릭
    const agreeBtn = page.locator('[data-testid="gdpr-agree-btn"]');
    await expect(agreeBtn).toBeVisible();
    await agreeBtn.click();

    // 팝업 닫힘 확인
    await expect(consentPopup).not.toBeVisible();

    // 동의 상태 확인
    const consented = await unity.isGDPRConsented();
    expect(consented).toBe(true);

    // 광고 버튼 활성화 확인
    const coinAdBtn = page.locator('[data-testid="ad-btn-t6-coin-bonus"]');
    await expect(coinAdBtn).toBeVisible({ timeout: 5_000 });
  });

  /**
   * TC-AD-018: GDPR 동의 팝업 - 거부 시나리오
   */
  test('TC-AD-018-B: GDPR 거부 후에도 광고는 가능하되 개인화가 비활성화된다', async ({
    unity,
    page,
  }) => {
    // 동의 상태 초기화
    await unity.resetGDPRConsent();

    // 페이지 새로고침
    await page.reload();
    await unity.waitForUnityLoad();

    // GDPR 동의 팝업 대기
    const consentPopup = page.locator('[data-testid="gdpr-consent-popup"]');
    await expect(consentPopup).toBeVisible({ timeout: 10_000 });

    // 거부 버튼 클릭
    const declineBtn = page.locator('[data-testid="gdpr-decline-btn"]');
    await expect(declineBtn).toBeVisible();
    await declineBtn.click();

    // 팝업 닫힘 확인
    await expect(consentPopup).not.toBeVisible();

    // 동의 상태 확인
    const consented = await unity.isGDPRConsented();
    expect(consented).toBe(false);

    // 재방문 시 팝업이 다시 표시되지 않는지 확인
    await page.reload();
    await unity.waitForUnityLoad();
    await page.waitForTimeout(3_000);
    await expect(consentPopup).not.toBeVisible();
  });
});
```

---

## 6. 테스트 데이터 및 자동화 전략

### 6.1 테스트 데이터

| 데이터 항목 | 값 | 설명 | 참조 |
|------------|-----|------|------|
| 일일 광고 시청 한도 | 20회 | `AdRewardConfig.DailyAdLimit` | 설계문서 1.1 |
| 동일 트리거 쿨다운 | 180초 (3분) | `AdRewardConfig.SameTriggerCooldownSeconds` | 설계문서 1.4 |
| 다른 트리거 쿨다운 | 60초 (1분) | `AdRewardConfig.DifferentTriggerCooldownSeconds` | 설계문서 1.4 |
| T1 쿨다운 | 없음 | 게임당 1회 제한만 적용 | 설계문서 1.4 |
| T2 힌트 보상 | 3개 | `AdRewardConfig.HintRewardAmount` | 설계문서 1.3.1 |
| 힌트 최대 보유량 | 10개 | `AdRewardConfig.HintMaxCapacity` | 설계문서 1.3.1 |
| T3 부스터 배율 | 2배 | `AdRewardConfig.ScoreBoosterMultiplier` | 설계문서 1.3.3 |
| T3 부스터 지속시간 | 60초 | `AdRewardConfig.ScoreBoosterDuration` | 설계문서 1.3.3 |
| T6 코인 보상 | 100개 | `AdRewardConfig.CoinBonusAmount` | 설계문서 1.2 |
| 코인 대체 구매 비용 (온라인) | 50코인 | `AdRewardConfig.CoinAlternativeCost` | 설계문서 1.6 |
| 오프라인 가격 배율 | 1.5배 (75코인) | `AdRewardConfig.OfflinePriceMultiplier` | 설계문서 1.7 |
| 연속 실패 비활성화 기준 | 3회 | `AdRewardConfig.MaxConsecutiveFailures` | 설계문서 1.6 |
| 일일 리셋 시각 | UTC 00:00 | `AdCooldownManager.CheckDailyReset()` | 설계문서 1.4 |
| Mock 광고 딜레이 (테스트) | 0.5초 | 테스트 시 빠른 진행을 위해 단축 | 개발 계획서 5.1 |

### 6.2 테스트 자동화 전략

#### 6.2.1 CI/CD 통합

```
[CI/CD 파이프라인]

코드 커밋
    |
    v
+---------------------------+
| Unity WebGL 빌드           |
| (TEST_MODE 심볼 포함)      |
+---------------------------+
    |
    v
+---------------------------+
| 빌드 아티팩트 업로드        |
| (WebGL 폴더)              |
+---------------------------+
    |
    v
+---------------------------+
| Playwright 테스트 실행      |
| npx playwright test        |
| --project=chromium         |
+---------------------------+
    |
    v
+---------------------------+
| 테스트 리포트 생성          |
| HTML + JUnit XML          |
+---------------------------+
    |
    v
+---------------------------+
| 결과 통보                  |
| (Slack / GitHub PR 코멘트) |
+---------------------------+
```

#### 6.2.2 테스트 실행 명령

```bash
# 전체 광고 보상 테스트 실행
npx playwright test tests/e2e/ad-reward/ --project=chromium

# 특정 테스트 케이스만 실행
npx playwright test tests/e2e/ad-reward/ad-trigger.spec.ts --grep "TC-AD-001"

# 디버그 모드 (브라우저 UI 표시)
npx playwright test tests/e2e/ad-reward/ --headed --debug

# 리포트 생성 및 열기
npx playwright show-report
```

#### 6.2.3 병렬 실행 제약

Unity WebGL 빌드는 하나의 브라우저 탭에서 단일 인스턴스로 실행되므로, 테스트 파일 간 병렬 실행은 권장하지 않는다. `playwright.config.ts`에서 `fullyParallel: false`를 설정하고, 각 테스트 파일은 순차적으로 실행한다.

#### 6.2.4 테스트 안정성 전략

| 전략 | 설명 |
|------|------|
| **명시적 대기** | `waitForFunction()`으로 Unity 게임 상태 변화를 감지. `waitForTimeout()`은 최소화 |
| **상태 초기화** | 각 테스트 시작 시 `resetDailyAdCount()`, `resetAllCooldowns()` 등으로 클린 상태 보장 |
| **Mock 결정적 결과** | Mock 광고 서비스의 결과를 명시적으로 설정하여 비결정적 동작 제거 |
| **재시도** | `playwright.config.ts`에 `retries: 1` 설정으로 일시적 실패 대응 |
| **스크린샷/비디오** | 실패 시 자동 캡처하여 디버깅 지원 (`screenshot: 'only-on-failure'`) |
| **Trace 파일** | 실패 시 Playwright Trace를 저장하여 단계별 재현 가능 (`trace: 'retain-on-failure'`) |
| **시간 조작** | 실제 3분/1분을 대기하지 않고, SendMessage로 시간을 조작하여 쿨다운 테스트 수행 |

#### 6.2.5 data-testid 셀렉터 맵

Unity WebGL Canvas 위에 오버레이되는 UI 요소에 `data-testid` 속성을 부여하여 안정적인 셀렉터를 사용한다.

| data-testid | UI 요소 | 사용 테스트 |
|-------------|---------|------------|
| `ad-btn-t1-continue` | 게임 오버 이어하기 광고 버튼 | TC-AD-001 |
| `ad-btn-t2-hint` | 힌트 충전 광고 버튼 | TC-AD-002, 007, 008 |
| `ad-btn-t3-booster` | 점수 부스터 광고 버튼 | TC-AD-003 |
| `ad-btn-t4-item` | 특수 아이템 광고 버튼 | TC-AD-004 |
| `ad-btn-t5-daily-bonus` | 일일 보너스 2배 광고 버튼 | TC-AD-005 |
| `ad-btn-t6-coin-bonus` | 코인 보너스 광고 버튼 | TC-AD-006, 007, 009~015 |
| `game-over-screen` | 게임 오버 화면 | TC-AD-001 |
| `cooldown-popup` | 쿨다운 안내 팝업 | TC-AD-009, 010 |
| `daily-limit-popup` | 일일 한도 초과 팝업 | TC-AD-011 |
| `coin-alternative-popup` | 코인 대체 구매 팝업 | TC-AD-013 |
| `buy-with-coins-btn` | 코인으로 구매 버튼 | TC-AD-013 |
| `later-btn` | "나중에 다시" 버튼 | TC-AD-013, 014 |
| `offline-tooltip` | 오프라인 상태 툴팁 | TC-AD-016 |
| `offline-purchase-hint` | 오프라인 힌트 구매 버튼 | TC-AD-017 |
| `gdpr-consent-popup` | GDPR 동의 팝업 | TC-AD-018 |
| `gdpr-agree-btn` | GDPR 동의 버튼 | TC-AD-018 |
| `gdpr-decline-btn` | GDPR 거부 버튼 | TC-AD-018 |

#### 6.2.6 테스트 우선순위 및 실행 계획

| 우선순위 | 테스트 케이스 | 실행 빈도 |
|---------|-------------|----------|
| **높음** | TC-AD-001, 002, 007, 008, 009, 011, 013, 016, 018 | 매 커밋 (CI) |
| **중간** | TC-AD-003, 004, 010, 012, 014, 015, 017 | 일 1회 (Nightly) |
| **낮음** | TC-AD-005, 006 | 주 1회 (Weekly) |

---

> **참고**: 이 테스트 계획서는 설계문서 `03_monetization-platform-design.md` 섹션 1(광고 보상 시스템)과 개발 계획서 `07_ad-reward/development-plan.md`에 정의된 요구사항을 기반으로 작성되었다. Unity WebGL 빌드에 `TEST_MODE` 심볼과 JavaScript Bridge가 구현된 후 실행 가능하다.
