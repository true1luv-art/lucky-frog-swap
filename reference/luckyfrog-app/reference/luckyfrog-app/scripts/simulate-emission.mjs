/**
 * Emission Simulation — 20 players × 100 rare eggs
 *
 * Models:
 *   - Frog stat rolling (TerraCore RNG, R=3 for rare)
 *   - Mine rate formula with halving phases
 *   - Softcap at mining=333, 50% efficiency above
 *   - LFRG emitted over 4h and 24h windows
 *   - Circulating frogs impact on halving phase
 *   - ROI estimate (assumes rare egg price input)
 *   - Assumes no decay (fresh frogs, within grace period)
 */

// ── seeded RNG (inline — no imports needed) ─────────────────────────────────
function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

// ── constants ────────────────────────────────────────────────────────────────
const MINING_SOFTCAP       = 333;
const SOFTCAP_EFFICIENCY   = 0.5;
const STAT_ROLL_MULT       = { mining: 2.0, luck: 0.5, crit: 0.5, dodge: 0.5, damage: 10, defense: 10 };
const TOTAL_SUPPLY_CAP     = 101_000;
const HALVING_SCHEDULE     = [
  { satPct: 0.25, denom: 6  * 3600, label: "Phase 1 — Genesis (0–25%)"        },
  { satPct: 0.50, denom: 12 * 3600, label: "Phase 2 — First Halving (25–50%)" },
  { satPct: 0.75, denom: 24 * 3600, label: "Phase 3 — Second Halving (50–75%)"},
  { satPct: 1.00, denom: 48 * 3600, label: "Phase 4 — Third Halving (75–100%)"},
];

// Rare egg rarity weights (from EGG_RARITY_WEIGHTS in sim)
const RARE_HATCH_WEIGHTS = { rare: 95, epic: 4, legendary: 1 };

// ── helpers ───────────────────────────────────────────────────────────────────
function getHalvingDenom(totalMinted) {
  const sat = totalMinted / TOTAL_SUPPLY_CAP;
  for (const s of HALVING_SCHEDULE) { if (sat <= s.satPct) return s.denom; }
  return 48 * 3600;
}

function getHalvingLabel(totalMinted) {
  const sat = totalMinted / TOTAL_SUPPLY_CAP;
  for (const s of HALVING_SCHEDULE) { if (sat <= s.satPct) return s.label; }
  return HALVING_SCHEDULE[HALVING_SCHEDULE.length - 1].label;
}

function rollRarity(weights, rng) {
  const entries = Object.entries(weights);
  const total   = entries.reduce((s, [, w]) => s + w, 0);
  let roll = rng() * total;
  for (const [r, w] of entries) { roll -= w; if (roll <= 0) return r; }
  return entries[entries.length - 1][0];
}

// Rarity index R for mining range
const RARITY_R = { common: 1, uncommon: 2, rare: 3, epic: 4, legendary: 6 };

function rollFrogStats(simIdx, frogIdx, rarity) {
  const rng  = mulberry32((simIdx * 100000 + frogIdx) ^ 0xdeadbeef);
  const R    = RARITY_R[rarity] ?? 1;
  // Pick bonus stat slots based on R (rare = up to 3 bonus stats)
  const SLOTS   = ["luck", "dodge", "crit", "damage", "defense"];
  const pool    = [...SLOTS];
  const chosen  = [];
  for (let i = 0; i < R && pool.length > 0; i++) {
    const idx = Math.floor(rng() * pool.length);
    chosen.push(pool.splice(idx, 1)[0]);
  }
  // Roll each stat in range [0.5*R, R] × multiplier
  const rollInRange = () => rng() * (0.5 * R) + 0.5 * R;
  const stats = { mining: 0, luck: 0, dodge: 0, crit: 0, damage: 0, defense: 0 };
  stats.mining = rollInRange() * STAT_ROLL_MULT.mining;
  for (const s of chosen) stats[s] = rollInRange() * STAT_ROLL_MULT[s];
  return stats;
}

function computeMineRate(totalMining, halvingDenom) {
  const effective = totalMining <= MINING_SOFTCAP
    ? totalMining
    : MINING_SOFTCAP + (totalMining - MINING_SOFTCAP) * SOFTCAP_EFFICIENCY;
  // decay multiplier = 1.0 (fresh frogs, within grace period)
  return Math.pow(effective + 1, 2) / halvingDenom;
}

function median(arr) {
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 === 0 ? (s[m - 1] + s[m]) / 2 : s[m];
}

function mean(arr) { return arr.reduce((a, b) => a + b, 0) / arr.length; }
function pct(arr, p) {
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor((p / 100) * s.length)];
}

// ── simulation parameters ────────────────────────────────────────────────────
const PLAYERS      = 20;
const EGGS_EACH    = 100;
const TOTAL_EGGS   = PLAYERS * EGGS_EACH;         // 2,000 rare eggs
const SIMS         = 2_000;                        // Monte-Carlo iterations

