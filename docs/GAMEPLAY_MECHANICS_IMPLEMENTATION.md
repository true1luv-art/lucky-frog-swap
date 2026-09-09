# Lucky Frog — Combined A+B Gameplay Mechanics Implementation Plan

> Goal: turn the current farm/trade loop into **"Farm funds the fight, and food fuels it."**
>
> This document is a step-by-step, codebase-specific implementation guide. It assumes the project already uses:
> - `src/features/game-stores/useGameStore.ts` (Zustand, optimistic event queue, `LOCAL_ONLY = true`)
> - `src/features/events/index.ts` (central `GameAction` union + dispatcher)
> - `src/phaser/scenes/FarmScene.ts` (Phaser scene lifecycle)
> - `src/phaser/entities/Player.ts`, `src/phaser/systems/InputSystem.ts`

---

## 1. End-state summary

- **Four crops only:** Potato, Carrot, Cabbage, Wheat.
- **Animal feed mapping:**
  - Carrot → Chicken (Egg)
  - Cabbage → Sheep (Wool)
  - Wheat → Cow (Milk)
- **Wood/Stone are not sellable** — they are only for seeds, crafting, and building.
- **Gold is the sell currency** — earned by selling crops, cooked food, fish, and animal produce.
- **Food restores HP.**
- **Combat:** a new enemy entity roams the farm, aggros, chases, and attacks.
- **Player weapon:** an Archero-style bow that fires straight-line arrows with a fixed max range.
- **Bow upgrades:** gold sink at the blacksmith NPC; higher tiers = more damage, range, and faster fire rate.
- **Death:** HP hits 0 → respawn at the farm spawn point, lose a small gold penalty, enemies reset.

---

## 2. Current state inventory (things already exist / already need fixing)

| Area | File | Status |
|------|------|--------|
| `GameState` / items / coins / hp | `src/features/types/gameplay/game.ts` | `hp` and `coins` already exist. |
| Food HP restoration | `src/features/events/consume/consumeFood.ts` | Works, but caps at hard-coded `INITIAL_HP` instead of `getMaxHp()`. |
| Five crops (includes Pumpkin) | `src/features/game/crops.ts`, `src/features/types/gameplay/crops.ts` | Needs to become four crops. |
| Sheep feed | `src/features/game/animals.ts` | Currently `Wheat`; needs to become `Cabbage`. |
| Animal feed visuals | `src/phaser/farm/systems/AnimalSystem.ts` | `CROP_TEXTURE` / `FEED_ICON` still stale. |
| Wood/Stone sell prices | `src/features/game/sell-prices.ts` | Currently `Wood: 3`, `Stone: 4`; must become `0`. |
| Food recipes with Pumpkin | `src/features/types/gameplay/craftables.ts` | Pumpkin Soup and Pumpkin Pie must be removed / replaced. |
| Skills/XP tables | `src/features/game/skills.ts` | Contains `harvest_pumpkin`, `cook_pumpkin_*`; must be cleaned. |
| Equipment / armor system | `src/features/types/gameplay/equipment.ts`, `src/features/game/equipment.ts` | Existing tiers and stat rolls can be reused for the bow. |
| Event architecture | `src/features/events/index.ts` | Easy to add `player.hurt`, `player.died`, `enemy.defeated`, `bow.upgrade`. |
| Phaser scene | `src/phaser/scenes/FarmScene.ts` | New `EnemySystem` and `ProjectileSystem` will be instantiated here. |
| Player entity | `src/phaser/entities/Player.ts` | Sprite/facing can be reused for enemies. |
| Input system | `src/phaser/systems/InputSystem.ts` | Needs an attack input channel. |
| UI overlays | `src/phaser/PhaserCanvas.tsx` | Needs an HP bar, attack button, and a bow-upgrade modal. |

---

## 3. Core constants and helpers to add

### 3.1 HP and max HP

Create `src/features/game/hp.ts` (or update the existing file):

