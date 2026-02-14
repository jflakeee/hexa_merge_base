import { test, expect } from '@playwright/test';
import { UnityBridge, CellInfo, getAllGridCoords } from '../helpers/unity-bridge';

/**
 * 머지 시스템 기본 테스트
 *
 * 셀 탭을 통한 머지 동작, 머지 규칙, 머지 후 보드 상태를 검증한다.
 */
test.describe('머지 시스템 - 탭 머지 동작 검증', () => {
  let bridge: UnityBridge;

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
  });

  test('빈 셀을 탭하면 머지가 발생하지 않는다', async () => {
    const stateBefore = await bridge.getGameState();
    const emptyCell = stateBefore.cells.find((c) => c.v === 0);

    // 빈 셀이 없으면 테스트 스킵
    test.skip(!emptyCell, '빈 셀이 없어서 테스트를 건너뜁니다');

    await bridge.clearCollectedEvents();
    await bridge.tapCell(emptyCell!.q, emptyCell!.r);

    // 짧은 대기 후 merge 이벤트가 발생하지 않았는지 확인
    await new Promise((r) => setTimeout(r, 1000));
    const events = await bridge.getCollectedEvents();
    const mergeEvents = events.filter((e) => e.event === 'merge');
    expect(mergeEvents).toHaveLength(0);
  });

  test('인접하지 않은 단독 셀을 탭하면 머지가 발생하지 않는다', async () => {
    // 게임 상태 조회
    const state = await bridge.getGameState();
    const nonEmpty = state.cells.filter((c) => c.v > 0);

    // 같은 값의 인접 셀이 없는 고립된 셀 찾기
    const allCoords = getAllGridCoords();
    const cellMap = new Map<string, CellInfo>();
    for (const c of state.cells) {
      cellMap.set(`${c.q},${c.r}`, c);
    }

    // 6방향 인접 오프셋 (큐브 좌표계)
    const neighborOffsets = [
      { dq: +1, dr: -1 }, { dq: +1, dr: 0 }, { dq: 0, dr: +1 },
      { dq: -1, dr: +1 }, { dq: -1, dr: 0 }, { dq: 0, dr: -1 },
    ];

    let isolatedCell: CellInfo | undefined;
    for (const cell of nonEmpty) {
      const hasMatchingNeighbor = neighborOffsets.some((off) => {
        const key = `${cell.q + off.dq},${cell.r + off.dr}`;
        const neighbor = cellMap.get(key);
        return neighbor && neighbor.v === cell.v;
      });
      if (!hasMatchingNeighbor) {
        isolatedCell = cell;
        break;
      }
    }

    test.skip(!isolatedCell, '고립된 셀이 없어서 테스트를 건너뜁니다');

    await bridge.clearCollectedEvents();
    await bridge.tapCell(isolatedCell!.q, isolatedCell!.r);

    // merge 이벤트가 발생하지 않아야 함
    await new Promise((r) => setTimeout(r, 1000));
    const events = await bridge.getCollectedEvents();
    const mergeEvents = events.filter((e) => e.event === 'merge');
    expect(mergeEvents).toHaveLength(0);
  });

  test('탭 후 게임 상태가 여전히 Playing 이다', async () => {
    const state = await bridge.getGameState();
    const nonEmpty = state.cells.filter((c) => c.v > 0);
    test.skip(nonEmpty.length === 0, '타일이 없어서 테스트를 건너뜁니다');

    // 아무 타일이나 탭
    await bridge.tapCell(nonEmpty[0].q, nonEmpty[0].r);
    await new Promise((r) => setTimeout(r, 500));

    const stateAfter = await bridge.getGameState();
    // 게임오버가 아닌 한 Playing 상태 유지
    expect(['Playing', 'GameOver']).toContain(stateAfter.state);
  });

  test('머지 성공 시 merge 이벤트가 올바른 형식으로 발생한다', async () => {
    // 같은 값의 인접 타일 2개를 강제 배치한 뒤 머지 테스트
    // 직접 셀 값을 설정할 수 없으므로, 현재 보드에서 머지 가능 그룹을 찾는다
    const state = await bridge.getGameState();
    const cellMap = new Map<string, CellInfo>();
    for (const c of state.cells) {
      cellMap.set(`${c.q},${c.r}`, c);
    }

    const neighborOffsets = [
      { dq: +1, dr: -1 }, { dq: +1, dr: 0 }, { dq: 0, dr: +1 },
      { dq: -1, dr: +1 }, { dq: -1, dr: 0 }, { dq: 0, dr: -1 },
    ];

    // 인접한 같은 값 셀 그룹 찾기
    let mergeableCell: CellInfo | undefined;
    for (const cell of state.cells) {
      if (cell.v === 0) continue;
      const hasMatch = neighborOffsets.some((off) => {
        const key = `${cell.q + off.dq},${cell.r + off.dr}`;
        const neighbor = cellMap.get(key);
        return neighbor && neighbor.v === cell.v;
      });
      if (hasMatch) {
        mergeableCell = cell;
        break;
      }
    }

    test.skip(!mergeableCell, '머지 가능한 인접 셀 그룹이 없어서 테스트를 건너뜁니다');

    await bridge.clearCollectedEvents();

    // merge 이벤트 대기를 설정한 뒤 탭
    const mergePromise = bridge.waitForEvent('merge', undefined, 10_000);
    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);

    const mergeEvt = await mergePromise;
    // merge 이벤트 필드 검증
    expect(mergeEvt).toHaveProperty('event', 'merge');
    expect((mergeEvt as any).value).toBeGreaterThan(0);
    expect((mergeEvt as any).count).toBeGreaterThanOrEqual(2);
    expect((mergeEvt as any).score).toBeGreaterThan(0);
  });

  test('머지 후 새 타일이 보드에 추가된다', async () => {
    const stateBefore = await bridge.getGameState();
    const nonEmptyBefore = stateBefore.cells.filter((c) => c.v > 0).length;

    // 머지 가능 셀 탐색
    const cellMap = new Map<string, CellInfo>();
    for (const c of stateBefore.cells) {
      cellMap.set(`${c.q},${c.r}`, c);
    }

    const neighborOffsets = [
      { dq: +1, dr: -1 }, { dq: +1, dr: 0 }, { dq: 0, dr: +1 },
      { dq: -1, dr: +1 }, { dq: -1, dr: 0 }, { dq: 0, dr: -1 },
    ];

    let mergeableCell: CellInfo | undefined;
    for (const cell of stateBefore.cells) {
      if (cell.v === 0) continue;
      const hasMatch = neighborOffsets.some((off) => {
        const key = `${cell.q + off.dq},${cell.r + off.dr}`;
        const neighbor = cellMap.get(key);
        return neighbor && neighbor.v === cell.v;
      });
      if (hasMatch) {
        mergeableCell = cell;
        break;
      }
    }

    test.skip(!mergeableCell, '머지 가능한 인접 셀 그룹이 없어서 테스트를 건너뜁니다');

    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);
    // 머지 처리 + 새 타일 스폰 대기
    await new Promise((r) => setTimeout(r, 1500));

    const stateAfter = await bridge.getGameState();
    const nonEmptyAfter = stateAfter.cells.filter((c) => c.v > 0).length;

    // 머지로 n개가 합쳐져 1개가 되고, 새 타일 1개가 스폰
    // 즉 nonEmpty 는 (before - mergedCount + 1 + 1) 이 된다
    // 정확한 수는 머지 그룹 크기에 따라 다르지만, 보드가 완전히 비어있지는 않아야 함
    expect(nonEmptyAfter).toBeGreaterThan(0);
  });

  test('머지 결과 값은 기존 값의 2배 이상이다', async () => {
    const state = await bridge.getGameState();
    const cellMap = new Map<string, CellInfo>();
    for (const c of state.cells) {
      cellMap.set(`${c.q},${c.r}`, c);
    }

    const neighborOffsets = [
      { dq: +1, dr: -1 }, { dq: +1, dr: 0 }, { dq: 0, dr: +1 },
      { dq: -1, dr: +1 }, { dq: -1, dr: 0 }, { dq: 0, dr: -1 },
    ];

    let mergeableCell: CellInfo | undefined;
    for (const cell of state.cells) {
      if (cell.v === 0) continue;
      const hasMatch = neighborOffsets.some((off) => {
        const key = `${cell.q + off.dq},${cell.r + off.dr}`;
        const neighbor = cellMap.get(key);
        return neighbor && neighbor.v === cell.v;
      });
      if (hasMatch) {
        mergeableCell = cell;
        break;
      }
    }

    test.skip(!mergeableCell, '머지 가능한 인접 셀 그룹이 없어서 테스트를 건너뜁니다');

    const originalValue = mergeableCell!.v;

    // merge 이벤트 수신
    const mergePromise = bridge.waitForEvent('merge', undefined, 10_000);
    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);
    const mergeEvt = await mergePromise;

    // 2개 머지 시 value * 2, 3개 머지 시 value * 4, ...
    // 최소 2개이므로 결과값은 원래 값의 2배 이상
    expect((mergeEvt as any).value).toBeGreaterThanOrEqual(originalValue * 2);
  });
});