// Rare egg price scenarios (LFRG) — for ROI
const EGG_PRICE_LFRG = [100, 500, 1_000, 2_500, 5_000];

// Existing circulating frogs before these 20 players mint
// We test 3 scenarios: early launch, mid, late
const EXISTING_FROGS_SCENARIOS = [
  { label: "Early (500 frogs in circ.)",  existing: 500   },
  { label: "Mid   (5,000 frogs in circ.)", existing: 5_000  },
  { label: "Late  (25,000 frogs in circ.)",existing: 25_000 },
];

// ── run simulation ────────────────────────────────────────────────────────────
console.log("=".repeat(72));
console.log("EMISSION SIMULATION — 20 players × 100 rare eggs each");
console.log("=".repeat(72));
console.log(`Monte-Carlo iterations : ${SIMS.toLocaleString()}`);
console.log(`Total eggs hatched     : ${TOTAL_EGGS.toLocaleString()} rare eggs`);
console.log(`Frog supply cap        : ${TOTAL_SUPPLY_CAP.toLocaleString()}`);
console.log();

// First run stat distribution summary (rarity breakdown)
{
  const rarityCounts = { rare: 0, epic: 0, legendary: 0 };
  const sampleRng = mulberry32(42);
  for (let i = 0; i < TOTAL_EGGS; i++) {
    const r = rollRarity(RARE_HATCH_WEIGHTS, sampleRng);
    rarityCounts[r]++;
  }
  console.log("─".repeat(72));
  console.log("EXPECTED FROG DISTRIBUTION (per 2,000 rare eggs, sample run)");
  console.log("─".repeat(72));
  console.log(`  Rare      : ${rarityCounts.rare}  frogs  (${(rarityCounts.rare/TOTAL_EGGS*100).toFixed(1)}%)`);
  console.log(`  Epic      : ${rarityCounts.epic}  frogs  (${(rarityCounts.epic/TOTAL_EGGS*100).toFixed(1)}%)`);
  console.log(`  Legendary : ${rarityCounts.legendary}  frogs  (${(rarityCounts.legendary/TOTAL_EGGS*100).toFixed(1)}%)`);
  console.log();
}

// Per-frog stat medians across simulations
{
  const miningVals = [], luckVals = [], critVals = [];
  for (let sim = 0; sim < SIMS; sim++) {
    const rng = mulberry32(sim * 999);
    const rarity = rollRarity(RARE_HATCH_WEIGHTS, rng);
    const stats  = rollFrogStats(sim, 0, rarity);
    miningVals.push(stats.mining);
    luckVals.push(stats.luck);
    critVals.push(stats.crit);
  }
  console.log("─".repeat(72));
  console.log("PER-FROG STAT MEDIANS (single rare egg hatch, 2,000 iterations)");
  console.log("─".repeat(72));
  console.log(`  Mining  median : ${median(miningVals).toFixed(3)}  |  p10: ${pct(miningVals,10).toFixed(3)}  |  p90: ${pct(miningVals,90).toFixed(3)}`);
  console.log(`  Luck    median : ${median(luckVals).toFixed(3)}  |  p10: ${pct(luckVals,10).toFixed(3)}  |  p90: ${pct(luckVals,90).toFixed(3)}`);
  console.log(`  Crit    median : ${median(critVals).toFixed(3)}  |  p10: ${pct(critVals,10).toFixed(3)}  |  p90: ${pct(critVals,90).toFixed(3)}`);
  console.log();
}