```ts
export const INITIAL_HP = 100;
export const HP_PER_COOKING_LEVEL = 10;

import { getSkillLevel } from "./skills";

export function getMaxHp(cookingXP: number): number {
  const level = Math.max(1, getSkillLevel(cookingXP));
  return INITIAL_HP + (level - 1) * HP_PER_COOKING_LEVEL;
}
```

Use it in:
- `consumeFood.ts` when restoring HP (`nextHp = Math.min(max, current + heal)`)
- `useGameStore.ts` initial state (`hp: INITIAL_HP`)
- respawn logic (`hp: getMaxHp(state.skills.cooking ?? 0)`)

### 3.2 Bow config

Create `src/features/game/bow.ts`:

```ts
export type BowTier = "Wood" | "Iron" | "Silver" | "Emerald" | "Diamond" | "Ignisite";

export interface BowStats {
  damage: number;          // HP damage per hit
  rangeTiles: number;    // arrow max travel in tiles
  fireRateMs: number;    // min time between shots
  goldCost: number;      // upgrade cost from previous tier
}

export const BOW_TIER: Record<BowTier, BowStats> = {
  Wood:     { damage: 4,  rangeTiles: 6,  fireRateMs: 650, goldCost: 0 },
  Iron:     { damage: 8,  rangeTiles: 7,  fireRateMs: 600, goldCost: 250 },
  Silver:   { damage: 14, rangeTiles: 8,  fireRateMs: 550, goldCost: 800 },
  Emerald:  { damage: 22, rangeTiles: 9,  fireRateMs: 500, goldCost: 2000 },
  Diamond:  { damage: 34, rangeTiles: 10, fireRateMs: 450, goldCost: 5000 },
  Ignisite: { damage: 55, rangeTiles: 12, fireRateMs: 380, goldCost: 12000 },
};

export const BOW_TIER_ORDER: BowTier[] = [
  "Wood", "Iron", "Silver", "Emerald", "Diamond", "Ignisite",
];
```

### 3.3 Enemy config

Create `src/features/game/enemies.ts`:

```ts
export type EnemyType = "goblin" | "skeleton" | "wolf";

export interface EnemyConfig {
  hp: number;
  damage: number;
  speed: number;           // pixels / sec
  aggroRangeTiles: number;
  attackRangeTiles: number;
  attackCooldownMs: number;
  xp: number;
  goldDrop: number;
  spriteTint: number;      // e.g. 0xff5555 for red goblin
}

export const ENEMY_CONFIG: Record<EnemyType, EnemyConfig> = {
  goblin:    { hp: 18,  damage: 8,  speed: 60, aggroRangeTiles: 6, attackRangeTiles: 1, attackCooldownMs: 900,  xp: 12,  goldDrop: 3,  spriteTint: 0x55ff55 },
  skeleton:  { hp: 30,  damage: 12, speed: 45, aggroRangeTiles: 7, attackRangeTiles: 1.2, attackCooldownMs: 1100, xp: 20, goldDrop: 6,  spriteTint: 0xeeeeee },
  wolf:      { hp: 24,  damage: 15, speed: 90, aggroRangeTiles: 8, attackRangeTiles: 1.5, attackCooldownMs: 800,  xp: 25, goldDrop: 8,  spriteTint: 0xff9955 },
};
```

### 3.4 Spawn points

Add to `src/phaser/positions/enemySpawnPoints.ts`:

```ts
export interface EnemySpawnPoint {
  id: string;
  x: number;   // tile coords
  y: number;
  type: EnemyType;
  maxAlive: number;
}

export const ENEMY_SPAWN_POINTS: EnemySpawnPoint[] = [
  { id: "forest_east",  x: 38, y: 12, type: "goblin", maxAlive: 2 },
  { id: "forest_north", x: 18, y: 4,  type: "goblin", maxAlive: 2 },
  { id: "ruins_west",   x: 6,  y: 28, type: "skeleton", maxAlive: 1 },
  { id: "plains_south", x: 30, y: 36, type: "wolf", maxAlive: 2 },
];
```

---

## 4. State changes

### 4.1 Add bow to `GameState`

