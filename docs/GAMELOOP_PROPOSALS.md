# Lucky Frog — Game Loop Proposals

_Written 2026-09-09. Three proposals for the core economy loop, plus a review of what the game does today._

---

## 1. Where the gameplay stands today

**Already matches your idea:**

- Seeds are bought with Wood and Stone, not gold (`src/features/types/gameplay/crops.ts`):

  | Seed | Cost | Growth |
  |---|---|---|
  | Potato Seed | 3 Wood | 1 min |
  | Carrot Seed | 4 Stone | 5 min |
  | Cabbage Seed | 4 Wood + 4 Stone | 10 min |
  | Pumpkin Seed | 6 Wood + 6 Stone | 30 min |
  | Wheat Seed | 8 Wood + 10 Stone | 12 hr |

- Crops, cooked food, fish and animal produce all sell for gold (`src/features/game/sell-prices.ts`).
- Cooking always burns 1 Wood as fuel, so food competes with seeds for wood.
- Gold currently buys animals (Chicken 10, Cow 40, Sheep 25) and little else.

**Problems worth fixing:**

1. **Gold is a dead end.** You earn it, but there is almost nothing to spend it on. Farm levels cost XP (and token spend), not gold, so the reward loop terminates.
2. **Selling raw resources undercuts farming.** Wood sells for 3 and Stone for 4, while a Potato sells for 2. Chopping wood and selling it is faster gold than planting potatoes, so the farm is optional.
3. **Wood is triple-taxed** (seeds, cooking fuel, tool crafting) but there is no wood-supply upgrade — no axe efficiency you can buy, no replanting, no lumber yard.
4. **No decision at harvest.** Selling the crop raw is nearly always worse than cooking it, so the "choice" isn't a choice. Cabbage 8 raw vs Cabbage Roll 20.
5. **Wheat at 12 hours** is a hard wall for a session-based game with no offline mechanic to reward the wait.
6. **HP has no drain.** Food restores HP/shield, but nothing takes HP away, so cooking is only a sell-price multiplier rather than a survival need.

---

## 2. Proposal A — "Gathering funds the farm, the farm funds the town" (smallest change)

Keep the current shape; close the gold loop and stop resource-selling from being the best strategy.

**Changes**

- Remove Wood and Stone from the Market entirely (or cut them to 1 coin). Resources become inputs only, never a payout.
- Gold gets real sinks, all sold in town:
  - **Tool upgrades** — Stone/Iron tier axe & pickaxe: +1 yield per swing, bought with gold + ore.
  - **Plot expansion** — each extra field plot costs escalating gold (50, 120, 250, …).
  - **Seed vendor bulk deals** — pay gold to skip the wood/stone cost when you're resource-starved.
  - **Animals** stay, plus barn slots.
- Raise crop prices ~30% so farming beats gathering per minute of play.

**Loop:** chop/mine → buy seeds → water, harvest → cook or sell → gold → tools & plots → gather faster → bigger farm.

**Pros:** ships in a day, no new systems, fixes the dead-end gold problem directly.
**Cons:** still a single-track economy; no long-term goal past maxed tools.

---

## 3. Proposal B — "Cook, Eat, Explore" (stamina/HP-driven)

Make food the fuel of play, so cooking has a purpose beyond sell value.

**Changes**

- **Every gather action costs HP** (chop 3, mine 4, fish 2, water 1). At 0 HP you can only walk and cook.
- Food restores HP by tier — Baked Potato 20, Wheat Bread 50, Pumpkin Pie 60 — so higher farming tiers translate into longer play sessions.
- **Wood and Stone remain unsellable.** Gold comes only from food, fish and produce — you must process before you profit.
- Add a **third resource area gated by HP**: a mine deeper in that costs 8 HP per swing but drops ore for tools and gold-rich gems.
- Seeds keep the wood/stone cost, so each session is a budget: how much wood goes to seeds, how much to cooking fuel.

**Loop:** eat → gather → seeds + cooking fuel → crops → cook → gold and HP → deeper mine → better tools → cheaper gathering.

**Pros:** creates a genuine per-session decision, makes all five crops matter, gives food a job.
**Cons:** needs HP drain, an out-of-HP recovery path (slow regen or a free food), and careful tuning to avoid dead-end states.

---

## 4. Proposal C — "Contracts and the town economy" (long-horizon)

Layer a demand system on top so prices and goals shift daily.

**Changes**

- **Daily contracts** from the three NPCs, replacing flat prices as the main payout:
  - Rancher wants 5 Milk + 3 Wool → 180 gold + XP.
  - Trader wants 10 Wheat Bread → 500 gold + a rare seed.
  - Blacksmith wants 20 Stone + 5 Ore → tool upgrade token.
- **Flat market prices drop ~40%.** Selling into the market becomes the fallback; contracts are the real money.
- **Rotating price surges** — one crop or food per day sells at 2×, so the optimal planting changes daily.
- Gold sinks: contract rerolls, permanent barn/plot deeds, NPC reputation unlocks (better contracts at higher rep).
- Wheat's 12-hour timer becomes an asset: overnight wheat feeds tomorrow's bread contracts.

**Loop:** read the board → plan the day's planting → gather → plant/cook → fulfil contracts → gold + reputation → better contracts.

**Pros:** highest retention, gives daily logins meaning, uses the NPCs and quest system already in the codebase.
**Cons:** most work — contract generation, reputation, price rotation, and persistence (needs a backend for real daily rotation).

---

## 5. Recommendation

Ship **A** first (a day's work; it makes the existing economy make sense), then **B** (turns the loop into a real decision), then **C** as the retention layer once progress is saved server-side.

The single highest-value change regardless of path: **stop letting players sell Wood and Stone for more than a crop is worth.** That one line of tuning is what currently makes the farm optional.
