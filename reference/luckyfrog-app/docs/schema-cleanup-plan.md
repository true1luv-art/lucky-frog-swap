# Schema Cleanup Plan
# Farm Model + Player Model + lib/modules Restructure

## Context

This plan covers the cleanup of `FarmSchema`, `PlayerSchema`, and the missing
`lib/modules` collections that were never created during the initial revamp.
It does NOT re-implement game logic — it only moves data ownership to the
correct documents and removes dead schema fields.

---

## What is wrong right now

### FarmSchema carries data that does not belong to it

| Field | Problem |
|---|---|
| `trees / stones / iron / emerald / diamond / ignisite` | Per-node cooldown maps. With fast respawn there is no cooldown to track, so these are dead weight. Remove entirely. |
| `ResourceNodeSchema`, `FishingStateSchema`, `StaminaStateSchema` | Sub-schemas only used by the dead fields above. Remove. |
| `tools` | Stored as `Schema.Types.Mixed` directly on the farm. Tools are player-owned — they survive farm resets and belong to a separate collection keyed by `owner`. |
| `equipment` | Same problem as tools. Equipment (owned armor pieces + equipped set) is player-owned. It lives on `PlayerSchema` (see Mythoria reference). |
| `quests` | Embedded on the farm document. Quests have no history requirement and no cross-farm read, so they embed on `PlayerSchema` instead, like `milestones`. |

### lib/modules is missing three collections

The `inventories` collection exists and follows the correct `owner`-keyed
one-document-per-item pattern. Tools and equipment never got their own modules
despite being designed the same way.

| Missing module | What it stores |
|---|---|
| `lib/modules/tools/` | One document per owned tool instance. `owner` (wallet), `toolId` (nanoid), `name`, `tier`, `durability`, `maxDurability`. Indexed by `owner`. |
| `lib/modules/equipment/` | One document per owned armor piece. `owner`, `itemId`, `slot`, `tier`, `upgradeLevel`, `stats`. Plus an `equippedSet` sub-document per player (the four currently worn pieces). Indexed by `owner`. |

Both follow the exact same `{ owner, ... }` pattern as `InventoryItemSchema`.
GET via API by `owner` — never embed in farm or player documents.

---

## Decision: quests stay embedded on PlayerSchema

Quests have no history and no cross-player read. Embedding them on `PlayerSchema`
(same approach as `milestones`) is correct. A separate `quests` collection would
add a collection round-trip with no benefit at this scale.

The `EmbeddedQuestSchema` sub-schema and the `quests: { daily: EmbeddedQuest[] }`
field simply move from `FarmSchema` to `PlayerSchema`.

---

## Part 1 — Remove dead fields from FarmSchema

**Files: `lib/modules/farms/model.server.ts` and `lib/modules/farms/types.server.ts`**

Remove from `model.server.ts`:
- `ResourceNodeSchema` (only used by the dead resource maps)
- `FishingStateSchema` (fishing has no cooldown)
- `StaminaStateSchema` (stamina system removed)
- `EmbeddedQuestSchema` (moves to player model)
- Schema fields: `trees`, `stones`, `iron`, `emerald`, `diamond`, `ignisite`
- Schema fields: `tools` (moves to `lib/modules/tools/`)
- Schema fields: `equipment` (moves to `lib/modules/equipment/`)
- Schema field: `quests` (moves to `PlayerSchema`)
- Schema field: `fishing` (no cooldown needed)

Keep in `model.server.ts`:
- `FieldNodeSchema` (crop plots with `plantedAt` + `harvestAt`)
- `AnimalNodeSchema` (animals with `fedAt`)
- Schema fields: `playerId`, `fields`, `chickens`, `cows`, `sheep`

Remove from `types.server.ts`:
- `ResourceNode` interface
- `FishingState` interface
- `StaminaState` interface
- `ToolInstanceDoc` interface (moves to `lib/modules/tools/types.server.ts`)
- `IFarm.trees / stones / iron / emerald / diamond / ignisite`
- `IFarm.tools`
- `IFarm.equipment`
- `IFarm.fishing`
- `IFarm.quests`