In `src/features/types/gameplay/game.ts`:

```ts
import type { BowTier } from "@/features/game/bow";

export interface GameState {
  // ... existing fields ...
  hp: number;
  bowTier: BowTier;
  // keep equipment.armor separate; bow is its own progression track
}
```

Default in `createInitialGameState` (wherever the initial factory lives, usually near `useGameStore.ts`):

```ts
bowTier: "Wood",
hp: INITIAL_HP,
```

### 4.2 Add combat actions

In `src/features/events/index.ts`, expand `GameAction`:

```ts
export type GameAction =
  // ... existing actions ...
  | { type: "player.hurt"; damage: number }
  | { type: "player.died" }
  | { type: "enemy.defeated"; enemyId: string; enemyType: EnemyType }
  | { type: "bow.upgrade"; tier: BowTier };
```

In `processGameEvent`:

```ts
import { getMaxHp, INITIAL_HP } from "@/features/game/hp";
import { BOW_TIER, BOW_TIER_ORDER } from "@/features/game/bow";
import { ENEMY_CONFIG } from "@/features/game/enemies";

function processGameEvent(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    // ... existing cases ...

    case "player.hurt": {
      const maxHp = getMaxHp(state.skills.cooking ?? 0);
      const nextHp = Math.max(0, state.hp - action.damage);
      return { ...state, hp: nextHp };
    }

    case "player.died": {
      const maxHp = getMaxHp(state.skills.cooking ?? 0);
      const deathTax = Decimal.max(
        new Decimal(5),
        (state.coins ?? new Decimal(0)).mul(0.1)
      );
      return {
        ...state,
        hp: maxHp,
        coins: (state.coins ?? new Decimal(0)).sub(deathTax),
      };
    }

    case "enemy.defeated": {
      const cfg = ENEMY_CONFIG[action.enemyType];
      const combatXP = (state.skills.combat ?? 0) + cfg.xp;
      return {
        ...state,
        coins: (state.coins ?? new Decimal(0)).add(cfg.goldDrop),
        skills: { ...state.skills, combat: combatXP },
      };
    }

    case "bow.upgrade": {
      const currentIndex = BOW_TIER_ORDER.indexOf(state.bowTier);
      const nextIndex = BOW_TIER_ORDER.indexOf(action.tier);
      if (nextIndex !== currentIndex + 1) throw new Error("Can only upgrade one tier at a time");
      const cost = new Decimal(BOW_TIER[action.tier].goldCost);
      if ((state.coins ?? new Decimal(0)).lt(cost)) throw new Error("Not enough gold");
      return {
        ...state,
        coins: (state.coins ?? new Decimal(0)).sub(cost),
        bowTier: action.tier,
      };
    }
  }
}
```

> Note: add `combat` to the `skills` record if it does not exist yet.

---

## 5. Phase-by-phase implementation

### Phase 0 — Cleanup the economy and roster

Do this first so later combat/economy numbers are stable.

#### 0.1 Remove Pumpkin

Edit `src/features/game/crops.ts` and `src/features/types/gameplay/crops.ts`:

- Remove `Pumpkin` from `CropName` / `SeedName`.
- Remove `Pumpkin` from `CROPS_CONFIG`.
- Remove `Pumpkin` seeds.
- Adjust `GROWTH_DURATION` or seed costs if needed.

Edit `src/features/types/gameplay/craftables.ts`:

- Remove `Pumpkin Soup` and `Pumpkin Pie` from `FOODS()`.
- Remove any crafting recipe that uses Pumpkin.

Edit `src/features/game/sell-prices.ts`:

- Remove Pumpkin crop / food prices.

Edit `src/features/game/skills.ts`:

- Remove `harvest_pumpkin`, `cook_pumpkin_soup`, `cook_pumpkin_pie`.

#### 0.2 Fix sheep feed

In `src/features/game/animals.ts`:

```ts
Sheep: {
  // ...
  feedItem: "Cabbage",
  feedAmount: 1,
  produceItem: "Wool",
  // ...
}
```

