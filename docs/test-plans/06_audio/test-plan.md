# 06. 오디오 시스템 - Playwright 테스트 계획서

> **문서 버전:** v1.0
> **최종 수정일:** 2026-02-13
> **프로젝트명:** Hexa Merge Basic
> **테스트 대상:** 오디오 시스템 (BGM, SFX, 볼륨, 음소거, 리소스 로딩)
> **테스트 플랫폼:** Unity WebGL 빌드 + Chromium 기반 브라우저
> **테스트 프레임워크:** Playwright (TypeScript)
> **참조 설계문서:** `docs/design/02_ui-ux-design.md` - 섹션 5. 사운드 디자인
> **참조 개발계획서:** `docs/development/06_audio/development-plan.md`

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

### 1.1 테스트 목적

Unity WebGL로 빌드된 Hexa Merge Basic 게임의 오디오 시스템을 Playwright를 통해 브라우저 환경에서 자동화 검증한다. 게임 내 BGM 재생/전환, SFX 15종 재생, 피치 변조, 볼륨 제어, 음소거, 설정 저장/복원, 동시 다중 재생, WebGL 오디오 컨텍스트 활성화 등 오디오 시스템 전반의 기능 정합성을 확인한다.

### 1.2 테스트 범위

| 영역 | 범위 내 | 범위 외 |
|------|---------|---------|
| BGM | 재생, 정지, 크로스페이드 전환, 씬별 전환, 콤보 BGM 전환, 일시정지/재개 페이드 | BGM 음질 주관 평가, 작곡 품질 |
| SFX | 15종 전체 재생 확인, 피치 변조(랜덤/순차/머지 기반), 풀링(8채널) | SFX 음질 주관 평가 |
| 볼륨 | 마스터/BGM/SFX 슬라이더 연동, 볼륨 공식 검증, 음소거 토글 | AudioMixer 데시벨 정밀 측정 |
| 설정 저장 | PlayerPrefs 기반 저장/복원 (WebGL: IndexedDB) | 서버 동기화 |
| 리소스 | Addressables 기반 오디오 로딩, 프리로드 완료 | 메모리 Profiler 분석, 네이티브 플러그인 |
| WebGL | AudioContext 자동 활성화, 자동재생 정책 대응 | iOS Safari Web Audio 호환 |
| 햅틱 | 범위 외 (브라우저에서 직접 검증 불가) | iOS/Android 네이티브 햅틱 |

### 1.3 전제조건

| 항목 | 설명 |
|------|------|
| WebGL 빌드 | Unity WebGL 빌드가 로컬 또는 스테이징 서버에 배포되어 있어야 함 |
| 브라우저 | Chromium 기반 브라우저 (Chrome, Edge) 사용 - Web Audio API 완전 지원 |
| 오디오 자동재생 제한 | 최신 브라우저는 사용자 상호작용(클릭/탭) 없이 오디오 자동재생을 차단함. 테스트 시 `--autoplay-policy=no-user-gesture-required` 플래그 또는 명시적 클릭 이벤트를 통해 AudioContext를 `running` 상태로 활성화해야 함 |
| Unity-JavaScript 브릿지 | Unity WebGL 빌드에서 `unityInstance.SendMessage()` 또는 게임 내부의 JavaScript 브릿지를 통해 오디오 상태를 조회할 수 있어야 함 |
| Web Audio API 접근 | `page.evaluate()`를 통해 브라우저의 Web Audio API(`AudioContext`, `AudioNode`) 상태를 조회할 수 있어야 함 |
| 테스트 데이터 | BGM 4트랙, SFX 15종 오디오 리소스가 WebGL 빌드에 포함되어 있어야 함 |

### 1.4 테스트 접근 방식

Unity WebGL 빌드는 내부적으로 Web Audio API를 사용하여 오디오를 재생한다. Playwright의 `page.evaluate()`를 통해 다음 항목을 검증한다:

1. **AudioContext 상태 조회**: `AudioContext.state` 값(`suspended`, `running`, `closed`) 확인
2. **오디오 노드 활성 상태**: 현재 재생 중인 AudioNode 수, 연결 상태 확인
3. **Unity C# -> JavaScript 브릿지 호출**: `unityInstance.SendMessage()`로 특정 오디오 명령 실행
4. **게임 내 UI 상태 검증**: 설정 화면의 슬라이더 값, 음소거 토글 상태, 볼륨 퍼센트 텍스트 확인
5. **콘솔 로그 모니터링**: Unity `Debug.Log` 출력을 브라우저 콘솔에서 캡처하여 오디오 이벤트 발생 확인

---

## 2. 테스트 환경 설정

### 2.1 Playwright 프로젝트 구성

```
tests/
├── playwright.config.ts
├── fixtures/
│   └── audio-test-fixture.ts     # 오디오 테스트 전용 fixture
├── helpers/
│   ├── unity-bridge.ts           # Unity WebGL 브릿지 헬퍼
│   ├── web-audio-helper.ts       # Web Audio API 상태 조회 헬퍼
│   └── audio-constants.ts        # 오디오 관련 상수 (SFX ID, BGM ID 등)
└── audio/
    ├── bgm-playback.spec.ts      # BGM 재생/정지 테스트
    ├── bgm-crossfade.spec.ts     # BGM 크로스페이드 전환 테스트
    ├── sfx-playback.spec.ts      # SFX 재생 테스트
    ├── sfx-pitch.spec.ts         # SFX 피치 변조 테스트
    ├── volume-slider.spec.ts     # 볼륨 슬라이더 연동 테스트
    ├── mute-toggle.spec.ts       # 음소거/해제 테스트
    ├── volume-persistence.spec.ts # 볼륨 설정 저장/복원 테스트
    ├── sfx-multichannel.spec.ts  # 동시 다중 SFX 재생 테스트
    ├── scene-bgm.spec.ts         # 씬 전환 시 BGM 전환 테스트
    ├── audio-context.spec.ts     # WebGL AudioContext 자동 활성화 테스트
    └── audio-resource.spec.ts    # 오디오 리소스 로딩 테스트
```

### 2.2 Playwright 설정 (playwright.config.ts)

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/audio',
  timeout: 60_000,           // WebGL 로딩 시간 고려하여 60초
  retries: 1,
  use: {
    baseURL: 'http://localhost:8080',  // WebGL 빌드 서빙 URL
    browserName: 'chromium',
    headless: false,         // 오디오 테스트는 headed 모드 권장
    viewport: { width: 1280, height: 720 },
    launchOptions: {
      args: [
        '--autoplay-policy=no-user-gesture-required',  // 오디오 자동재생 허용
        '--use-fake-ui-for-media-stream',
        '--disable-web-security',
      ],
    },
  },
  webServer: {
    command: 'npx serve ./Build -l 8080',  // WebGL 빌드 디렉토리 서빙
    port: 8080,
    reuseExistingServer: true,
  },
});
```

### 2.3 브라우저 오디오 컨텍스트 활성화 방법

Unity WebGL은 내부적으로 `AudioContext`를 생성한다. 최신 브라우저의 자동재생 정책에 의해 사용자 제스처(클릭) 전까지 `AudioContext.state`가 `suspended` 상태로 유지된다. 이를 해결하기 위한 3가지 전략:

**전략 A: 브라우저 실행 플래그 (권장 - CI/CD 환경)**
```typescript
// playwright.config.ts의 launchOptions.args에 추가
'--autoplay-policy=no-user-gesture-required'
```

**전략 B: 사용자 제스처 시뮬레이션 (프로덕션 환경 재현)**
```typescript
// 페이지 로드 후 캔버스 클릭으로 AudioContext 활성화
await page.click('#unity-canvas');
await page.waitForFunction(() => {
  const ctx = (window as any).unityAudioContext
    || new (window.AudioContext || (window as any).webkitAudioContext)();
  return ctx.state === 'running';
});
```

**전략 C: AudioContext.resume() 직접 호출**
```typescript
await page.evaluate(async () => {
  // Unity 내부 AudioContext 탐색 및 resume
  const contexts = (window as any).__unityAudioContexts
    || [(window as any).unityAudioContext];
  for (const ctx of contexts) {
    if (ctx && ctx.state === 'suspended') {
      await ctx.resume();
    }
  }
});
```

### 2.4 오디오 테스트 전용 Fixture

```typescript
// tests/fixtures/audio-test-fixture.ts
import { test as base, Page } from '@playwright/test';

