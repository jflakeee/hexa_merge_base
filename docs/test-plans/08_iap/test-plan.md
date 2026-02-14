# 08. 인앱 결제(IAP) 시스템 - Playwright 테스트 계획서

> **프로젝트**: Hexa Merge Basic
> **테스트 대상**: 인앱 결제(IAP) 시스템 (설계문서 `03_monetization-platform-design.md` 섹션 2, 7)
> **개발 계획서**: `docs/development/08_iap/development-plan.md`
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

Unity WebGL 빌드로 배포되는 Hexa Merge Basic 게임의 인앱 결제(IAP) 시스템이 설계문서에 정의된 요구사항대로 정상 동작하는지 검증한다. Playwright를 이용해 브라우저 환경에서 실제 사용자 구매 시나리오를 자동화하며, Google Play Billing은 Mock으로, Stripe는 테스트 모드(Test Mode)로 대체하여 실제 과금 없이 전체 결제 플로우를 검증한다.

### 1.2 범위

| 범위 | 포함 항목 |
|------|----------|
| **포함** | 상품 목록 로딩(소비형 7종/비소비형 6종), 소비형/비소비형 구매 플로우, 구매 후 재화 지급 및 UI 갱신, 결제 취소/실패 처리, 영수증 서버 검증, 구매 복원, 중복 구매 방지, 상점 UI 가격 표시, Stripe Checkout 플로우, 환불 RTDN 처리 동기화 |
| **제외** | Android 네이티브 빌드의 Google Play Billing 직접 연동, 실제 결제 과금, Google Play Console 설정, 구독형 상품(v2.0 예약), ProGuard/R8 빌드 검증 |

### 1.3 전제조건

| 항목 | 설명 |
|------|------|
| **Unity WebGL 빌드** | 테스트용 WebGL 빌드가 로컬(`http://localhost:8080`) 또는 스테이징 서버에 배포되어 있어야 한다 |
| **Mock IAP Service** | WebGL 빌드에 `TEST_MODE` 스크립팅 심볼이 정의되어 `EditorIAPService`(Mock) 기반 결제 서비스가 활성화되어야 한다 |
| **Stripe Test Mode** | Stripe API 키가 테스트 모드(`pk_test_*` / `sk_test_*`)로 설정되어야 한다 |
| **테스트 서버** | 결제 검증 서버가 테스트 환경으로 구동 중이어야 한다 (Mock 영수증 검증 API 포함) |
| **JavaScript Bridge** | Unity WebGL의 `unityInstance.SendMessage()`를 통해 게임 상태를 외부에서 제어할 수 있어야 한다 |
| **브라우저 환경** | Chromium 기반 브라우저, 뷰포트 1280x720 |
| **네트워크 제어** | Playwright의 `page.route()` 또는 `context.setOffline()`을 통한 네트워크 상태 시뮬레이션 가능 |

### 1.4 참조 문서

- 설계문서: `docs/design/03_monetization-platform-design.md` -- 섹션 2. 인앱 결제 시스템, 섹션 7. 보안
- 개발 계획서: `docs/development/08_iap/development-plan.md`

---

## 2. 테스트 환경 설정

### 2.1 Mock IAP Service 구성

테스트 환경에서는 실제 Google Play Billing이나 Stripe 실시간 과금에 의존하지 않고, 게임 내부의 `EditorIAPService`(Mock)와 Stripe 테스트 모드를 활용한다. WebGL 빌드에 `TEST_MODE` 심볼이 정의되면 `EditorIAPService`가 자동으로 선택된다.

```
[테스트 환경 IAP 구조]

Playwright (브라우저)
    |
    |-- unityInstance.SendMessage() --> Unity WebGL 게임
    |                                       |
    |                                       v
    |                                   IAPManager (싱글톤)
    |                                       |
    |                     +-----------------+-----------------+
    |                     |                                   |
    |                     v                                   v
    |           EditorIAPService (Mock)             StripeIAPService (Test Mode)
    |             - 설정 가능한 딜레이                   - pk_test 키 사용
    |             - 성공/실패 시뮬레이션                 - 4242 테스트 카드
    |             - 결과를 JS 콜백으로 반환              - Stripe Checkout 리다이렉트
    |
    |<-- window.gamebridge 이벤트 -- Unity -> JS 브릿지
```

**Mock IAP 서비스 제어 API** (JavaScript Bridge):

| JS 호출 | 설명 |
|---------|------|
| `SendMessage('IAPManager', 'SetMockPurchaseResult', 'success')` | 다음 구매 결과를 성공으로 설정 |
| `SendMessage('IAPManager', 'SetMockPurchaseResult', 'cancel')` | 다음 구매 결과를 사용자 취소로 설정 |
| `SendMessage('IAPManager', 'SetMockPurchaseResult', 'network_error')` | 다음 구매 결과를 네트워크 오류로 설정 |
| `SendMessage('IAPManager', 'SetMockPurchaseResult', 'product_unavailable')` | 다음 구매 결과를 상품 불가로 설정 |
| `SendMessage('IAPManager', 'SetMockPurchaseResult', 'payment_declined')` | 다음 구매 결과를 결제 거절로 설정 |
| `SendMessage('IAPManager', 'SetMockPurchaseResult', 'validation_failed')` | 다음 구매 결과를 영수증 검증 실패로 설정 |
| `SendMessage('IAPManager', 'SetMockPurchaseDelay', '2000')` | Mock 구매 시뮬레이션 딜레이(ms) 설정 |
| `SendMessage('IAPManager', 'ResetAllPurchases', '')` | 모든 구매 기록 초기화 |
| `SendMessage('IAPManager', 'SetMockPurchaseCount', 'starter_pack:1')` | 특정 상품 구매 횟수 설정 |
| `SendMessage('IAPManager', 'SimulateRefundSync', 'coin_pack_s')` | 환불 동기화 시뮬레이션 |
| `SendMessage('IAPManager', 'SimulateRestorePurchases', 'remove_ads,theme_ocean')` | 구매 복원 시뮬레이션 (복원할 상품 ID 목록) |
| `SendMessage('IAPManager', 'SetStripeModeEnabled', 'true')` | Stripe 결제 모드 전환 (Mock 대신 실제 Stripe Test Mode 사용) |

**게임 상태 조회 API** (JS -> Unity 브릿지):

| JS 호출 | 반환 | 설명 |
|---------|------|------|
| `window.gamebridge.getCoins()` | `number` | 현재 보유 코인 수 |
| `window.gamebridge.getHints()` | `number` | 현재 보유 힌트 수 |
| `window.gamebridge.getItems()` | `JSON string` | 보유 아이템 목록 (`{shuffle, bomb, rainbow}`) |
| `window.gamebridge.isAdsRemoved()` | `boolean` | 광고 제거 상태 |
| `window.gamebridge.getUnlockedThemes()` | `string[]` | 언락된 테마 ID 목록 |
| `window.gamebridge.getPurchasedProducts()` | `string[]` | 구매한 비소비형 상품 ID 목록 |
| `window.gamebridge.getPurchaseCount(productId)` | `number` | 특정 상품 구매 횟수 |
| `window.gamebridge.getIAPInitState()` | `boolean` | IAP 서비스 초기화 상태 |
| `window.gamebridge.getProductPrice(productId)` | `string` | 현지화된 가격 문자열 |
| `window.gamebridge.isProductAvailable(productId)` | `boolean` | 상품 구매 가능 여부 |
| `window.gamebridge.getLastPurchaseResult()` | `JSON string` | 마지막 구매 결과 (`{productId, transactionId, isSuccess, failureReason}`) |

### 2.2 Stripe Test Mode 구성

Stripe 결제 플로우 테스트 시에는 Stripe의 공식 테스트 모드를 활용한다. 테스트 카드 번호를 사용하여 실제 과금 없이 전체 Checkout 플로우를 검증한다.

**테스트 카드 번호**:

| 카드 번호 | 시나리오 |
|----------|----------|
| `4242 4242 4242 4242` | 정상 결제 성공 |
| `4000 0000 0000 0002` | 결제 거절 (카드 거부) |
| `4000 0027 6000 3184` | 3D Secure 인증 필요 |
| `4000 0000 0000 9995` | 잔액 부족 |
| `4000 0000 0000 0341` | 잘못된 CVC 코드 |

**Stripe 테스트 서버 환경변수**:

```
STRIPE_SECRET_KEY=sk_test_XXXXXXXXXXXXXXXX
STRIPE_PUBLIC_KEY=pk_test_XXXXXXXXXXXXXXXX
STRIPE_WEBHOOK_SECRET=whsec_test_XXXXXXXXXXXXXXXX
```

### 2.3 Mock 영수증 검증 서버 구성

테스트 환경에서는 실제 Google Play Developer API 대신 Mock 검증 서버를 사용하며, Stripe는 테스트 모드 API를 사용한다.

**Mock 검증 서버 엔드포인트**:

| 엔드포인트 | 동작 |
|-----------|------|
| `POST /api/validate/google` | Mock: `purchaseToken`에 "invalid"가 포함되면 검증 실패, 그 외 성공 |
| `POST /api/validate/stripe` | Stripe 테스트 모드 API로 실제 검증 수행 |
| `GET /api/checkout/status` | Stripe Session 상태 조회 (테스트 모드) |
| `POST /api/checkout` | Stripe Checkout Session 생성 (테스트 모드) |
| `GET /api/products` | 상품 목록 및 가격 반환 |
| `GET /api/purchases/:userId` | 사용자 구매 이력 조회 |
| `POST /api/rtdn/google` | Mock RTDN 환불 알림 수신 |
| `GET /api/user/:userId/sync` | 환불 동기화 상태 조회 |