Also update `src/features/types/gameplay/craftables.ts` animal purchase descriptions.

#### 0.3 Make Wood/Stone unsellable

In `src/features/game/sell-prices.ts`:

```ts
export const RESOURCE_SELL_PRICES: Partial<Record<ResourceName, number>> = {
  Wood: 0,
  Stone: 0,
  // keep sellable resources below if any
};
```

The existing `sell` handler already throws `"Not for sale"` when `unitPrice === 0`, so no extra guard is needed. Optionally grey out Wood/Stone in the Market UI.

#### 0.4 Sync animal feed visuals

In `src/phaser/farm/systems/AnimalSystem.ts`, fix:

```ts
const CROP_TEXTURE: Record<AnimalKind, string> = {
  chicken: "feed_carrot",
  cow: "feed_wheat",
  sheep: "feed_cabbage",
};

const FEED_ICON: Record<AnimalKind, string> = {
  chicken: "carrot",
  cow: "wheat",
  sheep: "cabbage",
};
```

Ensure the corresponding icons exist in `public/assets/phaser/crops/`.

#### 0.5 Update `consumeFood.ts` to use max HP

```ts
import { getMaxHp } from "@/features/game/hp";

// inside handler
const maxHp = getMaxHp(state.skills.cooking ?? 0);
const heal = recipe.hpRestore ?? 0;
const nextHp = Math.min(maxHp, (state.hp ?? maxHp) + heal);
return { ...state, hp: nextHp };
```

---

### Phase 1 — HP bar and food UI

Before adding enemies, make sure the player can see and manage HP.

#### 1.1 Add `getMaxHp` everywhere

- Initial state factory (`useGameStore.ts`)
- Respawn handler (`player.died` event)
- HUD read path

#### 1.2 Add an HP bar to the HUD

Edit `src/features/game-components/hud/Hud.tsx`:

```tsx
const hp = useGameStore((s) => s.state.hp);
const maxHp = useGameStore((s) => getMaxHp(s.state.skills.cooking ?? 0));

<div className="hud-hp-bar">
  <div style={{ width: `${(hp / maxHp) * 100}%` }} />
</div>
```

Style with a red/green pixel-art look matching the existing HUD.

#### 1.3 Add quick-eat UI (optional but recommended)

Add a small "Eat" button in the HUD that opens a modal listing owned food. Clicking a food dispatches `consumeFood`. This replaces needing to open the Kitchen modal mid-combat.

---

### Phase 2 — Enemy entity + AI

#### 2.1 Asset reuse

Use the **existing player sprite sheets** for enemies:

- `spr_idle_strip9.png` → idle
- `spr_walk_strip8.png` → walk
- `spr_hammering_strip23.png` → attack (reuse as a generic melee swing)

Apply a tint per enemy type so they look distinct.

#### 2.2 Create `src/phaser/entities/Enemy.ts`

```ts
export class Enemy {
  sprite: Phaser.Physics.Arcade.Sprite;
  hp: number;
  maxHp: number;
  state: "idle" | "wander" | "chase" | "attack" | "return" = "idle";
  spawnX: number;
  spawnY: number;
  lastAttackTime = 0;
  targetX = 0;
  targetY = 0;
  id: string;
  type: EnemyType;

  constructor(
    scene: Phaser.Scene,
    id: string,
    type: EnemyType,
    x: number,
    y: number,
  ) {
    // ... create sprite, set tint, enable physics, set depth, store spawn point
  }

  takeDamage(amount: number) { this.hp -= amount; }
  isDead() { return this.hp <= 0; }
}
```

#### 2.3 Create `src/phaser/systems/EnemySystem.ts`

Responsibilities:
- Spawn enemies from `ENEMY_SPAWN_POINTS`.
- Despawn / respawn on death or distance leash.
- Run AI state machine each frame.
- Request `player.hurt` events on hit.
- Fire `enemy.defeated` event on death.

AI state machine (per enemy):

