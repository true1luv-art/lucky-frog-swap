# LuckyFrog — Complete Game Mechanics Reference

**Source:** TypeScript codebase (`lib/`, `shared/`, `app/api/`, `phaser/`)
**Storage:** MongoDB (server) · Zustand + localStorage (Phaser farming game, client-only)
**Token:** $LFRG (Solana SPL)
**Auth:** Solana wallet (Phantom) + JWT cookie
**Last Updated:** July 2026

---

## Two Games, One Shell

LuckyFrog contains **two distinct game systems** running inside the same Next.js application:

| | Frog System | Farming Game |
|---|---|---|
| Engine | Next.js Server Actions + API routes | Phaser 3 canvas |
| Storage | MongoDB (server-side) | **MongoDB (server-side)** + Zustand localStorage cache |
| Blockchain | Solana SPL ($LFRG) | None |
| Persistence | Permanent, cloud | **Permanent, cloud** (localStorage = offline cache only) |
| Source root | `lib/`, `shared/`, `app/api/` | `phaser/` + `lib/events/farm-action/`, `app/api/farm/` |

The two systems share only the player's **Solana wallet address** (`farmAddress` in `GameState`). As of Phase 2, all farming data is server-authoritative — MongoDB is the source of truth and localStorage is an offline read-cache only. No frog data reaches the Phaser canvas at runtime.

---

## Table of Contents

### Part A — Farming Game (Phaser / Local)

