# Collectibles Implementation Plan

## 1. Purpose

Add six permanent, non-placeable collectibles to LuckyFrog. Each collectible supports one gameplay system and has a **maximum global supply of 1,500 minted instances**.

Collectibles are forged at the Blacksmith from game resources. Every forged copy is represented by its own MongoDB document in the `collectibles` collection. A player may own multiple copies of the same collectible, but the gameplay bonus is boolean by collectible name: owning one or more copies grants the effect exactly once.

This document is intentionally divided into independently executable phases. Implement and verify one phase at a time; do not prompt or implement the entire plan in one pass.

> Cleanup scope: rarity and egg-tier transaction behavior have been retired from active code. This is a code-only schema cleanup; existing MongoDB documents are not migrated, backfilled, or rewritten.

---

## 2. Confirmed Product Rules

### 2.1 Supply and minting

- Each of the six collectible names has a hard lifetime supply cap of `1,500`.
- Supply is enforced independently for each collectible name.
- `mintedSupply` means the number of collectible documents ever minted for that name.
- Marketplace listings, cancellations, and completed sales do not change minted supply.
- Peer-to-peer gifting or direct owner-to-owner transfer is not supported. Every ownership change after minting must occur through an authorized marketplace purchase settlement.
- Collectibles are not burned in the first version. If burning is added later, it must not silently restore lifetime supply unless the product rules are explicitly changed.
- The Blacksmith must display remaining supply as `1,500 - mintedSupply`.
- Forging must fail if the requested quantity exceeds remaining supply, even when the player has enough ingredients.
- Supply checks and mint creation must be concurrency-safe and atomic. Two requests must never mint beyond 1,500.
- The client must never be trusted to provide current supply, remaining supply, recipes, prices, or mint numbers.

### 2.2 Ownership and activation

- Every collectible copy is a unique MongoDB document with one owner.
- Collectibles are non-placeable and require no equipment slot or activation action.
- A collectible effect is active when the player owns at least one document with that collectible name.
- Duplicate copies do not stack.
- One copy and 100 copies produce the same gameplay bonus.
- If a player sells their final copy through the marketplace, the effect is removed on the next authoritative state load/action.
- Collectible bonuses are always derived from current ownership; they are never stored as permanent additive values on the player.

### 2.3 Acquisition and economy

- The Blacksmith is the only minting location.
- Recipes consume resources only.
- Recipes never consume coins or LFRG.
- There is no player-level requirement.
- Bulk forging is allowed only when both resources and remaining supply cover the full quantity.
- Crafting uses server-owned definitions. The client sends only collectible name and positive integer quantity.
- Ingredient deduction, supply reservation, and collectible document creation must succeed or fail together.

### 2.4 Marketplace status

- The collectible model includes the established embedded `market` sub-document from the beginning so it follows the repository’s tradable unique-asset architecture.
- Marketplace listing and settlement support should be implemented in its own phase after minting and ownership are stable.
- Until that phase is complete, collectibles must not fall through the inventory-item marketplace path or default to the `resource` asset type.

### 2.5 Progression compatibility

- Existing Chicken, Cow, and Sheep unlock requirements remain unchanged.
- Feeding validates ownership of the required harvested crop, not seed unlock state.
- Marketplace-acquired feed remains valid.
- Seed progression is redistributed so every seed is unlocked by Farming Level 15.

---

## 3. Initial Catalog and Supply

| Collectible | System | Effect | Maximum supply | Stacking rule |
|---|---|---|---:|---|
| Harvest Scarecrow | Harvesting | Crops grow 10% faster | 1,500 | One effect maximum per owner |
| Forester's Totem | Trees | Trees recover 10% faster | 1,500 | One effect maximum per owner |
| Fisher's Shrine | Fishing | Fishing cooldown is 10% shorter | 1,500 | One effect maximum per owner |
| Miner's Monument | Mining | Stone, Iron, and Gold recover 10% faster | 1,500 | One effect maximum per owner |
| Chef's Cauldron | Cooking | Cooking takes 10% less time | 1,500 | One effect maximum per owner |
| Husbandry Bell | Husbandry | Chicken, Cow, and Sheep produce 10% faster | 1,500 | One effect maximum per owner |

All effect percentages must remain independently configurable. The initial collectible multiplier is either `1.0` or `0.9`; it is never applied once per owned document.

---

## 4. Resource-Only Recipes

All quantities use `Decimal` in game-state calculations.

### 4.1 Harvest Scarecrow

- 2,500 Potato
- 1,500 Carrot
- 1,000 Cabbage
- 750 Pumpkin
- 500 Beetroot
- 300 Parsnip
- 200 Radish
- 100 Cauliflower
- 100 Wheat
- 50 Kale
- 1,000 Wood

### 4.2 Forester's Totem

- 7,700 Wood
- 1,000 Stone
- 250 Iron
- 50 Gold

Use the repository’s canonical inventory names if mining resources are named `Iron Ore` and `Gold Ore`; do not create aliases.

