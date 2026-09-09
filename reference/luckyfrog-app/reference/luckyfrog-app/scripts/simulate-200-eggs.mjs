/**
 * Simulation: 200 eggs across uncommon → legendary
 * Validates: log2(luck+1) draw formula + min(frogCrit, 50) cap
 */

function mulberry32(seed) {
  return function() {
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
function makeRng(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
  return mulberry32(h >>> 0);
}

// ── constants ──────────────────────────────────────────────────────────────
const STAT_MULT = { mining:2.0, luck:0.5, crit:0.5, dodge:0.5, damage:10, defense:10 };
const MINING_R  = { common:1, uncommon:2, rare:3, epic:4, legendary:6 };
const MAX_FROG_CRIT = 50;

const HOLD_LUCK_TABLE  = [[500,5.078],[1000,5.078],[2000,5.469],[5000,6.641],[10000,7.100],[25000,7.466],[50000,8.002],[100000,8.041],[250000,8.155],[500000,8.346],[1000000,8.727]];
const HOLD_DODGE_TABLE = [[500,8.997],[1000,9.000],[2000,10.266],[5000,11.438],[10000,12.087],[25000,12.453],[50000,13.063],[100000,14.284],[250000,15.092],[500000,15.283],[1000000,15.664]];

const EGG_WEIGHTS = {
  uncommon:  [["uncommon",78],["rare",16],["epic",5],["legendary",1]],
  rare:      [["rare",70],["epic",22],["legendary",8]],
  epic:      [["epic",75],["legendary",25]],
  legendary: [["legendary",100]],
};

const MAX_CHARM           = 1_000_000;
const MAX_CRIT_BONUS      = 14.027;
const TERRACORE_MAX_CHARM = 5_000_000;

// ── helpers ────────────────────────────────────────────────────────────────
function lookupStepped(table, val) {
  let r = 0;
  for (const [min, pct] of table) { if (val >= min) r = pct; else break; }
  return r;
}
function rollRarity(weights, rng) {
  const total = weights.reduce((s,[,w])=>s+w, 0);
  let roll = rng() * total;
  for (const [r,w] of weights) { roll -= w; if (roll <= 0) return r; }
  return weights[weights.length-1][0];
}
function generateFrogStats(seed, rarity) {
  const r = makeRng(seed);
  let R;
  switch(rarity){
    case "common":    R=1; break;
    case "uncommon":  R=r()<0.5?1:2; break;
    case "rare":      R=r()<0.5?2:3; break;
    case "epic":      R=r()<0.5?3:4; break;
    case "legendary": R=5; break;
    default: R=1;
  }
  const SLOTS = ["luck","dodge","crit","damage","defense"];
  const pool  = [...SLOTS];
  const chosen = [];
  for (let i=0; i<R && pool.length>0; i++){
    const idx = Math.floor(r()*pool.length);
    chosen.push(pool[idx]); pool.splice(idx,1);
  }
  const mR = MINING_R[rarity] ?? 1;
  const roll = () => r()*(0.5*mR) + 0.5*mR;
  const stats = { mining:0, luck:0, dodge:0, crit:0, damage:0, defense:0 };
  stats.mining = roll() * STAT_MULT.mining;
  for (const s of chosen) stats[s] = roll() * STAT_MULT[s];
  return stats;
}
function computeCritFromCharm(charm) {
  const c = Math.min(Math.max(charm,0), MAX_CHARM);
  if (!c) return 0;
  return Math.min(Math.log(1+c)/Math.log(1+TERRACORE_MAX_CHARM)*MAX_CRIT_BONUS, MAX_CRIT_BONUS);
}
function computeHoldBonus(lfrg) {
  if (lfrg < 500) return { luck:0, dodge:0 };
  const c = Math.min(lfrg, 1_000_000);
  return { luck: lookupStepped(HOLD_LUCK_TABLE,c), dodge: lookupStepped(HOLD_DODGE_TABLE,c) };
}
function median(arr) {
  const s = [...arr].sort((a,b)=>a-b);
  const m = Math.floor(s.length/2);
  return s.length%2===0 ? (s[m-1]+s[m])/2 : s[m];
}
// NEW: log2 draw formula
function luckDraws(luck) { return Math.floor(Math.log2(luck + 1)); }

// ── simulation ─────────────────────────────────────────────────────────────
const SIMULATIONS = 2_000;
const EGG_COUNT   = 200;
const TIERS       = ["uncommon","rare","epic","legendary"];

const hbMax  = computeHoldBonus(1_000_000);
const ccMax  = computeCritFromCharm(1_000_000);

const SEP  = "=".repeat(68);
const SEP2 = "-".repeat(56);

for (const tier of TIERS) {
  const weights = EGG_WEIGHTS[tier];
  const samples = [];
  const rarityCounts = { common:0, uncommon:0, rare:0, epic:0, legendary:0 };

  for (let sim=0; sim<SIMULATIONS; sim++) {
    let mining=0, luck=0, dodge=0, crit=0, damage=0, defense=0;
    for (let e=0; e<EGG_COUNT; e++) {
      const rng    = makeRng(`${tier}s${sim}e${e}`);
      const rarity = rollRarity(weights, rng);
      rarityCounts[rarity] = (rarityCounts[rarity]||0) + 1;
      const s = generateFrogStats(`${tier}${sim}${e}${rarity}`, rarity);
      mining+=s.mining; luck+=s.luck; dodge+=s.dodge;
      crit+=s.crit; damage+=s.damage; defense+=s.defense;
    }
    samples.push({ mining, luck, dodge, crit, damage, defense });
  }

  const medFrogLuck  = median(samples.map(s=>s.luck));
  const medFrogDodge = median(samples.map(s=>s.dodge));
  const medFrogCrit  = median(samples.map(s=>s.crit));
  const medMining    = median(samples.map(s=>s.mining));
  const medDamage    = median(samples.map(s=>s.damage));
  const medDefense   = median(samples.map(s=>s.defense));

  // apply caps + bonuses
  const totalLuck  = medFrogLuck  + hbMax.luck;
  const totalDodge = medFrogDodge + hbMax.dodge;
  const cappedCrit = Math.min(medFrogCrit, MAX_FROG_CRIT);
  const totalCrit  = cappedCrit + ccMax;

  const extraDraws = luckDraws(totalLuck);
  const minDraws   = 1 + extraDraws;
  const maxDraws   = 5 + extraDraws;

  console.log(`\n${SEP}`);
  console.log(` 200 ${tier.toUpperCase()} EGGS  (${SIMULATIONS.toLocaleString()} sims)`);
  console.log(SEP);

  console.log("\n  RARITY DISTRIBUTION (avg per 200 eggs)");
  console.log(`  ${SEP2}`);
  const totalRolls = SIMULATIONS * EGG_COUNT;
  for (const [r, cnt] of Object.entries(rarityCounts)) {
    if (!cnt) continue;
    console.log(`  ${r.padEnd(12)} ~${(cnt/SIMULATIONS).toFixed(1).padStart(5)} frogs   (${(cnt/totalRolls*100).toFixed(2)}%)`);
  }

  console.log("\n  FROG-ONLY MEDIAN STATS (level 1, no bonuses)");
  console.log(`  ${SEP2}`);
  console.log(`  Mining   ${medMining.toFixed(2).padStart(9)}`);
  console.log(`  Luck     ${medFrogLuck.toFixed(3).padStart(9)}`);
  console.log(`  Dodge    ${medFrogDodge.toFixed(3).padStart(9)}`);
  console.log(`  Crit     ${medFrogCrit.toFixed(3).padStart(9)}  → capped at ${MAX_FROG_CRIT} (was ${medFrogCrit > MAX_FROG_CRIT ? "OVER" : "under"} cap)`);
  console.log(`  Damage   ${medDamage.toFixed(2).padStart(9)}`);
  console.log(`  Defense  ${medDefense.toFixed(2).padStart(9)}`);

  console.log("\n  FULL PLAYER (frogs + max hold 1M LFRG + max charm 1M)");
  console.log(`  ${SEP2}`);
  console.log(`  Luck     ${totalLuck.toFixed(3).padStart(9)}   hold  +${hbMax.luck}%     → ${(hbMax.luck/totalLuck*100).toFixed(1)}% from hold`);
  console.log(`  Dodge    ${totalDodge.toFixed(3).padStart(9)}   hold  +${hbMax.dodge}%   → ${(hbMax.dodge/totalDodge*100).toFixed(1)}% from hold`);
  console.log(`  Crit     ${totalCrit.toFixed(3).padStart(9)}   charm +${ccMax.toFixed(3)}%  → ${(ccMax/totalCrit*100).toFixed(1)}% from charm  (frog capped at ${MAX_FROG_CRIT})`);

  console.log("\n  DRAWS PER SHARD CLAIM (log2 formula)");
  console.log(`  ${SEP2}`);
  console.log(`  floor(log2(${totalLuck.toFixed(1)} + 1)) = +${extraDraws} luck draws`);
  console.log(`  Draw range: [${minDraws}–${maxDraws}]`);
}

// ── cross-tier summary ─────────────────────────────────────────────────────
console.log(`\n\n${SEP}`);
console.log(" CROSS-TIER SUMMARY — log2 draws + frog crit cap");
console.log(SEP);
console.log(`  ${"Tier".padEnd(12)} ${"FrogLuck".padEnd(10)} ${"TotalLuck".padEnd(12)} ${"FrogCrit".padEnd(10)} ${"TotalCrit".padEnd(12)} ${"Draw range"}`);
console.log(`  ${"-".repeat(64)}`);

for (const tier of TIERS) {
  const weights = EGG_WEIGHTS[tier];
  const frogLucks = [], frogCrits = [];
  for (let sim=0; sim<500; sim++) {
    let luck=0, crit=0;
    for (let e=0; e<EGG_COUNT; e++) {
      const rng = makeRng(`sum${tier}s${sim}e${e}`);
      const rarity = rollRarity(weights, rng);
      const s = generateFrogStats(`sum${tier}${sim}${e}${rarity}`, rarity);
      luck+=s.luck; crit+=s.crit;
    }
    frogLucks.push(luck); frogCrits.push(crit);
  }
  const fl = median(frogLucks);
  const fc = median(frogCrits);
  const tl = fl + hbMax.luck;
  const tc = Math.min(fc, MAX_FROG_CRIT) + ccMax;
  const ld = luckDraws(tl);
  console.log(`  ${tier.padEnd(12)} ${fl.toFixed(1).padEnd(10)} ${tl.toFixed(1).padEnd(12)} ${fc.toFixed(1).padEnd(10)} ${tc.toFixed(1).padEnd(12)} [${1+ld}–${5+ld}]`);
}