- [A1. GameState Data Model](#a1-gamestate-data-model)
- [A2. State Persistence — Zustand Store](#a2-state-persistence--zustand-store)
- [A3. Event Processing Pipeline](#a3-event-processing-pipeline)
- [A4. Stamina System](#a4-stamina-system)
- [A5. Skill System & XP](#a5-skill-system--xp)
- [A6. Farming — Crops](#a6-farming--crops)
- [A7. Forestry — Tree Chopping](#a7-forestry--tree-chopping)
- [A8. Mining — Stone, Iron, Gold](#a8-mining--stone-iron-gold)
- [A9. Animals — Chickens, Cows, Sheep](#a9-animals--chickens-cows-sheep)
- [A10. Fishing](#a10-fishing)
- [A11. Cooking](#a11-cooking)
- [A12. Workshop Crafting](#a12-workshop-crafting)
- [A13. Economy — Selling](#a13-economy--selling)
- [A14. Equipment System](#a14-equipment-system)
- [A15. Skill Bonus Ladder](#a15-skill-bonus-ladder)
- [A16. Achievement System](#a16-achievement-system)
- [A17. Initial Farm State](#a17-initial-farm-state)

### Part B — Frog System (MongoDB / Solana)

1. [System Architecture](#1-system-architecture)
2. [Data Models (MongoDB Collections)](#2-data-models-mongodb-collections)
3. [Player Registration & Auth](#3-player-registration--auth)
4. [Frog NFT System](#4-frog-nft-system)
5. [Egg System](#5-egg-system)
6. [Mining & LFRG Accrual](#6-mining--lfrg-accrual)
7. [Claim Events](#7-claim-events)
8. [Drop System (Shards & Eggs)](#8-drop-system-shards--eggs)
9. [Charm System](#9-charm-system)
10. [Staking System](#10-staking-system)
11. [Frogment Economy](#11-frogment-economy)
12. [Leveling System (Player XP)](#12-leveling-system-player-xp)
13. [Frog Leveling](#13-frog-leveling)
14. [Collection Power & Stats](#14-collection-power--stats)
15. [Supply Halving Schedule](#15-supply-halving-schedule)
16. [Hold Bonus System](#16-hold-bonus-system)
17. [Collection Completion](#17-collection-completion)
18. [Leaderboard System](#18-leaderboard-system)
19. [Market System](#19-market-system)
20. [Solana Payment Flow](#20-solana-payment-flow)
21. [RNG Map](#21-rng-map)
22. [Constants Reference](#22-constants-reference)
23. [Event Flow Diagrams](#23-event-flow-diagrams)
24. [Proposed New Game Mechanics](#24-proposed-new-game-mechanics)

---

## Part A — Farming Game (Phaser / Local)

The farming game is a full Phaser 3 canvas simulation embedded at `/game`. It is inspired by the Hearthvale/SFarming pattern and is the active/idle counterpart to the passive LFRG mining of the Frog System.

**Phase 2 Architecture (current):** All farm state is server-authoritative. MongoDB is the source of truth. Every action is validated on the server (`POST /api/farm/action`) before being persisted. The Phaser canvas applies an optimistic local update instantly for responsiveness; if the server rejects the action the local state is rolled back and an error toast is shown. `localStorage` (key `luckyfrog:farm`) is an offline read-cache written only by Zustand's `persist` middleware — never by application code directly.

---

## A1. GameState Data Model

Source: `phaser/game/types/game.ts`, `phaser/game/lib/constants.ts`

```typescript
type GameState = {
  id?:       number;
  username?: string;
  avatarUrl?: string;
  balance:   Decimal;              // In-game coins (NOT $LFRG)

  // Resource nodes on the farm map
  fields:  Record<number, GameNode>;  // 30 crop plots (indices 0–29)
  trees:   Record<number, GameNode>;  // Tree nodes
  stones:  Record<number, GameNode>;  // Stone nodes
  iron:    Record<number, GameNode>;  // Iron nodes
  gold:    Record<number, GameNode>;  // Gold nodes

  // Animals (individual state per slot)
  chickens: Record<number, ChickenState>;
  cows:     Record<number, CowState>;
  sheep:    Record<number, SheepState>;

  // Player
  inventory:          Inventory;          // All items keyed by InventoryItemName
  equipment:          PlayerEquipment;    // 5 slots: avatar/weapon/armor/mount/accessory
  baseStats:          EquipmentAttributes;
  stats:              EquipmentAttributes; // base + sum of all equipped slot attributes
  skills:             PlayerSkills;       // 7 categories × cumulative XP totals
  bonus:              SkillBonus;         // Computed rate bonuses from skill milestones
  stamina:            Stamina;            // { current: number, max: number }
  lastStaminaRegenAt: number;             // Unix ms

  // Activities
  fishing:      FishingState;
  cooking:      CookingSlot | null;       // null = kitchen idle
  activity:     Activity;                 // Lifetime action counters (used for achievements)
  achievements: Partial<Record<AchievementName, number>>;

  farmAddress?: string;                   // Solana wallet (links to Frog System)
};
```

**GameNode** — shared by crops, trees, and all ore nodes:
```typescript
type GameNode = {
  name:       CropName | "Wood" | "Stone" | "Iron" | "Gold";
  plantedAt?: number;   // crops — ms timestamp when planted
  choppedAt?: number;   // trees — ms timestamp when last chopped
  minedAt?:   number;   // ore  — ms timestamp when last mined
  amount:     number;   // base drop count before skill bonuses
  reward?:    Reward;   // optional bonus item reward node
};
```

**Animal state types:**
```typescript
type ChickenState = { fedAt?: number; multiplier: number };
type CowState     = { fedAt?: number; multiplier: number };
type SheepState   = { fedAt?: number; multiplier: number };
```

**FishingState:**
```typescript
type FishingState = {
  lastCastAt:       number;        // ms — cooldown start
  lastCaughtFish:   FishName | null;
  lastCaughtAmount: number;
  totalCasts:       number;
  totalCaught:      number;
};
```

**CookingSlot:**
```typescript
type CookingSlot = {
  item:      Food;
  startedAt: number;   // ms
  duration:  number;   // ms after speed bonus applied
} | null;
```

**EquipmentAttributes** (used for both base stats and per-slot bonuses):
```typescript
type EquipmentAttributes = {
  dodge: number; damage: number; defense: number;
  mining: number; crit: number; luck: number;
};
```

**PlayerEquipment** — 5 named slots, each an `EquipmentSlot`:
```typescript
type EquipmentSlot = {
  item_number:   number | null;
  item_id:       string | null;
  item_equipped: boolean;
  attributes:    EquipmentAttributes;
};
// Slot names: "avatar" | "weapon" | "armor" | "mount" | "accessory"
```

---

## A2. State Persistence — MongoDB + Zustand Store

Source: `phaser/game/store/useGameStore.ts`, `app/api/farm/`, `lib/events/farm-action/`

**Source of truth:** MongoDB `farms` + `inventories` collections (server). §2.1-A  
**Offline cache:** Zustand `persist` middleware, localStorage key `luckyfrog:farm`. Never written directly by application code. §2.6-C

**On page load (`hydrateFarm`):**  Always fetches `GET /api/farm` first. Server state wins for all numeric and world values. localStorage is used only when the server is unreachable (offline fallback). A monotonic `stateVersion` counter ensures stale cache is never preferred over a fresher server response.

The store exposes these public methods:

| Method | Behaviour |
|---|---|
| `send(action)` | Optimistic local update → fire `POST /api/farm/action` in background; on success merges server state; on failure rolls back to pre-action snapshot and sets `lastActionError` |
| `dispatch(action)` | Alias for `send` — Hearthvale API compatibility |
| `reset()` | Restores `INITIAL_FARM` with a fresh `lastStaminaRegenAt` |
| `resetToServerState()` | Discards local state; fetches canonical server state |
| `clearActionError()` | Clears `lastActionError` after toast shown |

**Server action API routes:**

| Route | Purpose |
|---|---|
| `GET /api/farm` | Load canonical farm state |
| `POST /api/farm/action` | Validate + persist a single farm action; P95 < 200 ms |
| `POST /api/farm/sync` | Idempotent full-state sync (create farm if new) |
| `POST /api/farm/inventory/sell` | Sell items; credits balance; tracks activity |

**Error handling (§2.6-D):** When `POST /api/farm/action` returns a non-2xx response the store rolls back the optimistic update to the pre-action snapshot and writes the server error message to `lastActionError`. `GameProvider` watches this field and fires a brief toast notification via `ToastQueueProvider`, then clears the error.

**Decimal serialisation:** `Decimal` instances serialise as `{ __decimal: "123.456" }` and revive via a custom `decimalReviver` in the store's `merge` callback. All coin arithmetic is lossless across page reloads.

**SSR safety:** A `safeLocalStorage` shim returns `null` on the server, preventing Next.js hydration mismatches.

---

## A3. Event Processing Pipeline

Source: `phaser/game/events/index.ts`, `phaser/game/lib/processEvent.ts`

All gameplay flows through a dual-path pipeline (§2.2-B, §2.6-C):

```
User interaction (Phaser scene or React modal)
  ↓
useGameStore.send(action)
  ├─ [optimistic] processGameEvent(currentState, event) → instant local update
  │                                                        (snapshot saved for rollback)
  └─ [background] POST /api/farm/action
                    ↓
                  getWallet (JWT verify)
                    ↓
                  load player + farm + inventory from MongoDB
                    ↓
                  dispatchServerAction → server-side validator (throws on error)
                    ↓
                  checkAndGrantAchievements
                    ↓
                  persistFarmChanges → $set diff to MongoDB
                    ↓
                  return { state, lastSyncAt }
                    ↓
                  [success] mergeServerState → Zustand; stateVersion++
                  [failure] rollback to snapshot; lastActionError → toast
```

**Full action type → handler table** (Phaser-side optimistic handlers; server counterparts are in `lib/events/farm-action/validate.ts`):

| Action type | Handler function | Source file |
|---|---|---|
| `item.planted` | `plant()` | `lib/events/plant/plant.ts` |
| `item.harvested` | `harvest()` | `lib/events/harvest/harvest.ts` |
| `tree.chopped` | `chop()` | `lib/events/chop/chop.ts` |
| `stone.mined` | `mineStone()` | `lib/events/mine/stoneMine.ts` |
| `iron.mined` | `mineIron()` | `lib/events/mine/ironMine.ts` |
| `gold.mined` | `mineGold()` | `lib/events/mine/goldMine.ts` |
| `chicken.feed` | `feedChicken()` | `lib/events/feed-animals/feedChicken.ts` |
| `chicken.collectEgg` | `collectEgg()` | `lib/events/collect-produce/collectEgg.ts` |
| `cow.feed` | `feedCow()` | `lib/events/feed-animals/feedCow.ts` |
| `cow.collectMilk` | `collectMilk()` | `lib/events/collect-produce/collectMilk.ts` |
| `sheep.feed` | `feedSheep()` | `lib/events/feed-animals/feedSheep.ts` |
| `sheep.collectWool` | `collectWool()` | `lib/events/collect-produce/collectWool.ts` |
| `fish.caught` | `catchFish()` | `lib/events/fishing/catchFish.ts` |
| `food.startCooking` | `startCooking()` | `lib/events/cooking/startCooking.ts` |
| `food.collectCooked` | `collectCooked()` | `lib/events/cooking/collectCooked.ts` |
| `item.crafted` | `craft()` | `lib/events/craft/craft.ts` |
| `item.sell` | `sell()` | `lib/events/sell/sell.ts` |
| `food.sell` | `sellFood()` | `lib/events/sell/sellFood.ts` |
| `produce.sell` | `sellProduce()` | `lib/events/sell/sellProduce.ts` |
| `achievement.claimed` | `claimAchievement()` | `lib/events/achievement/claimAchievement.ts` |
| `stamina.regen` | `staminaRegen()` | `lib/events/stamina/staminaRegen.ts` |
| `reward.received` | `rewarded()` | `lib/events/reward/rewarded.ts` |

---

## A4. Stamina System

Source: `phaser/game/lib/stamina.ts`

Stamina is the **action gate** for all resource-gathering. No server enforces this — it is checked inside each pure handler.

**Constants:**
```
DEFAULT_MAX_STAMINA:          100
REGEN_INTERVAL_MS:            3_600_000   (1 hour)
STAMINA_REGEN_PERCENT:        0.05        (5% of max per interval)
MAX_OFFLINE_REGEN_INTERVALS:  8           (caps offline regen at 8 hours)
```

**Stamina cost per action:**
```
harvest_crop:     1
harvest_resource: 1
chop_tree:        1
mine_stone:       1
mine_iron:        1
mine_gold:        1
plant:            0   (free to plant)
fish_cast:        3
```

**Regen formula (`calculateStaminaRegen`):**
```
elapsed          = now - lastRegenAt
intervalsElapsed = floor(elapsed / 3_600_000)
capped           = min(intervalsElapsed, 8)
regenAmount      = ceil(max × 0.05 × capped)
newStamina       = min(current + regenAmount, max)
newRegenAt       = lastRegenAt + capped × 3_600_000
```

At 100 max stamina: **5 stamina per hour**, capped at **40 stamina offline**. Full 0→100 recovery: 20 hours active or 8+ hours offline + 12 hours more active.

---

## A5. Skill System & XP

Source: `phaser/game/lib/skills.ts`, `phaser/game/types/skills.ts`

**Seven skill categories**, each stored as a cumulative total XP integer:
```typescript
type PlayerSkills = {
  farming: number; forestry: number; mining: number; fishing: number;
  cooking: number; combat: number; husbandry: number;
};
```

**Level formula:**
```
xpForNextLevel(level) = round(500 + 350 × (level−1) + 25 × (level−1)²)
```

Level 1→2: 500 XP. Level 50→51: ~60,475 XP. Level 99→100: ~244,275 XP. **Max level: 100.**

**Level lookup (`getSkillLevel`):**
```
level = 1, accumulated = 0
while level < 100:
  accumulated += xpForNextLevel(level)
  if accumulated > totalXP: break
  level++
return level
```

**Bonus recompute trigger:** After every XP-granting action, if `newLevel > oldLevel AND newLevel % 10 === 0`, then `computeBonus(skills)` replaces the full `SkillBonus` object. Otherwise the existing bonus persists unchanged.

**XP awarded per action (verbatim from `SKILL_XP` constant):**

| Action | Skill | XP |
|---|---|---|
| Harvest Potato | farming | 10 |
| Harvest Carrot | farming | 15 |
| Harvest Cabbage | farming | 20 |
| Harvest Pumpkin | farming | 25 |
| Harvest Beetroot | farming | 35 |
| Harvest Parsnip | farming | 45 |
| Harvest Radish | farming | 55 |
| Harvest Cauliflower | farming | 70 |
| Harvest Wheat | farming | 90 |
| Harvest Kale | farming | 120 |
| Chop Tree | forestry | 25 |
| Mine Stone | mining | 60 |
| Mine Iron | mining | 100 |
| Mine Gold | mining | 150 |
| Collect Egg | husbandry | 30 |
| Collect Milk | husbandry | 50 |
| Collect Wool | husbandry | 50 |
| Catch Fish | fishing | 35 |
| Cook Roasted Potato | cooking | 25 |
| Cook Carrot Stew | cooking | 35 |
| Cook Cabbage Roll | cooking | 40 |
| Cook Pumpkin Soup | cooking | 50 |
| Cook Beetroot Salad | cooking | 60 |
| Cook Parsnip Porridge | cooking | 70 |
| Cook Radish Skewers | cooking | 80 |
| Cook Cauliflower Sandwich | cooking | 90 |
| Cook Wheat Bread | cooking | 100 |
| Cook Kale Stir-fry | cooking | 120 |

---

## A6. Farming — Crops

Source: `phaser/game/types/crops.ts`, `lib/events/plant/plant.ts`, `lib/events/harvest/harvest.ts`, `phaser/game/lib/boosts.ts`

**30 crop plots** (field indices 0–29). Higher-index fields are locked behind farming skill level milestones (checked via `isFieldUnlocked(index, farmingLevel)` in `plant()`).

**Full crop table (verbatim from `CROPS()`):**

| Crop | Seed Price | Sell Price | Grow Time | Farming Level Gate |
|---|---|---|---|---|
| Potato | 0.050 | 0.065 | 1 min | 0 |
| Carrot | 0.125 | 0.175 | 5 min | 0 |
| Cabbage | 0.250 | 0.375 | 10 min | 0 |
| Pumpkin | 0.500 | 0.800 | 30 min | 0 |
| Beetroot | 0.875 | 1.575 | 1 hr | 5 |
| Parsnip | 1.500 | 3.000 | 2 hr | 5 |
| Radish | 2.250 | 4.950 | 3 hr | 5 |
| Cauliflower | 3.500 | 8.750 | 6 hr | 10 |
| Wheat | 5.000 | 14.000 | 12 hr | 10 |
| Kale | 7.500 | 22.500 | 24 hr | 10 |

**Plant action (`item.planted`) — full validation chain:**
1. Field index 0–29, integer.
2. `isFieldUnlocked(index, farmingLevel)` — throws with required level if locked.
3. `fields[index]` must be undefined (nothing already planted).
4. Action item must be a `SeedName` (`"${CropName} Seed"`).
5. Inventory must have ≥ 1 of that seed.
6. `screenTracker.calculate()` — anti-cheat geometric check.
7. Compute `plantedAt` with speed offset:
   ```
   cropTime    = CROPS()[crop].harvestSeconds
   boostedTime = cropTime × getCropSpeedMultiplier(bonus)
               = cropTime × max(0, 1 − bonus.cropSpeed)
   offset      = cropTime − boostedTime
   plantedAt   = createdAt − offset × 1000
   ```
   The earlier `plantedAt` means the crop is already partially grown at planting time, giving the speed effect without changing harvest timing math.
8. Deduct 1 seed from inventory.
9. Write `fields[index] = { name: crop, plantedAt, amount: 1 }`.

**Harvest action (`item.harvested`) — full algorithm:**
1. `hasEnoughStamina(current, "harvest_crop")` → ≥ 1.
2. Field index 0–29.
3. `fields[index]` must exist.
4. Crop must be mature: `createdAt − plantedAt ≥ harvestSeconds × 1000`.
5. `screenTracker.calculate()` anti-cheat check.
6. Delete `fields[index]`.
7. Compute yield:
   ```
   getCropYield(base, bonus) = floor(base × (1 + bonus.cropYield))
   rollCropDouble(bonus)     = Math.random() < bonus.cropDouble
   yieldAmount = rollCropDouble ? getCropYield × 2 : getCropYield
   ```
8. `inventory[cropName] += yieldAmount`.
9. `skills.farming += getHarvestXP(cropName)`.
10. If new farming level > old AND new level % 10 === 0 → `computeBonus(skills)`.
11. `stamina.current -= 1`.
12. `trackActivity("Crop Harvested", 1)` and `trackActivity("${cropName} Harvested", 1)`.

**Profit per harvest cycle per plot:**

| Crop | Profit/plot | Time | Profit/hr/plot |
|---|---|---|---|
| Potato | 0.015 | 1 min | 0.90 |
| Carrot | 0.050 | 5 min | 0.60 |
| Cabbage | 0.125 | 10 min | 0.75 |
| Pumpkin | 0.300 | 30 min | 0.60 |
| Beetroot | 0.700 | 1 hr | 0.70 |
| Parsnip | 1.500 | 2 hr | 0.75 |
| Radish | 2.700 | 3 hr | 0.90 |
| Cauliflower | 5.250 | 6 hr | 0.875 |
| Wheat | 9.000 | 12 hr | 0.75 |
| Kale | 15.000 | 24 hr | 0.625 |

All crops earn ~0.60–0.90 coins/hr/plot by design. With farming level 100 (+50% yield) and all 30 plots planted with Kale, theoretical maximum: **~675 coins/hr**.

---

## A7. Forestry — Tree Chopping

Source: `lib/events/chop/chop.ts`, `phaser/game/lib/boosts.ts`

**Tree nodes:** Fixed positions on the farm map. Each has a base `amount` of 3–5 wood.

**Recovery time:** `TREE_RECOVERY_SECONDS = 7,200` (2 hours).
```
canChop(tree, now) = now − (tree.choppedAt ?? 0) > 7_200_000
```

**Chop action (`tree.chopped`) — full algorithm:**
1. `hasEnoughStamina(current, "chop_tree")` → ≥ 1.
2. `state.trees[index]` must exist.
3. `canChop(tree, createdAt)` must be true.
4. Compute wood drop:
   ```
   getWoodYield(base, bonus) = floor(base × (1 + bonus.woodYield))
   rollWoodDouble(bonus)     = Math.random() < bonus.woodDouble
   woodDrop = rollWoodDouble ? getWoodYield × 2 : getWoodYield
   ```
5. `inventory.Wood += woodDrop`.
6. Reset tree: `{ name: "Wood", choppedAt: createdAt, amount: 3 }`.
7. `skills.forestry += 25`. Recompute bonus if milestone.
8. `stamina.current -= 1`.
9. `trackActivity("Tree Chopped", 1)`.

**Initial tree nodes** (5 trees, all immediately choppable at `choppedAt: 0`):
amounts 3, 4, 5, 5, 3.

---

## A8. Mining — Stone, Iron, Gold

Source: `lib/events/mine/stoneMine.ts`, `lib/events/mine/ironMine.ts`, `lib/events/mine/goldMine.ts`

Three ore tiers with escalating recovery times and XP:

| Resource | Recovery | Base Amount | XP | Skill |
|---|---|---|---|---|
| Stone | 4 hours | 2 | 60 | mining |
| Iron | 12 hours | 2 | 100 | mining |
| Gold | 24 hours | 2 | 150 | mining |

**Initial nodes:**
- Stone: 3 nodes (amounts 2, 3, 4)
- Iron: 2 nodes (amounts 2, 3)
- Gold: 1 node (amount 2)

**Mine action algorithm (identical pattern for all three):**
```
1. hasEnoughStamina(current, "mine_stone" | "mine_iron" | "mine_gold") → ≥ 1
2. state.[stones|iron|gold][index] must exist
3. canMine(rock, now): now − rock.minedAt > recoveryTime × 1000
4. boosted  = getOreYield(rock.amount, bonus)
            = floor(rock.amount × (1 + bonus.oreYield))
5. oreDrop  = rollOreDouble(bonus) ? boosted × 2 : boosted
            → rollOreDouble: Math.random() < bonus.oreDouble
6. inventory[resource] += oreDrop
7. Reset node: { name, minedAt: createdAt, amount: originalAmount }
8. skills.mining += XP; recompute bonus if level milestone
9. stamina.current -= 1
10. trackActivity("Stone/Iron/Gold Mined", 1)
```

**Blacksmith uses of ore:**
- The Blacksmith is reserved exclusively for collectible forging.
- Collectible recipes consume raw resources such as Wood, Stone, Iron, Gold, crops, fish, cooked foods, and animal produce directly.
- Firewood, Brick, Iron Bar, and Gold Bar have been retired; no intermediate workshop-resource conversion remains.

---

## A9. Animals — Chickens, Cows, Sheep

Source: `lib/events/feed-animals/feedChicken.ts`, `lib/events/collect-produce/collectEgg.ts`, `lib/events/feed-animals/feedCow.ts`, `lib/events/collect-produce/collectMilk.ts`, `lib/events/feed-animals/feedSheep.ts`, `lib/events/collect-produce/collectWool.ts`, `phaser/game/lib/constants.ts`

Animals are purchased from the **Barn** and stored as quantities in inventory. Individual animal states live in `state.chickens/cows/sheep` indexed by slot.

**Animal shop prices and requirements (from `ANIMALS` constant):**

| Animal | Price | Skill Gate | Feed Item | Produce | Time to Produce |
|---|---|---|---|---|---|
| Chicken | 5 coins | Farming L3 | 1 Wheat | Egg | 1 minute (60,000 ms) |
| Cow | 50 coins | Farming L6 | 1 Kale | Milk | 1.5 minutes (90,000 ms) |
| Sheep | 30 coins | Farming L8 | 1 Cabbage | Wool | 2 minutes (120,000 ms) |

**Capacity limits:**
```
MAX_CHICKENS = 10
MAX_COWS     = 5
MAX_SHEEP    = 5
```

**Re-hunger delays** (after produce collected, before animal is hungry again):
```
CHICKEN_RE_HUNGER_DELAY = 4 hours  (14_400_000 ms)
COW_RE_HUNGER_DELAY     = 6 hours  (21_600_000 ms)
SHEEP_RE_HUNGER_DELAY   = 6 hours  (21_600_000 ms)
```

**Feed action algorithm:**
```
1. animal slot index must be < inventory[AnimalType] count
2. isRehungry = animal.fedAt !== undefined
               AND now − animal.fedAt >= TIME_TO_PRODUCE + RE_HUNGER_DELAY
3. if animal.fedAt set AND NOT isRehungry → throw "not hungry"
4. deduct 1 feed item from inventory
5. animals[index] = { fedAt: createdAt, multiplier: 1 }
6. trackActivity("Animal Fed", 1)
```

**Collect action algorithm (egg/milk/wool):**
```
1. animal slot must be < inventory count
2. animal.fedAt must be set
3. now − animal.fedAt >= TIME_TO_PRODUCE
4. compute yield:
   baseAmount = animal.multiplier  (always 1 currently)
   yieldMult  = 1 + bonus.produceYield
   doubled    = Math.random() < bonus.produceDouble
   finalAmount = floor(baseAmount × yieldMult) × (doubled ? 2 : 1)
5. inventory[produce] += finalAmount
6. animals[index] = { fedAt: undefined, multiplier: 1 }
7. skills.husbandry += XP (30 for egg, 50 for milk/wool)
8. recompute bonus if milestone
```

**Produce sell prices (Bazaar):**

| Produce | Sell Price | Net vs Feed Cost |
|---|---|---|
| Egg | 0.08 | −13.92 (Wheat costs 14.00) |
| Milk | 1.50 | −21.00 (Kale costs 22.50) |
| Wool | 0.90 | +0.525 (Cabbage costs 0.375) |

Chickens and cows are **XP and ingredient sources**, not profit centres. Sheep is the only marginally profitable animal when sold raw. The real value of Eggs and Milk is as ingredients for high-value cooked foods.

---

## A10. Fishing

Source: `lib/events/fishing/catchFish.ts`, `phaser/game/lib/fishing.ts`

**Cooldown between casts:**
```
FISHING_BASE_COOLDOWN_MS = 30_000   (30 seconds)
FISHING_MIN_COOLDOWN_MS  = 15_000   (15 seconds floor)

effectiveCooldown = max(15_000, 30_000 × (1 − bonus.fishSpeed))
```

**Stamina cost:** 3 per cast.

**Fish table (14 species — verbatim from `FISH_TABLE`):**

| Fish | Weight | Min Fishing Level | Sell Price |
|---|---|---|---|
| Anchovy | 50 | 0 | 0.30 |
| Sardine | 45 | 0 | 0.35 |
| Tilapia | 40 | 0 | 0.40 |
| Herring | 35 | 0 | 0.45 |
| Trout | 28 | 10 | 0.60 |
| Sea Bass | 22 | 10 | 0.80 |
| Mackerel | 18 | 20 | 1.00 |
| Salmon | 15 | 20 | 1.20 |
| Red Snapper | 10 | 30 | 1.80 |
| Barracuda | 7 | 40 | 2.50 |
| Tuna | 5 | 50 | 3.50 |
| Swordfish | 3 | 60 | 5.00 |
| Blue Marlin | 1.5 | 70 | 8.00 |
| Oarfish | 0.5 | 90 | 15.00 |

**Rarity roll (`rollCatch`):**
```
eligible    = FISH_TABLE.filter(f => fishingLevel >= f.minLevel)
totalWeight = sum(eligible[i].weight)
roll        = Math.random() × totalWeight
for each entry in eligible:
  roll -= entry.weight
  if roll <= 0: return entry.name
return eligible[last].name
```

**Catch action (`fish.caught`) — full algorithm:**
```
1. hasEnoughStamina(current, "fish_cast") → ≥ 3
2. effectiveCooldown = max(15_000, 30_000 × (1 − bonus.fishSpeed))
   if now − fishing.lastCastAt < effectiveCooldown → throw "on cooldown"
3. fishingLevel = getSkillLevel(skills.fishing)
4. caught = rollCatch(fishingLevel)
5. amount = max(1, floor(1 × (1 + bonus.fishYield)))
6. if Math.random() < bonus.fishDouble → amount × 2
7. inventory[caught] += amount
8. skills.fishing += 35 XP; recompute bonus if milestone
9. stamina.current -= 3
10. fishing = { lastCastAt: now, lastCaughtFish: caught, lastCaughtAmount: amount,
               totalCasts: +1, totalCaught: +1 }
11. trackActivity("Fish Caught", 1)
```

---

## A11. Cooking

Source: `lib/events/cooking/startCooking.ts`, `lib/events/cooking/collectCooked.ts`, `phaser/game/types/craftables.ts`

**One cooking slot.** A recipe occupies it until collected. Cannot start another while busy.

**Kitchen recipes — all 10 foods (verbatim from `FOODS()`):**

| Food | Sell Price | Cook Time | Ingredients |
|---|---|---|---|
| Roasted Potato | 0.09 | 30 s | 2 Potato |
| Carrot Stew | 0.45 | 60 s | 3 Carrot |
| Cabbage Roll | 0.90 | 90 s | 2 Cabbage + 1 Carrot |
| Pumpkin Soup | 1.80 | 120 s | 3 Pumpkin + 1 Cabbage |
| Beetroot Salad | 4.70 | 180 s | 3 Beetroot + 1 Pumpkin |
| Parsnip Porridge | 8.10 | 240 s | 3 Parsnip + 2 Beetroot |
| Radish Skewers | 16.20 | 300 s | 4 Radish + 1 Parsnip |
| Cauliflower Sandwich | 25.20 | 360 s | 4 Cauliflower + 2 Radish |
| Wheat Bread | 45.00 | 420 s | 5 Wheat + 2 Cauliflower |
| Kale Stir-fry | 90.00 | 480 s | 5 Kale + 3 Wheat |

All cooked foods sell at a **loss vs raw ingredients** (0.69–0.86×). Cooking is an XP mechanic and **Stamina recovery source**, not a money printer.

**Start cooking (`food.startCooking`) — full algorithm:**
```
1. state.cooking !== null → throw "Kitchen is already busy"
2. recipe = FOODS()[action.item] — must exist
3. for each ingredient:
   have = inventory[ingredient.item] ?? 0
   if have < ingredient.amount → throw "not enough ingredients: ${item}"
4. deduct all ingredients from inventory
5. speedBonus = bonus.cookingSpeed ?? 0
   effectiveDuration = round(recipe.cookTime × max(0, 1 − speedBonus))
6. cookXP = getCookXP(action.item)
   skills.cooking += cookXP
   recompute bonus if level milestone
7. state.cooking = { item: action.item, startedAt: createdAt, duration: effectiveDuration }
```

**Collect cooked (`food.collectCooked`):**
```
1. state.cooking === null → throw "Nothing is cooking"
2. now − cooking.startedAt >= cooking.duration
3. inventory[cooking.item] += 1
4. if rollCookingDouble(bonus) → inventory[cooking.item] += 1
5. state.cooking = null
```

---

## A12. Blacksmith Collectible Forging

Source: `shared/types/gameplay/collectibles.ts`, `lib/events/craft/craft.ts`

The Blacksmith is reserved exclusively for permanent collectible forging. Collectible recipes consume their configured raw resources directly; the retired Firewood, Brick, Iron Bar, and Gold Bar intermediates are not part of inventory or crafting.

**Craft action (`item.crafted`):** Validates the requested collectible and quantity against the server-owned Blacksmith catalog, validates and deducts every multiplied resource requirement, then adds the collectible to inventory. Forging deducts no coins or LFRG and awards no Cooking XP.

Cooking is a separate Kitchen flow and consumes crops directly.

---

## A13. Economy — Selling

Source: `lib/events/sell/sell.ts`, `lib/events/sell/sellFood.ts`, `lib/events/sell/sellProduce.ts`

**Three sell channels:**

**1. Market — sell raw crops (`item.sell`):**
```
item must be a CropName
inventory[item] >= amount
earned = CROPS()[item].sellPrice × amount
balance += earned
inventory[item] -= amount
trackActivity("Coins Earned", earned)
```

**2. Kitchen — sell cooked food (`food.sell`):**
```
item must be a Food with sellPrice
balance += FOODS()[item].sellPrice × amount
inventory[item] -= amount
```

**3. Bazaar — sell produce (`produce.sell`):**
Egg (0.08), Milk (1.50), Wool (0.90) — from `RESOURCES` table.

---

## A14. Equipment System

Source: `phaser/game/types/equipment.ts`, `phaser/game/events/equip.ts`

**5 equipment slots:**

| Slot | Stat focus |
|---|---|
| `avatar` | Character skin / passive stat |
| `weapon` | damage, crit |
| `armor` | defense, dodge |
| `mount` | speed bonuses (future) |
| `accessory` | luck, mining |

**Stat computation:**
```
computeStats(base, equipment):
  result = { ...base }
  for each slot in equipment:
    if NOT slot.item_equipped: skip
    for each key in [dodge, damage, defense, mining, crit, luck]:
      result[key] += slot.attributes[key]
  return result
```

**Initial base stats:** `{ damage: 5, defense: 5, crit: 1, dodge: 1, luck: 1, mining: 1 }`

**Integration with Frog System:** Frog NFTs have the exact same six attributes (`dodge`, `damage`, `defense`, `mining`, `crit`, `luck`). When a player equips a frog via the collection screen, those frog stats are written into the matching `PlayerEquipment` slot and `computeStats` is called, making frog quality directly affect farming bonuses.

---

## A15. Skill Bonus Ladder

Source: `phaser/game/lib/skills.ts` — `computeBonus(skills)` function

Bonuses are cumulative and unlock every **10 levels** per skill. The full ladder (verbatim from `computeBonus`):

**Farming bonuses (cropYield, cropSpeed, cropDouble):**
| Level | Unlock |
|---|---|
| 10 | cropSpeed +5% |
| 20 | cropSpeed +5% (→10%) |
| 30 | cropYield +10% |
| 40 | cropSpeed +5% (→15%) |
| 50 | cropYield +10% (→20%) |
| 60 | cropSpeed +5% (→20%) |
| 70 | cropDouble +10% |
| 80 | cropYield +15% (→35%) |
| 90 | cropSpeed +5% (→25%) |
| 100 | cropYield +15% (→50%), cropDouble +10% (→20%) |

**Forestry bonuses (woodYield, woodRecovery, woodDouble):**
| Level | Unlock |
|---|---|
| 10 | woodYield +10% |
| 20 | woodYield +10% (→20%) |
| 30 | woodRecovery −10% |
| 40 | woodYield +10% (→30%) |
| 50 | woodRecovery −10% (→−20%) |
| 60 | woodYield +10% (→40%) |
| 70 | woodRecovery �������10% (→−30%) |
| 80 | woodYield +10% (→50%) |
| 90 | woodRecovery −10% (→−40%) |
| 100 | woodYield +25% (→75%), woodDouble +15% |

**Mining bonuses (oreYield, oreRecovery, oreDouble):**
| Level | Unlock |
|---|---|
| 10 | oreYield +10% |
| 20 | oreYield +10% (→20%) |
| 30 | oreRecovery −10% |
| 40 | oreYield +10% (→30%) |
| 50 | oreDouble +10% |
| 60 | oreRecovery −10% (→−20%) |
| 70 | oreYield +20% (→50%) |
| 80 | oreRecovery −10% (→−30%) |
| 90 | oreDouble +10% (→20%) |
| 100 | oreYield +25% (→75%), oreRecovery −10% (→−40%) |

**Husbandry bonuses (produceYield, produceSpeed, produceDouble):**
| Level | Unlock |
|---|---|
| 10 | produceSpeed −10% |
| 20 | produceSpeed −10% (→−20%) |
| 30 | produceYield +10% |
| 40 | produceSpeed −10% (→−30%) |
| 50 | produceDouble +10% |
| 60 | produceYield +10% (→20%) |
| 70 | produceSpeed −10% (→−40%) |
| 80 | produceYield +10% (→30%) |
| 90 | produceDouble +10% (→20%) |
| 100 | produceSpeed −10% (→−50%), produceYield +20% (→50%) |

**Fishing bonuses (fishYield, fishSpeed, fishDouble):**
| Level | Unlock |
|---|---|
| 10 | fishYield +10% |
| 20 | fishYield +10% (→20%) |
| 30 | fishSpeed −10% |
| 40 | fishYield +10% (→30%) |
| 50 | fishDouble +10% |
| 60 | fishSpeed −10% (→−20%) |
| 70 | fishYield +20% (→50%) |
| 80 | fishSpeed −10% (→−30%) |
| 90 | fishDouble +10% (→20%) |
| 100 | fishYield +25% (→75%), fishDouble +15% (→25%) |

**Cooking bonuses (staminaYield, cookingSpeed, cookingDouble):**
| Level | Unlock |
|---|---|
| 10 | staminaYield +10% |
| 20 | staminaYield +10% (→20%) |
| 30 | cookingDouble +5% |
| 40 | staminaYield +10% (→30%) |
| 50 | cookingSpeed −10% |
| 60 | cookingDouble +5% (→10%) |
| 70 | staminaYield +10% (→40%) |
| 80 | cookingSpeed −10% (→−20%) |
| 90 | cookingDouble +10% (→20%) |
| 100 | staminaYield +10% (→50%), cookingSpeed −10% (→−30%) |

**Combat bonuses (damageBonus, defenseBonus, dodgeBonus, critChance):**
| Level | Unlock |
|---|---|
| 10 | damageBonus +5% |
| 20 | defenseBonus +5% |
| 30 | dodgeBonus +5% |
| 40 | damageBonus +5% (→10%) |
| 50 | critChance +5% |
| 60 | defenseBonus +5% (→10%) |
| 70 | damageBonus +5% (→15%) |
| 80 | dodgeBonus +5% (→10%) |
| 90 | critChance +5% (→10%) |
| 100 | damageBonus +5% (→20%), critChance +5% (→15%) |

---

## A16. Achievement System

Source: `phaser/game/types/achievements.ts`

**83 named achievements** across 5 categories: `farming`, `animals`, `gathering`, `economy`, `progression`.

```typescript
type Achievement = {
  name:        string;
  description: string;
  category:    AchievementCategory;
  progress:    (state: GameState) => number;  // current progress value
  requirement: number;                         // threshold to unlock
  reward?:     { coins?: number; experience?: number; items?: ... };
  hidden?:     boolean;
  requires?:   AchievementName[];             // prerequisite chain
};
```

**Key achievement chains:**

*Total harvests (farming):*
First Harvest (1) → Budding Farmer (100) → Field Worker (500) → Crop Master (2,500) → Harvest Legend (10,000) → Eternal Farmer (100,000)

*Per-crop type (farming — 1,000 each):*
Spud Specialist, Carrot Commander, Cabbage Cultivator, Pumpkin Prince, Beet Baron, Wheat Whisperer, Kale King

*All-crop milestones (farming):*
All-Rounder (harvest all 10 types ≥1 each) → Crop Perfectionist (all 10 types ≥100 each)

*Animal milestones:*
Egg Collector (100) → Egg Enthusiast (1,000) → Egg Empire (10,000)
Dairy Devotee (500 milk) → Milk Magnate (5,000)
Wool Gatherer (500) → Wool Wizard (5,000)
Animal Friend → Caretaker → Animal Whisperer → Barnyard Boss (own all 3 types)

*Gathering milestones:*
First Chop → Woodcutter (50) → Lumberjack (500) → Forest Fury (5,000 trees)
Rock Breaker → Quarry Worker (50) → Stone Seeker (500) → Mountain Mover (5,000 stones)
Iron Finder → Iron Worker (100) → Iron Heart (1,000 iron)
Gold Digger → Gold Rush (50) → Golden Touch (500 gold)

*Economy milestones (coins earned lifetime):*
First Sale (1) → Merchant (100) → Trader (1,000) → Wealthy Farmer (10,000) → Tycoon (100,000)
Big Spender (1,000 spent) → High Roller (10,000 spent) | Coin Hoarder (hold 10,000)

*Progression milestones (1 achievement per 10 levels, all 7 skills):*
Example for farming: Seedling (L10) → Sprouting (L20) → Green Thumb (L30) → Crop Tender (L40) → Field Hand (L50) → Farm Hand (L60) → Crop Expert (L70) → Harvest Master (L80) → Crop Veteran (L90) → Master Farmer (L100).
Same pattern exists for Forestry, Mining, Husbandry, Fishing, Cooking, and Combat.

**Reward grant:** `claimAchievement()` event adds coins, XP, or items to the player on trigger.

---

## A17. Initial Farm State

Source: `phaser/game/lib/constants.ts` — `INITIAL_FARM` constant

When a new player opens the farming game (or after `reset()`):

```
balance:   1,000 coins
inventory:
  Potato Seed: 10
  Potato:      5    Carrot: 12   Wheat: 25
  Kale:        10   Cabbage: 10
  Chicken:     2    Cow: 1       Sheep: 1

fields:
  plots 0, 1, 2 → Potato, plantedAt: 0   (immediately harvestable)
  plots 3–29 → empty

trees:  5 nodes at amounts [3, 4, 5, 5, 3], choppedAt: 0 (immediately choppable)
stones: 3 nodes at amounts [2, 3, 4],       minedAt: 0
iron:   2 nodes at amounts [2, 3],           minedAt: 0
gold:   1 node  at amount  [2],              minedAt: 0

chickens: {}     cows: {}      sheep: {}
equipment: all slots empty
skills:    all 0 XP
bonus:     all 0
stamina:   { current: 100, max: 100 }
lastStaminaRegenAt: Date.now()
fishing:   { lastCastAt: 0, totalCasts: 0, totalCaught: 0, ... }
cooking:   null
activity:  {}
achievements: {}
farmAddress: undefined
```

---

## Part B — Frog System (MongoDB / Solana)

---

## 1. System Architecture

### Process Model

Lucky Frog Mine is a **Next.js 16 App Router** application. All game logic runs in:

- **API Route Handlers** (`app/api/**`) — stateless, JWT-authenticated
- **Event Actions** (`lib/events/**/action.ts`) — pure async functions, each owns one atomic state transition
- **Shared Pure Functions** (`shared/`) — no DB imports, safe for both client and server

### Database

MongoDB via Mongoose. A single `connectDatabase()` call is made at the top of each server action. There is no ORM beyond Mongoose schemas — queries are hand-written with Mongoose model methods.

### Authentication

```
Client wallet signs → POST /api/auth/login → verifyToken (JWT, 7d TTL)
JWT stored as httpOnly cookie `lfrg_token`
Minimum hold check: wallet must hold >= MIN_HOLD_LFRG $LFRG on-chain
```

### State Mutation Rule

**`recompute-player` is the single write path for `player.stats` and `player.minerate`.** No other event writes those fields directly. This guarantees consistency: frog changes always flush the stash at the old rate before computing the new one.

---

## 2. Data Models (MongoDB Collections)

### 2.1 `players` Collection

| Field | Type | Default | Description |
|---|---|---|---|
| `wallet` | String | required | Solana wallet address, unique index |
| `username` | String | — | Optional display name |
| `lfrg` | Number | 0 | Stashed (pre-claim) LFRG at last snapshot |
| `unclaimedUpdatedAt` | Number | 0 | Unix ms timestamp when `lfrg` was last snapshotted |
| `stashSize` | Number | 10,000 | UI badge threshold only — does NOT cap accrual |
| `charm` | Number | 0 | Burned LFRG accumulated as Charm |
| `minerate` | Number | 0 | LFRG/sec, recomputed on every frog change |
| `lastclaim` | Number | 0 | Unix ms of last successful claim |
| `lastregen` | Number | 0 | Unix ms of last mine-rate-affecting event (decay clock) |
| `stats.mining` | Number | 0 | Sum of (frog.mining × levelMult) across all frogs |
| `stats.luck` | Number | 0 | Sum frog luck + holdBonus.luck |
| `stats.dodge` | Number | 0 | Sum frog dodge + holdBonus.dodge |
| `stats.crit` | Number | 0 | min(frogCrit, 50) + computeCritFromCharm(charm) |
| `stats.damage` | Number | 0 | Sum frog damage × levelMult |
| `stats.defense` | Number | 0 | Sum frog defense × levelMult |
| `xp` | Number | 0 | Cumulative XP (from claim draws, indexed) |
| `level` | Number | 1 | Player level 1–100 (derived from xp, indexed) |
| `registrationTime` | Number | required | Unix ms of account creation |
| `referrer` | String | — | Referrer wallet address |
| `collectionCompleted` | Boolean | false | True once all 15 unique card types owned |
| `collectionCompletedAt` | Number | — | Unix ms when collection was first completed |

### 2.2 `frogs` Collection

| Field | Type | Default | Description |
|---|---|---|---|
| `item_number` | Number | required | Global auto-increment NFT serial, unique |
| `owner` | String | required | Wallet address, indexed |
| `cardId` | String | required | Template type ID (0–11=common, 1000–1009=uncommon, etc.) |
| `name` | String | required | Frog display name from template |
| `image` | String | required | Pixel art URL |
| `rarity` | String | required | `common\|uncommon\|rare\|epic\|legendary` |
| `level` | Number | 1 | Frog level 1–10 |
| `version` | Number | 1 | Optimistic lock counter |
| `staked` | Boolean | false | Legacy field (superseded by stakedAt) |
| `attributes.mining` | Number | 0 | Mining stat (drives LFRG rate) |
| `attributes.luck` | Number | 0 | Luck stat (improves drop rarity) |
| `attributes.dodge` | Number | 0 | Dodge stat |
| `attributes.crit` | Number | 0 | Crit stat |
| `attributes.damage` | Number | 0 | Damage stat |
| `attributes.defense` | Number | 0 | Defense stat |
| `market.*` | Object | — | Market listing state |
| `lastTransfer` | Number | 0 | Unix ms of last ownership change |
| `createdAt` | Number | required | Unix ms of mint |
| `stakedAt` | Number | — | Unix ms when stake window started |
| `stakeExpiresAt` | Number | — | Unix ms when stake window expires |
| `frogmentClaimsLog` | Array | [] | Historical stake-window claim log (legacy, deprecated) |
| `burnt` | Boolean | false | Soft-delete flag set before hard-delete |
| `print` | Number | required | Sequential mint number for this design (tracking + bragging, no cap) |

### 2.3 `eggs` Collection

| Field | Type | Default | Description |
|---|---|---|---|
| `item_number` | Number | required | Global auto-increment serial, unique |
| `owner` | String | required | Wallet address |
| `rarity` | String | required | Egg tier: `common\|uncommon\|rare\|epic\|legendary` |
| `opened` | Boolean | false | True once opened — atomic open guard |
| `mintedFrog` | ObjectId | null | Ref to frog document created on open |
| `market.*` | Object | — | Market listing state |
| `createdAt` | Number | required | Unix ms of egg creation |

### 2.4 `items` Collection

Flat inventory store. One document per `(owner, type)` pair.

| Field | Type | Description |
|---|---|---|
| `owner` | String | Wallet address |
| `type` | String | `frogment`, `common_shard`, `uncommon_shard`, `rare_shard`, `epic_shard`, `legendary_shard` |
| `amount` | Number | Current balance |
| `version` | Number | Optimistic lock |
| `market.*` | Object | Market listing state |

Composite unique index: `{ owner: 1, type: 1 }`.

### 2.5 `leaderboard` Collection

Snapshot-based, never updated in place. New snapshot documents are inserted by the leaderboard cron.

| Field | Type | Description |
|---|---|---|
| `wallet` | String | Player wallet |
| `rankByPower` | Number | Rank by collection power (1 = best) |
| `rankByMined` | Number | Rank by total LFRG mined |
| `rankByLevel` | Number | Rank by player level |
| `collectionPower` | Number | Total mining stat at snapshot |
| `totalMined` | Number | Claimed + stash at snapshot |
| `frogCount` | Number | Frogs owned at snapshot |
| `level` | Number | Player level at snapshot |
| `xp` | Number | Cumulative XP at snapshot |
| `topFrogs` | Array | Top 3 frogs by mining stat |
| `rewardsTier` | String | `gold\|silver\|bronze\|none` |
| `rewardsDistributed` | Boolean | False until cron pays out |
| `snapshotAt` | Number | Unix ms of snapshot |

### 2.6 `frog_counters` Collection (Print Counters)

Replaces the old `frog_templates` edition registry. There is **no supply cap** —
any egg can mint any design of the rolled rarity forever. This collection holds
one tiny document per `cardId` whose `minted` field is atomically incremented on
every mint (via `reservePrint()`, a race-safe `findOneAndUpdate` `$inc` upsert).
The returned value is the frog's sequential `print` number. Summing `minted`
across all counters yields the cumulative mint total that drives the halving
schedule (§15).

| Field | Description |
|---|---|
| `cardId` | Matches cardId in the frogs collection (unique) |
| `minted` | Atomically incremented cumulative mint counter (monotonic, never decremented on burn) |

### 2.7 `processed_transactions` Collection

Idempotency guard for Solana transactions — the permanent **exactly-once "finished/granted" ledger**. The settlement services insert the signature here **before** any grant, so re-delivery of the same deposit is a no-op.

| Field | Description |
|---|---|
| `txSig` | Solana transaction signature (unique) |
| `wallet` | Player wallet |
| `type` | Event type (e.g. `egg_purchase`) |
| `processedAt` | Unix ms |

### 2.7a `transactions` Collection (durable inbound queue)

Durable **inbound work queue** for the on-chain watcher runtime (`server/luckfrog-smart-contract-test`), the LuckyFrog analogue of TerraCore's `transactions` collection. The watcher records every detected $LFRG deposit here BEFORE settlement; the ingest consumer drains it and routes each row to its flow. Rows are **deleted once finished** — the permanent record lives in `processed_transactions`. This decouples chain-detection from settlement so a crash between the two never loses a deposit.

| Field | Description |
|---|---|
| `signature` | On-chain tx signature (unique — idempotency key) |
| `sender` | Wallet that sent the $LFRG (on-chain authority) |
| `tokenAmount` | Human-readable $LFRG amount deposited |
| `rawAmount` | Raw on-chain units (string, bigint-safe) |
| `memo` | Routing-only SPL-Memo payload (never trusted for buyer/amount) |
| `blockTime` | Chain block time (unix s) — drains oldest-first |
| `status` | `pending` / `failed` / `dead` |
| `retryCount` | Failed processing attempts (dead-lettered after 8) |

### 2.8 `settlement_logs` Collection

Audit trail for treasury → leaderboard settlement cron runs.

---

## 3. Player Registration & Auth

### Registration Flow

```
POST /api/auth/register
  Body: { wallet, username?, referrer? }

1. Verify wallet signature (Phantom sign message)
2. Check wallet holds >= MIN_HOLD_LFRG $LFRG on-chain
3. Check username uniqueness (if provided)
4. Insert player document:
   - registrationTime: Date.now()
   - All stats default to 0
   - stashSize: 10,000 (UI badge threshold)
5. Return JWT (7d TTL)
```

### Login Flow

```
POST /api/auth/login
  Body: { wallet }

1. Verify wallet signature
2. Verify MIN_HOLD_LFRG balance gate
3. Lookup or upsert player
4. Return JWT stored as httpOnly cookie `lfrg_token`
```

### Auth Guards

| Endpoint | Check |
|---|---|
| All game APIs | Valid JWT (verified with `verifyToken`) |
| Register/login | On-chain LFRG balance >= `MIN_HOLD_LFRG` |
| `/api/auth/min-hold` | Returns current threshold |

---

## 4. Frog NFT System

### 4.1 Card Catalog (15 Cards / 10 Distinct Designs)

| Rarity | CardId Range | Count | Notes |
|---|---|---|---|
| Common | 0–4 | 5 | 5 base artworks |
| Uncommon | 1000–1004 | 5 | Reuse the 5 Common artworks (recolored tier) |
| Rare | 2000–2001 | 2 | 2 designs |
| Epic | 3000–3001 | 2 | 2 designs |
| Legendary | 4000 | 1 | 1 design |

Total mintable card types: **15** (Common + Uncommon share art, so **10 distinct designs**).
There is **no supply cap** — any egg can mint any card of the rolled rarity forever.
The "Collector" completion set is all **15** cardIds (see §17).

### 4.2 Frog Stat Rolling — `generateFrogStatsSeeded()`

Source: `lib/modules/frogs/logic.ts`

**Seed:** `"${cardId}-${seed}"` where `seed` is a random integer drawn from the egg-open RNG.

**Step 1 — Resolve R (bonus stat count):**

| Rarity | Total Stats | R (bonus slots) |
|---|---|---|
| Common | 2 | 1 (guaranteed) |
| Uncommon | 2–3 | 1 or 2 (50/50) |
| Rare | 3–4 | 2 or 3 (50/50) |
| Epic | 4–5 | 3 or 4 (50/50) |
| Legendary | 6 | 5 (all slots) |

Mining is always rolled. R additional stats are chosen from `[luck, dodge, crit, damage, defense]` via random pool depletion.

**Step 2 — Value Range (rarity-ordered, no tier overlap):**

| Rarity | mR | Roll range | Mining output |
|---|---|---|---|
| Common | 1 | [0.5, 1.0] | [1.00, 2.00] |
| Uncommon | 2 | [1.0, 2.0] | [2.00, 4.00] |
| Rare | 3 | [1.5, 3.0] | [3.00, 6.00] |
| Epic | 4 | [2.0, 4.0] | [4.00, 8.00] |
| Legendary | 6 | [3.0, 6.0] | [6.00, 12.00] |

Formula for each roll: `rng() × (0.5 × mR) + 0.5 × mR`

**Step 3 — Apply stat multiplier:**

Each raw roll is multiplied by `STAT_ROLL_MULTIPLIERS[stat]` (defined in `shared/data/frogs.ts`). For mining the multiplier currently produces the values in the table above.

**Step 4 — Round:** Each stat value is `Math.round(value × 1000) / 1000` (3 decimal places).

### 4.3 Rarity Roll — `rollRarity()`

```typescript
function rollRarity(weights: Partial<Record<FrogRarity, number>>, rng) {
  total = sum(weights)
  roll = rng() * total
  for each [rarity, weight]:
    roll -= weight
    if roll <= 0: return rarity
}
```

Weights are tier-specific and come from the egg config (see §5.2).

### 4.4 Wallet Cap

`FROG_WALLET_CAP = 1,000` frogs per wallet. Enforced atomically before any mint.

### 4.5 Print Tracking (No Supply Cap)

Each frog carries a `print` — the sequential mint number for its design. There is
no supply cap, so `print` is purely a tracking/bragging value (display: `"Print #${print}"`).  
`reservePrint(cardId)` atomically increments the `minted` counter on the design's
`frog_counters` document and returns the resulting print number. This is a
`findOneAndUpdate` with `$inc` + `upsert` — race-condition safe and works on
MongoDB Atlas M0 (no transaction required).

---

## 5. Egg System

### 5.1 Egg Tiers

| Tier | Purchase Cost ($LFRG) | Drop Only |
|---|---|---|
| Common | 2,500 | No |
| Uncommon | 5,000 | No |
| Rare | 10,000 | No |
| Epic | — | Yes |
| Legendary | — | Yes |

Max per transaction: **25 eggs**.  
Quick-buy chips: 1, 5, 10, 25.

### 5.2 Rarity Weights per Egg Tier

**Common Egg:**
```
common: 90, uncommon: 9, rare: 0.75, epic: 0.20, legendary: 0.05
```

**Uncommon Egg:**
```
uncommon: 95, rare: 4, epic: 0.9, legendary: 0.1
```

**Rare Egg:**
```
rare: 95, epic: 4, legendary: 1
```

**Epic Egg:**
```
epic: 98, legendary: 2
```

**Legendary Egg:**
```
legendary: 100
```

### 5.3 Egg Open Flow — `open-egg` Event

Full source: `lib/events/open-egg/action.ts`

```
1. Player lookup — must exist
2. Egg lookup by item_number + owner — must exist and not yet opened
3. Wallet cap check — must be < 1,000 frogs
4. Resolve tier config from EGG_TIERS (static)
5. Seed RNG: seedrandom(`${wallet}-${eggItemNumber}-${Date.now()}`)
6. rollRarity(tierConfig.rarity_weights, rng) → rolledRarity
7. resolveTemplate(rolledRarity, rng):
   a. Start at rolledRarity in RARITY_FALLBACK_ORDER
   b. Load templates for that rarity (JSON loader → FROG_TEMPLATES fallback)
   c. If none: step DOWN toward common (defensive only — every rarity has templates)
   d. pickRandom(templates, rng) → chosen template
   e. If all rarities exhausted → "no-templates-available"
8. claimAndMarkEggOpened(eggItemNumber, wallet)
   — atomic: only succeeds once per egg
   — on mint failure, reopenEgg() rolls the egg back to the player
9. mintOneFrog():
   a. reservePrint(cardId) → print number (atomic $inc + upsert)
   b. statSeed = floor(rng() * 1,000,000)
   c. generateFrogStatsSeeded(cardId, statSeed, rarity)
   d. frogmentYield = computeFrogmentYield(attributes) — stored once at mint
   e. insertFrog(...)
10. stampMintedFrog(eggItemNumber, wallet, frogObjectId)
11. recompute-player(wallet) → flush stash + new mine rate + stats
12. checkAndMarkCollectionComplete(wallet) — idempotent
13. Return { status: "ok", frog: MintedFrog }
```

**Fallback on mint failure:** If step 9 throws, the egg is re-opened via `reopenEgg()` so the player does not lose it.

**RARITY_FALLBACK_ORDER (descending → ascending):**
```
legendary → epic → rare → uncommon → common
```
If "rare" is rolled but sold out, system tries uncommon, then common.

### 5.4 Egg Purchase Flow

```
POST /api/eggs/purchase
  → buildTransaction (unsigned Solana SPL transfer)
  → Client signs with Phantom
  → POST /api/eggs/confirm (verifies on-chain tx, grants egg via grantEgg())
  → POST /api/eggs/broadcast (optional: client-side broadcast helper)
```

100% of purchase revenue → `MARKET_ADDRESS`. Daily settlement cron distributes to treasury + leaderboard wallets.

---

## 6. Mining & LFRG Accrual

### 6.1 Mine Rate Formula — `computeMineRate()`

Source: `shared/mining/logic.ts`

```
effectiveMining = totalMining <= 333
  ? totalMining
  : 333 + (totalMining - 333) × 0.5    // 50% efficiency above softcap

baseRate = sqrt(effectiveMining) × MINE_RATE_SCALAR / halvingDenominator

minerate = baseRate × computeDecayMultiplier(lastregen)
```

Constants:
- `MINING_SOFTCAP = 333`
- `SOFTCAP_EFFICIENCY = 0.5`
- `MINE_RATE_SCALAR = 150`
- `halvingDenominator` = phase-dependent (see §15)

### 6.2 Decay Multiplier — `computeDecayMultiplier()`

```
elapsed = Date.now() - lastregen
gracePeriod = 14 × 24 × 3600 × 1000 ms

if elapsed <= gracePeriod:
  multiplier = 1.0
else:
  weeksOverGrace = (elapsed - gracePeriod) / (7 × 24 × 3600 × 1000)
  decay = 1.0 - 0.1 × weeksOverGrace
  multiplier = max(decay, 0.25)
```

| Idle duration | Multiplier |
|---|---|
| 0–14 days | 1.00 (no penalty) |
| 14 + 1 week | 0.90 |
| 14 + 2 weeks | 0.80 |
| 14 + 7.5 weeks | 0.25 (floor) |

`lastregen` is reset on: egg open, frog destroyed, frog leveled up.

### 6.3 Live Stash Accrual — `computeAccruedLFRG()`

```
secondsSinceUpdate = max((Date.now() - unclaimedUpdatedAt) / 1000, 0)
liveStash = player.lfrg + player.minerate × secondsSinceUpdate
```

Called on every player data fetch — no background tick required.  
The stash is **unbounded** — `stashSize` is purely a UI badge threshold (shows "stash full" warning) and never silently discards earned LFRG.

### 6.4 Recompute-Player — The Authoritative Flush

Source: `lib/events/recompute-player/action.ts`

Called after every frog event (open egg, destroy, level up).

```
1. flushedLfrg = computeAccruedLFRG(player)   // snapshot at OLD rate
2. frogs = findFrogsByOwner(wallet)
3. computeCollectionPower(frogs) → { mining, luck, dodge, crit, damage, defense }
4. totalMinted = getCachedTotalFrogsMinted()
5. walletLfrgBalance = getLfrgBalance(wallet)  // on-chain Solana RPC
6. halvingDenominator = getHalvingDenominator(totalMinted)
7. newMinerate = computeMineRate(totalMining, player.lastregen, halvingDenominator)
8. charmCrit = computeCritFromCharm(player.charm)
9. holdBonus = computeHoldBonus(walletLfrgBalance)
10. cappedFrogCrit = min(frogCrit, MAX_FROG_CRIT=50)
11. newStats = {
      mining: totalMining,
      luck: totalLuck + holdBonus.luck,
      dodge: frogDodge + holdBonus.dodge,
      crit: cappedFrogCrit + charmCrit,
      damage: totalDamage,
      defense: totalDefense
    }
12. updatePlayerState:
    lfrg = flushedLfrg
    unclaimedUpdatedAt = Date.now()
    minerate = newMinerate
    stats = newStats
```

---

## 7. Claim Events

### 7.1 Claim LFRG — `claim-lfrg` Event

Source: `lib/events/claim-lfrg/action.ts`

**Cooldown:** `CLAIM_COOLDOWN_MS = 4 × 60 × 60 × 1000` ms (4 hours).

```
1. Lookup player
2. Cooldown check: Date.now() - player.lastclaim < 4h → reject
3. liveStash = computeAccruedLFRG(player)
4. If liveStash <= 0 → "empty-stash"
5. claimAmount = floor(liveStash)
6. sendLfrgToPlayer(wallet, claimAmount)
   — on-chain SPL transfer: treasury → player wallet
   — On failure: restore lfrg + unclaimedUpdatedAt, return "payout-error"
7. On success:
   updatePlayerState: lfrg=0, lastclaim=now, lastregen=now, unclaimedUpdatedAt=now
8. Frogment payout:
   frogs = findFrogsByOwner(wallet)
   frogmentsEarned = frogmentYieldPerClaim(frogs)  // see §11.2
   if frogmentsEarned > 0: upsertItem(wallet, "frogment", frogmentsEarned)
9. Drop event:
   walletLfrgBalance = getLfrgBalance(wallet)
   holdBonus = computeHoldBonus(walletLfrgBalance)
   totalLuck = player.stats.luck + holdBonus.luck
   totalCrit = player.stats.crit
   seed = "${wallet}:${now}"
   drop = rollDrop(totalLuck, totalCrit, player.charm, seed)
   applyDrop(wallet, drop)  // upsertItem shard OR grantEgg
10. XP draws:
    { draws, totalXp: xpGained } = rollAllDraws("${wallet}:xp:${now}", totalLuck)
    newXp = player.xp + xpGained
    newLevel = getLevelFromXp(newXp)
    updatePlayerState: xp=newXp, level=newLevel
11. Return { claimed, txSig, drop, frogmentsEarned, xpGained, xp, level, leveledUp }
```

**Key design principle:** State is reset ONLY after a confirmed on-chain transfer. The old pattern (reset-before-transfer) wiped the stash on payout errors with no recovery path.

### 7.2 Claim As Charm — `claim-as-charm` Event

Source: `lib/events/claim-as-charm/action.ts`

Burns the accrued stash into Charm. No on-chain transfer.

```
1. Cooldown check (same 4h as claim-lfrg)
2. liveStash = computeAccruedLFRG(player)
3. burnAmount = floor(liveStash)
4. newCharm = min(prevCharm + burnAmount, MAX_CHARM=1,000,000)
   charmAdded = newCharm - prevCharm
5. stashSizeIncrease = burnAmount × STASH_GROWTH_RATE (0.1)
   newStashSize = player.stashSize + stashSizeIncrease
6. newCrit = computeCritFromCharm(newCharm)
7. Atomic write:
   lfrg=0, lastclaim=now, unclaimedUpdatedAt=now,
   charm=newCharm, stashSize=newStashSize, stats.crit=newCrit
8. Drop event (same as claim-lfrg §7.1 step 9)
9. XP draws (same as claim-lfrg §7.1 step 10)
10. Return { charmAdded, newCharm, newCrit, stashSizeIncrease, newStashSize, drop, xpGained, ... }
```

Note: Charm burns grow `stashSize` by 10% of the burned amount. This provides a long-term incentive for charm burning beyond crit improvement.

---

## 8. Drop System (Shards & Eggs)

Source: `shared/drops/logic.ts`, `shared/drops/frogment-rng.ts`

Every claim (both LFRG and Charm) fires a drop event, separately from Frogment payouts.

### 8.1 Egg/Shard Split by Charm Range

| Charm Amount | Egg Drop % | Shard Drop % |
|---|---|---|
| 0–9,999 | 10% | 90% |
| 10,000–99,999 | 15% | 85% |
| 100,000–249,999 | 25% | 75% |
| 250,000–499,999 | 40% | 60% |
| 500,000–1,000,000 | 50% | 50% |

### 8.2 Egg Drop Tier — `computeEggDrop()`

Determined by `totalLuck`:

```typescript
if (totalLuck >= 90 || roll < 2)  return "legendary"
if (totalLuck >= 75 || roll < 8)  return "epic"
if (totalLuck >= 50 || roll < 20) return "rare"
if (totalLuck >= 20 || roll < 45) return "uncommon"
return "common"
```

`roll = rng() × 100` where seed = `"${wallet}:${now}:egg-tier"`.

On a crit: egg amount becomes 2 instead of 1.

### 8.3 Shard Drop — `computeShardDrop()`

**Base rarity weights:**

| Rarity | Base Weight |
|---|---|
| common | 70 |
| uncommon | 20 |
| rare | 8 |
| epic | 1.5 |
| legendary | 0.5 |

**Luck adjustment:** `luckFactor = min(totalLuck, 100) / 100`
- Common weight × `(1 - luckFactor × 0.6)`
- Other tiers × `(1 + luckFactor × (rarityIndex × 0.4))`

**Amount formula (per draw):**

| Rarity | Min | Max |
|---|---|---|
| common | 0.01 | 1.49 |
| uncommon | 0.01 | 1.01 |
| rare | 0.01 | 0.60 |
| epic | 0.01 | 0.37 |
| legendary | 0.01 | 0.53 |

`amount = min + rng2() × (max - min)`, rounded to 2 decimal places.  
On a crit: `amount × 2`.

### 8.4 Crit Roll

```
critRng = seedrandom("${seed}:crit")
isCrit = critRng() × 100 < totalCrit
```

`totalCrit = min(frogCrit, 50) + computeCritFromCharm(charm)` — max ~62.7%.

### 8.5 XP Draw System — `rollAllDraws()`

Runs on every claim, independently of the chest drop.

**Draw count formula — `computeBaseDraws()`:**
```
rng = seedrandom("${seed}:base-draws")
baseDraws = floor(rng() × 5) + 1          // 1–5 inclusive
luckDraws = floor(log2(luck + 1))          // logarithmic luck scaling
totalDraws = baseDraws + luckDraws
```

**Draw count by tier (200 frogs, full luck):**

| Frog Tier | Luck | log2(luck+1) | Draw range |
|---|---|---|---|
| Common | ~19 | +4 | [5–9] |
| Uncommon | ~68 | +6 | [7–11] |
| Rare | ~161 | +7 | [8–12] |
| Epic | ~278 | +8 | [9–13] |
| Legendary | ~459 | +8 | [9–13] |

**XP per draw rarity:**

| Rarity | XP |
|---|---|
| common | 25 |
| uncommon | 50 |
| rare | 100 |
| epic | 200 |
| legendary | 350 |

Total claim XP = sum of all draw XP values.

### 8.6 Shard Combine — `combine-shards` Event

```
100 shards of any rarity → 1 egg of the same rarity
```

Cost: `SHARD_COMBINE_COST = 100` (same for all rarities).  
Epic/Legendary eggs produced this way follow the same rarity rules as drop eggs.

---

## 9. Charm System

> **⚠️ Historical (superseded after Phase C1).** This section documents the pre-redesign Charm behavior, including the logarithmic `computeCritFromCharm()` and Charm-driven claim drops / LFRG rewards. Under the new mechanics, Charm is narrowed to a **crit boost only** (decoupled from claim drops and LFRG rewards) and the logarithmic formula is replaced by a stepped `lookupSteppedBonus(CHARM_CRIT_TABLE, charm)`. See `docs/new_mechanics` for the authoritative ruling.

Source: `claim-as-charm/action.ts`, `shared/drops/logic.ts`

### 9.1 Charm Cap

`MAX_CHARM = 1,000,000`. Burns beyond this cap are discarded (no refund).

### 9.2 Crit from Charm — `computeCritFromCharm()`

Logarithmic formula mirroring TerraCore Critical Hit Stats table:

```
TERRACORE_MAX_CHARM = 5,000,000
MAX_CRIT_BONUS = 14.027%

clamped = min(max(charm, 0), 1,000,000)
fraction = ln(1 + clamped) / ln(1 + 5,000,000)
critBonus = min(fraction × 14.027, 14.027)
```

At max LuckyFrog charm (1,000,000): **+12.696% crit**.

### 9.3 Stash Size Growth

```
stashSizeIncrease = burnAmount × 0.1
newStashSize = player.stashSize + stashSizeIncrease
```

This has no upper cap. It purely controls the UI "stash full" threshold badge.

### 9.4 Frog Crit Cap

Frog-derived crit is capped at `MAX_FROG_CRIT = 50%` before charm crit is added.  
Without this cap, Rare/Epic/Legend holders (raw frogCrit ~161%) would always crit, making charm burns meaningless.  
Max total crit ≈ `50 + 12.696 = 62.7%`.

---

## 10. Staking System

Source: `lib/events/stake-frog/action.ts`, `lib/events/unstake-frog/action.ts`

### 10.1 Stake Parameters

| Constant | Value |
|---|---|
| `STAKE_DAYS` | 7 days |
| `STAKE_DURATION_MS` | 7 × 24 × 60 × 60 × 1000 ms |
| `UNSTAKE_LOCK_MS` | 24 × 60 × 60 × 1000 ms (24h min lock) |

### 10.2 Stake Flow

```
POST /api/frogs/stake
  Body: { frogItemNumbers: number[] }

For each frogItemNumber:
  1. findFrogByInstanceId(itemNumber, wallet)
  2. Guard: stakedAt must be null/undefined
  3. Write: stakedAt=now, stakeExpiresAt=now+STAKE_DURATION_MS, frogmentClaimsLog=[]
  4. $inc: version
  Returns: { stakeExpiresAt, dailyFrogments }

dailyFrogments = ceil(frogmentYield(frog.attributes) / STAKE_DAYS)
```

Note: Staking no longer gates frogment income. Since the frogment redesign, **every frog earns frogments on every main LFRG/Charm claim** regardless of staking status. Staking only controls the `frogmentClaimsLog` legacy field.

### 10.3 Unstake Flow

```
POST /api/frogs/unstake

Guard: Date.now() - stakedAt >= UNSTAKE_LOCK_MS (24h minimum)
Write: stakedAt=undefined, stakeExpiresAt=undefined
$inc: version
```

### 10.4 Destroy Guard

Staked frogs cannot be destroyed. `destroy-frog` checks `frog.stakedAt !== null` and returns `"frog-is-staked"`.

---

## 11. Frogment Economy

Frogments are the **universal leveling currency** — separate from Shards.

- **Earned by:** Destroying frogs, and as a per-claim bonus from all owned frogs
- **Spent on:** Leveling frogs (see §13)

### 11.1 Destruction Yield — `frogmentYield()`

Source: `lib/modules/frogs/logic.ts`

```
yield = damage/2 + defense/2 + mining×5 + dodge×5 + crit×5 + luck×10
```

This mirrors TerraCore's `salvageValue()` formula exactly (with "mining" replacing "engineering"). A better-rolled frog yields more Frogments when destroyed, but also costs more to level.

**Example yields:**

| Frog Tier | Typical attribute sum | Approx. Frogment yield |
|---|---|---|
| Common L1 | mining~1.5 | ~7–20 |
| Uncommon L1 | mining~3 | ~20–50 |
| Rare L1 | mining~4.5 | ~40–100 |
| Epic L1 | mining~6 | ~80–180 |
| Legendary L1 | mining~9 | ~150–350 |

### 11.2 Per-Claim Frogment Income — `frogmentYieldPerClaim()`

```
FROGMENT_CLAIM_WINDOWS = 42    // 7 days × 24h ÷ 4h

perFrog = frogmentYield(frog.attributes) / 42
total = sum(perFrog across all wallet frogs)
frogmentsEarned = floor(total)
```

Every frog in the wallet contributes on every 4-hour claim. Small fractions accumulate across frogs before being floored once (prevents rounding to zero for individual low-stat frogs).

### 11.3 Destroy Flow — `destroy-frog` Event

```
1. Verify player exists
2. findFrogByInstanceId(itemNumber, wallet)
3. Guard: frog must NOT be staked
4. frogments = frogmentYield(frog.attributes)
5. upsertItem(wallet, "frogment", frogments)
6. markFrogBurnt(itemNumber, wallet)   // soft-delete flag
7. FrogModel.deleteOne(...)            // hard delete
8. updatePlayerState: lastregen=now   // reset decay
9. recompute-player(wallet)
```

---

## 12. Leveling System (Player XP)

Source: `shared/data/frogment-xp.ts`, `lib/modules/players/level-logic.ts`

### 12.1 XP Sources

| Event | XP Gain |
|---|---|
| Each shard draw (common) | 25 XP |
| Each shard draw (uncommon) | 50 XP |
| Each shard draw (rare) | 100 XP |
| Each shard draw (epic) | 200 XP |
| Each shard draw (legendary) | 350 XP |

XP is awarded per **individual draw**, not per claim. With 5–14 draws per claim and luck-weighted rarity, typical per-claim XP ranges from ~125 XP (all common) to ~4,900 XP (all legendary).

### 12.2 Level Thresholds (1–100)

Binary search via `getLevelFromXp()`. Key milestones:

| Level | Cumulative XP | Estimated time (typical player) |
|---|---|---|
| 1 | 0 | — |
| 5 | 2,400 | ~1 week |
| 10 | 14,600 | ~1 month |
| 25 | 140,700 | ~3–4 months |
| 50 | 2,331,500 | ~1 year |
| 100 | 95,175,000 | Extreme grind |

### 12.3 Level-Up Detection

```
oldLevel = getLevelFromXp(player.xp)
newLevel = getLevelFromXp(player.xp + xpGained)
leveledUp = (newLevel > oldLevel) ? newLevel : undefined
```

### 12.4 XP Progress Display

```
getXpProgress(totalXp) → {
  level,
  currentXp,    // XP floor of current level
  nextLevelXp,  // XP floor of next level
  xpToNextLevel,
  percentage    // 0–100
}
```

---

## 13. Frog Leveling

Source: `lib/events/level-up-frog/action.ts`, `shared/data/levels.ts`

### 13.1 Level Cap

`MAX_LEVEL = 10`. Frogs cannot be leveled beyond this.

### 13.2 Level Multipliers

Applied to frog stats in `computeCollectionPower()`:

| Level | Multiplier |
|---|---|
| 1 | 1.00× |
| 2 | 1.15× |
| 3 | 1.35× |
| 4 | 1.60× |
| 5 | 1.95× |
| 6 | 2.40× |
| 7 | 3.00× |
| 8 | 3.80× |
| 9 | 4.90× |
| 10 | 6.50× |

A Level 10 frog contributes 6.5× the mining power of the same frog at Level 1.

### 13.3 Frogment Cost to Level — `frogmentCostToLevel()`

```
value = damage/2 + defense/2 + mining×5 + dodge×5 + crit×5 + luck×10
cost = max(1, ceil(value × 0.0498 × currentLevel))
```

Higher-value frogs cost more to level but also yield more Frogments when destroyed — self-balancing economy.

**Example costs (mining=4.5 rare frog, dodge=3, luck=2):**

| Level transition | Approx. cost |
|---|---|
| 1 → 2 | ~5 Frogments |
| 5 → 6 | ~25 Frogments |
| 9 → 10 | ~45 Frogments |

### 13.4 Level-Up Flow

```
1. Verify player + frog ownership
2. Guard: frog.level < MAX_LEVEL (10)
3. cost = frogmentCostToLevel(frog.attributes, frog.level)
4. inventoryItem = findItem(wallet, "frogment")
5. if available < cost → "insufficient-fragments"
6. deductItem(wallet, "frogment", cost, deleteOnZero=true)
7. FrogModel.updateOne: level=min(level+1, 10), $inc version
8. updatePlayerState: lastregen=now
9. recompute-player(wallet)
```

---

## 14. Collection Power & Stats

Source: `lib/modules/frogs/logic.ts`, `lib/events/recompute-player/action.ts`

### 14.1 `computeCollectionPower()`

```
for each frog in wallet:
  mult = getLevelMultiplier(frog.level)
  mining  += frog.attributes.mining  × mult
  luck    += frog.attributes.luck    × mult
  dodge   += frog.attributes.dodge   × mult
  crit    += frog.attributes.crit    × mult
  damage  += frog.attributes.damage  × mult
  defense += frog.attributes.defense × mult
```

All frogs always contribute — there is no equip/unequip concept. Staking does not affect collection power.

### 14.2 Final Stats Composition

| Stat | Formula |
|---|---|
| `mining` | sum(frog.mining × levelMult) |
| `luck` | sum(frog.luck × levelMult) + holdBonus.luck |
| `dodge` | sum(frog.dodge × levelMult) + holdBonus.dodge |
| `crit` | min(sum(frog.crit × levelMult), 50) + computeCritFromCharm(charm) |
| `damage` | sum(frog.damage × levelMult) |
| `defense` | sum(frog.defense × levelMult) |

### 14.3 Mining Softcap

```
effectiveMining = totalMining <= 333
  ? totalMining
  : 333 + (totalMining - 333) × 0.5
```

Above 333 mining, each additional point only contributes 0.5. This prevents whales from completely dominating the mine rate.

---

## 15. LFRG Emission Halving Schedule

Source: `lib/modules/game-stats/halving.ts`

Halving is driven automatically by lifetime `totalLfrgEmitted`. The documented
100M LFRG allocation is divided into five 20M tranches. Every newly emitted game
reward is recorded through `lib/modules/game-stats`; transfers of existing LFRG
do not count as emission.

| Stage | Lifetime LFRG emitted | Emission multiplier |
|---|---:|---:|
| 0 — Genesis | 0–under 20M | 1.0 |
| 1 — First Halving | 20M–under 40M | 0.5 |
| 2 — Second Halving | 40M–under 60M | 0.25 |
| 3 — Third Halving | 60M–under 80M | 0.125 |
| 4 — Fourth Halving | 80M onward | 0.0625 |

The lifetime counter, derived stage, and multiplier are updated atomically with
each emission. No admin action, cron job, asset count, or treasury-balance check
controls progression. Stage 4 remains terminal above 100M unless a future policy
explicitly defines another multiplier.

---

## 16. Hold Bonus System

> **⚠️ Historical (superseded after Phase C2).** The Hold Bonus (wallet-balance → +luck/+dodge, with on-chain balance polling on recompute) has been **removed and replaced by the Stash system**: `1 LFRG burned → stash += 1 → boosts luck + dodge` via `STASH_LUCK_TABLE` / `STASH_DODGE_TABLE` (the former `HOLD_LUCK_TABLE` / `HOLD_DODGE_TABLE` rows, renamed in place). There is no more on-chain balance polling on recompute. See `docs/new_mechanics` for the authoritative Stash ruling.

Source: `shared/drops/logic.ts`, `shared/data/stats.ts`

Rewards players who hold $LFRG in their Solana wallet (not just mine it).

**Activation threshold:** `HOLD_BONUS_THRESHOLD = 500 $LFRG`

**Maximum hold that counts:** `MAX_HOLD_LFRG = 1,000,000 $LFRG`

### 16.1 Hold Luck Table (stepped)

| Min $LFRG held | Luck bonus |
|---|---|
| 500 | +5.078% |
| 2,000 | +5.469% |
| 5,000 | +6.641% |
| 10,000 | +7.100% |
| 25,000 | +7.466% |
| 50,000 | +8.002% |
| 100,000 | +8.041% |
| 250,000 | +8.155% |
| 500,000 | +8.346% |
| 1,000,000 | +8.727% |

### 16.2 Hold Dodge Table (stepped)

| Min $LFRG held | Dodge bonus |
|---|---|
| 500 | +8.997% |
| 1,000 | +9.000% |
| 2,000 | +10.266% |
| 5,000 | +11.438% |
| 10,000 | +12.087% |
| 25,000 | +12.453% |
| 50,000 | +13.063% |
| 100,000 | +14.284% |
| 250,000 | +15.092% |
| 500,000 | +15.283% |
| 1,000,000 | +15.664% |

Hold bonuses are computed from the **on-chain wallet balance** (via `getLfrgBalance()` Solana RPC), not the in-game stash. They are applied in `recompute-player` and on the claim drop path.

---

## 17. Collection Completion

Source: `lib/modules/players/collection-completion.ts`

A player becomes a **Collector** when they own at least one frog of each of the **15 unique cardIds** (5 common + 5 uncommon + 2 rare + 2 epic + 1 legendary). Common and Uncommon reuse the same 5 artworks, but each is a distinct mintable card.

Checked after every egg open via `checkAndMarkCollectionComplete(wallet)`.

**Idempotent:** Uses `{ collectionCompleted: { $ne: true } }` in the update filter — the timestamp is written exactly once.

**Progress:** `computeUniqueTypesOwned(frogCardIds)` returns how many of the 15 types a player currently owns (used by the profile API).

Once set to `true`, the flag is **never reverted** even if the player later destroys frogs.

---

## 18. Leaderboard System

Source: `lib/modules/leaderboard/`, `lib/events/update-leaderboard/action.ts`

### 18.1 Snapshot Model

The leaderboard is snapshot-based — no in-place updates. Each cron run inserts new documents.

### 18.2 Ranking Dimensions

| Rank | Sorted by |
|---|---|
| `rankByPower` | collection power (mining stat total) |
| `rankByMined` | total LFRG mined (claimed + current stash) |
| `rankByLevel` | player level |

### 18.3 Rewards Tiers

| Tier | Reward |
|---|---|
| gold | Top percentile |
| silver | Mid percentile |
| bronze | Lower percentile |
| none | Outside reward range |

`rewardsDistributed` is set to true after the settlement cron pays out.

### 18.4 Leaderboard Logic

Source: `lib/modules/leaderboard/logic.ts`

```
computeLeaderboardEntry(wallet, player, frogs):
  collectionPower = computeCollectionPower(frogs).mining
  totalMined = player.lfrg (snapshot)
  topFrogs = top 3 frogs sorted by attributes.mining desc
  rewardsTier = assignTier(rank)
```

---

## 19. Market System

Source: `app/api/market/route.ts`, `IFrog.market`, `IEgg.market`, `IItem.market`

All three entity types (frogs, eggs, items) carry a `market` sub-document:

```typescript
{
  listed: boolean
  price: number | string     // string for BigInt-safe values
  seller: string | null
  created: number            // unix ms
  expires: number            // unix ms (listing TTL)
  sold: number               // unix ms of sale (0 if unsold)
  amount?: number            // for items only
}
```

The market route handles listing, de-listing, and purchasing. Settlement is via Solana SPL transfers.

---

## 20. Solana Payment Flow

Source: `lib/solana/payments.ts`, `lib/solana/payout.ts`

### 20.1 Egg Purchase

```
buildTransaction():
  1. Fetch $LFRG on-chain price → compute LFRG amount
  2. Build SPL transfer instruction: player → MARKET_ADDRESS
  3. Return unsigned base64 transaction

Client signs with Phantom → broadcasts → POSTs /api/eggs/confirm

/api/eggs/confirm:
  1. Verify tx signature on-chain (confirms payment)
  2. Check processed_transactions (idempotency)
  3. grantEgg(wallet, eggId, qty)
  4. Record in processed_transactions
```

### 20.2 LFRG Claim Payout

```
sendLfrgToPlayer(wallet, amount):
  1. Build SPL transfer: TREASURY_WALLET → player
  2. Sign with TREASURY_PRIVATE_KEY
  3. Broadcast to Solana
  4. Return txSig
```

State is only reset (step 7 of claim-lfrg) **after** this returns successfully.

---

## 21. RNG Map

All random decisions in Lucky Frog Mine use `seedrandom` for deterministic, auditable randomness.

| Function | Seed | Purpose |
|---|---|---|
| `rollRarity()` in open-egg | `${wallet}-${eggItemNumber}-${Date.now()}` | Egg rarity roll |
| `resolveTemplate()` | Same as above | Template selection for the rolled rarity |
| `generateFrogStatsSeeded()` | `${cardId}-${statSeed}` where statSeed = floor(rng×1M) | All 6 stat values |
| `rollDrop()` main | `${wallet}:${now}:main` | Egg/shard split decision |
| `rollDrop()` crit | `${wallet}:${now}:crit` | Critical hit check |
| `computeEggDrop()` | `${wallet}:${now}:egg-tier` | Egg tier selection from luck |
| `computeShardDrop()` rarity | `${wallet}:${now}:shard-rarity` | Shard rarity selection |
| `computeShardDrop()` amount | `${wallet}:${now}:shard-amount` | Shard amount within range |
| `computeBaseDraws()` | `${wallet}:xp:${now}:base-draws` | Number of XP draws |
| `rollFrogmentDraw()` | `${wallet}:xp:${now}:draw-${i}` | Per-draw rarity + amount + XP |

---

## 22. Constants Reference

### Game Constants (compile-time, never in DB)

| Constant | Value | Description |
|---|---|---|
| `MINING_SOFTCAP` | 333 | Above this, 50% efficiency |
| `SOFTCAP_EFFICIENCY` | 0.5 | Efficiency rate above softcap |
| `MINE_RATE_SCALAR` | 150 | Multiplier in sqrt formula |
| `DECAY_GRACE_DAYS` | 14 | Days before decay starts |
| `DECAY_RATE_PER_WEEK` | 0.1 | 10% per week after grace |
| `DECAY_FLOOR` | 0.25 | Minimum decay multiplier |
| `MAX_CHARM` | 1,000,000 | Charm cap |
| `STASH_GROWTH_RATE` | 0.1 | StashSize += burnAmount × 0.1 |
| `MAX_CRIT_BONUS` | 14.027% | TerraCore reference max crit |
| `MAX_FROG_CRIT` | 50% | Frog crit cap (before charm crit) |
| `HOLD_BONUS_THRESHOLD` | 500 $LFRG | Min hold to activate bonus |
| `MAX_HOLD_LFRG` | 1,000,000 $LFRG | Max that counts for hold bonus |
| `CLAIM_COOLDOWN_MS` | 14,400,000 ms | 4-hour claim cooldown |
| `STAKE_DAYS` | 7 | Days in a stake window |
| `UNSTAKE_LOCK_MS` | 86,400,000 ms | 24h minimum stake lock |
| `FROGMENT_CLAIM_WINDOWS` | 42 | 4h windows in 7 days |
| `MAX_LEVEL` (frog) | 10 | Frog max level |
| `MAX_LEVEL` (player) | 100 | Player max level |
| `FROG_WALLET_CAP` | 1,000 | Max frogs per wallet |
| `LFRG_HALVING_INTERVAL` | 20,000,000 | Lifetime emitted LFRG per halving tranche |
| `LFRG_EMISSION_ALLOCATION` | 100,000,000 | Documented lifetime emission allocation |

---

## 23. Event Flow Diagrams

### 23.1 Egg Open → Mine Rate Update

```
POST /api/eggs/open
  │
  ├── claimAndMarkEggOpened() [atomic]
  ├── reservePrint() [atomic $inc + upsert]
  ├── generateFrogStatsSeeded()
  ├── insertFrog()
  ├── stampMintedFrog()
  ├── recompute-player()
  │     ├── computeAccruedLFRG() → flush stash
  │     ├── computeCollectionPower()
  │     ├── getLfrgBalance() [on-chain RPC]
  │     ├── getHalvingDenominator()
  │     ├── computeMineRate()
  │     ├── computeCritFromCharm()
  │     ├── computeHoldBonus()
  │     └── updatePlayerState() [atomic write]
  └── checkAndMarkCollectionComplete() [idempotent]
```

### 23.2 Claim LFRG → Token Distribution

```
POST /api/claim
  │
  ├── computeAccruedLFRG() → claimAmount
  ├── sendLfrgToPlayer() [Solana SPL]
  │     Treasury → Player Wallet
  ├── updatePlayerState: lfrg=0, lastclaim=now
  ├── frogmentYieldPerClaim() → frogmentsEarned
  ├── upsertItem("frogment", frogmentsEarned)
  ├── rollDrop()
  │     ├── resolveEggChance(charm)
  │     ├── [if egg]: computeEggDrop(luck)
  │     └── [if shard]: computeShardDrop(luck)
  ├── applyDrop() → upsertItem(shard) OR grantEgg()
  ├── rollAllDraws() → XP
  └── updatePlayerState: xp, level
```

---

## 24. Proposed New Game Mechanics

The following proposals are design extensions of the current mechanics. They are intentionally grounded in the existing code and data structures to be buildable without a full rewrite.

---

### 24.1 Pond Expeditions (Active PvE Layer)

**Concept:** Players send a party of 1–5 frogs on a timed expedition to a specific pond biome. The outcome depends on the party's collective stats and the biome's challenge parameters.

**Mechanics:**

```
Party stats:
  attackPower = sum(damage × levelMult) across party
  shieldPower = sum(defense × levelMult) across party
  evasion     = sum(dodge × levelMult) across party
  fortune     = sum(luck × levelMult) across party

Biome challenge table (proposed):
  Mudflats:   requires attackPower >= 5,   duration 1h
  Swamp:      requires attackPower >= 20,  duration 3h
  DeepFen:    requires attackPower >= 60,  duration 6h
  VoidMarsh:  requires attackPower >= 150, duration 12h

Outcome formula:
  survivalRoll = rng() × (shieldPower + evasion × 2)
  if survivalRoll < biome.threat:
    result = "partial" (50% reward)
  else:
    result = "success" (full reward)

  critRoll = rng() < totalCrit / 100
  if critRoll:
    reward × 2 (all reward types)
```

**Rewards on success:**
- Base Frogments (scales with biome + party fortune)
- Shards (rarity weighted by party fortune)
- Rare biome-specific items (future: relic NFTs)

**New DB state needed:**
```typescript
// New field on IFrog:
expeditionLockedUntil?: number   // unix ms, prevents staking/destroying during expedition
expeditionId?: string            // ObjectId ref to active expedition doc

// New collection: `expeditions`
{
  wallet: string
  partyIds: number[]             // frog item_numbers
  biome: string
  startedAt: number
  completesAt: number
  claimed: boolean
}
```

**Interaction with existing systems:**
- Frogs on expedition are locked (similar to staking guard)
- Expedition rewards go through `upsertItem()` — no new inventory types needed initially
- Expedition completes passively (like mining accrual) — computed on claim, no background tick

---

### 24.2 Lily Pad Marketplace Auctions

**Concept:** Time-limited Dutch auctions for rare/epic/legendary frogs. Starting price decreases on a curve until someone buys or the auction expires.

**Mechanics:**

```
auctionPrice(t) = startPrice × (1 - decayRate) ^ elapsed_hours
  where decayRate is configurable per auction (e.g. 0.03 per hour)

Auction expires if: elapsed > maxDuration (e.g. 72h) with no purchase
```

**New DB state on market sub-doc:**
```typescript
auctionStartPrice?: number
auctionDecayRate?: number     // per-hour decay fraction
auctionMode?: boolean         // true = Dutch auction, false = fixed price
```

**Purchase flow:**
1. Compute current price from formula at time of purchase
2. Standard SPL transfer flow (same as egg purchase)
3. Ownership transfer

---

### 24.3 Ribbit Breeding (Frog Combination)

**Concept:** Combine two frogs to produce an egg with blended rarity odds. Both parent frogs are consumed.

**Rules:**
- Only non-staked, non-on-expedition frogs can breed
- Result egg rarity is probabilistic — informed by both parents
- Breeding has a cooldown (global, per wallet)

**Rarity blend formula:**

```
parentWeight(frog) = rarityIndex(frog.rarity) × getLevelMultiplier(frog.level)
  where rarityIndex: common=1, uncommon=2, rare=3, epic=4, legendary=5

blendedPower = (weight(frogA) + weight(frogB)) / 2

resultRarity probabilities:
  if blendedPower >= 4.5 → {epic:60, legendary:40}
  if blendedPower >= 3.5 → {rare:50, epic:45, legendary:5}
  if blendedPower >= 2.5 → {uncommon:60, rare:35, epic:5}
  if blendedPower >= 1.5 → {common:70, uncommon:28, rare:2}
  else                   → {common:90, uncommon:10}
```

**Frogment cost to breed:**
```
breedCost = frogmentYield(frogA) + frogmentYield(frogB) × 0.5
```

**New event:** `breed-frogs`
- Destroys both parents (yields NO Frogments — consumed by breeding)
- Grants one egg of resolved rarity
- 24h wallet breeding cooldown

---

### 24.4 Lily Glyph Enchanting (Stat Rerolling)

**Concept:** Spend a Glyph item to reroll one stat on a frog within the stat's rarity-tier range. Glyph items are rare drops from VoidMarsh expeditions (§24.1).

**Rules:**
- Only one stat rerolled per Glyph use
- Stat stays within its rarity range (cannot boost a common frog beyond common max)
- Frog level is preserved
- Non-reversible (no preview before applying)

**Glyph tiers:**
| Glyph | Drops from | Rerolls |
|---|---|---|
| Lesser Glyph | Mudflats/Swamp | 1 random non-mining stat |
| Greater Glyph | DeepFen | Player-chosen stat |
| Void Glyph | VoidMarsh | All non-mining stats |

**Formula:**
```
for each targetStat:
  newValue = rollInRange(rarity) × STAT_ROLL_MULTIPLIERS[stat]
  // Same range as generateFrogStatsSeeded but re-seeded with Date.now()
```

---

### 24.5 Harmony Pond (Guild / Alliance System)

**Concept:** Groups of up to 20 players form a Pond. Pooled stats unlock shared bonuses for all members.

**Pond bonuses (additive to individual stats):**

```
pondMiningBonus = floor(sum(member.stats.mining) / 1000) × 0.5%
pondLuckBonus   = floor(sum(member.stats.luck)   / 500)  × 0.1%
```

**New DB collection:** `ponds`
```typescript
{
  pondId: string
  name: string
  leader: string          // wallet address
  members: string[]       // wallet addresses, max 20
  createdAt: number
  pondStats: {
    totalMining: number   // recomputed on member change
    totalLuck: number
  }
}
```

**Governance:**
- Leader can invite/remove members
- Member can leave at any time (24h cooldown before joining another)
- If leader leaves, oldest member inherits leadership

---

### 24.6 Tadpole Quests (Daily Mission System)

**Concept:** Each day a player receives 3 randomly generated missions. Completing them earns bonus Shards, Frogments, or Glyph items.

**Quest generation (server-side, seeded daily):**

```
dailySeed = "${wallet}:${Math.floor(Date.now() / 86400000)}"
rng = seedrandom(dailySeed)

quests = [
  roll quest type from QUEST_POOL weighted by player.level,
  roll quest type,
  roll quest type,
]
```

**Example quest pool:**

| Quest | Requirement | Reward |
|---|---|---|
| First Leap | Claim LFRG today | 10 common shards |
| Egg Hunter | Open 1 egg | 5 uncommon shards |
| The Collector | Claim with 3+ draws of uncommon+ | 20 common shards |
| Pond Warrior | Complete any expedition | 1 Lesser Glyph |
| Tadpole Grind | Level up any frog | 30 Frogments |
| Deep Diver | Complete VoidMarsh expedition | 1 Greater Glyph |

**New DB state:**
```typescript
// New collection: `daily_quests`
{
  wallet: string
  date: string              // "YYYY-MM-DD"
  quests: Array<{
    questId: string
    completed: boolean
    completedAt?: number
    rewardClaimed: boolean
  }>
}
```

**Quest completion:** Checked as side-effect within existing event handlers (e.g. `claim-lfrg` checks "First Leap", `open-egg` checks "Egg Hunter"). No new dedicated polling loop needed.

---

### 24.7 LFRG Burn Events (Deflationary Mechanics)

**Concept:** Periodic (monthly) community events where players voluntarily burn $LFRG for exclusive cosmetic/title rewards. Burns are on-chain SPL transfers to a provably unspendable address.

**Burn tiers:**

| Burn amount | Reward |
|---|---|
| 1,000 LFRG | Event profile badge |
| 10,000 LFRG | Animated pond title |
| 100,000 LFRG | Exclusive "Void Frog" cosmetic frame |
| 500,000 LFRG | Legendary cosmetic + on-chain leaderboard crown |

**Important:** These are cosmetic-only. No game-stat advantage — preserves competitive fairness. The burn is permanent and tracked on-chain.

---

### 24.8 Leapfrog Referral Economy

**Concept:** Deepen the existing `referrer` field by adding on-chain reward tracking.

**Proposed mechanics:**
- Referrer earns 5% of all shard drops their referree earns, in perpetuity
- Referree gets +100 bonus XP at registration
- Max referral chain depth: 2 (no infinite trees)

**Formula:**
```
referralShare = floor(drop.amount × 0.05)
upsertItem(referrer, drop.type, referralShare)
```

Applied as a side-effect in `applyDrop()`. The referrer's wallet is denormalized onto the player document at registration and never changes.

---

### 24.9 Mechanic Interaction Summary

The proposed mechanics are designed to integrate cleanly with the existing event/action architecture:

| New Mechanic | Uses existing | New state |
|---|---|---|
| Pond Expeditions | `upsertItem`, `frogmentYield`, levelMult table | `expeditions` collection |
| Dutch Auctions | `market` sub-doc, SPL payment flow | `auctionMode` flag on market |
| Ribbit Breeding | `rollRarity`, `generateFrogStatsSeeded`, `grantEgg`, destroy guards | `breedCooldown` on player |
| Glyph Enchanting | `generateFrogStatsSeeded` range math, `upsertItem` | Glyph item types in `items` |
| Harmony Ponds | `computeCollectionPower`, player stats | `ponds` collection |
| Tadpole Quests | All existing claim/open events as triggers | `daily_quests` collection |
| LFRG Burn Events | SPL transfer (to burn address), `upsertItem` for cosmetics | `burn_events` + cosmetic flags on player |
| Referral Economy | `applyDrop()` side-effect, existing `referrer` field | No new collections |

---

---

*Part A (Farming Game) assembled from full analysis of `phaser/game/types/*.ts`, `phaser/game/events/*.ts`, `phaser/game/lib/*.ts`, `phaser/game/store/useGameStore.ts`, and `phaser/game/lib/constants.ts`. All formulas, tables, and constants are verbatim from source.*

*Part B (Frog System) assembled from full analysis of `lib/events/**/action.ts`, `lib/modules/**/model.server.ts`, `shared/mining/logic.ts`, `shared/drops/logic.ts`, `shared/drops/frogment-rng.ts`, `shared/data/*.ts`, and all API route handlers. All formulas are verbatim from source.*