```text
IDLE    → pick random nearby point every 1–2s
WANDER  → move toward target point
CHASE   → player within aggro range and not too far from spawn
ATTACK  → within attack range → stop moving, play attack anim, damage player
RETURN  → player left leash range (e.g. 10 tiles) → run back to spawn
```

Pseudo-code for `update(dt, playerSprite)`:

```ts
const distToPlayer = Phaser.Math.Distance.Between(enemy.sprite, playerSprite);
const distToSpawn = Phaser.Math.Distance.Between(enemy.sprite, enemy.spawnPoint);

if (enemy.state !== "return" && distToSpawn > LEASH_TILES * TILE_SIZE) {
  enemy.state = "return";
} else if (distToPlayer <= ATTACK_RANGE) {
  enemy.state = "attack";
} else if (distToPlayer <= AGGRO_RANGE) {
  enemy.state = "chase";
}

switch (enemy.state) {
  case "idle":
    pick new wander target after timer; state = "wander"; break;
  case "wander":
    moveTo(enemy.targetX, enemy.targetY); if close enough → idle; break;
  case "chase":
    moveTo(playerSprite.x, playerSprite.y); break;
  case "return":
    moveTo(enemy.spawnX, enemy.spawnY); if close enough → idle; break;
  case "attack":
    stop();
    if (now - enemy.lastAttackTime > config.attackCooldownMs) {
      playAttackAnim();
      dispatch("player.hurt", { damage: config.damage });
      enemy.lastAttackTime = now;
    }
    break;
}
```

Use `scene.physics.moveToObject(sprite, target, speed)` for movement. Flip the sprite scale.x based on velocity direction.

#### 2.4 Wire `EnemySystem` into `FarmScene.ts`

In `_createInternal()`:

```ts
this.enemySystem = new EnemySystem(this, this.player.sprite);
```

In `update(time, delta)`:

```ts
this.enemySystem.update(delta, this.player.sprite, this.player.facing);
```

#### 2.5 Handle enemy death

When an enemy dies:

1. Play a death/tint-fade animation.
2. After ~300ms destroy the sprite.
3. Dispatch `enemy.defeated` event to grant gold + combat XP.
4. Respawn timer: after e.g. 10–20s, spawn a new enemy at the same spawn point.

Use the existing window event bridge pattern if the Phaser system cannot import the store directly; otherwise call `useGameStore.getState().dispatch` from the bridge.

---

### Phase 3 — Bow and projectile combat

#### 3.1 Add the arrow asset

Add a small 16×16 (or 32×32) pixel arrow image to:

```text
public/assets/phaser/projectiles/arrow.png
```

Load it in `src/phaser/loaders/PlayerAssetLoader.ts` or a new loader:

```ts
scene.load.image("arrow", "/assets/phaser/projectiles/arrow.png");
```

#### 3.2 Create `src/phaser/systems/ProjectileSystem.ts`

```ts
export interface Arrow {
  sprite: Phaser.Physics.Arcade.Sprite;
  startX: number;
  startY: number;
  maxDist: number;
  damage: number;
  enemyCollider?: Phaser.Physics.Arcade.Collider;
}

export class ProjectileSystem {
  arrows: Arrow[] = [];
  group: Phaser.Physics.Arcade.Group;

  constructor(scene: Phaser.Scene) {
    this.group = scene.physics.add.group({ defaultKey: "arrow" });
  }

  fire(scene: Phaser.Scene, x: number, y: number, facing: "up" | "down" | "left" | "right", stats: BowStats) {
    const arrow = this.group.get(x, y, "arrow") as Phaser.Physics.Arcade.Sprite;
    arrow.setActive(true).setVisible(true);
    arrow.setDepth(y);

    const speed = 400; // pixels/sec
    const dir = { up: { x: 0, y: -1 }, down: { x: 0, y: 1 }, left: { x: -1, y: 0 }, right: { x: 1, y: 0 } }[facing];

    arrow.setVelocity(dir.x * speed, dir.y * speed);
    arrow.setRotation(Math.atan2(dir.y, dir.x));

    this.arrows.push({
      sprite: arrow,
      startX: x,
      startY: y,
      maxDist: stats.rangeTiles * TILE_SIZE,
      damage: stats.damage,
    });
  }

  update() {
    this.arrows = this.arrows.filter((a) => {
      const traveled = Phaser.Math.Distance.Between(a.startX, a.startY, a.sprite.x, a.sprite.y);
      if (!a.sprite.active || traveled >= a.maxDist) {
        this.kill(a);
        return false;
      }
      return true;
    });
  }

  kill(a: Arrow) {
    a.sprite.setActive(false).setVisible(false);
    a.sprite.setVelocity(0);
  }
}
```