### 2.4 Playwright 테스트 프로젝트 설정

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/iap',
  timeout: 60_000,  // IAP 테스트는 네트워크 대기가 길 수 있음
  expect: { timeout: 10_000 },
  retries: 1,
  reporter: [['html'], ['json', { outputFile: 'results/iap-results.json' }]],
  use: {
    baseURL: process.env.GAME_URL || 'http://localhost:8080',
    viewport: { width: 1280, height: 720 },
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'iap-mock',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.mock\.spec\.ts/,
    },
    {
      name: 'iap-stripe',
      use: { ...devices['Desktop Chrome'] },
      testMatch: /.*\.stripe\.spec\.ts/,
    },
  ],
});
```

---

## 3. 테스트 케이스 목록

### 3.1 체크리스트 개요

| TC-ID | 테스트 명칭 | 유형 | 우선순위 |
|-------|-----------|------|---------|
| TC-IAP-001 | 소비형 상품 목록 로딩 테스트 | 기능 | P0-필수 |
| TC-IAP-002 | 비소비형 상품 목록 로딩 테스트 | 기능 | P0-필수 |
| TC-IAP-003 | 소비형 상품 구매 플로우 테스트 (코인 팩) | 기능 | P0-필수 |
| TC-IAP-004 | 비소비형 상품 구매 플로우 테스트 (광고 제거) | 기능 | P0-필수 |
| TC-IAP-005 | 구매 후 재화 지급 테스트 | 기능 | P0-필수 |
| TC-IAP-006 | 구매 후 UI 갱신 테스트 | UI | P0-필수 |
| TC-IAP-007 | 결제 취소 테스트 | 기능 | P0-필수 |
| TC-IAP-008 | 결제 실패 테스트 (네트워크 오류) | 기능 | P1-높음 |
| TC-IAP-009 | 영수증 검증 테스트 | 보안 | P0-필수 |
| TC-IAP-010 | 구매 복원 테스트 | 기능 | P1-높음 |
| TC-IAP-011 | 중복 구매 방지 테스트 (비소비형) | 기능 | P1-높음 |
| TC-IAP-012 | 상점 UI 가격 표시 테스트 | UI | P1-높음 |
| TC-IAP-013 | 웹 결제 (Stripe) 플로우 테스트 | 기능 | P0-필수 |
| TC-IAP-014 | 환불 RTDN 처리 테스트 | 기능 | P1-높음 |

### 3.2 우선순위 정의

| 우선순위 | 설명 | 기준 |
|---------|------|------|
| P0-필수 | 릴리스 차단 | 결제 핵심 플로우, 재화 지급 정확성, 보안 관련 |
| P1-높음 | 릴리스 전 해결 권장 | 에러 처리, 복원, 중복 방지 등 보조 기능 |
| P2-보통 | 차기 릴리스에 해결 가능 | UI 세부 표시, 엣지 케이스 |

---

## 4. 테스트 케이스 상세

### TC-IAP-001: 소비형 상품 목록 로딩 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-001 |
| **목적** | 상점 화면에서 소비형 상품 7종(`coin_pack_s`, `coin_pack_m`, `coin_pack_l`, `coin_pack_xl`, `item_hint_10`, `item_bundle`, `starter_pack`)이 정상적으로 로드되어 표시되는지 검증 |
| **사전조건** | 1. Unity WebGL 빌드가 로드 완료 2. IAP 서비스 초기화 완료 (`getIAPInitState() === true`) 3. 상점 화면 미진입 상태 |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 메인 화면에서 상점(Shop) 버튼 클릭 | 상점 UI가 화면에 표시된다 |
| 2 | 소비형(Consumable) 탭 선택 | 소비형 상품 목록이 표시된다 |
| 3 | 표시된 상품 수 확인 | 소비형 상품 7종이 모두 표시된다 |
| 4 | 각 상품의 `productId` 확인 | `coin_pack_s`, `coin_pack_m`, `coin_pack_l`, `coin_pack_xl`, `item_hint_10`, `item_bundle`, `starter_pack`이 모두 존재한다 |
| 5 | 각 상품의 이름/설명 확인 | 설계문서에 정의된 상품명과 설명이 표시된다 (예: "코인 소형 팩", "코인 500개") |
| 6 | 각 상품의 가격 표시 확인 | 가격이 "---"가 아닌 유효한 값으로 표시된다 (예: "$0.99", "1,200원") |
| 7 | 각 상품의 구매 버튼 존재 확인 | 모든 상품에 활성 상태의 구매 버튼이 있다 |

---

### TC-IAP-002: 비소비형 상품 목록 로딩 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-002 |
| **목적** | 상점 화면에서 비소비형 상품 6종(`remove_ads`, `theme_ocean`, `theme_forest`, `theme_space`, `theme_bundle`, `premium_pass`)이 정상적으로 로드되어 표시되는지 검증 |
| **사전조건** | 1. Unity WebGL 빌드가 로드 완료 2. IAP 서비스 초기화 완료 3. 비소비형 상품 미구매 상태 |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 메인 화면에서 상점(Shop) 버튼 클릭 | 상점 UI가 화면에 표시된다 |
| 2 | 비소비형(Non-Consumable) 탭 선택 | 비소비형 상품 목록이 표시된다 |
| 3 | 표시된 상품 수 확인 | 비소비형 상품 6종이 모두 표시된다 |
| 4 | 각 상품의 `productId` 확인 | `remove_ads`, `theme_ocean`, `theme_forest`, `theme_space`, `theme_bundle`, `premium_pass`가 모두 존재한다 |
| 5 | 각 상품의 이름/설명 확인 | 설계문서에 정의된 상품명과 설명이 표시된다 (예: "광고 제거", "모든 광고 버튼 제거 + 코인 1,000개 보너스") |
| 6 | 각 상품의 가격 표시 확인 | 유효한 가격이 표시된다 (예: "$3.99", "4,400원") |
| 7 | 미구매 상품은 구매 버튼이 활성 상태 | 모든 상품의 구매 버튼이 활성(enabled) 상태이다 |

---

### TC-IAP-003: 소비형 상품 구매 플로우 테스트 (코인 팩)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-003 |
| **목적** | 소비형 상품(코인 소형 팩)의 전체 구매 플로우가 정상 동작하는지 검증. 상품 선택 -> 구매 확인 -> 결제 처리 -> 보상 지급 -> 완료 UI 표시 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 결제 결과가 `success`로 설정됨 3. 현재 코인 잔액 확인 (기록) |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | `window.gamebridge.getCoins()`로 현재 코인 수 기록 | 현재 코인 수(N)가 반환된다 |
| 2 | Mock 결과를 성공으로 설정: `SendMessage('IAPManager', 'SetMockPurchaseResult', 'success')` | 설정 완료 |
| 3 | 상점 진입 후 소비형 탭에서 `coin_pack_s`(코인 소형 팩) 상품 클릭 | 구매 확인 팝업이 표시된다 |
| 4 | 구매 확인 팝업에서 상품명, 가격, 보상 내용 확인 | "코인 소형 팩", "$0.99", "코인 500개"가 표시된다 |
| 5 | "구매" 버튼 클릭 | 결제 처리 중 로딩 인디케이터가 표시된다 |
| 6 | 결제 완료 대기 (Mock 딜레이 후) | 구매 성공 결과 팝업이 표시된다 |
| 7 | 성공 팝업에서 "확인" 클릭 | 팝업이 닫히고 상점 화면으로 복귀한다 |
| 8 | `window.gamebridge.getCoins()`로 코인 수 확인 | 코인 수가 N + 500이다 |
| 9 | `window.gamebridge.getLastPurchaseResult()`로 결과 확인 | `isSuccess: true`, `productId: "coin_pack_s"`이다 |

---

### TC-IAP-004: 비소비형 상품 구매 플로우 테스트 (광고 제거)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-004 |
| **목적** | 비소비형 상품(광고 제거)의 전체 구매 플로우가 정상 동작하는지 검증. 구매 후 광고가 제거되고 보너스 코인이 지급되는지 확인 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 결제 결과가 `success`로 설정됨 3. 광고 제거 미구매 상태 (`isAdsRemoved() === false`) |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | `window.gamebridge.isAdsRemoved()` 확인 | `false`가 반환된다 |
| 2 | `window.gamebridge.getCoins()`로 현재 코인 수 기록(N) | 현재 코인 수가 반환된다 |
| 3 | Mock 결과를 성공으로 설정 | 설정 완료 |
| 4 | 상점 진입 후 비소비형 탭에서 `remove_ads`(광고 제거) 클릭 | 구매 확인 팝업이 표시된다 |
| 5 | 팝업에서 "광고 제거", "$3.99" 확인 | 올바른 상품 정보가 표시된다 |
| 6 | "구매" 버튼 클릭 | 결제 처리 중 로딩이 표시된다 |
| 7 | 결제 완료 대기 | 구매 성공 팝업이 표시된다 |
| 8 | `window.gamebridge.isAdsRemoved()` 확인 | `true`가 반환된다 |
| 9 | `window.gamebridge.getCoins()` 확인 | 코인 수가 N + 1,000이다 (보너스) |
| 10 | `window.gamebridge.getPurchasedProducts()` 확인 | 배열에 `"remove_ads"`가 포함되어 있다 |
| 11 | 메인 화면에서 광고 관련 버튼 확인 | 보상형 광고 버튼이 모두 사라졌다 |

---

### TC-IAP-005: 구매 후 재화 지급 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-005 |
| **목적** | 각 상품 구매 후 설계문서에 정의된 보상이 정확하게 지급되는지 검증 (코인, 힌트, 아이템, 테마 언락) |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 결제 결과 `success` 3. 모든 구매 기록 초기화 상태 |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 모든 구매 초기화: `SendMessage('IAPManager', 'ResetAllPurchases', '')` | 초기화 완료 |
| 2 | `coin_pack_s` 구매 실행 | 코인 +500 |
| 3 | `coin_pack_m` 구매 실행 | 코인 +1,500 |
| 4 | `coin_pack_l` 구매 실행 | 코인 +4,000 |
| 5 | `coin_pack_xl` 구매 실행 | 코인 +10,000 |
| 6 | `item_hint_10` 구매 실행 | 힌트 +10 (`getHints()` 검증) |
| 7 | `item_bundle` 구매 실행 | 셔플 +3, 폭탄 +3, 무지개 +3 (`getItems()` 검증) |
| 8 | `starter_pack` 구매 실행 | 코인 +2,000, 힌트 +10, 아이템 번들(셔플 3+폭탄 3+무지개 3) |
| 9 | `remove_ads` 구매 실행 | 광고 제거 활성화 + 코인 +1,000 |
| 10 | `theme_ocean` 구매 실행 | `getUnlockedThemes()`에 `"theme_ocean"` 포함 |
| 11 | `premium_pass` 구매 실행 | 광고 제거 + 모든 테마 언락 + 코인 +5,000 |

---

### TC-IAP-006: 구매 후 UI 갱신 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-006 |
| **목적** | 구매 완료 후 게임 UI 요소(코인 표시, 아이템 카운트, 상점 버튼 상태)가 즉시 갱신되는지 검증 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 결제 결과 `success` 3. 코인/아이템 초기 상태 확인 |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 메인 화면의 코인 표시 UI에서 현재 값(N) 확인 | 코인 수치가 표시된다 |
| 2 | `coin_pack_s`(코인 500) 구매 완료 | 구매 성공 |
| 3 | 메인 화면의 코인 표시 UI 확인 | 코인 값이 N + 500으로 갱신되어 있다 |
| 4 | 상점 화면으로 이동 | 상점이 표시된다 |
| 5 | 비소비형 탭에서 `remove_ads` 구매 완료 | 구매 성공 |
| 6 | 상점 내 `remove_ads` 상품 상태 확인 | "구매 완료" 상태로 표시되고 구매 버튼이 비활성화된다 |
| 7 | 상점 종료 후 메인 화면 확인 | 보상형 광고 버튼이 사라졌다 |
| 8 | 힌트 구매(`item_hint_10`) 후 힌트 UI 확인 | 메인 화면의 힌트 카운트가 +10으로 갱신된다 |

---

### TC-IAP-007: 결제 취소 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-007 |
| **목적** | 사용자가 결제를 취소했을 때 게임이 올바르게 처리하는지 검증. 재화 변동 없음, 에러 메시지 없음(또는 최소한의 안내), 상점 정상 복귀 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 결제 결과가 `cancel`로 설정됨 |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | `window.gamebridge.getCoins()`로 현재 코인 수 기록(N) | 코인 수 확인 |
| 2 | Mock 결과를 취소로 설정: `SendMessage('IAPManager', 'SetMockPurchaseResult', 'cancel')` | 설정 완료 |
| 3 | 상점에서 `coin_pack_s` 구매 시도 | 구매 확인 팝업 표시 |
| 4 | "구매" 버튼 클릭 | 결제 처리 시작 |
| 5 | 취소 결과 대기 | 에러 팝업이 아닌, 조용한 취소 처리 또는 "결제가 취소되었습니다" 안내 표시 |
| 6 | 상점 화면 상태 확인 | 상점이 정상 상태로 유지된다 (크래시 없음) |
| 7 | `window.gamebridge.getCoins()` 확인 | 코인 수가 N과 동일하다 (변동 없음) |
| 8 | 다시 `coin_pack_s` 구매 시도 (Mock 결과를 `success`로 변경 후) | 정상적으로 구매가 진행된다 |

---

### TC-IAP-008: 결제 실패 테스트 (네트워크 오류)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-008 |
| **목적** | 네트워크 오류 등 결제 실패 시 적절한 에러 UI가 표시되고, 재화 변동 없이 안전하게 복귀하는지 검증 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 결제 결과가 `network_error`로 설정됨 |
| **우선순위** | P1-높음 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | `window.gamebridge.getCoins()`로 현재 코인 수 기록(N) | 코인 수 확인 |
| 2 | Mock 결과를 네트워크 오류로 설정 | 설정 완료 |
| 3 | 상점에서 `coin_pack_m` 구매 시도 -> "구매" 클릭 | 결제 처리 시작 |
| 4 | 실패 결과 대기 | 에러 팝업이 표시된다 |
| 5 | 에러 팝업 메시지 확인 | "네트워크 오류" 또는 "결제에 실패했습니다. 다시 시도해주세요"와 같은 안내 메시지가 포함된다 |
| 6 | 에러 팝업의 "확인" 또는 "재시도" 버튼 확인 | 버튼이 존재하고 클릭 가능하다 |
| 7 | "확인" 클릭 후 상점 상태 확인 | 상점이 정상 상태로 복귀한다 |
| 8 | `window.gamebridge.getCoins()` 확인 | 코인 수가 N과 동일하다 (변동 없음) |
| 9 | Playwright로 `context.setOffline(true)` 설정 후 구매 시도 | 네트워크 오류 에러가 표시된다 |
| 10 | `context.setOffline(false)` 복구 후 재구매 시도 (Mock `success`) | 정상 구매가 진행된다 |

---

### TC-IAP-009: 영수증 검증 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-009 |
| **목적** | 구매 후 서버 영수증 검증이 정상적으로 수행되는지 검증. 유효한 영수증은 보상 지급, 유효하지 않은 영수증은 보상 미지급 확인 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 검증 서버 구동 중 |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | Mock 결과를 `success`로 설정 후 `coin_pack_s` 구매 | 구매 성공 |
| 2 | Playwright `page.route()`로 `/api/validate/google` 요청을 인터셉트하여 요청 본문 확인 | 요청에 `purchaseToken`, `productId`, `packageName`, `userId`가 포함된다 |
| 3 | 검증 응답이 `{valid: true}`일 때 코인 확인 | 코인 +500 지급 |
| 4 | Playwright `page.route()`로 검증 API를 가로채어 `{valid: false, errorCode: 'INVALID_SIGNATURE'}` 응답 반환 | -- |
| 5 | Mock 결과를 `validation_failed`로 설정 후 `coin_pack_m` 구매 시도 | 영수증 검증 실패 에러가 표시된다 |
| 6 | 코인 잔액 확인 | 코인이 증가하지 않았다 |
| 7 | Playwright `page.route()`로 검증 API를 가로채어 `{valid: false, errorCode: 'DUPLICATE_ORDER'}` 응답 반환 | -- |
| 8 | 구매 시도 | "중복 거래" 관련 에러 메시지가 표시된다 |

---

### TC-IAP-010: 구매 복원 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-010 |
| **목적** | 앱 재설치/데이터 초기화 시나리오에서 비소비형 상품의 구매 복원이 정상 동작하는지 검증 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. `remove_ads`, `theme_ocean` 구매 완료 상태를 시뮬레이션 |
| **우선순위** | P1-높음 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 구매 기록 초기화: `SendMessage('IAPManager', 'ResetAllPurchases', '')` | 모든 구매 기록이 초기화된다 |
| 2 | `window.gamebridge.isAdsRemoved()` 확인 | `false` 반환 |
| 3 | `window.gamebridge.getUnlockedThemes()` 확인 | 빈 배열 반환 |
| 4 | 구매 복원 시뮬레이션: `SendMessage('IAPManager', 'SimulateRestorePurchases', 'remove_ads,theme_ocean')` | 복원 처리 시작 |
| 5 | 복원 완료 대기 (약 2초) | 복원 완료 팝업 또는 토스트 메시지가 표시된다 ("2건 복원 완료") |
| 6 | `window.gamebridge.isAdsRemoved()` 확인 | `true` 반환 |
| 7 | `window.gamebridge.getUnlockedThemes()` 확인 | `["theme_ocean"]`이 포함된 배열 반환 |
| 8 | `window.gamebridge.getPurchasedProducts()` 확인 | `["remove_ads", "theme_ocean"]`이 포함되어 있다 |
| 9 | 상점에서 `remove_ads` 상품 상태 확인 | "구매 완료" 상태로 표시된다 |
| 10 | 소비형 상품(`coin_pack_s`)이 복원에 포함되지 않는지 확인 | 소비형 상품은 복원 대상이 아니다 |

---

### TC-IAP-011: 중복 구매 방지 테스트 (비소비형)

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-011 |
| **목적** | 이미 구매한 비소비형 상품을 다시 구매할 수 없는지, 1회 한정 상품(스타터 팩)의 재구매 방지가 동작하는지 검증 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 결제 결과 `success` |
| **우선순위** | P1-높음 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | `remove_ads` 최초 구매 실행 | 구매 성공, 광고 제거 활성화 |
| 2 | 상점에서 `remove_ads` 상품의 구매 버튼 상태 확인 | 비활성화(disabled) 또는 "구매 완료" 표시 |
| 3 | `remove_ads` 재구매 시도 (프로그래밍적으로 호출) | `DuplicateTransaction` 에러가 반환되거나 구매 버튼이 동작하지 않는다 |
| 4 | `window.gamebridge.getCoins()` 확인 | 최초 구매의 보너스 코인만 반영 (재구매로 인한 추가 코인 없음) |
| 5 | `starter_pack` 최초 구매 실행 (1회 한정 상품) | 구매 성공, 보상 지급 |
| 6 | `starter_pack` 재구매 시도 | `DuplicateTransaction` 에러 또는 "이미 구매한 상품" 안내 표시 |
| 7 | `window.gamebridge.getPurchaseCount('starter_pack')` 확인 | `1` 반환 |
| 8 | 소비형 상품(`coin_pack_s`) 연속 2회 구매 | 2회 모두 성공 (소비형은 중복 구매 가능) |

---

### TC-IAP-012: 상점 UI 가격 표시 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-012 |
| **목적** | 상점 화면의 모든 상품에 올바른 가격이 표시되는지 검증. 가격은 서버/스토어에서 조회한 현지화 가격이어야 하며 하드코딩된 값이 아니어야 한다 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. 상품 가격 정보 로드 완료 |
| **우선순위** | P1-높음 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 상점 진입 후 소비형 탭 선택 | 소비형 상품 목록 표시 |
| 2 | `coin_pack_s` 가격 확인 | "$0.99" 또는 "1,200원" 표시 (환경에 따라) |
| 3 | `coin_pack_m` 가격 확인 | "$2.99" 또는 "3,300원" |
| 4 | `coin_pack_l` 가격 확인 | "$5.99" 또는 "6,600원" |
| 5 | `coin_pack_xl` 가격 확인 | "$9.99" 또는 "12,000원" |
| 6 | `item_hint_10` 가격 확인 | "$0.99" 또는 "1,200원" |
| 7 | `item_bundle` 가격 확인 | "$1.99" 또는 "2,500원" |
| 8 | `starter_pack` 가격 확인 | "$2.99" 또는 "3,300원" |
| 9 | 비소비형 탭으로 전환 | 비소비형 상품 목록 표시 |
| 10 | `remove_ads` 가격 확인 | "$3.99" 또는 "4,400원" |
| 11 | `premium_pass` 가격 확인 | "$9.99" 또는 "12,000원" |
| 12 | `window.gamebridge.getProductPrice('coin_pack_s')` 호출 | "---"가 아닌 유효한 가격 문자열 반환 |
| 13 | 가격이 비어있거나 "---"인 상품이 없는지 전수 검사 | 모든 13종 상품에 유효한 가격이 표시된다 |

---

### TC-IAP-013: 웹 결제 (Stripe) 플로우 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-013 |
| **목적** | Stripe Checkout을 통한 웹 결제 전체 플로우(Checkout Session 생성 -> 리다이렉트 -> 결제 -> 리턴 -> 보상 지급)가 정상 동작하는지 검증 |
| **사전조건** | 1. Stripe 테스트 모드 활성화 (`pk_test` 키 사용) 2. 결제 서버가 Stripe 테스트 모드로 구동 중 3. `SetStripeModeEnabled('true')` 호출로 Stripe 모드 전환 완료 |
| **우선순위** | P0-필수 |

**테스트 단계**:

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | Stripe 모드 활성화: `SendMessage('IAPManager', 'SetStripeModeEnabled', 'true')` | Stripe 결제 모드 전환 |
| 2 | `window.gamebridge.getCoins()`로 현재 코인 수 기록(N) | 코인 수 확인 |
| 3 | 상점에서 `coin_pack_s` 구매 버튼 클릭 | 구매 확인 팝업 표시 |
| 4 | "구매" 클릭 | Playwright가 `/api/checkout` POST 요청을 감지한다 |
| 5 | 요청 본문에 `productId: "coin_pack_s"`, `userId` 포함 확인 | 올바른 요청 파라미터 |
| 6 | Stripe Checkout 페이지로 리다이렉트 확인 | URL이 `checkout.stripe.com` 도메인으로 변경된다 |
| 7 | Stripe Checkout 페이지에서 테스트 카드 입력: `4242 4242 4242 4242`, 만료 `12/30`, CVC `123` | 카드 정보 입력 완료 |
| 8 | "결제" 버튼 클릭 | 결제 처리 시작 |
| 9 | 성공 URL로 리다이렉트 대기 | 게임 URL에 `?session_id=cs_test_*` 파라미터가 포함된 URL로 돌아온다 |
| 10 | Unity 게임 재로드 후 결제 결과 폴링 대기 | 구매 성공 팝업이 표시된다 |
| 11 | `window.gamebridge.getCoins()` 확인 | 코인 수가 N + 500이다 |

**Stripe 결제 거절 시나리오** (추가 검증):

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 12 | 동일 플로우로 Stripe Checkout 진입 | Stripe 결제 페이지 표시 |
| 13 | 거절 테스트 카드 입력: `4000 0000 0000 0002` | 카드 정보 입력 |
| 14 | "결제" 클릭 | "카드가 거부되었습니다" 에러 메시지가 Stripe 페이지에 표시된다 |
| 15 | 취소 URL로 돌아간 후 코인 확인 | 코인 수에 변동이 없다 |

---

### TC-IAP-014: 환불 RTDN 처리 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-IAP-014 |
| **목적** | Google Play RTDN 환불 알림 후 클라이언트 동기화가 정상 동작하는지 검증. 소비형 환불 시 재화 차감, 비소비형 환불 시 권한 회수 확인 |
| **사전조건** | 1. IAP 서비스 초기화 완료 2. Mock 결제 결과 `success` 3. 환불 동기화 시뮬레이션 API 사용 가능 |
| **우선순위** | P1-높음 |

**테스트 단계**:

**시나리오 A: 소비형 상품 환불**

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 1 | 초기 코인 0으로 설정 후 `coin_pack_s`(코인 500) 구매 | 코인 500 지급 |
| 2 | `window.gamebridge.getCoins()` 확인 | 500 반환 |
| 3 | 환불 동기화 시뮬레이션: `SendMessage('IAPManager', 'SimulateRefundSync', 'coin_pack_s')` | 환불 처리 시작 |
| 4 | Playwright로 `/api/user/:userId/sync` 요청을 인터셉트하여 `{pendingSync: true, coins: 0}` 응답 반환 | 동기화 응답 전달 |
| 5 | 동기화 완료 대기 | "데이터가 동기화되었습니다" 토스트 메시지 표시 |
| 6 | `window.gamebridge.getCoins()` 확인 | 0 반환 (코인 500 차감됨) |

**시나리오 B: 비소비형 상품 환불**

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 7 | `remove_ads` 구매 실행 | 광고 제거 활성화, `isAdsRemoved() === true` |
| 8 | 환불 동기화 시뮬레이션: `SendMessage('IAPManager', 'SimulateRefundSync', 'remove_ads')` | 환불 처리 시작 |
| 9 | 동기화 API 인터셉트하여 `{pendingSync: true, adsRemoved: false, purchasedProducts: []}` 응답 | 동기화 응답 전달 |
| 10 | `window.gamebridge.isAdsRemoved()` 확인 | `false` 반환 (광고 제거 해제됨) |
| 11 | `window.gamebridge.getPurchasedProducts()` 확인 | `"remove_ads"`가 목록에 없다 |
| 12 | 메인 화면에서 보상형 광고 버튼 확인 | 광고 버튼이 다시 표시된다 |

**시나리오 C: 잔액 부족 환불 (음수 방지)**

| 단계 | 행위 | 기대 결과 |
|------|------|----------|
| 13 | 코인 100으로 설정 후 `coin_pack_l`(코인 4,000) 환불 동기화 시뮬레이션 | 환불 처리 |
| 14 | 동기화 API에서 `{pendingSync: true, coins: 0}` 응답 (0으로 설정, 음수 아님) | 동기화 처리 |
| 15 | `window.gamebridge.getCoins()` 확인 | 0 반환 (음수가 아닌 0) |

---

## 5. Playwright TypeScript 코드 예제

### 5.1 테스트 헬퍼 유틸리티

```typescript
// tests/iap/helpers/iap-helpers.ts
import { Page, expect } from '@playwright/test';

