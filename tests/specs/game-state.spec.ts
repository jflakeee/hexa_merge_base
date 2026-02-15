import { test, expect } from '@playwright/test';
import { UnityBridge } from '../helpers/unity-bridge';

/**
 * 게임 상태 테스트
 *
 * 게임 시작, 재시작, 상태 전환(Ready/Playing/GameOver)을 검증한다.
 *
 * 주의: GameplayController.Start()에서 자동으로 StartNewGame을 호출하므로,
 * Unity 로드 완료 후 상태가 이미 Playing일 수 있다.
 */
test.describe('게임 상태 - 시작 및 재시작 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.waitForUnityLoad();
  });

  test('StartNewGame 호출 후 Playing 상태가 된다', async ({ page }) => {
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    const state = await bridge.getGameState();
    expect(state.state).toBe('Playing');
  });

  test('Playing 상태에서 getGameState 응답의 state 가 Playing 이다', async ({ page }) => {
    // GameplayController 자동 시작 또는 수동 시작
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    const state = await bridge.getGameState();
    expect(state.state).toBe('Playing');
  });

  test('새 게임 시작 시 점수가 0으로 초기화된다', async ({ page }) => {
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    const state = await bridge.getGameState();
    expect(state.state).toBe('Playing');
    expect(state.score).toBe(0);
  });

  test('새 게임 시작 시 보드에 25셀 모두 타일이 배치된다', async ({ page }) => {
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    const state = await bridge.getGameState();
    const nonEmpty = state.cells.filter((c) => c.v > 0);

    // XUP 방식: 25셀 전부 채움
    expect(nonEmpty.length).toBe(25);
  });

  test('재시작(두 번째 StartNewGame) 시 보드와 점수가 초기화된다', async ({ page }) => {
    // 첫 번째 게임 시작
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    // 탭 시도 (머지 성공 여부와 무관)
    const stateMid = await bridge.getGameState();
    const nonEmpty = stateMid.cells.filter((c) => c.v > 0);
    if (nonEmpty.length > 0) {
      await bridge.tapCell(nonEmpty[0].q, nonEmpty[0].r);
      await page.waitForTimeout(500);
    }

    // 두 번째 게임 시작 (재시작)
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    const stateAfter = await bridge.getGameState();

    // 점수가 0으로 초기화
    expect(stateAfter.score).toBe(0);

    // 상태가 Playing
    expect(stateAfter.state).toBe('Playing');

    // XUP 방식: 보드에 25셀 모두 타일
    const nonEmptyAfter = stateAfter.cells.filter((c) => c.v > 0);
    expect(nonEmptyAfter.length).toBe(25);
  });

  test('게임 상태 조회(getGameState) 응답에 필수 필드가 포함된다', async ({ page }) => {
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    const state = await bridge.getGameState();

    // 필수 필드 존재 여부 확인
    expect(state).toHaveProperty('state');
    expect(state).toHaveProperty('score');
    expect(state).toHaveProperty('highScore');
    expect(state).toHaveProperty('cells');

    // 타입 검증
    expect(typeof state.state).toBe('string');
    expect(typeof state.score).toBe('number');
    expect(typeof state.highScore).toBe('number');
    expect(Array.isArray(state.cells)).toBe(true);
  });

  test('게임 상태의 cells 배열은 항상 25개이다', async ({ page }) => {
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    const state = await bridge.getGameState();
    expect(state.cells).toHaveLength(25);

    // 각 셀에 q, r, v 필드가 존재
    for (const cell of state.cells) {
      expect(cell).toHaveProperty('q');
      expect(cell).toHaveProperty('r');
      expect(cell).toHaveProperty('v');
      expect(typeof cell.q).toBe('number');
      expect(typeof cell.r).toBe('number');
      expect(typeof cell.v).toBe('number');
    }
  });

  test('highScore 는 0 이상의 정수이다', async ({ page }) => {
    await bridge.startNewGame();
    await page.waitForTimeout(1000);

    const state = await bridge.getGameState();
    expect(state.highScore).toBeGreaterThanOrEqual(0);
    expect(Number.isInteger(state.highScore)).toBe(true);
  });
});