#### 3.3 Collision: arrow → enemy

In `FarmScene._createInternal()`, after creating both systems:

```ts
this.physics.add.overlap(
  this.projectileSystem.group,
  this.enemySystem.enemyGroup,
  (arrowSprite, enemySprite) => {
    const arrow = this.projectileSystem.findBySprite(arrowSprite);
    const enemy = this.enemySystem.findBySprite(enemySprite);
    if (!arrow || !enemy || enemy.isDead()) return;

    enemy.takeDamage(arrow.damage);
    this.projectileSystem.kill(arrow);

    // flash white
    enemy.sprite.setTint(0xffffff);
    scene.time.delayedCall(80, () => enemy.sprite.setTint(enemy.config.spriteTint));

    if (enemy.isDead()) {
      this.enemySystem.handleDeath(enemy);
    }
  }
);
```

#### 3.4 Add attack input

Edit `src/phaser/systems/InputSystem.ts`:

```ts
export class InputSystem {
  attackRequested = false;

  // in constructor
  scene.input.keyboard?.on("keydown-SPACE", () => { this.attackRequested = true; });

  // optional: right-click to fire
  scene.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
    if (pointer.button === 2) this.attackRequested = true;
  });
}
```

For mobile, add an attack button in `src/phaser/ui/MobileActionButton.tsx` (or a new overlay) that sets a window flag or calls a scene method.

#### 3.5 Fire rate gate

Add to `Player.ts` or `FarmScene.update()`:

```ts
if (input.attackRequested && now - this.lastAttackTime > BOW_TIER[state.bowTier].fireRateMs) {
  this.fireArrow();
  this.lastAttackTime = now;
}
input.attackRequested = false;
```

`fireArrow()` reads `this.player.facing`, the current `bowTier`, and calls `projectileSystem.fire(...)`.

#### 3.6 Bow animation

Reuse the existing `mine` or `axe` player animation as a bow-draw visual. Play it for ~200ms on fire, then return to idle/walk.

---

### Phase 4 — Gold sinks: bow upgrades and plot expansion

#### 4.1 Bow upgrade UI

Add a new React modal or a tab in the existing blacksmith-related UI. Recommended path:

- Click the **blacksmith NPC** in the world → open a modal.
- The modal shows:
  - Current bow tier
  - Next tier stats
  - Gold cost
  - "Upgrade" button

Example event dispatch:

```ts
const currentTier = useGameStore((s) => s.state.bowTier);
const nextTier = BOW_TIER_ORDER[BOW_TIER_ORDER.indexOf(currentTier) + 1];

function upgrade() {
  if (!nextTier) return;
  dispatch({ type: "bow.upgrade", tier: nextTier });
}
```

#### 4.2 Plot expansion also costs gold

If plot expansion currently costs resources, change it to gold (or a mix). This gives late-game players a reason to keep farming.

In the plot-lock UI (`PhaserCanvas.tsx` PlotPopover "locked" branch), show:

```text
Level {requiredLevel}
OR buy now for {goldCost} Gold
```

Add an event `plot.buy` that spends gold and unlocks the field.

---

### Phase 5 — Death and respawn

#### 5.1 `player.died` event

Already described in section 4.2. It:
- Refills HP to max.
- Subtracts 10% gold (min 5).
- Does **not** remove inventory.

#### 5.2 Phaser-side respawn

In `FarmScene`, subscribe to `state.hp` via the store or listen for a window event. When `hp <= 0`:

