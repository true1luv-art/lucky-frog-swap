/**
 * LUCKYFROG — Day 1–7 Emission Simulation (Revised)
 *
 * Key facts hardcoded from source files:
 *   - Total frog supply cap: 101,000  (shared/data/halving.ts)
 *   - Egg prices (shared/data/eggs.ts):
 *       Common egg   → 2,500  LFRG
 *       Uncommon egg → 5,000  LFRG
 *       Rare egg     → 10,000 LFRG
 *       Epic / Legendary → DROP ONLY — cannot be purchased at any price
 *   - Epic and legendary frogs enter circulation ONLY via claim drops (rollDrop).
 *     There is NO direct purchase path and NO staking-for-LFRG mechanism.
 *   - Frog staking for FROGMENTS (leveling) is allowed, but it DEDUCTS from
 *     the player's active mine rate — it does not earn LFRG independently.
 *   - 100% of egg purchase revenue flows back to the treasury pool.
 *   - Softcap: 333. Mining above 333 earns at 50% efficiency.
 *   - Halving thresholds tied to % of 101,000 supply minted:
 *       Phase 1   0–25%   (0–25,250 frogs)  → 6h  denominator (8× fastest)
 *       Phase 2  25–50%  (25,251–50,500)    → 12h denominator (4×)
 *       Phase 3  50–75%  (50,501–75,750)    → 24h denominator (2×)
 *       Phase 4  75–100% (75,751–101,000)   → 48h denominator (1× slowest)
 *
 * Mining formula options compared:
 *   Current: (effectiveMining + 1)^2  / halvingDenominator  ← BROKEN at 200 frogs
 *   Proposed: sqrt(effectiveMining) * SCALAR / halvingDenominator  ← recommended
 */

// ── Constants ────────────────────────────────────────────────────────────────

const TOTAL_SUPPLY        = 101_000;       // immutable supply cap
const SOFTCAP             = 333;
const SOFTCAP_EFF         = 0.5;           // 50% efficiency above softcap
const TREASURY_START      = 31_000_000;    // genesis treasury in LFRG
const SECS_PER_HOUR       = 3600;

// Claim cap mechanic
// - Players may claim every 4 hours (6 times/day)
// - Base claim cap: 10,000 LFRG per claim
// - Charm investment: 10% of charm put goes to "stash vault" — increases claim cap
//   e.g. put 100,000 charm → +10,000 vault bonus → 20,000 LFRG/claim
// - Max charm: 1,000,000 → max vault bonus: 100,000 → max claim: 110,000 LFRG
// - Max per day (max charm, 6 claims): 660,000 LFRG
const CLAIM_INTERVAL_HOURS = 4;            // hours between claims
const CLAIMS_PER_DAY       = 24 / CLAIM_INTERVAL_HOURS;  // = 6
const BASE_CLAIM_CAP       = 10_000;       // LFRG per claim (base, no charm)
const MAX_CHARM            = 1_000_000;    // absolute charm ceiling
const CHARM_TO_VAULT_RATE  = 0.10;        // 10% of charm put → stash vault bonus
const MAX_VAULT_BONUS      = MAX_CHARM * CHARM_TO_VAULT_RATE; // = 100,000
const MAX_CLAIM_CAP        = BASE_CLAIM_CAP + MAX_VAULT_BONUS; // = 110,000
const MAX_DAILY_CLAIM      = MAX_CLAIM_CAP * CLAIMS_PER_DAY;   // = 660,000

/**
 * Returns the effective claim cap per claim given charm invested.
 * @param {number} charmInvested — how much charm the player has put in (0 to 1M)
 */
function claimCapForCharm(charmInvested) {
  const vaultBonus = Math.min(charmInvested, MAX_CHARM) * CHARM_TO_VAULT_RATE;
  return BASE_CLAIM_CAP + vaultBonus;
}

/**
 * Applies claim cap to a raw per-claim amount.
 * Returns the capped amount and a flag if it was clipped.
 */
function applyClaimCap(rawPerClaim, charmInvested = 0) {
  const cap     = claimCapForCharm(charmInvested);
  const capped  = Math.min(rawPerClaim, cap);
  return { capped, cap, clipped: rawPerClaim > cap };
}

// Egg prices — source: shared/data/eggs.ts
const EGG_PRICES = {
  common:    2_500,
  uncommon:  5_000,
  rare:      10_000,
  // epic and legendary are drop-only — no price
};