interface AudioFixture {
  gamePage: Page;
}

export const test = base.extend<AudioFixture>({
  gamePage: async ({ page }, use) => {
    // 1. WebGL 게임 페이지 로드
    await page.goto('/');

    // 2. Unity WebGL 로딩 완료 대기
    await page.waitForFunction(
      () => (window as any).unityInstance !== undefined,
      { timeout: 30_000 }
    );

    // 3. AudioContext 활성화 (캔버스 클릭)
    await page.click('#unity-canvas');

    // 4. AudioContext가 running 상태인지 확인
    await page.waitForFunction(() => {
      const audioCtx = (window as any).unityAudioContext;
      return audioCtx && audioCtx.state === 'running';
    }, { timeout: 10_000 });

    // 5. 오디오 시스템 초기화 완료 대기 (콘솔 로그 기반)
    await page.waitForEvent('console', {
      predicate: (msg) => msg.text().includes('[AudioManager] 초기화 완료'),
      timeout: 15_000,
    });

    await use(page);
  },
});

export { expect } from '@playwright/test';
```

---

## 3. 테스트 케이스 목록

### 3.1 체크리스트 총괄

| TC-ID | 카테고리 | 테스트 항목 | 우선순위 |
|-------|---------|------------|---------|
| TC-AUDIO-001 | BGM | BGM 기본 재생/정지 테스트 | 높음 |
| TC-AUDIO-002 | BGM | BGM 크로스페이드 전환 테스트 (1.0초) | 높음 |
| TC-AUDIO-003 | BGM | 콤보 BGM 전환 테스트 (BGM_02 -> BGM_03, 0.5초) | 중간 |
| TC-AUDIO-004 | BGM | 일시정지 시 BGM 볼륨 페이드 테스트 | 중간 |
| TC-AUDIO-005 | SFX | SFX 15종 개별 재생 테스트 | 높음 |
| TC-AUDIO-006 | SFX | SFX 피치 변조 테스트 (랜덤/순차/머지 기반) | 중간 |
| TC-AUDIO-007 | SFX | 동시 다중 SFX 재생 테스트 (최대 8채널) | 중간 |
| TC-AUDIO-008 | 볼륨 | BGM 볼륨 슬라이더 연동 테스트 | 높음 |
| TC-AUDIO-009 | 볼륨 | SFX 볼륨 슬라이더 연동 테스트 | 높음 |
| TC-AUDIO-010 | 볼륨 | 마스터 볼륨 슬라이더 연동 테스트 | 높음 |
| TC-AUDIO-011 | 음소거 | 음소거 토글 ON/OFF 테스트 | 높음 |
| TC-AUDIO-012 | 저장 | 볼륨 설정 저장/복원 테스트 (IndexedDB/PlayerPrefs) | 중간 |
| TC-AUDIO-013 | BGM | 씬 전환 시 BGM 자동 전환 테스트 | 높음 |
| TC-AUDIO-014 | WebGL | WebGL AudioContext 자동 활성화 테스트 | 최고 |
| TC-AUDIO-015 | 리소스 | 오디오 리소스 로딩 및 프리로드 테스트 | 중간 |

---

## 4. 테스트 케이스 상세

### TC-AUDIO-001: BGM 기본 재생/정지 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-001 |
| **목적** | 메인 메뉴 진입 시 BGM_01("Sunny Puzzle")이 자동 재생되고, 정지 명령 시 재생이 중단되는지 검증 |
| **사전조건** | WebGL 게임이 로드 완료되고 AudioContext가 `running` 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 게임 로드 후 메인 메뉴 화면 진입 | 메인 메뉴 화면이 정상 표시됨 |
| 2 | Web Audio API를 통해 현재 재생 중인 오디오 노드 수 확인 | 1개 이상의 AudioNode가 활성 상태 |
| 3 | 콘솔 로그에서 BGM 재생 이벤트 확인 | `[BGMManager]` 관련 재생 로그 출력 |
| 4 | Unity 브릿지를 통해 BGM 정지 명령 전송 (`AudioManager.BGM.Stop()`) | BGM 재생이 중단됨 |
| 5 | 활성 오디오 노드 수 재확인 | BGM 관련 오디오 노드가 비활성화됨 |

---

### TC-AUDIO-002: BGM 크로스페이드 전환 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-002 |
| **목적** | 화면 전환 시 BGM이 1.0초 크로스페이드로 자연스럽게 전환되는지 검증 (BGM_01 -> BGM_02) |
| **사전조건** | 메인 메뉴에서 BGM_01이 재생 중인 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 메인 메뉴에서 PLAY 버튼 클릭하여 게임 플레이 화면 진입 | 게임 플레이 화면으로 전환됨 |
| 2 | 전환 시작 직후(0~200ms) 오디오 상태 확인 | 2개의 AudioSource가 동시에 활성 (A: 페이드아웃, B: 페이드인) |
| 3 | 전환 진행 중(~500ms) 볼륨 상태 확인 | Source A 볼륨이 감소하고 Source B 볼륨이 증가하는 중간 상태 |
| 4 | 전환 완료 후(1.0초 이후) 오디오 상태 확인 | Source A 정지, Source B만 BGM_02("Chill Merge") 재생 중 |
| 5 | 크로스페이드 소요 시간 측정 | 약 1.0초(허용 오차 +/-200ms) |

---

### TC-AUDIO-003: 콤보 BGM 전환 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-003 |
| **목적** | 콤보 x3 이상 도달 시 BGM_02 -> BGM_03 페이드 전환(0.5초)이 발생하고, 콤보 종료 2초 후 BGM_02로 복귀하는지 검증 |
| **사전조건** | 게임 플레이 화면에서 BGM_02가 재생 중인 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 게임 플레이 중 같은 숫자 블록을 연속 3회 머지하여 콤보 x3 달성 | 콤보 x3 UI 표시 확인 |
| 2 | 콤보 x3 달성 직후 BGM 상태 확인 | BGM_02 -> BGM_03("Combo Vibes") 크로스페이드 전환 시작 |
| 3 | 전환 소요 시간 측정 | 약 0.5초(허용 오차 +/-150ms) |
| 4 | 콤보 종료(더 이상 연속 머지 없음) 후 2초 대기 | 대기 중 BGM_03이 계속 재생됨 |
| 5 | 2초 경과 후 BGM 상태 확인 | BGM_03 -> BGM_02 크로스페이드 복귀 전환 시작 |

---

### TC-AUDIO-004: 일시정지 시 BGM 볼륨 페이드 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-004 |
| **목적** | 일시정지 시 BGM 볼륨이 50%로 0.3초 페이드 감소하고, 재개 시 100%로 0.3초 페이드 복구되는지 검증 |
| **사전조건** | 게임 플레이 중 BGM이 정상 볼륨으로 재생 중인 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 일시정지 버튼(`[||]`) 클릭 전 BGM 볼륨 측정 | 현재 설정된 볼륨 값(기본 0.7 = 70%) |
| 2 | 일시정지 버튼 클릭 | 일시정지 오버레이 표시 |
| 3 | 0.3초 대기 후 BGM 볼륨 측정 | 볼륨이 이전 값의 50%로 감소 (0.7 -> 0.35) |
| 4 | RESUME 버튼 클릭 | 게임 재개 |
| 5 | 0.3초 대기 후 BGM 볼륨 측정 | 볼륨이 원래 값(0.7)으로 복구 |

---

### TC-AUDIO-005: SFX 15종 개별 재생 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-005 |
| **목적** | 설계서에 정의된 15종 효과음이 각각의 트리거 이벤트에 의해 정상 재생되는지 검증 |
| **사전조건** | 게임이 로드 완료되고 SFX 프리로드가 완료된 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | SFX ID | 트리거 동작 | 기대결과 |
|------|--------|------------|---------|
| 1 | SFX_01 (블록 탭) | 빈 헥사곤 블록 클릭 | `tap_select` 사운드 재생, 볼륨 80% |
| 2 | SFX_02 (선택 해제) | 선택된 블록을 다시 클릭 | `tap_deselect` 사운드 재생, 볼륨 60% |
| 3 | SFX_03 (머지 성공) | 같은 숫자 블록 2개 연속 선택 | `merge` 사운드 재생, 볼륨 100% |
| 4 | SFX_04 (매칭 실패) | 다른 숫자 블록 2개 연속 선택 | `match_fail` 사운드 재생, 볼륨 70% |
| 5 | SFX_05 (파도 등장) | 머지 후 새 블록 웨이브 진입 | `wave_whoosh` 사운드 재생, 볼륨 60% |
| 6 | SFX_06 (콤보 x2) | 연속 2회 머지 | `combo_2` 사운드 재생, 볼륨 90% |
| 7 | SFX_07 (콤보 x3) | 연속 3회 머지 | `combo_3` 사운드 재생, 볼륨 95% |
| 8 | SFX_08 (콤보 x4) | 연속 4회 머지 | `combo_4` 사운드 재생, 볼륨 95% |
| 9 | SFX_09 (콤보 x5+) | 연속 5회 이상 머지 | `combo_max` 사운드 재생, 볼륨 100% |
| 10 | SFX_10 (점수 카운트) | 점수 증가 시 | `score_tick` 사운드 재생, 볼륨 40% |
| 11 | SFX_11 (최고 점수 갱신) | 현재 점수가 최고 점수 초과 | `new_record` 사운드 재생, 볼륨 100% |
| 12 | SFX_12 (버튼 클릭) | UI 버튼(PLAY, 설정 등) 클릭 | `button_click` 사운드 재생, 볼륨 70% |
| 13 | SFX_13 (화면 전환) | 화면 이동 시 | `transition` 사운드 재생, 볼륨 50% |
| 14 | SFX_14 (아이템 사용) | 힌트/셔플 아이템 사용 | `item_use` 사운드 재생, 볼륨 90% |
| 15 | SFX_15 (구매 완료) | 상점에서 구매 완료 | `purchase` 사운드 재생, 볼륨 100% |

---

### TC-AUDIO-006: SFX 피치 변조 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-006 |
| **목적** | SFX의 피치 변조 규칙(랜덤, 순차, 머지 숫자 기반)이 설계서대로 적용되는지 검증 |
| **사전조건** | 게임 플레이 화면에서 SFX 재생 가능 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 블록 탭(SFX_01)을 10회 반복 실행하고 각 피치 값 기록 | 피치 값이 0.95~1.05 범위 내에서 랜덤 변동, 10회 모두 동일하지 않음 |
| 2 | 머지 사운드(SFX_03) 피치 검증: 2->4 머지 실행 | 피치 값 = 1.0 |
| 3 | 머지 사운드(SFX_03) 피치 검증: 4->8 머지 실행 | 피치 값 = 1.05 |
| 4 | 머지 사운드(SFX_03) 피치 검증: 128->256 머지 실행 | 피치 값 = 1.30 |
| 5 | 머지 사운드(SFX_03) 피치 검증: 512+ 머지 실행 | 피치 값 = 1.40 (최대) |
| 6 | 파도 등장(SFX_05) 순차 피치: 연속 6회 재생 시 피치 기록 | 0.8 -> 0.88 -> 0.96 -> 1.04 -> 1.12 -> 1.2 순차 증가 |
| 7 | 점수 카운트(SFX_10) 순차 피치: 연속 6회 재생 시 피치 기록 | 1.0 -> 1.1 -> 1.2 -> 1.3 -> 1.4 -> 1.5 순차 증가 |
| 8 | 순차 피치 순환 확인: 7번째 재생 | 피치가 시작 값으로 리셋 (순환) |

---

### TC-AUDIO-007: 동시 다중 SFX 재생 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-007 |
| **목적** | SFX 풀링 시스템이 동시 최대 8채널 재생을 지원하고, 초과 시 우선순위 기반 강탈이 정상 동작하는지 검증 |
| **사전조건** | 게임 플레이 화면에서 SFX 재생 가능 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | Unity 브릿지를 통해 8개의 SFX를 빠르게 연속 재생 요청 | 8개 모두 동시 재생됨 (활성 AudioSource 8개) |
| 2 | 8개 재생 중 9번째 SFX(높은 우선순위) 재생 요청 | 가장 낮은 우선순위의 SFX가 중단되고 새 SFX가 재생됨 |
| 3 | 8개 재생 중 9번째 SFX(낮은 우선순위) 재생 요청 | 강탈 불가, 재생되지 않음 (null 반환) |
| 4 | 빠른 연타 테스트: 0.05초 간격으로 20회 SFX 재생 요청 | 오류 없이 풀링 시스템 안정적 동작, 최대 8채널 유지 |

---

### TC-AUDIO-008: BGM 볼륨 슬라이더 연동 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-008 |
| **목적** | 설정 화면의 BGM 볼륨 슬라이더 조작 시 실시간으로 BGM 볼륨이 반영되는지 검증 |
| **사전조건** | 설정 화면이 열려 있고 BGM이 재생 중인 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 설정 화면 진입 | BGM 슬라이더 초기값이 70%(기본값)으로 표시 |
| 2 | BGM 슬라이더를 50%로 드래그 | BGM 볼륨 텍스트가 "50%"로 변경, 실제 BGM 볼륨 감소 |
| 3 | BGM 슬라이더를 100%로 드래그 | BGM 볼륨 텍스트가 "100%"로 변경, 실제 BGM 볼륨 최대 |
| 4 | BGM 슬라이더를 0%로 드래그 | BGM 볼륨 텍스트가 "0%"로 변경, BGM 완전 무음 |
| 5 | Web Audio API를 통한 실제 출력 볼륨 확인 | AudioMixer BGM 채널의 볼륨이 슬라이더 값에 연동됨 |

---

### TC-AUDIO-009: SFX 볼륨 슬라이더 연동 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-009 |
| **목적** | 설정 화면의 SFX 볼륨 슬라이더 조작 시 실시간으로 SFX 볼륨이 반영되는지 검증 |
| **사전조건** | 설정 화면이 열려 있는 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 설정 화면 진입 | SFX 슬라이더 초기값이 100%(기본값)으로 표시 |
| 2 | SFX 슬라이더를 50%로 드래그 | SFX 볼륨 텍스트가 "50%"로 변경 |
| 3 | 설정 화면에서 나가 게임 플레이 화면 진입 후 블록 탭 | SFX_01 재생 볼륨이 기존 대비 50%로 감소 |
| 4 | SFX 슬라이더를 0%로 설정 후 블록 탭 | SFX 재생 없음 (완전 무음) |
| 5 | 볼륨 공식 검증: master=100%, sfx=50%, clipBase=80% | 실제 SFX 볼륨 = 1.0 x 0.5 x 0.8 = 0.4 (40%) |

---

### TC-AUDIO-010: 마스터 볼륨 슬라이더 연동 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-010 |
| **목적** | 마스터 볼륨 슬라이더가 BGM과 SFX 모두에 영향을 미치는지 검증 |
| **사전조건** | 설정 화면이 열려 있고 BGM이 재생 중인 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 마스터 볼륨 슬라이더 초기값 확인 | 100%(기본값) |
| 2 | 마스터 볼륨을 50%로 드래그 | 마스터 볼륨 텍스트가 "50%"로 변경 |
| 3 | BGM 볼륨 확인 | 실제 BGM 볼륨 = 0.5 x 0.7 x trackBaseVolume (감소) |
| 4 | 블록 탭하여 SFX 재생 확인 | 실제 SFX 볼륨 = 0.5 x 1.0 x clipBaseVolume (감소) |
| 5 | 마스터 볼륨을 0%로 드래그 | BGM과 SFX 모두 완전 무음 (-80dB) |

---

### TC-AUDIO-011: 음소거 토글 ON/OFF 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-011 |
| **목적** | 메인 메뉴의 사운드 ON/OFF 토글 및 설정 화면의 음소거 토글이 전체 오디오를 즉시 음소거/해제하는지 검증 |
| **사전조건** | BGM이 재생 중이고 오디오가 음소거되지 않은 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 메인 메뉴의 사운드 토글 버튼(`[음표]` 아이콘) 클릭 | 토글 상태가 OFF로 변경, 아이콘이 음소거 표시로 변경 |
| 2 | AudioMixer Master 볼륨 확인 | Master 볼륨이 -80dB(사실상 무음)로 설정됨 |
| 3 | BGM 재생 상태 확인 | BGM AudioSource는 계속 재생 중이나 출력 볼륨 0 |
| 4 | 블록 탭 동작 수행 | SFX 소리 출력 없음 |
| 5 | 사운드 토글 버튼 다시 클릭 (음소거 해제) | 토글 상태가 ON으로 복원, BGM/SFX 소리 정상 출력 |
| 6 | 볼륨 슬라이더 값 확인 | 음소거 해제 후 이전 볼륨 설정값이 그대로 유지됨 |

---

### TC-AUDIO-012: 볼륨 설정 저장/복원 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-012 |
| **목적** | 볼륨 설정(마스터/BGM/SFX/음소거)이 PlayerPrefs(WebGL: IndexedDB)에 저장되고, 게임 재실행 시 복원되는지 검증 |
| **사전조건** | 게임이 로드 완료된 상태 |
| **우선순위** | 중간 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 설정 화면에서 마스터 볼륨을 80%, BGM을 50%, SFX를 60%로 변경 | 각 슬라이더 텍스트가 변경된 값 표시 |
| 2 | 음소거 토글을 ON으로 설정 | 음소거 상태 활성화 |
| 3 | IndexedDB에 PlayerPrefs 값 저장 확인 | `Audio_MasterVolume=0.8`, `Audio_BGMVolume=0.5`, `Audio_SFXVolume=0.6`, `Audio_Mute=1` 값 저장됨 |
| 4 | 페이지 새로고침 (게임 재실행) | WebGL 게임이 재로드됨 |
| 5 | 설정 화면 진입하여 각 슬라이더 값 확인 | 마스터=80%, BGM=50%, SFX=60%, 음소거=ON 복원 |
| 6 | IndexedDB 초기화 후 게임 재실행 | 기본값 복원: 마스터=100%, BGM=70%, SFX=100%, 음소거=OFF |

---

### TC-AUDIO-013: 씬 전환 시 BGM 자동 전환 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-013 |
| **목적** | 각 화면(메인 메뉴, 게임 플레이, 상점)으로 전환 시 설계서에 정의된 BGM이 자동으로 크로스페이드 전환되는지 검증 |
| **사전조건** | 게임이 로드 완료되고 메인 메뉴 BGM이 재생 중인 상태 |
| **우선순위** | 높음 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 메인 메뉴에서 현재 BGM 확인 | BGM_01("Sunny Puzzle") 재생 중 |
| 2 | PLAY 버튼 클릭하여 게임 플레이 진입 | BGM_01 -> BGM_02("Chill Merge") 크로스페이드 전환 (1.0초) |
| 3 | 일시정지 -> 메인 메뉴 버튼 클릭 | BGM_02 -> BGM_01 크로스페이드 전환 (1.0초) |
| 4 | 메인 메뉴에서 SHOP 버튼 클릭 | BGM_01 -> BGM_04("Shop Melody") 크로스페이드 전환 (1.0초) |
| 5 | 상점에서 뒤로가기 버튼 클릭 | BGM_04 -> BGM_01 크로스페이드 전환 (1.0초) |
| 6 | 같은 화면 내에서 BGM 전환 요청 | 같은 BGM이면 전환하지 않음 (중복 방지) |

---

### TC-AUDIO-014: WebGL AudioContext 자동 활성화 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-014 |
| **목적** | WebGL 환경에서 브라우저의 오디오 자동재생 정책을 정상 처리하고, 사용자 상호작용 후 AudioContext가 `running` 상태로 활성화되는지 검증 |
| **사전조건** | 오디오 자동재생이 차단되는 표준 브라우저 설정 (`--autoplay-policy` 플래그 없이) |
| **우선순위** | 최고 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 자동재생 정책 플래그 없이 게임 페이지 로드 | AudioContext.state가 `suspended` 상태 |
| 2 | AudioContext 상태를 JavaScript로 확인 | `suspended` 반환 |
| 3 | 게임 캔버스(#unity-canvas) 클릭 | 사용자 제스처 발생, Unity가 AudioContext.resume() 호출 |
| 4 | AudioContext 상태 재확인 | `running` 상태로 변경됨 |
| 5 | BGM 재생 확인 | 클릭 후 BGM이 정상 재생 시작 |
| 6 | 페이지 탭 전환 후 복귀 시 AudioContext 상태 확인 | 탭 복귀 시 `running` 상태 유지 또는 자동 resume |

---

### TC-AUDIO-015: 오디오 리소스 로딩 및 프리로드 테스트

| 항목 | 내용 |
|------|------|
| **TC-ID** | TC-AUDIO-015 |
| **목적** | Addressables 기반 오디오 리소스가 정상 로드되고, SFX 프리로드 완료 후 첫 재생 지연이 없는지 검증 |
| **사전조건** | 게임 로드 시작 직후 |
| **우선순위** | 중간 |

**테스트 단계:**

| 단계 | 동작 | 기대결과 |
|------|------|---------|
| 1 | 게임 로드 중 콘솔 로그 모니터링 | `[AudioAddressableLoader] SFX 프리로드 완료: 15개 클립` 로그 출력 |
| 2 | 프리로드 완료 전 SFX 재생 시도 (타이밍 제어) | 비동기 로드 후 재생 (약간의 지연 허용) |
| 3 | 프리로드 완료 후 SFX 재생 시도 | 지연 없이 즉시 재생 (캐시 히트) |
| 4 | 씬 전환 시 BGM 리소스 로드 확인 | BGM 클립이 비동기로 로드된 후 크로스페이드 시작 |
| 5 | Addressable 로드 실패 시뮬레이션 (유효하지 않은 키) | 오류 로그 출력, null 안전 처리 (크래시 없음) |
| 6 | 오디오 리소스 파일 존재 확인 (네트워크 요청 캡처) | BGM 4개, SFX 15개 파일이 정상 HTTP 응답 (200 OK) |

---

## 5. Playwright TypeScript 코드 예제

### 5.1 Web Audio API 상태 체크 헬퍼

```typescript
// tests/helpers/web-audio-helper.ts

