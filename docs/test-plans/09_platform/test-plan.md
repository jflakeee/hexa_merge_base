# 09. 플랫폼 배포 및 인프라 - Playwright 테스트 계획서

> **프로젝트**: Hexa Merge Basic
> **테스트 대상**: 플랫폼 배포 및 인프라 시스템 (설계문서 `03_monetization-platform-design.md` 섹션 3~7)
> **개발 계획서**: `docs/development/09_platform/development-plan.md`
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

Unity WebGL 빌드로 배포되는 Hexa Merge Basic 게임의 플랫폼 배포 및 인프라 시스템이 설계문서에 정의된 요구사항대로 정상 동작하는지 검증한다. Playwright를 이용해 다중 브라우저(Chromium, Firefox, WebKit) 환경에서 WebGL 빌드 로딩, 데이터 저장/복원, Firebase Analytics 이벤트 전송, PWA 지원, SEO 메타 태그, 보안 헤더, 성능 지표, 네트워크 단절/복구, 에러 리포팅 등을 자동화하여 검증한다.

### 1.2 범위

| 범위 | 포함 항목 |
|------|----------|
| **포함** | WebGL 빌드 로딩 및 초기화, 브라우저 호환성(Chrome/Firefox/Safari/Edge), WebGL 메모리 사용량, LocalStorage/IndexedDB 데이터 저장, 데이터 새로고침 복원, Firebase Analytics 이벤트 전송, PWA manifest/Service Worker, SEO 메타 태그, 보안(HTTPS/CSP/콘솔 에러), 성능(초기 로드 크기/FPS), 네트워크 단절/복구, Crashlytics 에러 리포팅 |
| **제외** | Android 네이티브 빌드, Google Play Billing 결제, AdMob SDK 네이티브 연동, 서버 영수증 검증 백엔드, CI/CD 파이프라인 자체 테스트, 실제 Firebase Console 대시보드 검증 |

### 1.3 전제조건

| 항목 | 설명 |
|------|------|
| **Unity WebGL 빌드** | 테스트용 WebGL 빌드가 로컬(`http://localhost:8080`) 또는 스테이징 서버에 배포되어 있어야 한다 |
| **테스트 모드 플래그** | Unity 빌드 시 `TEST_MODE` 스크립팅 심볼이 정의되어 Mock 서비스 및 디버그 API가 노출되어야 한다 |
| **JavaScript Bridge** | `unityInstance.SendMessage()`를 통해 게임 상태를 외부에서 제어할 수 있어야 한다 |
| **Firebase JS SDK** | WebGL 템플릿에 Firebase JS SDK(Modular v9)가 포함되어 Analytics/Auth 브릿지가 활성화되어야 한다 |
| **서버 환경** | Firebase Hosting 또는 로컬 서버에서 Brotli 압축, MIME 타입, CSP 헤더 등이 올바르게 설정되어야 한다 |
| **네트워크 제어** | Playwright의 `page.route()`, `context.setOffline()` 등을 통한 네트워크 상태 시뮬레이션이 가능해야 한다 |
| **브라우저 환경** | Chromium, Firefox, WebKit 엔진이 설치되어 있어야 한다 |

### 1.4 참조 문서

- 설계문서: `docs/design/03_monetization-platform-design.md` -- 섹션 3~7
- 개발 계획서: `docs/development/09_platform/development-plan.md`

---

## 2. 테스트 환경 설정

### 2.1 다중 브라우저 및 디바이스 에뮬레이션 구성

테스트는 주요 브라우저 4종과 모바일 디바이스 에뮬레이션을 포함한다.

```
[테스트 브라우저 매트릭스]

데스크톱:
├── Chromium (Chrome 90+ 대응)
├── Firefox (Firefox 90+ 대응)
├── WebKit (Safari 15.4+ 대응)
└── Chromium + Edge UA (Edge 90+ 대응)

모바일 에뮬레이션:
├── iPhone 14 (390x844, Safari WebKit)
├── Pixel 7 (412x915, Chrome Mobile)
└── iPad Pro 11" (834x1194, Safari WebKit)
```

**브라우저별 WebGL 지원 현황**:

| 브라우저 | 최소 버전 | WebGL 2.0 | WebAssembly | SharedArrayBuffer |
|---------|----------|-----------|-------------|-------------------|
| Chrome | 90+ | O | O | O |
| Firefox | 90+ | O | O | O |
| Safari | 15.4+ | O | O | 제한적 |
| Edge | 90+ | O | O | O |

### 2.2 게임 상태 제어 API (JavaScript Bridge)

**Unity -> JS 브릿지 (상태 조회)**:

| JS 호출 | 반환 | 설명 |
|---------|------|------|
| `window.gamebridge.getGameState()` | `string(JSON)` | 전체 게임 상태 JSON |
| `window.gamebridge.getPlayerCoins()` | `number` | 보유 코인 수 |
| `window.gamebridge.getPlayerHints()` | `number` | 보유 힌트 수 |
| `window.gamebridge.getHighScore()` | `number` | 최고 점수 |
| `window.gamebridge.getSaveDataVersion()` | `number` | 세이브 데이터 버전 |
| `window.gamebridge.isFirebaseInitialized()` | `boolean` | Firebase 초기화 상태 |
| `window.gamebridge.getAnalyticsEvents()` | `string(JSON)` | 테스트 모드에서 수집된 Analytics 이벤트 목록 |
| `window.gamebridge.getLastError()` | `string` | 마지막 에러 메시지 |
| `window.gamebridge.getMemoryUsageMB()` | `number` | 현재 메모리 사용량(MB) |
| `window.gamebridge.getFPS()` | `number` | 현재 FPS |

**Playwright -> Unity 제어 (SendMessage)**:

| JS 호출 | 설명 |
|---------|------|
| `SendMessage('SaveManager', 'ForceSave', '')` | 즉시 로컬 저장 실행 |
| `SendMessage('SaveManager', 'SetTestData', JSON)` | 테스트 데이터 주입 |
| `SendMessage('SaveManager', 'ClearAllData', '')` | 모든 저장 데이터 삭제 |
| `SendMessage('FirebaseInitializer', 'EnableTestMode', '')` | Firebase 테스트 모드 활성화 |
| `SendMessage('AnalyticsService', 'FlushEvents', '')` | 대기 중인 Analytics 이벤트 즉시 전송 |
| `SendMessage('CrashlyticsService', 'SimulateError', 'TestError')` | 테스트 에러 발생 시뮬레이션 |
| `SendMessage('GameManager', 'SimulateGameOver', '1234')` | 게임 오버 시뮬레이션 (점수 지정) |

### 2.3 Playwright 프로젝트 구조

```
tests/
  e2e/
    platform/
      fixtures/
        platform.fixture.ts       # 공통 테스트 픽스처 (WebGL 로드 대기 등)
        unity-bridge.ts            # Unity WebGL 브릿지 헬퍼
        browser-helpers.ts         # 브라우저별 유틸리티
      webgl-loading.spec.ts        # TC-PLAT-001 ~ TC-PLAT-003
      browser-compat.spec.ts       # TC-PLAT-004 ~ TC-PLAT-007
      memory.spec.ts               # TC-PLAT-008 ~ TC-PLAT-009
      data-storage.spec.ts         # TC-PLAT-010 ~ TC-PLAT-013
      data-restore.spec.ts         # TC-PLAT-014 ~ TC-PLAT-015
      firebase-analytics.spec.ts   # TC-PLAT-016 ~ TC-PLAT-018
      pwa.spec.ts                  # TC-PLAT-019 ~ TC-PLAT-021
      seo.spec.ts                  # TC-PLAT-022 ~ TC-PLAT-024
      security.spec.ts             # TC-PLAT-025 ~ TC-PLAT-028
      performance.spec.ts          # TC-PLAT-029 ~ TC-PLAT-031
      network.spec.ts              # TC-PLAT-032 ~ TC-PLAT-034
      crashlytics.spec.ts          # TC-PLAT-035 ~ TC-PLAT-037
```