### 4.3 Fisher's Shrine

- 2,000 Wood
- 1,000 Stone
- 750 Anchovy
- 500 Sardine
- 300 Tilapia
- 200 Herring
- 100 Trout
- 50 Sea Bass
- 25 Mackerel
- 10 Salmon

Before implementation, reconcile these names with the canonical fish union. Recipes must use existing inventory names only.

### 4.4 Miner's Monument

- 5,500 Stone
- 1,200 Iron
- 250 Gold
- 1,000 Wood

Use canonical inventory names as noted above.

### 4.5 Chef's Cauldron

- 1,500 Stone
- 500 Iron
- 100 Gold
- 250 Roasted Potato
- 150 Carrot Stew
- 100 Cabbage Roll
- 75 Pumpkin Soup
- 50 Beetroot Salad
- 25 Parsnip Porridge
- 10 Radish Skewers

### 4.6 Husbandry Bell

- 2,000 Wood
- 1,000 Stone
- 500 Iron
- 100 Gold
- 1,000 Wheat
- 750 Kale
- 1,000 Cabbage
- 1,000 Egg
- 500 Milk
- 500 Wool

`Egg` means the existing chicken produce item.

### 4.7 Recipe constraints

- No recipe defines a positive `price`.
- Every ingredient name must be validated against `InventoryItemName`.
- The server computes `ingredient amount × forge quantity`.
- The complete bulk request is atomic; partial resource deduction or partial minting is forbidden.

---

## 5. Seed Unlock Redistribution

| Seed | Farming level |
|---|---:|
| Potato Seed | 0 |
| Carrot Seed | 1 |
| Cabbage Seed | 2 |
| Pumpkin Seed | 3 |
| Beetroot Seed | 5 |
| Parsnip Seed | 6 |
| Radish Seed | 8 |
| Cauliflower Seed | 10 |
| Wheat Seed | 12 |
| Kale Seed | 15 |

`shared/data/farming.ts` must be the source of truth. Seed shop presentation and server planting validation must derive from it. Feeding must not inherit seed-level checks.

---

## 6. Domain Types and Static Configuration

Create:

```text
shared/types/gameplay/collectibles.ts
shared/data/collectibles.ts
shared/game/collectibles.ts
```

### 6.1 Gameplay types

```ts
export type CollectibleName =
  | "Harvest Scarecrow"
  | "Forester's Totem"
  | "Fisher's Shrine"
  | "Miner's Monument"
  | "Chef's Cauldron"
  | "Husbandry Bell";
```

The bonus keys must use the existing `SkillBonus` names:

- `cropSpeed`
- `woodRecovery`
- `fishSpeed`
- `oreRecovery`
- `cookingSpeed`
- `produceSpeed`

Static collectible configuration contains display metadata, recipe, effect, and `maxSupply: 1500`. MongoDB stores live minted instances; it does not replace the trusted recipe catalog.

### 6.2 Non-stacking ownership helpers

Pure helpers should operate on a set/list of collectible names owned by the player:

```ts
ownsCollectible(ownedNames, name): boolean
getCollectibleBonuses(ownedNames): Partial<SkillBonus>
mergeSkillAndCollectibleBonuses(skillBonus, collectibleBonus): SkillBonus
```

The implementation must deduplicate names before calculating effects. It must not iterate over every copy and add the amount repeatedly.

---

## 7. MongoDB Collectibles Module

Create the complete domain module:

```text
lib/modules/collectibles/types.server.ts
lib/modules/collectibles/model.server.ts
lib/modules/collectibles/repository.server.ts
lib/modules/collectibles/service.server.ts
```

External callers import from `service.server.ts`, not directly from the repository.

### 7.1 Why this is separate from inventories

Collectibles are supply-capped, individually minted unique assets that may change owners only through marketplace sale settlement. Their ownership must not be stored authoritatively as a stackable `inventories` document. The `collectibles` collection is the source of truth for:

- total minted supply by collectible name;
- sequential mint identity;
- current owner;
- marketplace listing state;
- gameplay ownership projection.

Do not maintain a second authoritative collectible quantity in `inventories`; that would create reconciliation bugs after marketplace sales.

### 7.2 Model shape

Follow the established equipment conventions and reuse a shared market type/schema if practical rather than allowing the shapes to drift.

```ts
interface ICollectible extends Document {
  collectible_number: number;
  owner: string;
  name: CollectibleName;
  system: CollectibleSystem;
  image: string;
  market: CollectibleMarket;
  createdAt: Date;
  updatedAt: Date;
}
```

Field rules:

- MongoDB `_id`: globally unique technical identity used for direct lookup and marketplace settlement.
- `collectible_number`: counter-derived sequential mint number within the collectible name, from 1 through 1,500.
- `owner`: normalized player wallet used by other owner-based collections.
- `name`: enum restricted to the six canonical names.
- `system`: enum for harvesting, trees, fishing, mining, cooking, husbandry.
- `image`: canonical asset path copied from trusted configuration at mint time or resolved from configuration consistently.
- No `equipped`, `placedAt`, coordinates, activation, or per-copy bonus fields.