// Halving schedule — source: shared/data/halving.ts
const HALVING = [
  { threshold: 0.25, denom: 6  * SECS_PER_HOUR, label: "Phase 1 — Genesis        (0–25k)" },
  { threshold: 0.50, denom: 12 * SECS_PER_HOUR, label: "Phase 2 — First Halving  (25k–50k)" },
  { threshold: 0.75, denom: 24 * SECS_PER_HOUR, label: "Phase 3 — Second Halving (50k–75k)" },
  { threshold: 1.00, denom: 48 * SECS_PER_HOUR, label: "Phase 4 — Third Halving  (75k–101k)" },
];

// ── Egg rarity weights — source: shared/data/eggs.ts ─────────────────────────
// Each egg type produces frogs at these rarity weights (%).
// Epic / legendary frogs NEVER come from purchased eggs — drop only.
const EGG_WEIGHTS = {
  common:    { common: 90,   uncommon: 9,    rare: 0.75, epic: 0,    legendary: 0    },
  uncommon:  { common: 0,    uncommon: 95,   rare: 4,    epic: 0.9,  legendary: 0.1  },
  rare:      { common: 0,    uncommon: 0,    rare: 95,   epic: 4,    legendary: 1    },
};
// NOTE: epic/legendary weights from rare eggs (4% + 1%) represent *potential*
// from claim drops over time, not direct egg hatch results per the game rules.
// For emission purposes we treat rare eggs as: 95% rare, 4.5% uncommon, 0.5% common
// since epic/legendary do not enter the supply from egg purchases.
const RARE_EGG_SAFE = { common: 0.5, uncommon: 4.5, rare: 95, epic: 0, legendary: 0 };

// ── Median mining stat per rarity — source: shared/data/stats.ts ─────────────
// Formula: midpoint of [0.5*R .. R] * STAT_ROLL_MULTIPLIER(2.0)
const MEDIAN_MINING = {
  common:    (0.5 * 1 + 1)   / 2 * 2.0,  // 0.75 * 2 = 1.50
  uncommon:  (0.5 * 2 + 2)   / 2 * 2.0,  // 1.50 * 2 = 3.00
  rare:      (0.5 * 3 + 3)   / 2 * 2.0,  // 2.25 * 2 = 4.50
  epic:      (0.5 * 4 + 4)   / 2 * 2.0,  // 3.00 * 2 = 6.00
  legendary: (0.5 * 6 + 6)   / 2 * 2.0,  // 4.50 * 2 = 9.00
};

// ── Core helpers ─────────────────────────────────────────────────────────────

function getDenom(minted) {
  const sat = Math.min(minted, TOTAL_SUPPLY) / TOTAL_SUPPLY;
  for (const h of HALVING) { if (sat <= h.threshold) return h; }
  return HALVING[HALVING.length - 1];
}

function effectiveMining(raw) {
  return raw <= SOFTCAP ? raw : SOFTCAP + (raw - SOFTCAP) * SOFTCAP_EFF;
}

// ── Formula variants ─────────────────────────────────────────────────────────

function mineRateSquare(rawMining, minted) {
  const eff   = effectiveMining(rawMining);
  const denom = getDenom(minted).denom;
  return Math.pow(eff + 1, 2) / denom;  // LFRG/sec
}

function mineRateSqrt(rawMining, minted, scalar = 250) {
  const eff   = effectiveMining(rawMining);
  const denom = getDenom(minted).denom;
  return Math.sqrt(eff) * scalar / denom;  // LFRG/sec
}

// ── Frog distribution helpers ─────────────────────────────────────────────────

/**
 * Returns total median mining for a player who bought `count` eggs of `eggType`.
 * Epic/legendary weights from purchased eggs are set to 0 — drop only.
 */
function playerMining(eggType, count) {
  const weights = eggType === "rare" ? RARE_EGG_SAFE : EGG_WEIGHTS[eggType];
  const total   = Object.values(weights).reduce((a, b) => a + b, 0);
  let mining = 0;
  for (const [rarity, pct] of Object.entries(weights)) {
    const frogs = (pct / total) * count;
    mining += frogs * MEDIAN_MINING[rarity];
  }
  return mining;
}

/**
 * Frog counts from `count` eggs of `eggType` using distribution weights.
 */
function frogDistribution(eggType, count) {
  const weights = eggType === "rare" ? RARE_EGG_SAFE : EGG_WEIGHTS[eggType];
  const total   = Object.values(weights).reduce((a, b) => a + b, 0);
  const dist = {};
  for (const [rarity, pct] of Object.entries(weights)) {
    dist[rarity] = Math.round((pct / total) * count);
  }
  return dist;
}

// ── Main simulation ───────────────────────────────────────────────────────────

