/**
 * scripts/economic-analysis.mjs
 *
 * Answers the exact question: 
 *   "After 50M tokens are spent on eggs, how many frogs exist,
 *    what is their combined mine rate, and can the treasury sustain it?"
 *
 * Key insight: egg purchases RETURN $LFRG to the treasury.
 *   Treasury net = starting_treasury + egg_revenue - total_mined_out
 *
 * Run: node scripts/economic-analysis.mjs
 */

import seedrandom from "seedrandom";

// ─────────────────────────────────────────────────────────────────────────────
// Constants (exact mirrors of app)
// ─────────────────────────────────────────────────────────────────────────────

const STARTING_TREASURY  = 31_000_000;   // current treasury
const EGG_SPEND_TARGET   = 50_000_000;   // total players spend on eggs
const TOTAL_SUPPLY_CAP   = 101_000;

const SUPPLY_CAP = {
  common:   60_000,
  uncommon: 25_000,
  rare:     12_000,
  epic:      3_000,
  legendary: 1_000,
};

const EGG_COST = { common: 2_500, uncommon: 5_000, rare: 10_000 };

const EGG_RARITY_WEIGHTS = {
  common:   { common: 90, uncommon: 9, rare: 0.75, epic: 0.2, legendary: 0.05 },
  uncommon: { uncommon: 95, rare: 4, epic: 0.9, legendary: 0.1 },
  rare:     { rare: 95, epic: 4, legendary: 1 },
};

const EGG_MIX = { rare: 0.50, uncommon: 0.30, common: 0.20 };

const STAT_ROLL_MULTIPLIERS = {
  mining: 2.0, luck: 0.5, crit: 0.5, dodge: 0.5, damage: 10, defense: 10,
};
const MINING_R = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };

// Halving schedule
const HALVING = [
  { pct: 0.25, denom: 6  * 3600, label: "Phase 1 — Genesis     (0–25,250 frogs)" },
  { pct: 0.50, denom: 12 * 3600, label: "Phase 2 — 1st Halving (25,251–50,500 frogs)" },
  { pct: 0.75, denom: 24 * 3600, label: "Phase 3 — 2nd Halving (50,501–75,750 frogs)" },
  { pct: 1.00, denom: 48 * 3600, label: "Phase 4 — 3rd Halving (75,751–101,000 frogs)" },
];

const MINING_SOFTCAP     = 333;
const SOFTCAP_EFFICIENCY = 0.5;

// Active player scenarios to test
const PLAYER_SCENARIOS = [500, 1_000, 2_000, 5_000];

// ─────────────────────────────────────────────────────────────────────────────
// Helpers (exact ports)
// ─────────────────────────────────────────────────────────────────────────────