### 2.4 playwright.config.ts 설정

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e/platform',
  timeout: 120_000, // WebGL 로드에 시간이 걸리므로 2분
  retries: 1,
  fullyParallel: false, // Unity WebGL은 단일 인스턴스 권장
  use: {
    baseURL: process.env.WEBGL_URL || 'http://localhost:8080',
    viewport: { width: 1280, height: 720 },
    actionTimeout: 30_000,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    // 데스크톱 브라우저
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
    {
      name: 'edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
    },
    // 모바일 에뮬레이션
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
    {
      name: 'tablet',
      use: { ...devices['iPad Pro 11'] },
    },
  ],
  webServer: {
    command: 'npx serve build/webgl -l 8080 --cors',
    port: 8080,
    timeout: 30_000,
    reuseExistingServer: !process.env.CI,
  },
});
```

---

## 3. 테스트 케이스 목록

### 3.1 체크리스트 총괄

| 카테고리 | TC-ID 범위 | 테스트 수 | 우선순위 분포 |
|---------|-----------|----------|-------------|
| WebGL 빌드 로딩 | TC-PLAT-001 ~ 003 | 3 | 높음 3 |
| 브라우저 호환성 | TC-PLAT-004 ~ 007 | 4 | 높음 4 |
| WebGL 메모리 사용량 | TC-PLAT-008 ~ 009 | 2 | 중간 2 |
| 데이터 저장 (LocalStorage/IndexedDB) | TC-PLAT-010 ~ 013 | 4 | 높음 4 |
| 데이터 새로고침 복원 | TC-PLAT-014 ~ 015 | 2 | 높음 2 |
| Firebase Analytics | TC-PLAT-016 ~ 018 | 3 | 중간 3 |
| PWA 관련 | TC-PLAT-019 ~ 021 | 3 | 낮음 3 |
| SEO 메타 태그 | TC-PLAT-022 ~ 024 | 3 | 낮음 3 |
| 보안 (HTTPS/CSP/콘솔) | TC-PLAT-025 ~ 028 | 4 | 높음 4 |
| 성능 (로드 크기/FPS) | TC-PLAT-029 ~ 031 | 3 | 중간 3 |
| 네트워크 단절/복구 | TC-PLAT-032 ~ 034 | 3 | 높음 3 |
| Crashlytics 에러 리포팅 | TC-PLAT-035 ~ 037 | 3 | 중간 3 |
| **합계** | | **37** | 높음 20 / 중간 11 / 낮음 6 |

### 3.2 전체 체크리스트

#### WebGL 빌드 로딩 테스트

- [ ] **TC-PLAT-001**: WebGL 빌드 정상 로드 (Unity 인스턴스 생성 확인) -- 높음
- [ ] **TC-PLAT-002**: 로딩 프로그레스 바 진행률 표시 확인 -- 높음
- [ ] **TC-PLAT-003**: 로딩 완료 시간 측정 (30초 이내 목표) -- 높음

#### 브라우저 호환성 테스트

- [ ] **TC-PLAT-004**: Chrome에서 WebGL 2.0 + WASM 정상 동작 -- 높음
- [ ] **TC-PLAT-005**: Firefox에서 WebGL 2.0 + WASM 정상 동작 -- 높음
- [ ] **TC-PLAT-006**: Safari(WebKit)에서 WebGL 2.0 + WASM 정상 동작 -- 높음
- [ ] **TC-PLAT-007**: 비호환 브라우저 감지 시 안내 페이지 표시 -- 높음

#### WebGL 메모리 사용량 테스트

- [ ] **TC-PLAT-008**: 초기 로드 후 메모리 사용량 256MB 이내 확인 -- 중간
- [ ] **TC-PLAT-009**: 장시간 플레이 시 메모리 누수 없음 확인 -- 중간

#### LocalStorage/IndexedDB 데이터 저장 테스트

- [ ] **TC-PLAT-010**: LocalStorage에 설정값(볼륨, 언어) 정상 저장 -- 높음
- [ ] **TC-PLAT-011**: IndexedDB(HexaMergeDB)에 게임 데이터 정상 저장 -- 높음
- [ ] **TC-PLAT-012**: IndexedDB 저장 데이터 AES 암호화 확인 -- 높음
- [ ] **TC-PLAT-013**: 시크릿 모드에서 IndexedDB 제한 감지 및 폴백 -- 높음

#### 데이터 저장 후 새로고침 복원 테스트

- [ ] **TC-PLAT-014**: 게임 데이터 저장 후 새로고침 시 복원 확인 -- 높음
- [ ] **TC-PLAT-015**: 설정값 저장 후 새로고침 시 복원 확인 -- 높음

#### Firebase Analytics 이벤트 전송 테스트

- [ ] **TC-PLAT-016**: Firebase 초기화 성공 및 session_start 이벤트 전송 -- 중간
- [ ] **TC-PLAT-017**: game_over 이벤트 파라미터 정확성 확인 -- 중간
- [ ] **TC-PLAT-018**: GDPR 비동의 시 Analytics 이벤트 수집 중단 확인 -- 중간

#### PWA 관련 테스트

- [ ] **TC-PLAT-019**: manifest.json 유효성 및 필수 필드 확인 -- 낮음
- [ ] **TC-PLAT-020**: Service Worker 등록 및 정적 리소스 캐시 확인 -- 낮음
- [ ] **TC-PLAT-021**: PWA 아이콘(192x192, 512x512) 존재 및 접근 가능 확인 -- 낮음

#### SEO 메타 태그 테스트

- [ ] **TC-PLAT-022**: 기본 메타 태그(title, description, viewport) 확인 -- 낮음
- [ ] **TC-PLAT-023**: Open Graph / Twitter Card 메타 태그 확인 -- 낮음
- [ ] **TC-PLAT-024**: JSON-LD 구조화 데이터 및 robots.txt 확인 -- 낮음

#### 보안 테스트

- [ ] **TC-PLAT-025**: HTTPS 프로토콜 적용 확인 (스테이징 환경) -- 높음
- [ ] **TC-PLAT-026**: Content-Security-Policy 헤더 설정 확인 -- 높음
- [ ] **TC-PLAT-027**: 브라우저 콘솔에 심각한 에러 없음 확인 -- 높음
- [ ] **TC-PLAT-028**: CORS 및 X-Frame-Options 헤더 확인 -- 높음

#### 성능 테스트

- [ ] **TC-PLAT-029**: 초기 로드 전송 크기 10MB 이하 확인 -- 중간
- [ ] **TC-PLAT-030**: 게임 실행 중 FPS 30 이상 유지 확인 -- 중간
- [ ] **TC-PLAT-031**: Brotli 압축 적용 및 Content-Encoding 헤더 확인 -- 중간

#### 네트워크 단절/복구 테스트

- [ ] **TC-PLAT-032**: 네트워크 단절 시 오프라인 감지 및 UI 반영 -- 높음
- [ ] **TC-PLAT-033**: 네트워크 복구 시 자동 재연결 및 데이터 동기화 -- 높음
- [ ] **TC-PLAT-034**: 네트워크 단절 중 로컬 데이터 저장 정상 동작 -- 높음

#### Crashlytics 에러 리포팅 테스트

- [ ] **TC-PLAT-035**: window.onerror 핸들러를 통한 에러 캡처 확인 -- 중간
- [ ] **TC-PLAT-036**: 비치명적 오류(Non-fatal) 로깅 확인 -- 중간
- [ ] **TC-PLAT-037**: 커스텀 키(last_screen, game_score) 설정 확인 -- 중간

---

## 4. 테스트 케이스 상세

### 4.1 WebGL 빌드 로딩 테스트

#### TC-PLAT-001: WebGL 빌드 정상 로드

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-001 |
| **목적** | Unity WebGL 빌드가 브라우저에서 정상적으로 로드되고 Unity 인스턴스가 생성되는지 확인한다 |
| **사전조건** | WebGL 빌드가 로컬 서버(localhost:8080)에 배포됨 |
| **단계** | 1. 브라우저에서 게임 URL로 이동한다 2. `#unity-canvas` 요소가 DOM에 존재하는지 확인한다 3. `createUnityInstance()`가 완료될 때까지 대기한다 4. `window.unityInstance` 객체가 존재하는지 확인한다 5. 로딩 바(`#unity-loading-bar`)가 사라지는지 확인한다 |
| **기대결과** | Unity 인스턴스가 정상 생성되고, 캔버스에 게임 화면이 렌더링되며, 로딩 바가 숨겨진다 |
| **우선순위** | 높음 |

#### TC-PLAT-002: 로딩 프로그레스 바 진행률 표시 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-002 |
| **목적** | WebGL 빌드 로딩 중 프로그레스 바가 0%에서 100%까지 점진적으로 증가하는지 확인한다 |
| **사전조건** | WebGL 빌드가 로컬 서버에 배포됨 |
| **단계** | 1. 브라우저에서 게임 URL로 이동한다 2. `#unity-progress-bar-full` 요소의 `width` 스타일 값을 주기적으로 측정한다 3. 프로그레스 값이 단조 증가(monotonically increasing)하는지 확인한다 4. 최종 값이 100%에 도달하는지 확인한다 |
| **기대결과** | 프로그레스 바가 0%에서 시작하여 100%까지 점진적으로 증가하며, 중간에 감소하지 않는다 |
| **우선순위** | 높음 |

#### TC-PLAT-003: 로딩 완료 시간 측정

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-003 |
| **목적** | WebGL 빌드의 초기 로딩이 목표 시간(30초) 이내에 완료되는지 측정한다 |
| **사전조건** | WebGL 빌드가 배포됨, 네트워크 상태 안정적 |
| **단계** | 1. Performance API를 활용하여 navigation 시작 시간을 기록한다 2. 게임 URL로 이동한다 3. Unity 인스턴스 생성 완료 시점의 타임스탬프를 기록한다 4. 로딩 소요 시간 = 완료 시간 - 시작 시간을 계산한다 5. 30초 이내인지 검증한다 |
| **기대결과** | 로딩 완료 시간이 30초 이내이다 (로컬 환경 기준, CDN 환경에서는 15초 이내 목표) |
| **우선순위** | 높음 |

### 4.2 브라우저 호환성 테스트