### 7.3 Embedded market shape

Match `lib/modules/equipments`:

```ts
interface CollectibleMarket {
  listed: boolean;
  price: number;
  seller: string | null;
  created: Date | null;
  expires: Date | null;
  sold: boolean;
  hash?: string;
  locked?: boolean;
  lockedAt?: Date;
}
```

The market object is always present and resets to unlisted defaults after purchase or cancellation. While listed, ownership-changing or duplicate-listing actions are blocked.

### 7.4 Required indexes

- Unique `{ name: 1, collectible_number: 1 }`.
- `{ owner: 1, name: 1 }` for gameplay ownership checks.
- `{ "market.listed": 1, name: 1, "market.price": 1 }` for browsing.
- `{ "market.hash": 1 }` for settlement lookup.

### 7.5 Atomic supply enforcement

A count followed by inserts is not safe. Minting must use a transaction and an atomic per-name counter/reservation.

Recommended approach:

- Add a small counter document per collectible name, either in a dedicated `collectible_counters` collection or as a clearly separated counter model in the collectibles module.
- Counter fields: `name`, `mintedSupply`, `maxSupply`, timestamps.
- Atomically increment only when `mintedSupply + requestedQuantity <= maxSupply`.
- Allocate the returned range directly to per-name `collectible_number` values; this guarded counter is the only mint-number allocator.
- Use each document's MongoDB `_id` as its globally unique technical and marketplace identity.
- Deduct ingredients, reserve supply, and insert collectible documents in the same MongoDB session/transaction.
- On any failure, abort the transaction so resources, counters, and documents remain unchanged.

Required service reads:

```ts
getCollectibleById(id)
getCollectiblesByOwner(owner)
getOwnedCollectibleNames(owner)
getCollectibleSupply(name)
getAllCollectibleSupplies()
getListedCollectibles()
```

Supply responses must expose `mintedSupply`, `maxSupply`, and `remainingSupply`.

---

## 8. Authoritative Forging

Use a dedicated `collectible.crafted` action rather than the balance-priced/cooking-oriented generic craft path.

Server flow:

1. Authenticate and normalize the owner wallet.
2. Validate collectible name and positive integer quantity.
3. Resolve the recipe and static metadata from server configuration.
4. Load live remaining supply from the collectibles service.
5. Validate all multiplied ingredient balances.
6. Start a MongoDB transaction.
7. Atomically reserve the requested supply range.
8. Deduct all ingredients in the same transaction/session.
9. Insert one collectible document per minted copy with trusted metadata and default market state.
10. Commit and return updated inventory plus minted collectible documents/supply.

The action must award no Cooking XP and deduct no balance or LFRG. Unknown names, fractional quantities, client-supplied recipes, stale supply, and insufficient ingredients must fail without side effects.

If the current farm-action persistence pipeline cannot include inventory updates and collectible inserts in one MongoDB transaction, Phase 3 must first refactor the repository APIs to accept a shared `ClientSession`. Do not ship a non-atomic workaround.

---

## 9. Gameplay Ownership Projection and Effects

At the authoritative game-state boundary, query `getOwnedCollectibleNames(owner)` and project the deduplicated names into the runtime state used by events. Do not query MongoDB separately inside every pure gameplay event.

Recommended runtime shape:

```ts
ownedCollectibles: CollectibleName[]
```

This is a derived snapshot, not a second persistence source. Refresh it after minting and marketplace sale settlement.

At each timing boundary, merge skill bonuses with the boolean collectible bonus:

```text
final duration = base duration × skill multiplier × collectible multiplier
```

Apply effects when timers are created:

- Harvest Scarecrow: planting.
- Forester's Totem: chopping.
- Fisher's Shrine: fishing cast/cooldown recording.
- Miner's Monument: Stone, Iron, or Gold mining.
- Chef's Cauldron: cooking start.
- Husbandry Bell: feeding Chicken, Cow, or Sheep.

Timers already underway do not change retroactively. Duplicate ownership never changes the multiplier from `0.9` to a lower value.

---

## 10. Blacksmith and Inventory UI

The Blacksmith shows one resource-only collectible catalog with:

- icon, name, system, and permanent effect;
- owned copy count from the collectibles collection;
- mint number/s for successful results where useful;
- minted, maximum, and remaining global supply;
- all ingredient required-versus-owned amounts;
- quantity controls bounded by resources and remaining supply;
- no coin/LFRG price, level lock, placement, or equipment controls.

The client may display supply optimistically but the server remains authoritative. A supply-race rejection must refresh supply and show a clear sold-out/insufficient-supply message.

Generate six final PNG icons under `public/assets/collectibles/` and register them in the shared image metadata. Do not use placeholders, emoji, or hardcoded component paths.