function rollRarity(weights, rng) {
  const entries = Object.entries(weights);
  const total   = entries.reduce((s, [, w]) => s + w, 0);
  let roll      = rng() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

function generateFrogStats(cardId, seed, rarity) {
  const rng = seedrandom(`${cardId}-${seed}`);
  let R;
  switch (rarity) {
    case "common":    R = 1; break;
    case "uncommon":  R = rng() < 0.5 ? 1 : 2; break;
    case "rare":      R = rng() < 0.5 ? 2 : 3; break;
    case "epic":      R = rng() < 0.5 ? 3 : 4; break;
    case "legendary": R = 5; break;
    default:          R = 1;
  }
  const pool    = ["luck","dodge","crit","damage","defense"];
  const chosen  = [];
  for (let i = 0; i < R && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  const mR         = MINING_R[rarity] ?? 1;
  const rollInRange = () => rng() * (0.5 * mR) + 0.5 * mR;
  const stats      = { mining: 0, luck: 0, dodge: 0, crit: 0, damage: 0, defense: 0 };
  stats.mining     = rollInRange() * STAT_ROLL_MULTIPLIERS.mining;
  for (const stat of chosen) stats[stat] = rollInRange() * STAT_ROLL_MULTIPLIERS[stat];
  return stats;
}

function getHalvingDenom(totalMinted) {
  const sat = totalMinted / TOTAL_SUPPLY_CAP;
  for (const h of HALVING) if (sat <= h.pct) return h.denom;
  return 48 * 3600;
}

function getHalvingPhase(totalMinted) {
  const sat = totalMinted / TOTAL_SUPPLY_CAP;
  for (let i = 0; i < HALVING.length; i++) if (sat <= HALVING[i].pct) return i + 1;
  return 4;
}

/** computeMineRate — per-frog rate (LFRG/sec) */
function computeMineRate(miningStatSingle, halvingDenom) {
  const effective = miningStatSingle <= MINING_SOFTCAP
    ? miningStatSingle
    : MINING_SOFTCAP + (miningStatSingle - MINING_SOFTCAP) * SOFTCAP_EFFICIENCY;
  return Math.pow(effective + 1, 2) / halvingDenom;
}

/** 
 * computePlayerMineRate — player holds N frogs.
 * Each frog's rate is computed individually, then summed.
 * (The softcap applies per-frog, not to the total mining stat.)
 */
function computePlayerMineRate(frogs, halvingDenom) {
  return frogs.reduce((sum, f) => sum + computeMineRate(f.mining, halvingDenom), 0);
}

function fmt(n)     { return Number(n.toFixed(0)).toLocaleString("en-US"); }
function fmtF(n, d=2) { return n.toFixed(d); }
function fmtDays(d) {
  if (d >= 365) return `${(d/365).toFixed(1)} years`;
  if (d >= 30)  return `${(d/30).toFixed(1)} months`;
  return `${d.toFixed(1)} days`;
}
function bar(n, max, width=24) {
  const filled = Math.round((n / max) * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}
function pct(n, d=100) { return (n/d*100).toFixed(2)+"%"; }

// ─────────────────────────────────────────────────────────────────────────────
// Simulation
// ─────────────────────────────────────────────────────────────────────────────

function simulate() {
  let spent         = 0;
  let eggsBought    = 0;
  let totalMinted   = 0;
  const minted      = { common:0, uncommon:0, rare:0, epic:0, legendary:0 };
  const frogsAll    = [];           // every frog hatched
  const frogsByRarity = { common:[], uncommon:[], rare:[], epic:[], legendary:[] };

  const RARITIES = ["common","uncommon","rare","epic","legendary"];
  let tick = 0;

  while (spent < EGG_SPEND_TARGET && totalMinted < TOTAL_SUPPLY_CAP) {
    // Pick egg tier
    const r = Math.random();
    let acc = 0, chosenTier = "rare";
    for (const [tier, frac] of Object.entries(EGG_MIX)) {
      acc += frac;
      if (r < acc) { chosenTier = tier; break; }
    }

    const cost = EGG_COST[chosenTier];
    if (spent + cost > EGG_SPEND_TARGET) break;

    spent += cost;
    eggsBought++;

    const rarityRng = seedrandom(`egg-${tick}`);
    const rarity    = rollRarity(EGG_RARITY_WEIGHTS[chosenTier], rarityRng);

    if (minted[rarity] < SUPPLY_CAP[rarity]) {
      const stats = generateFrogStats(`${chosenTier}-${tick}`, tick, rarity);
      minted[rarity]++;
      totalMinted++;
      frogsAll.push(stats);
      frogsByRarity[rarity].push(stats);
    }
    tick++;
  }

  return { spent, eggsBought, totalMinted, minted, frogsAll, frogsByRarity };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const { spent, eggsBought, totalMinted, minted, frogsAll, frogsByRarity } = simulate();
  const RARITIES = ["common","uncommon","rare","epic","legendary"];
  const halvingPhase   = getHalvingPhase(totalMinted);
  const halvingDenom   = getHalvingDenom(totalMinted);
  const halvingLabel   = HALVING[halvingPhase - 1].label;

  // ── Treasury net ──────────────────────────────────────────────────────────
  // Egg purchases return $LFRG to treasury
  const treasuryAfterEggRevenue = STARTING_TREASURY + spent;

  // ── Per-frog mine rates ───────────────────────────────────────────────────
  // Each frog is individually rated; total is the network-wide drain rate
  const perFrogRates = frogsAll.map(f => computeMineRate(f.mining, halvingDenom));
  const totalNetworkRatePerSec = perFrogRates.reduce((s, r) => s + r, 0);

  const avgMining     = frogsAll.length > 0
    ? frogsAll.reduce((s,f) => s + f.mining, 0) / frogsAll.length : 0;

  // ─────────────────────────────────────────────────────────────────────────
  // PRINT
  // ─────────────────────────────────────────────────────────────────────────

  const SEP  = "═".repeat(66);
  const SEP2 = "─".repeat(66);

  console.log(`╔${SEP}╗`);
  console.log(`║  LUCKY FROG — ECONOMIC SUSTAINABILITY ANALYSIS                  ║`);
  console.log(`╚${SEP}╝\n`);

  // ── Q1: How many frogs when 50M is spent? ─────────────────────────────────
  console.log(`${SEP2}`);
  console.log(`  Q1. HOW MANY FROGS EXIST AFTER ${fmt(EGG_SPEND_TARGET)} $LFRG SPENT ON EGGS?`);
  console.log(`${SEP2}\n`);

  console.log(`  Eggs purchased       : ${fmt(eggsBought)}`);
  console.log(`  Frogs minted         : ${fmt(totalMinted)} / ${fmt(TOTAL_SUPPLY_CAP)} total supply`);
  console.log(`  Supply consumed      : ${pct(totalMinted, TOTAL_SUPPLY_CAP)}`);
  console.log(`  Halving phase        : ${halvingLabel}\n`);

  console.log(`  Frogs by rarity:`);
  for (const r of RARITIES) {
    const n   = minted[r];
    const cap = SUPPLY_CAP[r];
    console.log(`    ${r.padEnd(10)} ${fmt(n).padStart(7)} / ${fmt(cap).padStart(7)}  [${bar(n,cap,20)}] ${pct(n,cap)}`);
  }

  // ── Q2: Total mine rate ───────────────────────────────────────────────────
  console.log(`\n${SEP2}`);
  console.log(`  Q2. WHAT IS THE TOTAL MINE RATE OF ALL ${fmt(totalMinted)} FROGS?`);
  console.log(`${SEP2}\n`);

  console.log(`  Halving denominator  : ${halvingDenom/3600}h (${halvingLabel.split("—")[0].trim()})`);
  console.log(`  Avg mining stat      : ${fmtF(avgMining)}`);
  console.log(`\n  Network-wide drain (all ${fmt(totalMinted)} frogs minted, all active):`);
  console.log(`    Per second         : ${fmtF(totalNetworkRatePerSec, 4)} $LFRG/sec`);
  console.log(`    Per hour           : ${fmt(totalNetworkRatePerSec * 3600)} $LFRG/hr`);
  console.log(`    Per day            : ${fmt(totalNetworkRatePerSec * 86400)} $LFRG/day`);
  console.log(`    Per week           : ${fmt(totalNetworkRatePerSec * 86400 * 7)} $LFRG/week`);
  console.log(`    Per month (30d)    : ${fmt(totalNetworkRatePerSec * 86400 * 30)} $LFRG/month`);

  console.log(`\n  Average single frog  : ${fmtF(perFrogRates.reduce((s,r)=>s+r,0)/perFrogRates.length * 86400, 2)} $LFRG/day`);

  const minRate  = Math.min(...perFrogRates);
  const maxRate  = Math.max(...perFrogRates);
  console.log(`  Worst  frog (common) : ${fmtF(minRate * 86400, 2)} $LFRG/day`);
  console.log(`  Best   frog (legend) : ${fmtF(maxRate * 86400, 2)} $LFRG/day`);

  // ── Q3: Treasury sustainability ────────────────────────────────────────────
  console.log(`\n${SEP2}`);
  console.log(`  Q3. WHERE DOES THE BUDGET COME FROM? — TREASURY FLOW`);
  console.log(`${SEP2}\n`);

  console.log(`  Starting treasury    : ${fmt(STARTING_TREASURY)} $LFRG`);
  console.log(`  + Egg revenue        : ${fmt(spent)} $LFRG  (100% of egg purchases returned)`);
  console.log(`  ─────────────────────────────────────────────`);
  console.log(`  Treasury after 50M spend: ${fmt(treasuryAfterEggRevenue)} $LFRG  ← the actual budget`);
  console.log(`\n  KEY INSIGHT: The ${fmt(EGG_SPEND_TARGET)} $LFRG players spend on eggs`);
  console.log(`  goes BACK into the treasury. So the real question is how long`);
  console.log(`  ${fmt(treasuryAfterEggRevenue)} $LFRG lasts against the total mine rate above.\n`);

  // ── Q4: Sustainability per player count ───────────────────────────────────
  console.log(`${SEP2}`);
  console.log(`  Q4. HOW LONG DOES THE TREASURY LAST? (all ${halvingLabel.split("—")[0].trim()})`);
  console.log(`${SEP2}\n`);

  console.log(`  Treasury available   : ${fmt(treasuryAfterEggRevenue)} $LFRG`);
  console.log(`  Frogs minted         : ${fmt(totalMinted)}`);
  console.log(`  Avg frogs per player :`);
  console.log();
  console.log(`  ${"Players".padEnd(10)} ${"Frogs/player".padEnd(16)} ${"Rate/player/day".padEnd(20)} ${"Total drain/day".padEnd(20)} ${"Treasury lasts"}`);
  console.log(`  ${"─".repeat(8).padEnd(10)} ${"─".repeat(14).padEnd(16)} ${"─".repeat(18).padEnd(20)} ${"─".repeat(18).padEnd(20)} ${"─".repeat(14)}`);

  for (const numPlayers of PLAYER_SCENARIOS) {
    const frogsPerPlayer    = totalMinted / numPlayers;
    // Give each player an equal slice of the minted frogs (avg mining stat)
    // and compute their rate using per-frog formula
    const avgPlayerRatePerDay = (totalNetworkRatePerSec * 86400) / numPlayers;
    const totalDrainPerDay    = avgPlayerRatePerDay * numPlayers;
    const daysLeft            = treasuryAfterEggRevenue / totalDrainPerDay;

    console.log(
      `  ${fmt(numPlayers).padEnd(10)} ` +
      `${fmtF(frogsPerPlayer, 1).padEnd(16)} ` +
      `${fmt(avgPlayerRatePerDay).padEnd(20)} ` +
      `${fmt(totalDrainPerDay).padEnd(20)} ` +
      `${fmtDays(daysLeft)}`
    );
  }

  // ── Q5: Do you need to lower mine rates? ──────────────────────────────────
  console.log(`\n${SEP2}`);
  console.log(`  Q5. DO YOU NEED TO LOWER MINE RATES?`);
  console.log(`${SEP2}\n`);

  // "Safe" = treasury lasts until full supply is sold out (approx drain time)
  // Estimate: avg spend per frog from simulation, project remaining spend
  const spendPerFrog       = spent / totalMinted;
  const remainingFrogs     = TOTAL_SUPPLY_CAP - totalMinted;
  const projectedFutureRevenue = remainingFrogs * spendPerFrog;
  const projectedTotalTreasury = treasuryAfterEggRevenue + projectedFutureRevenue;

  console.log(`  If ALL ${fmt(TOTAL_SUPPLY_CAP)} frogs are eventually minted:`);
  console.log(`    Projected total egg revenue  : ${fmt(projectedFutureRevenue)} $LFRG`);
  console.log(`    Projected total treasury     : ${fmt(projectedTotalTreasury)} $LFRG\n`);

  // What daily drain can the treasury sustain over 1 year?
  const targetSustainDays   = 365;
  const sustainableDrainDay = projectedTotalTreasury / targetSustainDays;
  console.log(`  To sustain ${targetSustainDays} days of payout, max total drain/day:`);
  console.log(`    Max safe drain/day           : ${fmt(sustainableDrainDay)} $LFRG/day`);
  console.log(`    Actual drain/day (all minted): ${fmt(totalNetworkRatePerSec * 86400)} $LFRG/day`);

  const ratio = (totalNetworkRatePerSec * 86400) / sustainableDrainDay;
  if (ratio > 1) {
    console.log(`\n  VERDICT: Current rates are ${fmtF(ratio, 1)}× TOO HIGH for 1-year sustainability.`);
    console.log(`  Recommended rate multiplier  : ${fmtF(1/ratio, 3)}×  (lower denominator or soft-cap)`);
    console.log(`\n  OPTIONS TO FIX:`);
    console.log(`    A) Raise halving denominator  (reduces rate by slowing the clock)`);
    console.log(`       Current Phase 1: 6h → safe Phase 1: ${fmtF(6 * ratio, 1)}h denominator`);
    console.log(`    B) Lower mining softcap from ${MINING_SOFTCAP} → ${Math.round(MINING_SOFTCAP / Math.sqrt(ratio))}`);
    console.log(`       (cuts rate of high-mining frogs more than low-mining frogs)`);
    console.log(`    C) Raise stash cap time (currently 4h) → ${fmtF(4 * ratio, 1)}h`);
    console.log(`       (players can still earn the same, just slower drip)`);
    console.log(`    D) Partial revenue recycling is already happening — see Q3.`);
    console.log(`       Adding a 10–20% burn on egg purchases would extend treasury further.`);
  } else {
    console.log(`\n  VERDICT: Rates are sustainable. Treasury covers ${fmtDays(projectedTotalTreasury / (totalNetworkRatePerSec * 86400))}`);
    console.log(`  at peak payout even after full supply is minted.`);
  }

  // ── Per-halving phase treasury drain projection ────────────────────────────
  console.log(`\n${SEP2}`);
  console.log(`  Q6. TREASURY LIFESPAN ACROSS ALL 4 HALVING PHASES`);
  console.log(`     (assuming 2,000 active players, ${fmt(totalMinted)} frogs total)`);
  console.log(`${SEP2}\n`);

  const numPlayers = 2_000;
  const fropsPerPlayer = totalMinted / numPlayers;
  let cumulativeSpent = 0;
  let runningTreasury = treasuryAfterEggRevenue;

  console.log(`  ${"Phase".padEnd(42)} ${"Drain/day".padEnd(16)} ${"Duration".padEnd(16)} ${"Treasury left"}`);
  console.log(`  ${"─".repeat(40).padEnd(42)} ${"─".repeat(14).padEnd(16)} ${"─".repeat(14).padEnd(16)} ${"─".repeat(14)}`);

  for (let i = 0; i < HALVING.length; i++) {
    const h             = HALVING[i];
    const mintedAtPhase = Math.floor(h.pct * TOTAL_SUPPLY_CAP);
    const frogsInPhase  = Math.min(totalMinted, mintedAtPhase);

    // Compute per-frog rates at this halving denominator
    const perFrogRatesPhase = frogsAll
      .slice(0, frogsInPhase)
      .map(f => computeMineRate(f.mining, h.denom));
    const totalRatePhase     = perFrogRatesPhase.reduce((s, r) => s + r, 0);
    const drainPerDay        = totalRatePhase * 86400;

    // Phase end: either treasury hits 0 or all frogs in next phase
    const nextMinted    = i < HALVING.length - 1 ? Math.floor(HALVING[i+1].pct * TOTAL_SUPPLY_CAP) : TOTAL_SUPPLY_CAP;
    const additionalEggRevenue = (nextMinted - frogsInPhase) * spendPerFrog;
    runningTreasury    += additionalEggRevenue;

    const daysInPhase   = drainPerDay > 0 ? runningTreasury / drainPerDay : Infinity;
    const drained       = Math.min(runningTreasury, drainPerDay * daysInPhase);
    runningTreasury    -= drained;
    if (runningTreasury < 0) runningTreasury = 0;

    console.log(
      `  ${h.label.padEnd(42)} ` +
      `${fmt(drainPerDay).padEnd(16)} ` +
      `${fmtDays(daysInPhase).padEnd(16)} ` +
      `${fmt(Math.max(0, runningTreasury))}`
    );
  }

  console.log(`\n  NOTE: Each halving HALVES the mine rate (bigger denominator), which`);
  console.log(`  automatically extends the treasury — the economy self-corrects over time.\n`);
}

main();