#### TC-PLAT-004: Chrome에서 WebGL 2.0 + WASM 정상 동작

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-004 |
| **목적** | Chromium 브라우저에서 WebGL 2.0과 WebAssembly가 정상 지원되어 게임이 동작하는지 확인한다 |
| **사전조건** | Chromium 프로젝트 설정 사용 |
| **단계** | 1. Chromium 브라우저에서 게임 URL로 이동한다 2. `page.evaluate()`로 WebGL 2.0 컨텍스트 생성 가능 여부를 확인한다 3. WebAssembly 지원 여부를 확인한다 4. Unity 인스턴스가 정상 생성되는지 확인한다 5. 게임 캔버스에 렌더링이 정상 수행되는지 스크린샷으로 확인한다 |
| **기대결과** | WebGL 2.0 컨텍스트 생성 성공, WebAssembly 지원 확인, 게임 정상 렌더링 |
| **우선순위** | 높음 |

#### TC-PLAT-005: Firefox에서 WebGL 2.0 + WASM 정상 동작

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-005 |
| **목적** | Firefox 브라우저에서 WebGL 2.0과 WebAssembly가 정상 지원되어 게임이 동작하는지 확인한다 |
| **사전조건** | Firefox 프로젝트 설정 사용 |
| **단계** | 1. Firefox 브라우저에서 게임 URL로 이동한다 2. WebGL 2.0 컨텍스트 및 WebAssembly 지원 확인 3. Unity 인스턴스 정상 생성 확인 4. 게임 캔버스 렌더링 정상 확인 |
| **기대결과** | Firefox에서 게임이 정상적으로 로드되고 렌더링된다 |
| **우선순위** | 높음 |

#### TC-PLAT-006: Safari(WebKit)에서 WebGL 2.0 + WASM 정상 동작

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-006 |
| **목적** | WebKit(Safari) 브라우저에서 WebGL 2.0과 WebAssembly가 정상 지원되어 게임이 동작하는지 확인한다 |
| **사전조건** | WebKit 프로젝트 설정 사용 |
| **단계** | 1. WebKit 브라우저에서 게임 URL로 이동한다 2. WebGL 2.0 컨텍스트 및 WebAssembly 지원 확인 3. Unity 인스턴스 정상 생성 확인 4. Safari ITP(Intelligent Tracking Prevention) 환경에서 IndexedDB 접근 가능 여부 확인 |
| **기대결과** | WebKit에서 게임이 정상적으로 로드되며, ITP 환경에서도 기본 동작에 문제 없음 |
| **우선순위** | 높음 |

#### TC-PLAT-007: 비호환 브라우저 감지 시 안내 페이지 표시

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-007 |
| **목적** | WebGL 2.0 또는 WebAssembly를 지원하지 않는 브라우저 접속 시 호환성 안내 메시지가 표시되는지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 |
| **단계** | 1. `page.evaluate()`로 `WebAssembly` 객체를 임시 제거한다 2. 게임 페이지를 로드한다 3. 호환성 안내 메시지가 표시되는지 확인한다 4. Chrome/Firefox 다운로드 링크가 포함되어 있는지 확인한다 |
| **기대결과** | "이 브라우저는 지원되지 않습니다" 메시지와 Chrome/Firefox 다운로드 링크가 표시된다 |
| **우선순위** | 높음 |

### 4.3 WebGL 메모리 사용량 테스트

#### TC-PLAT-008: 초기 로드 후 메모리 사용량 256MB 이내 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-008 |
| **목적** | WebGL 빌드 초기 로드 후 메모리 사용량이 설계 기준(256MB) 이내인지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료 |
| **단계** | 1. 게임을 완전히 로드한다 2. `performance.measureUserAgentSpecificMemory()` 또는 `performance.memory` API를 호출한다 3. Unity 브릿지의 `getMemoryUsageMB()`로 Unity 내부 메모리 사용량도 확인한다 4. 총 메모리가 256MB를 초과하지 않는지 검증한다 |
| **기대결과** | 메모리 사용량이 256MB 이내이다 |
| **우선순위** | 중간 |

#### TC-PLAT-009: 장시간 플레이 시 메모리 누수 없음 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-009 |
| **목적** | 반복적인 게임 플레이 후 메모리가 지속적으로 증가하지 않는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료 |
| **단계** | 1. 초기 메모리 사용량을 측정한다 2. 게임 시작 -> 게임 오버 -> 재시작을 10회 반복한다 3. 매 사이클마다 메모리 사용량을 기록한다 4. 마지막 측정값이 초기 대비 50MB 이상 증가하지 않는지 검증한다 |
| **기대결과** | 10회 반복 후 메모리 증가량이 50MB 이내이다 (일시적 증가 후 GC로 회수) |
| **우선순위** | 중간 |

### 4.4 LocalStorage/IndexedDB 데이터 저장 테스트

#### TC-PLAT-010: LocalStorage에 설정값 정상 저장

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-010 |
| **목적** | 음악 볼륨, 효과음 볼륨, 언어 등 설정값이 LocalStorage에 `hexa_` 접두어로 저장되는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료, LocalStorage 비어있음 |
| **단계** | 1. `localStorage.clear()`로 기존 데이터 삭제 2. 게임 내에서 음악 볼륨을 0.5로 변경한다 3. `localStorage.getItem('hexa_musicVolume')`으로 값을 확인한다 4. 언어를 'en'으로 변경 후 `localStorage.getItem('hexa_language')` 확인 |
| **기대결과** | `hexa_musicVolume`에 `0.5`, `hexa_language`에 `en` 값이 저장된다 |
| **우선순위** | 높음 |

#### TC-PLAT-011: IndexedDB에 게임 데이터 정상 저장

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-011 |
| **목적** | 게임 진행 데이터(점수, 코인, 힌트 등)가 IndexedDB의 HexaMergeDB에 저장되는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료 |
| **단계** | 1. 게임 플레이로 점수/코인 데이터를 생성한다 2. `SendMessage('SaveManager', 'ForceSave', '')`로 즉시 저장을 실행한다 3. `page.evaluate()`로 IndexedDB의 HexaMergeDB -> GameData 스토어에서 'saveData' 키의 값을 조회한다 4. 값이 존재하고, 비어있지 않은지 확인한다 |
| **기대결과** | IndexedDB에 `saveData` 키로 암호화된 JSON 문자열이 저장된다 |
| **우선순위** | 높음 |

#### TC-PLAT-012: IndexedDB 저장 데이터 AES 암호화 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-012 |
| **목적** | IndexedDB에 저장된 게임 데이터가 평문이 아닌 AES 암호화 형태인지 확인한다 |
| **사전조건** | TC-PLAT-011 완료 (데이터 저장됨) |
| **단계** | 1. IndexedDB에서 `saveData` 값을 읽는다 2. 값이 Base64 인코딩 형식인지 확인한다 3. 값을 JSON.parse()로 파싱 시도 -- 실패해야 한다 (암호화되어 있으므로) 4. 값에 `highScore`, `coins` 등의 평문 키가 포함되지 않는지 확인한다 |
| **기대결과** | 저장된 데이터가 Base64 인코딩 형태이며, 평문 JSON으로 파싱 불가하고, 게임 데이터 키가 평문으로 노출되지 않는다 |
| **우선순위** | 높음 |

#### TC-PLAT-013: 시크릿 모드에서 IndexedDB 제한 감지 및 폴백

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-013 |
| **목적** | IndexedDB가 비활성화된 환경(시크릿 모드 시뮬레이션)에서 폴백 처리가 정상 동작하는지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 |
| **단계** | 1. `page.evaluate()`로 `indexedDB.open`을 에러를 반환하도록 오버라이드한다 2. 게임을 로드한다 3. 게임이 크래시 없이 정상 동작하는지 확인한다 4. 저장 기능이 폴백(LocalStorage 등)으로 전환되었는지 확인한다 |
| **기대결과** | IndexedDB 비활성 시에도 게임이 크래시하지 않으며, 대체 저장 메커니즘으로 동작한다 |
| **우선순위** | 높음 |

### 4.5 데이터 저장 후 새로고침 복원 테스트

#### TC-PLAT-014: 게임 데이터 저장 후 새로고침 시 복원 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-014 |
| **목적** | 게임 데이터(최고 점수, 코인, 힌트)를 저장한 후 페이지 새로고침 시 데이터가 복원되는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료 |
| **단계** | 1. 테스트 데이터를 주입한다: 최고 점수 5000, 코인 1000, 힌트 5 2. `SendMessage('SaveManager', 'ForceSave', '')`로 저장한다 3. `page.reload()`로 페이지를 새로고침한다 4. Unity 인스턴스 로드 완료까지 대기한다 5. `window.gamebridge.getHighScore()` == 5000 확인 6. `window.gamebridge.getPlayerCoins()` == 1000 확인 7. `window.gamebridge.getPlayerHints()` == 5 확인 |
| **기대결과** | 새로고침 후 저장된 최고 점수, 코인, 힌트가 정확히 복원된다 |
| **우선순위** | 높음 |

