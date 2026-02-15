import { test, expect } from '@playwright/test';
import { UnityBridge, getAllGridCoords } from '../helpers/unity-bridge';

/**
 * 헥사 그리드 기본 테스트
 *
 * 보드가 올바르게 로드되는지, 25셀 다이아몬드 구조가 정상인지 검증한다.
 */
test.describe('헥사 그리드 - 보드 로딩 및 구조 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
  });

  test('Unity WebGL 인스턴스가 정상 로드된다', async ({ page }) => {
    // unityInstance 가 window 에 존재하는지 확인
    const hasUnity = await page.evaluate(() => {
      return typeof (window as any).unityInstance !== 'undefined' &&
             (window as any).unityInstance !== null;
    });
    expect(hasUnity).toBe(true);
  });

  test('게임 보드에 정확히 25개 셀이 존재한다', async () => {
    const state = await bridge.getGameState();
    expect(state.cells).toHaveLength(25);
  });

  test('25셀이 올바른 다이아몬드 좌표(1-2-3-4-5-4-3-2-1)를 가진다', async () => {
    const state = await bridge.getGameState();

    // 예상 좌표 목록 생성
    const expectedCoords = getAllGridCoords();
    expect(expectedCoords).toHaveLength(25);

    // 실제 셀 좌표를 Set 으로 변환하여 비교
    const actualCoordSet = new Set(
      state.cells.map((c) => `${c.q},${c.r}`),
    );

    for (const coord of expectedCoords) {
      expect(
        actualCoordSet.has(`${coord.q},${coord.r}`),
        `좌표 (${coord.q}, ${coord.r}) 가 보드에 존재해야 합니다`,
      ).toBe(true);
    }

    // 역방향 검증: 실제 셀 수와 예상 셀 수 일치
    expect(actualCoordSet.size).toBe(expectedCoords.length);
  });

  test('각 행의 셀 개수가 1-2-3-4-5-4-3-2-1 구조이다', async () => {
    const state = await bridge.getGameState();

    // r 값 기준으로 행별 셀 수 집계
    const rowCounts = new Map<number, number>();
    for (const cell of state.cells) {
      rowCounts.set(cell.r, (rowCounts.get(cell.r) || 0) + 1);
    }

    // r = -4 ~ +4 까지 9개 행 존재
    const expectedRowWidths = [1, 2, 3, 4, 5, 4, 3, 2, 1];
    for (let i = 0; i < expectedRowWidths.length; i++) {
      const r = i - 4; // -4, -3, ..., +4
      expect(
        rowCounts.get(r),
        `행 r=${r} 의 셀 수는 ${expectedRowWidths[i]}개여야 합니다`,
      ).toBe(expectedRowWidths[i]);
    }
  });

  test('새 게임 시작 시 25셀 모두에 타일이 배치된다', async () => {
    const nonEmpty = await bridge.getNonEmptyCells();

    // XUP 방식: 초기 보드 25셀 전부 채움
    expect(nonEmpty.length).toBe(25);
  });

  test('초기 타일 값은 유효한 값(2, 4, 8, 16)이다', async () => {
    const nonEmpty = await bridge.getNonEmptyCells();

    for (const cell of nonEmpty) {
      // TileHelper.GetRandomInitialTileValue() 는 2, 4, 8, 16 을 반환
      expect(
        [2, 4, 8, 16],
        `셀 (${cell.q}, ${cell.r}) 의 값 ${cell.v} 는 2, 4, 8, 16 중 하나여야 합니다`,
      ).toContain(cell.v);
    }
  });

  test('초기 보드에 빈 셀이 없다', async () => {
    const state = await bridge.getGameState();
    const emptyCells = state.cells.filter((c) => c.v === 0);

    // XUP 방식: 25셀 전부 채워짐 → 빈 셀 0개
    expect(emptyCells.length).toBe(0);
  });
});