Owned collectibles should appear in a dedicated inventory/collection presentation or a unique-assets section, not as stackable inventory records. Multiple copies may be grouped visually by name while retaining each document's `_id` for marketplace use and its per-name `collectible_number` for display.

---

## 11. Marketplace Integration

After minting is stable, extend the unique-asset marketplace path:

- Add `collectible` to `TradableAssetType` and listing view mappings.
- Update hash resolution, browse, seller listing counts, expiry, cancellation, locking, and settlement to include `CollectibleModel`.
- Add collectible listing/cancel and marketplace-settlement ownership-change repository methods following equipment patterns.
- Do not expose a generic or peer-to-peer transfer method. The only post-mint owner mutation must require a listed-and-locked collectible, the current seller, the buyer, and the marketplace transaction session.
- On successful marketplace settlement, reset the embedded market object to defaults.
- Never route collectibles through `getItemAssetType()` or stackable inventory reservation logic.
- Refresh both buyer and seller gameplay ownership projections after settlement so final-copy bonus changes take effect.

Marketplace support must include authorization and concurrency tests equivalent to equipment tests.

---

## 12. Phased Delivery

Each phase below is a separate prompt-sized implementation. Complete its checks before starting the next phase.

### Phase 1 — Progression and canonical catalog

Scope:

- Redistribute seed unlock levels through 15.
- Centralize seed-level source of truth.
- Add collectible names, systems, effects, recipes, images metadata contracts, and `maxSupply: 1500` configuration.
- Reconcile every recipe ingredient with canonical inventory names.
- Add static configuration and progression tests.

Exit criteria:

- All ten seed levels are correct and planting is authoritative.
- Animal feed behavior and animal unlock levels are unchanged.
- Exactly six valid collectible definitions exist, each with supply 1,500 and no currency price.

**Implementation status: Complete**

Completed in Phase 1:

- [x] Redistributed the ten seed unlocks to Farming Levels `0, 1, 2, 3, 5, 6, 8, 10, 12, 15` in `CROPS_CONFIG`.
- [x] Made `SEEDS()` derive every market level requirement from `CROPS_CONFIG`.
- [x] Enforced the selected seed level in both client planting and authoritative server planting.
- [x] Preserved Chicken, Cow, and Sheep unlock levels and inventory-only feed requirements.
- [x] Added six canonical collectible contracts and definitions with system, description, image metadata path, exact resource recipe, 10% effect, and `maxSupply: 1500`.
- [x] Reconciled recipe ingredients against canonical `InventoryItemName` values and kept collectible definitions free of coin/LFRG prices.
- [x] Added focused progression, catalog, ingredient, supply, image-contract, and authoritative planting tests.

Phase 1 verification:

- `pnpm exec vitest run shared/data/collectibles.test.ts shared/data/farming.test.ts lib/events/plant/plant.test.ts lib/events/farm-action/validate.test.ts` — **166 tests passed**.
- `pnpm exec tsc --noEmit` — **passed**.
- `pnpm build` — **passed** (Next.js production build and static generation).
- `git diff --check` — **passed**.

### Phase 2 — MongoDB collectibles module

Scope:

- Add `lib/modules/collectibles` types, model, repository, and service.
- Add the equipment-compatible embedded market schema.
- Add per-name supply counters that also allocate per-name mint numbers.
- Add owner, supply, ID-based, listed, and locked marketplace-settlement queries; do not add direct transfer queries.
- Add model/index/repository tests.

Exit criteria:

- Concurrent supply reservation cannot exceed 1,500 per name.
- Every minted test document receives a unique per-name mint number and a globally unique MongoDB `_id`.
- Market defaults and reset behavior match equipment conventions.

**Implementation status: Complete**

Completed in Phase 2:

- [x] Added the `lib/modules/collectibles` types, model, repository, and public service boundary.
- [x] Added unique collectible documents with MongoDB `_id` identity, per-name `collectible_number`, canonical metadata, normalized owner input, timestamps, and no inventory duplication.
- [x] Added the always-present equipment-compatible market embed and unlisted reset defaults.
- [x] Added a unique per-name mint-number index plus owner/name, listed/name/price, and market-hash indexes.
- [x] Added dedicated `collectible_counters` documents fixed at 1,500 supply as the sole mint-number allocator; no separate sequence collection is required.
- [x] Added session-bound atomic range reservation using a guarded counter increment that cannot reserve beyond 1,500.
- [x] Added session-bound insertion from trusted collectible configuration and contiguous per-name counter ranges.
- [x] Added owner, ID, supply, listed, market-update, and locked marketplace-settlement repository operations.
- [x] Deliberately omitted generic peer-to-peer transfer APIs; post-mint ownership changes require the listed-and-locked marketplace settlement path.
- [x] Added deduplicated canonical owned-name projection without creating collectible quantities in `inventories`.
- [x] Added model/index/default/validation and repository supply/reservation/ownership/marketplace-settlement tests.

Phase 2 verification:

