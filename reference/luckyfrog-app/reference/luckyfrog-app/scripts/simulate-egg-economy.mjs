/**
 * scripts/simulate-egg-economy.mjs
 *
 * Simulates egg purchases until 50M $LFRG tokens have been spent.
 * Uses the exact same logic as the app:
 *   - rollRarity()           → shared/drops/logic.ts
 *   - generateFrogStatsSeeded() → lib/modules/frogs/logic.ts
 *   - computeMineRate()      → shared/mining/logic.ts
 *   - getHalvingDenominator() → shared/data/halving.ts
 *
 * Outputs:
 *   1. Per-rarity stat summary (mining min/avg/max across all hatched frogs)
 *   2. Per-halving-phase mine-rate summary
 *   3. Supply depletion projection — at average mine-rate accrual from the
 *      treasury (15M LFRG), when does each rarity run out?
 *   4. Full supply-empty ETA
 *
 * Run from project root:
 *   node scripts/simulate-egg-economy.mjs
 *   node scripts/simulate-egg-economy.mjs --budget 100000000   (100M)
 *   node scripts/simulate-egg-economy.mjs --mix rare:60,uncommon:30,common:10
 */

import seedrandom from "seedrandom";

// ─────────────────────────────────────────────────────────────────────────────
// Config (mirrors app constants exactly)
// ─────────────────────────────────────────────────────────────────────────────

const BUDGET_LFRG     = parseArg("--budget", 50_000_000);
const EGG_MIX_RAW     = parseArg("--mix", "rare:50,uncommon:30,common:20");

// Supply cap per rarity — mirrors FROG_TEMPLATES in shared/data/frogs.ts
const SUPPLY_CAP = {
  common:    60_000,  // 12 × 5,000
  uncommon:  25_000,  // 10 × 2,500
  rare:      12_000,  //  8 × 1,500
  epic:       3_000,  //  6 × 500
  legendary:  1_000,  //  4 × 250
};
const TOTAL_SUPPLY_CAP = 101_000;

// Egg costs ($LFRG) — from shared/data/eggs.ts
const EGG_COST = {
  common:   2_500,
  uncommon: 5_000,
  rare:     10_000,
  // epic + legendary are drop-only, not purchasable
};

// Rarity weights per egg tier — verbatim from shared/data/eggs.ts
const EGG_RARITY_WEIGHTS = {
  common:    { common: 90, uncommon: 9, rare: 0.75, epic: 0.2, legendary: 0.05 },
  uncommon:  { uncommon: 95, rare: 4, epic: 0.9, legendary: 0.1 },
  rare:      { rare: 95, epic: 4, legendary: 1 },
};

// Stat roll multipliers — from shared/data/frogs.ts
const STAT_ROLL_MULTIPLIERS = {
  mining:  2.0,
  luck:    0.5,
  crit:    0.5,
  dodge:   0.5,
  damage:  10,
  defense: 10,
};

// Rarity → fixed R for mining range — from lib/modules/frogs/logic.ts
const MINING_R = {
  common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6,
};

// Halving schedule — from shared/data/halving.ts
const HALVING_SCHEDULE = [
  { saturationPct: 0.25, denominator: 6  * 3600, label: "Phase 1 — Genesis" },
  { saturationPct: 0.50, denominator: 12 * 3600, label: "Phase 2 — First Halving" },
  { saturationPct: 0.75, denominator: 24 * 3600, label: "Phase 3 — Second Halving" },
  { saturationPct: 1.00, denominator: 48 * 3600, label: "Phase 4 — Third Halving" },
];

// Mining softcap — from shared/data/stats.ts
const MINING_SOFTCAP      = 333;
const SOFTCAP_EFFICIENCY  = 0.5;

// Treasury assumption for "when does supply empty" projection
const TREASURY_LFRG = 15_000_000;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (exact ports from the app)
// ─────────────────────────────────────────────────────────────────────────────