#### TC-PLAT-015: 설정값 저장 후 새로고침 시 복원 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-015 |
| **목적** | 설정값(볼륨, 언어, 테마)이 새로고침 후에도 유지되는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료 |
| **단계** | 1. 음악 볼륨 0.3, 효과음 볼륨 0.7, 언어 'en'으로 설정 변경 2. 페이지 새로고침 3. LocalStorage에서 `hexa_musicVolume`, `hexa_sfxVolume`, `hexa_language` 값 확인 4. 게임 내 실제 적용 값이 설정 변경 후 값과 일치하는지 확인 |
| **기대결과** | 새로고침 후 설정값이 정확히 복원되어 게임에 적용된다 |
| **우선순위** | 높음 |

### 4.6 Firebase Analytics 이벤트 전송 테스트

#### TC-PLAT-016: Firebase 초기화 성공 및 session_start 이벤트 전송

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-016 |
| **목적** | 게임 시작 시 Firebase가 정상 초기화되고 session_start 이벤트가 전송되는지 확인한다 |
| **사전조건** | WebGL 빌드에 Firebase JS SDK 포함, 테스트 모드 활성화 |
| **단계** | 1. 게임을 로드한다 2. `window.gamebridge.isFirebaseInitialized()`가 `true`인지 확인한다 3. Firebase Analytics API 호출을 네트워크 요청으로 가로챈다 (`page.route('**/collect*')`) 4. 가로챈 요청에 `session_start` 이벤트가 포함되어 있는지 확인한다 5. 이벤트 파라미터에 `platform`, `version`이 포함되는지 확인한다 |
| **기대결과** | Firebase 초기화 성공, session_start 이벤트가 platform/version 파라미터와 함께 전송된다 |
| **우선순위** | 중간 |

#### TC-PLAT-017: game_over 이벤트 파라미터 정확성 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-017 |
| **목적** | 게임 오버 시 game_over 이벤트가 올바른 파라미터(score, max_number, duration_sec, total_merges)로 전송되는지 확인한다 |
| **사전조건** | Firebase 테스트 모드 활성화 |
| **단계** | 1. 게임을 로드하고 테스트 모드를 활성화한다 2. `SendMessage('GameManager', 'SimulateGameOver', '1234')`로 게임 오버를 시뮬레이션한다 3. `window.gamebridge.getAnalyticsEvents()`에서 `game_over` 이벤트를 찾는다 4. 이벤트 파라미터에 `score`=1234, `max_number`, `duration_sec`, `total_merges`가 포함되는지 확인한다 |
| **기대결과** | game_over 이벤트가 설계문서 정의대로 4개 파라미터와 함께 기록된다 |
| **우선순위** | 중간 |

#### TC-PLAT-018: GDPR 비동의 시 Analytics 이벤트 수집 중단 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-018 |
| **목적** | GDPR 동의를 거부한 경우 Firebase Analytics 이벤트가 수집되지 않는지 확인한다 |
| **사전조건** | GDPR 동의 UI 구현됨, 테스트 모드 활성화 |
| **단계** | 1. GDPR 동의 상태를 초기화한다 2. 게임 로드 후 GDPR 동의 팝업에서 '거부'를 선택한다 3. 게임 플레이 후 게임 오버를 발생시킨다 4. `window.gamebridge.getAnalyticsEvents()`에서 이벤트 수가 0인지 확인한다 5. Firebase Analytics 네트워크 요청이 발생하지 않는지 확인한다 |
| **기대결과** | GDPR 비동의 시 Analytics 이벤트가 수집되지 않고, 네트워크 요청도 발생하지 않는다 |
| **우선순위** | 중간 |

### 4.7 PWA 관련 테스트

#### TC-PLAT-019: manifest.json 유효성 및 필수 필드 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-019 |
| **목적** | PWA manifest.json 파일이 유효하고 필수 필드가 올바르게 설정되어 있는지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 |
| **단계** | 1. `/manifest.json` URL에 GET 요청을 보낸다 2. 응답이 200이고 유효한 JSON인지 확인한다 3. `name`="Hexa Merge Basic", `short_name`="HexaMerge" 확인 4. `display`="standalone", `orientation`="portrait" 확인 5. `theme_color`="#4A90D9", `background_color`="#1A1A2E" 확인 6. `icons` 배열에 192x192, 512x512 아이콘이 포함되어 있는지 확인한다 |
| **기대결과** | manifest.json이 유효하며, 설계문서에 정의된 모든 필수 필드가 올바른 값으로 존재한다 |
| **우선순위** | 낮음 |

#### TC-PLAT-020: Service Worker 등록 및 정적 리소스 캐시 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-020 |
| **목적** | Service Worker가 정상 등록되고 정적 리소스가 캐시되는지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 (HTTPS 또는 localhost) |
| **단계** | 1. 게임 페이지를 로드한다 2. `navigator.serviceWorker.ready`가 resolve되는지 확인한다 3. `caches.keys()`로 'hexa-merge-v1' 캐시가 생성되었는지 확인한다 4. 캐시에 `index.html`, `style.css` 등 정적 리소스가 포함되어 있는지 확인한다 |
| **기대결과** | Service Worker 등록 성공, 'hexa-merge-v1' 캐시에 정적 리소스가 저장된다 |
| **우선순위** | 낮음 |

#### TC-PLAT-021: PWA 아이콘 존재 및 접근 가능 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-021 |
| **목적** | PWA 설치에 필요한 아이콘 파일이 서버에 존재하고 접근 가능한지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 |
| **단계** | 1. `/icons/icon-192.png`에 GET 요청 -> 200 확인 2. `/icons/icon-512.png`에 GET 요청 -> 200 확인 3. 각 이미지의 Content-Type이 `image/png`인지 확인한다 |
| **기대결과** | 192x192, 512x512 PNG 아이콘이 모두 접근 가능하다 |
| **우선순위** | 낮음 |

### 4.8 SEO 메타 태그 테스트

#### TC-PLAT-022: 기본 메타 태그 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-022 |
| **목적** | HTML 페이지에 기본 SEO 메타 태그(title, description, viewport)가 올바르게 설정되어 있는지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 |
| **단계** | 1. 게임 페이지를 로드한다 2. `<title>` 태그에 "Hexa Merge Basic" 문자열이 포함되어 있는지 확인한다 3. `<meta name="description">`의 content 값이 비어있지 않은지 확인한다 4. `<meta name="viewport">`의 content에 `width=device-width`가 포함되어 있는지 확인한다 5. `<meta charset="utf-8">`이 존재하는지 확인한다 |
| **기대결과** | title, description, viewport, charset 메타 태그가 모두 올바르게 설정되어 있다 |
| **우선순위** | 낮음 |

#### TC-PLAT-023: Open Graph / Twitter Card 메타 태그 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-023 |
| **목적** | 소셜 미디어 공유를 위한 Open Graph 및 Twitter Card 메타 태그가 설정되어 있는지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 |
| **단계** | 1. 게임 페이지를 로드한다 2. `og:title`, `og:description`, `og:image`, `og:url`, `og:type` 메타 태그 존재 확인 3. `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` 메타 태그 존재 확인 4. `og:image`와 `twitter:image` URL이 유효한지(200 응답) 확인한다 |
| **기대결과** | OG 태그 5종, Twitter Card 태그 4종이 모두 존재하며, 이미지 URL이 유효하다 |
| **우선순위** | 낮음 |

#### TC-PLAT-024: JSON-LD 구조화 데이터 및 robots.txt 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-024 |
| **목적** | JSON-LD 구조화 데이터와 robots.txt가 올바르게 설정되어 있는지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 |
| **단계** | 1. 게임 페이지에서 `<script type="application/ld+json">` 태그를 찾는다 2. JSON-LD 내용이 유효한 JSON이고 `@type`="VideoGame"인지 확인한다 3. `/robots.txt`에 GET 요청을 보내 200 응답인지 확인한다 4. robots.txt에 `Disallow: /Build/`가 포함되어 있는지 확인한다 |
| **기대결과** | JSON-LD에 VideoGame 타입의 구조화 데이터가 존재하고, robots.txt에서 Build 폴더 크롤링이 차단된다 |
| **우선순위** | 낮음 |

### 4.9 보안 테스트

#### TC-PLAT-025: HTTPS 프로토콜 적용 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-025 |
| **목적** | 스테이징/프로덕션 환경에서 HTTPS가 적용되어 있는지 확인한다 |
| **사전조건** | 스테이징 서버에 SSL 인증서 적용됨 (로컬 테스트 시 skip 가능) |
| **단계** | 1. 스테이징 URL로 이동한다 2. `page.url()`이 `https://`로 시작하는지 확인한다 3. HTTP로 접속 시도 시 HTTPS로 리다이렉트되는지 확인한다 4. SSL 인증서 경고 없이 페이지가 로드되는지 확인한다 |
| **기대결과** | 모든 통신이 HTTPS로 이루어지며, HTTP 접속 시 HTTPS로 자동 리다이렉트된다 |
| **우선순위** | 높음 |

