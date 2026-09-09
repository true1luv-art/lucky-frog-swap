# TerraCore — Complete Game Mechanics Documentation

> **Source:** Live smart-contract source code in `reference/TerraCore-Smart-Contract`
> Cross-referenced against every service file: `smart-contract/`, `nft/`, `hive-engine/`, `lb-rewards/`, and `shared/`.
>
> TerraCore is a post-apocalyptic blockchain strategy game built on the **HIVE blockchain** and **Hive Engine** sidechain. Players mine $SCRAP, raid each other's stashes, explore planets, open NFT crates, and complete quests — all governed by on-chain smart contracts writing to MongoDB.

---

## Table of Contents

1. [Blockchain Architecture & Process Model](#1-blockchain-architecture--process-model)
2. [MongoDB Collections (Data Model)](#2-mongodb-collections-data-model)
3. [Registration & Account Setup](#3-registration--account-setup)
4. [Tokens: $SCRAP & $FLUX](#4-tokens-scrap--flux)
5. [Player Stats & Schema](#5-player-stats--schema)
6. [Mining ($SCRAP Generation)](#6-mining-scrap-generation)
7. [Claiming $SCRAP](#7-claiming-scrap)
8. [Stat Upgrade Costs](#8-stat-upgrade-costs)
9. [PvP Battles & Combat](#9-pvp-battles--combat)
10. [Boss Fights & Planetary Exploration](#10-boss-fights--planetary-exploration)
11. [NFTs: Crates, Items & Relics](#11-nfts-crates-items--relics)
12. [Crate Opening — Item Generation](#12-crate-opening--item-generation)
13. [Equipping & Unequipping Items](#13-equipping--unequipping-items)
14. [Salvaging NFT Items for $FLUX](#14-salvaging-nft-items-for-flux)
15. [Item Forging (Upgrading)](#15-item-forging-upgrading)
16. [Quests — Start](#16-quests--start)
17. [Quests — Collect (Reward Calculation)](#17-quests--collect-reward-calculation)
18. [Quest Board Generation](#18-quest-board-generation)
19. [Quest Oracle (Dynamic Pricing)](#19-quest-oracle-dynamic-pricing)
20. [Leaderboard Rewards](#20-leaderboard-rewards)
21. [Economy: $SCRAP & $FLUX Flow](#21-economy-scrap--flux-flow)
22. [Staking & Stash Size](#22-staking--stash-size)
23. [NFT Marketplace](#23-nft-marketplace)
24. [Consumables](#24-consumables)
25. [Deterministic RNG System](#25-deterministic-rng-system)
26. [lb-rewards 15-Minute Cycle](#26-lb-rewards-15-minute-cycle)
27. [Custom JSON Operation Reference](#27-custom-json-operation-reference)
28. [API Reference](#28-api-reference)
29. [Experience & Leveling](#29-experience--leveling)

---

## 1. Blockchain Architecture & Process Model

TerraCore runs across two blockchain layers processed by a **single unified Node.js process**:

| Layer | Purpose |
|---|---|
| **Hive L1** | Registration (HIVE transfer), battles, claims, quest collect, NFT marketplace, crate opens, equip/unequip, salvage, consumable use |
| **Hive Engine (L2)** | Stat upgrades (engineering/damage/defense), favor contribution, boss fights (FLUX burn), crate purchases (SCRAP burn), item forging (FLUX send), quest starts (SCRAP burn) |

All game state (player stats, stashes, items, quests, relics, boss logs) is stored in **MongoDB** (`terracore` database). On-chain broadcasts are only used for token issuance (`issue`) and irreversible actions.

### Services

| Service | Stream | Handles |
|---|---|---|
| `smart-contract` | Hive L1 (3s self-paced block poller) | Registration, claims, battles, quest collect |
| `nft` | Hive L1 (shared stream) | Marketplace list/buy/cancel/transfer, crate opens, equip, unequip, salvage, combine relics, use consumable |
| `hive-engine` | Hive Engine SSC stream | Upgrades, favor, crate buys, boss fights, item forges, quest starts, SCRAP stake events |
| `lb-rewards` | Timer loop (15 min) | FLUX management, SWAP.HIVE withdrawal, leaderboard reward distribution, revenue distribution, quest oracle, quest board generation, quest expiry cleanup |

### Process Architecture

All four services share **one MongoDB connection** and run as coroutines in a single Node.js process (`services/app.js`). A unified heartbeat kills the process (triggering PM2 restart) if either stream is silent > 30 seconds. Node lists for both L1 and HE are refreshed from beacon every 30 minutes.

```
app.js
├── startL1Stream()      → polls getBlock every 3s; feeds scHandleOp + nftHandleOp
├── startHEStream(node)  → SSC.stream(); feeds heHandleOp
├── runLbRewards()       → infinite loop: runCycle() → sleep(900s)
└── heartbeat            → process.exit() if L1 or HE silent > 30s
```

Each service has its own **queue** (`queue.js`) that serializes DB writes to prevent concurrent modification races.

---

## 2. MongoDB Collections (Data Model)

| Collection | Description |
|---|---|
| `players` | One document per player — all stats, scrap, items, consumables, boss data |
| `stats` | Global stats + daily rollup docs (`date: 'global'`, `date: 'YYYY-MM-DD'`) |
| `price_feed` | Single global doc (`date: 'global'`) — fees, crate prices, quest multiplier, oracle state |
| `items` | All minted NFT items with attributes, owner, level, salvaged flag |
| `crates` | Minted crates (pre-open) with owner and rarity |
| `crate-count` | Single doc `{supply:'total', count:N}` — monotonically increasing item number |
| `relics` | Per-user, per-type relic amounts (e.g. `common_relics`, `legendary_relics`) |
| `consumables` | Per-user, per-type consumable amounts |
| `active-quests` | Currently running and recently completed quests |
| `quest-board` | Today's board (`date`, `slots[]`) — one document total |
| `quest-templates` | Static template pool queried when building the daily board |
| `quest-log` | Immutable audit log of quest start/complete events |
| `battle_logs` | Immutable battle outcome log |
| `boss-log` | Boss fight results (hit/miss, roll, luck, drop) |
| `forge-log` | Item forge log |
| `salvage-log` | Item salvage log |
| `hashes` | HE replay-dedup store (trxId → processed) |
| `registrations` | Processed registration hashes |
| `referrers` | Referral payment log |
| `claims` | Claim event log |
| `nft-drops` | All minted items/crates/relics (for analytics) |
| `planet-config` | Overridable planet configuration (TTL-cached 5 min in `boss.js`) |
| `marketplace` / `marketplace-logs` | Listing and purchase history |

---

## 3. Registration & Account Setup

**Trigger:** Player sends HIVE to `@terracore` with a JSON memo:

```json
{ "hash": "terracore_register-{uniqueHash}", "referrer": "referrer_username" }
```

**Source:** `services/smart-contract/lib/registration.js → register()`

### Registration Flow

```
1. Parse memo → extract hash and referrer
2. Fetch price_feed.registration_fee (in HIVE) and price_feed.referral_fee
3. Validate: amount >= registration_fee
4. Check: player not already registered
5. insertOne() into players with default stats
6. Increment stats.global.players + stats.today.players
7. If referrer valid (not 'terracore', not self): pay referral_fee HIVE to referrer
```

### Default Player Document (on registration)

```js
{
  username,
  favor:            0,
  scrap:            1,           // starting stash (in SCRAP)
  health:           10,
  damage:           10,          // raw stat (stored as integer, increments of 10)
  defense:          10,          // raw stat (stored as integer, increments of 10)
  engineering:      1,           // raw engineering level
  cooldown:         Date.now(),  // last scrap reset time (for mining calc)
  minerate:         0.0001,      // legacy field; actual rate computed from engineering
  attacks:          3,
  lastregen:        Date.now(),
  claims:           3,
  lastclaim:        Date.now(),
  registrationTime: Date.now(),
  lastBattle:       Date.now(),
  stats: {
    damage:      10,
    defense:     10,
    engineering: 1,
    dodge:       0,
    crit:        0,
    luck:        0,
  },
  consumables: {
    protection:       0,
    protection_times: [],
    focus:            0,
  },
  hiveEngineStake:  0,
  items:            {},          // keyed by item type: weapon, armor, ship, special, avatar
}
```

**New User Protection:** Cannot be raided for the first **24 hours** (`registrationTime` check: `Date.now() - target.registrationTime < 86400000`).

**Referral System:** Valid referrer (not `terracore`, not self, not undefined) receives `referral_fee` (HIVE amount from `price_feed`) immediately via HIVE transfer.

---

## 4. Tokens: $SCRAP & $FLUX

### $SCRAP (`SCRAP`)

| Property | Value |
|---|---|
| Blockchain | Hive Engine |
| Role | Primary in-game currency — mined, spent, staked |
| Minted via | Player `claim` (HE `issue` action) |
| Traded on | Tribaldex (SCRAP/SWAP.HIVE) |

**$SCRAP is minted** (`issue` to player) only on successful `claim`. It accumulates passively in-game based on Engineering. Unclaimed stash can be stolen by raiders.

**$SCRAP is permanently burned (sent to `null`):**
- Engineering upgrades
- Damage upgrades
- Defense upgrades
- Favor contributions
- Quest starts
- Crate purchases

**$SCRAP is locked (staked, not burned):**
- Hive Engine stake via Tribaldex (recoverable, stored as `hiveEngineStake`)

**lb-rewards cycle** also purchases SCRAP from the DEX with half of the SWAP.HIVE balance (buyback) and distributes leaderboard rewards from `@terracore`'s SCRAP balance.

---

### $FLUX (`FLUX`)

| Property | Value |
|---|---|
| Blockchain | Hive Engine |
| Role | Boss fight fuel / item forging |
| Produced via | Salvaging NFT items (HE `issue` action to player) |
| Burned via | Boss fights (burn to `null`), item forges (send to `@terracore`) |
| Traded on | Tribaldex (FLUX/SWAP.HIVE) |

$FLUX is a closed-loop currency. The lb-rewards cycle also manages `@terracore`'s FLUX balance: **25% of any balance > 5 FLUX is burned** (`null`); the remaining 75% is placed as 10 sell orders on the DEX at 2–20% above the highest bid.

---

## 5. Player Stats & Schema

Every player has the following stats. Some live on the root document and some on `stats`:

| Stat | Document Field | Notes |
|---|---|---|
| Engineering | `engineering` (root) AND `stats.engineering` | Root = raw upgrade level; `stats.engineering` updated by API |
| Damage | `damage` (root) AND `stats.damage` | Root stored as multiple of 10 (starts at 10) |
| Defense | `defense` (root) AND `stats.defense` | Same as damage |
| Dodge | `stats.dodge` | Item-only stat — cannot be directly upgraded |
| Crit | `stats.crit` | Item-only stat — cannot be directly upgraded |
| Luck | `stats.luck` | Item-only stat — cannot be directly upgraded |
| Stash Size | `hiveEngineStake` | `stashSize = hiveEngineStake + 1` |
| Favor | `favor` | Controls planet access |
| Attacks | `attacks` | Current charges (max 8, decays with inactivity) |
| Claims | `claims` | Current charges (max 5) |
| Scrap | `scrap` | Currently accumulated in-game scrap (not yet claimed) |
| Cooldown | `cooldown` | Timestamp of last scrap reset (claim or battle) |
| Experience | `experience` | XP gained from upgrades, battles, quests |
| Level | `level` | Derived from experience (used for quest tier gating) |
| Boss Data | `boss_data[]` | Array of `{name, level, lastBattle}` per planet |
| Last Upgrade Time | `last_upgrade_time` | Resets mine decay timer (upgrades, quests, boss fights, forges) |
| Last Payout | `lastPayout` | Prevents concurrent claims (30s lockout) |
| Last Reward Time | `lastRewardTime` | Prevents duplicate leaderboard payouts |

**Note on `stats.*` vs root fields:** The smart contract uses `user.stats.damage`, `user.stats.defense`, etc. for combat and quest checks. The API writes equipped item bonuses into `player.stats` at read time. The raw upgrade values live on `user.damage`, `user.defense`, `user.engineering` (root) and the HE upgrade handler writes both the root field and `stats.*`.

---

## 6. Mining ($SCRAP Generation)

**Source:** `shared/mining.js`

### Engineering Softcap

```js
const ENG_SOFTCAP      = 333;
const ENG_SOFTCAP_RATE = 0.5;
```

Above Engineering level 333, each additional level contributes only **50% of normal** income gain. This is calibrated so a player doing 5×T5 quests daily is exactly break-even at Engineering 333.

### Base Mine Rate Formula

```js
// shared/mining.js → computeMineRate(engineeringLevel, lastUpgradeTime)

function computeMineRate(engineeringLevel, lastUpgradeTime) {
    // Apply softcap
    const effective = engineeringLevel > ENG_SOFTCAP
        ? ENG_SOFTCAP + (engineeringLevel - ENG_SOFTCAP) * ENG_SOFTCAP_RATE
        : engineeringLevel;

    // Mine rate targets "can afford next upgrade in 48h"
    const nextUpgradeCost   = Math.pow(effective + 1, 2);
    const timeToNextUpgrade = 48 * 60 * 60;           // 48 hours in seconds
    const baseRate          = nextUpgradeCost / timeToNextUpgrade;

    return baseRate * computeDecayMultiplier(lastUpgradeTime);
}
```

**Key properties:**
- Mine rate scales with `(effectiveEngineering + 1)²`
- Softcap: Engineering > 333 contributes at 50% per level
- Rate in SCRAP/second; multiply by seconds elapsed to get SCRAP accumulated

### Mine Rate Examples (no decay)

| Engineering | SCRAP/day (approx) |
|---|---|
| 1 | ~3.0 |
| 5 | ~18.0 |
| 10 | ~55 |
| 25 | ~330 |
| 50 | ~1,300 |
| 100 | ~5,200 |
| 333 | ~(peak, undecayed) |

### Mine Rate Decay

To discourage idle accounts, `computeDecayMultiplier` reduces mine rate if no **sink action** has occurred recently.

**Sink actions (reset `last_upgrade_time`):**
- Engineering / Damage / Defense upgrade
- Quest start
- Boss fight
- Item forge
- Crate purchase (also resets)

**NOT sinks:** battles, claims

```js
// shared/mining.js → computeDecayMultiplier(lastUpgradeTime)

function computeDecayMultiplier(lastUpgradeTime) {
    if (lastUpgradeTime == null) return 1.0;
    const daysSince = Math.max(0, (Date.now() - lastUpgradeTime) / 86400000);

    if (daysSince <= 14) return 1.0;                   // 14-day grace period

    const weeks = Math.floor((daysSince - 14) / 7);
    return Math.max(Math.pow(0.90, weeks), 0.25);       // -10%/week, floor 25%
}
```

| Days Since Last Sink | Multiplier |
|---|---|
| 0–14 | 1.00 (100%) |
| 14–21 | 0.90 (90%) |
| 21–28 | 0.81 (81%) |
| 28–35 | 0.73 (73%) |
| 35–42 | 0.66 (66%) |
| 84+ | 0.25 (25% floor) |

### Current Stash Calculation

```js
// shared/mining.js → computeCurrentScrap(user)

function computeCurrentScrap(user) {
    const mineRate       = computeMineRate(user.stats?.engineering || 0, user.last_upgrade_time);
    const stashsize      = (user.hiveEngineStake || 0) + 1;
    const secondsElapsed = Math.max((Date.now() - (user.cooldown || Date.now())) / 1000, 0);
    const accumulated    = (user.scrap || 0) + mineRate * secondsElapsed;
    return Math.min(accumulated, stashsize);            // capped at stash size
}
```

The stash is hard-capped at `hiveEngineStake + 1`. Once full, no more SCRAP accumulates until the player claims or is raided.

---

## 7. Claiming $SCRAP

**Source:** `services/smart-contract/lib/claims.js → claim()`

**Trigger:** `terracore_claim` custom JSON on Hive L1.

### Claim Charges

```js
// claims.js → computeCurrentClaims(user)

function computeCurrentClaims(user) {
    const stored       = user.claims   || 0;
    const hoursSince   = Math.floor((Date.now() - (user.lastclaim || 0)) / 3600000);
    const regenAmount  = Math.floor(hoursSince / 4);    // 1 claim per 4 hours
    const current      = Math.min(stored + regenAmount, 5); // max 5 charges
    const newLastclaim = regenAmount > 0
        ? (user.lastclaim || 0) + regenAmount * 4 * 3600000
        : (user.lastclaim || 0);
    return { current, newLastclaim };
}
```

- Maximum claim charges: **5**
- Regeneration: **1 per 4 hours**
- Minimum cooldown between claims: **30 seconds** (`lastPayout` gate: `lastPayout < now - 30000`)

### Claim Process (Atomic)

```
1. computeCurrentClaims(user) → ensure currentClaims > 0
2. computeCurrentScrap(user) → qty to mint
3. findOneAndUpdate with { lastPayout: { $lt: now - 30000 } }
   → atomically: scrap=0, cooldown=now, lastPayout=now, claims-=1
   → if update returns null → concurrent claim rejected
4. hive.broadcast.customJson → HE 'issue' {symbol:'SCRAP', to: username, quantity: qty}
5. If broadcast fails → revert the atomic reserve (restore previous state)
6. Log to 'claims' collection
```

The atomic reserve-before-broadcast pattern prevents double-minting from concurrent claim operations.

---

## 8. Stat Upgrade Costs

**Source:** `services/hive-engine/lib/upgrades.js`

**Trigger:** Player burns SCRAP to `null` on Hive Engine with memo identifying the upgrade type.

All upgrades also:
- Set `last_upgrade_time = Date.now()` (resets mine decay timer)
- Add `experience += cost` (XP equal to SCRAP cost)
- Increment `version` (optimistic concurrency)

Uses retry-with-backoff (up to 5 attempts, starting 500ms, factor 2.5×).

### Engineering Upgrade

```js
// upgrades.js → engineering(username, quantity)

let cost       = Math.pow(user.engineering, 2);   // current level squared
let newEngineer = user.engineering + 1;            // +1 per upgrade
```

**Formula:** `cost = currentEngineeringLevel²`

| Engineering Level | Cost to Next |
|---|---|
| 1 | 1 SCRAP |
| 5 | 25 SCRAP |
| 10 | 100 SCRAP |
| 20 | 400 SCRAP |
| 50 | 2,500 SCRAP |
| 100 | 10,000 SCRAP |
| 333 | 110,889 SCRAP |

---

### Damage Upgrade

```js
// upgrades.js → damage(username, quantity)

let cost      = Math.pow(user.damage / 10, 2);    // (damage/10) squared
let newDamage = user.damage + 10;                  // +10 per upgrade
```

**Formula:** `cost = (currentDamage / 10)²`

| Damage (stored) | Cost to Next |
|---|---|
| 10 | 1 SCRAP |
| 20 | 4 SCRAP |
| 50 | 25 SCRAP |
| 100 | 100 SCRAP |
| 200 | 400 SCRAP |
| 500 | 2,500 SCRAP |

---

### Defense Upgrade

```js
// upgrades.js → defense(username, quantity)

let cost       = Math.pow(user.defense / 10, 2);  // identical to damage formula
let newDefense = user.defense + 10;
```

**Formula:** `cost = (currentDefense / 10)²` — identical to Damage.

---

### Favor Contribution

```js
// upgrades.js → contribute(username, quantity)

let newFavor = user.favor + qty;                   // 1:1 SCRAP → Favor
// Also: globalFavorUpdate(qty) increments stats.global.currentFavor
```

- **Formula:** 1 SCRAP burned = 1 Favor gained, permanently
- Resets no decay timer (contributing is not a sink)
- Adds `experience += qty`

---

## 9. PvP Battles & Combat

**Source:** `services/smart-contract/lib/combat.js → battle()`

**Trigger:** `terracore_battle` custom JSON on Hive L1 with `{ "target": "username" }`.

### Attack Charges

```js
// combat.js → computeCurrentAttacks(user)

function computeCurrentAttacks(user) {
    const stored       = user.attacks    || 0;
    const maxAtks      = 8;
    const daysSince    = Math.floor((Date.now() - (user.last_upgrade_time || 0)) / (3600000 * 24));
    const weeksDecay   = Math.floor(daysSince / 5);          // -1 per 5 days inactive
    const effectiveMax = Math.max(1, maxAtks - weeksDecay);  // floor at 1

    const hoursSince   = Math.floor((Date.now() - (user.lastregen || 0)) / 3600000);
    const regenAmount  = Math.floor(hoursSince / 4);         // 1 attack per 4 hours
    const current      = Math.min(stored + regenAmount, effectiveMax);
    const newLastregen = regenAmount > 0
        ? (user.lastregen || 0) + regenAmount * 4 * 3600000
        : (user.lastregen || 0);
    return { current, newLastregen };
}
```

- Base maximum: **8 attacks**
- Regeneration: **1 per 4 hours**
- Inactive decay: -1 effective max per **5 days** since last sink, minimum 1
- Log in at least every **32 hours** to avoid wasting regen

### Combat Prerequisites

For an attack to proceed past the prerequisite check, **all** must be true:
1. `currentAttacks > 0`
2. `user.stats.damage > target.stats.defense` **OR** attacker has an active Focus consumable
3. Target is not under new-user protection (< 24h since `registrationTime`)
4. Target does not have an active Protection consumable (< 24h since `protection_times[0]`)
5. Target not hit in the last **60 seconds** (`target.lastBattle` gate)
6. Attacker is not attacking themselves

### Battle Sequence

```
1. Check prerequisites (attacks > 0, damage > defense, protections, cooldowns)
2. createSeed(blockId, trxId, timestamp)  →  deterministic seed
3. rollAttack(user, seed)                 →  percentage of stash to steal
4. checkDodge(target, seed)              →  target may evade (unless Focus active)
5. Apply stash cap to scrapToSteal
6. bulkWrite (atomic): update both player docs simultaneously
```

### Step 1 — Dodge Check

```js
// combat.js → checkDodge(_target, seed)

function checkDodge(_target, seed) {
    const rng  = seedrandom(seed + '-dodge');
    const roll = Math.floor(rng() * 100) + 1;   // integer 1–100
    return roll <= _target.stats.dodge;          // true = attack misses
}
```

- Roll: integer 1–100
- If `roll ≤ target.dodge` → attack completely negated; attacker loses 1 charge, steals nothing
- **Focus consumable bypasses dodge entirely**

### Step 2 — Roll Attack Percentage

```js
// combat.js → rollAttack(_player, seed)

function rollAttack(_player, seed) {
    const rng  = seedrandom(seed);
    const roll = rng();                                              // 0.0 – 1.0
    let steal  = roll * (100 - _player.stats.crit + 1) + _player.stats.crit;
    if (steal > 100) steal = 100;
    return steal;                                                    // % of target stash
}
```

`crit` stat raises the minimum steal percentage. With `crit = 0`, the roll is uniform 0–100%. With `crit = 50`, even a minimum roll gives ≥ 50%.

| Crit | Min Steal % | Max Steal % |
|---|---|---|
| 0 | ~0% | 100% |
| 10 | ~10% | 100% |
| 25 | ~25% | 100% |
| 50 | ~50% | 100% |

### Step 3 — Stash Cap

```js
// combat.js (inside battle())

if (scrapToSteal > targetCurrentScrap) scrapToSteal = targetCurrentScrap;
if (userCurrentScrap + scrapToSteal > staked + 1) {
    scrapToSteal = (staked + 1) - userCurrentScrap;
}
```

- `scrapToSteal` capped at target's current scrap
- Also capped so attacker's total does not exceed `hiveEngineStake + 1`
- If attacker stash is already full → steals 0 SCRAP

### Step 4 — Atomic bulkWrite

Both player documents are updated simultaneously using `bulkWrite` with version-based optimistic concurrency. If the write modifiedCount ≠ 2, the system retries up to 3 times with 700ms delay (factor 1.2×), re-reading fresh state each time.

```js
const bulkOps = [
    { updateOne: { filter: { username: _target,   version: target.version },
                   update: { $set: { scrap: newTargetScrap, cooldown: now, lastBattle: now }, $inc: { version: 1 } } } },
    { updateOne: { filter: { username: username,  version: user.version },
                   update: { $set: { scrap: newScrap, cooldown: now, attacks: currentAttacks-1, lastregen, lastBattle: now }, $inc: { version: 1 } } } }
];
```

### Combat Outcomes Summary

| Condition | Outcome |
|---|---|
| Self-attack | Rejected outright |
| Damage ≤ Defense (no Focus) | No action, no charge consumed |
| Target has new-user protection | 0 stolen, 1 charge consumed |
| Target has Protection consumable | 0 stolen, 1 charge consumed |
| Target on 60s cooldown | 0 stolen, 1 charge consumed |
| Dodge roll succeeds (no Focus) | 0 stolen, 1 charge consumed |
| Attack succeeds | `roll% × targetScrap` stolen, 1 charge consumed |
| Attacker stash full | 0 stolen, 1 charge consumed |

---

## 10. Boss Fights & Planetary Exploration

**Source:** `services/hive-engine/lib/boss.js → bossFight()`

**Trigger:** Player burns FLUX to `null` on Hive Engine with memo `{ "hash": "terracore_boss_fight-...", "planet": "PlanetName" }`.

### Planet Configuration

Planet config is loaded from the `planet-config` MongoDB collection with a **5-minute TTL cache**. If the DB collection is empty, the following hardcoded fallback is used:

| Planet | FLUX Cost | Drop Thresholds (consumable / crate, out of 1001) | Rarity Thresholds (out of 1001) |
|---|---|---|---|
| Terracore | 1 | ≤900 = consumable, >900 = crate | ≤950=uncommon, ≤985=rare, ≤995=epic, ≤1000=legendary |
| Oceana | 2 | ≤750 = consumable, >750 = crate | ≤949=uncommon, ≤983=rare, ≤993=epic, ≤1000=legendary |
| Celestia | 2 | ≤750 / >750 | ≤948=uncommon, ≤982=rare, ≤992=epic, ≤1000=legendary |
| Arborealis | 2 | ≤500 / >500 | ≤947.5=uncommon, ≤981=rare, ≤991=epic, ≤1000=legendary |
| Neptolith | 2 | ≤750 / >750 | ≤947=uncommon, ≤980.5=rare, ≤990.5=epic, ≤1000=legendary |
| Solisar | 2 | ≤750 / >750 | ≤930=uncommon, ≤975=rare, ≤993=epic, ≤1000=legendary |

Higher-tier planets have lower rarity thresholds, meaning better odds of rare/epic/legendary drops.

### FLUX Cost Validation

```js
// boss.js → getExpectedFluxCost(planet)

// Reads planetConfig (with 5-min TTL refresh from planet-config collection)
// Returns cfg.flux for the planet, or null if unknown
```

The `handlers.js` validates that the FLUX quantity burned exactly matches `getExpectedFluxCost(planet)`. Mismatched amounts are silently ignored.

### Planet Access (Favor Gating)

```js
// boss.js → bossFight()

// Player must have a boss_data entry for the planet where player.level >= boss_data[i].level
let found = false;
for (let i = 0; i < user.boss_data.length; i++) {
    if (user.boss_data[i].name == _planet && level >= user.boss_data[i].level) {
        found = true; index = i;
    }
}
if (!found) return false;  // access denied
```

### Cooldown & Atomic Slot Claim

```js
// boss.js → bossFight() — atomic findOneAndUpdate

const reserved = await collection.findOneAndUpdate(
    {
        username,
        $or: [
            { [`boss_data.${index}.lastBattle`]: { $exists: false } },
            { [`boss_data.${index}.lastBattle`]: { $lt: now - 14400000 } }  // < 4 hours ago
        ]
    },
    {
        $set: { [`boss_data.${index}.lastBattle`]: now, last_upgrade_time: now },
        $inc: { version: 1, experience: 100 }
    },
    { returnOriginal: false }
);
if (!reserved.value) return false;  // already fought in last 4 hours
```

This atomically claims the cooldown slot and grants 100 XP before the fight resolves, preventing replay attacks. It also resets `last_upgrade_time` (decay timer).

### Boss Fight RNG

```js
// boss.js → bossFight()

const rng  = seedrandom(seed + '-boss');
const roll = rng() * 100;           // float 0–100

if (roll > luck) {
    // MISS → award relics
} else {
    // HIT → mint crate (calls mintCrate)
}
```

**Key mechanic:** If `roll ≤ luck` → crate drops. If `roll > luck` → relics drop. Higher Luck directly increases crate drop probability.

| Luck | Crate Drop Chance |
|---|---|
| 10 | 10% |
| 25 | 25% |
| 50 | 50% |
| 75 | 75% |
| 100 | 100% |

### On Miss — Relic Rewards

```js
let luck_mod = luck / 5;
if (_planet == 'Terracore') luck_mod = luck_mod / 2;  // Terracore gives half the relics

const minThreshold = 0.1;
const roll2 = rng() * 100;

if      (roll2 <= 70) { rarity = 'common';    amount = Math.max((rng() * 1.25 * luck_mod) + 1, 0.1); }
else if (roll2 <= 90) { rarity = 'uncommon';  amount = Math.max((rng() * 1.00 * luck_mod) + 1, 0.1); }
else if (roll2 <= 98) { rarity = 'rare';      amount = Math.max((rng() * 0.75 * luck_mod) + 1, 0.1); }
else if (roll2 <= 99) { rarity = 'epic';      amount = Math.max((rng() * 0.50 * luck_mod) + 1, 0.1); }
else                  { rarity = 'legendary'; amount = Math.max(0.1 * luck_mod, 0.1); }
amount = parseFloat(amount.toFixed(3));
```

Relic rarity distribution from boss miss:

| Roll2 Range | Relic Rarity |
|---|---|
| 0–70 | Common |
| 71–90 | Uncommon |
| 91–98 | Rare |
| 99 | Epic |
| 100 | Legendary |

Higher Luck increases the **amount** of relics awarded (via `luck_mod`), not just crate chance. Terracore planet gives half the relic amounts compared to other planets.

### On Hit — Crate Rarity Roll

```js
// boss.js → mintCrate(owner, _planet, droproll, luck, seed)

const rng   = seedrandom(seed + '-crate');
const roll  = Math.floor(rng() * 1001);   // 0–1000 → rarity determination
const roll2 = Math.floor(rng() * 1001);   // 0–1000 → consumable vs crate

const { rarity, drop } = getRarityAndDrop(_planet, roll, roll2);
```

`getRarityAndDrop` uses the planet config thresholds to map `roll` → item rarity and `roll2` → drop type.

**Drop Type Split Examples:**

| Planet | Consumable Threshold | Crate Threshold |
|---|---|---|
| Terracore | roll2 ≤ 900 | roll2 > 900 |
| Oceana/Celestia/Neptolith/Solisar | roll2 ≤ 750 | roll2 > 750 |
| Arborealis | roll2 ≤ 500 | roll2 > 500 |

If `drop == 'consumable'`: a third `rng()` call selects the consumable type from the rarity-appropriate pool (see §24).

If `drop == 'crate'`: a crate document is inserted into the `crates` collection and the `crate-count` is incremented.

---

## 11. NFTs: Crates, Items & Relics

### Rarity Tiers

| Tier | Color | Notes |
|---|---|---|
| Common | Grey | Purchasable with SCRAP; weakest stats |
| Uncommon | Green | First boss-fight reward tier |
| Rare | Blue | Significant stat improvement |
| Epic | Purple | High trade value |
| Legendary | Orange | Best stats; highest market prices |

### Crate Document Schema

```js
{
  name:         "Rare Loot Crate",
  rarity:       "rare",
  owner:        "username",
  item_number:  12345,              // globally unique monotonic ID
  image:        "https://api.terracoregame.com/images/rare_crate.png",
  equiped:      false,
  market: {
    listed: false, price: 0, seller: null, created: 0, expires: 0, sold: 0
  }
}
```

### Item Document Schema

```js
{
  name:        "Uncommon Weapon",
  type:        "weapon",            // weapon | armor | ship | special | avatar
  rarity:      "uncommon",
  owner:       "username",
  item_number: 12346,
  level:       1,                   // forge level (starts at 1)
  equiped:     false,
  salvaged:    false,
  attributes: {
    damage:      0,                 // stored as e.g. 18.4 (10× scale for weapon/armor)
    defense:     0,
    engineering: 0,
    dodge:       0,
    crit:        0,
    luck:        0,
  },
  market: { listed: false, price: 0, ... }
}
```

### Buying Crates with $SCRAP

**Source:** `services/hive-engine/lib/boss.js → buy_crate()`

**Trigger:** Burn SCRAP to `null` with memo `tm_buy_crate-{rarity}-...`

```js
// Price validation:
if (rarity === 'common') {
    expectedCost = price.price;                                 // from price_feed
} else {
    const usdTarget = price[`${rarity}_crate_usd`] ?? CRATE_USD_DEFAULTS[rarity];
    expectedCost = Math.ceil(usdTarget / price.scrap_usd);      // USD target ÷ SCRAP/USD
}
// Exact match required: parseFloat(quantity) !== expectedCost → rejected
```

| Rarity | USD Default | Notes |
|---|---|---|
| Common | ~$5 | Dynamic HIVE price from `price_feed.price` |
| Uncommon | $10 | `Math.ceil(10 / scrap_usd)` SCRAP |
| Rare | $20 | `Math.ceil(20 / scrap_usd)` SCRAP |
| Epic | $35 | `Math.ceil(35 / scrap_usd)` SCRAP |
| Legendary | — | Cannot be purchased — boss fight only |

Purchasing a crate also resets `last_upgrade_time` (counts as a sink action).

---

## 12. Crate Opening — Item Generation

**Source:** `services/nft/lib/crate-loot.js → rollItemRarity() + rollItemAttributes()`

**Trigger:** `terracore_open_crate` custom JSON on Hive L1 with `{ "crate_type": "rare" }`.

### Crate Rarity → Item Rarity Upgrade Ladder

```js
// crate-loot.js DEFAULT_LADDERS
// roll = generateRandomNumber(seed) → integer 0–99999

const DEFAULT_LADDERS = {
    common:    [
        { max: 90000, r: 'common'    },   // 90.00%
        { max: 99000, r: 'uncommon'  },   //  9.00%
        { max: 99750, r: 'rare'      },   //  0.75%
        { max: 99950, r: 'epic'      },   //  0.20%
        { max: Infinity, r: 'legendary' } //  0.05%
    ],
    uncommon:  [
        { max: 95000, r: 'uncommon'  },   // 95.00%
        { max: 99000, r: 'rare'      },   //  4.00%
        { max: 99900, r: 'epic'      },   //  0.90%
        { max: Infinity, r: 'legendary' } //  0.10%
    ],
    rare:      [
        { max: 94999, r: 'rare'      },   // 95.00%
        { max: 98999, r: 'epic'      },   //  4.00%
        { max: Infinity, r: 'legendary' } //  1.00%
    ],
    epic:      [
        { max: 97999, r: 'epic'      },   // 98.00%
        { max: Infinity, r: 'legendary' } //  2.00%
    ],
    legendary: [
        { max: Infinity, r: 'legendary' } // 100.00%
    ],
};
```

### Item Type Attribute Assignment

```js
// crate-loot.js → rollItemAttributes(type, rarity, rng)

// rarity_index: common=1, uncommon=2, rare=3, epic=4 or 5 (50/50), legendary=6

// Attribute counts per rarity:
//   Common:    1 attribute
//   Uncommon:  2 attributes
//   Rare:      3 attributes
//   Epic:      4 or 5 attributes (rng roll ≤ 50 → 4, else → 5)
//   Legendary: 6 attributes (all six)

// Slot assignment rules:
//   weapon:  first attribute is always 'damage'
//   armor:   first attribute is always 'defense'
//   ship:    first attribute is random from all six
//   special: first attribute is random from all six
//   avatar:  first attribute is random from all six
//   Additional attributes: drawn randomly from remaining pool (no repeats)
```

### Attribute Value Formula

```js
// For each chosen attribute:
let roll = rng() * (rarity_index - 0.10 * rarity_index) + 0.10 * rarity_index;
// → roll is in range [0.1 * rarity_index, rarity_index]

// damage/defense stored as: roll * 10  (so legendary damage range ≈ 6–60)
// engineering/dodge/crit/luck stored as: roll  (so legendary luck range ≈ 0.6–6)
```

Attributes not chosen are set to 0. All six attributes always exist in the document.

---

## 13. Equipping & Unequipping Items

**Source:** `services/nft/lib/items.js → equipItem(), unequipItem()`

**Triggers:**
- `terracore_equip` custom JSON on Hive L1 with `{ "item_number": 12345 }`
- `terracore_unequip` custom JSON on Hive L1 with `{ "item_number": 12345 }`

### Equip Logic

```
1. Verify item exists and belongs to username
2. Verify item is not listed in marketplace
3. Verify item is not salvaged
4. If player already has an item in that slot → auto-unequip it first
5. Set player.items[item.type] = { item_number, item_id, item_equipped: true, rarity, level, attributes }
6. Set items collection: { equiped: true }
```

**Item Slots:** `weapon`, `armor`, `ship`, `special`, `avatar`

Players can only have **one item per slot**. Equipping when a slot is occupied auto-unequips the previous item.

The API writes equipped item attribute bonuses into `player.stats.*` at read time. The `applyItemStats()` function in `hive-engine/lib/items.js` periodically syncs `player.items[slot].attributes` from the canonical `items` collection to prevent stat drift after forges.

---

## 14. Salvaging NFT Items for $FLUX

**Source:** `services/nft/lib/items.js → salvageNFT()` and `services/nft/lib/crate-loot.js → salvageValue()`

**Trigger:** `terracore_salvage` custom JSON on Hive L1 with `{ "item_number": 12345 }`.

### Requirements

- Item must belong to the player
- Item must **not** be equipped (`equiped != true`)
- Item must **not** be listed on marketplace
- Item must not already be salvaged

### $FLUX Yield Formula

```js
// crate-loot.js → salvageValue(attributes)

function salvageValue(attributes) {
    return attributes.damage      / 2      // ×0.5
         + attributes.defense     / 2      // ×0.5
         + attributes.engineering * 5      // ×5
         + attributes.dodge       * 5      // ×5
         + attributes.crit        * 5      // ×5
         + attributes.luck        * 10;    // ×10
}
```

| Attribute | FLUX Multiplier | Notes |
|---|---|---|
| Damage | ×0.5 | Stored at 10× scale, so ÷2 gives half |
| Defense | ×0.5 | Same |
| Engineering | ×5 | Direct multiplier |
| Dodge | ×5 | Direct multiplier |
| Crit | ×5 | Direct multiplier |
| Luck | ×10 | Highest value per attribute unit |

### Salvage Outcomes

| Item | Dominant Attribute | Approx FLUX |
|---|---|---|
| Common Weapon (dmg 1.2) | damage 12 | 6 FLUX |
| Uncommon (luck 2, eng 2) | luck=2, eng=2 | 30 FLUX |
| Rare (luck 3, dodge 3, crit 3) | each ≈3 | ~60 FLUX |
| Legendary all-max (luck 6, others 6) | all attributes | ~150+ FLUX |

After salvage, item is marked `{ salvaged: true, equiped: false, owner: null }`. FLUX is minted via `mintFLUX()` (HE `issue` action to player).

---

## 15. Item Forging (Upgrading)

**Source:** `services/hive-engine/lib/items.js → upgradeItem()`

**Trigger:** Player sends FLUX to `@terracore` (NOT `null`) with memo `terracore_forge-{item_number}`.

### Forge Cost Formula

```js
// items.js → upgradeItem()

const value = item.attributes.damage / 2 + item.attributes.defense / 2
    + item.attributes.engineering * 5 + item.attributes.dodge * 5
    + item.attributes.crit * 5 + item.attributes.luck * 10;

// Minimum FLUX required to forge to next level:
const minCost = value * 0.0498 * item.level;
```

**Formula:** `forgeCost = salvageValue × 0.0498 × currentLevel`

- Cost scales linearly with both the item's value and its current forge level
- An item at level 1 costs 4.98% of its salvage value to forge to level 2
- An item at level 10 costs 49.8% of its salvage value to forge to level 11

### Forge Effect

```js
await collection.updateOne({ item_number }, {
    $set: {
        attributes: {
            damage:      item.attributes.damage      * 1.05,
            defense:     item.attributes.defense     * 1.05,
            engineering: item.attributes.engineering * 1.05,
            dodge:       item.attributes.dodge       * 1.05,
            crit:        item.attributes.crit        * 1.05,
            luck:        item.attributes.luck        * 1.05,
        },
        level: item.level + 1,
    }
});
```

**Each forge: all attributes × 1.05 (+5%), level +1.**

Forging also:
- Resets `last_upgrade_time` (mine decay timer — counts as sink)
- Calls `applyItemStats(username)` to sync the forged attributes into the player's equipped item slot

### Cannot Forge

- Items already marked `salvaged: true`
- Items where FLUX quantity < `value * 0.0498 * level` (underpaid)

---

## 16. Quests — Start

**Source:** `services/hive-engine/lib/quests.js → startQuest()`

**Trigger:** Burn SCRAP to `null` on Hive Engine with memo `terracore_quest_start-{type}-{tier}-...`

### Quest Types & Stat Mapping

```js
// quests.js QUEST_TYPE_MAP

const QUEST_TYPE_MAP = {
    combat:  { primary: 'damage',      secondary: 'crit',  item: 'weapon'  },
    salvage: { primary: 'engineering', secondary: null,    item: 'special' },
    stealth: { primary: 'dodge',       secondary: 'luck',  item: 'armor'   },
    fortune: { primary: 'luck',        secondary: 'crit',  item: 'avatar'  },
    defense: { primary: 'defense',     secondary: null,    item: 'ship'    },
};
```

**Item-only stats** (`luck`, `dodge`): Cannot be upgraded directly with SCRAP. Their effective value is summed from ALL equipped item slots (all 5 slots contribute). Separate lower thresholds apply (`TIER_STAT_REQ_ITEM`).

### Quest Tier Constants

```js
const TIER_LEVEL_REQ  = { 1: 1,   2: 10,  3: 25,  4: 50,  5: 100 };
const TIER_STAT_REQ   = { 1: 10,  2: 50,  3: 100, 4: 200, 5: 500 };  // damage/defense/eng
const TIER_STAT_REQ_ITEM = { 1: 2,2: 5,   3: 12,  4: 20,  5: 40  };  // luck/dodge
const TIER_BASE_COST  = { 1: 20,  2: 100, 3: 235, 4: 985, 5: 4010 }; // base SCRAP (pre-multiplier)
const TIER_DURATION   = { 1: 1,   2: 4,   3: 12,  4: 24,  5: 48  };  // hours
const TIER_BASE_ROLLS = { 1: 2,   2: 3,   3: 4,   4: 6,   5: 10  };  // base loot draws
```

### Quest Start Validation Chain

```
1. price_feed exists (required for multiplier)
2. questType is valid (combat/salvage/stealth/fortune/defense)
3. tier is valid (1–5)
4. quest-board is current (date matches today)
5. Board has a slot for this type+tier
6. Template exists for the slot
7. Player exists
8. player.level >= TIER_LEVEL_REQ[tier]
9. effectivePrimary >= TIER_STAT_REQ[tier]  (or TIER_STAT_REQ_ITEM for luck/dodge)
10. Tier >= 3: player.items[mapping.item].item_number is truthy (item equipped in quest slot)
11. No duplicate: active-quests where {username, board_date, quest_type, tier} not found
12. SCRAP paid >= floor(TIER_BASE_COST[tier] * multiplier * 0.99)  (1% slippage tolerance)
```

### Effective Primary Stat (Item-Only Stats)

For `luck` and `dodge` quests, the effective stat is the **sum across ALL equipped slots** (not just the quest's required slot):

```js
if (ITEM_ONLY_STATS.has(primaryStat)) {
    let total = 0;
    for (const slot of Object.values(player.items)) {
        if (slot && slot.attributes) total += slot.attributes[primaryStat] || 0;
    }
    return total;
}
```

For normal stats (`damage`, `defense`, `engineering`): the raw base stat + item bonus from the quest's specific slot.

### Snapshot at Start

The following are stored in `active-quests` for deterministic reward calculation at collect time:

```js
{
  username, template_id, board_date, quest_type, tier,
  name, image_url,
  primary_stat, secondary_stat, required_item_type,
  equipped_item_rarity,        // null if no item in slot
  equipped_item_level,         // 1 if no item
  item_attribute_value,        // primary-stat attribute of equipped item
  effective_primary_stat,      // computed at start
  secondary_stat_value,        // secondary stat value at start
  base_rolls,
  scrap_paid, multiplier_applied,
  started_at, completes_at, expires_at,
  collected: false,
}
```

Starting a quest also:
- Resets `last_upgrade_time` (sink action)
- Increments player `version`
- Logs to `quest-log` and increments `stats.quests_started` + `stats.scrap_burned_quests`

### Quest Expiry

Completed quests that are never collected expire after **30 days** (`expires_at = completes_at + 30*24*3600000`). The lb-rewards cleanup task deletes expired quests.

---

## 17. Quests — Collect (Reward Calculation)

**Source:** `services/smart-contract/lib/quests.js → collectQuest()`

**Trigger:** `terracore_quest_collect` custom JSON on Hive L1 with `{ "quest_id": "<ObjectId>" }`.

### Collect Prerequisites

- Quest exists for this username
- `quest.collected == false`
- `quest.completes_at <= Date.now()`

### Step 1 — Base Roll

```js
// quest-loot.js → rollDice(100, seed)
// seed = createSeed(blockId, trxId, username)

const baseRoll = rollDice(100, seed);   // float in [1, 100] (lower bound 1%)
```

### Step 2 — Effective Roll

```js
// quest-loot.js → computeEffectiveRoll()

function computeEffectiveRoll(baseRoll, effectivePrimaryStat, statReq, secondaryStatValue) {
    // statMod: how much beyond the requirement the player's stat is (wider denominator)
    const statMod = Math.max(0, Math.min(
        (effectivePrimaryStat - statReq) / (statReq * 4),   // range: 0–0.75
        0.75
    ));
    const secBonus = secondaryStatValue != null
        ? Math.min((secondaryStatValue / Math.max(statReq, 1)) * 8, 8)  // max +8
        : 0;
    return baseRoll * (1 + statMod) + secBonus;
}
// effectiveRoll range: 0–183 (100 × 1.75 + 8)
```

### Step 3 — Draw Count

```js
// quest-loot.js → computeDrawCount(effectiveRoll, baseRolls)

if      (effectiveRoll <  35) drawCount = Math.max(1, Math.floor(baseRolls * 0.50));
else if (effectiveRoll <  65) drawCount = baseRolls;
else if (effectiveRoll < 100) drawCount = Math.ceil(baseRolls * 1.50);
else if (effectiveRoll < 130) drawCount = baseRolls * 2;
else if (effectiveRoll < 155) { drawCount = Math.ceil(baseRolls * 2.5); shiftRareUp = true; }
else if (effectiveRoll < 175) drawCount = baseRolls * 3;
else                          { drawCount = baseRolls * 3; guaranteedLegendary = true; }
```

| Effective Roll | Draw Count (T5, baseRolls=10) | Flags |
|---|---|---|
| 0–34 | 5 | — |
| 35–64 | 10 | — |
| 65–99 | 15 | — |
| 100–129 | 20 | — |
| 130–154 | 25 | shiftRareUp |
| 155–174 | 30 | — |
| 175+ | 30 + guaranteed legendary draw | guaranteedLegendary |

### Step 4 — Item Draw Bonuses

```js
// quests.js → collectQuest()

// 1. Rarity bonus: rare/epic/legendary item in quest slot → +1 guaranteed draw
const rarityBase = ['rare', 'epic', 'legendary'].includes(itemRarity) ? 1 : 0;
drawCount += rarityBase;

// 2. Level bonus: each forge level above 1 → +5% chance of +1 draw (capped at 100%)
const levelChance = itemRarity ? Math.min((itemLevel - 1) * 0.05, 1.0) : 0;
if (levelChance > 0 && lvlRng() < levelChance) drawCount += 1;

// 3. Affinity bonus: item's primary-stat attribute × 4, capped at 1.0
//    Floor = guaranteed extra draws; fraction = probabilistic extra draw
const rawAff  = Math.min(item_attribute_value * 4, 1.0);   // getAffinityBonus()
const affGuar = Math.floor(rawAff);
const affFrac = rawAff - affGuar;
drawCount += affGuar + (affFrac > 0 && affRng() < affFrac ? 1 : 0);
```

**Affinity cap note:** The cap at 1.0 is critical — damage/defense attributes are stored at 10× scale (range 6–60). Without the cap, a weapon with damage attribute 9.6 would grant 38 bonus draws.

### Step 5 — Loot Table & Per-Draw Rarity

```js
// quest-loot.js → getLootTable(questType, tier)

// Base profiles (weight totals ~100):
const BASE_LOOT_PROFILES = {
    combat:  [{ r:'legendary', w:1 }, { r:'epic', w:5  }, { r:'rare', w:20 }, { r:'uncommon', w:38 }, { r:'common', w:36 }],
    salvage: [{ r:'legendary', w:1 }, { r:'epic', w:3  }, { r:'rare', w:12 }, { r:'uncommon', w:43 }, { r:'common', w:41 }],
    stealth: [{ r:'legendary', w:1 }, { r:'epic', w:5  }, { r:'rare', w:18 }, { r:'uncommon', w:39 }, { r:'common', w:37 }],
    fortune: [{ r:'legendary', w:2 }, { r:'epic', w:7  }, { r:'rare', w:20 }, { r:'uncommon', w:36 }, { r:'common', w:35 }],
    defense: [{ r:'legendary', w:1 }, { r:'epic', w:4  }, { r:'rare', w:15 }, { r:'uncommon', w:41 }, { r:'common', w:39 }],
};

// Tier shift: legendary weight += (tier-1)*2*2, epic += (tier-1)*2, uncommon/common -= (tier-1)*2
// Result: higher tiers roll rarer items far more often.

// Low-tier rarity collapse (anti-farm, Lever A2):
const LOW_TIER_RARITY_MULT = {
    1: { legendary: 0,    epic: 0.05, rare: 0.30 },
    2: { legendary: 0.10, epic: 0.30, rare: 0.55 },
    3: { legendary: 0.55, epic: 0.80 },
};
// T1 quests: legendary completely removed, epic at 5% weight, rare at 30%
// T2 quests: legendary at 10%, epic at 30%, rare at 55%
// T3 quests: legendary at 55%, epic at 80%
// T4+: full rarity weights — intended home for legendary loot
```

**Fortune** quest type has 2× legendary weight vs others, plus the widest amount variance (`fortuneVariance` 0.20–1.80 applies to all quest types but fortune's base profile starts with higher rarity weights).

### Step 6 — Amount Per Draw

```js
// quest-loot.js → drawAmount(rng, rarity, tier, questType)

const TIER_SCALE  = { 1: 0.70, 2: 0.58, 3: 0.48, 4: 0.40, 5: 0.32 };
const AMOUNT_BASE = {
    common:    { min: 0.01, max: 1.49 },  // avg ~0.75
    uncommon:  { min: 0.01, max: 1.01 },  // avg ~0.51
    rare:      { min: 0.01, max: 0.60 },  // avg ~0.305
    epic:      { min: 0.01, max: 0.37 },  // avg ~0.19
    legendary: { min: 0.01, max: 0.53 },  // avg ~0.27
};

const raw = base.min + rng() * (base.max - base.min);
const fortuneVariance = 0.20 + rng() * 1.60;   // range 0.20–1.80, avg 1.0
return Math.round(raw * tierScale[tier] * fortuneVariance * 100) / 100;
```

Higher tiers give **fewer** relics per draw but **far better rarity** (via the loot table shifts). The `fortuneVariance` factor applies to all quest types and introduces Diablo-style quantity variance.

### Step 7 — Jackpot

Each draw has a **2% jackpot chance** (independent seed):

```js
const JACKPOT_CHANCE = 0.02;
const RARITY_BUMP    = { common:'uncommon', uncommon:'rare', rare:'epic', epic:'legendary', legendary:'legendary' };

if (jackpot) {
    rarity      = RARITY_BUMP[rarity] || rarity;   // bump one tier up
    finalAmount = r2(amount * 3);                    // 3× the amount
}
```

### Step 8 — Guaranteed Legendary (effectiveRoll ≥ 175)

```js
if (guaranteedLegendary) {
    const legAmt = drawAmount(legRng, 'legendary', tier, questType);
    relics.legendary = r2((relics.legendary || 0) + legAmt);
}
```

### Step 9 — Gear Investment Factor (Anti-Farm)

```js
// quest-loot.js → computeInvestmentFactor(itemRarity, itemLevel, DEFAULT_INVESTMENT)

const DEFAULT_INVESTMENT = {
    floor:        0.30,    // ungeared accounts earn 30% of rewards
    rarityWeight: { none: 0, common: 0.10, uncommon: 0.30, rare: 0.60, epic: 0.85, legendary: 1.0 },
    levelFull:    10,      // forge level where rarity weight is fully applied
    levelBase:    0.6,     // base fraction of rarity weight at level 1
};

// gearScore = rarityWeight[rarity] × (levelBase + (1 - levelBase) × levelComponent)
// factor    = floor + (1 - floor) × gearScore   [clamped to floor–1.0]
```

| Gear | Level | Investment Factor |
|---|---|---|
| None | — | 0.30 (30%) |
| Common | 1 | ~0.33 |
| Uncommon | 1 | ~0.39 |
| Rare | 1 | ~0.51 |
| Rare | 10 | ~0.66 |
| Epic | 10 | ~0.87 |
| Legendary | 10 | 1.00 (100%) |

This factor multiplies **all** relic amounts at the end. Farm accounts with no gear earn only 30% of relic rewards.

### Step 10 — Issue Relics & XP

```js
// Issue fractional relics to 'relics' collection (upsert by username+type)
for (const [rarity, amount] of Object.entries(relics)) {
    if (amount > 0) await issue(username, rarity + '_relics', amount);
}

// XP
const TIER_XP = { 1: 25, 2: 50, 3: 100, 4: 200, 5: 400 };
await players.updateOne({ username }, { $inc: { experience: TIER_XP[tier], version: 1 } });

// Mark collected
await activeQuests.updateOne({ _id: objectId }, { $set: { collected: true, collected_at: Date.now() } });
```

---

## 18. Quest Board Generation

**Source:** `services/lb-rewards/cycle.js → generateQuestBoard()`

Run every 15 minutes by lb-rewards but skips if board is already current for today.

### Algorithm

```js
const rng = seedrandom(todayDate);   // deterministic: same board every run for same date

// 1. Shuffle QUEST_TYPES array (Fisher-Yates with rng)
// 2. Assign tiers per slot:
//    slot 0: T1 or T2 (rng pick)
//    slot 1: T2 or T3
//    slot 2: T3, T4, or T5
//    slot 3: weighted random (Tier 1:10%, 2:20%, 3:30%, 4:25%, 5:15%)
//    slot 4: weighted random
// 3. Find matching template for each type+tier (excluding already-used templates)
// 4. Bonus 6th slot:
//    10% chance: pick a legendary template (template.legendary === true)
//    90% chance: weighted random from all remaining templates
```

### Weighted Tier Pool

```js
const WEIGHTED_TIER_POOL = [1,1,2,2,2,2,3,3,3,3,3,3,4,4,4,4,4,5,5,5];
// Weights: T1=10%, T2=20%, T3=30%, T4=25%, T5=15%
```

The board document stored in `quest-board`:
```js
{ date: 'YYYY-MM-DD', slots: [...], generated_at: Date.now() }
```

Each slot contains: `template_id`, `quest_type`, `tier`, `name`, `flavor`, `image_url`, `duration_hours`, `base_rolls`.

---

## 19. Quest Oracle (Dynamic Pricing)

**Source:** `services/lb-rewards/cycle.js → updateQuestOracle()`

Run every 15 minutes but only updates if **≥ 4 hours** since last update (`ORACLE_INTERVAL_MS`).

### Purpose

Keeps quest cost stable in USD terms as SCRAP price fluctuates, and adds a one-way FLUX factor to prevent cheap FLUX farming when FLUX is below its target price.

### TWAP (Time-Weighted Average Price)

Both SCRAP and FLUX prices are fetched from the Hive Engine DEX (`market.metrics`). A rolling **6-element TWAP** is maintained for both tokens in `price_feed`:

```js
// scrapHistory: last 6 SCRAP/HIVE prices (updated every 4h)
// fluxHistory:  last 6 FLUX/HIVE prices
scrapTwap = average(scrapHistory);
fluxTwap  = average(fluxHistory);
```

### Multiplier Formula

```js
const QUEST_TARGET_PRICE_DEFAULT = 0.0003;       // target SCRAP price in HIVE
const QUEST_FLUX_TARGET_DEFAULT  = 3.0;           // target FLUX price in HIVE
const ORACLE_MAX_MULTIPLIER      = 50.0;
const ORACLE_MAX_CYCLE_CHANGE    = 0.50;           // circuit breaker: max 50% swing per 4h

const scrapFactor = targetScrap / scrapTwap;
// Keeps USD quest cost stable: if SCRAP rises, fewer SCRAP needed

const fluxFactor = Math.max(1.0, Math.sqrt(fluxTwap / targetFlux));
// ONE-WAY: only raises cost when FLUX > target (protects FLUX from farming)
// Never lowers quest cost based on FLUX price (procyclical deflation avoided)

const rawMultiplier = scrapFactor * fluxFactor;
const newMultiplier = Math.min(Math.max(rawMultiplier, 1.0), ORACLE_MAX_MULTIPLIER);
```

**Circuit breaker:** If the new multiplier swings > 50% from the previous value, the multiplier write is **blocked** (TWAP still advances). A Discord alert is fired.

### Effective Quest Cost

```js
// quests.js → startQuest()

const expectedCost = Math.ceil(TIER_BASE_COST[tier] * multiplier);
const minAccepted  = Math.floor(expectedCost * 0.99);   // 1% slippage tolerance
```

---

## 20. Leaderboard Rewards

**Source:** `services/lb-rewards/cycle.js → getRewards()`

Run every 15 minutes, but only distributes once per day (controlled by `stats.global.rewardtime`).

### Reward Pool

```js
const scrapBalance = await fetchScrapBalance();   // @terracore's HE SCRAP balance
const pool         = scrapBalance * 0.0001;       // 0.01% of balance
```

### Distribution

```js
// Fetch leaderboard from API (https://api.terracoregame.com/leaderboard)
const totalApiRewards = json.reduce((sum, u) => sum + (u.reward || 0), 0);

for (const user of json) {
    user.calculatedReward = (user.reward / totalApiRewards) * pool;
}
```

Each player's share is proportional to their `reward` score from the API. Rewards are sent as HE SCRAP `transfer` operations (not `issue` — taken from `@terracore`'s balance).

Players are skipped if:
- Not found in DB
- Already received rewards this cycle (`player.lastRewardTime >= rewardTime`)
- `calculatedReward <= 0`

After distribution, `rewardtime` is set to `Date.now() + 86400000` (24 hours).

---

## 21. Economy: $SCRAP & $FLUX Flow

### SCRAP Flow Diagram

```
Engineering (passive)
    ↓ mine rate
Stash (in-game, unclaimed)
    ↓ claim (HE issue → wallet)
SCRAP Wallet
    ↓ spend on:
    ├─ Engineering upgrades         [burned to null]
    ├─ Damage upgrades              [burned to null]
    ├─ Defense upgrades             [burned to null]
    ├─ Favor contributions          [burned to null]
    ├─ Quest starts                 [burned to null]
    ├─ Crate purchases              [burned to null]
    ├─ Stake (Tribaldex)            [locked, recoverable]
    └─ Marketplace purchases        [5% fee burned, rest to seller]

Leaderboard rewards      [transfer from @terracore]
lb-rewards buyback       [SWAP.HIVE → SCRAP → distributed]
```

### FLUX Flow Diagram

```
NFT Items (obtained via crate opening)
    ↓ salvage (destroy item → HE issue FLUX)
FLUX Wallet
    ↓ spend on:
    ├─ Boss fights                  [burned to null]
    └─ Item forging                 [sent to @terracore]

@terracore FLUX balance:
    ├─ 25% burned to null           [every 15-min lb cycle, if > 5 FLUX]
    └─ 75% sold on DEX (10 orders)  [2–20% above highest bid]
```

### SCRAP Sinks Summary

| Sink | Formula |
|---|---|
| Engineering upgrade | `currentLevel²` SCRAP |
| Damage upgrade | `(currentDamage/10)²` SCRAP |
| Defense upgrade | `(currentDefense/10)²` SCRAP |
| Favor contribution | 1:1 SCRAP = 1 Favor |
| Quest start | `TIER_BASE_COST[tier] × oracle_multiplier` SCRAP |
| Crate purchase | Dynamic USD-pegged SCRAP amount |
| Marketplace fee | 2.5% of sale price |

---

## 22. Staking & Stash Size

$SCRAP is staked directly on Hive Engine (Tribaldex). The backend reads `hiveEngineStake` from player documents; this field is updated by the HE stream when a `stake` action is observed.

### Stash Size

```
stashSize = hiveEngineStake + 1
```

The `+1` ensures new players with 0 stake can still accumulate a small amount. Your unclaimed SCRAP stash caps at this value.

### Combat Toughness

An attacker's stash also caps their loot — they cannot accumulate more SCRAP than their stash holds:

```js
if (userCurrentScrap + scrapToSteal > staked + 1) {
    scrapToSteal = (staked + 1) - userCurrentScrap;
}
```

An attacker with a full stash steals nothing regardless of roll.

### Luck from Staked SCRAP

Staking SCRAP provides Luck bonuses through the stepped halving formula (read by the API to compute `player.stats.luck`). The thresholds are defined in the API layer, not in the smart contract. Effectively:
- Early staking provides 0.025 Luck per SCRAP
- Rate halves at each threshold: 1, 3, 5, 8, 10, 15, 20... up to 90
- Very high stakes yield steeply diminishing Luck returns

---

## 23. NFT Marketplace

**Source:** `services/nft/lib/marketplace.js`

Players trade crates, items, relics, and consumables on the in-game marketplace via Hive L1 custom JSON operations.

### Marketplace Operations

| Operation ID | Trigger | Payload |
|---|---|---|
| `tm_create` | List item for sale | `{ item_number, type, price }` |
| `tm_cancel` | Cancel listing | `{ item_number, type }` |
| `tm_transfer` | Transfer item | `{ item_number, type, to }` |
| HIVE transfer to `terracore.market` | Buy item | JSON memo `{ action: "tm_purchase-...", item_number, type }` |

### Fee Structure

| Fee | Amount | Recipient |
|---|---|---|
| Game fee | 2.5% | @terracore |
| Marketplace operator fee | 2.5% | Marketplace operator |
| **Total fee** | **5%** | — |

**Minimum listing price:** 0.05 HIVE.

Fees are deducted from the purchase price by the smart contract at time of sale. The seller receives `price × 0.95` HIVE.

### Combining Relics → Crates

**Trigger:** `terracore_combine` custom JSON with `{ "type": "common_relics" }` (or other rarity).

100 relics of the same rarity can be combined into one crate of that rarity. The relics are burned (decremented), and a crate is minted.

---

## 24. Consumables

**Source:** `services/nft/lib/boss.js → mintCrate()` (for drops), `services/nft/lib/queue.js → queUse()` (for use)

**Trigger to use:** `terracore_use_consumable` custom JSON with `{ "type": "protection_consumable" }`.

Consumables are single-use NFT items stored in the `consumables` collection per username per type.

### Consumable Types by Boss Fight Drop Rarity

```js
// boss.js → mintCrate() consumable type selection

if (rarity == 'uncommon') {
    const types = ['attack', 'claim', 'crit', 'damage', 'dodge'];
    type = types[Math.floor(rng() * types.length)];
} else if (rarity == 'rare') {
    const types = ['rage', 'impenetrable', 'overload', 'rogue', 'battle', 'fury'];
    type = types[Math.floor(rng() * types.length)];
} else {  // epic or legendary
    const types = ['protection', 'focus'];
    type = types[Math.floor(rng() * types.length)];
}
```

| Rarity Drop | Available Consumable Types |
|---|---|
| Uncommon | `attack`, `claim`, `crit`, `damage`, `dodge` |
| Rare | `rage`, `impenetrable`, `overload`, `rogue`, `battle`, `fury` |
| Epic / Legendary | `protection`, `focus` |

### Key Consumable Mechanics

#### Protection Consumable

```js
// combat.js → battle() — protection check

if (target.consumables.protection > 0 &&
    Date.now() - target.consumables.protection_times[0] < 86400000) {
    // Attack blocked — attacker loses 1 charge, nothing stolen
    await collection.updateOne({ username }, { $set: { attacks: currentAttacks - 1, lastregen } });
    return true;
}
```

- Blocks **all** incoming attacks for **24 hours**
- `protection_times[0]` is the activation timestamp
- Effect: protection_consumable amount > 0 AND within 24h of activation

#### Focus Consumable

```js
// combat.js → battle()

if (user.stats.damage > target.stats.defense || user.consumables.focus > 0) {
    // Attack proceeds even if damage <= defense
    if (checkDodge(target, seed) && user.consumables.focus == 0) {
        // Dodge only applies if focus NOT active
        return true;
    }
    if (user.consumables.focus > 0) {
        await collection.updateOne({ username }, { $inc: { 'consumables.focus': -1, version: 1 } });
        // Focus is consumed after one use
    }
    // Continue to steal calculation...
}
```

- Bypasses `damage > defense` requirement (can attack anyone)
- Bypasses dodge check
- Consumed on use (decremented by 1)

---

## 25. Deterministic RNG System

**Source:** `shared/rng.js`

All game-state-changing outcomes use **seeded deterministic RNG** via `seedrandom`. This ensures outcomes are reproducible and verifiable against on-chain data.

### Seed Construction

```js
// shared/rng.js → createSeed(blockId, trxId, hash)

function createSeed(blockId, trxId, hash) {
    return blockId + '@' + trxId + '@' + hash;
}
```

The seed is derived from:
- **blockId** — the Hive block ID (globally unique per block)
- **trxId** — the transaction ID within that block
- **hash** — a context-specific suffix (`username`, `'boss'`, `'-dodge'`, `username + '_drop_' + i`, etc.)

Per-draw seeds in quest collect use unique suffixes (`_drop_0`, `_drop_1`, `_lvl`, `_aff`, `_jp_0`, `_leg_bonus`) to ensure each draw is independently seeded and not correlated.

### Core RNG Functions

```js
// shared/rng.js

// Float in [1%, 99%] of index — lower bound prevents pure-zero outcomes
function rollDice(index, seed = null) {
    const rng = seedrandom(seed.toString(), { state: true });
    return rng() * (index - 0.01 * index) + 0.01 * index;
}

// Float with optional adjustment, clamped to [1%, 99%] of index
function adjustedRoll(index, adjustment = 0, seed = null) { ... }

// Integer in [0, 99999] — used for NFT item rarity rolling (crate opening)
function generateRandomNumber(seed) {
    const rng = seedrandom(seed.toString(), { state: true });
    return Math.floor(rng() * 100000);
}
```

**`Math.random()` is never used** for any game-state-changing operation. All seeded paths use `seedrandom`.

### RNG Usage Map

| Function | Seed Suffix | Purpose |
|---|---|---|
| Battle attack % | `blockId@trxId@timestamp` | Roll steal percentage |
| Battle dodge | `seed + '-dodge'` | Dodge check |
| Boss fight hit | `seed + '-boss'` | Crate vs miss roll |
| Boss crate rarity | `seed + '-crate'` | Crate rarity + drop type |
| Crate open | `blockId@trxId@opHash` | `generateRandomNumber` → item rarity |
| Quest base roll | `blockId@trxId@username` | `rollDice(100, seed)` |
| Quest draw i | `blockId@trxId@username_drop_i` | Rarity + amount per draw |
| Quest level bonus | `blockId@trxId@username_lvl` | Forge-level chance draw |
| Quest affinity | `blockId@trxId@username_aff` | Fractional affinity draw |
| Quest jackpot i | `blockId@trxId@username_jp_i` | Per-draw jackpot |
| Quest guaranteed leg | `blockId@trxId@username_leg_bonus` | Guaranteed legendary draw |

---

## 26. lb-rewards 15-Minute Cycle

**Source:** `services/lb-rewards/cycle.js → runCycle()`

Runs every 15 minutes (`sleep(900000)`) in an infinite loop:

```js
async function runCycle() {
    // [1/7] Find fastest HE node
    node = await findNode();

    // [2/7] Manage @terracore FLUX balance
    //   If FLUX > 5: burn 25% to null, place 10 sell orders with 75%
    await manageFlux();

    // [3/7] Withdraw and convert SWAP.HIVE
    //   If SWAP.HIVE > 1: swap half to SCRAP (Tribaldex pool), withdraw other half to HIVE
    await withdrawSwapHive();

    // [4/7] Distribute leaderboard rewards (once per day)
    //   0.01% of @terracore SCRAP balance → top players pro-rata
    await getRewards();

    // [5/7] Distribute revenue (once when HIVE balance > 10)
    //   50% → swap to SCRAP (keychain swap)
    //   50% remaining → 70% to crypt0gnome, 30% to asgarth
    await distributeRevenue();

    // [6/7] Update quest oracle (every 4 hours)
    //   Fetch SCRAP+FLUX prices, update TWAP, compute new multiplier
    await updateQuestOracle();

    // [7/7] Generate daily quest board + cleanup expired quests
    //   Board generated once per day (date check)
    //   Expired quests (expires_at < now) deleted from active-quests
    await generateQuestBoard();
    await cleanupExpiredQuests();
}
```

### Revenue Distribution Formula

```
HIVE balance > 10 HIVE:
  → swap balance * 0.5 HIVE to SCRAP (via keychain.swap)
  → remaining HIVE: 70% to crypt0gnome, 30% to asgarth
```

---

## 27. Custom JSON Operation Reference

### Hive L1 Operations

| Operation / ID | Handler | Payload / Memo |
|---|---|---|
| HIVE `transfer` to `@terracore` | SC: `register()` | `{ "hash": "terracore_register-{hash}", "referrer": "..." }` |
| `custom_json` id=`terracore_claim` | SC: `claim()` | (no payload) |
| `custom_json` id=`terracore_battle` | SC: `battle()` | `{ "target": "username" }` |
| `custom_json` id=`terracore_quest_collect` | SC: `collectQuest()` | `{ "quest_id": "<ObjectId>" }` |
| HIVE `transfer` to `terracore.market` | NFT: `purchaseItem()` | JSON memo `{ "action": "tm_purchase-...", "item_number": N, "type": "..." }` |
| `custom_json` id=`tm_create` | NFT: `listItem()` | `{ item_number, type, price }` |
| `custom_json` id=`tm_cancel` | NFT: `cancelItem()` | `{ item_number, type }` |
| `custom_json` id=`tm_transfer` | NFT: `transferItem()` | `{ item_number, type, to }` |
| `custom_json` id=`terracore_open_crate` | NFT: `queOpenCrates()` | `{ "crate_type": "rare" }` (also supports array) |
| `custom_json` id=`terracore_equip` | NFT: `queEquip('equip')` | `{ "item_number": N }` |
| `custom_json` id=`terracore_unequip` | NFT: `queEquip('unequip')` | `{ "item_number": N }` |
| `custom_json` id=`terracore_salvage` | NFT: `salvageNFT()` | `{ "item_number": N }` |
| `custom_json` id=`terracore_combine` | NFT: `queCombine()` | `{ "type": "common_relics" }` |
| `custom_json` id=`terracore_use_consumable` | NFT: `queUse()` | `{ "type": "protection_consumable" }` |

### Hive Engine L2 — SCRAP Burns (to `null`)

| Memo Prefix | HE Handler | Action |
|---|---|---|
| `terracore_engineering` | `upgrades.engineering()` | Upgrade Engineering +1 |
| `terracore_damage` | `upgrades.damage()` | Upgrade Damage +10 |
| `terracore_defense` | `upgrades.defense()` | Upgrade Defense +10 |
| `terracore_contribute` | `upgrades.contribute()` | Contribute SCRAP → Favor (1:1) |
| `tm_buy_crate-{rarity}-...` | `boss.buy_crate()` | Purchase crate of given rarity |
| `terracore_quest_start-{type}-{tier}-...` | `quests.startQuest()` | Start a quest |

### Hive Engine L2 — FLUX Burns / Sends

| Memo / Action | HE Handler | Notes |
|---|---|---|
| Burn FLUX to `null` with memo `{ hash: "terracore_boss_fight-...", planet: "Oceana" }` | `boss.bossFight()` | Boss fight |
| Send FLUX to `@terracore` with memo `terracore_forge-{item_number}-...` | `items.upgradeItem()` | Item forge |

### Hive Engine L2 — SCRAP Stake

| Action | HE Handler | Notes |
|---|---|---|
| `stake` SCRAP | Logged, webhook fired | `storeHash` records the stake; `hiveEngineStake` updated by API |

---

## 28. API Reference

Base URL: `https://api.terracoregame.com`

| Endpoint | Method | Description |
|---|---|---|
| `/player/{username}` | GET | Full player stats (with item bonuses applied to stats) |
| `/leaderboard` | GET | Leaderboard scores + reward values |
| `/crate_price` | GET | Current common crate price in SCRAP |
| `/marketplace/listings/{type}` | GET | Active listings (type: items/crates/relics/consumables) |
| `/marketplace_logs?action=purchase&limit=N` | GET | Recent purchase logs |
| `/boss-log/{username}` | GET | Boss fight history |
| `/quest-board` | GET | Today's quest board slots |
| `/active-quests/{username}` | GET | Player's active + recent quests |

---

## 29. Experience & Leveling

Experience (`experience` field on player) is accumulated from:

| Source | XP Gained |
|---|---|
| Engineering upgrade | Equal to SCRAP cost (`Math.pow(eng, 2)`) |
| Damage upgrade | Equal to SCRAP cost (`Math.pow(dmg/10, 2)`) |
| Defense upgrade | Equal to SCRAP cost (`Math.pow(def/10, 2)`) |
| Favor contribution | Equal to SCRAP contributed |
| Boss fight | 100 XP per fight |
| Quest complete | `TIER_XP[tier]`: T1=25, T2=50, T3=100, T4=200, T5=400 |

`player.level` is derived from `experience` by the API layer. Level gates quest tier access via `TIER_LEVEL_REQ`:

| Tier | Level Required |
|---|---|
| 1 | 1 |
| 2 | 10 |
| 3 | 25 |
| 4 | 50 |
| 5 | 100 |

Level also gates planet access through `boss_data[i].level` thresholds.

---

## Appendix: Anti-Farm Rebalance (Lever System)

The economy underwent a rebalance to close a low-tier FLUX arbitrage path (T1/T2 quests were ~100× cheaper SCRAP→FLUX than T5). Three levers were implemented:

| Lever | What It Does | Where |
|---|---|---|
| **A2** — Low-tier rarity collapse | T1: legendary=0%, epic=5%, rare=30%. T2: leg=10%, epic=30%, rare=55%. T3: partial. T4+: full weights | `quest-loot.js → LOW_TIER_RARITY_MULT` |
| **B** — Gear investment factor | Bare accounts earn 30% of relics; leveled legendary gear earns 100% | `quest-loot.js → DEFAULT_INVESTMENT → computeInvestmentFactor()` |
| **Cost bump** | T1 base cost: 10→20 SCRAP. T2: 50→100 SCRAP | `quests.js → TIER_BASE_COST` |

**Lever C** (crate upgrade odds) was analyzed but NOT shipped — the simulation showed the backdoor legendary path (common relics → common crates → legendary item) already costs ~48M SCRAP after A2, making it a dead lottery rather than an exploit.

The `scripts/quest-economy-sim.js` Monte Carlo simulation imports the same pure functions (`quest-loot.js`, `crate-loot.js`) used in production, ensuring balance tuning cannot drift from actual game behavior.

---

*Documentation compiled directly from live source code in `reference/TerraCore-Smart-Contract`. All formulas, constants, and flow diagrams are derived verbatim from the service files: `shared/mining.js`, `shared/rng.js`, `smart-contract/lib/combat.js`, `smart-contract/lib/claims.js`, `smart-contract/lib/registration.js`, `smart-contract/lib/quests.js`, `smart-contract/lib/quest-loot.js`, `nft/lib/crate-loot.js`, `nft/lib/items.js`, `hive-engine/lib/boss.js`, `hive-engine/lib/upgrades.js`, `hive-engine/lib/items.js`, `hive-engine/lib/quests.js`, `hive-engine/lib/handlers.js`, and `lb-rewards/cycle.js`.*
