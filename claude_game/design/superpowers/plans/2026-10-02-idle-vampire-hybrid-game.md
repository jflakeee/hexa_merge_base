# 방치형 × 뱀서류 하이브리드 게임 MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 브라우저에서 실행되는 세로형 모바일 게임 MVP를 구현한다. 평소엔 2D 픽셀 캐릭터가 횡스크롤 맵을 자동 이동+전투하고(방치 모드), 상단 액션 영역을 탭하면 전체화면 생존형 전투(뱀서류 모드)로 전환되며, 두 모드는 동일한 캐릭터/아이템/재화 상태를 공유한다.

**Architecture:** 게임 로직(드롭 테이블, 자동 장착, 스킬, 전투 정산, 인벤토리)은 Phaser와 분리된 순수 JS 모듈로 작성해 Vitest로 단위 테스트한다. Phaser Scene(`IdleScene`, `CombatScene`)은 이 모듈들을 호출하는 얇은 렌더링 레이어로만 구현하고, 전역 상태는 Phaser 밖의 단순 store(+ 이벤트 버스)에 두어 두 Scene과 DOM 기반 하단 UI(`BottomPanel`)가 동일 상태를 공유한다.

**Tech Stack:** Vite(빌드/dev server), Phaser 3(2D 렌더링), Vitest(단위 테스트), 순수 JS(ESM), `localStorage`(저장소, 서버 없음).

참고 스펙: `docs/superpowers/specs/2026-10-02-idle-vampire-hybrid-game-design.md`

**스펙과의 차이(해소한 모호함):** 스펙의 데이터 모델에는 `Currency { gold, exp }`로 `exp`가 중복 정의되어 있었다. 레벨업에 쓰이는 경험치는 `Character.exp` 하나로 통일하고, `Currency`는 `{ gold }`만 가진다.

---

### Task 1: 프로젝트 스캐폴드 (Vite + Phaser + Vitest)

**Files:**
- Create: `package.json`
- Create: `vite.config.js`
- Create: `vitest.config.js`
- Create: `index.html`
- Create: `src/main.js`
- Create: `src/style.css`
- Modify: `.gitignore`

- [ ] **Step 1: package.json 작성**

```json
{
  "name": "claude-game",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "phaser": "^3.80.1"
  },
  "devDependencies": {
    "vite": "^5.4.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: 의존성 설치**

Run: `npm install`
Expected: `node_modules/` 생성, `package-lock.json` 생성, 에러 없이 종료.

- [ ] **Step 3: vite.config.js / vitest.config.js 작성**

`vite.config.js`:
```js
import { defineConfig } from 'vite';

export default defineConfig({});
```

`vitest.config.js`:
```js
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
  },
});
```

- [ ] **Step 4: index.html / main.js / style.css 작성**

`index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Claude Game</title>
    <link rel="stylesheet" href="/src/style.css" />
  </head>
  <body>
    <div id="app">
      <div id="game-container"></div>
      <div id="bottom-panel"></div>
    </div>
    <script type="module" src="/src/main.js"></script>
  </body>
</html>
```

`src/main.js`:
```js
console.log('claude-game boot placeholder — replaced in Task 14');
```

`src/style.css`:
```css
html, body {
  margin: 0;
  padding: 0;
  background: #111;
  color: #eee;
  font-family: system-ui, sans-serif;
}

#app {
  display: flex;
  flex-direction: column;
  width: 360px;
  height: 100vh;
  margin: 0 auto;
}

#game-container {
  flex: 7;
}

#bottom-panel {
  flex: 3;
  background: #1b1b1b;
  overflow-y: auto;
}

.tab-bar {
  display: flex;
}

.tab-button {
  flex: 1;
  padding: 8px;
  background: #222;
  color: #ccc;
  border: none;
  border-bottom: 2px solid #444;
}

.tab-content {
  padding: 8px;
  font-size: 13px;
}
```

- [ ] **Step 5: dev 서버 기동 확인 (수동 검증)**

Run: `npm run dev`
Expected: 콘솔에 로컬 URL(예: `http://localhost:5173`) 출력. 브라우저로 열어 빈 페이지가 에러 없이 로드되는지 확인 (아직 Phaser 게임은 없음 — `main.js`는 Task 14에서 완성됨).

- [ ] **Step 6: .gitignore에 node_modules/dist 추가**

`.gitignore`에 다음 줄 추가:
```
node_modules/
dist/
```

- [ ] **Step 7: 커밋**

```bash
git add package.json package-lock.json vite.config.js vitest.config.js index.html src/main.js src/style.css .gitignore
git commit -m "chore: scaffold Vite + Phaser + Vitest project"
```

---

### Task 2: 핵심 데이터 모델 (Character, Item, Currency, RunState)

**Files:**
- Create: `src/state/models.js`
- Test: `tests/state/models.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/state/models.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { createCharacter, createItem, createCurrency, createRunState } from '../../src/state/models.js';

describe('createCharacter', () => {
  it('기본값으로 레벨1, 경험치0, 빈 장비 목록을 가진다', () => {
    const c = createCharacter();
    expect(c.level).toBe(1);
    expect(c.exp).toBe(0);
    expect(c.equippedItems).toEqual([]);
    expect(c.skillPoints).toBe(0);
    expect(c.skills).toEqual({});
    expect(c.stats).toEqual({ atk: 10, def: 5, crit: 0.05 });
  });
});

describe('createItem', () => {
  it('전달한 필드를 그대로 가진 아이템을 만든다', () => {
    const item = createItem({ id: 'i1', name: '녹슨 검', grade: 'normal', statBonus: { atk: 2 }, slot: 'weapon' });
    expect(item).toEqual({ id: 'i1', name: '녹슨 검', grade: 'normal', statBonus: { atk: 2 }, slot: 'weapon' });
  });
});

describe('createCurrency', () => {
  it('기본값 gold 0을 가진다', () => {
    expect(createCurrency()).toEqual({ gold: 0 });
  });
});

describe('createRunState', () => {
  it('기본값 idle 모드, stageIndex 0을 가진다', () => {
    expect(createRunState()).toEqual({ mode: 'idle', stageIndex: 0, combatTimer: 0 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/state/models.test.js`
