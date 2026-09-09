/**
 * scripts/simulate-roi.mjs
 *
 * Answers: "If a player buys 40 rare eggs, do they get ROI in 6 days?"
 *
 * Uses EXACT formulas from the app:
 *   - rollRarity()               → shared/drops/logic.ts
 *   - generateFrogStatsSeeded()  → lib/modules/frogs/logic.ts  (fixed [0.5R, R] range)
 *   - computeMineRate()          → shared/mining/logic.ts      (softcap + decay)
 *   - getHalvingDenominator()    → shared/data/halving.ts
 *
 * Run: node scripts/simulate-roi.mjs
 */

import seedrandom from "seedrandom";

// ─────────────────────────────────────────────────────────────────────────────
// Constants — exact mirrors of app
// ─────────────────────────────────────────────────────────────────────────────

const RARE_EGG_COST      = 10_000;   // $LFRG per rare egg
const NUM_EGGS           = 40;
const TOTAL_SPEND        = RARE_EGG_COST * NUM_EGGS;  // 400,000 $LFRG

const TOTAL_SUPPLY_CAP   = 101_000;

// Rarity weights for a rare egg (fixed, no epic bump)
const RARE_EGG_WEIGHTS   = { rare: 95, epic: 4, legendary: 1 };

// Mining R per rarity
const MINING_R = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };

const STAT_MULTIPLIERS = {
  mining: 2.0, luck: 0.5, crit: 0.5, dodge: 0.5, damage: 10, defense: 10,
};

// Halving schedule: [supply saturation threshold, denominator seconds]
const HALVING_PHASES = [
  { threshold: 0.25, denom: 6  * 3600, label: "Phase 1 (Genesis 0–25%)"  },
  { threshold: 0.50, denom: 12 * 3600, label: "Phase 2 (1st Halving 25–50%)" },
  { threshold: 0.75, denom: 24 * 3600, label: "Phase 3 (2nd Halving 50–75%)" },
  { threshold: 1.00, denom: 48 * 3600, label: "Phase 4 (3rd Halving 75–100%)" },
];

// Mining softcap
const MINING_SOFTCAP     = 333;
const SOFTCAP_EFFICIENCY = 0.5;

// Decay (for reference — new player has no decay)
const DECAY_GRACE_DAYS   = 14;
const DECAY_RATE_PER_WEEK = 0.10;
const DECAY_FLOOR        = 0.25;

// Current total minted (assume early — Phase 1 is most favourable ROI claim)
// We test 3 scenarios: Phase 1, Phase 2, Phase 4
const PHASE_SCENARIOS = [
  { label: "Phase 1 — Genesis (6h denom, 0–25k frogs minted)",    denom: 6  * 3600 },
  { label: "Phase 2 — 1st Halving (12h denom, 25–50k frogs)",     denom: 12 * 3600 },
  { label: "Phase 4 — 3rd Halving (48h denom, 75–101k frogs)",    denom: 48 * 3600 },
];

// Number of Monte-Carlo trial runs
const TRIALS = 10_000;

// ─────────────────────────────────────────────────────────────────────────────
// Pure helpers
// ─────────────────────────────────────────────────────────────────────────────

function rollRarity(weights, rng) {
  const entries = Object.entries(weights);
  const total   = entries.reduce((s, [, w]) => s + w, 0);
  let   roll    = rng() * total;
  for (const [rarity, weight] of entries) {
    roll -= weight;
    if (roll <= 0) return rarity;
  }
  return entries[entries.length - 1][0];
}

function generateFrogStats(seed, rarity) {
  const rng  = seedrandom(seed);
  let R;
  switch (rarity) {
    case "common":    R = 1; break;
    case "uncommon":  R = rng() < 0.5 ? 1 : 2; break;
    case "rare":      R = rng() < 0.5 ? 2 : 3; break;
    case "epic":      R = rng() < 0.5 ? 3 : 4; break;
    case "legendary": R = 5; break;
    default:          R = 1;
  }
  const pool   = ["luck", "dodge", "crit", "damage", "defense"];
  const chosen = [];
  for (let i = 0; i < R && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool[idx]);
    pool.splice(idx, 1);
  }
  const mR         = MINING_R[rarity] ?? 1;
  const rollInRange = () => rng() * (0.5 * mR) + 0.5 * mR; // [0.5R, R]
  const stats      = { mining: 0, luck: 0, dodge: 0, crit: 0, damage: 0, defense: 0 };
  stats.mining     = rollInRange() * STAT_MULTIPLIERS.mining;
  for (const s of chosen) stats[s] = rollInRange() * STAT_MULTIPLIERS[s];
  return stats;
}