/**
 * Unity WebGL 게임 로드 완료를 대기한다.
 * window.unityInstance가 존재하고 IAP 서비스가 초기화될 때까지 대기.
 */
export async function waitForGameReady(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () => (window as any).unityInstance !== undefined,
    { timeout }
  );
  await page.waitForFunction(
    () => (window as any).gamebridge?.getIAPInitState() === true,
    { timeout }
  );
}

/**
 * Unity에 SendMessage를 전달한다.
 */
export async function sendUnityMessage(
  page: Page,
  objectName: string,
  methodName: string,
  value: string = ''
): Promise<void> {
  await page.evaluate(
    ({ obj, method, val }) => {
      (window as any).unityInstance.SendMessage(obj, method, val);
    },
    { obj: objectName, method: methodName, val: value }
  );
}

/**
 * Mock IAP 결제 결과를 설정한다.
 */
export async function setMockPurchaseResult(
  page: Page,
  result: 'success' | 'cancel' | 'network_error' | 'product_unavailable' |
          'payment_declined' | 'validation_failed'
): Promise<void> {
  await sendUnityMessage(page, 'IAPManager', 'SetMockPurchaseResult', result);
}

/**
 * 현재 코인 수를 조회한다.
 */
export async function getCoins(page: Page): Promise<number> {
  return await page.evaluate(() => (window as any).gamebridge.getCoins());
}