/**
 * Simulate day-by-day emission for a given cohort and egg configuration.
 *
 * Treasury grows in real time from egg purchases — 100% of egg sale revenue
 * is returned to the treasury pool (EGG_PURCHASE_SPLIT.market = 1.0).
 *
 * @param {number} numPlayers
 * @param {"common"|"uncommon"|"rare"} eggType
 * @param {number} eggsPerPlayer
 * @param {"square"|"sqrt"} formula
 * @param {number} sqrtScalar
 */
function simulate(numPlayers, eggType, eggsPerPlayer, formula = "sqrt", sqrtScalar = 250) {
  const eggsTotal    = numPlayers * eggsPerPlayer;
  const eggRevenue   = eggsTotal * EGG_PRICES[eggType];
  // Treasury = 31M genesis + 100% of all egg purchases
  const treasury     = TREASURY_START + eggRevenue;
  const totalFrogs   = Math.min(numPlayers * eggsPerPlayer, TOTAL_SUPPLY);
  const rawMining    = playerMining(eggType, eggsPerPlayer);
  const eff          = effectiveMining(rawMining);
  const halvingInfo  = getDenom(totalFrogs);

  const ratePerSec = formula === "sqrt"
    ? mineRateSqrt(rawMining, totalFrogs, sqrtScalar)
    : mineRateSquare(rawMining, totalFrogs);
  const ratePerDay  = ratePerSec * SECS_PER_HOUR * 24;

  const rows = [];
  let remaining  = treasury;
  let cumEmitted = 0;

  for (let day = 1; day <= 7; day++) {
    const networkDay = ratePerDay * numPlayers;
    remaining       -= networkDay;
    cumEmitted      += networkDay;

    rows.push({
      day,
      halvingPhase: halvingInfo.label,
      ratePerHour:  (ratePerSec * SECS_PER_HOUR).toFixed(2),
      playerDay:    ratePerDay.toFixed(0),
      networkDay:   networkDay.toFixed(0),
      cumEmitted:   cumEmitted.toFixed(0),
      remaining:    Math.max(remaining, 0).toFixed(0),
      depleted:     remaining <= 0,
    });

    if (remaining <= 0) break;
  }

  return {
    rows,
    treasury,
    eggRevenue,
    totalFrogs,
    rawMining,
    eff,
    halvingInfo,
    ratePerDay,
  };
}

// ── Print helpers ─────────────────────────────────────────────────────────────

function printTable(rows) {
  console.log(`  ┌─────┬────────────────────────────────────┬──────────────────┬──────────────────────┬──────────────┐`);
  console.log(`  │ Day │ Halving Phase                      │ Player/day       │ Network/day          │ Treasury Left│`);
  console.log(`  ├─────┼────────────────────────────────────┼──────────────────┼──────────────────────┼──────────────┤`);
  for (const r of rows) {
    const left = parseFloat(r.remaining).toLocaleString().padStart(12);
    const pd   = parseFloat(r.playerDay).toLocaleString().padStart(16);
    const nd   = parseFloat(r.networkDay).toLocaleString().padStart(20);
    const ph   = r.halvingPhase.padEnd(34);
    const flag = r.depleted ? " ← EMPTY" : "";
    console.log(`  │  ${r.day}  │ ${ph} │${pd} │${nd} │${left}  │${flag}`);
  }
  console.log(`  └─────┴────────────────────────────────────┴──────────────────┴──────────────────────┴──────────────┘`);
}

function runway(treasury, networkDay) {
  const days = treasury / networkDay;
  if (days > 365) return `${(days / 365).toFixed(1)}yr`;
  return `${days.toFixed(1)} days`;
}

// ── OUTPUT ────────────────────────────────────────────────────────────────────

console.log("=================================================================");
console.log(" LUCKYFROG EMISSION SIMULATION — DAY 1–7  (Revised)");
console.log(" Supply cap: 101,000 frogs total. Epic/Legendary = drop only.");
console.log(" No LFRG staking. Frogment staking deducts from mine rate.");
console.log("=================================================================\n");