import { Page } from '@playwright/test';

/**
 * Web Audio API AudioContext 상태를 조회한다.
 * Unity WebGL은 내부적으로 AudioContext를 생성하므로 이를 탐색한다.
 */
export async function getAudioContextState(page: Page): Promise<string> {
  return await page.evaluate(() => {
    // Unity WebGL에서 생성한 AudioContext 탐색
    // 방법 1: Unity가 전역에 노출한 경우
    const unityCtx = (window as any).unityAudioContext;
    if (unityCtx) return unityCtx.state;

    // 방법 2: 모든 AudioContext 인스턴스 탐색 (BaseAudioContext 프로토타입 패치)
    const contexts = (window as any).__audioContextInstances;
    if (contexts && contexts.length > 0) {
      return contexts[0].state;
    }

    return 'unknown';
  });
}

/**
 * 현재 활성 상태의 AudioNode(재생 중인 소스) 수를 반환한다.
 */
export async function getActiveAudioSourceCount(page: Page): Promise<number> {
  return await page.evaluate(() => {
    const unityCtx = (window as any).unityAudioContext;
    if (!unityCtx) return -1;

    // Unity WebGL 오디오 시스템의 활성 소스 추적
    // 주의: 직접적인 AudioNode 열거는 불가하므로
    // Unity C# 측 브릿지를 통해 확인하는 것이 정확함
    const activeCount = (window as any).__unityActiveAudioSources;
    return typeof activeCount === 'number' ? activeCount : -1;
  });
}

