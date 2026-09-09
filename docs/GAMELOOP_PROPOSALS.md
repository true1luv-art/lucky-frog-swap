# Lucky Frog — Game Loop Proposals

_Updated 2026-09-09. Reworked around four seeds, crop-fed animals, a new enemy/combat system with Archero-style bow mechanics, and weapon upgrades that make gold matter._

---

## 1. Design pillars

1. **Four seeds only** — Potato, Carrot, Cabbage, Wheat.
2. **Crops feed animals** — Carrot feeds the Chicken, Cabbage feeds the Sheep, Wheat feeds the Cow. Potato is the pure cash/food crop.
3. **Food restores HP** — cooking matters because combat drains HP.
4. **Enemies exist** — a new entity (using the player sprites for now) spawns, wanders, spots the player, chases, and attacks.
5. **Combat is Archero-style** — the player attacks with a bow that fires arrows in a straight line with a fixed range. No auto-hit: arrows travel and can miss, so positioning and movement are the skill.
6. **Gold funds combat upgrades** — better bows, better tools, and plot expansion give gold a clear purpose.

The economy stays: seeds cost Wood + Stone; selling crops, cooked food, fish and animal produce pays Gold. **Wood and Stone are not sellable** (or sell for almost nothing) so farming is mandatory, not optional.

---

## 2. Seed & animal mapping

| Seed | Cost (proposal) | Growth | Purpose |
|---|---|---|---|
| Potato Seed | 3 Wood | 1 min | Cash crop + basic cooking (Baked Potato → HP) |
| Carrot Seed | 4 Stone | 5 min | Chicken feed → Eggs |
| Cabbage Seed | 4 Wood + 4 Stone | 10 min | Sheep feed → Wool |
| Wheat Seed | 8 Wood + 10 Stone | 12 hr | Cow feed → Milk |

Every farmed crop now has a job: Potato → gold/food, the other three → animal produce → higher gold. Wheat's 12-hour timer is justified because Milk is the top-tier produce.

---

## 3. Enemy system (new entity)

**Rendering:** reuse the player sprite sheets for now — `player_idle`, `player_walk`, `player_axe` (the swing reads as a melee attack). Distinct tint (e.g. red) so enemies read as hostile. Swap in dedicated enemy art later without touching logic.

**AI state machine:**

```text
SPAWN → WANDER (random walk in a home radius)
      → ALERT  (player enters vicinity/aggro radius)
      → CHASE  (move toward player)
      → ATTACK (in melee range: play attack anim, deal damage, cooldown)
      → RETURN (player escaped far enough → walk back to home → WANDER)
```

**Parameters to tune:**

- Spawn points: fixed spots in the wild/mine areas, on a respawn timer.
- Aggro radius (e.g. 6 tiles), de-aggro radius (e.g. 10 tiles).
- Wander pause/interval, chase speed slightly below player speed so escape is possible.
- Attack range ~1 tile, damage per hit, attack cooldown.
- Enemy HP: 2–4 arrows to kill; drops (gold, ore, rare seeds) on death.

---

## 4. Combat — Archero-style bow + weapon upgrades

### 4.1 Bow mechanics

- Attack fires an **arrow projectile** in the player's facing direction.
- Arrow flies in a **straight line only**, up to a **fixed maximum range**, then fizzles.
- **No auto-hit / no homing** — the arrow is a physical projectile; it hits the first enemy it collides with. Missing is possible.
- Consequence: the player must **walk to line up shots** and kite enemies — move, stop, shoot, move. This is the Archero feel.

**Implementation notes:**

- Arrow = arcade-physics sprite, destroyed on wall/enemy/max-range.
- Enemy contact damage vs arrow damage both flow into the HP system (`features/game/hp.ts`).
- HP drain finally gives cooked food a purpose: eat to heal between fights.
- Death handling: at 0 HP, respawn at the farm with a small penalty (drop some gold or resources).

### 4.2 Weapon upgrades (gold sink)

Because this loop also funds the fight, the bow becomes the main gold sink:

| Tier | Damage | Range | Fire rate | Extra |
|---|---|---|---|---|
| Wood Bow | 1 | 6 tiles | 0.8/s | Starting weapon |
| Stone Bow | 2 | 7 tiles | 1.0/s | +1 pierce or faster projectile |
| Iron Bow | 3 | 8 tiles | 1.2/s | Two-arrow spread |
| Diamond Bow | 5 | 10 tiles | 1.5/s | Three-arrow spread |

Tool upgrades (axe, pickaxe) and plot expansion are secondary sinks. Gold now has a reason to exist beyond buying seeds.

---

## 5. The core loop — combined Proposal A + B

> **"Farm funds the fight, and food fuels it."**

This is the union of Proposal A (farm → gold → better gear → push deeper) and Proposal B (combat drains HP → only cooked food heals):

1. Gather **Wood** and **Stone** from the wild and mine. These are **not sellable**, so they can only be spent on seeds and tools.
2. Buy seeds with Wood/Stone and plant/water/harvest.
3. Use Carrot, Cabbage, and Wheat to feed your animals for Eggs, Wool, and Milk.
4. Cook Potatoes and fish into HP-restoring food, and keep some meals in your inventory.
5. Sell crops, cooked food, fish, and animal produce for **Gold**.
6. Spend Gold on **bow upgrades**, **tool upgrades**, and **plot expansion**.
7. With better gear, push deeper into enemy zones for better ore, wood, and rare drops. Combat consumes HP, so bring food.
8. If you die, respawn at the farm with a small gold/resource penalty, farm back up, and try again.

**Loop in one line:**

```text
gather → seeds → farm → feed/cook → sell → upgrade → fight deeper → repeat
```

**Pros:**

- Every system has a job: crops feed animals *and* the player, animals produce gold, gold buys combat upgrades, combat opens better resources.
- Combat is a real pillar, not just a gate.
- Wheat's 12-hour timer now matters for both top-tier milk and the best HP meals.
- Gold finally has a clear purpose: stronger bows and tools.

**Cons:**

- Needs careful tuning so players never soft-lock with 0 HP and no food. Provide a free basic HP recovery at the farm (slow regen or one free Baked Potato) and make early enemies avoidable.

---

## 6. Recommended build order

1. **Enemy entity + AI** (wander/chase/attack with player sprites) and the **arrow projectile** — the core new mechanic.
2. **Economy pass** — make Wood/Stone unsellable, set seed costs, and sync market prices.
3. **Proposal A wiring** — sell items for Gold; add bow/tool upgrade tiers as gold sinks.
4. **Proposal B wiring** — HP drain on enemy contact; food heals HP; death respawn penalty.
5. **Proposal C** — daily contracts and bounties once progress is saved server-side.

The single highest-value change regardless of path: **stop letting players sell Wood and Stone for more than a crop is worth** — that one tuning line makes the farm mandatory, and the bow makes gold matter.