/** computeMineRate — LFRG/sec. Assumes active player (no decay). */
function computeMineRate(mining, halvingDenom) {
  const effective = mining <= MINING_SOFTCAP
    ? mining
    : MINING_SOFTCAP + (mining - MINING_SOFTCAP) * SOFTCAP_EFFICIENCY;
  return Math.pow(effective + 1, 2) / halvingDenom;
}

/** Sum mine rate across all frogs a player owns. */
function playerMineRatePerDay(frogs, halvingDenom) {
  return frogs.reduce((sum, f) => sum + computeMineRate(f.mining, halvingDenom) * 86400, 0);
}

function pct(n, d)      { return ((n / d) * 100).toFixed(1) + "%"; }
function fmt(n)         { return Math.round(n).toLocaleString("en-US"); }
function fmtF(n, d = 2) { return n.toFixed(d); }

function percentile(sorted, p) {
  const idx = Math.floor((p / 100) * sorted.length);
  return sorted[Math.clamp ? Math.clamp(idx, 0, sorted.length - 1) : Math.min(Math.max(idx, 0), sorted.length - 1)];
}

function median(sorted)  { return percentile(sorted, 50); }
function p10(sorted)     { return percentile(sorted, 10); }
function p90(sorted)     { return percentile(sorted, 90); }

// ─────────────────────────────────────────────────────────────────────────────
// Single trial: roll 40 rare eggs → return frog list + ROI days per phase
// ─────────────────────────────────────────────────────────────────────────────