Expected: FAIL — `Cannot find module '../../src/state/models.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/state/models.js`:
```js
export function createCharacter() {
  return {
    level: 1,
    exp: 0,
    stats: { atk: 10, def: 5, crit: 0.05 },
    equippedItems: [],
    skillPoints: 0,
    skills: {},
  };
}

export function createItem({ id, name, grade, statBonus, slot }) {
  return { id, name, grade, statBonus, slot };
}

export function createCurrency() {
  return { gold: 0 };
}

export function createRunState() {
  return { mode: 'idle', stageIndex: 0, combatTimer: 0 };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/state/models.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/state/models.js tests/state/models.test.js
git commit -m "feat: add core data model factories"
```

---

### Task 3: 전역 Store + 이벤트 버스

**Files:**
- Create: `src/state/store.js`
- Create: `src/state/globalStore.js`
- Test: `tests/state/store.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/state/store.test.js`:
```js
import { describe, it, expect, vi } from 'vitest';
import { createStore } from '../../src/state/store.js';

describe('createStore', () => {
  it('기본 상태에 character/currency/inventory/settings/runState를 포함한다', () => {
    const store = createStore();
    const state = store.getState();
    expect(state.character.level).toBe(1);
    expect(state.currency.gold).toBe(0);
    expect(state.inventory).toEqual([]);
    expect(state.settings).toEqual({ autoEquipMinGrade: 'normal' });
    expect(state.runState.mode).toBe('idle');
  });

  it('setState는 상태를 병합하고 구독자에게 알린다', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.setState({ currency: { gold: 50 } });

    expect(store.getState().currency).toEqual({ gold: 50 });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('notify는 상태 변경 없이도 구독자를 호출한다', () => {
    const store = createStore();
    const listener = vi.fn();
    store.subscribe(listener);

    store.notify();

    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('subscribe가 반환한 함수로 구독을 해제할 수 있다', () => {
    const store = createStore();
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();

    store.notify();

    expect(listener).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/state/store.test.js`
Expected: FAIL — `Cannot find module '../../src/state/store.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/state/store.js`:
```js
import { createCharacter, createCurrency, createRunState } from './models.js';

export function createStore() {
  const state = {
    character: createCharacter(),
    currency: createCurrency(),
    inventory: [],
    settings: { autoEquipMinGrade: 'normal' },
    runState: createRunState(),
  };
  const listeners = new Set();

  function getState() {
    return state;
  }

  function setState(partial) {
    Object.assign(state, partial);
    notify();
  }

  function notify() {
    for (const listener of listeners) listener(state);
  }

  function subscribe(listener) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  }

  return { getState, setState, notify, subscribe };
}
```

`src/state/globalStore.js`:
```js
import { createStore } from './store.js';

export const store = createStore();
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/state/store.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/state/store.js src/state/globalStore.js tests/state/store.test.js
git commit -m "feat: add global store with pub/sub"
```

---

### Task 4: 저장/불러오기 (localStorage)

**Files:**
- Create: `src/state/persistence.js`
- Test: `tests/state/persistence.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/state/persistence.test.js`:
```js
import { describe, it, expect, beforeEach } from 'vitest';
import { saveState, loadState, clearState } from '../../src/state/persistence.js';

function createMemoryStorage() {
  const map = new Map();
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
    removeItem: (key) => map.delete(key),
  };
}

describe('persistence', () => {
  let storage;

  beforeEach(() => {
    storage = createMemoryStorage();
  });

  it('저장된 적이 없으면 null을 반환한다', () => {
    expect(loadState(storage)).toBeNull();
  });

  it('saveState로 저장한 값을 loadState로 그대로 불러온다', () => {
    const data = { currency: { gold: 42 } };
    saveState(data, storage);
    expect(loadState(storage)).toEqual(data);
  });

  it('손상된 JSON이면 null을 반환한다', () => {
    storage.setItem('claude_game_save_v1', '{broken');
    expect(loadState(storage)).toBeNull();
  });

  it('clearState로 저장값을 지운다', () => {
    saveState({ currency: { gold: 1 } }, storage);
    clearState(storage);
    expect(loadState(storage)).toBeNull();
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/state/persistence.test.js`
Expected: FAIL — `Cannot find module '../../src/state/persistence.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/state/persistence.js`:
```js
const STORAGE_KEY = 'claude_game_save_v1';

function resolveStorage(storage) {
  return storage || globalThis.localStorage;
}

export function saveState(state, storage) {
  resolveStorage(storage).setItem(STORAGE_KEY, JSON.stringify(state));
}

export function loadState(storage) {
  const raw = resolveStorage(storage).getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

export function clearState(storage) {
  resolveStorage(storage).removeItem(STORAGE_KEY);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/state/persistence.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/state/persistence.js tests/state/persistence.test.js
git commit -m "feat: add localStorage-backed save/load"
```

---

### Task 5: 드롭 테이블 시스템 (등급/확률)