/**
 * AudioContext를 강제로 resume한다 (suspended -> running).
 */
export async function resumeAudioContext(page: Page): Promise<boolean> {
  return await page.evaluate(async () => {
    const unityCtx = (window as any).unityAudioContext;
    if (!unityCtx) return false;

    if (unityCtx.state === 'suspended') {
      await unityCtx.resume();
    }
    return unityCtx.state === 'running';
  });
}

/**
 * 특정 AudioMixer 파라미터의 현재 값을 조회한다.
 * Unity 브릿지를 통해 C# 측 VolumeController의 값을 반환한다.
 */
export async function getVolumeValue(
  page: Page,
  channel: 'master' | 'bgm' | 'sfx'
): Promise<number> {
  return await page.evaluate((ch) => {
    // Unity C# -> JavaScript 브릿지를 통한 조회
    const volumeData = (window as any).__unityVolumeData;
    if (!volumeData) return -1;

    switch (ch) {
      case 'master': return volumeData.masterVolume;
      case 'bgm':    return volumeData.bgmVolume;
      case 'sfx':    return volumeData.sfxVolume;
      default:       return -1;
    }
  }, channel);
}

/**
 * 현재 재생 중인 BGM 트랙 ID를 반환한다.
 */
export async function getCurrentBGMTrackID(page: Page): Promise<string> {
  return await page.evaluate(() => {
    const bgmData = (window as any).__unityBGMData;
    return bgmData ? bgmData.currentTrackID : 'unknown';
  });
}

