# Lucky Frog — Game Loop Proposals

_Updated 2026-09-09. Reworked around four seeds, crop-fed animals, and a new enemy/combat system with Archero-style bow mechanics._

---

## 1. Design pillars (the new rules)

1. **Four seeds only** — Potato, Carrot, Cabbage, Wheat. (Pumpkin is cut for now.)
2. **Crops feed animals** — Carrot feeds the Chicken, Cabbage feeds the Sheep, Wheat feeds the Cow. Potato is the pure cash/food crop.
3. **Food restores HP** — cooking matters because combat drains HP.
4. **Enemies exist** — a new entity (using the player sprites for now) spawns, wanders, spots the player, chases, and attacks.
5. **Combat is Archero-style** — the player attacks with a bow that fires arrows in a straight line with a fixed range. No auto-hit: arrows travel and can miss, so positioning and movement are the skill.

The economy stays: seeds cost Wood + Stone; selling crops, cooked food, fish and animal produce pays Gold.

---

## 2. Seed & animal mapping

| Seed | Cost (proposal) | Growth | Purpose |
|---|---|---|---|
| Potato Seed | 3 Wood | 1 min | Cash crop + basic cooking (Baked Potato → HP) |
| Carrot Seed | 4 Stone | 5 min | Chicken feed → Eggs |
| Cabbage Seed | 4 Wood + 4 Stone | 10 min | Sheep feed → Wool |
| Wheat Seed | 8 Wood + 10 Stone | 12 hr | Cow feed → Milk |

Every farmed crop now has a job: Potato → gold/food, the other three → animal produce → higher gold. Wheat's 12-hour timer is now justified because Milk is the top-tier produce.

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

## 4. Combat — Archero-style bow

**Mechanics:**

- Attack fires an **arrow projectile** in the player's facing direction.
- Arrow flies in a **straight line only**, up to a **fixed maximum range**, then fizzles.
- **No auto-hit / no homing** — the arrow is a physical projectile; it hits the first enemy it collides with. Missing is possible.
- Consequence: the player must **walk to line up shots** and kite enemies — move, stop, shoot, move. This is the Archero feel.

**Implementation notes:**

- Arrow = arcade-physics sprite, destroyed on wall/enemy/max-range.
- Enemy contact damage vs arrow damage both flow into the HP system (`features/game/hp.ts`).
- HP drain finally gives cooked food a purpose: eat to heal between fights.
- Death handling: at 0 HP, respawn at the farm with a small penalty (drop some gold or resources).

**Later upgrades (gold sink!):** bow tiers — more damage, longer range, faster fire rate, multi-shot.

---

## 5. Three proposals for the full loop

### Proposal A — "Farm funds the fight" (smallest change)

Close the gold loop and bolt combat on as the gold sink.

- Seeds cost Wood/Stone as in the table above; **Wood and Stone become unsellable** (or 1 coin) so farming is mandatory, not optional.
- Enemies guard the deep mine/forest where the best ore and wood are.
- Gold sinks: bow upgrades, tool upgrades, plot expansion, animals.

**Loop:** gather → seeds → farm → feed animals → sell produce → gold → better bow/tools → push deeper for better resources.

**Pros:** ships fast, every system already half-exists. **Cons:** combat is a gate, not yet a pillar.

### Proposal B — "Cook, Eat, Fight" (survival loop)

Food becomes the fuel of combat.

- Enemy hits drain HP; **only cooked food heals** (Baked Potato +20, etc.).
- Farming is now doubly required: crops feed animals *and* the player.
- Enemy zones have tiers; deeper zones hit harder, so you need better food (higher-tier crops) to survive — wheat's 12 hr wait produces the ingredients for the best meals.
- Death = respawn at farm, small gold penalty.

**Loop:** farm → cook → eat → fight → loot → sell → upgrade → fight deeper.

**Pros:** gives all four crops and the kitchen a real job; combat and economy reinforce each other. **Cons:** needs careful tuning so players never soft-lock with 0 HP and no food (keep a free basic food or slow HP regen at the farm).

### Proposal C — "Contracts & hunts" (long-horizon retention)

Layer daily demand on top.

- NPC daily contracts: Rancher wants 5 Milk, Trader wants 10 Wheat Bread, Blacksmith wants 10 ore + 3 enemy drops.
- Flat market prices drop ~40%; contracts are the real money.
- Daily bounty board: "clear 5 enemies from the mine" → gold + rare seed.
- Reputation with NPCs unlocks better contracts and bow/tool tiers.

**Loop:** read board → plan planting → farm/cook → hunt bounties → fulfil contracts → reputation → better everything.

**Pros:** daily login meaning, uses the existing NPC/quest scaffolding. **Cons:** most work — needs persistence for real daily rotation.

---

## 6. Recommendation

Build in this order:

1. **Enemy entity + AI** (wander/chase/attack with player sprites) and the **arrow projectile** — the core new mechanic.
2. **Proposal A** — make Wood/Stone unsellable, wire gold into bow/tool upgrades.
3. **Proposal B** — HP drain and food healing.
4. **Proposal C** — contracts once progress is saved server-side.

The single highest-value change regardless of path: **stop letting players sell Wood and Stone for more than a crop is worth** — that one tuning line makes the farm mandatory, and the bow makes gold matter.