**Files:**
- Create: `src/data/dropTable.js`
- Test: `tests/data/dropTable.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/data/dropTable.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { rollGrade, gradeRank, GRADE_ORDER, GRADE_WEIGHTS } from '../../src/data/dropTable.js';

describe('gradeRank', () => {
  it('등급 순서대로 순위를 매긴다', () => {
    expect(gradeRank('normal')).toBe(0);
    expect(gradeRank('magic')).toBe(1);
    expect(gradeRank('rare')).toBe(2);
    expect(gradeRank('epic')).toBe(3);
  });
});

describe('rollGrade', () => {
  it('randomFn이 0을 반환하면 가장 낮은 등급(normal)이 나온다', () => {
    expect(rollGrade(() => 0)).toBe('normal');
  });

  it('randomFn이 거의 1을 반환하면 가장 높은 등급(epic)이 나온다', () => {
    expect(rollGrade(() => 0.9999)).toBe('epic');
  });

  it('가중치 합이 100이 되는 경계값에서 정확히 다음 등급으로 넘어간다', () => {
    const total = Object.values(GRADE_WEIGHTS).reduce((a, b) => a + b, 0);
    const normalBoundary = GRADE_WEIGHTS.normal / total;
    expect(rollGrade(() => normalBoundary - 0.0001)).toBe('normal');
    expect(rollGrade(() => normalBoundary + 0.0001)).toBe('magic');
  });

  it('GRADE_ORDER에 정의된 값만 반환한다 (1000회 샘플)', () => {
    for (let i = 0; i < 1000; i++) {
      expect(GRADE_ORDER).toContain(rollGrade(Math.random));
    }
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/data/dropTable.test.js`
Expected: FAIL — `Cannot find module '../../src/data/dropTable.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/data/dropTable.js`:
```js
export const GRADE_ORDER = ['normal', 'magic', 'rare', 'epic'];

export const GRADE_WEIGHTS = {
  normal: 60,
  magic: 25,
  rare: 12,
  epic: 3,
};

export function rollGrade(randomFn = Math.random) {
  const total = Object.values(GRADE_WEIGHTS).reduce((sum, w) => sum + w, 0);
  const roll = randomFn() * total;
  let cumulative = 0;
  for (const grade of GRADE_ORDER) {
    cumulative += GRADE_WEIGHTS[grade];
    if (roll < cumulative) return grade;
  }
  return GRADE_ORDER[GRADE_ORDER.length - 1];
}

export function gradeRank(grade) {
  return GRADE_ORDER.indexOf(grade);
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/data/dropTable.test.js`
Expected: PASS (4 tests, 마지막 테스트는 1000개 assertion 포함)

- [ ] **Step 5: 커밋**

```bash
git add src/data/dropTable.js tests/data/dropTable.test.js
git commit -m "feat: add item grade drop table"
```

---

### Task 6: 자동 장착 로직

**Files:**
- Create: `src/systems/autoEquip.js`
- Test: `tests/systems/autoEquip.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/autoEquip.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { statTotal, shouldAutoEquip, autoEquip } from '../../src/systems/autoEquip.js';

const weapon = (grade, atk, slot = 'weapon') => ({ id: `${grade}-${atk}`, name: grade, grade, statBonus: { atk }, slot });

describe('statTotal', () => {
  it('statBonus 값의 합을 반환한다', () => {
    expect(statTotal({ statBonus: { atk: 3, def: 2 } })).toBe(5);
  });
});

describe('shouldAutoEquip', () => {
  it('최소 등급보다 낮으면 장착하지 않는다', () => {
    const dropped = weapon('normal', 10);
    expect(shouldAutoEquip(dropped, [], 'rare')).toBe(false);
  });

  it('같은 슬롯에 장비가 없으면 기준 등급 이상일 때 장착한다', () => {
    const dropped = weapon('rare', 10);
    expect(shouldAutoEquip(dropped, [], 'normal')).toBe(true);
  });

  it('기존 장비보다 스탯 합이 높을 때만 교체한다', () => {
    const current = weapon('normal', 10);
    const worse = weapon('magic', 5);
    const better = weapon('magic', 15);
    expect(shouldAutoEquip(worse, [current], 'normal')).toBe(false);
    expect(shouldAutoEquip(better, [current], 'normal')).toBe(true);
  });
});

describe('autoEquip', () => {
  it('장착 조건을 만족하면 character.equippedItems를 교체하고 replaced를 반환한다', () => {
    const character = { equippedItems: [weapon('normal', 10)] };
    const dropped = weapon('magic', 20);

    const result = autoEquip(dropped, character, 'normal');

    expect(result.equipped).toBe(true);
    expect(result.replaced.grade).toBe('normal');
    expect(character.equippedItems).toEqual([dropped]);
  });

  it('장착 조건을 만족하지 않으면 character를 바꾸지 않는다', () => {
    const existing = weapon('rare', 50);
    const character = { equippedItems: [existing] };
    const dropped = weapon('magic', 5);

    const result = autoEquip(dropped, character, 'normal');

    expect(result.equipped).toBe(false);
    expect(result.replaced).toBeNull();
    expect(character.equippedItems).toEqual([existing]);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/autoEquip.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/autoEquip.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/autoEquip.js`:
```js
import { gradeRank } from '../data/dropTable.js';

export function statTotal(item) {
  return Object.values(item.statBonus).reduce((sum, v) => sum + v, 0);
}

export function shouldAutoEquip(droppedItem, currentEquipped, minGrade) {
  if (gradeRank(droppedItem.grade) < gradeRank(minGrade)) return false;
  const current = currentEquipped.find((i) => i.slot === droppedItem.slot);
  if (!current) return true;
  return statTotal(droppedItem) > statTotal(current);
}

export function autoEquip(droppedItem, character, minGrade) {
  if (!shouldAutoEquip(droppedItem, character.equippedItems, minGrade)) {
    return { equipped: false, replaced: null };
  }
  const idx = character.equippedItems.findIndex((i) => i.slot === droppedItem.slot);
  const replaced = idx >= 0 ? character.equippedItems[idx] : null;
  if (idx >= 0) {
    character.equippedItems[idx] = droppedItem;
  } else {
    character.equippedItems.push(droppedItem);
  }
  return { equipped: true, replaced };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/autoEquip.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/systems/autoEquip.js tests/systems/autoEquip.test.js
git commit -m "feat: add auto-equip comparison logic"
```

---

### Task 7: 스킬 시스템 (패시브 1~2개)

