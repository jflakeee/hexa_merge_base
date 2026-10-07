import { writeFileSync } from 'node:fs';
import { GRADE_ORDER, GRADE_WEIGHTS } from '../../../src/data/dropTable.js';

const total = Object.values(GRADE_WEIGHTS).reduce((sum, value) => sum + value, 0);
const dropChance = { idleKill: 1, survivalKill: 0.25, gacha: 1 };
const gachaCost = 20;
const cubeUpgradeCost = rank => (rank + 1) * 30;
const cubePathCost = (fromRank, toRank) => {
  const steps = toRank - fromRank;
  let inputs = 3 ** steps, gold = 0;
  for (let rank = fromRank; rank < toRank; rank++) {
    const operations = inputs / 3;
    gold += operations * cubeUpgradeCost(rank);
    inputs = operations;
  }
  return { sourceItems: 3 ** steps, cubeGold: gold };
};
const result = Object.fromEntries(GRADE_ORDER.map((grade, rank) => {
  const tailWeight = GRADE_ORDER.slice(rank).reduce((sum, key) => sum + GRADE_WEIGHTS[key], 0);
  const rollProbability = tailWeight / total;
  const trials95 = probability => probability >= 1 ? 1 : Math.ceil(Math.log(0.05) / Math.log1p(-probability));
  const p95Rolls = trials95(rollProbability);
  const sources = Object.fromEntries(Object.entries(dropChance).map(([source, chance]) => {
    const perEvent = chance * rollProbability;
    const p95Events = trials95(perEvent);
    return [source, {
      probabilityPerKillOrPull: perEvent,
      expectedEvents: 1 / perEvent,
      eventsFor95Percent: p95Events,
      gachaGoldFor95Percent: source === 'gacha' ? p95Events * gachaCost : null,
    }];
  }));
  return [grade, {
    probabilityPerItemRoll: rollProbability,
    expectedRolls: 1 / rollProbability,
    rollsFor95Percent: p95Rolls,
    sources,
    fromNormalByCube: rank ? cubePathCost(0, rank) : null,
  }];
}));
const report = JSON.stringify({ totalGradeWeight: total, assumptions: {
  idleItemRollsPerKill: 1,
  survivalItemRollChancePerKill: 0.25,
  gachaCost: 20,
  geometricIndependentRolls: true,
  cubeConsumesThreeIdentifiedUnsocketedItemsOfSameGrade: true,
  inventoryOverflowConvertsItemToGold: true,
  bossClearGuaranteesOneEpicItem: true,
}, grades: result }, null, 2);
writeFileSync(new URL('./reward-distribution.json', import.meta.url), `${report}\n`);
console.log(report);