/**
 * 음소거 상태를 조회한다.
 */
export async function isMuted(page: Page): Promise<boolean> {
  return await page.evaluate(() => {
    const volumeData = (window as any).__unityVolumeData;
    return volumeData ? volumeData.isMuted : false;
  });
}
```

### 5.2 Unity WebGL 브릿지 헬퍼

```typescript
// tests/helpers/unity-bridge.ts

import { Page } from '@playwright/test';

/**
 * Unity WebGL 인스턴스에 SendMessage를 전송한다.
 * Unity C# 측의 public 메서드를 호출하는 데 사용한다.
 */
export async function sendUnityMessage(
  page: Page,
  gameObjectName: string,
  methodName: string,
  parameter?: string | number
): Promise<void> {
  await page.evaluate(
    ({ go, method, param }) => {
      const instance = (window as any).unityInstance;
      if (!instance) throw new Error('Unity instance not found');

      if (param !== undefined) {
        instance.SendMessage(go, method, param);
      } else {
        instance.SendMessage(go, method);
      }
    },
    { go: gameObjectName, method: methodName, param: parameter }
  );
}

/**
 * Unity AudioManager를 통해 특정 BGM을 재생한다.
 */
export async function playBGM(page: Page, trackID: number): Promise<void> {
  await sendUnityMessage(page, 'AudioManager', 'PlayBGMByID', trackID);
}

/**
 * Unity AudioManager를 통해 BGM을 정지한다.
 */
export async function stopBGM(page: Page): Promise<void> {
  await sendUnityMessage(page, 'AudioManager', 'StopBGM');
}

/**
 * Unity AudioManager를 통해 특정 SFX를 재생한다.
 */
export async function playSFX(page: Page, clipID: number): Promise<void> {
  await sendUnityMessage(page, 'AudioManager', 'PlaySFXByID', clipID);
}

/**
 * Unity AudioManager를 통해 볼륨을 설정한다.
 * @param channel - 'master' | 'bgm' | 'sfx'
 * @param value - 0.0 ~ 1.0
 */
export async function setVolume(
  page: Page,
  channel: 'master' | 'bgm' | 'sfx',
  value: number
): Promise<void> {
  const methodMap = {
    master: 'SetMasterVolume',
    bgm: 'SetBGMVolume',
    sfx: 'SetSFXVolume',
  };
  await sendUnityMessage(page, 'AudioManager', methodMap[channel], value);
}

/**
 * Unity AudioManager를 통해 음소거를 토글한다.
 */
export async function toggleMute(page: Page): Promise<void> {
  await sendUnityMessage(page, 'AudioManager', 'ToggleMute');
}

/**
 * Unity 로딩 완료를 대기한다.
 */
export async function waitForUnityLoad(page: Page, timeout = 30_000): Promise<void> {
  await page.waitForFunction(
    () => (window as any).unityInstance !== undefined,
    { timeout }
  );
}

/**
 * 오디오 시스템 초기화 완료를 대기한다.
 */
export async function waitForAudioInit(page: Page, timeout = 15_000): Promise<void> {
  await page.waitForEvent('console', {
    predicate: (msg) => msg.text().includes('[AudioManager] 초기화 완료'),
    timeout,
  });
}
```

### 5.3 BGM 재생/정지 테스트 코드 예제

```typescript
// tests/audio/bgm-playback.spec.ts

import { test, expect } from '../fixtures/audio-test-fixture';
import {
  getAudioContextState,
  getCurrentBGMTrackID,
  getActiveAudioSourceCount,
} from '../helpers/web-audio-helper';
import { stopBGM, playBGM } from '../helpers/unity-bridge';

test.describe('TC-AUDIO-001: BGM 기본 재생/정지', () => {
  test('메인 메뉴 진입 시 BGM_01이 자동 재생된다', async ({ gamePage }) => {
    // AudioContext가 running 상태인지 확인
    const ctxState = await getAudioContextState(gamePage);
    expect(ctxState).toBe('running');

    // 현재 재생 중인 BGM 트랙 확인
    const currentTrack = await getCurrentBGMTrackID(gamePage);
    expect(currentTrack).toBe('BGM_01_SunnyPuzzle');

    // 활성 오디오 소스가 1개 이상인지 확인
    const activeCount = await getActiveAudioSourceCount(gamePage);
    expect(activeCount).toBeGreaterThanOrEqual(1);
  });

  test('BGM 정지 명령 시 재생이 중단된다', async ({ gamePage }) => {
    // BGM 재생 중 확인
    let currentTrack = await getCurrentBGMTrackID(gamePage);
    expect(currentTrack).not.toBe('None');

    // BGM 정지
    await stopBGM(gamePage);

    // 잠시 대기 (정지 처리 시간)
    await gamePage.waitForTimeout(200);

    // BGM 정지 확인
    const activeCount = await getActiveAudioSourceCount(gamePage);
    expect(activeCount).toBe(0);
  });

  test('BGM 정지 후 재생 명령 시 다시 재생된다', async ({ gamePage }) => {
    // BGM 정지
    await stopBGM(gamePage);
    await gamePage.waitForTimeout(200);

    // BGM 재생 (BGM_01 = 0)
    await playBGM(gamePage, 0);
    await gamePage.waitForTimeout(500);

    // 재생 확인
    const currentTrack = await getCurrentBGMTrackID(gamePage);
    expect(currentTrack).toBe('BGM_01_SunnyPuzzle');
  });
});
```

### 5.4 AudioContext 자동 활성화 테스트 코드 예제

```typescript
// tests/audio/audio-context.spec.ts

import { test, expect } from '@playwright/test';
import { waitForUnityLoad } from '../helpers/unity-bridge';
import { getAudioContextState, resumeAudioContext } from '../helpers/web-audio-helper';