1. Pause enemy AI briefly.
2. Fade the screen.
3. Move player sprite to the farm spawn point (e.g. tile `x=20, y=20` or the house doorstep).
4. Dispatch `player.died`.
5. Clear all active enemies (they return to spawn points).
6. Fade in.

Add an invulnerability window (e.g. 2s) where the player cannot take damage and sprite flashes.

---

### Phase 6 — UI and overlays

#### 6.1 HUD additions

- HP bar + numeric `HP / MaxHP`.
- Current bow tier icon.
- Quick-slot for food (optional).
- Enemy kill count / combat XP (optional).

#### 6.2 Mobile controls

- Left joystick for movement (already exists).
- Right **attack button** for firing.
- Optional quick-eat button.

#### 6.3 Modals

- **Blacksmith / Bow upgrade modal**
- **Death recap modal** ("You died — lost X gold")
- **Enemy info** on first encounter (optional)

#### 6.4 Floating damage numbers

Reuse `ResourceDropFloater.tsx` style to spawn red/green numbers on damage/heal:

- Arrow hits enemy → `-8` (red, above enemy)
- Enemy hits player → `-12` (red, above player)
- Eating food → `+25` (green)

Fire `window.dispatchEvent(new CustomEvent("phaser-damage-number", { detail: {...} }))` from Phaser and consume it in React.

---

### Phase 7 — Balancing pass

After everything is wired, tune these numbers in one place:

| Knob | File | Starting recommendation |
|------|------|------------------------|
| Player HP / level | `src/features/game/hp.ts` | 100 + 10 per cooking level |
| Food heals | `src/features/types/gameplay/craftables.ts` | 15–60 depending on rarity |
| Bow damage/range/fire rate | `src/features/game/bow.ts` | see section 3.2 |
| Enemy HP/damage/speed | `src/features/game/enemies.ts` | see section 3.3 |
| Enemy spawn counts | `src/phaser/positions/enemySpawnPoints.ts` | 1–2 per point |
| Death gold tax | `src/features/events/index.ts` | 10%, min 5 |
| Crop sell prices | `src/features/game/sell-prices.ts` | make Wheat/Cabbage profitable; Carrot/Potato early staples |
| Seed costs | `src/features/types/gameplay/crops.ts` | keep using Wood/Stone |
| Bow upgrade costs | `src/features/game/bow.ts` | see section 3.2 |
| Plot expansion cost | wherever expansion lives | scale with farm level |

Balancing goal:
- A new player can clear goblins after ~5 minutes of farming.
- One death costs less than one full plot sale.
- Higher-tier bows feel rewarding but not required.

---

## 6. File checklist

### New files

```text
src/features/game/hp.ts
src/features/game/bow.ts
src/features/game/enemies.ts
src/phaser/positions/enemySpawnPoints.ts
src/phaser/entities/Enemy.ts
src/phaser/systems/EnemySystem.ts
src/phaser/systems/ProjectileSystem.ts
src/features/game-components/hud/CombatHud.tsx   (or add to existing Hud)
public/assets/phaser/projectiles/arrow.png
```

### Files to edit

```text
src/features/types/gameplay/game.ts
src/features/events/index.ts
src/features/game-stores/useGameStore.ts
src/features/game/crops.ts
src/features/types/gameplay/crops.ts
src/features/types/gameplay/craftables.ts
src/features/game/sell-prices.ts
src/features/game/skills.ts
src/features/game/animals.ts
src/phaser/farm/systems/AnimalSystem.ts
src/features/events/consume/consumeFood.ts
src/phaser/scenes/FarmScene.ts
src/phaser/entities/Player.ts
src/phaser/systems/InputSystem.ts
src/phaser/loaders/PlayerAssetLoader.ts
src/phaser/PhaserCanvas.tsx
src/features/game-components/hud/Hud.tsx
src/phaser/ui/MobileActionButton.tsx
src/features/game-components/PhaserModals.tsx   (or NPC modal)
```

---

## 7. Testing checklist