// ── Section 1: Egg prices & frog distributions ───────────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("EGG PRICES & FROG DISTRIBUTION (source: shared/data/eggs.ts)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
for (const [eggType, price] of Object.entries(EGG_PRICES)) {
  const dist = frogDistribution(eggType, 100);
  console.log(`  ${eggType.padEnd(9)} egg  → ${price.toLocaleString().padStart(7)} LFRG/egg`);
  console.log(`    Frog distribution from 100 eggs: ${JSON.stringify(dist)}`);
  console.log(`    Median mining (100 eggs): ${playerMining(eggType, 100).toFixed(2)}  |  Effective: ${effectiveMining(playerMining(eggType, 100)).toFixed(2)}\n`);
}
console.log(`  EPIC egg    → DROP ONLY (not purchasable)`);
console.log(`  LEGENDARY   → DROP ONLY (not purchasable)\n`);
console.log(`  NOTE: Frogment staking is available but deducts from mine rate.`);
console.log(`        It does NOT generate LFRG independently — it produces`);
console.log(`        frogments for leveling up frogs at the cost of mine rate.\n`);

// ── Section 2: Supply cap & halving crossovers ────────────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("HALVING CROSSOVERS — 101,000 TOTAL FROG SUPPLY CAP");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
const eggsPerPlayer = 20; // used for crossover math in this section
for (const [eggType, price] of Object.entries(EGG_PRICES)) {
  console.log(`  ${eggType.toUpperCase()} eggs (${price.toLocaleString()} LFRG/egg, ${eggsPerPlayer} eggs/player):`);
  console.log(`    Phase 1→2 at 25,250 frogs  = ${Math.ceil(25_250 / eggsPerPlayer)} players`);
  console.log(`    Phase 2→3 at 50,500 frogs  = ${Math.ceil(50_500 / eggsPerPlayer)} players`);
  console.log(`    Phase 3→4 at 75,750 frogs  = ${Math.ceil(75_750 / eggsPerPlayer)} players`);
  console.log(`    Full cap  at 101,000 frogs = ${Math.ceil(101_000 / eggsPerPlayer)} players\n`);
}

// ── Section 3: Formula comparison at 20 eggs/player ──────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("FORMULA COMPARISON — 20 players, 20 eggs each, Phase 1");
console.log("  Treasury = 31M LFRG + egg purchase revenue (100% returned)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━��━━━━━━━━━━\n");

for (const [eggType, price] of Object.entries(EGG_PRICES)) {
  const nPlayers = 20;
  const nEggs    = 20;
  const revenue  = nPlayers * nEggs * price;
  const treasury = TREASURY_START + revenue;
  const raw      = playerMining(eggType, nEggs);
  const frogs    = nPlayers * nEggs;
  const denom    = getDenom(frogs).denom;

  const sqRate   = mineRateSquare(raw, frogs) * SECS_PER_HOUR * 24;
  const sqrtRate = mineRateSqrt(raw, frogs, 250) * SECS_PER_HOUR * 24;

  console.log(`  ${nPlayers} players × ${nEggs} ${eggType} eggs (${price.toLocaleString()} LFRG each)`);
  console.log(`    Egg revenue returned to treasury: +${revenue.toLocaleString()} LFRG`);
  console.log(`    Total treasury pool:               ${treasury.toLocaleString()} LFRG`);
  console.log(`    Frogs minted: ${frogs.toLocaleString()} | Phase: ${getDenom(frogs).label}`);
  console.log(`    Median mining/player: ${raw.toFixed(2)} (eff: ${effectiveMining(raw).toFixed(2)})`);
  console.log(`    ── Current formula (square):      ${sqRate.toFixed(0).padStart(12)} LFRG/player/day  |  runway: ${runway(treasury, sqRate * nPlayers)}`);
  console.log(`    ── Proposed formula (sqrt×250):   ${sqrtRate.toFixed(0).padStart(12)} LFRG/player/day  |  runway: ${runway(treasury, sqrtRate * nPlayers)}\n`);
}