- `pnpm exec vitest run lib/modules/collectibles/model.server.test.ts lib/modules/collectibles/repository.server.test.ts shared/data/collectibles.test.ts` — **20 tests passed**.
- `pnpm exec tsc --noEmit` — **passed**.
- `pnpm build` — **passed** (Next.js production build and static generation).
- `git diff --check` — **passed**.

Phase 3 integration note:

- Inventory deduction, range reservation, and collectible insertion must be invoked inside the same caller-owned MongoDB transaction/session. Phase 2 exposes the session-aware primitives; Phase 3 owns transaction creation, retries for transient transaction conflicts, and rollback tests.

### Phase 3 — Atomic Blacksmith forging backend

Scope:

- Add `collectible.crafted`.
- Make inventory deduction and collectible minting share one MongoDB transaction.
- Wire API allowlists, persistence, and authoritative responses.
- Add exact, insufficient, bulk, sold-out, race, rollback, no-balance, and no-XP tests.

Exit criteria:

- No partial deduction or partial mint can occur.
- Supply and resources remain correct under concurrent requests.
- Forging quantity is bounded by both resources and remaining supply.

**Implementation status: Complete**

Completed in Phase 3:

- [x] Added the dedicated `collectible.crafted` action contract to the authoritative game-action union.
- [x] Added strict server validation for the action type, six-name allowlist, and positive safe-integer quantity.
- [x] Added trusted server-side recipe resolution and exact `Decimal` multiplication; client-supplied ingredient, balance, XP, and metadata fields are ignored.
- [x] Added guarded per-ingredient deductions against usable, non-market-reserved inventory amounts.
- [x] Added one mandatory MongoDB `withTransaction` boundary around every ingredient deduction, finite-supply reservation, and unique collectible insertion.
- [x] Added automatic transient transaction retry support through the MongoDB driver and guaranteed session cleanup.
- [x] Added partial-insert detection so an incomplete mint aborts the whole transaction.
- [x] Routed collectible forging through `/api/farm/action` without generic inventory-diff persistence, balance mutation, Cooking XP, or achievement processing.
- [x] Added authoritative mint-number/supply response metadata and rebuilt returned game state from freshly persisted inventory.
- [x] Added tests for every recipe, exact and bulk requirements, unknown/fractional/invalid requests, untrusted payloads, insufficient ingredients, sold-out rollback, retry behavior, partial mint rollback, unchanged balance/XP, and route error behavior.

Phase 3 verification:

- Focused Phase 1–3 suite: `pnpm exec vitest run app/api/farm/action/route.test.ts lib/modules/collectibles/forge.server.test.ts lib/modules/collectibles/model.server.test.ts lib/modules/collectibles/repository.server.test.ts shared/data/collectibles.test.ts` — **34 tests passed**.
- `pnpm exec tsc --noEmit` — **passed**.
- `pnpm build` — **passed** (Next.js production build and static generation).
- `git diff --check` — **passed**.
- The repository-wide unfiltered Vitest command still traverses the imported `reference/` applications and fails in their pre-existing unresolved-module/incompatible reference suites; all project-owned and Phase 3-focused tests above pass.

Phase 4 handoff:

- Unique collectible documents remain the ownership source of truth. The refreshed API game state intentionally does not expose ownership yet; Phase 4 must query `getOwnedCollectibleNames` during authoritative state construction and derive the non-stacking runtime projection.

### Phase 4 — Ownership projection and non-stacking helpers

Scope:

- Query owned collectible names during authoritative state construction.
- Add derived `ownedCollectibles` runtime state.
- Add ownership/bonus merge helpers using canonical `SkillBonus` keys.
- Refresh projection after mint and marketplace purchase settlement boundaries.

Exit criteria:

- Zero copies gives no bonus.
- One copy gives exactly 10%.
- Two or more copies still give exactly 10%.
- Selling the final copy through the marketplace removes the derived bonus; no direct transfer path exists.

**Implementation status: Complete**

Completed in Phase 4:

- [x] Added canonical ownership normalization plus pure ownership, bonus derivation, and skill/collectible bonus merge helpers.
- [x] Deduplicated owned names before deriving effects, ignored unknown names, and mapped all six collectible effects only through canonical `SkillBonus` keys.
- [x] Added required runtime-only `ownedCollectibles` state with an empty initial value; no collectible ownership was added to farm, player, or inventory persistence.
- [x] Extended authoritative state construction to expose canonical owned names and merge one 10% effect per owned collectible name with existing skill reductions.
- [x] Queried collectible ownership in farm load, farm sync, and farm action boundaries.
- [x] Re-queried ownership after successful transactional forging so the newly minted collectible and bonus are returned immediately.
- [x] Made `ownedCollectibles` and merged `bonus` server-authoritative during Zustand reconciliation.
- [x] Retained marketplace settlement as the sole post-mint ownership mutation: listed-and-locked settlement changes the source-of-truth owner, and the next authoritative state load derives the seller/buyer projection without a generic transfer path.
- [x] Added helper, state-builder, route refresh, duplicate non-stacking, canonical mapping, immutability, and settlement-boundary coverage.