### Economy
- [ ] Pumpkin no longer appears in shop, kitchen, or field UI.
- [ ] Selling Wood or Stone shows "Not for sale" and does not credit gold.
- [ ] Carrot feeds chickens, Cabbage feeds sheep, Wheat feeds cows.
- [ ] Selling crops/food/fish/produce credits gold.

### HP / Food
- [ ] Eating food restores HP and does not exceed max HP.
- [ ] Max HP increases when cooking level rises.
- [ ] Quick-eat UI works.

### Enemies
- [ ] Enemies spawn at the configured points.
- [ ] Enemies idle/wander near spawn.
- [ ] Enemies chase when player enters aggro range.
- [ ] Enemies attack when close, then cooldown.
- [ ] Enemies return to spawn if player kites too far.
- [ ] Enemies use player sprite sheets with tint.

### Bow
- [ ] Space / right-click / mobile attack button fires an arrow.
- [ ] Arrow travels in a straight line in the facing direction.
- [ ] Arrow disappears after reaching max range.
- [ ] Arrow hurts the first enemy it touches.
- [ ] Fire rate respects the equipped bow tier.
- [ ] Bow tier is visible in the HUD.

### Upgrades
- [ ] Blacksmith NPC opens bow upgrade modal.
- [ ] Upgrade costs gold and only one tier at a time.
- [ ] Higher tier increases damage/range/fire rate.

### Death
- [ ] HP at 0 triggers a respawn sequence.
- [ ] Gold tax is applied.
- [ ] HP refills to max.
- [ ] Player returns to farm spawn point.
- [ ] Enemies reset.
- [ ] Brief invulnerability prevents instant re-death.

---

## 8. Acceptance criteria

1. A player can log in, farm the four crops, gather Wood/Stone, buy seeds, feed animals, cook food, and sell the outputs for gold.
2. Food can be eaten to restore HP up to a cooking-level-based max.
3. Enemies roam the farm, chase, attack, and die when shot by arrows.
4. The bow fires straight-line, fixed-range arrows in the direction the player is facing.
5. Bow upgrades at the blacksmith cost gold and improve damage/range/fire rate.
6. Death is a setback (gold loss + respawn) but not a reset of progress.
7. Wood and Stone are not sellable; gold is the only sell currency.
8. Mobile controls include movement + attack buttons.
9. The feature runs without build errors and matches the existing optimistic-event architecture.

---

## 9. Suggested implementation order

1. **Phase 0 cleanup** (remove Pumpkin, fix sheep feed, unsellable resources, sync visuals).
2. **Phase 1 HP/food** (`getMaxHp`, HUD HP bar, quick-eat).
3. **Phase 2 enemies** (Enemy class, EnemySystem, spawn points, AI, wire into FarmScene).
4. **Phase 3 bow** (arrow asset, ProjectileSystem, InputSystem attack input, collision, fire-rate).
5. **Phase 4 gold sinks** (bow upgrade modal, plot expansion gold cost).
6. **Phase 5 death** (`player.hurt`, `player.died`, respawn sequence).
7. **Phase 6 UI polish** (damage numbers, mobile attack button, death recap, balancing).

---

## 10. Notes and gotchas

- **Phaser depth:** enemies, player, and arrows should all use depth = `y` so they sort correctly.
- **Collision with tilemap:** arrows should not be blocked by decorative tiles unless those tiles are part of the physics layer. If you want arrows to stop on fences, add a collider with the fence layer.
- **Event ordering:** `player.hurt` and `player.died` should be dispatched from Phaser or a bridge. Because `useGameStore` is on `window`, Phaser systems can read/write through a thin bridge function rather than importing React code.
- **Determinism:** keep all damage/heal math in `src/features/game/*.ts` so it can be unit-tested without Phaser.
- **No network yet:** `LOCAL_ONLY = true` means all state lives in the browser. The event architecture is already ready for server sync later; do not bypass it with direct state mutations.
- **Performance:** cap total enemy count to ~8–10 and arrow count to ~20. Despawn arrows immediately on max range or enemy hit.