test.describe('TC-AUDIO-014: WebGL AudioContext 자동 활성화', () => {
  // 이 테스트는 자동재생 정책 플래그 없이 실행한다.
  test.use({
    launchOptions: {
      args: [
        // --autoplay-policy 플래그 의도적으로 제외
        '--disable-web-security',
      ],
    },
  });

  test('페이지 로드 직후 AudioContext는 suspended 상태이다', async ({ page }) => {
    await page.goto('/');
    await waitForUnityLoad(page);

    // AudioContext 상태 확인 - suspended여야 함
    const state = await getAudioContextState(page);
    expect(state).toBe('suspended');
  });

  test('캔버스 클릭 후 AudioContext가 running 상태로 전환된다', async ({ page }) => {
    await page.goto('/');
    await waitForUnityLoad(page);

    // 초기 상태: suspended
    let state = await getAudioContextState(page);
    expect(state).toBe('suspended');

    // 사용자 제스처: 캔버스 클릭
    await page.click('#unity-canvas');

    // running 상태 대기
    await page.waitForFunction(() => {
      const ctx = (window as any).unityAudioContext;
      return ctx && ctx.state === 'running';
    }, { timeout: 5_000 });

    state = await getAudioContextState(page);
    expect(state).toBe('running');
  });

  test('탭 전환 후 복귀 시 AudioContext가 정상 유지된다', async ({ page, context }) => {
    await page.goto('/');
    await waitForUnityLoad(page);
    await page.click('#unity-canvas');

    // running 상태 확인
    await page.waitForFunction(() => {
      const ctx = (window as any).unityAudioContext;
      return ctx && ctx.state === 'running';
    });

    // 새 탭 열기 -> 탭 전환 시뮬레이션
    const newPage = await context.newPage();
    await newPage.goto('about:blank');
    await newPage.waitForTimeout(1000);

    // 원래 탭으로 복귀
    await page.bringToFront();
    await page.waitForTimeout(500);

    // AudioContext 상태 확인 (running 또는 자동 resume)
    const state = await getAudioContextState(page);
    // 일부 브라우저에서 탭 전환 시 suspended될 수 있으므로
    // resume 시도 후 확인
    if (state === 'suspended') {
      const resumed = await resumeAudioContext(page);
      expect(resumed).toBe(true);
    } else {
      expect(state).toBe('running');
    }

    await newPage.close();
  });
});
```

### 5.5 볼륨 슬라이더 연동 테스트 코드 예제

```typescript
// tests/audio/volume-slider.spec.ts

import { test, expect } from '../fixtures/audio-test-fixture';
import { getVolumeValue } from '../helpers/web-audio-helper';

test.describe('TC-AUDIO-008~010: 볼륨 슬라이더 연동', () => {
  async function openSettings(page: any) {
    // 설정 버튼 클릭 (메인 메뉴 또는 일시정지 화면에서)
    await page.click('[data-testid="settings-button"]');
    await page.waitForTimeout(500); // 설정 화면 전환 애니메이션 대기
  }

  async function setSliderValue(page: any, sliderId: string, value: number) {
    // Unity WebGL 슬라이더는 캔버스 내부에 렌더링되므로
    // JavaScript 브릿지를 통해 값을 설정한다.
    await page.evaluate(
      ({ id, val }) => {
        const instance = (window as any).unityInstance;
        instance.SendMessage('VolumeSettingsUI', `Set${id}SliderValue`, val);
      },
      { id: sliderId, val: value }
    );
    await page.waitForTimeout(100); // 값 반영 대기
  }

  test('BGM 볼륨 슬라이더를 50%로 변경하면 실제 BGM 볼륨이 반영된다', async ({
    gamePage,
  }) => {
    await openSettings(gamePage);

    // 초기 BGM 볼륨 확인 (기본값 70%)
    let bgmVolume = await getVolumeValue(gamePage, 'bgm');
    expect(bgmVolume).toBeCloseTo(0.7, 1);

    // BGM 슬라이더를 50%로 변경
    await setSliderValue(gamePage, 'BGM', 0.5);

    // 변경된 볼륨 확인
    bgmVolume = await getVolumeValue(gamePage, 'bgm');
    expect(bgmVolume).toBeCloseTo(0.5, 1);
  });

  test('SFX 볼륨 슬라이더를 0%로 변경하면 SFX가 무음이 된다', async ({
    gamePage,
  }) => {
    await openSettings(gamePage);

    // SFX 슬라이더를 0%로 변경
    await setSliderValue(gamePage, 'SFX', 0.0);

    // 변경된 볼륨 확인
    const sfxVolume = await getVolumeValue(gamePage, 'sfx');
    expect(sfxVolume).toBeCloseTo(0.0, 1);
  });

  test('마스터 볼륨 50% 설정 시 BGM/SFX 모두 영향받는다', async ({
    gamePage,
  }) => {
    await openSettings(gamePage);

    // 마스터 볼륨을 50%로 변경
    await setSliderValue(gamePage, 'Master', 0.5);

    const masterVolume = await getVolumeValue(gamePage, 'master');
    expect(masterVolume).toBeCloseTo(0.5, 1);

    // 실제 BGM 볼륨 = master(0.5) x bgm(0.7) = 0.35
    // 이 값은 AudioMixer에서 확인해야 하므로 Unity 브릿지 필요
    const effectiveBGM = await gamePage.evaluate(() => {
      const data = (window as any).__unityVolumeData;
      return data ? data.effectiveBGMVolume : -1;
    });
    expect(effectiveBGM).toBeCloseTo(0.35, 1);
  });
});
```

### 5.6 음소거 토글 테스트 코드 예제

```typescript
// tests/audio/mute-toggle.spec.ts

import { test, expect } from '../fixtures/audio-test-fixture';
import { isMuted, getVolumeValue } from '../helpers/web-audio-helper';
import { toggleMute } from '../helpers/unity-bridge';

test.describe('TC-AUDIO-011: 음소거 토글 ON/OFF', () => {
  test('음소거 활성화 시 모든 오디오가 무음이 된다', async ({ gamePage }) => {
    // 초기 상태: 음소거 비활성
    let muteState = await isMuted(gamePage);
    expect(muteState).toBe(false);

    // 음소거 토글
    await toggleMute(gamePage);
    await gamePage.waitForTimeout(200);

    // 음소거 상태 확인
    muteState = await isMuted(gamePage);
    expect(muteState).toBe(true);

    // AudioMixer Master 볼륨이 -80dB (사실상 무음)인지 확인
    const masterDB = await gamePage.evaluate(() => {
      const data = (window as any).__unityVolumeData;
      return data ? data.masterDecibelValue : 0;
    });
    expect(masterDB).toBeLessThanOrEqual(-80);
  });

  test('음소거 해제 시 이전 볼륨 설정이 복원된다', async ({ gamePage }) => {
    // 볼륨 값 기록
    const originalMaster = await getVolumeValue(gamePage, 'master');
    const originalBGM = await getVolumeValue(gamePage, 'bgm');

    // 음소거 ON
    await toggleMute(gamePage);
    await gamePage.waitForTimeout(200);

    // 음소거 OFF
    await toggleMute(gamePage);
    await gamePage.waitForTimeout(200);

    // 볼륨 복원 확인
    const restoredMaster = await getVolumeValue(gamePage, 'master');
    const restoredBGM = await getVolumeValue(gamePage, 'bgm');

    expect(restoredMaster).toBeCloseTo(originalMaster, 1);
    expect(restoredBGM).toBeCloseTo(originalBGM, 1);
  });
});
```

### 5.7 오디오 리소스 로딩 테스트 코드 예제

```typescript
// tests/audio/audio-resource.spec.ts

import { test, expect } from '@playwright/test';
import { waitForUnityLoad, waitForAudioInit } from '../helpers/unity-bridge';