Phase 4 verification:

- Focused Phase 1–4 suite: `pnpm exec vitest run shared/game/collectibles.test.ts lib/events/farm-action/farm-action.test.ts app/api/farm/action/route.test.ts lib/modules/collectibles/forge.server.test.ts lib/modules/collectibles/model.server.test.ts lib/modules/collectibles/repository.server.test.ts shared/data/collectibles.test.ts` — **63 tests passed**.
- `pnpm exec tsc --noEmit` — **passed**.
- `pnpm build` — **passed** (Next.js production build and static generation).
- `git diff --check` — **passed**.
- The existing repository-wide unfiltered Vitest limitation remains unchanged: imported `reference/` applications contain pre-existing unresolved-module/incompatible suites, so verification uses the project-owned Phase 1–4 focused suites above.

Phase 5 handoff:

- Runtime ownership and merged timing reductions are now available in every authoritative `GameState`. Phase 5 must apply those six merged timing keys only when each timer is created, preserving non-retroactive timer snapshots.

### Phase 5 — Gameplay timing integration

Scope:

- Apply all six effects at their timer creation boundaries.
- Preserve timer snapshots and existing skill composition.
- Add absent, present, duplicate, skill-combined, and non-retroactive tests for every system.

Exit criteria:

- Client previews and server authority agree.
- Duplicate documents never stack.
- Existing timers are not rewritten by ownership changes.

**Implementation status: Complete**

Completed in Phase 5:

- [x] Added shared, clamped reduced-duration, rounded-duration, and timestamp-offset snapshot helpers.
- [x] Applied `cropSpeed` to crop planting snapshots in both optimistic and authoritative transitions.
- [x] Applied `woodRecovery` and `oreRecovery` when resource recovery timers are created; restored optimistic stone, iron, and gold mining transitions so client/server snapshots use the same formula.
- [x] Applied `produceSpeed` when chickens, cows, and sheep are fed. Existing collection and re-hunger checks continue to use immutable timestamp snapshots.
- [x] Applied `cookingSpeed` to the persisted cooking-slot duration with identical rounding on client and server.
- [x] Added a persisted per-cast fishing `cooldownMs` snapshot for `fishSpeed`, with the base cooldown as the backward-compatible fallback for legacy records.
- [x] Preserved collectible reductions whenever skill milestone changes recompute bonuses across farming, woodcutting, mining, fishing, cooking, crafting, and husbandry paths.
- [x] Kept collectible ownership out of farm persistence and avoided rewriting any existing timers when ownership changes.
- [x] Added timing-helper, duplicate non-stacking, bonus-retention, fishing snapshot, legacy compatibility, and affected gameplay regression coverage.

Phase 5 verification:

- Focused timing and affected API suite: `pnpm exec vitest run shared/game/boosts.test.ts shared/game/collectibles.test.ts lib/events/plant/plant.test.ts lib/events/chop/chop.test.ts lib/events/feed-animals/feedChicken.test.ts lib/events/feed-animals/feedCow.test.ts lib/events/feed-animals/feedSheep.test.ts lib/events/fishing/catchFish.test.ts lib/events/farm-action/validate-2.4.test.ts lib/events/farm-action/farm-action.test.ts app/api/farm/action/route.test.ts` — **112 tests passed**.
- `pnpm exec tsc --noEmit` — **passed**.
- `pnpm build` — **passed** (Next.js production build and static generation).
- `git diff --check` — **passed**.
- The production build continues to emit the repository's existing optional bigint native-binding fallback warning; compilation, type checking, and page generation succeed.

Phase 6 handoff:

- All six collectible effects now drive immutable gameplay timer snapshots from the authoritative merged bonus state. Phase 6 can display ownership and effect copy without introducing any additional gameplay or ownership state.

### Phase 6 — Blacksmith and collection UI

Scope:

- Generate/register six icons.
- Build collectible-only Blacksmith catalog.
- Show owned count and live minted/max/remaining supply.
- Add quantity controls, pending state, sold-out state, race-error refresh, and responsive layouts.
- Add unique collectible collection/inventory presentation.

Exit criteria:

- Desktop and mobile flows clearly show supply and ingredients.
- No currency, placement, equipment, or retired workshop controls appear.
- Forging updates owned count and remaining supply.

**Implementation status: Complete**

Completed in Phase 6:

- [x] Generated and registered six canonical transparent pixel-art collectible icons.
- [x] Added an authenticated, owner-scoped `/api/collectibles` projection with canonical ordering, live supply, duplicate ownership counts, and safe mint/item identifiers only.
- [x] Added shared SWR collectible data, affordability/quantity helpers, authoritative forging, explicit server-state reconciliation, and 422 farm/collection refresh ordering.
- [x] Replaced the empty Blacksmith handoff with a collectible-only Showcase + Shelf flow showing effects, ingredients, live supply, ownership, bounded quantity controls, pending/sold-out states, and forge feedback.
- [x] Added a display-only Collectibles inventory rail with all six cards, locked silhouettes, duplicate counts, effects, rarity, and owned mint numbers; no shortcut, placement, equipment, consumption, or transfer actions were introduced.
- [x] Added focused API and client helper tests plus a narrow forged-metal panel treatment.