Keep in `types.server.ts`:
- `FieldNode` interface
- `AnimalNode` interface
- `IFarm` (slimmed down: `playerId`, `fields`, `chickens`, `cows`, `sheep`)

---

## Part 2 — Move quests to PlayerSchema

**Files: `lib/modules/players/model.server.ts` and `lib/modules/players/types.server.ts`**

Add to `PlayerSchema`:
```ts
// In model.server.ts — reuse EmbeddedQuestSchema moved from farms model
quests: {
  daily: { type: [EmbeddedQuestSchema], default: [] },
},
```

Add to `IPlayer`:
```ts
quests: {
  daily: EmbeddedQuest[];
};
```

The `EmbeddedQuestSchema` definition and import of `EmbeddedQuest` move from
`farms/model.server.ts` to `players/model.server.ts`.

---

## Part 3 — Create lib/modules/tools/

One document per owned tool instance. Pattern mirrors `lib/modules/inventories/`.

**`lib/modules/tools/types.server.ts`**
```ts
import type { Document } from "mongoose";
import type { ToolName, ToolTier } from "@/features/types/gameplay/tools";

export interface IToolInstance extends Document {
  owner: string;           // wallet address
  toolId: string;          // nanoid stable ID
  name: ToolName;
  tier: ToolTier;
  durability: number | null;     // null = infinite (Wood tier)
  maxDurability: number | null;
}
```

**`lib/modules/tools/model.server.ts`**
```ts
// One document per tool instance owned by a player.
// Index: { owner: 1 } for "get all tools for player"
// No unique compound key — a player can own multiple tools of the same tier.
```

**`lib/modules/tools/index.ts`**
```ts
export { ToolInstanceModel } from "./model.server";
export type { IToolInstance } from "./types.server";
```

---

## Part 4 — Create lib/modules/equipment/

One document per owned armor piece, plus an equipped-set document per player.

**`lib/modules/equipment/types.server.ts`**
```ts
import type { Document } from "mongoose";
import type { EquipmentSlot, EquipmentTier } from "@/features/types/gameplay/equipment";

// One document per owned armor piece
export interface IArmorPiece extends Document {
  owner: string;           // wallet address
  itemId: string;          // nanoid
  slot: EquipmentSlot;     // "Helm" | "Chest" | "Legs" | "Boots"
  tier: EquipmentTier;
  upgradeLevel: number;    // 0 = no upgrades
}

// One document per player — tracks the four currently equipped pieces
export interface IEquippedSet extends Document {
  owner: string;
  helm?:   string;   // itemId of equipped helm
  chest?:  string;
  legs?:   string;
  boots?:  string;
}
```

**`lib/modules/equipment/model.server.ts`**
```ts
// ArmorPieceSchema: { owner, itemId, slot, tier, upgradeLevel }
// Index: { owner: 1 }  — get all armor for player
// Index: { owner: 1, itemId: 1 } unique — stable lookup for upgrade/destroy

// EquippedSetSchema: { owner, helm, chest, legs, boots }
// Index: { owner: 1 } unique — one equipped set per player
```

**`lib/modules/equipment/index.ts`**
```ts
export { ArmorPieceModel, EquippedSetModel } from "./model.server";
export type { IArmorPiece, IEquippedSet } from "./types.server";
```

---

## Part 5 — Update build-state.ts and persist.ts

### build-state.ts

Remove:
- `buildResourceNodes()` — no more resource node maps on IFarm
- References to `f.trees`, `f.stones`, `f.iron` etc. in the returned GameState
- `f.fishing`, `f.equipment`, `f.tools` reads from farm doc

Add:
- `tools` parameter: accept `IToolInstance[]` fetched from `ToolInstanceModel.find({ owner })`
- `equipment` parameter: accept `IArmorPiece[]` + `IEquippedSet | null` from equipment module
- `quests` now comes from `player.quests.daily` instead of `farm.quests.daily`

