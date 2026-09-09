# Robinhood Farm — Game Mechanics Reference

> Derived entirely from source code. All values are authoritative as of the
> current codebase. File paths are relative to the project root.

---

## Table of Contents

1. [Game State](#1-game-state)
2. [Economy — Soft Coins](#2-economy--soft-coins)
3. [Stamina](#3-stamina)
4. [Farming](#4-farming)
5. [Woodcutting](#5-woodcutting)
6. [Mining](#6-mining)
7. [Fishing](#7-fishing)
8. [Animals & Husbandry](#8-animals--husbandry)
9. [Cooking](#9-cooking)
10. [Skills & Levelling](#10-skills--levelling)
11. [Draw System (Yield)](#11-draw-system-yield)
12. [Gold Currency](#12-gold-currency)
13. [Market — Soft-Coin Selling](#13-market--soft-coin-selling)
14. [Tools (Consumables)](#14-tools-consumables)
15. [Quests](#15-quests)
16. [Reputation & Ranks](#16-reputation--ranks)
17. [Milestones](#17-milestones)
18. [Token Marketplace](#18-token-marketplace)
19. [Game State Sync Architecture](#19-game-state-sync-architecture)
20. [New-Player Bootstrap](#20-new-player-bootstrap)

---

## 1. Game State

**Source:** `features/types/gameplay/game.ts`

The canonical `GameState` object is the single source of truth for all
in-game data. It is shared by both client (Zustand store) and server
(MongoDB via `/api/farm`).

| Field | Type | Description |
|---|---|---|
| `balance` | `Decimal` | Soft-coin (coin) balance. Non-withdrawable. |
| `fields` | `Record<number, GameNode>` | Farm plots (0–65). |
| `trees` | `Record<number, GameNode>` | Tree nodes (0–7). |
| `stones` | `Record<number, GameNode>` | Stone nodes (0–5). |
| `iron` | `Record<number, GameNode>` | Iron nodes (0–2). |
| `gold` | `Record<number, GameNode>` | Gold nodes (0–1). |
| `chickens` | `Record<number, ChickenState>` | Chicken slots. |
| `cows` | `Record<number, CowState>` | Cow slots. |
| `sheep` | `Record<number, SheepState>` | Sheep slots. |
| `inventory` | `Partial<Record<InventoryItemName, Decimal>>` | All item counts. |
| `skills` | `PlayerSkills` | Total XP per skill category. |
| `draw` | `SkillDraw` | Cached base-draw per skill (recomputed on level-up). |
| `stamina` | `{ current, max }` | Stamina pool (max always 100). |
| `lastStaminaRegenAt` | `number` | Timestamp of the last stamina tick. |
| `fishing` | `FishingState` | Last cast timestamp and last caught species. |
| `milestones` | `Milestones` | Lifetime activity counters. |

A `GameNode` carries `name`, `plantedAt`, `choppedAt`, and/or `minedAt`
depending on context.

---

## 2. Economy — Soft Coins

**Source:** `features/types/gameplay/game.ts`, `features/events/sell/`

- `state.balance` is a `Decimal` that holds the player's soft-coin balance.
- Coins are earned by selling crops, food, fish, animal produce, and
  resources at the Market (NPC sell). They are also spent to buy seeds,
  animals, and tools from the same Market.
- Coins are **not withdrawable** — they are not the same as the Gold
  currency (see [Section 12](#12-gold-currency)).
- A 10% sell-price boost is reserved for future boost items
  (`features/game/boosts.ts`); currently the bonus is never active.

---

## 3. Stamina

**Source:** `features/game/stamina.ts`

### Constants

| Constant | Value |
|---|---|
| Max stamina | 100 |
| Regen interval | 1 hour (`3_600_000 ms`) |
| Regen per interval | 5% of max = **5 stamina** |
| Max offline intervals | 8 (caps at +40 stamina offline) |

### Action Costs

| Action | Stamina Cost |
|---|---|
| Harvest crop | 1 |
| Harvest resource (generic) | 1 |
| Chop tree | 1 |
| Mine stone | 1 |
| Mine iron | 1 |
| Mine gold | 1 |
| Plant seed | 0 |
| Fish cast | 3 |

### Regen Behaviour

Regen is calculated in `calculateStaminaRegen()` by comparing the current
time to `lastStaminaRegenAt`. Whole intervals elapsed are applied (up to 8),
each adding `ceil(max × 0.05)` = 5 stamina. The regen timestamp advances by
the number of applied intervals, not to `now`, so missed ticks are never
silently lost.

---

## 4. Farming

**Source:** `features/game/crops.ts` (shared), `features/types/gameplay/crops.ts` (client),
`features/game/fields.ts`, `features/events/plant/plant.ts`,
`features/events/harvest/harvest.ts`

### Crops

| Crop | Grow Time | Farming Level | Seed Price (coins) | Sell Price (coins) | Notes |
|---|---|---|---|---|---|
| Potato | 1 min | 0 | 5 | 2 | Shop |
| Carrot | 5 min | 1 | 15 | 3 | Shop |
| Cabbage | 10 min | 2 | 30 | 5 | Shop |
| Pumpkin | 30 min | 3 | 60 | 8 | Shop |
| Beetroot | 1 hr | 5 | 110 | 12 | Shop |
| Parsnip | 2 hr | 6 | 200 | 18 | Shop |
| Radish | 3 hr | 8 | — | 30 | Quest reward (Normal tier) |
| Cauliflower | 6 hr | 10 | — | 50 | Quest reward (Hard tier) |
| Wheat | 12 hr | 12 | — | 80 | Quest reward (Expert tier) |
| Kale | 24 hr | 15 | — | 120 | Quest reward (Master tier) |

Quest-exclusive seeds (`Radish Seed` through `Kale Seed`) have `disabled: true`
in `SEEDS()` and cannot be purchased in any shop.

### Farm Plots

There are **66 plots** (index 0–65) across four map zones. Plots unlock as
the player's **Farming skill level** rises. First five plots (0–4) are
always available.

| Zone | Indices | Required Farming Level |
|---|---|---|
| A — top-right | 0–4 | 0 |
| A | 5–11 | 2 |
| A | 12–17 | 4 |
| A | 18–21 | 6 |
| B — top-left | 22–24 | 8 |
| B | 25–29 | 10 |
| B | 30–34 | 12 |
| B | 35–36 | 14 |
| C — mid-right | 37–41 | 16 |
| C | 42–48 | 18 |
| C | 49–53 | 20 |
| D — bottom-right | 54–55 | 22 |
| D | 56–59 | 23 |
| D | 60–63 | 24 |
| D | 64–65 | 25 |

### Harvest Yield & XP

On each harvest, yield = `rollDraw(state.draw.farmingDraw)` — a random
integer from 1 to the farming draw value (see [Draw System](#11-draw-system-yield)).

XP awarded per crop:

| Crop | Harvest XP |
|---|---|
| Potato | 10 |
| Carrot | 15 |
| Cabbage | 20 |
| Pumpkin | 25 |
| Beetroot | 35 |
| Parsnip | 45 |
| Radish | 55 |
| Cauliflower | 70 |
| Wheat | 90 |
| Kale | 120 |

Each harvest also rolls a rare **Gold drop** at 0.003% chance
(`HARVEST_GOLD_DROP_CHANCE = 0.00003`).

---

## 5. Woodcutting

**Source:** `features/events/chop/chop.ts`, `features/game/resources.ts`

- **Tool required:** 1 × `Axe` consumed per chop.
- **Stamina cost:** 1.
- **Tree recovery time:** 15 minutes (`TREE_RECOVERY_SECONDS = 900`).
- **Yield:** `rollDraw(state.draw.woodcuttingDraw)` Wood per chop.
- **XP per chop:** 25 (`SKILL_XP.chop_tree`).
- **Gold drop chance:** 0.020% (`ACTIVITY_GOLD_DROP_CHANCE = 0.0002`).
- **Tree count:** 8 trees on the map (indices 0–7).

---

## 6. Mining

**Source:** `features/events/mine/mine.ts`, `features/game/resources.ts`

- **Tool required:** 1 × `Pickaxe` consumed per mine.
- **Stamina cost:** 1 per mine action.
- **Yield:** `rollDraw(state.draw.miningDraw)` of the mined resource.
- **Gold drop chance:** 0.020%.

### Rock Nodes & Recovery

| Resource | Node Count | Recovery Time | XP per Mine |
|---|---|---|---|
| Stone | 6 | 1 hour | 60 |
| Iron | 3 | 12 hours | 100 |
| Gold (ore) | 2 | 24 hours | 150 |

Note: Iron and Gold ore are separate game objects from the Gold *currency*
item (which is also called `Gold` in `ResourceName`). The mining event
simply adds the resource to inventory; the Gold *currency* mechanic is
described separately in [Section 12](#12-gold-currency).

---

## 7. Fishing

**Source:** `features/game/fishing.ts`, `features/events/fishing/catchFish.ts`

- **Tool required:** 1 × `Rod` consumed per cast.
- **Stamina cost:** 3.
- **Base cooldown:** 30 seconds (`FISHING_BASE_COOLDOWN_MS = 30_000`).
- **Minimum cooldown:** 15 seconds (`FISHING_MIN_COOLDOWN_MS = 15_000`; boost reserved).
- **Yield:** `rollDraw(state.draw.fishingDraw)` of the caught fish.
- **Gold drop chance:** 0.020%.

### Fish Table

Fish are drawn by weighted random roll (`rollCatch(fishingLevel)`). Fish with
`minLevel` above the player's current fishing level are excluded from the
draw pool.

| Fish | Weight | Min Fishing Level | Sell Price (coins) |
|---|---|---|---|
| Anchovy | 50 | 0 | 8 |
| Sardine | 45 | 0 | 8 |
| Tilapia | 40 | 0 | 8 |
| Herring | 35 | 0 | 8 |
| Trout | 28 | 10 | 20 |
| Sea Bass | 22 | 10 | 20 |
| Mackerel | 18 | 20 | 20 |
| Salmon | 15 | 20 | 55 |
| Red Snapper | 10 | 30 | 55 |
| Barracuda | 7 | 40 | 55 |
| Tuna | 5 | 50 | 120 |
| Swordfish | 3 | 60 | 120 |
| Blue Marlin | 1.5 | 70 | 120 |
| Oarfish | 0.5 | 90 | 120 |

### Fishing XP

| Fish | XP |
|---|---|
| Anchovy | 20 |
| Sardine | 20 |
| Tilapia | 25 |
| Herring | 25 |
| Trout | 35 |
| Sea Bass | 40 |
| Mackerel | 45 |
| Salmon | 55 |
| Red Snapper | 65 |
| Barracuda | 80 |
| Tuna | 95 |
| Swordfish | 115 |
| Blue Marlin | 140 |
| Oarfish | 175 |

---

## 8. Animals & Husbandry

**Source:** `features/game/animals.ts`, `features/events/feed-animals/`,
`features/events/collect-produce/`

Animals are bought from the Barn/Shop. Each animal has a maximum count,
a feed requirement, and a produce cycle. Feeding starts the produce timer;
the animal becomes hungry again after the same duration.

### Animal Definitions

| Animal | Buy Price | Feed Item | Feed Amount | Max Count | Produce | Produce Time | Re-hunger | Produce Sell Price |
|---|---|---|---|---|---|---|---|---|
| Chicken | 5 coins | Carrot | 1 | 10 | Egg | 4 hours | 4 hours | 25 coins |
| Cow | 50 coins | Beetroot | 2 | 5 | Milk | 8 hours | 8 hours | 40 coins |
| Sheep | 30 coins | Parsnip | 2 | 5 | Wool | 12 hours | 12 hours | 30 coins |

### Farming Level Requirements (from `ANIMALS` in craftables)

| Animal | Level Required |
|---|---|
| Chicken | 3 |
| Cow | 6 |
| Sheep | 8 |

### Husbandry XP

| Action | XP |
|---|---|
| Collect Egg | 30 |
| Collect Milk | 50 |
| Collect Wool | 50 |

Husbandry draw affects the **amount** of produce collected per action:
`rollDraw(state.draw.husbandryDraw)` units.

---

## 9. Cooking

**Source:** `features/types/gameplay/craftables.ts`, `features/events/cooking/cookFood.ts`,
`features/events/sell/sellFood.ts`, `features/events/consume/consumeFood.ts`

Recipes are cooked in the Kitchen. Cooking does not cost stamina. Each dish
restores stamina when consumed and can be sold for soft coins or listed
on the token marketplace.

### Food Recipes

| Food | Ingredients | Stamina Restored | Sell Price (coins) |
|---|---|---|---|
| Roasted Potato | 2× Potato | 5 | 10 |
| Carrot Stew | 3× Carrot | 10 | 18 |
| Cabbage Roll | 2× Cabbage, 1× Carrot | 15 | 28 |
| Pumpkin Soup | 3× Pumpkin, 1× Cabbage | 20 | 42 |
| Beetroot Salad | 3× Beetroot, 1× Pumpkin | 25 | 60 |
| Parsnip Porridge | 3× Parsnip, 2× Beetroot | 30 | 85 |
| Radish Skewers | 4× Radish, 2× Parsnip, 1× Egg | 40 | 140 |
| Cauliflower Sandwich | 4× Cauliflower, 2× Radish, 2× Egg | 50 | 200 |
| Wheat Bread | 5× Wheat, 2× Cauliflower, 1× Milk | 65 | 300 |
| Kale Stir-fry | 5× Kale, 3× Wheat, 2× Milk | 80 | 450 |

Tiers 7–10 (Radish Skewers through Kale Stir-fry) require **quest-exclusive
crops** and animal produce, making them the rarest dishes. Max stamina is
100, so Kale Stir-fry restores 80% of the stamina bar per unit.

---

## 10. Skills & Levelling

**Source:** `features/game/skills.ts`, `features/types/gameplay/skills.ts`

There are **five skill categories**, each with its own XP total stored in
`state.skills`:

- `farming`
- `woodcutting`
- `mining`
- `fishing`
- `husbandry`

### Level Formula

```
xpForNextLevel(level) = round(500 + 350 × (level − 1) + 25 × (level − 1)²)
```

| Level | XP to next level |
|---|---|
| 1 | 500 |
| 2 | 875 |
| 3 | 1,300 |
| 5 | 2,300 |
| 10 | 6,050 |
| 20 | 16,300 |
| 50 | 75,300 |
| 100 | (max) |

Max level is **100**. `getSkillLevel(totalXP)` walks the formula
incrementally.

### Level-Up Trigger

On every action that grants XP, the event handler compares `oldLevel` to
`newLevel`. If they differ, `computeDraw()` is called to recompute all five
draw values from the new XP totals, and the result is stored in
`state.draw`.

---

## 11. Draw System (Yield)

**Source:** `features/game/draw.ts`

The **draw** is the maximum unit count that can be obtained from a single
gathering action. The actual yield is `rollDraw(baseDraw)` — a uniform
random integer in **[1, baseDraw]**.

Draw values are cached per-skill in `state.draw` and updated on level-up.

### Base Draw by Level

| Skill Level | Base Draw |
|---|---|
| 1–9 | 1 |
| 10–19 | 2 |
| 20–34 | 3 |
| 35–49 | 4 |
| 50–69 | 6 |
| 70–89 | 8 |
| 90–99 | 10 |
| 100 | 12 |

This applies uniformly to all five skills: each skill's XP level is mapped
to a draw value independently.

---

## 12. Gold Currency

**Source:** `features/game/gold.ts`

Gold is a **rare, scarce currency** separate from soft coins. It is
intentionally difficult to accumulate. It is stored as `inventory.Gold`
(a `Decimal`) — the same inventory slot type as any other resource, but
its value pathway is real-world redeemable (implementation TBD).

### Emission Sources

| Source | Chance per Event |
|---|---|
| Harvest crop | 0.003% (`HARVEST_GOLD_DROP_CHANCE`) |
| Chop tree | 0.020% (`ACTIVITY_GOLD_DROP_CHANCE`) |
| Mine (stone/iron/gold node) | 0.020% |
| Fish cast | 0.020% |
| Quest completion | Fixed reward by tier (see below) |

All drop rolls use `rollGoldDrop(chance)` — a single `Math.random() < chance`
check that returns 0 or 1.

### Quest Gold Rewards

| Quest Tier | Min Gold | Max Gold |
|---|---|---|
| Normal | 1 | 2 |
| Hard | 3 | 5 |
| Expert | 8 | 12 |
| Master | 15 | 25 |

---

## 13. Market — Soft-Coin Selling

**Source:** `features/events/sell/sell.ts`, `features/events/sell/sellFood.ts`,
`features/events/sell/sellProduce.ts`, `features/events/sell/sellFish.ts`,
`features/events/sell/sellResource.ts`

The Market NPC provides instant-sell at fixed coin prices. All sales
increment the `Coins Earned` milestone.

### Sell Actions

| Dispatch Type | Items | Price Source |
|---|---|---|
| `item.sell` | Crops | `CROPS()[name].sellPrice` |
| `food.sell` | Cooked foods | `FOOD_SELL_PRICES[name]` |
| `produce.sell` | Egg, Milk, Wool | `RESOURCES[name].sellPrice` |
| `fish.sell` | All 14 fish | `FISH_TABLE[name].sellPrice` |
| `resource.sell` | Wood, Stone | `RESOURCES[name].sellPrice` |

### Resource Sell Prices

| Item | Sell Price (coins) |
|---|---|
| Wood | 4 |
| Stone | 3 |
| Egg | 25 |
| Milk | 40 |
| Wool | 30 |

---

## 14. Tools (Consumables)

**Source:** `features/types/gameplay/craftables.ts`, `features/events/craft-tool/craftTool.ts`

Tools are **consumable items** — one unit is deducted from inventory on
each use. They are purchased at the Workbench tab of the Market modal.
They **cannot** be listed on the token marketplace.

| Tool | Coin Cost | Ingredient | Used For |
|---|---|---|---|
| Axe | 5 coins | — | Chop trees (1 per chop) |
| Pickaxe | 8 coins | 1× Wood | Mine rocks (1 per mine) |
| Rod | 10 coins | 1× Wood | Fish casts (1 per cast) |

Purchasing uses the `tool.crafted` event. If the player has insufficient
coins or missing ingredients, the event throws and the action is rejected.

---

## 15. Quests

**Source:** `features/game/quests.ts`, `features/types/quests.ts`,
`features/events/quest-complete/action.ts`

### Overview

Five daily quests are generated at login — one per skill category. They
expire at the next UTC midnight. Quest objectives ask the player to collect
a fixed quantity of a resource from that category.

### Quest Categories & Resource Pools

| Category | Eligible Resources |
|---|---|
| Farming | Potato, Carrot, Cabbage, Pumpkin, Beetroot, Parsnip |
| Mining | Stone |
| Woodcutting | Wood |
| Fishing | All 14 fish species |
| Husbandry | Egg, Milk, Wool |

Quest crops (Radish, Cauliflower, Wheat, Kale) are **never** quest
objectives — they are rewards only.

### Difficulty & Reward Bands

Difficulty is assigned by the player's skill XP in the matching category.

| Max Skill XP | Difficulty | Base Qty | Rep Reward | Skill XP | Gold Reward |
|---|---|---|---|---|---|
| ≤ 499 | Easy | 15 | 50 | 50 | 0 |
| ≤ 4,999 | Normal | 35 | 100 | 150 | 1 |
| ≤ 24,999 | Hard | 80 | 200 | 400 | 3 |
| Infinity | Expert | 150 | 400 | 1000 | 8 |

Final required quantity = `round(baseQty × factor)` where
`factor ∈ [0.75, 1.25]` (uniform random).

### Farming Quest Seed Rewards

| Difficulty | Seed Reward |
|---|---|
| Normal | Radish Seed |
| Hard | Cauliflower Seed |
| Expert | Wheat Seed |

Easy farming quests do not award a seed. Master tier (Kale Seed) is
pending `QuestDifficulty` type extension.

---

## 16. Reputation & Ranks

**Source:** `features/utils/reputation.ts`

Reputation Points (RP) are earned by completing quests. Rank is a
**cosmetic-only** label — no game mechanic is gated by it.

### Rank Thresholds

| Rank | Minimum RP |
|---|---|
| Newcomer | 0 |
| Farmhand | 500 |
| Settler | 1,500 |
| Cultivator | 4,000 |
| Artisan | 10,000 |
| Elder | 25,000 |
| Legend | 60,000 |

`getRank(rp)` returns the current rank name, the next threshold, and a
0–1 fractional progress value.

---

## 17. Milestones

**Source:** `features/game/milestones.ts`, `features/types/gameplay/milestones.ts`

Milestones are **lifetime activity counters** stored in `state.milestones`
and persisted to the database. They are purely informational — no mechanic
gates on milestone completion.

There are 52 milestones across 6 categories:

| Category | Examples |
|---|---|
| Farming | Seeds Planted, Crop Harvested, per-crop counts (Potato … Kale) |
| Resources | Trees Chopped, Stone Mined, Iron Mined, Gold Mined |
| Animals | Animals Fed, Eggs Collected, Milk Collected, Wool Collected |
| Fishing | Total Fish Caught, per-species counts (Anchovy … Oarfish) |
| Cooking | Total Food Cooked, per-dish counts (Roasted Potato … Kale Stir-fry) |
| Economy | Coins Earned, Coins Spent, Coins Deposited, Coins Withdrawn, Coins Burned |

Each event handler calls `trackMilestone(milestones, key, amount)` which
returns a new immutable milestones map without mutating the original.

---

## 18. Token Marketplace

**Source:** `features/game/marketplace.ts`, `features/types/marketplace.ts`,
`features/events/list-asset/list-stackable.ts`,
`features/events/purchase/purchase.ts`

The player-to-player marketplace uses the game's blockchain token (HFARM)
for settlement. It is separate from the soft-coin NPC market.

### Tradable Asset Types

`resource`, `seed`, `food`, `fish`, `crafting_material`

Tools (Axe, Pickaxe, Rod) are **soft-coin items** and are blocked from
listing by the isolation guard in `validateListingParams()`.

### Configuration

| Setting | Value |
|---|---|
| Marketplace fee | 5% of sale price |
| Minimum fee | 0.01 Game Balance |
| Maximum fee | 10,000 Game Balance |
| Minimum price per unit | 0.01 |
| Maximum price per unit | 10,000,000 |
| Max active listings per player | 20 |
| Listing cooldown | 1,000 ms |
| Purchase cooldown | 500 ms |

### Fee Calculation

```
fee = clamp(totalPrice × 0.05, 0.01, 10_000)
```

The fee is debited from the buyer before the seller receives the net
amount. It is credited to the Treasury.

---

## 19. Game State Sync Architecture

**Source:** `features/game-stores/useGameStore.ts`

The game uses a **hybrid optimistic sync** model:

1. **On mount** — `hydrateFarm()` fetches `GET /api/farm`. Server state
   wins for all numeric and world values. `localStorage` is an offline
   fallback only.
2. **On action** — `send(action)` applies an optimistic local update
   instantly (zero latency), then enqueues the action for `POST /api/farm/action`.
3. **Queue drain** — actions are sent one at a time. The server reconcile
   only merges on the last pending action to avoid inventory flicker.
4. **On server rejection (422)** — the entire queue is cleared and
   `resetToServerState()` is called to roll back all optimistic changes.
5. **Demo mode** — when `rhf_demo=1` cookie is present, no server calls
   are made. All progress is client-side only.
6. **Version tracking** — `stateVersion` is incremented on each
   successful server sync. A higher version from the server always wins.

---

## 20. New-Player Bootstrap

**Source:** `lib/modules/inventories/repository.server.ts`,
`features/game-stores/useGameStore.ts`

New accounts receive a starter kit so they can immediately begin all five
activities without first earning coins.

| Item | Quantity |
|---|---|
| Potato Seed | 10 |
| Axe | 5 |
| Pickaxe | 5 |
| Rod | 5 |

The same kit is applied at both layers:
- **Client** (`INITIAL_FARM` in `useGameStore.ts`) — used for demo mode
  and as the default before hydration.
- **Server** (`INITIAL_ITEMS` in `repository.server.ts`) — applied when
  the inventory row is first created for a new registered account.