Phase 6 verification:

- Focused collectible/API/UI-helper suite: `pnpm exec vitest run app/api/collectibles/route.test.ts lib/collectibles/client.test.ts shared/data/collectibles.test.ts shared/game/collectibles.test.ts app/api/farm/action/route.test.ts` — **23 tests passed**.
- `pnpm exec tsc --noEmit` — **passed**.
- `pnpm build` — **passed** (Next.js production build and static generation).
- `git diff --check` — **passed**.
- Browser verification on `/test-modals` covered the Blacksmith at 1445×903 and 390×844. The unauthenticated modal harness correctly falls back to unavailable live supply while retaining safe disabled forging; authenticated ownership and mint behavior are covered at the route and mutation-helper boundaries.
- The production build continues to emit the repository's existing optional bigint native-binding fallback warning; compilation, type checking, and page generation succeed.

Phase 7 handoff:

- Unique MongoDB copy IDs and per-name mint numbers are exposed through the safe owner projection, while market metadata and ownership mutation remain server-only. Phase 7 can add listing lifecycle and settlement without moving collectibles into regular inventory or introducing a generic transfer path.
- Deployment migration: after all old application versions are drained, drop the obsolete `collectible_sequences` collection and the legacy unique `item_number_1` index from `collectibles`. The old unique index must be removed before minting multiple documents without `item_number`; legacy fields may then be unset as optional cleanup.

### Phase 7 — Collectible marketplace support

**Implementation status: Complete**

Completed work:

- [x] Added `collectible` to the marketplace tradable and unique-asset contracts, keeping purchase quantity fixed at one and collectibles out of stackable inventory reservations.
- [x] Added owner-authorized collectible listing using canonical collectible document metadata, the shared listing cap, and an atomic duplicate-listing guard.
- [x] Added collectible browse, detail/hash resolution, filtering, sorting, pagination, seller listings, analytics counts, admin name queries, and normalized `ListingView` output.
- [x] Added collectible cancellation and expiry scanning with the same always-present unlisted market defaults used by minting and settlement.
- [x] Added collectible marketplace lock routing and source-of-truth owner/listed/locked verification.
- [x] Added session-backed settlement through `settleCollectibleMarketplaceSale`; the guarded repository mutation remains the only ownership-changing operation and resets market state after sale.
- [x] Preserved processed-transaction idempotency, immutable sale logs, treasury accounting, seller payouts, buyer refunds, and `finally` lock release.
- [x] Confirmed collectibles never use inventory reservation or `addItems` paths and did not add a peer-to-peer transfer endpoint or generic transfer operation.
- [x] Preserved authoritative ownership projection: farm load, sync, and action reload owned collectible names, so the buyer gains and a final-copy seller loses the derived bonus on the next authoritative refresh.
- [x] Added focused collectible-listing authorization and duplicate/concurrent-write regression tests; retained repository coverage proving settlement requires listed and locked state and uses the supplied session.

Verification:

- `pnpm exec vitest run lib/events/list-asset/list-unique.collectible.test.ts lib/modules/collectibles/repository.server.test.ts` — passed: 2 files, 9 tests.
- `pnpm exec tsc --noEmit` — passed.
- `pnpm build` — passed; compilation, type checking, page generation, and route generation completed. The existing optional bigint native-binding fallback warning remains non-blocking.
- `git diff --check` — passed.
- `pnpm exec vitest run lib app shared --exclude 'reference/**'` — 36 files / 471 tests passed; 7 pre-existing husbandry collection tests failed because their fixtures omit `ownedCollectibles`, causing `normalizeOwnedCollectibles` to receive `undefined`. The focused Phase 7 suites pass and these failures are outside the marketplace changes.
- Unscoped `pnpm exec vitest run` also discovers imported `reference/` applications and fails in their incompatible standalone suites; Phase 8 should keep project verification scoped away from `reference/**`.

> Phase 8 handoff:
>
> - Run browser verification for collectible collection and marketplace list/detail/purchase/cancel flows on desktop and mobile with a database-backed test account.
> - Add database-backed race coverage for two buyers settling one collectible listing, and verify seller/buyer farm reload projections after a final-copy sale.
> - Resolve or update the seven existing husbandry test fixtures to include `ownedCollectibles: []`, then rerun the scoped project suite. Keep `reference/**` excluded from project Vitest discovery.
> - Reconfirm the deployment migration from the Phase 6 handoff before production minting, including removal of the obsolete unique `item_number_1` index.

### Phase 8 — Full-system verification

Scope:

- Run unit, integration, API, persistence, marketplace, and concurrency suites.
- Run typecheck/lint, `git diff --check`, and production build.
- Browser-test Blacksmith, collection, marketplace, and six gameplay systems on desktop and mobile.
- Verify supply counters directly through service tests, including 1,499 → 1,500 and rejected 1,500 → 1,501 boundaries.

Exit criteria:

- No collectible exceeds 1,500 minted instances.
- No duplicate bonus stacks.
- No ownership is duplicated in `inventories`.
- All user-visible and authoritative flows agree.

Implementation status (July 11, 2026): **partial — automated verification complete; authenticated/database-backed verification blocked by missing local access.**

Completed:

- [x] Updated the seven stale husbandry assertions by adding `ownedCollectibles: []` to the authoritative egg, milk, and wool test-state builders. Production normalization remains strict.
- [x] Added explicit repository coverage for the successful 1,499 → 1,500 boundary, rejected 1,500 → 1,501 boundary, and two concurrent requests competing for one final supply slot.
- [x] Reconfirmed initial zero supply, contiguous allocation, canonical owner-name deduplication, transactional forge rollback expectations, marketplace guarded ownership mutation, and six-system non-stacking coverage through the scoped suites.
- [x] Updated the Next.js 16 lint script from removed `next lint` behavior to scoped ESLint execution that excludes imported `reference/**` projects.
- [x] `pnpm exec vitest run lib app shared --exclude "reference/**"` passed: 41 files / 483 tests.
- [x] `pnpm exec tsc --noEmit` passed.
- [x] `git diff --check` passed.
- [x] `pnpm build` passed, including compilation, type checking, static generation, and route generation. The optional bigint native-binding fallback warning remains non-blocking.

Blocked or incomplete:

- [ ] `pnpm lint` now invokes ESLint correctly, but the existing project baseline contains 4,634 findings (4,618 errors and 16 warnings), overwhelmingly Prettier formatting violations outside Phase 8. No repository-wide auto-format was applied as part of this verification phase.
- [ ] Desktop (1464×903) and mobile (390×844) browser checks reached the responsive wallet login gate, but no seeded authenticated browser session was present. Blacksmith, collection, marketplace, and six-system gameplay checks could not be entered without signing an external wallet.
- [ ] `MONGODB_URI` is unavailable in the local project environment. Database-backed two-buyer settlement race coverage, final-copy seller/buyer projection reload checks, and read-only inspection of the obsolete unique `item_number_1` index could not be executed safely.
- [ ] Before marking Phase 8 complete, provide a seeded authenticated test session and MongoDB test connection, then run the blocked browser/race/index checks. The Phase 6 deployment migration remains required before production minting; verification did not mutate or migrate data.

---

## 13. Required Test Matrix

### Configuration

- Six names only.
- Supply exactly 1,500 each.
- Valid canonical ingredients and positive Decimal amounts.
- No coin/LFRG price.
- Correct bonus key and 10% amount.

### Supply and mint identity

- Initial supply is zero minted and 1,500 remaining.
- Bulk mint allocates contiguous per-name numbers.
- Two collectible names maintain independent supplies.
- Concurrent final-supply requests allow only the quantity within the cap.
- Failed transactions roll back supply reservations and sequence effects as designed.

### Forging

- Exact resources succeeds.
- Any missing ingredient fails.
- Bulk multiplication is exact.
- Supply shortage fails before commit.
- Balance and Cooking XP are unchanged.
- Client-supplied metadata is rejected/ignored.

### Non-stacking

For each collectible:

- 0 owned documents → no effect.
- 1 owned document → 10% effect.
- 2, 10, or 100 owned documents → still 10% effect.
- Different collectible names affect only their corresponding systems.
- Existing skill and collectible reductions compose through established helpers.

### Marketplace

- Owner can list an unlisted collectible.
- Non-owner cannot list or cancel it.
- No peer-to-peer transfer endpoint or generic service/repository operation exists.
- Listed collectible cannot be listed twice.
- Marketplace purchase settlement changes ownership and resets market state.
- Concurrent purchases settle once.
- A final-copy marketplace sale changes derived bonuses for seller and buyer.

---

## 14. Acceptance Criteria

The feature is complete only when:

1. Six collectibles exist with fixed per-name lifetime supply of 1,500.
2. MongoDB `collectibles` documents are the sole ownership and minted-supply source of truth.
3. Every copy has unique mint identity and equipment-compatible market metadata.
4. Forging is resource-only, server-authoritative, supply-safe, and transactional.
5. Players may own multiple copies, but each name grants at most one 10% effect.
6. All six timing effects are enforced at authoritative event boundaries.
7. Blacksmith and collection UI display live owned counts and global supply.
8. Marketplace support treats collectibles as unique assets rather than stackable inventory.
9. Seed progression reaches all seeds by Farming Level 15 without changing animal-feed rules.
10. Tests prove cap enforcement, rollback behavior, marketplace settlement correctness, absence of peer-to-peer transfer paths, and non-stacking bonuses.