The function signature changes:
```ts
export function buildServerGameState(
  farm:      IFarm | null,
  inventory: IInventory | null,
  player:    IPlayer,            // now includes quests
  tools:     IToolInstance[],    // new — from tools collection
  armorPieces: IArmorPiece[],    // new — from equipment collection
  equippedSet: IEquippedSet | null, // new
): GameState
```

### persist.ts

Remove:
- `resourceNodesDiff()` — no more tree/stone/iron maps
- `treeSet`, `stoneSet` in the farm `$set` payload
- `equipmentChanged` farm write — equipment is now in its own collection
- `toolsChanged` farm write — tools are now in their own collection
- `fishingChanged` farm write

Add:
- Tool ops: when `oldState.tools` differs from `newState.tools`, build bulk ops for `ToolInstanceModel` (upsert by `toolId`, $set durability; $delete when durability hits 0)
- Equipment ops: when `newState.equipment` differs, bulk upsert `ArmorPieceModel` + update `EquippedSetModel`
- Quest write: when `newState.quests` differs, `$set player.quests.daily`

---

## Part 6 — Update farm action API route

`app/api/farm/action/route.ts` currently calls:
```ts
buildServerGameState(farm, inventory, player)
```

After this plan it will call:
```ts
const [tools, armorPieces, equippedSet] = await Promise.all([
  ToolInstanceModel.find({ owner: playerId }).lean(),
  ArmorPieceModel.find({ owner: playerId }).lean(),
  EquippedSetModel.findOne({ owner: playerId }).lean(),
]);
buildServerGameState(farm, inventory, player, tools, armorPieces, equippedSet)
```

The three extra queries run in parallel with `Promise.all` — no sequential penalty.

---

## Files changed summary

| File | Change |
|---|---|
| `lib/modules/farms/model.server.ts` | Remove `ResourceNodeSchema`, `FishingStateSchema`, `StaminaStateSchema`, `EmbeddedQuestSchema`, and the 6 resource maps + tools + equipment + fishing + quests fields |
| `lib/modules/farms/types.server.ts` | Remove `ResourceNode`, `FishingState`, `StaminaState`, `ToolInstanceDoc`; slim down `IFarm` |
| `lib/modules/players/model.server.ts` | Add `EmbeddedQuestSchema` + `quests.daily` field |
| `lib/modules/players/types.server.ts` | Add `quests: { daily: EmbeddedQuest[] }` to `IPlayer` |
| `lib/modules/tools/types.server.ts` | **NEW** — `IToolInstance` |
| `lib/modules/tools/model.server.ts` | **NEW** — `ToolInstanceModel` |
| `lib/modules/tools/index.ts` | **NEW** — barrel export |
| `lib/modules/equipment/types.server.ts` | **NEW** — `IArmorPiece`, `IEquippedSet` |
| `lib/modules/equipment/model.server.ts` | **NEW** — `ArmorPieceModel`, `EquippedSetModel` |
| `lib/modules/equipment/index.ts` | **NEW** — barrel export |
| `features/farm-action/build-state.ts` | Remove resource node builders; accept tools/equipment params from their collections; quests from player |
| `features/farm-action/persist.ts` | Remove resource node diff; remove farm-embedded tools/equipment/fishing writes; add tool/equipment collection ops; quest diff to player |
| `app/api/farm/action/route.ts` | Parallel-fetch tools + armorPieces + equippedSet; pass to `buildServerGameState` |

---

## What does NOT change

- `GameState` shape in `features/types/gameplay/game.ts` — `items`, `tools[]`, `equipment`/`armors` remain as-is
- All event files (`collectEgg`, `catchFish`, `craftTool`, `upgradeArmor`, etc.) — pure functions, no DB awareness
- `lib/modules/inventories/` — already correct, no changes
- `lib/modules/players/` skill/milestone/stats fields — no changes
- Client-side store (`useGameStore.ts`) — no changes
- Selectors — no changes