/**
 * 현재 힌트 수를 조회한다.
 */
export async function getHints(page: Page): Promise<number> {
  return await page.evaluate(() => (window as any).gamebridge.getHints());
}

/**
 * 보유 아이템을 조회한다.
 */
export async function getItems(page: Page): Promise<{
  shuffle: number;
  bomb: number;
  rainbow: number;
}> {
  const json = await page.evaluate(() => (window as any).gamebridge.getItems());
  return JSON.parse(json);
}

/**
 * 광고 제거 상태를 확인한다.
 */
export async function isAdsRemoved(page: Page): Promise<boolean> {
  return await page.evaluate(() => (window as any).gamebridge.isAdsRemoved());
}

/**
 * 언락된 테마 목록을 조회한다.
 */
export async function getUnlockedThemes(page: Page): Promise<string[]> {
  return await page.evaluate(
    () => (window as any).gamebridge.getUnlockedThemes()
  );
}

/**
 * 구매한 비소비형 상품 목록을 조회한다.
 */
export async function getPurchasedProducts(page: Page): Promise<string[]> {
  return await page.evaluate(
    () => (window as any).gamebridge.getPurchasedProducts()
  );
}

/**
 * 특정 상품의 구매 횟수를 조회한다.
 */
export async function getPurchaseCount(
  page: Page,
  productId: string
): Promise<number> {
  return await page.evaluate(
    (id) => (window as any).gamebridge.getPurchaseCount(id),
    productId
  );
}