/** Weighted rarity roll — exact port of rollRarity() (no epic bump) */
function rollRarity(weights, rng) {
  const entries = Object.entries(weights);
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

/** Stat roller — exact port of generateFrogStatsSeeded() */
function generateFrogStats(cardId, seed, rarity) {
  const rng = seedrandom(`${cardId}-${seed}`);

  // Step 1: R (bonus stat count)
  let R;
  switch (rarity) {
    case "common":    R = 1; break;
    case "uncommon":  R = rng() < 0.5 ? 1 : 2; break;
    case "rare":      R = rng() < 0.5 ? 2 : 3; break;
    case "epic":      R = rng() < 0.5 ? 3 : 4; break;
    case "legendary": R = 5; break;
    default:          R = 1;
  }

  // Step 2–3: pick R bonus slots
  const RANDOM_SLOTS = ["luck", "dodge", "crit", "damage", "defense"];
  const pool = [...RANDOM_SLOTS];
  const chosen = [];
  for (let i = 0; i < R && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }

  // Step 4: roll in [0.5*mR, mR] — no rarity overlap
  const mR = MINING_R[rarity] ?? 1;
  const rollInRange = () => rng() * (0.5 * mR) + 0.5 * mR;

  const stats = { mining: 0, luck: 0, dodge: 0, crit: 0, damage: 0, defense: 0 };
  stats.mining = rollInRange() * STAT_ROLL_MULTIPLIERS.mining;
  for (const stat of chosen) {
    stats[stat] = rollInRange() * STAT_ROLL_MULTIPLIERS[stat];
  }
  return stats;
}

/** Halving denominator — exact port of getHalvingDenominator() */
function getHalvingDenominator(totalMinted) {
  const saturation = totalMinted / TOTAL_SUPPLY_CAP;
  for (const step of HALVING_SCHEDULE) {
    if (saturation <= step.saturationPct) return step.denominator;
  }
  return 48 * 3600;
}

function getHalvingLabel(totalMinted) {
  const saturation = totalMinted / TOTAL_SUPPLY_CAP;
  for (const step of HALVING_SCHEDULE) {
    if (saturation <= step.saturationPct) return step.label;
  }
  return HALVING_SCHEDULE[HALVING_SCHEDULE.length - 1].label;
}

/** Mine rate (LFRG/sec) — exact port of computeMineRate() (no decay; fresh player) */
function computeMineRate(totalMining, halvingDenominator) {
  const effective = totalMining <= MINING_SOFTCAP
    ? totalMining
    : MINING_SOFTCAP + (totalMining - MINING_SOFTCAP) * SOFTCAP_EFFICIENCY;
  return Math.pow(effective + 1, 2) / halvingDenominator;
}

// ─────────────────────────────────────────────────────────────────────────────
// Parse egg mix
// ─────────────────────────────────────────────────────────────────────────────

function parseEggMix(raw) {
  const parts = raw.split(",");
  const mix = {};
  for (const part of parts) {
    const [tier, pctStr] = part.split(":");
    mix[tier.trim()] = parseFloat(pctStr);
  }
  // Normalise to fractions
  const total = Object.values(mix).reduce((s, v) => s + v, 0);
  for (const k of Object.keys(mix)) mix[k] /= total;
  return mix;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main simulation
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const eggMix = parseEggMix(EGG_MIX_RAW);

  console.log("╔══════════════════════════════════════════════════════════════╗");
  console.log("║       LUCKY FROG MINE — EGG ECONOMY SIMULATION              ║");
  console.log("╚══════════════════════════════════════════════════════════════╝\n");
  console.log(`Budget:      ${fmt(BUDGET_LFRG)} $LFRG`);
  console.log(`Egg mix:     ${Object.entries(eggMix).map(([t, p]) => `${t} ${(p*100).toFixed(0)}%`).join("  |  ")}`);
  console.log(`Supply cap:  ${fmt(TOTAL_SUPPLY_CAP)} frogs total\n`);

  // ── State ────────────────────────────────────────────────────────────────
  let spent          = 0;
  let eggsBought     = 0;
  let totalMinted    = 0;
  const minted       = { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 };
  const eggsBoughtBy = { common: 0, uncommon: 0, rare: 0 };
  const frogsHatched = { common: [], uncommon: [], rare: [], epic: [], legendary: [] };

  // Track per-halving-phase: minted count at phase entry and mining stats
  const phaseStats = HALVING_SCHEDULE.map(s => ({
    label:         s.label,
    denominator:   s.denominator,
    minted_start:  0,
    minted_end:    0,
    frogs:         [],
  }));
  let currentPhaseIdx = 0;

  // ── Simulate ─────────────────────────────────────────────────────────────
  let tick = 0;

  while (spent < BUDGET_LFRG && totalMinted < TOTAL_SUPPLY_CAP) {
    // Pick egg tier based on mix
    const r = Math.random();
    let acc = 0;
    let chosenTier = "rare";
    for (const [tier, frac] of Object.entries(eggMix)) {
      acc += frac;
      if (r < acc) { chosenTier = tier; break; }
    }

    const cost = EGG_COST[chosenTier];
    if (spent + cost > BUDGET_LFRG) break;

    spent += cost;
    eggsBought++;
    eggsBoughtBy[chosenTier]++;

    // Roll frog rarity from this egg tier
    const rarityRng = seedrandom(`egg-${tick}`);
    const rarity = rollRarity(EGG_RARITY_WEIGHTS[chosenTier], rarityRng);

    // Check supply cap for this rarity
    if (minted[rarity] >= SUPPLY_CAP[rarity]) {
      tick++;
      continue; // slot exhausted, egg hatch fails (no frog minted)
    }

    // Mint frog — roll stats
    const cardId = `${chosenTier}-${tick}`;
    const stats  = generateFrogStats(cardId, tick, rarity);

    minted[rarity]++;
    totalMinted++;
    frogsHatched[rarity].push(stats);

    // Track halving phase transitions
    const phaseIdx = HALVING_SCHEDULE.findIndex(
      s => totalMinted / TOTAL_SUPPLY_CAP <= s.saturationPct
    );
    const pIdx = phaseIdx === -1 ? HALVING_SCHEDULE.length - 1 : phaseIdx;
    if (pIdx !== currentPhaseIdx) {
      phaseStats[currentPhaseIdx].minted_end = totalMinted - 1;
      phaseStats[pIdx].minted_start = totalMinted;
      currentPhaseIdx = pIdx;
    }
    phaseStats[pIdx].frogs.push(stats);

    tick++;
  }

  phaseStats[currentPhaseIdx].minted_end = totalMinted;

  // ─────────────────────────────────────────────────────────────────────────
  // Section 1 — Overview
  // ─────────────────────────────────────────────────────────────────────────

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 1 — SPEND OVERVIEW");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`  Total spent:      ${fmt(spent)} $LFRG  (budget: ${fmt(BUDGET_LFRG)})`);
  console.log(`  Eggs purchased:   ${fmt(eggsBought)}`);
  console.log(`  Frogs minted:     ${fmt(totalMinted)} / ${fmt(TOTAL_SUPPLY_CAP)} (${(totalMinted/TOTAL_SUPPLY_CAP*100).toFixed(2)}% of supply)`);
  console.log();
  console.log("  Eggs bought by tier:");
  for (const [tier, n] of Object.entries(eggsBoughtBy)) {
    console.log(`    ${tier.padEnd(10)} ${fmt(n).padStart(8)} eggs   ${fmt(n * EGG_COST[tier]).padStart(12)} $LFRG`);
  }
  console.log();
  console.log("  Frogs minted by rarity:");
  for (const [rarity, n] of Object.entries(minted)) {
    const cap = SUPPLY_CAP[rarity];
    const pct = (n / cap * 100).toFixed(1);
    const bar = progressBar(n, cap, 20);
    console.log(`    ${rarity.padEnd(10)} ${fmt(n).padStart(6)} / ${fmt(cap).padStart(6)}  [${bar}] ${pct.padStart(5)}%`);
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section 2 — Per-Rarity Mine Rate Stats
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 2 — FROG MINING STAT DISTRIBUTION (per rarity)");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("  All values are the raw mining stat (before level multiplier or halving).\n");

  const RARITIES = ["common", "uncommon", "rare", "epic", "legendary"];
  const miningRanges = {};

  for (const rarity of RARITIES) {
    const frogs = frogsHatched[rarity];
    if (frogs.length === 0) {
      console.log(`  ${rarity.padEnd(10)} — no frogs minted`);
      continue;
    }
    const miningVals = frogs.map(f => f.mining);
    const min  = Math.min(...miningVals);
    const max  = Math.max(...miningVals);
    const avg  = miningVals.reduce((a, b) => a + b, 0) / miningVals.length;
    const p10  = percentile(miningVals, 10);
    const p90  = percentile(miningVals, 90);

    miningRanges[rarity] = { min, max, avg, p10, p90 };

    console.log(`  ${rarity.toUpperCase().padEnd(12)} (${fmt(frogs.length)} frogs)`);
    console.log(`    Expected range : [${fmtStat(MINING_R[rarity] * STAT_ROLL_MULTIPLIERS.mining * 0.5)}, ${fmtStat(MINING_R[rarity] * STAT_ROLL_MULTIPLIERS.mining)}]`);
    console.log(`    Actual min     : ${fmtStat(min)}`);
    console.log(`    p10            : ${fmtStat(p10)}`);
    console.log(`    Average        : ${fmtStat(avg)}`);
    console.log(`    p90            : ${fmtStat(p90)}`);
    console.log(`    Actual max     : ${fmtStat(max)}`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section 3 — Mine Rate Per Halving Phase
  // ─────────────────────────────────────────────────────────────────────────

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 3 — MINE RATE PER HALVING PHASE");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("  Mine rate = (effectiveMining+1)² / halvingDenominator  (LFRG/sec)\n");

  for (const phase of phaseStats) {
    const frogs = phase.frogs;
    if (frogs.length === 0) continue;

    const miningVals = frogs.map(f => f.mining);
    const avgMining  = miningVals.reduce((a, b) => a + b, 0) / miningVals.length;
    const maxMining  = Math.max(...miningVals);
    const minMining  = Math.min(...miningVals);

    const rateAtAvg  = computeMineRate(avgMining,  phase.denominator);
    const rateAtMax  = computeMineRate(maxMining,  phase.denominator);
    const rateAtMin  = computeMineRate(minMining,  phase.denominator);

    const secPerHr   = 3600;

    console.log(`  ${phase.label}`);
    console.log(`    Denominator    : ${(phase.denominator / 3600).toFixed(0)}h = ${fmt(phase.denominator)}s`);
    console.log(`    Frogs minted   : ${fmt(frogs.length)} (cumulative: ${fmt(phase.minted_end)})`);
    console.log(`    Mining stat    : min=${fmtStat(minMining)}  avg=${fmtStat(avgMining)}  max=${fmtStat(maxMining)}`);
    console.log(`    Rate @ avg     : ${fmtRate(rateAtAvg * secPerHr)} LFRG/hr  (${fmtRate(rateAtAvg * 86400)} LFRG/day)`);
    console.log(`    Rate @ max     : ${fmtRate(rateAtMax * secPerHr)} LFRG/hr  (${fmtRate(rateAtMax * 86400)} LFRG/day)`);
    console.log(`    Rate @ min     : ${fmtRate(rateAtMin * secPerHr)} LFRG/hr  (${fmtRate(rateAtMin * 86400)} LFRG/day)`);
    console.log();
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section 4 — Supply Depletion Projection
  // ─────────────────────────────────────────────────────────────────────────

  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 4 — SUPPLY DEPLETION PROJECTION");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log(`  Treasury: ${fmt(TREASURY_LFRG)} $LFRG`);
  console.log("  Assumption: spending continues at the same egg mix until supply is empty.\n");

  // Extrapolate full supply from the current spend rate
  const spendPerFrog     = totalMinted > 0 ? spent / totalMinted : 0;
  const spendPerEgg      = spent / eggsBought;
  const totalFrogsNeeded = TOTAL_SUPPLY_CAP;
  const totalSpendNeeded = spendPerFrog * totalFrogsNeeded;

  console.log(`  Observed spend per egg:  ${fmt(Math.round(spendPerEgg))} $LFRG`);
  console.log(`  Observed spend per frog: ${fmt(Math.round(spendPerFrog))} $LFRG`);
  console.log(`  Est. total spend to mint all ${fmt(TOTAL_SUPPLY_CAP)} frogs: ${fmt(Math.round(totalSpendNeeded))} $LFRG\n`);

  // How many more eggs at current mix until each rarity runs dry
  for (const rarity of RARITIES) {
    const remaining = SUPPLY_CAP[rarity] - minted[rarity];
    if (remaining <= 0) {
      console.log(`  ${rarity.padEnd(10)} SUPPLY EXHAUSTED`);
      continue;
    }
    // Expected eggs per frog of this rarity (based on simulation)
    const eggsPerFrogOfRarity = eggsBought / (minted[rarity] || 1);
    const eggsNeeded          = remaining * eggsPerFrogOfRarity;
    const lfrgNeeded          = eggsNeeded * spendPerEgg;
    console.log(`  ${rarity.padEnd(10)} ${fmt(remaining).padStart(7)} frogs left  ~${fmt(Math.round(eggsNeeded)).padStart(9)} more eggs  ~${fmt(Math.round(lfrgNeeded)).padStart(14)} $LFRG needed`);
  }

  // Phase-by-phase spend estimate
  console.log("\n  Estimated spend to cross each halving threshold:");
  for (const step of HALVING_SCHEDULE) {
    const threshold = Math.floor(step.saturationPct * TOTAL_SUPPLY_CAP);
    if (threshold <= totalMinted) {
      const label = step.label.split("—")[1].trim();
      console.log(`    ${label.padEnd(25)} already crossed at ~${fmt(Math.round(spendPerFrog * threshold))} $LFRG`);
    } else {
      const additionalFrogs = threshold - totalMinted;
      const additionalSpend = additionalFrogs * spendPerFrog;
      const label = step.label.split("—")[1].trim();
      console.log(`    ${label.padEnd(25)} ~${fmt(Math.round(spent + additionalSpend))} $LFRG total spend (${fmt(Math.round(additionalSpend))} more)`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // Section 5 — Full-Supply Aggregate Mine Rate
  // ─────────────────────────────────────────────────────────────────────────

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  SECTION 5 — AGGREGATE MINE RATE IF ONE PLAYER HELD ALL MINTED FROGS");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
  console.log("  (Theoretical ceiling — actual players each hold a fraction of supply)\n");

  const allFrogs    = RARITIES.flatMap(r => frogsHatched[r]);
  const totalMining = allFrogs.reduce((s, f) => s + f.mining, 0);
  const avgMiningAll = allFrogs.length > 0 ? totalMining / allFrogs.length : 0;

  for (const phase of HALVING_SCHEDULE) {
    const rateAll = computeMineRate(totalMining, phase.denominator);
    const ratePer = computeMineRate(avgMiningAll, phase.denominator);
    console.log(`  ${phase.label}`);
    console.log(`    All frogs total mining  : ${fmtStat(totalMining)}`);
    console.log(`    Rate (all frogs, 1 player): ${fmtRate(rateAll * 86400)} LFRG/day`);
    console.log(`    Rate per average frog   : ${fmtRate(ratePer * 86400)} LFRG/day`);
    console.log();
  }

  // Treasury drain rate — how long does 15M LFRG last at current mining pace
  console.log("  Treasury drain estimate:");
  const avgRatePhase1 = computeMineRate(avgMiningAll, 6 * 3600);
  const avgRatePhase4 = computeMineRate(avgMiningAll, 48 * 3600);
  if (allFrogs.length > 0) {
    const playersEstimate = 2000; // conservative active player count
    const frogsPerPlayer  = totalMinted / playersEstimate;
    const avgPlayerMining = avgMiningAll * frogsPerPlayer;
    const playerRateP1    = computeMineRate(avgPlayerMining, 6 * 3600);
    const playerRateP4    = computeMineRate(avgPlayerMining, 48 * 3600);
    const totalRateP1     = playerRateP1 * playersEstimate;
    const totalRateP4     = playerRateP4 * playersEstimate;
    const daysP1          = TREASURY_LFRG / (totalRateP1 * 86400);
    const daysP4          = TREASURY_LFRG / (totalRateP4 * 86400);

    console.log(`  Assuming ${fmt(playersEstimate)} active players, ${fmtStat(frogsPerPlayer)} avg frogs each:`);
    console.log(`    Phase 1 (6h denom): total mine rate ${fmtRate(totalRateP1 * 3600)} LFRG/hr → treasury lasts ${daysP1.toFixed(1)} days`);
    console.log(`    Phase 4 (48h denom): total mine rate ${fmtRate(totalRateP4 * 3600)} LFRG/hr → treasury lasts ${daysP4.toFixed(1)} days`);
    console.log();

    // At what minted count does supply deplete if spending continues
    console.log(`  Full 101,000 supply at current spend rate (~${fmt(Math.round(spendPerEgg))} $LFRG/egg):`);
    console.log(`    ~${fmt(Math.round(totalSpendNeeded))} $LFRG total needed to mint every frog`);
    console.log(`    = ~${(totalSpendNeeded / BUDGET_LFRG).toFixed(1)}× the current 50M budget`);
    const eggsTotalNeeded = Math.round(totalSpendNeeded / spendPerEgg);
    console.log(`    = ~${fmt(eggsTotalNeeded)} total egg purchases`);
  }

  console.log("\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
  console.log("  Simulation complete.");
  console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function fmt(n) {
  if (typeof n !== "number") return String(n);
  return n.toLocaleString("en-US");
}

function fmtStat(n) {
  return n.toFixed(4);
}

function fmtRate(n) {
  return n.toFixed(4);
}

function percentile(arr, p) {
  const sorted = [...arr].sort((a, b) => a - b);
  const idx    = Math.floor((p / 100) * (sorted.length - 1));
  return sorted[idx];
}

function progressBar(value, max, width) {
  const filled = Math.round((value / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

function parseArg(flag, defaultVal) {
  const args = process.argv.slice(2);
  const idx  = args.indexOf(flag);
  if (idx === -1 || idx + 1 >= args.length) return defaultVal;
  const raw = args[idx + 1];
  if (typeof defaultVal === "number") return parseFloat(raw);
  return raw;
}

main();