#### TC-PLAT-026: Content-Security-Policy 헤더 설정 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-026 |
| **목적** | CSP 헤더가 설계문서에 정의된 정책대로 설정되어 있는지 확인한다 |
| **사전조건** | 서버에 CSP 헤더 설정됨 |
| **단계** | 1. 게임 페이지를 로드한다 2. 응답 헤더에서 `Content-Security-Policy` 값을 추출한다 3. `default-src 'self'`가 포함되어 있는지 확인한다 4. `script-src`에 `'self'`, `'unsafe-inline'`, `'unsafe-eval'` (WebGL 필수)이 포함되어 있는지 확인한다 5. `connect-src`에 Firebase 도메인(`*.firebaseio.com`, `*.googleapis.com`)이 허용되어 있는지 확인한다 |
| **기대결과** | CSP 헤더가 존재하며, WebGL 실행과 Firebase 연동에 필요한 정책이 올바르게 설정되어 있다 |
| **우선순위** | 높음 |

#### TC-PLAT-027: 브라우저 콘솔에 심각한 에러 없음 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-027 |
| **목적** | 게임 로드 및 기본 동작 중 브라우저 콘솔에 심각한(error 레벨) 에러가 발생하지 않는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료 |
| **단계** | 1. `page.on('console')`으로 콘솔 메시지를 수집한다 2. `page.on('pageerror')`로 미처리 예외를 수집한다 3. 게임을 로드하고 30초간 기본 동작을 수행한다 4. 수집된 메시지 중 `error` 타입의 개수를 확인한다 5. CSP 위반, 404 리소스 로드 실패, 미처리 예외가 없는지 확인한다 |
| **기대결과** | 심각한 콘솔 에러 0건, 미처리 예외 0건 (경고 수준은 허용) |
| **우선순위** | 높음 |

#### TC-PLAT-028: CORS 및 보안 헤더 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-028 |
| **목적** | CORS 설정과 기타 보안 관련 HTTP 헤더가 올바르게 적용되어 있는지 확인한다 |
| **사전조건** | 서버에 보안 헤더 설정됨 |
| **단계** | 1. 게임 HTML 페이지의 응답 헤더를 확인한다 2. `.wasm` 파일 응답의 `Content-Type`이 `application/wasm`인지 확인한다 3. 정적 에셋 응답에 적절한 `Cache-Control` 헤더가 설정되어 있는지 확인한다 4. HTML 응답의 `Cache-Control`이 `no-cache`인지 확인한다 |
| **기대결과** | WASM MIME 타입, 캐시 정책, 보안 헤더가 설계문서대로 설정되어 있다 |
| **우선순위** | 높음 |

### 4.10 성능 테스트

#### TC-PLAT-029: 초기 로드 전송 크기 10MB 이하 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-029 |
| **목적** | 초기 페이지 로드 시 전송되는 총 데이터 크기가 10MB(압축 후) 이하인지 확인한다 |
| **사전조건** | WebGL 빌드 배포됨 |
| **단계** | 1. `page.on('response')`로 모든 응답의 전송 크기를 누적한다 2. 게임 페이지를 로드한다 3. Unity 인스턴스 생성 완료까지 대기한다 4. 총 전송 크기를 합산한다 5. 10MB(10,485,760 bytes)를 초과하지 않는지 검증한다 |
| **기대결과** | 초기 로드 전송 크기가 10MB(압축 후) 이하이다 |
| **우선순위** | 중간 |

#### TC-PLAT-030: 게임 실행 중 FPS 30 이상 유지 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-030 |
| **목적** | 게임 플레이 중 FPS가 안정적으로 30 이상을 유지하는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료 |
| **단계** | 1. 게임을 시작한다 2. 10초 동안 0.5초 간격으로 `window.gamebridge.getFPS()`를 호출하여 FPS를 측정한다 3. 측정값의 평균을 계산한다 4. 측정값 중 최소값을 확인한다 5. 평균 FPS가 30 이상이고, 최소 FPS가 20 이상인지 검증한다 |
| **기대결과** | 평균 FPS 30 이상, 최소 FPS 20 이상 |
| **우선순위** | 중간 |

#### TC-PLAT-031: Brotli 압축 적용 및 Content-Encoding 헤더 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-031 |
| **목적** | WebGL 빌드 파일(.wasm, .data, .js)에 Brotli 압축이 적용되고 올바른 Content-Encoding 헤더가 반환되는지 확인한다 |
| **사전조건** | 서버에 Brotli Content-Encoding 헤더 설정됨 |
| **단계** | 1. `page.on('response')`로 `.wasm.br`, `.data.br`, `.js.br` 파일 응답을 가로챈다 2. 각 응답의 `Content-Encoding` 헤더가 `br`인지 확인한다 3. 각 응답의 `Content-Type`이 올바른지 확인한다 (wasm -> `application/wasm`, js -> `application/javascript`) 4. `Cache-Control`에 `immutable`이 포함되어 있는지 확인한다 |
| **기대결과** | Brotli 압축 파일에 `Content-Encoding: br` 헤더가 설정되고, 올바른 MIME 타입과 캐시 정책이 적용된다 |
| **우선순위** | 중간 |

### 4.11 네트워크 단절/복구 테스트

#### TC-PLAT-032: 네트워크 단절 시 오프라인 감지 및 UI 반영

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-032 |
| **목적** | 네트워크가 단절되었을 때 게임이 오프라인 상태를 감지하고 UI에 반영하는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료, 게임 정상 동작 중 |
| **단계** | 1. 게임을 정상적으로 로드한다 2. `context.setOffline(true)`로 네트워크를 단절한다 3. 3초간 대기한다 4. 오프라인 상태 표시(토스트/아이콘)가 나타나는지 확인한다 5. 광고 버튼이 숨겨지거나 비활성화되는지 확인한다 |
| **기대결과** | 오프라인 감지 후 UI에 "오프라인 상태" 표시, 광고 버튼 숨김/비활성화 |
| **우선순위** | 높음 |

#### TC-PLAT-033: 네트워크 복구 시 자동 재연결 및 데이터 동기화

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-033 |
| **목적** | 네트워크가 복구되었을 때 자동으로 재연결하고 오프라인 중 변경된 데이터를 동기화하는지 확인한다 |
| **사전조건** | TC-PLAT-032 완료 (오프라인 상태) |
| **단계** | 1. 오프라인 상태에서 게임을 플레이하여 점수를 획득한다 2. `context.setOffline(false)`로 네트워크를 복구한다 3. 5초간 대기한다 4. 오프라인 상태 표시가 사라지는지 확인한다 5. 광고 버튼이 재활성화되는지 확인한다 6. Firebase 또는 클라우드 저장 요청이 발생하는지 네트워크 요청을 확인한다 |
| **기대결과** | 네트워크 복구 시 오프라인 표시 제거, 광고 버튼 재활성화, 데이터 동기화 요청 발생 |
| **우선순위** | 높음 |

#### TC-PLAT-034: 네트워크 단절 중 로컬 데이터 저장 정상 동작

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-034 |
| **목적** | 네트워크가 단절된 상태에서도 로컬 데이터 저장(IndexedDB/LocalStorage)이 정상 동작하는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료 |
| **단계** | 1. `context.setOffline(true)`로 네트워크를 단절한다 2. 게임을 플레이하여 점수/코인 데이터를 생성한다 3. `SendMessage('SaveManager', 'ForceSave', '')`로 저장한다 4. IndexedDB에서 데이터가 정상 저장되었는지 확인한다 5. 페이지를 새로고침한다 (오프라인 상태에서 Service Worker 캐시로 로드) 6. 저장된 데이터가 복원되는지 확인한다 |
| **기대결과** | 오프라인 상태에서도 로컬 저장이 정상 동작하고, 새로고침 후 데이터가 복원된다 |
| **우선순위** | 높음 |

### 4.12 Crashlytics 에러 리포팅 테스트

#### TC-PLAT-035: window.onerror 핸들러를 통한 에러 캡처 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-035 |
| **목적** | WebGL 환경에서 `window.onerror` 핸들러가 등록되어 JavaScript 에러를 캡처하는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료, 에러 리포팅 시스템 초기화됨 |
| **단계** | 1. `page.evaluate()`로 `window.onerror`가 함수로 등록되어 있는지 확인한다 2. 의도적으로 JavaScript 에러를 발생시킨다: `page.evaluate(() => { throw new Error('Test Error'); })` 3. 에러 리포팅 API 호출(Firebase Functions)이 발생하는지 네트워크 요청을 가로채어 확인한다 4. 요청 본문에 에러 메시지, 스택 트레이스, URL 정보가 포함되어 있는지 확인한다 |
| **기대결과** | window.onerror가 등록되어 있고, 에러 발생 시 리포팅 API가 호출된다 |
| **우선순위** | 중간 |

#### TC-PLAT-036: 비치명적 오류(Non-fatal) 로깅 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-036 |
| **목적** | 광고 로드 실패, 클라우드 동기화 실패 등 비치명적 오류가 정상적으로 로깅되는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료, 테스트 모드 활성화 |
| **단계** | 1. `SendMessage('CrashlyticsService', 'SimulateError', 'AdLoadFailed')`로 비치명적 오류를 시뮬레이션한다 2. 에러 리포팅 네트워크 요청이 발생하는지 확인한다 3. 요청에 `error_context`="AdLoadFailed"가 포함되어 있는지 확인한다 4. 게임이 크래시하지 않고 정상 동작을 계속하는지 확인한다 |
| **기대결과** | 비치명적 오류가 로깅되고, 게임은 중단 없이 계속 동작한다 |
| **우선순위** | 중간 |