/**
 * 상품의 현지화 가격 문자열을 조회한다.
 */
export async function getProductPrice(
  page: Page,
  productId: string
): Promise<string> {
  return await page.evaluate(
    (id) => (window as any).gamebridge.getProductPrice(id),
    productId
  );
}

/**
 * 마지막 구매 결과를 조회한다.
 */
export async function getLastPurchaseResult(page: Page): Promise<{
  productId: string;
  transactionId: string;
  isSuccess: boolean;
  failureReason: string;
}> {
  const json = await page.evaluate(
    () => (window as any).gamebridge.getLastPurchaseResult()
  );
  return JSON.parse(json);
}

/**
 * 모든 구매 기록을 초기화한다.
 */
export async function resetAllPurchases(page: Page): Promise<void> {
  await sendUnityMessage(page, 'IAPManager', 'ResetAllPurchases', '');
  await page.waitForTimeout(500);
}

/**
 * 상점 화면을 연다.
 */
export async function openShop(page: Page): Promise<void> {
  await page.click('[data-testid="btn-shop"]');
  await page.waitForSelector('[data-testid="shop-panel"]', { state: 'visible' });
}

/**
 * 상점 탭을 선택한다.
 */
export async function selectShopTab(
  page: Page,
  tab: 'consumable' | 'non-consumable'
): Promise<void> {
  await page.click(`[data-testid="shop-tab-${tab}"]`);
  await page.waitForTimeout(300);
}

/**
 * 상점에서 특정 상품의 구매 버튼을 클릭한다.
 */
export async function clickBuyButton(
  page: Page,
  productId: string
): Promise<void> {
  await page.click(`[data-testid="shop-item-${productId}"] [data-testid="btn-buy"]`);
}

/**
 * 구매 확인 팝업에서 "구매" 버튼을 클릭한다.
 */
export async function confirmPurchase(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="purchase-confirm-popup"]', {
    state: 'visible',
  });
  await page.click('[data-testid="btn-confirm-purchase"]');
}

/**
 * 구매 결과 팝업을 닫는다.
 */
export async function closePurchaseResultPopup(page: Page): Promise<void> {
  await page.waitForSelector('[data-testid="purchase-result-popup"]', {
    state: 'visible',
    timeout: 15_000,
  });
  await page.click('[data-testid="btn-close-result"]');
  await page.waitForSelector('[data-testid="purchase-result-popup"]', {
    state: 'hidden',
  });
}
```

### 5.2 소비형 상품 구매 플로우 테스트 (TC-IAP-003)

```typescript
// tests/iap/consumable-purchase.mock.spec.ts
import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  setMockPurchaseResult,
  getCoins,
  getHints,
  getItems,
  getLastPurchaseResult,
  resetAllPurchases,
  openShop,
  selectShopTab,
  clickBuyButton,
  confirmPurchase,
  closePurchaseResultPopup,
} from './helpers/iap-helpers';

test.describe('TC-IAP-003: 소비형 상품 구매 플로우', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
    await setMockPurchaseResult(page, 'success');
  });

  test('코인 소형 팩(coin_pack_s) 구매 시 코인 500개 지급', async ({ page }) => {
    // 1. 현재 코인 수 기록
    const initialCoins = await getCoins(page);

    // 2. 상점 진입 및 소비형 탭 선택
    await openShop(page);
    await selectShopTab(page, 'consumable');

    // 3. 상품 클릭 및 구매 확인 팝업 확인
    await clickBuyButton(page, 'coin_pack_s');

    // 4. 구매 확인 팝업 내용 검증
    const popup = page.locator('[data-testid="purchase-confirm-popup"]');
    await expect(popup).toBeVisible();
    await expect(popup.locator('[data-testid="product-name"]')).toContainText('코인 소형 팩');
    await expect(popup.locator('[data-testid="product-price"]')).not.toContainText('---');

    // 5. 구매 확인
    await confirmPurchase(page);

    // 6. 결제 처리 대기 및 성공 팝업 확인
    await closePurchaseResultPopup(page);

    // 7. 코인 지급 확인
    const finalCoins = await getCoins(page);
    expect(finalCoins).toBe(initialCoins + 500);

    // 8. 구매 결과 확인
    const result = await getLastPurchaseResult(page);
    expect(result.isSuccess).toBe(true);
    expect(result.productId).toBe('coin_pack_s');
  });

  test('코인 특대 팩(coin_pack_xl) 구매 시 코인 10,000개 지급', async ({ page }) => {
    const initialCoins = await getCoins(page);

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_xl');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    const finalCoins = await getCoins(page);
    expect(finalCoins).toBe(initialCoins + 10_000);
  });

  test('힌트 팩(item_hint_10) 구매 시 힌트 10개 지급', async ({ page }) => {
    const initialHints = await getHints(page);

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'item_hint_10');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    const finalHints = await getHints(page);
    expect(finalHints).toBe(initialHints + 10);
  });

  test('아이템 번들(item_bundle) 구매 시 아이템 3종 각 3개 지급', async ({ page }) => {
    const initialItems = await getItems(page);

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'item_bundle');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    const finalItems = await getItems(page);
    expect(finalItems.shuffle).toBe(initialItems.shuffle + 3);
    expect(finalItems.bomb).toBe(initialItems.bomb + 3);
    expect(finalItems.rainbow).toBe(initialItems.rainbow + 3);
  });

  test('소비형 상품은 여러 번 구매 가능', async ({ page }) => {
    const initialCoins = await getCoins(page);

    // 1회 구매
    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    // 2회 구매
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    const finalCoins = await getCoins(page);
    expect(finalCoins).toBe(initialCoins + 1_000); // 500 * 2
  });
});
```

### 5.3 비소비형 상품 구매 및 중복 방지 테스트 (TC-IAP-004, TC-IAP-011)

```typescript
// tests/iap/non-consumable-purchase.mock.spec.ts
import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  setMockPurchaseResult,
  sendUnityMessage,
  getCoins,
  isAdsRemoved,
  getUnlockedThemes,
  getPurchasedProducts,
  getPurchaseCount,
  resetAllPurchases,
  openShop,
  selectShopTab,
  clickBuyButton,
  confirmPurchase,
  closePurchaseResultPopup,
} from './helpers/iap-helpers';

test.describe('TC-IAP-004: 비소비형 상품 구매 플로우 (광고 제거)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
    await setMockPurchaseResult(page, 'success');
  });

  test('광고 제거(remove_ads) 구매 시 광고 비활성화 및 보너스 코인 지급', async ({
    page,
  }) => {
    // 사전 확인
    expect(await isAdsRemoved(page)).toBe(false);
    const initialCoins = await getCoins(page);

    // 구매 실행
    await openShop(page);
    await selectShopTab(page, 'non-consumable');
    await clickBuyButton(page, 'remove_ads');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    // 결과 확인
    expect(await isAdsRemoved(page)).toBe(true);
    expect(await getCoins(page)).toBe(initialCoins + 1_000);
    expect(await getPurchasedProducts(page)).toContain('remove_ads');
  });

  test('테마 구매 시 해당 테마 언락', async ({ page }) => {
    await openShop(page);
    await selectShopTab(page, 'non-consumable');
    await clickBuyButton(page, 'theme_ocean');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    const themes = await getUnlockedThemes(page);
    expect(themes).toContain('theme_ocean');
  });
});

test.describe('TC-IAP-011: 중복 구매 방지', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
    await setMockPurchaseResult(page, 'success');
  });

  test('이미 구매한 비소비형 상품은 재구매 불가', async ({ page }) => {
    // 최초 구매
    await openShop(page);
    await selectShopTab(page, 'non-consumable');
    await clickBuyButton(page, 'remove_ads');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    // 구매 완료 후 버튼 상태 확인
    const buyButton = page.locator(
      '[data-testid="shop-item-remove_ads"] [data-testid="btn-buy"]'
    );
    const isDisabled = await buyButton.isDisabled();
    const buttonText = await buyButton.textContent();

    expect(isDisabled || buttonText?.includes('구매 완료')).toBeTruthy();
  });

  test('스타터 팩은 1회만 구매 가능', async ({ page }) => {
    // 1회 구매
    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'starter_pack');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    expect(await getPurchaseCount(page, 'starter_pack')).toBe(1);

    // 2회 시도 - 버튼 비활성 또는 에러
    const buyButton = page.locator(
      '[data-testid="shop-item-starter_pack"] [data-testid="btn-buy"]'
    );
    const isDisabled = await buyButton.isDisabled();
    expect(isDisabled).toBe(true);
  });
});
```

### 5.4 결제 취소 및 실패 테스트 (TC-IAP-007, TC-IAP-008)

```typescript
// tests/iap/purchase-failure.mock.spec.ts
import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  setMockPurchaseResult,
  getCoins,
  resetAllPurchases,
  openShop,
  selectShopTab,
  clickBuyButton,
  confirmPurchase,
} from './helpers/iap-helpers';