// Main emission simulation per circulating frog scenario
for (const scenario of EXISTING_FROGS_SCENARIOS) {
  const totalMintedAfter = scenario.existing + TOTAL_EGGS;
  const halvingDenom     = getHalvingDenom(totalMintedAfter);
  const halvingLabel     = getHalvingLabel(totalMintedAfter);
  const satPct           = (totalMintedAfter / TOTAL_SUPPLY_CAP * 100).toFixed(2);

  // Per-player totals across SIMS
  const playerMining4h  = [];
  const playerMining24h = [];
  const playerMineRates = [];

  for (let sim = 0; sim < SIMS; sim++) {
    // Simulate one player's 100 frogs
    let totalMining = 0;
    for (let e = 0; e < EGGS_EACH; e++) {
      const rng    = mulberry32(sim * 100000 + e);
      const rarity = rollRarity(RARE_HATCH_WEIGHTS, rng);
      const stats  = rollFrogStats(sim, e, rarity);
      totalMining += stats.mining;
    }

    const ratePerSec = computeMineRate(totalMining, halvingDenom);
    const ratePerHr  = ratePerSec * 3600;
    playerMineRates.push(ratePerHr);
    playerMining4h.push(ratePerSec  * 4  * 3600);
    playerMining24h.push(ratePerSec * 24 * 3600);
  }

  // Network totals (20 players)
  const network4h  = median(playerMining4h)  * PLAYERS;
  const network24h = median(playerMining24h) * PLAYERS;

  console.log("=".repeat(72));
  console.log(`SCENARIO: ${scenario.label}`);
  console.log("=".repeat(72));
  console.log(`  Frogs in circulation after mint : ${totalMintedAfter.toLocaleString()}`);
  console.log(`  Supply saturation               : ${satPct}%`);
  console.log(`  Active halving phase            : ${halvingLabel}`);
  console.log(`  Halving denominator             : ${halvingDenom/3600}h`);
  console.log();

  console.log("  PER-PLAYER (100 rare eggs) — mine rate & emission:");
  console.log(`    Mining stat  median : ${median(playerMineRates.map((_,i)=>{ let m=0; for(let e=0;e<EGGS_EACH;e++){const rng=mulberry32(i*100000+e);const r=rollRarity(RARE_HATCH_WEIGHTS,rng);const s=rollFrogStats(i,e,r);m+=s.mining;}return m;})).toFixed(2)}`);
  console.log(`    Mine rate    median : ${median(playerMineRates).toFixed(2)} LFRG/hr  |  p10: ${pct(playerMineRates,10).toFixed(2)}  |  p90: ${pct(playerMineRates,90).toFixed(2)}`);
  console.log(`    4h  emission median : ${median(playerMining4h).toFixed(2)} LFRG`);
  console.log(`    24h emission median : ${median(playerMining24h).toFixed(2)} LFRG`);
  console.log();

  console.log("  NETWORK TOTAL (20 players combined):");
  console.log(`    4h  emission  : ${network4h.toFixed(0)} LFRG`);
  console.log(`    24h emission  : ${network24h.toFixed(0)} LFRG`);
  console.log(`    Annual (365d) : ${(network24h * 365).toFixed(0)} LFRG`);
  console.log();

  console.log("  ROI BREAKEVEN (days to recover egg cost at median 24h rate):");
  console.log(`  ${"Egg Price (LFRG)".padEnd(20)} ${"Cost (100 eggs)".padEnd(20)} ${"Breakeven Days".padEnd(18)} Note`);
  console.log("  " + "-".repeat(68));
  for (const price of EGG_PRICE_LFRG) {
    const totalCost     = price * EGGS_EACH;
    const daily         = median(playerMining24h);
    const breakevenDays = totalCost / daily;
    const note = breakevenDays < 7
      ? "< 1 week  (too fast — may cheapen egg)"
      : breakevenDays < 30
      ? "< 1 month (aggressive)"
      : breakevenDays < 90
      ? "1-3 months (healthy)"
      : breakevenDays < 180
      ? "3-6 months (solid)"
      : "> 6 months (strong store-of-value)";
    console.log(`  ${String(price).padEnd(20)} ${String(totalCost).padEnd(20)} ${breakevenDays.toFixed(1).padEnd(18)} ${note}`);
  }
  console.log();
}

// Circulating frog summary
console.log("=".repeat(72));
console.log("CIRCULATING FROGS IMPACT SUMMARY");
console.log("=".repeat(72));
console.log("  These 20 players add 2,000 rare frogs to circulation.");
console.log("  Expected distribution from 2,000 rare eggs:");
console.log(`    ~1,900 Rare  frogs  (supply used: 1,900 / 12,000 total rare supply = ${(1900/12000*100).toFixed(1)}%)`);
console.log(`    ~80    Epic  frogs  (supply used: 80   / 3,000  total epic supply  = ${(80/3000*100).toFixed(1)}%)`);
console.log(`    ~20    Leg.  frogs  (supply used: 20   / 1,000  total leg. supply  = ${(20/1000*100).toFixed(1)}%)`);
console.log();
console.log("  Halving phase crossed by these 2,000 mints:");
for (const sc of EXISTING_FROGS_SCENARIOS) {
  const before = getHalvingLabel(sc.existing);
  const after  = getHalvingLabel(sc.existing + TOTAL_EGGS);
  const cross  = before !== after ? `PHASE CHANGE: ${before} → ${after}` : `stays in ${after}`;
  console.log(`    ${sc.label.padEnd(34)} ${cross}`);
}
console.log();
console.log("=".repeat(72));
console.log("NOTES");
console.log("=".repeat(72));
console.log("  - All emission assumes no decay (within 14-day grace period).");
console.log("  - Softcap at mining=333 with 50% efficiency above.");
console.log("  - No LFRG hold bonus or charm crit applied to mining rate.");
console.log("  - Egg price in LFRG is speculative — use your tokenomics target.");
console.log("  - 'Annual' projection assumes constant halving phase (no further halvings).");