#### TC-PLAT-037: 커스텀 키(last_screen, game_score) 설정 확인

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-PLAT-037 |
| **목적** | Crashlytics 커스텀 키(last_screen, game_score, memory_usage)가 게임 상태 변경 시 올바르게 업데이트되는지 확인한다 |
| **사전조건** | WebGL 빌드 로드 완료, 테스트 모드 활성화 |
| **단계** | 1. 게임을 로드하고 메인 메뉴에 진입한다 2. 테스트 브릿지를 통해 현재 커스텀 키 값을 조회한다 3. `last_screen`이 "MainMenu"인지 확인한다 4. 게임을 시작하고 점수 1000을 달성한다 5. `last_screen`이 "GamePlay", `game_score`가 "1000"으로 업데이트되었는지 확인한다 6. `memory_usage` 키가 설정되어 있는지 확인한다 |
| **기대결과** | 화면 전환 및 점수 변화 시 커스텀 키가 실시간으로 업데이트된다 |
| **우선순위** | 중간 |

---

## 5. Playwright TypeScript 코드 예제

### 5.1 공통 픽스처 (platform.fixture.ts)

```typescript
import { test as base, expect, Page } from '@playwright/test';

/** Unity WebGL 인스턴스 로드 완료까지 대기하는 헬퍼 */
async function waitForUnityLoad(page: Page, timeoutMs = 120_000): Promise<void> {
  await page.waitForFunction(
    () => (window as any).unityInstance !== undefined,
    { timeout: timeoutMs }
  );
  // 로딩 바가 사라질 때까지 대기
  await page.waitForSelector('#unity-loading-bar', {
    state: 'hidden',
    timeout: timeoutMs,
  });
}

/** Unity에 SendMessage를 보내는 헬퍼 */
async function sendToUnity(
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

/** gamebridge를 통해 값을 조회하는 헬퍼 */
async function queryBridge<T>(page: Page, methodName: string): Promise<T> {
  return await page.evaluate((method) => {
    return (window as any).gamebridge[method]();
  }, methodName);
}

// 확장 픽스처
export const test = base.extend<{
  unityPage: Page;
}>({
  unityPage: async ({ page }, use) => {
    await page.goto('/');
    await waitForUnityLoad(page);
    await use(page);
  },
});

export { expect, waitForUnityLoad, sendToUnity, queryBridge };
```

### 5.2 WebGL 로딩 테스트 (webgl-loading.spec.ts)

```typescript
import { test, expect } from '@playwright/test';
import { waitForUnityLoad } from './fixtures/platform.fixture';

test.describe('WebGL 빌드 로딩 테스트', () => {

  // TC-PLAT-001: WebGL 빌드 정상 로드
  test('TC-PLAT-001: Unity 인스턴스가 정상 생성된다', async ({ page }) => {
    await page.goto('/');

    // unity-canvas 요소 존재 확인
    const canvas = page.locator('#unity-canvas');
    await expect(canvas).toBeVisible();

    // Unity 인스턴스 생성 대기
    await waitForUnityLoad(page);

    // unityInstance 객체 존재 확인
    const hasInstance = await page.evaluate(
      () => (window as any).unityInstance !== undefined
    );
    expect(hasInstance).toBe(true);

    // 로딩 바 숨김 확인
    const loadingBar = page.locator('#unity-loading-bar');
    await expect(loadingBar).toBeHidden();
  });

  // TC-PLAT-002: 로딩 프로그레스 바 진행률 확인
  test('TC-PLAT-002: 프로그레스 바가 0%에서 100%까지 증가한다', async ({ page }) => {
    const progressValues: number[] = [];

    // 프로그레스 바 관찰 시작
    await page.goto('/');

    // 주기적으로 프로그레스 값 수집
    const collectProgress = async () => {
      while (true) {
        const width = await page.evaluate(() => {
          const bar = document.getElementById('unity-progress-bar-full');
          return bar ? parseFloat(bar.style.width) || 0 : -1;
        });
        if (width === -1) break; // 로딩 바가 사라짐
        progressValues.push(width);
        await page.waitForTimeout(200);
        // 로딩 완료 체크
        const hidden = await page.evaluate(() => {
          const bar = document.getElementById('unity-loading-bar');
          return bar?.style.display === 'none';
        });
        if (hidden) break;
      }
    };

    await collectProgress();

    // 최소 2개 이상의 측정값 존재
    expect(progressValues.length).toBeGreaterThan(1);

    // 단조 증가 확인
    for (let i = 1; i < progressValues.length; i++) {
      expect(progressValues[i]).toBeGreaterThanOrEqual(progressValues[i - 1]);
    }

    // 마지막 값이 100에 근접
    expect(progressValues[progressValues.length - 1]).toBeGreaterThanOrEqual(95);
  });

  // TC-PLAT-003: 로딩 완료 시간 30초 이내
  test('TC-PLAT-003: 로딩이 30초 이내에 완료된다', async ({ page }) => {
    const startTime = Date.now();

    await page.goto('/');
    await waitForUnityLoad(page, 30_000);

    const loadTime = Date.now() - startTime;
    console.log(`WebGL 로딩 시간: ${loadTime}ms`);

    expect(loadTime).toBeLessThan(30_000);
  });
});
```

### 5.3 브라우저 호환성 테스트 (browser-compat.spec.ts)

```typescript
import { test, expect } from '@playwright/test';
import { waitForUnityLoad } from './fixtures/platform.fixture';

test.describe('브라우저 호환성 테스트', () => {

  // TC-PLAT-004 ~ 006: 각 브라우저에서 WebGL 2.0 + WASM 동작 확인
  // (Playwright 프로젝트 설정으로 Chromium/Firefox/WebKit에서 각각 실행됨)
  test('TC-PLAT-004~006: WebGL 2.0 + WASM 지원 확인', async ({ page }) => {
    // WebGL 2.0 지원 확인
    const hasWebGL2 = await page.evaluate(() => {
      try {
        const canvas = document.createElement('canvas');
        return !!canvas.getContext('webgl2');
      } catch { return false; }
    });
    expect(hasWebGL2).toBe(true);

    // WebAssembly 지원 확인
    const hasWasm = await page.evaluate(
      () => typeof WebAssembly === 'object'
    );
    expect(hasWasm).toBe(true);

    // Unity 게임 정상 로드 확인
    await page.goto('/');
    await waitForUnityLoad(page);

    const hasInstance = await page.evaluate(
      () => (window as any).unityInstance !== undefined
    );
    expect(hasInstance).toBe(true);
  });

  // TC-PLAT-007: 비호환 브라우저 안내 페이지
  test('TC-PLAT-007: WebAssembly 미지원 시 안내 메시지 표시', async ({ page }) => {
    // WebAssembly를 제거한 상태로 페이지 로드
    await page.addInitScript(() => {
      Object.defineProperty(window, 'WebAssembly', {
        value: undefined,
        writable: false,
      });
    });

    await page.goto('/');
    await page.waitForTimeout(3000);

    // 안내 메시지 존재 확인
    const content = await page.textContent('#unity-loading-bar');
    expect(content).toContain('지원되지 않습니다');

    // Chrome/Firefox 링크 존재 확인
    const chromeLink = page.locator('a[href*="google.com/chrome"]');
    const firefoxLink = page.locator('a[href*="mozilla.org/firefox"]');
    await expect(chromeLink).toBeVisible();
    await expect(firefoxLink).toBeVisible();
  });
});
```

### 5.4 데이터 저장 및 복원 테스트 (data-storage.spec.ts)