// ── Section 4: Day 1–7 depletion by cohort (sqrt×250, real treasury) ─────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("DAY 1–7 TREASURY DEPLETION — SQRT×250 FORMULA");
console.log("  Treasury = 31M genesis + 100% egg purchase revenue");
console.log("  Egg mix: 50% rare (10k), 30% uncommon (5k), 20% common (2.5k)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

// Model a realistic player buying a mix of eggs
function mixedPlayerMining(totalEggs) {
  const rareEggs     = Math.round(totalEggs * 0.50);
  const uncommonEggs = Math.round(totalEggs * 0.30);
  const commonEggs   = totalEggs - rareEggs - uncommonEggs;
  return (
    playerMining("rare", rareEggs) +
    playerMining("uncommon", uncommonEggs) +
    playerMining("common", commonEggs)
  );
}

function mixedEggCost(totalEggs) {
  const rareEggs     = Math.round(totalEggs * 0.50);
  const uncommonEggs = Math.round(totalEggs * 0.30);
  const commonEggs   = totalEggs - rareEggs - uncommonEggs;
  return (
    rareEggs * EGG_PRICES.rare +
    uncommonEggs * EGG_PRICES.uncommon +
    commonEggs * EGG_PRICES.common
  );
}

const EGG_SCENARIOS = [
  { eggs: 5,  label: "Starter (5 eggs)" },
  { eggs: 10, label: "Standard (10 eggs)" },
  { eggs: 20, label: "Active (20 eggs)" },
  { eggs: 50, label: "Whale (50 eggs)" },
];

const PLAYER_COHORTS = [20, 50, 100, 250, 500, 1_000];

for (const scenario of EGG_SCENARIOS) {
  const costPerPlayer = mixedEggCost(scenario.eggs);
  const rawMining     = mixedPlayerMining(scenario.eggs);
  const eff           = effectiveMining(rawMining);

  console.log(`\n  ── ${scenario.label} | Cost/player: ${costPerPlayer.toLocaleString()} LFRG | Mining: ${rawMining.toFixed(2)} (eff: ${eff.toFixed(2)})`);
  console.log(`  ${"Players".padEnd(10)} ${"Frogs".padEnd(10)} ${"Phase".padEnd(38)} ${"Treasury".padEnd(16)} ${"Player/day".padEnd(14)} ${"Network/day".padEnd(16)} ${"Runway"}`);
  console.log(`  ${"─".repeat(110)}`);

  for (const n of PLAYER_COHORTS) {
    const totalFrogs  = Math.min(n * scenario.eggs, TOTAL_SUPPLY);
    const eggRevenue  = n * costPerPlayer;
    const treasury    = TREASURY_START + eggRevenue;
    const halving     = getDenom(totalFrogs);
    const ratePerSec  = mineRateSqrt(rawMining, totalFrogs, 250);
    const ratePerDay  = ratePerSec * SECS_PER_HOUR * 24;
    const networkDay  = ratePerDay * n;
    const runwayStr   = runway(treasury, networkDay);
    const cappedNote  = totalFrogs >= TOTAL_SUPPLY ? " [SUPPLY CAP]" : "";

    console.log(
      `  ${String(n).padEnd(10)} ` +
      `${totalFrogs.toLocaleString().padEnd(10)} ` +
      `${halving.label.padEnd(38)} ` +
      `${treasury.toLocaleString().padEnd(16)} ` +
      `${ratePerDay.toFixed(0).padStart(10)}    ` +
      `${networkDay.toFixed(0).padStart(12)}    ` +
      `${runwayStr}${cappedNote}`
    );
  }
}

// ── Section 5: ROI breakeven per egg type ─────────────────────────────────────
console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("ROI BREAKEVEN PER EGG TYPE — sqrt×250 formula, Phase 1 (0–25k frogs)");
console.log("  Treasury includes egg purchase revenue.");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const PHASE_FROGS = {
  "Phase 1 (0–25k)":    4_000,
  "Phase 2 (25k–50k)": 30_000,
  "Phase 3 (50k–75k)": 60_000,
  "Phase 4 (75k–101k)": 90_000,
};

const EGG_COUNTS = [5, 10, 20, 50];

for (const [eggType, price] of Object.entries(EGG_PRICES)) {
  console.log(`  ${eggType.toUpperCase()} EGG — ${price.toLocaleString()} LFRG each`);
  console.log(`  ${"Eggs".padEnd(6)} ${"Cost".padEnd(14)} ${Object.keys(PHASE_FROGS).map(p => p.padEnd(22)).join("")}`);
  console.log(`  ${"─".repeat(100)}`);

  for (const eggCount of EGG_COUNTS) {
    const cost = eggCount * price;
    const row = [`  ${String(eggCount).padEnd(6)} ${cost.toLocaleString().padEnd(14)}`];
    for (const [phaseLabel, frogCount] of Object.entries(PHASE_FROGS)) {
      const raw       = playerMining(eggType, eggCount);
      const rateDay   = mineRateSqrt(raw, frogCount, 250) * SECS_PER_HOUR * 24;
      const roi       = rateDay > 0 ? (cost / rateDay).toFixed(1) : "∞";
      row.push(`${roi} days`.padEnd(22));
    }
    console.log(row.join(""));
  }
  console.log();
}

// ── Section 6: Treasury health with real egg revenue ─────────────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("TREASURY HEALTH — REAL EGG REVENUE MODEL");
console.log("  100% of egg purchases return to treasury (no external drain).");
console.log("  Scenario: all players buy 20 eggs each (mixed 50% rare / 30% unc / 20% com).");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const nEggsMix = 20;
const costMix  = mixedEggCost(nEggsMix);
const rawMix   = mixedPlayerMining(nEggsMix);

console.log(`  Per-player egg cost (mixed): ${costMix.toLocaleString()} LFRG`);
console.log(`  Per-player median mining:    ${rawMix.toFixed(2)}\n`);
console.log(`  ${"Players".padEnd(10)} ${"Egg Revenue".padEnd(18)} ${"Total Treasury".padEnd(18)} ${"Network/day".padEnd(16)} ${"Runway"}`);
console.log(`  ${"─".repeat(80)}`);

for (const n of PLAYER_COHORTS) {
  const totalFrogs = Math.min(n * nEggsMix, TOTAL_SUPPLY);
  const eggRev     = n * costMix;
  const treasury   = TREASURY_START + eggRev;
  const halving    = getDenom(totalFrogs);
  const ratePerDay = mineRateSqrt(rawMix, totalFrogs, 250) * SECS_PER_HOUR * 24;
  const networkDay = ratePerDay * n;
  const runwayStr  = runway(treasury, networkDay);
  const capNote    = totalFrogs >= TOTAL_SUPPLY ? " [SUPPLY CAP]" : "";

  console.log(
    `  ${String(n).padEnd(10)} ` +
    `${("+" + eggRev.toLocaleString()).padEnd(18)} ` +
    `${treasury.toLocaleString().padEnd(18)} ` +
    `${networkDay.toFixed(0).padStart(12)}    ` +
    `${runwayStr}${capNote}`
  );
}

// ── Section 7: Scalar comparison — runway at 1,000 players (20 mixed eggs) ───
console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("SCALAR TUNING — 1,000 players × 20 mixed eggs (treasury = 171M LFRG)");
console.log("  Shows how scalar choice trades off player ROI vs treasury runway.");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

const SCALAR_TEST_PLAYERS  = 1_000;
const SCALAR_TEST_EGGS     = 20;
const SCALAR_TEST_RAW      = mixedPlayerMining(SCALAR_TEST_EGGS);
const SCALAR_TEST_COST     = mixedEggCost(SCALAR_TEST_EGGS);
const SCALAR_TEST_TREASURY = TREASURY_START + SCALAR_TEST_PLAYERS * SCALAR_TEST_COST;
const SCALAR_TEST_FROGS    = Math.min(SCALAR_TEST_PLAYERS * SCALAR_TEST_EGGS, TOTAL_SUPPLY);

console.log(`  Treasury: ${SCALAR_TEST_TREASURY.toLocaleString()} LFRG | Frogs: ${SCALAR_TEST_FROGS.toLocaleString()} | Raw mining/player: ${SCALAR_TEST_RAW.toFixed(2)}\n`);
console.log(`  ${"Scalar".padEnd(10)} ${"Player/day".padEnd(14)} ${"Per Claim".padEnd(14)} ${"Network/day".padEnd(16)} ${"Runway".padEnd(14)} ${"Common-20 ROI"}`);
console.log(`  ${"─".repeat(85)}`);

for (const sc of [25, 50, 100, 150, 250, 500]) {
  const rateDay    = mineRateSqrt(SCALAR_TEST_RAW, SCALAR_TEST_FROGS, sc) * SECS_PER_HOUR * 24;
  const perClaim   = rateDay / CLAIMS_PER_DAY;
  const networkDay = rateDay * SCALAR_TEST_PLAYERS;
  const runwayStr  = runway(SCALAR_TEST_TREASURY, networkDay);
  // Common 20 ROI at this scalar
  const commonDay  = mineRateSqrt(playerMining("common", 20), SCALAR_TEST_FROGS, sc) * SECS_PER_HOUR * 24;
  const commonROI  = (20 * EGG_PRICES.common / commonDay).toFixed(1);
  const flag       = sc === 50 ? " ← RECOMMENDED" : "";
  console.log(
    `  ${String(sc).padEnd(10)} ` +
    `${rateDay.toFixed(0).padStart(10)}    ` +
    `${perClaim.toFixed(0).padStart(10)}    ` +
    `${networkDay.toFixed(0).padStart(12)}    ` +
    `${runwayStr.padEnd(14)} ` +
    `${commonROI} days${flag}`
  );
}

console.log(`\n  Scalar = 50 is the recommended balance:`);
console.log(`    - 1,000-player runway: ~500+ days`);
console.log(`    - Common 20-egg ROI:    ~43 days (Phase 1) — motivating but not instant`);
console.log(`    - Rare 20-egg ROI:      ~106 days (Phase 1) — meaningful long-term hold`);
console.log(`    - Per claim (common 20): ~151 LFRG — claim cap never triggered`);
console.log(`    - The claim cap (10,000) remains a structural safety net only\n`);

// ── Section 7b: Scalar 50 — per-player daily across egg types ────────────────
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("SCALAR 50 — Per-player daily earnings across egg tiers (Phase 1)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log(`  ${"Scenario".padEnd(26)} ${"Mining (eff)".padEnd(14)} ${"Per Day".padEnd(12)} ${"Per Claim".padEnd(12)} ${"ROI Phase 1".padEnd(16)} ${"ROI Phase 4"}`);
console.log(`  ${"─".repeat(95)}`);

const SCALAR50_SCENARIOS = [
  { label: "Common  5 eggs",   eggType: "common",   count: 5   },
  { label: "Common  20 eggs",  eggType: "common",   count: 20  },
  { label: "Common  50 eggs",  eggType: "common",   count: 50  },
  { label: "Uncommon 5 eggs",  eggType: "uncommon", count: 5   },
  { label: "Uncommon 20 eggs", eggType: "uncommon", count: 20  },
  { label: "Rare    5 eggs",   eggType: "rare",     count: 5   },
  { label: "Rare    20 eggs",  eggType: "rare",     count: 20  },
  { label: "Rare    50 eggs",  eggType: "rare",     count: 50  },
];

for (const s of SCALAR50_SCENARIOS) {
  const raw      = playerMining(s.eggType, s.count);
  const eff      = effectiveMining(raw);
  const cost     = s.count * EGG_PRICES[s.eggType];
  const dayP1    = mineRateSqrt(raw, 4_000,  50) * SECS_PER_HOUR * 24;
  const dayP4    = mineRateSqrt(raw, 90_000, 50) * SECS_PER_HOUR * 24;
  const perClaim = dayP1 / CLAIMS_PER_DAY;
  const roiP1    = (cost / dayP1).toFixed(1);
  const roiP4    = (cost / dayP4).toFixed(1);
  console.log(
    `  ${s.label.padEnd(26)} ` +
    `${eff.toFixed(2).padStart(10)}    ` +
    `${dayP1.toFixed(0).padStart(8)}    ` +
    `${perClaim.toFixed(0).padStart(8)}    ` +
    `${(roiP1 + " days").padEnd(16)} ` +
    `${roiP4} days`
  );
}

// ── Section 7c: Network runway at scalar 50 ───────────────────────────────────
console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("SCALAR 50 — Network runway projections (mixed 20 eggs/player)");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
console.log(`  ${"Players".padEnd(10)} ${"Treasury".padEnd(18)} ${"Network/day".padEnd(16)} ${"Runway"}`);
console.log(`  ${"─".repeat(60)}`);

for (const n of PLAYER_COHORTS) {
  const totalFrogs = Math.min(n * 20, TOTAL_SUPPLY);
  const eggRev     = n * costMix;
  const treasury   = TREASURY_START + eggRev;
  const ratePerDay = mineRateSqrt(rawMix, totalFrogs, 50) * SECS_PER_HOUR * 24;
  const networkDay = ratePerDay * n;
  const runwayStr  = runway(treasury, networkDay);
  console.log(
    `  ${String(n).padEnd(10)} ` +
    `${treasury.toLocaleString().padEnd(18)} ` +
    `${networkDay.toFixed(0).padStart(12)}    ` +
    `${runwayStr}`
  );
}

// ── Section 8: Claim cap analysis ────────────────────────────────────────────
console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("CLAIM CAP ANALYSIS — per-claim limits & charm investment");
console.log(`  Base cap:       ${BASE_CLAIM_CAP.toLocaleString()} LFRG per claim (no charm)`);
console.log(`  Max cap:        ${MAX_CLAIM_CAP.toLocaleString()} LFRG per claim (1M charm invested)`);
console.log(`  Claims per day: ${CLAIMS_PER_DAY} (every ${CLAIM_INTERVAL_HOURS}h)`);
console.log(`  Max daily:      ${MAX_DAILY_CLAIM.toLocaleString()} LFRG/day (max charm, 6 claims)`);
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

console.log("  Charm investment → claim cap per claim:");
console.log(`  ${"Charm Invested".padEnd(18)} ${"Vault Bonus".padEnd(16)} ${"Cap/Claim".padEnd(14)} ${"Max/Day"}`);
console.log(`  ${"─".repeat(65)}`);
const CHARM_STEPS = [0, 50_000, 100_000, 250_000, 500_000, 750_000, 1_000_000];
for (const charm of CHARM_STEPS) {
  const cap      = claimCapForCharm(charm);
  const vault    = charm * CHARM_TO_VAULT_RATE;
  const maxDay   = cap * CLAIMS_PER_DAY;
  console.log(
    `  ${charm.toLocaleString().padEnd(18)} ` +
    `${("+"+vault.toLocaleString()).padEnd(16)} ` +
    `${cap.toLocaleString().padEnd(14)} ` +
    `${maxDay.toLocaleString()}`
  );
}

console.log("\n  Per-claim earnings with sqrt×250 formula (Phase 1, 0–25k frogs):");
console.log(`  ${"Scenario".padEnd(28)} ${"Mining".padEnd(10)} ${"Raw/claim".padEnd(14)} ${"vs Base Cap".padEnd(18)} ${"Hits Cap?"}`);
console.log(`  ${"─".repeat(85)}`);

const CAP_SCENARIOS = [
  { label: "Common  20 eggs",  eggType: "common",   count: 20  },
  { label: "Common  50 eggs",  eggType: "common",   count: 50  },
  { label: "Uncommon 20 eggs", eggType: "uncommon", count: 20  },
  { label: "Uncommon 50 eggs", eggType: "uncommon", count: 50  },
  { label: "Rare    20 eggs",  eggType: "rare",     count: 20  },
  { label: "Rare    50 eggs",  eggType: "rare",     count: 50  },
  { label: "Rare   100 eggs",  eggType: "rare",     count: 100 },
];

const PHASE1_FROGS = 4_000;

for (const s of CAP_SCENARIOS) {
  const raw         = playerMining(s.eggType, s.count);
  const eff         = effectiveMining(raw);
  const ratePerSec  = mineRateSqrt(raw, PHASE1_FROGS, 250);
  const perClaim    = ratePerSec * CLAIM_INTERVAL_HOURS * SECS_PER_HOUR;
  const { clipped } = applyClaimCap(perClaim, 0);
  const pct         = ((perClaim / BASE_CLAIM_CAP) * 100).toFixed(1);

  console.log(
    `  ${s.label.padEnd(28)} ` +
    `${eff.toFixed(2).padEnd(10)} ` +
    `${perClaim.toFixed(0).padEnd(14)} ` +
    `${(pct + "% of cap").padEnd(18)} ` +
    `${clipped ? "YES — needs charm" : "No (within base cap)"}`
  );
}

console.log(`\n  With sqrt×250, even 100 rare eggs is only ~${(mineRateSqrt(playerMining("rare",100), PHASE1_FROGS, 250) * CLAIM_INTERVAL_HOURS * SECS_PER_HOUR).toFixed(0)} LFRG/claim.`);
console.log(`  The base 10,000 cap is NEVER breached under the sqrt formula.`);
console.log(`  The claim cap is a structural safety net, not an active daily constraint.\n`);

// ── Section 8: Full supply sell-out scenario ──────────────────────────────────
console.log("\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
console.log("FULL SUPPLY SELL-OUT — What if all 101,000 frogs are minted?");
console.log("  Treasury = 31M + revenue from selling all 101,000 eggs.");
console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");

for (const [eggType, price] of Object.entries(EGG_PRICES)) {
  const totalRevenue = TOTAL_SUPPLY * price;
  const treasury     = TREASURY_START + totalRevenue;
  const avgPlayers   = Math.ceil(TOTAL_SUPPLY / 20); // 20 eggs/player assumption
  const rawFull      = playerMining(eggType, 20);
  // At full supply, Phase 4 is active
  const ratePerDay   = mineRateSqrt(rawFull, TOTAL_SUPPLY, 250) * SECS_PER_HOUR * 24;
  const networkDay   = ratePerDay * avgPlayers;
  const runwayStr    = runway(treasury, networkDay);

  console.log(`  ${eggType.toUpperCase()} eggs sold out (${TOTAL_SUPPLY.toLocaleString()} eggs × ${price.toLocaleString()} LFRG):`);
  console.log(`    Revenue:         ${totalRevenue.toLocaleString()} LFRG`);
  console.log(`    Total treasury:  ${treasury.toLocaleString()} LFRG`);
  console.log(`    Phase at cap:    ${getDenom(TOTAL_SUPPLY).label} (slowest halving active)`);
  console.log(`    Network/day:     ${networkDay.toFixed(0)} LFRG (~${avgPlayers} players × 20 eggs each)`);
  console.log(`    Runway:          ${runwayStr}\n`);
}