test.describe('TC-AUDIO-015: 오디오 리소스 로딩', () => {
  test('SFX 프리로드 완료 로그가 출력된다', async ({ page }) => {
    // 콘솔 로그 수집
    const consoleLogs: string[] = [];
    page.on('console', (msg) => consoleLogs.push(msg.text()));

    await page.goto('/');
    await waitForUnityLoad(page);

    // 오디오 초기화 완료 대기
    await waitForAudioInit(page);

    // 프리로드 완료 로그 확인
    const preloadLog = consoleLogs.find((log) =>
      log.includes('[AudioAddressableLoader] SFX 프리로드 완료')
    );
    expect(preloadLog).toBeDefined();
    expect(preloadLog).toContain('15개 클립');
  });

  test('오디오 파일 리소스가 정상 로드된다 (HTTP 200)', async ({ page }) => {
    // 네트워크 요청 모니터링
    const audioRequests: { url: string; status: number }[] = [];

    page.on('response', (response) => {
      const url = response.url();
      if (
        url.includes('.ogg') ||
        url.includes('.wav') ||
        url.includes('.mp3') ||
        url.includes('.data') // Unity WebGL 데이터 파일
      ) {
        audioRequests.push({ url, status: response.status() });
      }
    });

    await page.goto('/');
    await waitForUnityLoad(page);
    await waitForAudioInit(page);

    // 오디오 관련 리소스가 로드되었는지 확인
    // Unity WebGL은 .data 파일에 오디오를 번들링하므로
    // 최소한 메인 데이터 파일이 200으로 로드되어야 함
    const failedRequests = audioRequests.filter((r) => r.status !== 200);
    expect(failedRequests).toHaveLength(0);
  });

  test('Addressable 로드 실패 시 크래시 없이 처리된다', async ({ page }) => {
    const consoleLogs: string[] = [];
    const errorLogs: string[] = [];

    page.on('console', (msg) => {
      consoleLogs.push(msg.text());
      if (msg.type() === 'error') errorLogs.push(msg.text());
    });

    await page.goto('/');
    await waitForUnityLoad(page);
    await page.click('#unity-canvas');

    // 존재하지 않는 오디오 클립 로드 시도
    await page.evaluate(() => {
      const instance = (window as any).unityInstance;
      if (instance) {
        instance.SendMessage('AudioManager', 'TestLoadInvalidClip');
      }
    });

    await page.waitForTimeout(2000);

    // 에러 로그가 있더라도 페이지가 크래시하지 않는지 확인
    const pageTitle = await page.title();
    expect(pageTitle).toBeDefined(); // 페이지가 살아있는지 확인

    // Unity 에러 로그에 로드 실패 관련 메시지가 있는지 확인
    const loadFailLog = consoleLogs.find(
      (log) =>
        log.includes('[AudioAddressableLoader] 로드 실패') ||
        log.includes('[AudioAddressableLoader] 유효하지 않은')
    );
    // 로드 실패 시 적절한 경고/에러 로그가 출력되어야 함
    expect(loadFailLog).toBeDefined();
  });
});
```

### 5.8 SFX 피치 변조 테스트 코드 예제

```typescript
// tests/audio/sfx-pitch.spec.ts

import { test, expect } from '../fixtures/audio-test-fixture';

test.describe('TC-AUDIO-006: SFX 피치 변조', () => {
  test('블록 탭 SFX의 피치가 0.95~1.05 범위에서 랜덤 변동한다', async ({
    gamePage,
  }) => {
    const pitchValues: number[] = [];

    for (let i = 0; i < 10; i++) {
      // Unity 브릿지를 통해 탭 SFX 재생 및 사용된 피치 값 반환
      const pitch = await gamePage.evaluate(() => {
        const instance = (window as any).unityInstance;
        instance.SendMessage('AudioManager', 'PlaySFXByID', 0); // SFX_01
        // JavaScript 브릿지를 통해 마지막 재생된 SFX의 피치 조회
        return (window as any).__unityLastSFXPitch || 1.0;
      });
      pitchValues.push(pitch);
      await gamePage.waitForTimeout(100);
    }

    // 모든 피치가 0.95~1.05 범위 내인지 확인
    for (const pitch of pitchValues) {
      expect(pitch).toBeGreaterThanOrEqual(0.95);
      expect(pitch).toBeLessThanOrEqual(1.05);
    }

    // 10회 모두 동일하지 않은지 확인 (랜덤성)
    const uniquePitches = new Set(pitchValues.map((p) => p.toFixed(3)));
    expect(uniquePitches.size).toBeGreaterThan(1);
  });

  test('머지 사운드 피치가 숫자에 비례하여 상승한다', async ({ gamePage }) => {
    // 머지 결과 숫자 -> 기대 피치 매핑 (설계서 기준)
    const expectedPitchMap: [number, number][] = [
      [4, 1.0],     // 2->4
      [8, 1.05],    // 4->8
      [16, 1.10],   // 8->16
      [32, 1.15],   // 16->32
      [64, 1.20],   // 32->64
      [128, 1.25],  // 64->128
      [256, 1.30],  // 128->256
      [512, 1.35],  // 256->512
      [1024, 1.40], // 512+
    ];

    for (const [resultValue, expectedPitch] of expectedPitchMap) {
      const actualPitch = await gamePage.evaluate((rv) => {
        const instance = (window as any).unityInstance;
        // Unity 브릿지: 특정 머지 결과값으로 SFX_03 재생 후 피치 반환
        instance.SendMessage('AudioManager', 'PlayMergeSFX', rv);
        return (window as any).__unityLastSFXPitch || 1.0;
      }, resultValue);

      await gamePage.waitForTimeout(100);

      expect(actualPitch).toBeCloseTo(expectedPitch, 2);
    }
  });

  test('파도 등장 SFX의 순차 피치가 0.8에서 1.2까지 증가한다', async ({
    gamePage,
  }) => {
    // 순차 피치 리셋
    await gamePage.evaluate(() => {
      const instance = (window as any).unityInstance;
      instance.SendMessage('AudioManager', 'ResetSequentialPitch', 4); // SFX_05
    });

    const expectedPitches = [0.8, 0.88, 0.96, 1.04, 1.12, 1.2];
    const actualPitches: number[] = [];

    for (let i = 0; i < 6; i++) {
      const pitch = await gamePage.evaluate(() => {
        const instance = (window as any).unityInstance;
        instance.SendMessage('AudioManager', 'PlaySFXByID', 4); // SFX_05
        return (window as any).__unityLastSFXPitch || 1.0;
      });
      actualPitches.push(pitch);
      await gamePage.waitForTimeout(100);
    }

    for (let i = 0; i < expectedPitches.length; i++) {
      expect(actualPitches[i]).toBeCloseTo(expectedPitches[i], 1);
    }

    // 7번째 재생: 순환하여 0.8로 리셋
    const resetPitch = await gamePage.evaluate(() => {
      const instance = (window as any).unityInstance;
      instance.SendMessage('AudioManager', 'PlaySFXByID', 4);
      return (window as any).__unityLastSFXPitch || 1.0;
    });
    expect(resetPitch).toBeCloseTo(0.8, 1);
  });
});
```

---

## 6. 테스트 데이터 및 자동화 전략

### 6.1 테스트 데이터

#### BGM 트랙 데이터

| BGM ID (enum 값) | 트랙명 | 용도 (씬) | BPM | 기본 볼륨 |
|------------------|--------|-----------|-----|----------|
| 0 (BGM_01) | Sunny Puzzle | MainMenu | 110 | 0.7 |
| 1 (BGM_02) | Chill Merge | Gameplay | 90 | 0.7 |
| 2 (BGM_03) | Combo Vibes | Gameplay (콤보 시) | 130 | 0.7 |
| 3 (BGM_04) | Shop Melody | Shop | 100 | 0.7 |

#### SFX 클립 데이터

| SFX ID (enum 값) | 클립명 | 기본 볼륨 | 피치 변조 타입 | 피치 범위 | 우선순위 |
|------------------|--------|----------|---------------|----------|---------|
| 0 (SFX_01) | TapSelect | 0.80 | RandomRange | 0.95~1.05 | High (128) |
| 1 (SFX_02) | TapDeselect | 0.60 | Fixed | 1.0 | Medium (64) |
| 2 (SFX_03) | Merge | 1.00 | MergeValueBased | 1.0~1.4 | High (128) |
| 3 (SFX_04) | MatchFail | 0.70 | Fixed | 1.0 | Medium (64) |
| 4 (SFX_05) | WaveWhoosh | 0.60 | Sequential | 0.8~1.2 | Medium (64) |
| 5 (SFX_06) | Combo2 | 0.90 | Fixed | 1.0 | High (128) |
| 6 (SFX_07) | Combo3 | 0.95 | Fixed | 1.1 | High (128) |
| 7 (SFX_08) | Combo4 | 0.95 | Fixed | 1.2 | High (128) |
| 8 (SFX_09) | ComboMax | 1.00 | Fixed | 1.3 | Highest (255) |
| 9 (SFX_10) | ScoreTick | 0.40 | Sequential | 1.0~1.5 | Low (0) |
| 10 (SFX_11) | NewRecord | 1.00 | Fixed | 1.0 | Highest (255) |
| 11 (SFX_12) | ButtonClick | 0.70 | Fixed | 1.0 | Medium (64) |
| 12 (SFX_13) | Transition | 0.50 | Fixed | 1.0 | Low (0) |
| 13 (SFX_14) | ItemUse | 0.90 | Fixed | 1.0 | High (128) |
| 14 (SFX_15) | Purchase | 1.00 | Fixed | 1.0 | Highest (255) |

#### 머지 피치 테이블 (테스트 검증용)

| 머지 결과 숫자 | 기대 피치 | 허용 오차 |
|--------------|----------|----------|
| 4 (2+2) | 1.00 | +/-0.02 |
| 8 (4+4) | 1.05 | +/-0.02 |
| 16 (8+8) | 1.10 | +/-0.02 |
| 32 (16+16) | 1.15 | +/-0.02 |
| 64 (32+32) | 1.20 | +/-0.02 |
| 128 (64+64) | 1.25 | +/-0.02 |
| 256 (128+128) | 1.30 | +/-0.02 |
| 512 (256+256) | 1.35 | +/-0.02 |
| 1024+ (512+512) | 1.40 | +/-0.02 |

#### 볼륨 설정 기본값 (테스트 검증용)

| 설정 항목 | PlayerPrefs 키 | 기본값 | 타입 |
|----------|---------------|--------|------|
| 마스터 볼륨 | `Audio_MasterVolume` | 1.0 (100%) | float |
| BGM 볼륨 | `Audio_BGMVolume` | 0.7 (70%) | float |
| SFX 볼륨 | `Audio_SFXVolume` | 1.0 (100%) | float |
| 음소거 | `Audio_Mute` | 0 (OFF) | int |

### 6.2 자동화 전략

#### Unity C# 측 JavaScript 브릿지 구현 요구사항

Playwright에서 Unity WebGL 내부 오디오 상태를 조회하려면, Unity C# 코드에서 JavaScript로 상태를 노출하는 브릿지가 필요하다. 테스트 빌드에서만 활성화되는 디버그 브릿지를 구현한다.

```
필요한 JavaScript 브릿지 (jslib 플러그인):
├── __unityAudioContext          : AudioContext 인스턴스 참조
├── __unityActiveAudioSources    : 현재 활성 AudioSource 수
├── __unityVolumeData            : { masterVolume, bgmVolume, sfxVolume, isMuted,
│                                    masterDecibelValue, effectiveBGMVolume }
├── __unityBGMData               : { currentTrackID, isPlaying, isCrossfading }
├── __unityLastSFXPitch          : 마지막 재생된 SFX의 피치 값
└── SendMessage 메서드 목록:
    ├── AudioManager.PlayBGMByID(int trackID)
    ├── AudioManager.StopBGM()
    ├── AudioManager.PlaySFXByID(int clipID)
    ├── AudioManager.PlayMergeSFX(int resultValue)
    ├── AudioManager.SetMasterVolume(float value)
    ├── AudioManager.SetBGMVolume(float value)
    ├── AudioManager.SetSFXVolume(float value)
    ├── AudioManager.ToggleMute()
    ├── AudioManager.ResetSequentialPitch(int clipID)
    └── AudioManager.TestLoadInvalidClip()