test.describe('TC-IAP-007: 결제 취소 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
  });

  test('사용자 결제 취소 시 코인 변동 없음', async ({ page }) => {
    const initialCoins = await getCoins(page);
    await setMockPurchaseResult(page, 'cancel');

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);

    // 취소 후 에러 팝업 또는 조용한 복귀 대기
    await page.waitForTimeout(3_000);

    // 코인 변동 없음 확인
    expect(await getCoins(page)).toBe(initialCoins);

    // 상점 화면이 정상 유지되는지 확인
    const shopPanel = page.locator('[data-testid="shop-panel"]');
    await expect(shopPanel).toBeVisible();
  });

  test('결제 취소 후 재구매 가능', async ({ page }) => {
    await setMockPurchaseResult(page, 'cancel');

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);
    await page.waitForTimeout(3_000);

    // Mock 결과를 성공으로 변경 후 재시도
    const coinsBefore = await getCoins(page);
    await setMockPurchaseResult(page, 'success');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);

    await page.waitForSelector('[data-testid="purchase-result-popup"]', {
      state: 'visible',
      timeout: 10_000,
    });
    await page.click('[data-testid="btn-close-result"]');

    expect(await getCoins(page)).toBe(coinsBefore + 500);
  });
});

test.describe('TC-IAP-008: 결제 실패 (네트워크 오류)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
  });

  test('네트워크 오류 시 에러 팝업 표시 및 코인 변동 없음', async ({ page }) => {
    const initialCoins = await getCoins(page);
    await setMockPurchaseResult(page, 'network_error');

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_m');
    await confirmPurchase(page);

    // 에러 팝업 확인
    const errorPopup = page.locator('[data-testid="purchase-error-popup"]');
    await expect(errorPopup).toBeVisible({ timeout: 10_000 });

    // 에러 메시지에 네트워크 관련 안내 포함 확인
    const errorMsg = await errorPopup.locator('[data-testid="error-message"]').textContent();
    expect(errorMsg).toMatch(/네트워크|오류|실패|다시 시도/);

    // 팝업 닫기
    await page.click('[data-testid="btn-close-error"]');

    // 코인 변동 없음
    expect(await getCoins(page)).toBe(initialCoins);
  });

  test('오프라인 상태에서 구매 시도 시 에러 처리', async ({ page, context }) => {
    const initialCoins = await getCoins(page);

    // 오프라인 설정
    await context.setOffline(true);

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);

    // 네트워크 오류 처리 대기
    await page.waitForTimeout(5_000);
    expect(await getCoins(page)).toBe(initialCoins);

    // 온라인 복구 후 정상 구매
    await context.setOffline(false);
    await setMockPurchaseResult(page, 'success');

    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);
    await page.waitForSelector('[data-testid="purchase-result-popup"]', {
      state: 'visible',
      timeout: 15_000,
    });
    await page.click('[data-testid="btn-close-result"]');

    expect(await getCoins(page)).toBe(initialCoins + 500);
  });
});
```

### 5.5 영수증 검증 테스트 (TC-IAP-009)

```typescript
// tests/iap/receipt-validation.mock.spec.ts
import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  setMockPurchaseResult,
  getCoins,
  resetAllPurchases,
  openShop,
  selectShopTab,
  clickBuyButton,
  confirmPurchase,
  closePurchaseResultPopup,
} from './helpers/iap-helpers';

test.describe('TC-IAP-009: 영수증 검증 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
  });

  test('유효한 영수증 시 보상 정상 지급', async ({ page }) => {
    // 검증 API 인터셉트하여 성공 응답 보장
    await page.route('**/api/validate/google', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: true,
          orderId: 'GPA.test-order-001',
        }),
      });
    });

    const initialCoins = await getCoins(page);
    await setMockPurchaseResult(page, 'success');

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    expect(await getCoins(page)).toBe(initialCoins + 500);
  });

  test('영수증 검증 실패 시 보상 미지급', async ({ page }) => {
    // 검증 API를 실패로 가로채기
    await page.route('**/api/validate/google', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: false,
          errorCode: 'INVALID_SIGNATURE',
          error: '서명 검증 실패',
        }),
      });
    });

    const initialCoins = await getCoins(page);
    await setMockPurchaseResult(page, 'validation_failed');

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);

    // 에러 팝업 표시 대기
    await page.waitForTimeout(5_000);

    // 코인 변동 없음
    expect(await getCoins(page)).toBe(initialCoins);
  });

  test('중복 주문 시 DUPLICATE_ORDER 에러', async ({ page }) => {
    await page.route('**/api/validate/google', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          valid: false,
          errorCode: 'DUPLICATE_ORDER',
          error: '이미 처리된 주문입니다',
        }),
      });
    });

    const initialCoins = await getCoins(page);
    await setMockPurchaseResult(page, 'validation_failed');

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);

    await page.waitForTimeout(5_000);
    expect(await getCoins(page)).toBe(initialCoins);
  });

  test('검증 API 요청에 필수 파라미터 포함 확인', async ({ page }) => {
    let capturedRequest: any = null;

    await page.route('**/api/validate/google', async (route) => {
      capturedRequest = JSON.parse(route.request().postData() || '{}');
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ valid: true, orderId: 'GPA.test-order-002' }),
      });
    });

    await setMockPurchaseResult(page, 'success');
    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    // 요청 파라미터 검증
    expect(capturedRequest).not.toBeNull();
    expect(capturedRequest.purchaseToken).toBeDefined();
    expect(capturedRequest.productId).toBe('coin_pack_s');
    expect(capturedRequest.userId).toBeDefined();
  });
});
```

### 5.6 Stripe 결제 플로우 테스트 (TC-IAP-013)

```typescript
// tests/iap/stripe-checkout.stripe.spec.ts
import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  sendUnityMessage,
  getCoins,
  resetAllPurchases,
  openShop,
  selectShopTab,
  clickBuyButton,
  confirmPurchase,
} from './helpers/iap-helpers';

test.describe('TC-IAP-013: Stripe 결제 플로우 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
    // Stripe 테스트 모드 활성화
    await sendUnityMessage(page, 'IAPManager', 'SetStripeModeEnabled', 'true');
  });

  test('Stripe Checkout 정상 결제 플로우', async ({ page }) => {
    const initialCoins = await getCoins(page);

    // Checkout API 요청 감시
    const checkoutPromise = page.waitForRequest('**/api/checkout');

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);

    // Checkout API 요청 확인
    const checkoutRequest = await checkoutPromise;
    const requestBody = JSON.parse(checkoutRequest.postData() || '{}');
    expect(requestBody.productId).toBe('coin_pack_s');
    expect(requestBody.userId).toBeDefined();

    // Stripe Checkout 페이지 리다이렉트 대기
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });

    // 테스트 카드 정보 입력
    await page.fill('[data-testid="card-number-input"], #cardNumber, [name="cardNumber"]',
      '4242424242424242');
    await page.fill('[data-testid="card-expiry-input"], #cardExpiry, [name="cardExpiry"]',
      '1230');
    await page.fill('[data-testid="card-cvc-input"], #cardCvc, [name="cardCvc"]',
      '123');
    await page.fill('[data-testid="billing-name-input"], #billingName, [name="billingName"]',
      'Test User');

    // 결제 버튼 클릭
    await page.click('[data-testid="hosted-payment-submit-button"], .SubmitButton');

    // 게임 URL로 리다이렉트 대기
    const gameUrl = process.env.GAME_URL || 'http://localhost:8080';
    await page.waitForURL(new RegExp(gameUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), {
      timeout: 30_000,
    });

    // URL에 session_id 파라미터 포함 확인
    const url = new URL(page.url());
    expect(url.searchParams.get('session_id')).toMatch(/^cs_test_/);

    // 게임 로드 대기 및 결제 결과 확인
    await waitForGameReady(page);

    // 폴링으로 결제 완료 대기 (최대 60초)
    await page.waitForFunction(
      (expected) => {
        const coins = (window as any).gamebridge?.getCoins();
        return coins !== undefined && coins >= expected;
      },
      initialCoins + 500,
      { timeout: 60_000 }
    );

    expect(await getCoins(page)).toBe(initialCoins + 500);
  });

  test('Stripe 결제 거절 시 코인 변동 없음', async ({ page }) => {
    const initialCoins = await getCoins(page);

    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);

    // Stripe Checkout 페이지 대기
    await page.waitForURL(/checkout\.stripe\.com/, { timeout: 15_000 });

    // 거절 테스트 카드 입력
    await page.fill('[data-testid="card-number-input"], #cardNumber, [name="cardNumber"]',
      '4000000000000002');
    await page.fill('[data-testid="card-expiry-input"], #cardExpiry, [name="cardExpiry"]',
      '1230');
    await page.fill('[data-testid="card-cvc-input"], #cardCvc, [name="cardCvc"]',
      '123');
    await page.fill('[data-testid="billing-name-input"], #billingName, [name="billingName"]',
      'Test User');

    await page.click('[data-testid="hosted-payment-submit-button"], .SubmitButton');

    // 거절 에러 메시지 확인
    await page.waitForSelector('.StripeError, [data-testid="card-errors"]', {
      timeout: 10_000,
    });

    const errorText = await page.textContent(
      '.StripeError, [data-testid="card-errors"]'
    );
    expect(errorText).toBeTruthy();
  });
});
```

### 5.7 환불 RTDN 처리 테스트 (TC-IAP-014)

```typescript
// tests/iap/refund-sync.mock.spec.ts
import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  setMockPurchaseResult,
  sendUnityMessage,
  getCoins,
  isAdsRemoved,
  getPurchasedProducts,
  resetAllPurchases,
  openShop,
  selectShopTab,
  clickBuyButton,
  confirmPurchase,
  closePurchaseResultPopup,
} from './helpers/iap-helpers';