**Files:**
- Create: `src/data/skills.js`
- Test: `tests/data/skills.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/data/skills.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { SKILL_DEFS, learnOrLevelSkill, applySkillEffects } from '../../src/data/skills.js';

function characterWithPoints(points) {
  return { stats: { atk: 100, def: 50 }, skills: {}, skillPoints: points };
}

describe('SKILL_DEFS', () => {
  it('power_strike와 iron_skin 두 개의 패시브 스킬을 정의한다', () => {
    expect(Object.keys(SKILL_DEFS)).toEqual(['power_strike', 'iron_skin']);
  });
});

describe('learnOrLevelSkill', () => {
  it('스킬 포인트가 있으면 레벨을 1 올리고 포인트를 소모한다', () => {
    const character = characterWithPoints(1);
    const result = learnOrLevelSkill(character, 'power_strike');
    expect(result).toBe(true);
    expect(character.skills.power_strike).toBe(1);
    expect(character.skillPoints).toBe(0);
  });

  it('스킬 포인트가 없으면 아무것도 하지 않고 false를 반환한다', () => {
    const character = characterWithPoints(0);
    const result = learnOrLevelSkill(character, 'power_strike');
    expect(result).toBe(false);
    expect(character.skills.power_strike).toBeUndefined();
  });

  it('최대 레벨에 도달하면 더 이상 올릴 수 없다', () => {
    const character = characterWithPoints(10);
    character.skills.power_strike = SKILL_DEFS.power_strike.maxLevel;
    const result = learnOrLevelSkill(character, 'power_strike');
    expect(result).toBe(false);
    expect(character.skillPoints).toBe(10);
  });

  it('정의되지 않은 스킬 id는 에러를 던진다', () => {
    const character = characterWithPoints(1);
    expect(() => learnOrLevelSkill(character, 'unknown')).toThrow('Unknown skill: unknown');
  });
});

describe('applySkillEffects', () => {
  it('스킬이 없으면 기본 스탯을 그대로 반환한다', () => {
    const character = characterWithPoints(0);
    expect(applySkillEffects(character)).toEqual({ atk: 100, def: 50 });
  });

  it('power_strike 레벨만큼 공격력을 10%씩 곱연산으로 올린다', () => {
    const character = characterWithPoints(0);
    character.skills.power_strike = 2;
    expect(applySkillEffects(character)).toEqual({ atk: 120, def: 50 });
  });

  it('iron_skin 레벨만큼 방어력을 10%씩 곱연산으로 올린다', () => {
    const character = characterWithPoints(0);
    character.skills.iron_skin = 1;
    expect(applySkillEffects(character)).toEqual({ atk: 100, def: 55 });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/data/skills.test.js`