```

#### CI/CD 파이프라인 통합

```yaml
# .github/workflows/audio-tests.yml 예시 구조
name: Audio System Tests
on: [push, pull_request]

jobs:
  audio-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx playwright install chromium
      - name: Start WebGL server
        run: npx serve ./Build -l 8080 &
      - name: Run audio tests
        run: npx playwright test tests/audio/ --reporter=html
      - uses: actions/upload-artifact@v4
        if: always()
        with:
          name: audio-test-report
          path: playwright-report/
```

#### 테스트 실행 순서 (의존성 고려)

| 순서 | 테스트 파일 | TC-ID | 의존성 |
|------|-----------|-------|--------|
| 1 | audio-context.spec.ts | TC-AUDIO-014 | 없음 (최우선 실행) |
| 2 | audio-resource.spec.ts | TC-AUDIO-015 | AudioContext 활성화 |
| 3 | bgm-playback.spec.ts | TC-AUDIO-001 | 리소스 로딩 완료 |
| 4 | bgm-crossfade.spec.ts | TC-AUDIO-002, 003 | BGM 기본 재생 |
| 5 | scene-bgm.spec.ts | TC-AUDIO-013 | BGM 크로스페이드 |
| 6 | sfx-playback.spec.ts | TC-AUDIO-005 | 리소스 로딩 완료 |
| 7 | sfx-pitch.spec.ts | TC-AUDIO-006 | SFX 기본 재생 |
| 8 | sfx-multichannel.spec.ts | TC-AUDIO-007 | SFX 기본 재생 |
| 9 | volume-slider.spec.ts | TC-AUDIO-008, 009, 010 | 기본 재생 확인 후 |
| 10 | mute-toggle.spec.ts | TC-AUDIO-011 | 볼륨 시스템 |
| 11 | volume-persistence.spec.ts | TC-AUDIO-012 | 볼륨/음소거 시스템 |

#### 테스트 한계 및 보완 사항

| 한계 | 설명 | 보완 방안 |
|------|------|---------|
| 오디오 파형 분석 불가 | Playwright에서 실제 오디오 출력 파형을 캡처/분석할 수 없음 | Web Audio API의 `AnalyserNode` 연결 또는 Unity 브릿지를 통한 간접 검증 |
| 볼륨 dB 정밀 측정 | AudioMixer 데시벨 값을 직접 읽기 어려움 | Unity C# 측 브릿지에서 `AudioMixer.GetFloat()` 결과를 JS로 전달 |
| 크로스페이드 중간 상태 | 크로스페이드 진행 중의 정확한 볼륨 커브 검증이 어려움 | 전환 시작/완료 시점의 상태를 로그로 기록하고 로그 기반 검증 |
| 헤드리스 모드 제약 | 일부 브라우저에서 headless 모드로 오디오 재생이 불완전할 수 있음 | `headless: false` 사용 또는 `--autoplay-policy` 플래그 필수 |
| 실제 오디오 청취 | 소리가 "올바르게 들리는지"는 자동화로 검증 불가 | 수동 QA 병행, 오디오 재생 여부와 파라미터(볼륨/피치)만 자동 검증 |
| 햅틱 피드백 | 브라우저 환경에서 iOS/Android 네이티브 햅틱 검증 불가 | 햅틱은 별도 디바이스 테스트로 분리, WebGL `Navigator.vibrate()`만 검증 가능 |

---

> **문서 끝**
>
> 본 문서는 `docs/design/02_ui-ux-design.md`(섹션 5. 사운드 디자인)과 `docs/development/06_audio/development-plan.md`를 기반으로 작성되었습니다.