```typescript
import { test, expect } from './fixtures/platform.fixture';
import { sendToUnity, queryBridge } from './fixtures/platform.fixture';

test.describe('LocalStorage/IndexedDB 데이터 저장 테스트', () => {

  // TC-PLAT-010: LocalStorage 설정값 저장
  test('TC-PLAT-010: 설정값이 hexa_ 접두어로 LocalStorage에 저장된다',
    async ({ unityPage: page }) => {
      // LocalStorage 초기화
      await page.evaluate(() => localStorage.clear());

      // 설정 변경 시뮬레이션
      await sendToUnity(page, 'GameSettings', 'SetMusicVolume', '0.5');
      await sendToUnity(page, 'GameSettings', 'SetLanguage', 'en');
      await page.waitForTimeout(1000);

      // LocalStorage 확인
      const musicVol = await page.evaluate(
        () => localStorage.getItem('hexa_musicVolume')
      );
      const language = await page.evaluate(
        () => localStorage.getItem('hexa_language')
      );

      expect(musicVol).toBe('0.5');
      expect(language).toBe('en');
    }
  );

  // TC-PLAT-011: IndexedDB 게임 데이터 저장
  test('TC-PLAT-011: 게임 데이터가 IndexedDB에 저장된다',
    async ({ unityPage: page }) => {
      // 저장 실행
      await sendToUnity(page, 'SaveManager', 'ForceSave', '');
      await page.waitForTimeout(2000);

      // IndexedDB에서 데이터 확인
      const savedData = await page.evaluate(() => {
        return new Promise<string | null>((resolve) => {
          const request = indexedDB.open('HexaMergeDB', 1);
          request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const tx = db.transaction('GameData', 'readonly');
            const store = tx.objectStore('GameData');
            const getReq = store.get('saveData');
            getReq.onsuccess = () => resolve(getReq.result || null);
            getReq.onerror = () => resolve(null);
          };
          request.onerror = () => resolve(null);
        });
      });

      expect(savedData).not.toBeNull();
      expect(savedData!.length).toBeGreaterThan(0);
    }
  );

  // TC-PLAT-012: IndexedDB 데이터 AES 암호화 확인
  test('TC-PLAT-012: 저장 데이터가 암호화 되어있다',
    async ({ unityPage: page }) => {
      await sendToUnity(page, 'SaveManager', 'ForceSave', '');
      await page.waitForTimeout(2000);

      const savedData = await page.evaluate(() => {
        return new Promise<string | null>((resolve) => {
          const request = indexedDB.open('HexaMergeDB', 1);
          request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const tx = db.transaction('GameData', 'readonly');
            const store = tx.objectStore('GameData');
            const getReq = store.get('saveData');
            getReq.onsuccess = () => resolve(getReq.result || null);
          };
        });
      });

      expect(savedData).not.toBeNull();

      // JSON 파싱 시도 -- 암호화되어 있으므로 실패해야 함
      let isParseable = true;
      try {
        JSON.parse(savedData!);
      } catch {
        isParseable = false;
      }
      expect(isParseable).toBe(false);

      // 평문 키 노출 여부 확인
      expect(savedData).not.toContain('highScore');
      expect(savedData).not.toContain('coins');
      expect(savedData).not.toContain('hints');
    }
  );
});
```

### 5.5 성능 측정 테스트 (performance.spec.ts)

```typescript
import { test, expect } from '@playwright/test';
import { waitForUnityLoad, queryBridge } from './fixtures/platform.fixture';

test.describe('성능 테스트', () => {

  // TC-PLAT-029: 초기 로드 전송 크기 10MB 이하
  test('TC-PLAT-029: 초기 로드 크기가 10MB 이하이다', async ({ page }) => {
    let totalBytes = 0;

    page.on('response', async (response) => {
      try {
        const headers = response.headers();
        const contentLength = headers['content-length'];
        if (contentLength) {
          totalBytes += parseInt(contentLength, 10);
        }
      } catch { /* 무시 */ }
    });

    await page.goto('/');
    await waitForUnityLoad(page);

    const totalMB = totalBytes / (1024 * 1024);
    console.log(`초기 로드 크기: ${totalMB.toFixed(2)}MB`);

    expect(totalBytes).toBeLessThan(10 * 1024 * 1024); // 10MB
  });

  // TC-PLAT-030: FPS 30 이상 유지
  test('TC-PLAT-030: 게임 실행 중 평균 FPS 30 이상', async ({ page }) => {
    await page.goto('/');
    await waitForUnityLoad(page);

    const fpsReadings: number[] = [];

    // 10초 동안 0.5초 간격으로 FPS 측정
    for (let i = 0; i < 20; i++) {
      const fps = await page.evaluate(
        () => (window as any).gamebridge?.getFPS() ?? 0
      );
      if (fps > 0) fpsReadings.push(fps);
      await page.waitForTimeout(500);
    }

    expect(fpsReadings.length).toBeGreaterThan(0);

    const avgFps =
      fpsReadings.reduce((a, b) => a + b, 0) / fpsReadings.length;
    const minFps = Math.min(...fpsReadings);

    console.log(
      `FPS: 평균=${avgFps.toFixed(1)}, 최소=${minFps}, 샘플수=${fpsReadings.length}`
    );

    expect(avgFps).toBeGreaterThanOrEqual(30);
    expect(minFps).toBeGreaterThanOrEqual(20);
  });

  // TC-PLAT-031: Brotli 압축 및 Content-Encoding 확인
  test('TC-PLAT-031: Brotli 압축 헤더가 올바르게 설정되어 있다',
    async ({ page }) => {
      const brResponses: {
        url: string;
        encoding: string | null;
        contentType: string | null;
        cacheControl: string | null;
      }[] = [];

      page.on('response', (response) => {
        const url = response.url();
        if (url.match(/\.(wasm|data|js)\.br$/) || url.match(/\.(wasm|data|framework\.js)$/)) {
          brResponses.push({
            url,
            encoding: response.headers()['content-encoding'] ?? null,
            contentType: response.headers()['content-type'] ?? null,
            cacheControl: response.headers()['cache-control'] ?? null,
          });
        }
      });

      await page.goto('/');
      await waitForUnityLoad(page);

      // Brotli 압축 파일이 최소 1개 이상 존재
      expect(brResponses.length).toBeGreaterThan(0);

      for (const resp of brResponses) {
        if (resp.url.includes('.br')) {
          expect(resp.encoding).toBe('br');
        }
        if (resp.url.includes('.wasm')) {
          expect(resp.contentType).toContain('application/wasm');
        }
        // 캐시 정책 확인
        if (resp.cacheControl) {
          expect(resp.cacheControl).toContain('immutable');
        }
      }
    }
  );
});
```

### 5.6 네트워크 단절/복구 테스트 (network.spec.ts)

```typescript
import { test, expect } from './fixtures/platform.fixture';
import { sendToUnity, queryBridge } from './fixtures/platform.fixture';

test.describe('네트워크 단절/복구 테스트', () => {

  // TC-PLAT-032: 오프라인 감지 및 UI 반영
  test('TC-PLAT-032: 네트워크 단절 시 오프라인 UI가 표시된다',
    async ({ unityPage: page, context }) => {
      // 네트워크 단절
      await context.setOffline(true);
      await page.waitForTimeout(3000);

      // 오프라인 상태 감지 확인 (Unity 브릿지)
      const isOnline = await page.evaluate(
        () => navigator.onLine
      );
      expect(isOnline).toBe(false);

      // 광고 버튼 비활성화 확인
      const adButtonVisible = await queryBridge<boolean>(
        page, 'isAdButtonVisible'
      );
      expect(adButtonVisible).toBe(false);

      // 네트워크 복구
      await context.setOffline(false);
    }
  );

  // TC-PLAT-033: 네트워크 복구 시 자동 재연결
  test('TC-PLAT-033: 네트워크 복구 후 광고 버튼이 재활성화된다',
    async ({ unityPage: page, context }) => {
      // 네트워크 단절 -> 복구
      await context.setOffline(true);
      await page.waitForTimeout(3000);
      await context.setOffline(false);
      await page.waitForTimeout(5000);

      // 온라인 상태 확인
      const isOnline = await page.evaluate(() => navigator.onLine);
      expect(isOnline).toBe(true);
    }
  );

  // TC-PLAT-034: 오프라인 중 로컬 저장
  test('TC-PLAT-034: 오프라인에서도 로컬 저장이 동작한다',
    async ({ unityPage: page, context }) => {
      // 네트워크 단절
      await context.setOffline(true);
      await page.waitForTimeout(1000);

      // 테스트 데이터 주입 및 저장
      await sendToUnity(
        page, 'SaveManager', 'SetTestData',
        JSON.stringify({ highScore: 9999, coins: 500 })
      );
      await sendToUnity(page, 'SaveManager', 'ForceSave', '');
      await page.waitForTimeout(2000);

      // IndexedDB에서 데이터 확인
      const savedData = await page.evaluate(() => {
        return new Promise<string | null>((resolve) => {
          const request = indexedDB.open('HexaMergeDB', 1);
          request.onsuccess = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            const tx = db.transaction('GameData', 'readonly');
            const store = tx.objectStore('GameData');
            const getReq = store.get('saveData');
            getReq.onsuccess = () => resolve(getReq.result || null);
          };
        });
      });

      expect(savedData).not.toBeNull();

      // 네트워크 복구
      await context.setOffline(false);
    }
  );
});
```

### 5.7 보안 테스트 (security.spec.ts)