Expected: FAIL — `Cannot find module '../../src/data/skills.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/data/skills.js`:
```js
export const SKILL_DEFS = {
  power_strike: {
    id: 'power_strike',
    name: '강타',
    maxLevel: 5,
    effect: (level) => ({ atkMultiplier: 1 + level * 0.1 }),
  },
  iron_skin: {
    id: 'iron_skin',
    name: '철갑',
    maxLevel: 5,
    effect: (level) => ({ defMultiplier: 1 + level * 0.1 }),
  },
};

export function learnOrLevelSkill(character, skillId) {
  const def = SKILL_DEFS[skillId];
  if (!def) throw new Error(`Unknown skill: ${skillId}`);
  const currentLevel = character.skills[skillId] || 0;
  if (currentLevel >= def.maxLevel) return false;
  if (character.skillPoints <= 0) return false;
  character.skills[skillId] = currentLevel + 1;
  character.skillPoints -= 1;
  return true;
}

export function applySkillEffects(character) {
  let atkMultiplier = 1;
  let defMultiplier = 1;
  for (const [skillId, level] of Object.entries(character.skills)) {
    const def = SKILL_DEFS[skillId];
    if (!def) continue;
    const effect = def.effect(level);
    if (effect.atkMultiplier) atkMultiplier *= effect.atkMultiplier;
    if (effect.defMultiplier) defMultiplier *= effect.defMultiplier;
  }
  return {
    atk: Math.round(character.stats.atk * atkMultiplier),
    def: Math.round(character.stats.def * defMultiplier),
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/data/skills.test.js`
Expected: PASS (7 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/data/skills.js tests/data/skills.test.js
git commit -m "feat: add passive skill leveling and effect application"
```

---

### Task 8: 인벤토리 초과 처리

**Files:**
- Create: `src/systems/inventory.js`
- Test: `tests/systems/inventory.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/inventory.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { addItemToInventory, itemGoldValue, INVENTORY_CAPACITY } from '../../src/systems/inventory.js';

const item = (grade) => ({ id: grade, name: grade, grade, statBonus: {}, slot: 'weapon' });

describe('itemGoldValue', () => {
  it('등급별로 정해진 골드 가치를 반환한다', () => {
    expect(itemGoldValue(item('normal'))).toBe(5);
    expect(itemGoldValue(item('magic'))).toBe(15);
    expect(itemGoldValue(item('rare'))).toBe(40);
    expect(itemGoldValue(item('epic'))).toBe(100);
  });
});

describe('addItemToInventory', () => {
  it('이미 자동 장착된 아이템이면 인벤토리에 추가하지 않는다', () => {
    const inventory = [];
    const currency = { gold: 0 };
    const result = addItemToInventory(inventory, item('normal'), currency, true);
    expect(result).toEqual({ added: false, convertedToGold: 0 });
    expect(inventory).toEqual([]);
  });

  it('공간이 있으면 인벤토리에 추가한다', () => {
    const inventory = [];
    const currency = { gold: 0 };
    const result = addItemToInventory(inventory, item('normal'), currency, false);
    expect(result).toEqual({ added: true, convertedToGold: 0 });
    expect(inventory).toHaveLength(1);
  });

  it('인벤토리가 가득 차면 골드로 환산해 흡수한다', () => {
    const inventory = Array.from({ length: INVENTORY_CAPACITY }, () => item('normal'));
    const currency = { gold: 0 };
    const result = addItemToInventory(inventory, item('epic'), currency, false);
    expect(result).toEqual({ added: false, convertedToGold: 100 });
    expect(currency.gold).toBe(100);
    expect(inventory).toHaveLength(INVENTORY_CAPACITY);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/inventory.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/inventory.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/inventory.js`:
```js
export const INVENTORY_CAPACITY = 30;

const GRADE_VALUE = { normal: 5, magic: 15, rare: 40, epic: 100 };

export function itemGoldValue(item) {
  return GRADE_VALUE[item.grade] || 1;
}

export function addItemToInventory(inventory, item, currency, autoEquipped) {
  if (autoEquipped) return { added: false, convertedToGold: 0 };
  if (inventory.length >= INVENTORY_CAPACITY) {
    const goldValue = itemGoldValue(item);
    currency.gold += goldValue;
    return { added: false, convertedToGold: goldValue };
  }
  inventory.push(item);
  return { added: true, convertedToGold: 0 };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/inventory.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/systems/inventory.js tests/systems/inventory.test.js
git commit -m "feat: convert overflow drops to gold when inventory is full"
```

---

### Task 9: 방치 전투 로직 모듈 (진행도 + 킬 처리)

**Files:**
- Create: `src/systems/idleCombat.js`
- Test: `tests/systems/idleCombat.test.js`

**Depends on:** Task 5 (dropTable), Task 6 (autoEquip), Task 8 (inventory)

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/idleCombat.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  createIdleProgress,
  advanceIdleProgress,
  resolveIdleKill,
  STAGE_LENGTH_PX,
} from '../../src/systems/idleCombat.js';

describe('advanceIdleProgress', () => {
  it('이동 거리가 스테이지 길이에 못 미치면 false를 반환한다', () => {
    const progress = createIdleProgress();
    const cleared = advanceIdleProgress(progress, 1000);
    expect(cleared).toBe(false);
    expect(progress.distancePx).toBeGreaterThan(0);
    expect(progress.stageIndex).toBe(0);
  });

  it('누적 거리가 스테이지 길이를 넘으면 다음 스테이지로 넘어가고 거리를 리셋한다', () => {
    const progress = createIdleProgress();
    progress.distancePx = STAGE_LENGTH_PX - 1;
    const cleared = advanceIdleProgress(progress, 1000);
    expect(cleared).toBe(true);
    expect(progress.stageIndex).toBe(1);
    expect(progress.distancePx).toBe(0);
  });
});

describe('resolveIdleKill', () => {
  it('골드/경험치를 지급하고 드롭 아이템을 생성한다', () => {
    const character = { equippedItems: [], exp: 0 };
    const currency = { gold: 0 };
    const inventory = [];

    const result = resolveIdleKill({
      character,
      currency,
      inventory,
      autoEquipMinGrade: 'epic',
      randomFn: () => 0,
    });

    expect(currency.gold).toBe(2);
    expect(character.exp).toBe(3);
    expect(result.item.grade).toBe('normal');
    expect(inventory).toHaveLength(1);
  });

  it('드롭 등급이 자동장착 기준을 넘으면 인벤토리 대신 장착된다', () => {
    const character = { equippedItems: [], exp: 0 };
    const currency = { gold: 0 };
    const inventory = [];

    const result = resolveIdleKill({
      character,
      currency,
      inventory,
      autoEquipMinGrade: 'normal',
      randomFn: () => 0,
    });

    expect(result.autoEquipResult.equipped).toBe(true);
    expect(inventory).toHaveLength(0);
    expect(character.equippedItems).toHaveLength(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/idleCombat.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/idleCombat.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/idleCombat.js`:
```js
import { rollGrade } from '../data/dropTable.js';
import { autoEquip } from './autoEquip.js';
import { addItemToInventory } from './inventory.js';

export const STAGE_LENGTH_PX = 2000;
export const IDLE_MOVE_SPEED_PX_PER_S = 50;
export const IDLE_COMBAT_TICK_MS = 1000;

export function createIdleProgress() {
  return { stageIndex: 0, distancePx: 0 };
}

export function advanceIdleProgress(progress, deltaMs) {
  progress.distancePx += IDLE_MOVE_SPEED_PX_PER_S * (deltaMs / 1000);
  if (progress.distancePx >= STAGE_LENGTH_PX) {
    progress.distancePx = 0;
    progress.stageIndex += 1;
    return true;
  }
  return false;
}

export function resolveIdleKill({ character, currency, inventory, autoEquipMinGrade, randomFn = Math.random }) {
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
  }
  return { goldDrop, expDrop, item, autoEquipResult };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/idleCombat.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/systems/idleCombat.js tests/systems/idleCombat.test.js
git commit -m "feat: add idle progress and auto-kill resolution logic"
```

---

### Task 10: IdleScene (Phaser) — 횡스크롤 자동 이동 + 탭 전환

**Files:**
- Create: `src/scenes/IdleScene.js`

**Depends on:** Task 3 (store), Task 9 (idleCombat)

이 Task는 Phaser 렌더링 글루 코드이므로 로직은 이미 테스트된 `idleCombat.js`에 위임한다. 단위 테스트 대신 수동 시각 검증을 사용한다.

- [ ] **Step 1: IdleScene 작성**

`src/scenes/IdleScene.js`:
```js
import Phaser from 'phaser';
import { store } from '../state/globalStore.js';
import {
  createIdleProgress,
  advanceIdleProgress,
  resolveIdleKill,
  STAGE_LENGTH_PX,
  IDLE_COMBAT_TICK_MS,
} from '../systems/idleCombat.js';

export class IdleScene extends Phaser.Scene {
  constructor() {
    super('IdleScene');
  }

  create() {
    this.progress = createIdleProgress();
    this.tickAccumulator = 0;
    this.trackWidth = this.scale.width - 80;

    this.character = this.add.rectangle(40, this.scale.height * 0.5, 24, 24, 0xe07856);
    this.character.setStrokeStyle(2, 0xffffff);

    this.add
      .text(8, 8, '탭하여 전투 진입', { fontSize: '12px', color: '#888888' })
      .setDepth(10);

    this.input.on('pointerdown', (pointer) => {
      if (pointer.y < this.scale.height * 0.7) {
        this.scene.start('CombatScene');
      }
    });
  }

  update(time, delta) {
    this.tickAccumulator += delta;
    advanceIdleProgress(this.progress, delta);
    this.character.x = 40 + (this.progress.distancePx / STAGE_LENGTH_PX) * this.trackWidth;

    if (this.tickAccumulator >= IDLE_COMBAT_TICK_MS) {
      this.tickAccumulator -= IDLE_COMBAT_TICK_MS;
      const state = store.getState();
      resolveIdleKill({
        character: state.character,
        currency: state.currency,
        inventory: state.inventory,
        autoEquipMinGrade: state.settings.autoEquipMinGrade,
      });
      store.notify();
    }
  }
}
```

- [ ] **Step 2: 임시 부트스트랩으로 수동 확인**

`src/main.js`를 임시로 아래 내용으로 덮어써 확인한다 (Task 14에서 최종본으로 다시 교체됨):

```js
import Phaser from 'phaser';
import { IdleScene } from './scenes/IdleScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  parent: 'game-container',
  backgroundColor: '#1b1b1b',
  scene: [IdleScene],
});
```

Run: `npm run dev`
Expected: 브라우저에서 주황색 사각형(캐릭터)이 좌우로 반복 이동한다. 화면 상단 70% 영역을 클릭하면 에러 없이 멈춘다(= `CombatScene`을 아직 못 찾아 콘솔 에러가 나는 것은 정상 — Task 12에서 해결).

- [ ] **Step 3: 커밋**

```bash
git add src/scenes/IdleScene.js src/main.js
git commit -m "feat: add IdleScene with auto-move and tap-to-combat"
```

---

### Task 11: 생존 전투 세션 로직 (타이머/보상/정산)

**Files:**
- Create: `src/systems/survivalCombat.js`
- Test: `tests/systems/survivalCombat.test.js`

- [ ] **Step 1: 실패하는 테스트 작성**

`tests/systems/survivalCombat.test.js`:
```js
import { describe, it, expect } from 'vitest';
import {
  createCombatSession,
  tickCombat,
  addReward,
  settleCombat,
  COMBAT_DURATION_MS,
} from '../../src/systems/survivalCombat.js';

describe('tickCombat', () => {
  it('플레이어 체력이 남아있고 시간이 안 찼으면 outcome이 null이다', () => {
    const session = createCombatSession(0);
    tickCombat(session, 1000, 100);
    expect(session.outcome).toBeNull();
    expect(session.elapsedMs).toBe(1000);
  });

  it('경과 시간이 COMBAT_DURATION_MS 이상이면 cleared가 된다', () => {
    const session = createCombatSession(0);
    tickCombat(session, COMBAT_DURATION_MS, 100);
    expect(session.outcome).toBe('cleared');
  });

  it('체력이 0 이하이면 즉시 failed가 된다', () => {
    const session = createCombatSession(0);
    tickCombat(session, 1000, 0);
    expect(session.outcome).toBe('failed');
  });
});

describe('addReward / settleCombat', () => {
  it('addReward로 누적한 보상을 settleCombat이 재화/캐릭터에 반영한다', () => {
    const session = createCombatSession(0);
    addReward(session, { gold: 10, exp: 5 });
    addReward(session, { gold: 20, exp: 5, item: { id: 'x' } });

    const currency = { gold: 0 };
    const character = { exp: 0 };
    const result = settleCombat(session, currency, character);

    expect(currency.gold).toBe(30);
    expect(character.exp).toBe(10);
    expect(result.rewards.items).toEqual([{ id: 'x' }]);
  });

  it('실패(failed)로 끝나도 그때까지 쌓인 보상은 정산된다', () => {
    const session = createCombatSession(0);
    addReward(session, { gold: 5, exp: 1 });
    tickCombat(session, 1000, 0);

    const currency = { gold: 0 };
    const character = { exp: 0 };
    const result = settleCombat(session, currency, character);

    expect(result.outcome).toBe('failed');
    expect(currency.gold).toBe(5);
    expect(character.exp).toBe(1);
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/systems/survivalCombat.test.js`
Expected: FAIL — `Cannot find module '../../src/systems/survivalCombat.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/systems/survivalCombat.js`:
```js
export const COMBAT_DURATION_MS = 180000;

export function createCombatSession(now = Date.now()) {
  return { startedAt: now, elapsedMs: 0, rewards: { gold: 0, exp: 0, items: [] }, outcome: null };
}

export function tickCombat(session, deltaMs, playerHp) {
  session.elapsedMs += deltaMs;
  if (playerHp <= 0) {
    session.outcome = 'failed';
    return session;
  }
  if (session.elapsedMs >= COMBAT_DURATION_MS) {
    session.outcome = 'cleared';
  }
  return session;
}

export function addReward(session, reward) {
  session.rewards.gold += reward.gold || 0;
  session.rewards.exp += reward.exp || 0;
  if (reward.item) session.rewards.items.push(reward.item);
}

export function settleCombat(session, currency, character) {
  currency.gold += session.rewards.gold;
  character.exp += session.rewards.exp;
  return { outcome: session.outcome, rewards: session.rewards };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/systems/survivalCombat.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/systems/survivalCombat.js tests/systems/survivalCombat.test.js
git commit -m "feat: add survival combat session timer and settlement"
```

---

### Task 12: CombatScene (Phaser) — 전체화면 전투 + 모드 전환 연결

**Files:**
- Create: `src/scenes/CombatScene.js`
- Modify: `src/scenes/IdleScene.js` (이미 `CombatScene`을 참조하므로 수정 없음, 등록만 Task 14에서)
- Modify: `src/main.js` (임시 부트스트랩에 `CombatScene` 추가)

**Depends on:** Task 3 (store), Task 11 (survivalCombat)

- [ ] **Step 1: CombatScene 작성**

`src/scenes/CombatScene.js`:
```js
import Phaser from 'phaser';
import { store } from '../state/globalStore.js';
import {
  createCombatSession,
  tickCombat,
  addReward,
  settleCombat,
  COMBAT_DURATION_MS,
} from '../systems/survivalCombat.js';

const ENEMY_HIT_INTERVAL_MS = 800;
const ENEMY_HIT_DAMAGE = 5;
const PLAYER_MOVE_SPEED = 150;
const CLEAR_REWARD = { gold: 50, exp: 30 };

export class CombatScene extends Phaser.Scene {
  constructor() {
    super('CombatScene');
  }

  create() {
    this.session = createCombatSession();
    this.playerHp = 100;

    this.add.rectangle(0, 0, this.scale.width, this.scale.height, 0x222222).setOrigin(0, 0);
    this.player = this.add.rectangle(this.scale.width / 2, this.scale.height / 2, 20, 20, 0xe07856);

    this.timerText = this.add.text(10, 10, '', { fontSize: '16px', color: '#ffffff' });
    this.hpText = this.add.text(10, 32, '', { fontSize: '14px', color: '#ff8888' });

    this.add
      .text(this.scale.width - 70, 10, '← 나가기', { fontSize: '14px', color: '#aaaaaa' })
      .setInteractive()
      .on('pointerdown', () => this.endCombat());

    this.cursors = this.input.keyboard ? this.input.keyboard.createCursorKeys() : null;
    this.enemyHitTimer = this.time.addEvent({
      delay: ENEMY_HIT_INTERVAL_MS,
      loop: true,
      callback: () => {
        this.playerHp = Math.max(0, this.playerHp - ENEMY_HIT_DAMAGE);
      },
    });
  }

  update(time, delta) {
    if (this.session.outcome) return;

    tickCombat(this.session, delta, this.playerHp);

    const remainingMs = Math.max(0, COMBAT_DURATION_MS - this.session.elapsedMs);
    this.timerText.setText(`${Math.ceil(remainingMs / 1000)}s`);
    this.hpText.setText(`HP ${this.playerHp}`);

    if (this.cursors) {
      const step = PLAYER_MOVE_SPEED * (delta / 1000);
      if (this.cursors.left.isDown) this.player.x -= step;
      if (this.cursors.right.isDown) this.player.x += step;
      if (this.cursors.up.isDown) this.player.y -= step;
      if (this.cursors.down.isDown) this.player.y += step;
    }

    if (this.session.outcome === 'cleared') {
      addReward(this.session, CLEAR_REWARD);
      this.endCombat();
    } else if (this.session.outcome === 'failed') {
      this.endCombat();
    }
  }

  endCombat() {
    if (this.enemyHitTimer) this.enemyHitTimer.remove();
    const state = store.getState();
    settleCombat(this.session, state.currency, state.character);
    store.notify();
    this.scene.start('IdleScene');
  }
}
```

- [ ] **Step 2: 임시 부트스트랩에 CombatScene 등록 후 수동 확인**

`src/main.js`(Task 10에서 만든 임시본)을 다음으로 교체:

```js
import Phaser from 'phaser';
import { IdleScene } from './scenes/IdleScene.js';
import { CombatScene } from './scenes/CombatScene.js';

new Phaser.Game({
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  parent: 'game-container',
  backgroundColor: '#1b1b1b',
  scene: [IdleScene, CombatScene],
});
```

Run: `npm run dev`
Expected:
1. 브라우저에서 IdleScene이 보이고 캐릭터가 좌우로 움직인다.
2. 화면 상단을 클릭하면 전체화면 전투(회색 배경, 중앙 캐릭터, 타이머, HP 텍스트)로 전환된다.
3. 방향키로 캐릭터가 움직인다. HP가 0.8초마다 5씩 줄어든다.
4. "← 나가기"를 클릭하면 IdleScene으로 돌아간다.
5. HP가 0이 되거나 타이머가 0이 될 때까지 기다리면 자동으로 IdleScene으로 돌아간다.

- [ ] **Step 3: 커밋**

```bash
git add src/scenes/CombatScene.js src/main.js
git commit -m "feat: add CombatScene with survival timer and mode exit"
```

---

### Task 13: 하단 UI 패널 (DOM, 탭 4개)

**Files:**
- Create: `src/ui/BottomPanel.js`
- Test: `tests/ui/BottomPanel.test.js`

- [ ] **Step 1: 실패하는 테스트 작성 (순수 함수 `renderTab`만 단위 테스트)**

`tests/ui/BottomPanel.test.js`:
```js
import { describe, it, expect } from 'vitest';
import { renderTab } from '../../src/ui/BottomPanel.js';

function baseState() {
  return {
    character: { level: 3, skillPoints: 2, equippedItems: [] },
    currency: { gold: 120 },
    settings: { autoEquipMinGrade: 'normal' },
  };
}

describe('renderTab', () => {
  it('equipment 탭: 장착 아이템이 없으면 안내 문구를 보여준다', () => {
    expect(renderTab('equipment', baseState())).toContain('장착한 장비 없음');
  });

  it('equipment 탭: 장착 아이템 이름과 등급을 나열한다', () => {
    const state = baseState();
    state.character.equippedItems = [{ name: '녹슨 검', grade: 'normal' }];
    expect(renderTab('equipment', state)).toContain('녹슨 검 (normal)');
  });

  it('skills 탭: 레벨과 스킬 포인트를 보여준다', () => {
    expect(renderTab('skills', baseState())).toContain('레벨 3');
    expect(renderTab('skills', baseState())).toContain('스킬 포인트 2');
  });

  it('settings 탭: 자동 장착 최소 등급을 보여준다', () => {
    expect(renderTab('settings', baseState())).toContain('normal');
  });

  it('shop 탭: 보유 골드를 보여준다', () => {
    expect(renderTab('shop', baseState())).toContain('120');
  });

  it('알 수 없는 탭은 빈 문자열을 반환한다', () => {
    expect(renderTab('unknown', baseState())).toBe('');
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npx vitest run tests/ui/BottomPanel.test.js`
Expected: FAIL — `Cannot find module '../../src/ui/BottomPanel.js'`

- [ ] **Step 3: 최소 구현 작성**

`src/ui/BottomPanel.js`:
```js
import { store } from '../state/globalStore.js';

const TABS = ['equipment', 'skills', 'settings', 'shop'];
const TAB_LABELS = { equipment: '장비', skills: '스킬', settings: '설정', shop: '상점' };

export function renderTab(tab, state) {
  if (tab === 'equipment') {
    if (state.character.equippedItems.length === 0) {
      return '<ul><li>장착한 장비 없음</li></ul>';
    }
    return `<ul>${state.character.equippedItems
      .map((i) => `<li>${i.name} (${i.grade})</li>`)
      .join('')}</ul>`;
  }
  if (tab === 'skills') {
    return `<p>레벨 ${state.character.level} · 스킬 포인트 ${state.character.skillPoints}</p>`;
  }
  if (tab === 'settings') {
    return `<label>자동 장착 최소 등급: ${state.settings.autoEquipMinGrade}</label>`;
  }
  if (tab === 'shop') {
    return `<p>골드: ${state.currency.gold}</p>`;
  }
  return '';
}

export function mountBottomPanel(container) {
  container.innerHTML = `
    <div class="tab-bar">
      ${TABS.map((t) => `<button data-tab="${t}" class="tab-button">${TAB_LABELS[t]}</button>`).join('')}
    </div>
    <div class="tab-content"></div>
  `;

  const content = container.querySelector('.tab-content');
  let activeTab = 'equipment';

  function render() {
    content.innerHTML = renderTab(activeTab, store.getState());
  }

  container.querySelectorAll('.tab-button').forEach((btn) => {
    btn.addEventListener('click', () => {
      activeTab = btn.dataset.tab;
      render();
    });
  });

  store.subscribe(render);
  render();
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npx vitest run tests/ui/BottomPanel.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: 커밋**

```bash
git add src/ui/BottomPanel.js tests/ui/BottomPanel.test.js
git commit -m "feat: add bottom panel with 4 tabs (equipment/skills/settings/shop)"
```

---

### Task 14: 최종 통합 — main.js (저장/불러오기 + 하단 패널 연결)

**Files:**
- Modify: `src/main.js`

**Depends on:** Task 4 (persistence), Task 10/12 (scenes), Task 13 (BottomPanel)

- [ ] **Step 1: main.js를 최종본으로 교체**

`src/main.js`:
```js
import Phaser from 'phaser';
import { IdleScene } from './scenes/IdleScene.js';
import { CombatScene } from './scenes/CombatScene.js';
import { store } from './state/globalStore.js';
import { saveState, loadState } from './state/persistence.js';
import { mountBottomPanel } from './ui/BottomPanel.js';

const AUTOSAVE_INTERVAL_MS = 10000;

const saved = loadState();
if (saved) {
  store.setState(saved);
}

mountBottomPanel(document.getElementById('bottom-panel'));

setInterval(() => {
  saveState(store.getState());
}, AUTOSAVE_INTERVAL_MS);

window.addEventListener('beforeunload', () => {
  saveState(store.getState());
});

new Phaser.Game({
  type: Phaser.AUTO,
  width: 360,
  height: 640,
  parent: 'game-container',
  backgroundColor: '#1b1b1b',
  scene: [IdleScene, CombatScene],
});
```

- [ ] **Step 2: 수동 통합 검증**

Run: `npm run dev`
Expected 확인 사항:
1. 첫 로드 시 저장된 값이 없으면(최초 1회) 기본 상태(골드 0, 레벨 1)로 시작한다.
2. IdleScene에서 몇 초 기다리면 하단 "상점" 탭의 골드 숫자가 올라간다(= `BottomPanel`이 store 변경에 반응).
3. 상단을 탭해 전투에 진입, HP를 0으로 떨어뜨리거나 타이머가 끝날 때까지 기다려 복귀 — 복귀 후 골드가 전투 보상만큼 추가로 늘어 있어야 한다.
4. 페이지를 새로고침한다 — "장비" 탭에 그 사이 자동 장착된 장비가 표시되는 등 이전 상태가 유지된다(10초 자동 저장 또는 `beforeunload` 저장 덕분).
5. 브라우저 개발자 도구 콘솔에 에러가 없어야 한다.

- [ ] **Step 3: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 모든 테스트 PASS (Task 2~13에서 작성한 전체 테스트 스위트)

- [ ] **Step 4: 커밋**

```bash
git add src/main.js
git commit -m "feat: wire persistence and bottom panel into game bootstrap"
```

---

## Self-Review 요약

- **스펙 커버리지:** 코어 루프(Task 9/10/11/12), 화면/UI 구조(Task 10/12/13), MVP 시스템 범위 — 드롭률/등급(Task 5), 자동 장착(Task 6), 스킬트리 1~2개(Task 7) — 데이터 모델(Task 2/3), 기술 스택 Phaser+웹네이티브(Task 1/10/12), 에러 처리 — 전투 중 이탈 시 정산(Task 11 `settleCombat`은 outcome 무관하게 항상 호출), 인벤토리 초과(Task 8) — 모두 대응하는 Task가 있다. 룬워드/큐빙/감정/저주오라/보스패턴/경매장은 스펙의 "2차 이후 로드맵"이므로 이 플랜에 포함하지 않았다.
- **플레이스홀더 스캔:** 모든 Step에 실행 가능한 코드/명령/기대 결과를 명시했다. `main.js`는 Task 1에서 의도적으로 임시 콘솔 로그로 시작해 Task 14에서 최종본으로 교체된다고 명시했다.
- **타입/이름 일관성:** `Character{level, exp, stats, equippedItems, skillPoints, skills}`, `Item{id, name, grade, statBonus, slot}`, `Currency{gold}`, `RunState{mode, stageIndex, combatTimer}`를 Task 2에서 정의한 이후 모든 Task에서 동일한 필드명을 사용했다. `STAGE_LENGTH_PX`, `IDLE_COMBAT_TICK_MS`, `COMBAT_DURATION_MS` 등 상수는 정의한 모듈에서 export해 가져다 쓰도록 했다(하드코딩 중복 없음).
