import { defineConfig, devices } from '@playwright/test';

/**
 * Hexa Merge WebGL 빌드를 위한 Playwright 설정.
 *
 * Unity WebGL 빌드가 Build/ 디렉터리에 위치한다고 가정합니다.
 * `npm run serve` 로 로컬 HTTP 서버를 기동한 뒤 테스트를 실행하세요.
 */
export default defineConfig({
  /* 테스트 파일이 위치한 디렉터리 */
  testDir: './specs',

  /* 각 테스트의 기본 타임아웃 (Unity WebGL 로딩이 느릴 수 있으므로 넉넉하게 설정) */
  timeout: 120_000,

  /* expect() 의 기본 타임아웃 */
  expect: {
    timeout: 30_000,
  },

  /* 테스트 결과 리포트 */
  reporter: [
    ['html', { open: 'never' }],
    ['list'],
  ],

  /* 전체 테스트 재시도 횟수 */
  retries: 1,

  /* 병렬 실행 비활성화 - Unity WebGL 인스턴스는 동시 접속이 어려울 수 있음 */
  fullyParallel: false,
  workers: 1,

  /* 공통 설정 */
  use: {
    /* WebGL 빌드를 서빙하는 로컬 서버 주소 */
    baseURL: 'http://localhost:8080',

    /* Unity WebGL 은 GPU 가속이 필요하므로 headless 에서도 WebGL 활성화 */
    launchOptions: {
      args: ['--use-gl=angle', '--use-angle=swiftshader'],
    },

    /* 스크린샷: 실패 시에만 캡처 */
    screenshot: 'only-on-failure',

    /* 트레이스: 첫 재시도 시 수집 */
    trace: 'on-first-retry',

    /* 비디오: 첫 재시도 시 녹화 */
    video: 'on-first-retry',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        /* Unity WebGL 은 viewport 가 너무 작으면 동작이 달라질 수 있음 */
        viewport: { width: 1280, height: 720 },
      },
    },
  ],

  /* 로컬 개발 서버 자동 기동 (Build 디렉터리가 존재할 때만 동작) */
  webServer: {
    command: 'npx http-server ../Build/WebGL -p 8080 --cors -c-1',
    port: 8080,
    /* Unity WebGL 빌드 서버가 준비될 때까지 대기 */
    timeout: 30_000,
    reuseExistingServer: true,
  },
});
