# MVP Integration Fixes — Implementation Plan (Tasks 15-21)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the integration gaps found by the final whole-branch review of `docs/superpowers/plans/2026-10-02-idle-vampire-hybrid-game.md` (Tasks 1-14, all individually spec/quality-approved but not wired together end-to-end). Specifically: wire up leveling/skill points, make equipment/stats affect gameplay, add touch input to combat, stop losing replaced equipment, make combat actually fullscreen with persisted idle progress, harden persistence against storage failures, and give the settings tab one real control.

**Architecture:** Same pure-logic/Phaser-glue separation as the base plan. New pure modules get Vitest unit tests; Phaser scene edits are verified via build + existing test suite (no new scene-level tests, consistent with Tasks 10/12).

**Tech Stack:** Same as base plan (Vite, Phaser 3, Vitest).

Base plan: `docs/superpowers/plans/2026-10-02-idle-vampire-hybrid-game.md`
Base spec: `docs/superpowers/specs/2026-10-02-idle-vampire-hybrid-game-design.md`

**Scope decision (resolves spec ambiguity flagged in final review):** the spec's UI-layout section describes a "상점/거래" tab alongside its narrower "MVP 시스템 범위" section, which never lists shop/trading as one of the three built systems. We keep the shop tab as **display-only** for this MVP (already built in Task 13) and move actual buy/sell functionality to the "추후 확장 로드맵" section of the base spec. Task 21 below adds a real control to the **settings** tab instead (auto-equip grade cycling), which was unambiguously in scope and trivial to wire.

---

### Task 15: 레벨업 시스템 (경험치 → 레벨 → 스킬 포인트)

**Files:**
- Create: `src/systems/leveling.js`
- Test: `tests/systems/leveling.test.js`
- Modify: `src/scenes/IdleScene.js` (call `applyLevelUps` after each idle kill tick)
- Modify: `src/scenes/CombatScene.js` (call `applyLevelUps` after `settleCombat`)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/leveling.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { expThreshold, applyLevelUps } from '../../src/systems/leveling.js';

describe('expThreshold', () => {
  it('레벨 * 50 을 반환한다', () => {
    expect(expThreshold(1)).toBe(50);
    expect(expThreshold(3)).toBe(150);
  });
});

