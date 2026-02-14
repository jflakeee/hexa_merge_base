import { test, expect } from '@playwright/test';
import { UnityBridge, CellInfo } from '../helpers/unity-bridge';

/**
 * 스코어링 테스트
 *
 * 머지 시 점수 증가, scoreChanged 이벤트, 점수 정합성을 검증한다.
 */
test.describe('스코어링 - 점수 계산 및 이벤트 검증', () => {
  let bridge: UnityBridge;

  // 6방향 인접 오프셋 (테스트 전체에서 재사용)
  const neighborOffsets = [
    { dq: +1, dr: -1 }, { dq: +1, dr: 0 }, { dq: 0, dr: +1 },
    { dq: -1, dr: +1 }, { dq: -1, dr: 0 }, { dq: 0, dr: -1 },
  ];

  /** 현재 보드에서 머지 가능한 셀을 찾는 유틸리티 */
  async function findMergeableCell(): Promise<CellInfo | undefined> {
    const state = await bridge.getGameState();
    const cellMap = new Map<string, CellInfo>();
    for (const c of state.cells) {
      cellMap.set(`${c.q},${c.r}`, c);
    }

    for (const cell of state.cells) {
      if (cell.v === 0) continue;
      const hasMatch = neighborOffsets.some((off) => {
        const key = `${cell.q + off.dq},${cell.r + off.dr}`;
        const neighbor = cellMap.get(key);
        return neighbor && neighbor.v === cell.v;
      });
      if (hasMatch) return cell;
    }
    return undefined;
  }

  test.beforeEach(async ({ page }) => {
    bridge = new UnityBridge(page);
    await page.goto('/');
    await bridge.loadAndStartGame();
  });

  test('새 게임 시작 시 점수가 0이다', async () => {
    const score = await bridge.getCurrentScore();
    expect(score).toBe(0);
  });

  test('머지 성공 시 점수가 증가한다', async () => {
    const scoreBefore = await bridge.getCurrentScore();

    const mergeableCell = await findMergeableCell();
    test.skip(!mergeableCell, '머지 가능한 셀이 없어서 테스트를 건너뜁니다');

    // merge 이벤트 대기 후 탭
    const mergePromise = bridge.waitForEvent('merge', undefined, 10_000);
    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);
    await mergePromise;

    // 약간의 처리 대기
    await new Promise((r) => setTimeout(r, 500));

    const scoreAfter = await bridge.getCurrentScore();
    expect(scoreAfter).toBeGreaterThan(scoreBefore);
  });

  test('머지 시 scoreChanged 이벤트가 발생한다', async () => {
    const mergeableCell = await findMergeableCell();
    test.skip(!mergeableCell, '머지 가능한 셀이 없어서 테스트를 건너뜁니다');

    await bridge.clearCollectedEvents();

    // scoreChanged 이벤트 대기 설정
    const scorePromise = bridge.waitForEvent('scoreChanged', undefined, 10_000);
    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);

    const scoreEvt = await scorePromise;
    expect(scoreEvt).toHaveProperty('event', 'scoreChanged');
    expect((scoreEvt as any).score).toBeGreaterThan(0);
  });

  test('점수는 merge 이벤트의 score 값만큼 증가한다', async () => {
    const scoreBefore = await bridge.getCurrentScore();

    const mergeableCell = await findMergeableCell();
    test.skip(!mergeableCell, '머지 가능한 셀이 없어서 테스트를 건너뜁니다');

    // merge 이벤트로 획득 점수 확인
    const mergePromise = bridge.waitForEvent('merge', undefined, 10_000);
    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);
    const mergeEvt = await mergePromise;
    const scoreGained = (mergeEvt as any).score;

    // 처리 대기
    await new Promise((r) => setTimeout(r, 500));

    const scoreAfter = await bridge.getCurrentScore();
    // merge 이벤트의 score = resultValue * mergedCount (MergeSystem.cs 참고)
    expect(scoreAfter).toBe(scoreBefore + scoreGained);
  });

  test('merge 이벤트의 score 는 value * count 와 일치한다', async () => {
    const mergeableCell = await findMergeableCell();
    test.skip(!mergeableCell, '머지 가능한 셀이 없어서 테스트를 건너뜁니다');

    const mergePromise = bridge.waitForEvent('merge', undefined, 10_000);
    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);
    const mergeEvt = await mergePromise;

    const { value, count, score } = mergeEvt as any;
    // ScoreGained = ResultValue * MergedCount (MergeSystem.cs 라인 94)
    expect(score).toBe(value * count);
  });

  test('여러 번 머지 시 점수가 누적된다', async () => {
    let totalScoreGained = 0;

    // 최대 3회 머지 시도
    for (let attempt = 0; attempt < 3; attempt++) {
      const mergeableCell = await findMergeableCell();
      if (!mergeableCell) break;

      const mergePromise = bridge.waitForEvent('merge', undefined, 10_000);
      await bridge.tapCell(mergeableCell.q, mergeableCell.r);

      try {
        const mergeEvt = await mergePromise;
        totalScoreGained += (mergeEvt as any).score;
      } catch {
        // 머지 실패 시 무시하고 다음 시도
        break;
      }

      // 다음 탭 전 대기
      await new Promise((r) => setTimeout(r, 800));
    }

    // 한 번이라도 머지에 성공했으면 점수가 누적되었는지 확인
    if (totalScoreGained > 0) {
      const currentScore = await bridge.getCurrentScore();
      expect(currentScore).toBe(totalScoreGained);
    }
  });

  test('게임 상태의 score 와 scoreChanged 이벤트 값이 일치한다', async () => {
    const mergeableCell = await findMergeableCell();
    test.skip(!mergeableCell, '머지 가능한 셀이 없어서 테스트를 건너뜁니다');

    // scoreChanged 이벤트 수신
    const scorePromise = bridge.waitForEvent('scoreChanged', undefined, 10_000);
    await bridge.tapCell(mergeableCell!.q, mergeableCell!.r);
    const scoreEvt = await scorePromise;
    const eventScore = (scoreEvt as any).score;

    // 게임 상태로 조회한 점수와 비교
    await new Promise((r) => setTimeout(r, 500));
    const stateScore = await bridge.getCurrentScore();

    expect(stateScore).toBe(eventScore);
  });
});
