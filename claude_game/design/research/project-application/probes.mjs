// Read-only probes of imported game functions. No saved state or production data.
import { writeFileSync } from 'node:fs';
import { createCharacter } from '../../../src/state/models.js';
import { rollItem } from '../../../src/systems/items.js';
import { autoEquip, statTotal } from '../../../src/systems/autoEquip.js';
import { computeCombatStats } from '../../../src/systems/effectiveStats.js';
import { createArena } from '../../../src/systems/arena.js';
import { updateEncounters } from '../../../src/systems/encounters.js';

const character = createCharacter();
const weapon = rollItem(() => 0.5, { grade: 'set', slot: 'weapon', identified: true });
const armor = rollItem(() => 0.5, { grade: 'set', slot: 'armor', identified: true });
weapon.id = 'probe-set-weapon'; armor.id = 'probe-set-armor';
character.equippedItems = [weapon, armor];
const candidate = rollItem(() => 0.5, { grade: 'unique', slot: 'weapon', identified: true });
candidate.id = 'probe-unique-weapon';
const before = computeCombatStats(character);
const equip = autoEquip(candidate, character, 'normal');
const after = computeCombatStats(character);

const arena = createArena(390, 844, { encounter: 'boss' });
arena.player = { x: 150, y: 315, hp: 100 };
arena.patternTimer = 100; arena.packTimer = 100;
arena.hazards = [{ id: 999, type: 'charge', x: 50, y: 300,
  tx: 250, ty: 300, delay: 0, life: 0.35, active: false }];
const events = [];
updateEncounters(arena, 0.016, { def: 5 }, () => 0.5, events);
const result = {
  kind: 'function-level probes; not visual or user testing',
  autoEquip: { oldItemSum: statTotal(weapon), candidateSum: statTotal(candidate),
    equipped: equip.equipped,
    before: { atk: before.atk, def: before.def, crit: before.crit, setPieces: before.setPieces },
    after: { atk: after.atk, def: after.def, crit: after.crit, setPieces: after.setPieces },
    interpretation: 'Automatic replacement loses set bonus but gains crit; overall combat value not measured' },
  charge: { playerCenterDistanceToSegment: 15, hpAfter: arena.player.hp,
    hurt: events.some(e => e.type === 'hurt'),
    interpretation: 'Center-distance rule confirmed; visual width requires explicit player hitbox/contact-envelope review, not proof of unfairness' },
};
writeFileSync(new URL('./probe-results.json', import.meta.url), JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify(result, null, 2));