describe('applyLevelUps', () => {
  it('경험치가 기준치 미만이면 레벨업하지 않는다', () => {
    const character = { level: 1, exp: 10, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(false);
    expect(character.level).toBe(1);
    expect(character.exp).toBe(10);
    expect(character.skillPoints).toBe(0);
  });

  it('경험치가 기준치 이상이면 레벨업하고 스킬 포인트를 1 지급한다', () => {
    const character = { level: 1, exp: 50, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(true);
    expect(character.level).toBe(2);
    expect(character.exp).toBe(0);
    expect(character.skillPoints).toBe(1);
  });

  it('한 번에 여러 레벨업이 가능하면 반복해서 처리한다', () => {
    const character = { level: 1, exp: 50 + 100 + 5, skillPoints: 0 };
    const leveledUp = applyLevelUps(character);
    expect(leveledUp).toBe(true);
    expect(character.level).toBe(3);
    expect(character.exp).toBe(5);
    expect(character.skillPoints).toBe(2);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/leveling.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/leveling.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/leveling.js`:
```js
export function expThreshold(level) {
  return level * 50;
}

export function applyLevelUps(character) {
  let leveledUp = false;
  while (character.exp >= expThreshold(character.level)) {
    character.exp -= expThreshold(character.level);
    character.level += 1;
    character.skillPoints += 1;
    leveledUp = true;
  }
  return leveledUp;
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/leveling.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: IdleScene에 연결**

`src/scenes/IdleScene.js`의 `import` 블록에 추가:
```js
import { applyLevelUps } from '../systems/leveling.js';
```

`update()`의 tick 블록 안, `resolveIdleKill(...)` 호출 직후에 추가:
```js
      resolveIdleKill({
        character: state.character,
        currency: state.currency,
        inventory: state.inventory,
        autoEquipMinGrade: state.settings.autoEquipMinGrade,
      });
      applyLevelUps(state.character);
      store.notify();
```

- [ ] **Step 6: CombatScene에 연결**

`src/scenes/CombatScene.js`의 `import` 블록에 추가:
```js
import { applyLevelUps } from '../systems/leveling.js';
```

`endCombat()`에서 `settleCombat(...)` 호출 직후에 추가:
```js
  endCombat() {
    if (this.enemyHitTimer) this.enemyHitTimer.remove();
    const state = store.getState();
    settleCombat(this.session, state.currency, state.character);
    applyLevelUps(state.character);
    store.notify();
    this.scene.start('IdleScene');
  }
```

- [ ] **Step 7: 빌드/테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 기존 50개 + 신규 4개 = 54개 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/systems/leveling.js tests/systems/leveling.test.js src/scenes/IdleScene.js src/scenes/CombatScene.js
git commit -m "feat: add leveling system and wire skill-point grants into both combat modes"
```

---

### Task 16: 장비/스킬 스탯이 실제 게임플레이에 반영되도록 연결

**Files:**
- Create: `src/systems/effectiveStats.js`
- Test: `tests/systems/effectiveStats.test.js`
- Modify: `src/scenes/IdleScene.js` (effectiveStats.atk가 높을수록 킬 틱 간격이 짧아짐)
- Modify: `src/scenes/CombatScene.js` (effectiveStats.def가 높을수록 피격 데미지 감소)

**Depends on:** Task 7 (skills — `applySkillEffects`), Task 6 (autoEquip — `character.equippedItems` shape)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/effectiveStats.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { computeEffectiveStats } from '../../src/systems/effectiveStats.js';

function baseCharacter() {
  return {
    stats: { atk: 100, def: 50 },
    equippedItems: [],
    skills: {},
  };
}

describe('computeEffectiveStats', () => {
  it('장비도 스킬도 없으면 기본 스탯을 그대로 반환한다', () => {
    expect(computeEffectiveStats(baseCharacter())).toEqual({ atk: 100, def: 50 });
  });

  it('장비의 statBonus를 기본 스탯에 더한다', () => {
    const character = baseCharacter();
    character.equippedItems = [
      { statBonus: { atk: 10 } },
      { statBonus: { atk: 5, def: 3 } },
    ];
    expect(computeEffectiveStats(character)).toEqual({ atk: 115, def: 53 });
  });

  it('장비 보너스를 더한 뒤 스킬 배율을 곱한다', () => {
    const character = baseCharacter();
    character.equippedItems = [{ statBonus: { atk: 10 } }];
    character.skills = { power_strike: 1 };
    // (100 + 10) * 1.1 = 121
    expect(computeEffectiveStats(character)).toEqual({ atk: 121, def: 50 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/effectiveStats.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/effectiveStats.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/effectiveStats.js`:
```js
import { applySkillEffects } from '../data/skills.js';

export function computeEffectiveStats(character) {
  const gearBonus = character.equippedItems.reduce((acc, item) => {
    for (const [stat, value] of Object.entries(item.statBonus)) {
      acc[stat] = (acc[stat] || 0) + value;
    }
    return acc;
  }, {});

  const baseWithGear = {
    atk: character.stats.atk + (gearBonus.atk || 0),
    def: character.stats.def + (gearBonus.def || 0),
  };

  return applySkillEffects({ stats: baseWithGear, skills: character.skills });
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/effectiveStats.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: IdleScene에 연결 — atk가 높을수록 킬 틱이 빨라짐**

`src/scenes/IdleScene.js`의 `import` 블록에 추가:
```js
import { computeEffectiveStats } from '../systems/effectiveStats.js';
```

`update(time, delta)` 내부, 기존:
```js
    if (this.tickAccumulator >= IDLE_COMBAT_TICK_MS) {
      this.tickAccumulator -= IDLE_COMBAT_TICK_MS;
```
를 다음으로 교체:
```js
    const state = store.getState();
    const effectiveStats = computeEffectiveStats(state.character);
    const killIntervalMs = Math.max(300, IDLE_COMBAT_TICK_MS - effectiveStats.atk * 5);

    if (this.tickAccumulator >= killIntervalMs) {
      this.tickAccumulator -= killIntervalMs;
```

(이 블록 안쪽에서 기존에 `const state = store.getState();`를 다시 선언하던 줄은 중복이므로 제거하고, 위에서 미리 구한 `state`를 그대로 사용합니다.)

- [ ] **Step 6: CombatScene에 연결 — def가 높을수록 피격 데미지 감소**

`src/scenes/CombatScene.js`의 `import` 블록에 추가:
```js
import { computeEffectiveStats } from '../systems/effectiveStats.js';
```

`create()`에서 `this.playerHp = 100;` 다음 줄에 추가:
```js
    const state = store.getState();
    this.effectiveStats = computeEffectiveStats(state.character);
```

`create()`의 `enemyHitTimer` 콜백:
```js
      callback: () => {
        this.playerHp = Math.max(0, this.playerHp - ENEMY_HIT_DAMAGE);
      },
```
을 다음으로 교체:
```js
      callback: () => {
        const mitigatedDamage = Math.max(1, ENEMY_HIT_DAMAGE - Math.floor(this.effectiveStats.def / 10));
        this.playerHp = Math.max(0, this.playerHp - mitigatedDamage);
      },
```

- [ ] **Step 7: 빌드/테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 기존 54개 + 신규 3개 = 57개 전부 PASS

- [ ] **Step 8: 커밋**

```bash
git add src/systems/effectiveStats.js tests/systems/effectiveStats.test.js src/scenes/IdleScene.js src/scenes/CombatScene.js
git commit -m "feat: make equipment and skill stats affect idle kill speed and combat damage"
```

---

### Task 17: CombatScene 터치/드래그 이동 입력 추가

**Files:**
- Modify: `src/scenes/CombatScene.js`

- [ ] **Step 1: 포인터 드래그 이동 핸들러 추가**

`src/scenes/CombatScene.js`의 `create()`에서, 기존 `this.cursors = this.input.keyboard ? ... : null;` 줄 다음에 추가:
```js
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      this.player.x = Phaser.Math.Clamp(pointer.x, 10, this.scale.width - 10);
      this.player.y = Phaser.Math.Clamp(pointer.y, 10, this.scale.height - 10);
    });
```

키보드 커서 입력(`this.cursors`)은 그대로 유지합니다 — 데스크톱 테스트용으로 남겨두고, 터치 드래그가 모바일의 기본 조작이 됩니다. 단, "← 나가기" 버튼 영역 위에서 드래그가 시작되면 버튼 클릭과 충돌하지 않도록, 나가기 버튼의 `pointerdown` 핸들러는 기존 그대로 두면 됩니다(버튼 자체의 `pointerdown`이 버블링되어도 `pointermove`의 `pointer.isDown` 체크는 버튼 클릭 자체를 막지 않음 — Phaser는 인터랙티브 오브젝트의 클릭과 씬 전역 포인터 이벤트를 독립적으로 처리합니다).

- [ ] **Step 2: 빌드 검증 (수동, 브라우저 없는 환경 대응)**

Run: `npm run build` → 성공해야 함 (import 경로 문제 없음을 확인)
Run: `npm test` → 기존 테스트 전부 PASS (이 변경은 Phaser 입력 로직이라 신규 유닛 테스트 없음, Task 10/12와 동일한 정책)
Dev 서버 스모크 체크: 백그라운드로 `npm run dev` 기동 후 curl로 200 확인, 콘솔 에러 없는지 확인 후 프로세스 종료

- [ ] **Step 3: 커밋**

```bash
git add src/scenes/CombatScene.js
git commit -m "feat: add touch/drag movement input to CombatScene"
```

---

### Task 18: 자동 장착으로 교체된 기존 장비를 인벤토리로 회수

**Files:**
- Modify: `src/systems/idleCombat.js`
- Modify: `tests/systems/idleCombat.test.js` (새 테스트 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/systems/idleCombat.test.js`의 `resolveIdleKill` describe 블록 안에 테스트 추가:
```js
  it('자동 장착으로 기존 장비가 교체되면 인벤토리로 회수된다', () => {
    const existing = { id: 'old', name: '기존 장비', grade: 'normal', statBonus: { atk: 1 }, slot: 'weapon' };
    const character = { equippedItems: [existing], exp: 0 };
    const currency = { gold: 0 };
    const inventory = [];

    resolveIdleKill({
      character,
      currency,
      inventory,
      autoEquipMinGrade: 'normal',
      randomFn: () => 0,
    });

    expect(character.equippedItems).toHaveLength(1);
    expect(character.equippedItems[0]).not.toBe(existing);
    expect(inventory).toContainEqual(existing);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/idleCombat.test.js`
Expected: FAIL — 새 테스트에서 `inventory`가 비어있어 `toContainEqual(existing)` 실패

- [ ] **Step 3: 구현 수정**

`src/systems/idleCombat.js`의 `resolveIdleKill` 마지막 부분:
```js
  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  if (!autoEquipResult.equipped) {
    addItemToInventory(inventory, item, currency, false);
  }
  return { goldDrop, expDrop, item, autoEquipResult };
```
를 다음으로 교체:
```js
  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  if (!autoEquipResult.equipped) {
    addItemToInventory(inventory, item, currency, false);
  } else if (autoEquipResult.replaced) {
    addItemToInventory(inventory, autoEquipResult.replaced, currency, false);
  }
  return { goldDrop, expDrop, item, autoEquipResult };
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/idleCombat.test.js`
Expected: PASS (기존 4개 + 신규 1개 = 5개)

- [ ] **Step 5: 커밋**

```bash
git add src/systems/idleCombat.js tests/systems/idleCombat.test.js
git commit -m "fix: recover replaced equipment into inventory instead of discarding it"
```

---

### Task 19: 전투 진입 시 실제 풀스크린 전환 + 방치 진행도 영속화

**Files:**
- Modify: `src/state/models.js` (`createRunState`에 `distancePx` 필드 추가)
- Modify: `tests/state/models.test.js` (기대값 업데이트)
- Modify: `src/scenes/IdleScene.js` (로컬 progress 대신 `store`의 `runState`를 직접 사용)
- Modify: `src/scenes/CombatScene.js` (진입/종료 시 `#bottom-panel` 표시 토글)

- [ ] **Step 1: models.js 테스트 업데이트**

`tests/state/models.test.js`의 `createRunState` 테스트:
```js
describe('createRunState', () => {
  it('기본값 idle 모드, stageIndex 0, distancePx 0을 가진다', () => {
    expect(createRunState()).toEqual({ mode: 'idle', stageIndex: 0, combatTimer: 0, distancePx: 0 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/state/models.test.js`
Expected: FAIL — 실제 반환값에 `distancePx`가 없음

- [ ] **Step 3: models.js 수정**

`src/state/models.js`의 `createRunState`:
```js
export function createRunState() {
  return { mode: 'idle', stageIndex: 0, combatTimer: 0, distancePx: 0 };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/state/models.test.js`
Expected: PASS

- [ ] **Step 5: IdleScene이 로컬 progress 대신 store.runState를 사용하도록 수정**

`src/scenes/IdleScene.js`의 `create()`에서 기존:
```js
    this.progress = createIdleProgress();
```
를 다음으로 교체:
```js
    this.progress = store.getState().runState;
```

`import` 블록에서 더 이상 쓰지 않는 `createIdleProgress`는 import 목록에서 제거합니다(사용하지 않는 import는 남기지 않음). `advanceIdleProgress`, `resolveIdleKill`, `STAGE_LENGTH_PX`, `IDLE_COMBAT_TICK_MS`는 그대로 유지합니다.

이렇게 하면 `this.progress`가 `store`의 `runState` 객체를 직접 참조하므로, `advanceIdleProgress(this.progress, delta)` 호출이 store 상태를 그대로 변경하고, 이는 Task 4의 autosave/beforeunload에 의해 자동으로 영속화됩니다. 전투 모드로 갔다가 돌아와도 `IdleScene.create()`가 다시 호출될 때 동일한 `store.getState().runState` 객체를 다시 집어오므로 진행도가 리셋되지 않습니다.

- [ ] **Step 6: CombatScene이 진입/종료 시 하단 패널을 숨기고 복원하도록 수정**

`src/scenes/CombatScene.js`의 `create()` 맨 앞에 추가:
```js
  create() {
    const bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) bottomPanel.style.display = 'none';

    this.session = createCombatSession();
    this.playerHp = 100;
    // ... (이하 기존 코드 그대로)
```

`endCombat()`에서 `this.scene.start('IdleScene');` 바로 앞에 추가:
```js
  endCombat() {
    if (this.enemyHitTimer) this.enemyHitTimer.remove();
    const bottomPanel = document.getElementById('bottom-panel');
    if (bottomPanel) bottomPanel.style.display = '';
    const state = store.getState();
    settleCombat(this.session, state.currency, state.character);
    applyLevelUps(state.character);
    store.notify();
    this.scene.start('IdleScene');
  }
```

(Task 15에서 이미 `applyLevelUps` 호출을 추가했다면 그 줄은 유지하고, 패널 복원 코드만 그 사이에 끼워 넣습니다.)

- [ ] **Step 7: 빌드/테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS (models.test.js 기대값 변경 반영된 상태로)
Dev 서버 스모크 체크: 백그라운드 기동 → curl 200 확인 → 종료

- [ ] **Step 8: 커밋**

```bash
git add src/state/models.js tests/state/models.test.js src/scenes/IdleScene.js src/scenes/CombatScene.js
git commit -m "fix: persist idle stage progress via store and make combat a real fullscreen takeover"
```

---

### Task 20: localStorage 접근 실패에도 부팅이 죽지 않도록 방어

**Files:**
- Modify: `src/state/persistence.js`
- Modify: `tests/state/persistence.test.js` (새 테스트 추가)

- [ ] **Step 1: 실패하는 테스트 추가**

`tests/state/persistence.test.js`에 추가:
```js
function createThrowingStorage() {
  return {
    getItem: () => { throw new Error('storage unavailable'); },
    setItem: () => { throw new Error('storage unavailable'); },
    removeItem: () => { throw new Error('storage unavailable'); },
  };
}

describe('persistence — storage 자체가 실패하는 경우', () => {
  it('loadState는 storage.getItem이 throw해도 null을 반환한다', () => {
    expect(loadState(createThrowingStorage())).toBeNull();
  });

  it('saveState는 storage.setItem이 throw해도 예외를 던지지 않는다', () => {
    expect(() => saveState({ currency: { gold: 1 } }, createThrowingStorage())).not.toThrow();
  });

  it('clearState는 storage.removeItem이 throw해도 예외를 던지지 않는다', () => {
    expect(() => clearState(createThrowingStorage())).not.toThrow();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/state/persistence.test.js`
Expected: FAIL — 현재 구현은 `getItem`/`setItem`/`removeItem` 호출을 try/catch로 감싸지 않아 예외가 그대로 전파됨

- [ ] **Step 3: 구현 수정**

`src/state/persistence.js` 전체를 다음으로 교체:
```js
const STORAGE_KEY = 'claude_game_save_v1';

function resolveStorage(storage) {
  return storage || globalThis.localStorage;
}

export function saveState(state, storage) {
  try {
    resolveStorage(storage).setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    // storage unavailable or quota exceeded — continue without persisting this save
  }
}

export function loadState(storage) {
  let raw;
  try {
    raw = resolveStorage(storage).getItem(STORAGE_KEY);
  } catch (e) {
    return null;
  }
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearState(storage) {
  try {
    resolveStorage(storage).removeItem(STORAGE_KEY);
  } catch (e) {
    // storage unavailable — nothing to clear
  }
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/state/persistence.test.js`
Expected: PASS (기존 4개 + 신규 3개 = 7개)

- [ ] **Step 5: 커밋**

```bash
git add src/state/persistence.js tests/state/persistence.test.js
git commit -m "fix: guard persistence against localStorage access throwing (private mode, sandboxed webviews)"
```

---

### Task 21: 설정 탭에 실제 조작 가능한 컨트롤 추가 (자동 장착 등급 순환)

**Files:**
- Modify: `src/ui/BottomPanel.js`
- Modify: `tests/ui/BottomPanel.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ui/BottomPanel.test.js`의 settings 탭 테스트를 다음으로 교체:
```js
  it('settings 탭: 자동 장착 최소 등급과 변경 버튼을 보여준다', () => {
    const html = renderTab('settings', baseState());
    expect(html).toContain('normal');
    expect(html).toContain('data-action="cycle-auto-equip-grade"');
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/ui/BottomPanel.test.js`
Expected: FAIL — 현재 settings 탭 HTML에 `data-action="cycle-auto-equip-grade"`가 없음

- [ ] **Step 3: 구현 수정**

`src/ui/BottomPanel.js` 상단에 등급 목록 import 추가:
```js
import { store } from '../state/globalStore.js';
import { GRADE_ORDER } from '../data/dropTable.js';
```

`renderTab`의 `settings` 분기를 다음으로 교체:
```js
  if (tab === 'settings') {
    return `
      <label>자동 장착 최소 등급: ${state.settings.autoEquipMinGrade}</label>
      <button data-action="cycle-auto-equip-grade" class="mock-button">등급 변경</button>
    `;
  }
```

`mountBottomPanel`에서 `render()` 함수 정의 다음, `container.querySelectorAll('.tab-button')...` 블록 다음에 클릭 위임 리스너를 추가:
```js
  content.addEventListener('click', (event) => {
    const button = event.target.closest('[data-action="cycle-auto-equip-grade"]');
    if (!button) return;
    const current = store.getState().settings.autoEquipMinGrade;
    const currentIndex = GRADE_ORDER.indexOf(current);
    const nextGrade = GRADE_ORDER[(currentIndex + 1) % GRADE_ORDER.length];
    store.setState({ settings: { ...store.getState().settings, autoEquipMinGrade: nextGrade } });
  });
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/ui/BottomPanel.test.js`
Expected: PASS (6개 전부, settings 테스트가 새 어서션으로 교체된 상태로)

- [ ] **Step 5: 빌드 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/ui/BottomPanel.js tests/ui/BottomPanel.test.js
git commit -m "feat: add working auto-equip grade cycle control to settings tab"
```

---

---

### Task 22: 스크랩북 시스템 (교체 장비 골드로 즉시 복원)

**Files:**
- Modify: `src/state/store.js` (`scrapbook: []` 기본 상태 추가)
- Create: `src/systems/scrapbook.js`
- Test: `tests/systems/scrapbook.test.js`
- Modify: `src/systems/idleCombat.js` (`resolveIdleKill`이 `inventory` 대신 `scrapbook`으로 교체 장비를 회수하도록 변경 — Task 18의 동작을 대체)
- Modify: `tests/systems/idleCombat.test.js` (Task 18에서 추가한 테스트를 스크랩북 기준으로 교체)
- Modify: `src/scenes/IdleScene.js` (`resolveIdleKill` 호출에 `scrapbook` 전달)
- Modify: `src/ui/BottomPanel.js` (장비 탭에 스크랩북 목록 + 복원 버튼 추가)

**결정 사항(사용자 확정):** 복원 시 즉시 재장착되고, 기존 장착 아이템은 다시 스크랩북으로 들어간다. 복원 비용은 Task 8의 등급별 골드 가치(`itemGoldValue`)를 그대로 재사용한다.

- [ ] **Step 1: scrapbook.js 실패하는 테스트 작성**

`tests/systems/scrapbook.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { restoreCost, restoreFromScrapbook } from '../../src/systems/scrapbook.js';

const item = (id, grade, slot = 'weapon') => ({ id, name: id, grade, statBonus: {}, slot });

describe('restoreCost', () => {
  it('등급별 골드 가치를 그대로 반환한다', () => {
    expect(restoreCost(item('a', 'normal'))).toBe(5);
    expect(restoreCost(item('b', 'epic'))).toBe(100);
  });
});

describe('restoreFromScrapbook', () => {
  it('스크랩북에 없는 아이템이면 실패한다', () => {
    const result = restoreFromScrapbook([], { equippedItems: [] }, { gold: 1000 }, 'missing');
    expect(result).toEqual({ restored: false, reason: 'not_found' });
  });

  it('골드가 부족하면 실패하고 골드/스크랩북을 바꾸지 않는다', () => {
    const scrapped = item('s1', 'epic');
    const scrapbook = [scrapped];
    const currency = { gold: 10 };
    const result = restoreFromScrapbook(scrapbook, { equippedItems: [] }, currency, 's1');
    expect(result).toEqual({ restored: false, reason: 'insufficient_gold' });
    expect(currency.gold).toBe(10);
    expect(scrapbook).toHaveLength(1);
  });

  it('성공하면 골드를 소모하고 즉시 재장착하며, 기존 장착 아이템은 스크랩북으로 들어간다', () => {
    const scrapped = item('s1', 'normal');
    const currentlyEquipped = item('cur', 'magic');
    const scrapbook = [scrapped];
    const character = { equippedItems: [currentlyEquipped] };
    const currency = { gold: 100 };

    const result = restoreFromScrapbook(scrapbook, character, currency, 's1');

    expect(result.restored).toBe(true);
    expect(result.cost).toBe(5);
    expect(currency.gold).toBe(95);
    expect(character.equippedItems).toEqual([scrapped]);
    expect(scrapbook).toEqual([currentlyEquipped]);
  });

  it('해당 슬롯에 장착된 장비가 없으면 그냥 장착하고 스크랩북에는 아무것도 추가되지 않는다', () => {
    const scrapped = item('s1', 'normal');
    const scrapbook = [scrapped];
    const character = { equippedItems: [] };
    const currency = { gold: 100 };

    const result = restoreFromScrapbook(scrapbook, character, currency, 's1');

    expect(result.restored).toBe(true);
    expect(character.equippedItems).toEqual([scrapped]);
    expect(scrapbook).toEqual([]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/scrapbook.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/scrapbook.js'`

- [ ] **Step 3: scrapbook.js 최소 구현 작성**

`src/systems/scrapbook.js`:
```js
import { itemGoldValue } from './inventory.js';

export function restoreCost(item) {
  return itemGoldValue(item);
}

export function restoreFromScrapbook(scrapbook, character, currency, itemId) {
  const idx = scrapbook.findIndex((i) => i.id === itemId);
  if (idx < 0) return { restored: false, reason: 'not_found' };

  const item = scrapbook[idx];
  const cost = restoreCost(item);
  if (currency.gold < cost) return { restored: false, reason: 'insufficient_gold' };

  currency.gold -= cost;
  scrapbook.splice(idx, 1);

  const slotIdx = character.equippedItems.findIndex((i) => i.slot === item.slot);
  const previouslyEquipped = slotIdx >= 0 ? character.equippedItems[slotIdx] : null;
  if (slotIdx >= 0) {
    character.equippedItems[slotIdx] = item;
  } else {
    character.equippedItems.push(item);
  }
  if (previouslyEquipped) {
    scrapbook.push(previouslyEquipped);
  }
  return { restored: true, cost, previouslyEquipped };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/scrapbook.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: store.js에 scrapbook 기본 상태 추가**

`src/state/store.js`의 `createStore()` 내부 상태 객체:
```js
  const state = {
    character: createCharacter(),
    currency: createCurrency(),
    inventory: [],
    scrapbook: [],
    settings: { autoEquipMinGrade: 'normal' },
    runState: createRunState(),
  };
```

`tests/state/store.test.js`의 첫 번째 테스트(`기본 상태에 ... 포함한다`)에 다음 어서션 추가:
```js
    expect(state.scrapbook).toEqual([]);
```

- [ ] **Step 6: idleCombat.js가 교체 장비를 inventory 대신 scrapbook으로 보내도록 변경**

`src/systems/idleCombat.js`의 `resolveIdleKill` 시그니처와 본문을 다음으로 교체:
```js
export function resolveIdleKill({ character, currency, inventory, scrapbook, autoEquipMinGrade, randomFn = Math.random }) {
  const goldDrop = 2;
  const expDrop = 3;
  currency.gold += goldDrop;
  character.exp += expDrop;

  const grade = rollGrade(randomFn);
  const item = {
    id: `item_${Date.now()}_${Math.floor(randomFn() * 100000)}`,
    name: `${grade} 장비`,
    grade,
    statBonus: { atk: 1 },
    slot: 'weapon',
  };

  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  if (!autoEquipResult.equipped) {
    addItemToInventory(inventory, item, currency, false);
  } else if (autoEquipResult.replaced) {
    scrapbook.push(autoEquipResult.replaced);
  }
  return { goldDrop, expDrop, item, autoEquipResult };
}
```

`tests/systems/idleCombat.test.js`에서 Task 18이 추가했던 "자동 장착으로 기존 장비가 교체되면 인벤토리로 회수된다" 테스트를 다음으로 교체(인벤토리 대신 scrapbook을 검증):
```js
  it('자동 장착으로 기존 장비가 교체되면 스크랩북으로 회수된다', () => {
    const existing = { id: 'old', name: '기존 장비', grade: 'normal', statBonus: {}, slot: 'weapon' };
    const character = { equippedItems: [existing], exp: 0 };
    const currency = { gold: 0 };
    const inventory = [];
    const scrapbook = [];

    resolveIdleKill({
      character,
      currency,
      inventory,
      scrapbook,
      autoEquipMinGrade: 'normal',
      randomFn: () => 0,
    });

    expect(character.equippedItems).toHaveLength(1);
    expect(character.equippedItems[0]).not.toBe(existing);
    expect(scrapbook).toContainEqual(existing);
    expect(inventory).toHaveLength(0);
  });
```

같은 파일의 다른 두 테스트(`골드/경험치를 지급하고...`, `드롭 등급이 자동장착 기준을...`)도 `resolveIdleKill` 호출에 `scrapbook: []`를 추가해야 합니다(그렇지 않으면 `scrapbook.push`에서 `undefined`를 push하려다 에러가 납니다 — 단, 기존 두 테스트는 `autoEquipResult.replaced`가 발생하지 않는 시나리오이므로 `scrapbook`이 실제로 쓰이진 않지만, 함수 시그니처가 바뀌었으니 호출부에 인자를 맞춰주는 것이 안전합니다).

- [ ] **Step 7: IdleScene.js가 scrapbook을 전달하도록 수정**

`src/scenes/IdleScene.js`의 `resolveIdleKill(...)` 호출:
```js
      resolveIdleKill({
        character: state.character,
        currency: state.currency,
        inventory: state.inventory,
        scrapbook: state.scrapbook,
        autoEquipMinGrade: state.settings.autoEquipMinGrade,
      });
```

- [ ] **Step 8: BottomPanel.js 장비 탭에 스크랩북 목록 + 복원 버튼 추가**

`src/ui/BottomPanel.js` 상단 import에 추가:
```js
import { itemGoldValue } from '../systems/inventory.js';
import { restoreFromScrapbook } from '../systems/scrapbook.js';
```

`renderTab`의 `equipment` 분기를 다음으로 교체:
```js
  if (tab === 'equipment') {
    const equippedHtml = state.character.equippedItems.length === 0
      ? '<li>장착한 장비 없음</li>'
      : state.character.equippedItems.map((i) => `<li>${i.name} (${i.grade})</li>`).join('');
    const scrapbook = state.scrapbook || [];
    const scrapbookHtml = scrapbook.length === 0
      ? '<p>스크랩북이 비어 있습니다.</p>'
      : `<ul>${scrapbook
          .map(
            (i) =>
              `<li>${i.name} (${i.grade}) · ${itemGoldValue(i)}G <button data-action="restore-scrapbook-item" data-item-id="${i.id}" class="mock-button">복원</button></li>`
          )
          .join('')}</ul>`;
    return `<ul>${equippedHtml}</ul><div class="section"><p class="label">스크랩북</p>${scrapbookHtml}</div>`;
  }
```

`mountBottomPanel`에서 `container.querySelectorAll('.tab-button')...` 블록 다음에 클릭 위임 리스너 추가:
```js
  content.addEventListener('click', (event) => {
    const restoreBtn = event.target.closest('[data-action="restore-scrapbook-item"]');
    if (!restoreBtn) return;
    const state = store.getState();
    restoreFromScrapbook(state.scrapbook, state.character, state.currency, restoreBtn.dataset.itemId);
    store.notify();
  });
```

(Task 21에서 `cycle-auto-equip-grade` 리스너를 이미 추가했다면, 같은 `content.addEventListener('click', ...)` 블록 안에서 `data-action` 값에 따라 분기하도록 합쳐야 합니다 — 두 개의 별도 `addEventListener('click', ...)`를 등록해도 동작은 하지만, 하나로 합치는 편이 더 깔끔합니다. 이미 등록된 리스너가 있다면 유지하고 새 조건 분기만 추가하세요.)

`tests/ui/BottomPanel.test.js`의 `equipment` 탭 테스트에 `state.scrapbook = []`를 `baseState()`에 추가하고, 스크랩북 표시를 검증하는 테스트를 추가:
```js
  it('equipment 탭: 스크랩북에 아이템이 있으면 복원 버튼과 함께 보여준다', () => {
    const state = baseState();
    state.scrapbook = [{ id: 'x1', name: '교체된 검', grade: 'rare', statBonus: {}, slot: 'weapon' }];
    const html = renderTab('equipment', state);
    expect(html).toContain('교체된 검 (rare)');
    expect(html).toContain('data-action="restore-scrapbook-item"');
    expect(html).toContain('data-item-id="x1"');
  });
```
`baseState()` 함수에도 `scrapbook: []` 필드를 추가하세요.

- [ ] **Step 9: 빌드/테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS

- [ ] **Step 10: 커밋**

```bash
git add src/state/store.js tests/state/store.test.js src/systems/scrapbook.js tests/systems/scrapbook.test.js src/systems/idleCombat.js tests/systems/idleCombat.test.js src/scenes/IdleScene.js src/ui/BottomPanel.js tests/ui/BottomPanel.test.js
git commit -m "feat: add scrapbook system for gold-cost equipment restoration"
```

---

### Task 23: 하단 UI 드래그 최소화

**Files:**
- Modify: `src/ui/BottomPanel.js`
- Modify: `src/style.css`

이 Task는 순수 DOM/CSS 상호작용이라 유닛 테스트 대상이 아닙니다(Task 13의 `mountBottomPanel`과 동일한 정책). 빌드 검증으로 대체합니다.

- [ ] **Step 1: 드래그 핸들 마크업 추가**

`src/ui/BottomPanel.js`의 `mountBottomPanel` 내부, `container.innerHTML = ...` 부분을 다음으로 교체:
```js
  container.innerHTML = `
    <div class="panel-handle" data-role="drag-handle"></div>
    <div class="tab-bar">
      ${TABS.map((t) => `<button data-tab="${t}" class="tab-button">${TAB_LABELS[t]}</button>`).join('')}
    </div>
    <div class="tab-content"></div>
  `;
```

- [ ] **Step 2: 드래그/탭 로직 추가**

`mountBottomPanel` 함수 끝부분(`store.subscribe(render); render();` 앞)에 추가:
```js
  const handle = container.querySelector('[data-role="drag-handle"]');
  let dragStartY = null;

  handle.addEventListener('pointerdown', (event) => {
    dragStartY = event.clientY;
  });

  handle.addEventListener('pointerup', (event) => {
    if (dragStartY === null) return;
    const deltaY = event.clientY - dragStartY;
    dragStartY = null;

    if (deltaY > 40) {
      container.classList.add('minimized');
    } else if (deltaY < -10 || Math.abs(deltaY) <= 5) {
      container.classList.remove('minimized');
    }
  });
```

- [ ] **Step 3: CSS 추가**

`src/style.css`에 추가:
```css
.panel-handle {
  width: 40px;
  height: 5px;
  margin: 6px auto;
  border-radius: 3px;
  background: #555;
  cursor: grab;
  touch-action: none;
}

#bottom-panel.minimized {
  flex: 0 0 auto;
}

#bottom-panel.minimized .tab-bar,
#bottom-panel.minimized .tab-content {
  display: none;
}
```

- [ ] **Step 4: 빌드 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS (이 Task는 신규 유닛 테스트 없음)

- [ ] **Step 5: 커밋**

```bash
git add src/ui/BottomPanel.js src/style.css
git commit -m "feat: add drag-to-minimize handle to bottom panel"
```

---

### Task 24: 상점 탭 — 랜덤 등급 장비 뽑기(가챠)

**Files:**
- Create: `src/systems/shop.js`
- Test: `tests/systems/shop.test.js`
- Modify: `src/ui/BottomPanel.js` (상점 탭에 뽑기 버튼 추가)
- Modify: `tests/ui/BottomPanel.test.js`

**Depends on:** Task 22 (scrapbook — 뽑은 아이템이 자동장착 교체를 트리거할 수 있으므로 동일한 scrapbook 회수 경로를 재사용)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/shop.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { pullGacha, GACHA_COST } from '../../src/systems/shop.js';

function baseArgs(overrides = {}) {
  return {
    character: { equippedItems: [] },
    currency: { gold: 100 },
    inventory: [],
    scrapbook: [],
    autoEquipMinGrade: 'epic',
    randomFn: () => 0,
    ...overrides,
  };
}

describe('pullGacha', () => {
  it('골드가 부족하면 실패하고 골드를 차감하지 않는다', () => {
    const args = baseArgs({ currency: { gold: 5 } });
    const result = pullGacha(args);
    expect(result).toEqual({ success: false, item: null });
    expect(args.currency.gold).toBe(5);
  });

  it('성공하면 GACHA_COST만큼 골드를 차감하고 아이템을 생성한다', () => {
    const args = baseArgs();
    const result = pullGacha(args);
    expect(result.success).toBe(true);
    expect(args.currency.gold).toBe(100 - GACHA_COST);
    expect(result.item.grade).toBe('normal');
  });

  it('자동장착 기준을 만족하면 인벤토리 대신 장착된다', () => {
    const args = baseArgs({ autoEquipMinGrade: 'normal' });
    const result = pullGacha(args);
    expect(result.autoEquipResult.equipped).toBe(true);
    expect(args.inventory).toHaveLength(0);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/shop.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/shop.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/shop.js`:
```js
import { rollGrade, gradeRank } from '../data/dropTable.js';
import { autoEquip } from './autoEquip.js';
import { addItemToInventory } from './inventory.js';

export const GACHA_COST = 20;

export function pullGacha({ character, currency, inventory, scrapbook, autoEquipMinGrade, randomFn = Math.random }) {
  if (currency.gold < GACHA_COST) return { success: false, item: null };
  currency.gold -= GACHA_COST;

  const grade = rollGrade(randomFn);
  const item = {
    id: `gacha_${Date.now()}_${Math.floor(randomFn() * 100000)}`,
    name: `${grade} 장비`,
    grade,
    statBonus: { atk: gradeRank(grade) + 1 },
    slot: 'weapon',
  };

  const autoEquipResult = autoEquip(item, character, autoEquipMinGrade);
  if (!autoEquipResult.equipped) {
    addItemToInventory(inventory, item, currency, false);
  } else if (autoEquipResult.replaced) {
    scrapbook.push(autoEquipResult.replaced);
  }

  return { success: true, item, autoEquipResult };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/shop.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: BottomPanel.js 상점 탭에 뽑기 버튼 추가**

`src/ui/BottomPanel.js` import에 추가:
```js
import { GACHA_COST, pullGacha } from '../systems/shop.js';
```

`renderTab`의 `shop` 분기를 다음으로 교체:
```js
  if (tab === 'shop') {
    return `
      <p>골드: ${state.currency.gold}</p>
      <button data-action="pull-gacha" class="mock-button">뽑기 (${GACHA_COST}골드)</button>
    `;
  }
```

`mountBottomPanel`의 클릭 위임 리스너(Task 22에서 만든 것, 또는 Task 21의 것)에 분기 추가 — 기존 리스너 함수 본문을 다음과 같은 형태로 합칩니다:
```js
  content.addEventListener('click', (event) => {
    const cycleBtn = event.target.closest('[data-action="cycle-auto-equip-grade"]');
    if (cycleBtn) {
      const current = store.getState().settings.autoEquipMinGrade;
      const currentIndex = GRADE_ORDER.indexOf(current);
      const nextGrade = GRADE_ORDER[(currentIndex + 1) % GRADE_ORDER.length];
      store.setState({ settings: { ...store.getState().settings, autoEquipMinGrade: nextGrade } });
      return;
    }

    const restoreBtn = event.target.closest('[data-action="restore-scrapbook-item"]');
    if (restoreBtn) {
      const state = store.getState();
      restoreFromScrapbook(state.scrapbook, state.character, state.currency, restoreBtn.dataset.itemId);
      store.notify();
      return;
    }

    const gachaBtn = event.target.closest('[data-action="pull-gacha"]');
    if (gachaBtn) {
      const state = store.getState();
      pullGacha({
        character: state.character,
        currency: state.currency,
        inventory: state.inventory,
        scrapbook: state.scrapbook,
        autoEquipMinGrade: state.settings.autoEquipMinGrade,
      });
      store.notify();
      return;
    }
  });
```

(Task 21/22에서 이미 비슷한 리스너를 추가했다면, 중복 등록하지 말고 위 형태로 하나의 리스너 안에 세 분기를 모두 합치세요.)

`tests/ui/BottomPanel.test.js`의 shop 탭 테스트를 다음으로 교체:
```js
  it('shop 탭: 보유 골드와 뽑기 버튼을 보여준다', () => {
    const html = renderTab('shop', baseState());
    expect(html).toContain('120');
    expect(html).toContain('data-action="pull-gacha"');
  });
```

- [ ] **Step 6: 빌드/테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS

- [ ] **Step 7: 커밋**

```bash
git add src/systems/shop.js tests/systems/shop.test.js src/ui/BottomPanel.js tests/ui/BottomPanel.test.js
git commit -m "feat: add gacha-style random equipment pull to shop tab"
```

---

---

### Task 25: 아이템 드롭 스탯에 등급별 편차 적용

**배경:** Task 22 코드 리뷰에서 발견된 문제 — `resolveIdleKill`이 생성하는 모든 아이템이 등급과 무관하게 항상 `statBonus: { atk: 1 }`이라서, 무기 슬롯이 한 번 채워지면 `shouldAutoEquip`의 엄격한 `>` 비교가 다시는 충족되지 않는다(동일 등급 드롭끼리는 영원히 스탯 합이 같으므로). 결과적으로 Task 22의 스크랩북과 Task 24의 상점 가챠가 실제 플레이에서는 거의 작동하지 않는다. 이 Task는 등급이 높을수록 드롭 아이템의 atk가 커지도록 고쳐서, 교체/스크랩북/가챠 경로가 실제로 동작하게 만든다.

**Files:**
- Modify: `src/systems/idleCombat.js`
- Modify: `tests/systems/idleCombat.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/idleCombat.test.js`의 `resolveIdleKill` describe 블록에 추가:
```js
  it('드롭 아이템의 atk는 등급이 높을수록 커진다', () => {
    const character = { equippedItems: [], exp: 0 };
    const currency = { gold: 0 };
    const inventory = [];
    const scrapbook = [];

    const normalResult = resolveIdleKill({
      character,
      currency,
      inventory,
      scrapbook,
      autoEquipMinGrade: 'epic',
      randomFn: () => 0,
    });
    const epicResult = resolveIdleKill({
      character,
      currency,
      inventory,
      scrapbook,
      autoEquipMinGrade: 'epic',
      randomFn: () => 0.99,
    });

    expect(normalResult.item.grade).toBe('normal');
    expect(epicResult.item.grade).toBe('epic');
    expect(epicResult.item.statBonus.atk).toBeGreaterThan(normalResult.item.statBonus.atk);
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/idleCombat.test.js`
Expected: FAIL — 현재는 모든 아이템이 `atk: 1`로 고정되어 있어 `epicResult.item.statBonus.atk > normalResult.item.statBonus.atk`가 거짓

- [ ] **Step 3: 구현 수정**

`src/systems/idleCombat.js` 상단 import:
```js
import { rollGrade, gradeRank } from '../data/dropTable.js';
```
(기존 `import { rollGrade } from '../data/dropTable.js';`를 위 줄로 교체 — `gradeRank`를 추가로 가져온다.)

`resolveIdleKill` 내부의 아이템 생성부:
```js
  const item = {
    id: `item_${Date.now()}_${Math.floor(randomFn() * 100000)}`,
    name: `${grade} 장비`,
    grade,
    statBonus: { atk: 1 },
    slot: 'weapon',
  };
```
를 다음으로 교체:
```js
  const item = {
    id: `item_${Date.now()}_${Math.floor(randomFn() * 100000)}`,
    name: `${grade} 장비`,
    grade,
    statBonus: { atk: gradeRank(grade) + 1 },
    slot: 'weapon',
  };
```
(normal→1, magic→2, rare→3, epic→4. `randomFn: () => 0`을 쓰는 기존 테스트들은 항상 normal 등급을 뽑으므로 `gradeRank('normal')+1 = 1`로 기존 값과 동일하여 깨지지 않는다 — 별도로 기존 테스트를 수정할 필요는 없다.)

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/idleCombat.test.js`
Expected: PASS (기존 5개 + 신규 1개 = 6개)

- [ ] **Step 5: 빌드/전체 테스트 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS (기존 67개 + 신규 1개 = 68개)

- [ ] **Step 6: 커밋**

```bash
git add src/systems/idleCombat.js tests/systems/idleCombat.test.js
git commit -m "fix: scale dropped item stats with grade so auto-equip upgrades actually trigger"
```

---

---

### Task 26: 드롭 아이템에 def 스탯도 함께 부여

**배경:** 최종 종합 리뷰에서 발견 — 모든 드롭/가챠 아이템이 `atk`만 가지고 있어서, `CombatScene`의 피해 경감 공식(`def` 기반)이 항상 고정값으로만 동작한다(아무리 장비를 올려도 전투 중 받는 피해가 줄지 않음). 아이템에 `def`도 함께 부여해서 실제로 변화가 생기게 한다. (슬롯을 분리하는 대신, 하나의 장비에 두 스탯을 모두 부여하는 가장 단순한 방식을 택해 RNG 호출 순서/기존 테스트에 영향을 주지 않는다.)

**Files:**
- Modify: `src/systems/idleCombat.js`
- Modify: `src/systems/shop.js`

- [ ] **Step 1:** `src/systems/idleCombat.js`의 아이템 생성부:
```js
    statBonus: { atk: gradeRank(grade) + 1 },
```
를 다음으로 교체:
```js
    statBonus: { atk: gradeRank(grade) + 1, def: gradeRank(grade) + 1 },
```

- [ ] **Step 2:** `src/systems/shop.js`의 아이템 생성부도 동일하게 교체:
```js
    statBonus: { atk: gradeRank(grade) + 1 },
```
→
```js
    statBonus: { atk: gradeRank(grade) + 1, def: gradeRank(grade) + 1 },
```

- [ ] **Step 3: 검증**

기존 테스트는 `statBonus.atk` 값만 비교하므로(`toEqual`로 전체 객체를 비교하는 테스트는 없음 — 있다면 확인 후 `def` 필드를 추가해 맞춰준다) 수정 없이 통과해야 한다.

Run: `npm test` → 전체 PASS (72개 그대로, 신규 테스트 없음)
Run: `npm run build` → 성공해야 함

- [ ] **Step 4: 커밋**

```bash
git add src/systems/idleCombat.js src/systems/shop.js
git commit -m "fix: grant def stat on dropped items so combat damage mitigation actually varies"
```

---

### Task 27: 스킬 탭에 투자 버튼 추가

**배경:** 최종 종합 리뷰에서 발견 — `learnOrLevelSkill`이 테스트 파일 밖에서는 전혀 호출되지 않는다. 레벨업으로 스킬 포인트는 쌓이지만 쓸 방법이 없다.

**Files:**
- Modify: `src/ui/BottomPanel.js`
- Modify: `tests/ui/BottomPanel.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/ui/BottomPanel.test.js`의 skills 탭 테스트를 다음으로 교체(또는 추가):
```js
  it('skills 탭: 스킬 목록과 투자 버튼을 보여준다', () => {
    const html = renderTab('skills', baseState());
    expect(html).toContain('강타');
    expect(html).toContain('철갑');
    expect(html).toContain('data-action="learn-skill"');
    expect(html).toContain('data-skill-id="power_strike"');
  });
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/ui/BottomPanel.test.js` → FAIL

- [ ] **Step 3: 구현 수정**

`src/ui/BottomPanel.js` import에 추가:
```js
import { SKILL_DEFS, learnOrLevelSkill } from '../data/skills.js';
```

`renderTab`의 `skills` 분기를 다음으로 교체:
```js
  if (tab === 'skills') {
    const skillsHtml = Object.values(SKILL_DEFS)
      .map((def) => {
        const level = state.character.skills[def.id] || 0;
        return `<p>${def.name} Lv.${level}/${def.maxLevel} <button data-action="learn-skill" data-skill-id="${def.id}" class="mock-button">투자</button></p>`;
      })
      .join('');
    return `<p>레벨 ${state.character.level} · 스킬 포인트 ${state.character.skillPoints}</p>${skillsHtml}`;
  }
```

기존 클릭 위임 리스너(`cycle-auto-equip-grade`/`restore-scrapbook-item`/`pull-gacha` 분기가 있는 `content.addEventListener('click', ...)`)에 새 분기 추가:
```js
    const learnBtn = event.target.closest('[data-action="learn-skill"]');
    if (learnBtn) {
      const state = store.getState();
      learnOrLevelSkill(state.character, learnBtn.dataset.skillId);
      store.notify();
      return;
    }
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/ui/BottomPanel.test.js` → PASS

- [ ] **Step 5: 빌드/전체 테스트 검증**

Run: `npm run build` → 성공
Run: `npm test` → 전체 PASS

- [ ] **Step 6: 커밋**

```bash
git add src/ui/BottomPanel.js tests/ui/BottomPanel.test.js
git commit -m "feat: add skill investment buttons to skills tab"
```

---

### Task 28: 세이브 로드시 runState 얕은 병합

**배경:** 최종 종합 리뷰에서 발견 — Task 19가 `runState`에 `distancePx`를 추가했는데, `main.js`는 저장된 상태를 `store.setState(saved)`로 통째로 덮어쓴다. 이 브랜치 작업 도중(Task 15~18 시점)에 저장된 구버전 세이브를 나중에 불러오면 `runState.distancePx`가 `undefined`가 되어 방치 진행도 계산이 `NaN`으로 깨질 수 있다.

**Files:**
- Modify: `src/main.js`

- [ ] **Step 1:** `src/main.js`에서 다음 부분:
```js
const saved = loadState();
if (saved) {
  store.setState(saved);
}
```
를 다음으로 교체:
```js
const saved = loadState();
if (saved) {
  const mergedRunState = saved.runState
    ? { ...store.getState().runState, ...saved.runState }
    : store.getState().runState;
  store.setState({ ...saved, runState: mergedRunState });
}
```

- [ ] **Step 2: 검증**

`main.js`는 직접 유닛 테스트 대상이 아니다(Task 14 정책과 동일). 다음으로 대체 검증한다:
Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS (변경 없음)
Dev 서버 스모크 체크: 백그라운드로 `npm run dev` 기동 → curl로 200 확인 → 콘솔 에러 없는지 확인 → 종료

- [ ] **Step 3: 커밋**

```bash
git add src/main.js
git commit -m "fix: shallow-merge runState on load to survive schema changes in old saves"
```

---

### Task 29: 하단 패널 재렌더 안정화

**배경:** 최종 종합 리뷰에서 발견 — `BottomPanel`의 `render()`가 `store.notify()`가 호출될 때마다(방치 틱마다 약 1초에 한 번꼴) `content.innerHTML`을 통째로 교체한다. 사용자가 버튼을 탭하는 타이밍과 재렌더가 겹치면, 누르고 있던 버튼 DOM 노드가 사라져 클릭 이벤트가 씹힐 수 있다.

**Files:**
- Modify: `src/ui/BottomPanel.js`

- [ ] **Step 1:** `mountBottomPanel` 내부의 `render` 함수:
```js
  function render() {
    content.innerHTML = renderTab(activeTab, store.getState());
  }
```
를 다음으로 교체:
```js
  let lastHtml = null;
  let renderTimer = null;

  function render() {
    if (renderTimer) clearTimeout(renderTimer);
    renderTimer = setTimeout(() => {
      const html = renderTab(activeTab, store.getState());
      if (html === lastHtml) return;
      lastHtml = html;
      content.innerHTML = html;
    }, 50);
  }
```

탭 버튼 클릭 핸들러(`activeTab = btn.dataset.tab; render();`)는 그대로 둔다 — 탭 전환 시에도 50ms 디바운스를 거치지만 체감상 차이는 없다.

- [ ] **Step 2: 검증**

Run: `npm run build` → 성공해야 함
Run: `npm test` → 전체 PASS (DOM 디바운싱은 유닛 테스트 대상 아님 — 기존 정책과 동일)

- [ ] **Step 3: 커밋**

```bash
git add src/ui/BottomPanel.js
git commit -m "fix: debounce and dedupe BottomPanel re-renders to avoid swallowing mid-gesture taps"
```

---

## Self-Review 요약 (Tasks 26-29 추가분)

- 최종 종합 리뷰의 Critical 1건(def 스탯 비활성) + Important 3건(스킬 미사용, 세이브 마이그레이션, 재렌더 탭 씹힘)을 각각 Task 26~29로 커버.
- Task 26은 `idleCombat.js`/`shop.js` 양쪽에 동일한 변경을 적용 — 두 파일이 로직을 복제하고 있다는 기존에 알려진 사실(Task 24 리뷰에서 지적)로 인해 한쪽만 고치면 다시 어긋나므로 반드시 둘 다 수정.
- Task 27은 Task 21/22/24가 이미 구축한 `content.addEventListener('click', ...)` 단일 리스너 패턴에 네 번째 분기를 추가하는 방식으로, 기존 구조를 그대로 재사용.
- Task 29는 Task 27 이후 진행 — 같은 `render` 함수를 건드리므로 순서를 지킨다.

## Self-Review 요약 (Tasks 22-24 추가분)

- **사용자 신규 요구사항 커버:** 스크랩북+골드복원(Task 22), 하단 UI 드래그 최소화(Task 23), 상점 가챠(Task 24) — 모두 대응 Task 존재.
- **Task 18과의 관계:** Task 18이 만든 "교체 장비 → inventory" 동작은 Task 22에서 "교체 장비 → scrapbook"으로 대체된다. Task 22의 Step 6은 Task 18이 추가한 테스트를 명시적으로 교체하도록 지시한다.
- **실행 순서:** 22는 17(터치입력)과 19(풀스크린/진행도) 이후, 24는 22 이후에 실행한다 — `IdleScene.js`/`BottomPanel.js`를 여러 Task가 순차적으로 수정하므로 파일 충돌을 피하기 위함이다.
- **스킬 트리 심화는 범위 제외:** diablo_clone 재검토 결과 발견된 스킬트리(선행조건/시너지) 심화는 사용자 확인을 거쳐 이번 보완 범위에서 제외하고 기존 로드맵(2차 이후)에 남겨둔다.

## Self-Review 요약

- **최종 리뷰 Critical 3건 커버:** 레벨업/스킬포인트 지급(Task 15), 장비/스킬 스탯의 게임플레이 반영(Task 16), 터치/드래그 입력(Task 17) — 모두 대응 Task 존재.
- **Important 4건 중 3건 커버:** 교체 장비 유실(Task 18), 풀스크린 미적용 + 진행도 리셋(Task 19), localStorage 크래시 위험(Task 20) — 모두 대응 Task 존재. 나머지 1건(상점/설정 탭 장식용 문제)은 범위 결정으로 해소: 상점은 로드맵으로 명시 이연, 설정 탭은 Task 21로 실제 컨트롤 추가.
- **플레이스홀더 없음:** 모든 Step에 실행 가능한 코드/명령이 명시되어 있다.
- **파일 간 일관성:** Task 15/16/19가 모두 `IdleScene.js`/`CombatScene.js`를 수정하므로 구현 순서(15 → 16 → 19 → 17)를 지켜 각 Task가 이전 Task의 최신 파일 상태 위에서 작업하도록 한다.