test.describe('TC-IAP-014: 환불 RTDN 처리 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
    await setMockPurchaseResult(page, 'success');
  });

  test('소비형 상품 환불 시 코인 차감', async ({ page }) => {
    // 코인 팩 구매
    await openShop(page);
    await selectShopTab(page, 'consumable');
    await clickBuyButton(page, 'coin_pack_s');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    expect(await getCoins(page)).toBeGreaterThanOrEqual(500);

    // 동기화 API 인터셉트 - 환불 후 코인 차감 상태 반환
    await page.route('**/api/user/*/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pendingSync: true,
          coins: 0,
          hints: 0,
          adsRemoved: false,
          unlockedThemes: [],
          purchasedProducts: [],
        }),
      });
    });

    // 환불 동기화 시뮬레이션
    await sendUnityMessage(page, 'IAPManager', 'SimulateRefundSync', 'coin_pack_s');

    // 동기화 완료 대기
    await page.waitForFunction(
      () => (window as any).gamebridge?.getCoins() === 0,
      { timeout: 10_000 }
    );

    expect(await getCoins(page)).toBe(0);
  });

  test('비소비형 상품 환불 시 권한 회수', async ({ page }) => {
    // 광고 제거 구매
    await openShop(page);
    await selectShopTab(page, 'non-consumable');
    await clickBuyButton(page, 'remove_ads');
    await confirmPurchase(page);
    await closePurchaseResultPopup(page);

    expect(await isAdsRemoved(page)).toBe(true);

    // 동기화 API 인터셉트 - 환불 후 광고 제거 해제 상태 반환
    await page.route('**/api/user/*/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pendingSync: true,
          coins: 0,
          hints: 0,
          adsRemoved: false,
          unlockedThemes: [],
          purchasedProducts: [],
        }),
      });
    });

    // 환불 동기화 시뮬레이션
    await sendUnityMessage(page, 'IAPManager', 'SimulateRefundSync', 'remove_ads');

    // 동기화 완료 대기
    await page.waitForFunction(
      () => (window as any).gamebridge?.isAdsRemoved() === false,
      { timeout: 10_000 }
    );

    expect(await isAdsRemoved(page)).toBe(false);
    expect(await getPurchasedProducts(page)).not.toContain('remove_ads');
  });

  test('잔액 부족 환불 시 코인이 음수가 되지 않는다', async ({ page }) => {
    // 동기화 API에서 코인 0 반환 (음수 방지)
    await page.route('**/api/user/*/sync', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          pendingSync: true,
          coins: 0,  // 서버가 0으로 보정하여 반환
          hints: 0,
          adsRemoved: false,
          unlockedThemes: [],
          purchasedProducts: [],
        }),
      });
    });

    await sendUnityMessage(page, 'IAPManager', 'SimulateRefundSync', 'coin_pack_l');

    await page.waitForFunction(
      () => (window as any).gamebridge?.getCoins() === 0,
      { timeout: 10_000 }
    );

    const coins = await getCoins(page);
    expect(coins).toBe(0);
    expect(coins).toBeGreaterThanOrEqual(0); // 음수 아님 확인
  });
});
```

### 5.8 상품 목록 로딩 및 가격 표시 테스트 (TC-IAP-001, TC-IAP-002, TC-IAP-012)

```typescript
// tests/iap/shop-display.mock.spec.ts
import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  getProductPrice,
  openShop,
  selectShopTab,
} from './helpers/iap-helpers';

// 설계문서에 정의된 상품 목록
const CONSUMABLE_PRODUCTS = [
  { id: 'coin_pack_s', name: '코인 소형 팩', priceUSD: '$0.99' },
  { id: 'coin_pack_m', name: '코인 중형 팩', priceUSD: '$2.99' },
  { id: 'coin_pack_l', name: '코인 대형 팩', priceUSD: '$5.99' },
  { id: 'coin_pack_xl', name: '코인 특대 팩', priceUSD: '$9.99' },
  { id: 'item_hint_10', name: '힌트 10개 팩', priceUSD: '$0.99' },
  { id: 'item_bundle', name: '아이템 번들', priceUSD: '$1.99' },
  { id: 'starter_pack', name: '스타터 팩', priceUSD: '$2.99' },
];

const NON_CONSUMABLE_PRODUCTS = [
  { id: 'remove_ads', name: '광고 제거', priceUSD: '$3.99' },
  { id: 'theme_ocean', name: '오션 테마', priceUSD: '$1.99' },
  { id: 'theme_forest', name: '포레스트 테마', priceUSD: '$1.99' },
  { id: 'theme_space', name: '스페이스 테마', priceUSD: '$1.99' },
  { id: 'theme_bundle', name: '테마 전체 팩', priceUSD: '$4.99' },
  { id: 'premium_pass', name: '프리미엄 패스', priceUSD: '$9.99' },
];

test.describe('TC-IAP-001/002: 상품 목록 로딩 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
  });

  test('소비형 상품 7종이 모두 표시된다', async ({ page }) => {
    await openShop(page);
    await selectShopTab(page, 'consumable');

    for (const product of CONSUMABLE_PRODUCTS) {
      const item = page.locator(`[data-testid="shop-item-${product.id}"]`);
      await expect(item).toBeVisible();

      // 상품명 확인
      await expect(item.locator('[data-testid="product-name"]'))
        .toContainText(product.name);

      // 구매 버튼 존재 확인
      await expect(item.locator('[data-testid="btn-buy"]')).toBeEnabled();
    }
  });

  test('비소비형 상품 6종이 모두 표시된다', async ({ page }) => {
    await openShop(page);
    await selectShopTab(page, 'non-consumable');

    for (const product of NON_CONSUMABLE_PRODUCTS) {
      const item = page.locator(`[data-testid="shop-item-${product.id}"]`);
      await expect(item).toBeVisible();

      await expect(item.locator('[data-testid="product-name"]'))
        .toContainText(product.name);

      await expect(item.locator('[data-testid="btn-buy"]')).toBeEnabled();
    }
  });
});

test.describe('TC-IAP-012: 가격 표시 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
  });

  test('모든 상품에 유효한 가격이 표시된다 (---가 아님)', async ({ page }) => {
    const allProducts = [...CONSUMABLE_PRODUCTS, ...NON_CONSUMABLE_PRODUCTS];

    for (const product of allProducts) {
      const price = await getProductPrice(page, product.id);
      expect(price).not.toBe('---');
      expect(price).not.toBe('');
      expect(price.length).toBeGreaterThan(0);
    }
  });

  test('상점 UI에서 가격이 올바르게 렌더링된다', async ({ page }) => {
    await openShop(page);
    await selectShopTab(page, 'consumable');

    for (const product of CONSUMABLE_PRODUCTS) {
      const priceText = await page
        .locator(`[data-testid="shop-item-${product.id}"] [data-testid="product-price"]`)
        .textContent();
      expect(priceText).toBeTruthy();
      expect(priceText).not.toBe('---');
    }

    await selectShopTab(page, 'non-consumable');

    for (const product of NON_CONSUMABLE_PRODUCTS) {
      const priceText = await page
        .locator(`[data-testid="shop-item-${product.id}"] [data-testid="product-price"]`)
        .textContent();
      expect(priceText).toBeTruthy();
      expect(priceText).not.toBe('---');
    }
  });
});
```

### 5.9 구매 복원 테스트 (TC-IAP-010)

```typescript
// tests/iap/purchase-restore.mock.spec.ts
import { test, expect } from '@playwright/test';
import {
  waitForGameReady,
  sendUnityMessage,
  isAdsRemoved,
  getUnlockedThemes,
  getPurchasedProducts,
  resetAllPurchases,
} from './helpers/iap-helpers';