```typescript
import { test, expect } from '@playwright/test';
import { waitForUnityLoad } from './fixtures/platform.fixture';

test.describe('보안 테스트', () => {

  // TC-PLAT-026: CSP 헤더 확인
  test('TC-PLAT-026: CSP 헤더가 올바르게 설정되어 있다', async ({ page }) => {
    const response = await page.goto('/');
    expect(response).not.toBeNull();

    const csp = response!.headers()['content-security-policy'];

    if (csp) {
      // WebGL 필수 디렉티브 확인
      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("'unsafe-eval'"); // WebGL WASM 실행에 필요
      // Firebase 도메인 허용 확인
      expect(csp).toContain('firebaseio.com');
      expect(csp).toContain('googleapis.com');
    }
  });

  // TC-PLAT-027: 콘솔 에러 없음 확인
  test('TC-PLAT-027: 게임 로드 중 심각한 콘솔 에러가 없다', async ({ page }) => {
    const errors: string[] = [];
    const pageErrors: string[] = [];

    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });

    page.on('pageerror', (error) => {
      pageErrors.push(error.message);
    });

    await page.goto('/');
    await waitForUnityLoad(page);
    await page.waitForTimeout(5000); // 추가 대기

    // 허용되는 에러 패턴 필터링 (예: 광고 SDK 미연결 등)
    const criticalErrors = errors.filter(
      (e) => !e.includes('favicon.ico') && !e.includes('ads')
    );

    console.log(`콘솔 에러: ${criticalErrors.length}건`);
    console.log(`미처리 예외: ${pageErrors.length}건`);

    expect(pageErrors.length).toBe(0);
    expect(criticalErrors.length).toBe(0);
  });

  // TC-PLAT-028: WASM MIME 타입 및 캐시 헤더 확인
  test('TC-PLAT-028: 보안 관련 HTTP 헤더가 올바르다', async ({ page }) => {
    const headerChecks: {
      url: string;
      contentType: string | null;
      cacheControl: string | null;
    }[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (url.includes('.wasm') || url.includes('.html')) {
        headerChecks.push({
          url,
          contentType: response.headers()['content-type'] ?? null,
          cacheControl: response.headers()['cache-control'] ?? null,
        });
      }
    });

    await page.goto('/');
    await waitForUnityLoad(page);

    for (const check of headerChecks) {
      if (check.url.includes('.wasm')) {
        expect(check.contentType).toContain('application/wasm');
      }
      if (check.url.endsWith('.html') || check.url.endsWith('/')) {
        if (check.cacheControl) {
          expect(check.cacheControl).toContain('no-cache');
        }
      }
    }
  });
});
```

### 5.8 Firebase Analytics 테스트 (firebase-analytics.spec.ts)

```typescript
import { test, expect } from './fixtures/platform.fixture';
import { sendToUnity, queryBridge } from './fixtures/platform.fixture';

test.describe('Firebase Analytics 이벤트 전송 테스트', () => {

  // TC-PLAT-016: Firebase 초기화 및 session_start
  test('TC-PLAT-016: Firebase 초기화 후 session_start 이벤트가 전송된다',
    async ({ unityPage: page }) => {
      // Firebase 초기화 상태 확인
      const isInitialized = await queryBridge<boolean>(
        page, 'isFirebaseInitialized'
      );
      expect(isInitialized).toBe(true);

      // Analytics 이벤트 수집 확인
      const events = await queryBridge<string>(page, 'getAnalyticsEvents');
      const eventList = JSON.parse(events);
      const sessionStart = eventList.find(
        (e: any) => e.name === 'session_start'
      );

      expect(sessionStart).toBeDefined();
      expect(sessionStart.params).toHaveProperty('platform');
      expect(sessionStart.params).toHaveProperty('version');
    }
  );

  // TC-PLAT-017: game_over 이벤트 파라미터 정확성
  test('TC-PLAT-017: game_over 이벤트에 올바른 파라미터가 포함된다',
    async ({ unityPage: page }) => {
      // 게임 오버 시뮬레이션
      await sendToUnity(page, 'GameManager', 'SimulateGameOver', '1234');
      await page.waitForTimeout(2000);

      // Analytics 이벤트 확인
      const events = await queryBridge<string>(page, 'getAnalyticsEvents');
      const eventList = JSON.parse(events);
      const gameOver = eventList.find(
        (e: any) => e.name === 'game_over'
      );

      expect(gameOver).toBeDefined();
      expect(gameOver.params.score).toBe(1234);
      expect(gameOver.params).toHaveProperty('max_number');
      expect(gameOver.params).toHaveProperty('duration_sec');
      expect(gameOver.params).toHaveProperty('total_merges');
    }
  );
});
```

---

## 6. 테스트 데이터 및 자동화 전략

### 6.1 테스트 데이터

#### 6.1.1 게임 상태 테스트 데이터

| 데이터셋 | 용도 | 값 |
|---------|------|-----|
| 초기 상태 | 신규 사용자 시뮬레이션 | `highScore: 0, coins: 0, hints: 3` |
| 진행 중 상태 | 일반 플레이어 시뮬레이션 | `highScore: 5000, coins: 1000, hints: 5, totalGamesPlayed: 50` |
| 고급 사용자 | 장기 사용자 시뮬레이션 | `highScore: 50000, coins: 10000, hints: 10, purchasedProducts: ["remove_ads"]` |
| 최대 데이터 | 경계값 테스트 | `highScore: 2147483647, coins: 999999, hints: 10` |

#### 6.1.2 설정값 테스트 데이터

| 키 | 기본값 | 테스트값 | 경계값 |
|----|-------|---------|-------|
| `hexa_musicVolume` | 0.8 | 0.5 | 0.0 / 1.0 |
| `hexa_sfxVolume` | 1.0 | 0.7 | 0.0 / 1.0 |
| `hexa_language` | "ko" | "en" | "ko" / "en" / "ja" |
| `hexa_selectedTheme` | "default" | "ocean" | "default" / "ocean" / "forest" / "space" |

#### 6.1.3 네트워크 시나리오 데이터

| 시나리오 | 설정 | 용도 |
|---------|------|------|
| 정상 네트워크 | 기본 | 기준 테스트 |
| 완전 오프라인 | `context.setOffline(true)` | 오프라인 감지 테스트 |
| 느린 3G | `page.route()` + 지연 2000ms | 로딩 타임아웃 테스트 |
| 네트워크 불안정 | 랜덤 오프라인 토글 | 재연결 복원력 테스트 |

### 6.2 자동화 전략

#### 6.2.1 CI/CD 통합

```yaml
# .github/workflows/playwright-platform.yml
name: Platform E2E Tests

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

jobs:
  e2e-platform:
    runs-on: ubuntu-latest
    timeout-minutes: 30

    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright browsers
        run: npx playwright install --with-deps

      - name: Start WebGL server
        run: npx serve build/webgl -l 8080 &

      - name: Run Platform tests
        run: npx playwright test --project=chromium
        env:
          WEBGL_URL: http://localhost:8080

      - name: Upload report
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/
```

#### 6.2.2 테스트 실행 전략

| 실행 단계 | 프로젝트 | 테스트 범위 | 트리거 |
|----------|---------|-----------|--------|
| 스모크 테스트 | chromium | TC-PLAT-001, 010, 014, 027 | PR 생성 시 |
| 기능 테스트 | chromium | TC-PLAT-001~037 전체 | develop 브랜치 push |
| 호환성 테스트 | chromium, firefox, webkit, edge | TC-PLAT-004~007 | main 브랜치 merge |
| 전체 회귀 테스트 | 전체 7개 프로젝트 | TC-PLAT-001~037 전체 | 릴리스 태그 생성 |
| 성능 벤치마크 | chromium | TC-PLAT-003, 029, 030 | 주 1회 스케줄 |

#### 6.2.3 테스트 안정성 확보 방안

| 항목 | 전략 |
|------|------|
| **WebGL 로딩 대기** | `waitForFunction()`으로 Unity 인스턴스 생성 완료까지 대기, 최대 120초 타임아웃 |
| **비결정적 타이밍** | `waitForTimeout()` 대신 `waitForSelector()`, `waitForFunction()` 우선 사용 |
| **재시도 정책** | `retries: 1` 설정으로 불안정 테스트 1회 재시도 |
| **테스트 격리** | 매 테스트 전 `localStorage.clear()` + IndexedDB 초기화 |
| **스크린샷** | 실패 시 자동 스크린샷 저장 (`screenshot: 'only-on-failure'`) |
| **비디오 녹화** | 실패 시 비디오 유지 (`video: 'retain-on-failure'`) |
| **트레이스** | 첫 재시도 시 Playwright 트레이스 기록 (`trace: 'on-first-retry'`) |

#### 6.2.4 테스트 결과 리포팅

```
[테스트 리포트 구조]

playwright-report/
├── index.html              # HTML 리포트 (브라우저별 결과 포함)
├── data/
│   ├── screenshots/        # 실패 시 스크린샷
│   └── videos/             # 실패 시 비디오
└── results.json            # JSON 형식 테스트 결과

커스텀 리포트:
├── performance-report.json  # TC-PLAT-003, 029, 030 성능 수치
├── compatibility-matrix.md  # 브라우저별 호환성 결과 매트릭스
└── security-audit.md        # 보안 테스트 결과 요약
```

#### 6.2.5 알려진 제한사항

| 제한사항 | 영향 | 대응 |
|---------|------|------|
| WebKit에서 IndexedDB 제한 | TC-PLAT-011~012 실패 가능 | `test.skip()` 조건부 스킵 처리 |
| Firefox에서 `performance.memory` 미지원 | TC-PLAT-008 측정 불가 | Unity 브릿지의 자체 메모리 API 사용 |
| SharedArrayBuffer COOP/COEP | 멀티스레드 WebGL 제한 | 서버 헤더 설정으로 해결 |
| Service Worker가 localhost에서만 동작 | TC-PLAT-020 환경 제한 | HTTPS 스테이징 서버에서 별도 실행 |
| Unity WebGL 단일 인스턴스 | 병렬 테스트 불가 | `fullyParallel: false` 설정 |

---

> **문서 이력**
> | 버전 | 날짜 | 작성자 | 변경 내용 |
> |------|------|--------|----------|
> | 1.0 | 2026-02-13 | - | 최초 작성 |