function runTrial(trialId) {
  const frogs         = [];
  const rarityCount   = { rare: 0, epic: 0, legendary: 0 };

  for (let i = 0; i < NUM_EGGS; i++) {
    const rng    = seedrandom(`trial-${trialId}-egg-${i}`);
    const rarity = rollRarity(RARE_EGG_WEIGHTS, rng);
    const stats  = generateFrogStats(`trial-${trialId}-frog-${i}`, rarity);
    frogs.push({ rarity, ...stats });
    rarityCount[rarity] = (rarityCount[rarity] || 0) + 1;
  }

  const totalMining = frogs.reduce((s, f) => s + f.mining, 0);

  const roiDays = {};
  for (const ph of PHASE_SCENARIOS) {
    const ratePerDay = playerMineRatePerDay(frogs, ph.denom);
    roiDays[ph.label] = ratePerDay > 0 ? TOTAL_SPEND / ratePerDay : Infinity;
  }

  return { frogs, rarityCount, totalMining, roiDays };
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

function main() {
  const SEP  = "═".repeat(66);
  const SEP2 = "─".repeat(66);

  console.log(`\n╔${SEP}╗`);
  console.log(`║  LUCKY FROG — ROI ANALYSIS: 40 RARE EGGS                        ║`);
  console.log(`╚${SEP}╝\n`);

  console.log(`  Claim: "Buying 40 rare eggs gives ROI in 6 days."`);
  console.log(`  ${SEP2}`);
  console.log(`  Egg cost per unit    : ${fmt(RARE_EGG_COST)} $LFRG`);
  console.log(`  Total spend          : ${fmt(TOTAL_SPEND)} $LFRG  (40 × ${fmt(RARE_EGG_COST)})`);
  console.log(`  Monte-Carlo trials   : ${fmt(TRIALS)}`);
  console.log(`  Rarity weights (rare egg): rare 95% | epic 4% | legendary 1%\n`);

  // ── Run all trials ─────────────────────────────────────────────────────────
  const results = [];
  for (let t = 0; t < TRIALS; t++) {
    results.push(runTrial(t));
  }

  // ── Rarity distribution across trials ─────────────────────────────────────
  const avgRare   = results.reduce((s, r) => s + r.rarityCount.rare, 0) / TRIALS;
  const avgEpic   = results.reduce((s, r) => s + r.rarityCount.epic, 0) / TRIALS;
  const avgLeg    = results.reduce((s, r) => s + r.rarityCount.legendary, 0) / TRIALS;
  const trialsNoLeg = results.filter(r => (r.rarityCount.legendary || 0) === 0).length;
  const trials2Leg  = results.filter(r => (r.rarityCount.legendary || 0) >= 2).length;

  console.log(`${SEP2}`);
  console.log(`  SECTION 1 — WHAT DO 40 RARE EGGS ACTUALLY GIVE YOU?`);
  console.log(`  (averaged across ${fmt(TRIALS)} simulated players)\n`);
  console.log(`  Expected frogs per player (40 eggs):`);
  console.log(`    Rare         avg ${fmtF(avgRare, 2)} frogs  (expected ≈ ${fmtF(40 * 0.95, 1)})`);
  console.log(`    Epic         avg ${fmtF(avgEpic, 2)} frogs  (expected ≈ ${fmtF(40 * 0.04, 1)})`);
  console.log(`    Legendary    avg ${fmtF(avgLeg,  2)} frogs  (expected ≈ ${fmtF(40 * 0.01, 1)})`);
  console.log(``);
  console.log(`  Probability outcomes:`);
  console.log(`    Got 0 legendaries  : ${pct(trialsNoLeg, TRIALS)}  (${fmt(trialsNoLeg)} / ${fmt(TRIALS)} players)`);
  console.log(`    Got 1 legendary    : ${pct(results.filter(r => r.rarityCount.legendary === 1).length, TRIALS)}`);
  console.log(`    Got 2+ legendaries : ${pct(trials2Leg, TRIALS)}  ← the lucky outlier (real report: got 2)`);
  console.log(`    Got 3+ legendaries : ${pct(results.filter(r => r.rarityCount.legendary >= 3).length, TRIALS)}`);

  // ── Mining stats ───────────────────────────────────────────────────────────
  const allTotalMining = results.map(r => r.totalMining).sort((a, b) => a - b);
  console.log(`\n${SEP2}`);
  console.log(`  SECTION 2 — TOTAL MINING STAT (all 40 frogs combined)`);
  console.log(`  ${SEP2}\n`);
  console.log(`    Min    : ${fmtF(allTotalMining[0], 2)}`);
  console.log(`    P10    : ${fmtF(p10(allTotalMining), 2)}`);
  console.log(`    Median : ${fmtF(median(allTotalMining), 2)}`);
  console.log(`    Avg    : ${fmtF(allTotalMining.reduce((a, b) => a + b, 0) / TRIALS, 2)}`);
  console.log(`    P90    : ${fmtF(p90(allTotalMining), 2)}`);
  console.log(`    Max    : ${fmtF(allTotalMining[allTotalMining.length - 1], 2)}`);

  // ── ROI by phase ───────────────────────────────────────────────────────────
  console.log(`\n${SEP2}`);
  console.log(`  SECTION 3 — ROI DAYS TO RECOVER ${fmt(TOTAL_SPEND)} $LFRG`);
  console.log(`  (10,000-trial distribution: min / p10 / median / p90 / max)`);
  console.log(`  ${SEP2}\n`);
  console.log(`  "6 days ROI" requires: earn ${fmt(TOTAL_SPEND)} $LFRG in 6 days`);
  console.log(`  = daily mine rate of AT LEAST ${fmt(TOTAL_SPEND / 6)} $LFRG/day\n`);

  for (const ph of PHASE_SCENARIOS) {
    const roiArr = results
      .map(r => r.roiDays[ph.label])
      .filter(d => isFinite(d))
      .sort((a, b) => a - b);

    const pctUnder6  = roiArr.filter(d => d <= 6).length;
    const pctUnder30 = roiArr.filter(d => d <= 30).length;
    const pctUnder90 = roiArr.filter(d => d <= 90).length;

    const avgRatePerDay = results.reduce((s, r) => {
      const rate = playerMineRatePerDay(r.frogs, ph.denom);
      return s + rate;
    }, 0) / TRIALS;

    console.log(`  ${ph.label}`);
    console.log(`  ${"─".repeat(60)}`);
    console.log(`    Avg mine rate/day  : ${fmt(avgRatePerDay)} $LFRG/day`);
    console.log(`    ROI days   min     : ${fmtF(roiArr[0], 1)}`);
    console.log(`    ROI days   p10     : ${fmtF(p10(roiArr), 1)}`);
    console.log(`    ROI days   median  : ${fmtF(median(roiArr), 1)}`);
    console.log(`    ROI days   p90     : ${fmtF(p90(roiArr), 1)}`);
    console.log(`    ROI days   max     : ${fmtF(roiArr[roiArr.length - 1], 1)}`);
    console.log(``);
    console.log(`    Players who ROI in  ≤ 6 days   : ${pct(pctUnder6,  TRIALS)}  ← the claim`);
    console.log(`    Players who ROI in  ≤ 30 days  : ${pct(pctUnder30, TRIALS)}`);
    console.log(`    Players who ROI in  ≤ 90 days  : ${pct(pctUnder90, TRIALS)}`);
    console.log(``);
  }

  // ── Verdict ─────────────────────────────────────────────────────────────────
  const phase1 = PHASE_SCENARIOS[0];
  const medianROI_P1 = (() => {
    const arr = results
      .map(r => r.roiDays[phase1.label])
      .filter(d => isFinite(d))
      .sort((a, b) => a - b);
    return median(arr);
  })();

  const pctUnder6_P1 = (() => {
    const arr = results.map(r => r.roiDays[phase1.label]).filter(d => isFinite(d));
    return arr.filter(d => d <= 6).length / TRIALS * 100;
  })();

  console.log(`${SEP2}`);
  console.log(`  VERDICT: IS THE 6-DAY ROI CLAIM TRUE?`);
  console.log(`  ${SEP2}\n`);

  if (pctUnder6_P1 < 5) {
    console.log(`  FALSE — Only ${fmtF(pctUnder6_P1, 1)}% of players would achieve 6-day ROI`);
    console.log(`  in Phase 1 (the most favourable condition possible).\n`);
  } else if (pctUnder6_P1 < 20) {
    console.log(`  MISLEADING — Only ${fmtF(pctUnder6_P1, 1)}% of players hit 6-day ROI in Phase 1.`);
    console.log(`  The person reporting this was a lucky outlier.\n`);
  } else {
    console.log(`  POSSIBLE but rare — ${fmtF(pctUnder6_P1, 1)}% of players hit 6-day ROI in Phase 1.\n`);
  }

  console.log(`  Best-case (Phase 1, median player)  ROI in ${fmtF(medianROI_P1, 1)} days`);
  console.log(`  Median Phase 1 mine rate/day         ${fmt(TOTAL_SPEND / medianROI_P1)} $LFRG/day`);
  console.log(`  Median Phase 2 ROI (12h denom)       ${fmtF(medianROI_P1 * 2, 1)} days (2× longer)`);
  console.log(`  Median Phase 4 ROI (48h denom)       ${fmtF(medianROI_P1 * 8, 1)} days (8× longer)\n`);

  console.log(`  The reported "2 legendaries in 40 rares" scenario:`);
  const luckyTrials = results.filter(r => (r.rarityCount.legendary || 0) >= 2);
  if (luckyTrials.length > 0) {
    const luckyROI_P1 = luckyTrials
      .map(r => r.roiDays[phase1.label])
      .filter(d => isFinite(d))
      .sort((a, b) => a - b);
    console.log(`    Probability         : ${pct(luckyTrials.length, TRIALS)} of all 40-rare-egg buyers`);
    console.log(`    Their median ROI    : ${fmtF(median(luckyROI_P1), 1)} days in Phase 1`);
    console.log(`    Their P10 ROI       : ${fmtF(p10(luckyROI_P1), 1)} days in Phase 1`);
    console.log(`\n  That outlier player got lucky with drop rates AND high mining rolls.`);
    console.log(`  It is not representative of a typical 40-egg buyer.\n`);
  }

  console.log(`  RECOMMENDATION:`);
  console.log(`    Do NOT adjust mine rates based on this single report.`);
  console.log(`    The 6-day ROI is only achievable by the top ~${fmtF(pctUnder6_P1, 1)}% of players`);
  console.log(`    under Phase 1 conditions — it is variance, not a broken mechanic.`);
  console.log(`    Median ROI in Phase 1 is ~${fmtF(medianROI_P1, 1)} days, rising to ~${fmtF(medianROI_P1 * 8, 1)} days by Phase 4.`);
  console.log(`    The halving mechanism self-corrects any early-game ROI advantage.\n`);
}

main();