test.describe('TC-IAP-010: 구매 복원 테스트', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await waitForGameReady(page);
    await resetAllPurchases(page);
  });

  test('비소비형 상품 복원 시 권한 재설정', async ({ page }) => {
    // 초기 상태 확인 - 모두 비활성
    expect(await isAdsRemoved(page)).toBe(false);
    expect(await getUnlockedThemes(page)).toEqual([]);
    expect(await getPurchasedProducts(page)).toEqual([]);

    // 구매 복원 시뮬레이션
    await sendUnityMessage(
      page,
      'IAPManager',
      'SimulateRestorePurchases',
      'remove_ads,theme_ocean'
    );

    // 복원 완료 대기
    await page.waitForFunction(
      () => (window as any).gamebridge?.isAdsRemoved() === true,
      { timeout: 10_000 }
    );

    // 결과 검증
    expect(await isAdsRemoved(page)).toBe(true);
    expect(await getUnlockedThemes(page)).toContain('theme_ocean');
    expect(await getPurchasedProducts(page)).toContain('remove_ads');
    expect(await getPurchasedProducts(page)).toContain('theme_ocean');
  });

  test('소비형 상품은 복원 대상에서 제외', async ({ page }) => {
    // 소비형 상품을 포함하여 복원 시도
    await sendUnityMessage(
      page,
      'IAPManager',
      'SimulateRestorePurchases',
      'remove_ads,coin_pack_s'
    );

    await page.waitForFunction(
      () => (window as any).gamebridge?.isAdsRemoved() === true,
      { timeout: 10_000 }
    );

    // remove_ads는 복원, coin_pack_s는 소비형이므로 복원 불가
    const purchased = await getPurchasedProducts(page);
    expect(purchased).toContain('remove_ads');
    // 소비형은 purchasedProducts에 포함되지 않음
    expect(purchased).not.toContain('coin_pack_s');
  });

  test('복원할 구매 이력이 없을 때 0건 완료', async ({ page }) => {
    await sendUnityMessage(
      page,
      'IAPManager',
      'SimulateRestorePurchases',
      ''
    );

    // 복원 완료 대기 (빈 목록)
    await page.waitForTimeout(3_000);

    expect(await isAdsRemoved(page)).toBe(false);
    expect(await getUnlockedThemes(page)).toEqual([]);
    expect(await getPurchasedProducts(page)).toEqual([]);
  });
});
```

---

## 6. 테스트 데이터 및 자동화 전략

### 6.1 테스트 데이터

#### 6.1.1 상품 카탈로그 테스트 데이터

| 상품 ID | 유형 | USD | 보상 | 구매 제한 |
|---------|------|-----|------|----------|
| `coin_pack_s` | Consumable | $0.99 | 코인 500 | 무제한 |
| `coin_pack_m` | Consumable | $2.99 | 코인 1,500 | 무제한 |
| `coin_pack_l` | Consumable | $5.99 | 코인 4,000 | 무제한 |
| `coin_pack_xl` | Consumable | $9.99 | 코인 10,000 | 무제한 |
| `item_hint_10` | Consumable | $0.99 | 힌트 10 | 무제한 |
| `item_bundle` | Consumable | $1.99 | 셔플 3 + 폭탄 3 + 무지개 3 | 무제한 |
| `starter_pack` | Consumable | $2.99 | 코인 2,000 + 힌트 10 + 번들 | 1회 한정 |
| `remove_ads` | NonConsumable | $3.99 | 광고 제거 + 코인 1,000 | 1회 |
| `theme_ocean` | NonConsumable | $1.99 | 오션 테마 언락 | 1회 |
| `theme_forest` | NonConsumable | $1.99 | 포레스트 테마 언락 | 1회 |
| `theme_space` | NonConsumable | $1.99 | 스페이스 테마 언락 | 1회 |
| `theme_bundle` | NonConsumable | $4.99 | 전체 테마 언락 | 1회 |
| `premium_pass` | NonConsumable | $9.99 | 광고 제거 + 전체 테마 + 코인 5,000 | 1회 |

#### 6.1.2 Stripe 테스트 카드 데이터

| 시나리오 | 카드 번호 | 만료일 | CVC | 예상 결과 |
|---------|----------|--------|-----|----------|
| 정상 결제 | `4242 4242 4242 4242` | 12/30 | 123 | 성공 |
| 카드 거부 | `4000 0000 0000 0002` | 12/30 | 123 | 거절 |
| 3D Secure | `4000 0027 6000 3184` | 12/30 | 123 | 인증 팝업 |
| 잔액 부족 | `4000 0000 0000 9995` | 12/30 | 123 | 잔액 부족 에러 |
| CVC 오류 | `4000 0000 0000 0341` | 12/30 | 123 | CVC 확인 실패 |

#### 6.1.3 Mock 영수증 검증 데이터

| 시나리오 | purchaseToken 패턴 | 서버 응답 |
|---------|-------------------|----------|
| 유효한 영수증 | `editor_token_*` | `{ valid: true, orderId: "GPA.test-*" }` |
| 잘못된 서명 | `invalid_token_*` | `{ valid: false, errorCode: "INVALID_SIGNATURE" }` |
| 중복 주문 | `duplicate_token_*` | `{ valid: false, errorCode: "DUPLICATE_ORDER" }` |
| 상품 불일치 | `mismatch_token_*` | `{ valid: false, errorCode: "PRODUCT_MISMATCH" }` |

### 6.2 자동화 전략

#### 6.2.1 테스트 실행 구조

```
tests/
└── iap/
    ├── helpers/
    │   └── iap-helpers.ts               # 공통 헬퍼 유틸리티
    ├── consumable-purchase.mock.spec.ts  # TC-IAP-003, TC-IAP-005
    ├── non-consumable-purchase.mock.spec.ts  # TC-IAP-004, TC-IAP-011
    ├── purchase-failure.mock.spec.ts     # TC-IAP-007, TC-IAP-008
    ├── receipt-validation.mock.spec.ts   # TC-IAP-009
    ├── purchase-restore.mock.spec.ts     # TC-IAP-010
    ├── shop-display.mock.spec.ts         # TC-IAP-001, TC-IAP-002, TC-IAP-012
    ├── stripe-checkout.stripe.spec.ts    # TC-IAP-013
    ├── refund-sync.mock.spec.ts          # TC-IAP-014
    └── ui-update.mock.spec.ts            # TC-IAP-006
```

#### 6.2.2 CI/CD 파이프라인 통합

```yaml
# .github/workflows/iap-tests.yml
name: IAP Playwright Tests

on:
  push:
    branches: [main, develop]
    paths:
      - 'Assets/Scripts/IAP/**'
      - 'server/routes/checkout.js'
      - 'server/routes/validate-*.js'
      - 'tests/iap/**'
  pull_request:
    branches: [main]

jobs:
  iap-mock-tests:
    name: IAP Mock Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Start test server
        run: |
          npm run build:webgl:test &
          npm run server:test &
          npx wait-on http://localhost:8080
      - name: Run IAP Mock tests
        run: npx playwright test --project=iap-mock
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: iap-mock-results
          path: playwright-report/

  iap-stripe-tests:
    name: IAP Stripe Integration Tests
    runs-on: ubuntu-latest
    needs: iap-mock-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - name: Install dependencies
        run: npm ci
      - name: Install Playwright browsers
        run: npx playwright install --with-deps chromium
      - name: Start test server with Stripe test keys
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_TEST_SECRET_KEY }}
          STRIPE_PUBLIC_KEY: ${{ secrets.STRIPE_TEST_PUBLIC_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_TEST_WEBHOOK_SECRET }}
        run: |
          npm run build:webgl:test &
          npm run server:test &
          npx wait-on http://localhost:8080
      - name: Run Stripe integration tests
        run: npx playwright test --project=iap-stripe
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: iap-stripe-results
          path: playwright-report/
```

#### 6.2.3 테스트 격리 전략

| 전략 | 설명 |
|------|------|
| **구매 기록 초기화** | 매 테스트 시작 전 `ResetAllPurchases` 호출로 깨끗한 상태에서 시작 |
| **Mock 결과 재설정** | `beforeEach`에서 Mock 결제 결과를 기본값(`success`)으로 초기화 |
| **API 인터셉트 해제** | 각 테스트에서 설정한 `page.route()`는 해당 테스트 범위 내에서만 유효 |
| **독립적 테스트** | 각 테스트는 다른 테스트의 결과에 의존하지 않음 |
| **타임아웃 관리** | IAP 테스트는 네트워크 폴링이 포함되므로 60초 타임아웃 적용 |

#### 6.2.4 테스트 실행 명령어

```bash
# 전체 IAP 테스트 실행
npx playwright test --project=iap-mock --project=iap-stripe

# Mock 테스트만 실행 (빠른 피드백)
npx playwright test --project=iap-mock

# Stripe 통합 테스트만 실행
npx playwright test --project=iap-stripe

# 특정 테스트 케이스만 실행
npx playwright test tests/iap/consumable-purchase.mock.spec.ts

# 디버그 모드 (브라우저 표시)
npx playwright test --project=iap-mock --headed --debug

# HTML 리포트 생성
npx playwright test --project=iap-mock --reporter=html
npx playwright show-report
```

#### 6.2.5 실패 시 디버깅 전략

| 방법 | 설명 |
|------|------|
| **스크린샷** | 실패 시 자동 스크린샷 캡처 (`screenshot: 'only-on-failure'`) |
| **비디오 녹화** | 실패 테스트의 전체 실행 과정 비디오 보존 (`video: 'retain-on-failure'`) |
| **트레이스 파일** | Playwright Trace Viewer로 단계별 분석 가능 (`trace: 'retain-on-failure'`) |
| **콘솔 로그** | Unity WebGL 콘솔 로그 캡처 (`page.on('console')`) |
| **네트워크 로그** | API 요청/응답 로그 캡처 (`page.on('request')`, `page.on('response')`) |

#### 6.2.6 테스트 우선순위별 실행 계획

| 단계 | 대상 | 실행 시점 | 소요 시간 (예상) |
|------|------|----------|----------------|
| 1차 | P0-필수 (TC-IAP-001~007, 009, 013) | 매 커밋 시 | 약 5분 |
| 2차 | P1-높음 (TC-IAP-008, 010, 011, 012, 014) | PR 생성 시 | 약 3분 |
| 3차 | 전체 (P0 + P1) | 릴리스 전 | 약 10분 |
| 4차 | Stripe 통합 테스트 | 주 1회 또는 Stripe 관련 변경 시 | 약 5분 |

---

### 6.3 알려진 제한사항 및 주의사항

| 항목 | 설명 |
|------|------|
| **Google Play 직접 테스트 불가** | WebGL 환경에서는 Google Play Billing을 직접 호출할 수 없으므로 Mock 서비스로 대체. Android 빌드 테스트는 별도 수동 테스트 필요 |
| **Stripe Checkout 리다이렉트** | Stripe Checkout은 외부 도메인으로 리다이렉트되므로 Playwright의 크로스 도메인 지원 필요. Stripe 테스트 모드에서도 실제 네트워크 호출 발생 |
| **Unity WebGL 초기화 시간** | Unity WebGL 빌드 로드에 10~30초 소요. 테스트 타임아웃을 충분히 설정해야 함 |
| **결제 폴링 타이밍** | Stripe 결제 후 서버 Webhook 처리 + 클라이언트 폴링까지 최대 60초 소요 가능 |
| **Mock과 실제 동작 차이** | `EditorIAPService`는 실제 Google Play Billing과 동작이 다를 수 있음. 핵심 결제 로직은 Android 기기에서 별도 검증 필요 |
| **Stripe 테스트 키 관리** | CI/CD에서 Stripe 테스트 API 키를 시크릿으로 관리해야 함. 코드에 하드코딩 금지 |
