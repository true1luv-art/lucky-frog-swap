# Lucky Frog — LFRG Economy and Halving

## Overview

Lucky Frog uses a global, automatic halving policy based on **lifetime LFRG emitted**. The authoritative counter is `totalLfrgEmitted` in the singleton game-stats record.

The current treasury balance is not used to determine the stage. Time, administrator actions, and asset supply also do not affect halving progression.

## Emission allocation

The documented LFRG emission allocation is **100,000,000 LFRG**, divided into five 20,000,000 LFRG tranches.

| Lifetime LFRG emitted | Stage | Emission multiplier |
|---:|---:|---:|
| 0–under 20M | 0 — Genesis | 1.0 |
| 20M–under 40M | 1 — First Halving | 0.5 |
| 40M–under 60M | 2 — Second Halving | 0.25 |
| 60M–under 80M | 3 — Third Halving | 0.125 |
| 80M–100M | 4 — Fourth Halving | 0.0625 |

Stage 4 remains the terminal configured multiplier at and above 100M. Crossing 100M does not create an undocumented sixth stage.

## Threshold semantics

Milestones activate at their exact cumulative totals:

- `19,999,999` LFRG emitted uses stage 0.
- `20,000,000` LFRG emitted uses stage 1.
- `40,000,000` LFRG emitted uses stage 2.
- `60,000,000` LFRG emitted uses stage 3.
- `80,000,000` LFRG emitted uses stage 4.

All game reward sources that create new LFRG must add their payout to `totalLfrgEmitted`. Transfers, marketplace trades, treasury credits, and other movements of existing LFRG are not new emission and must not increment it.

## Code ownership

The system lives in `lib/modules/game-stats`:

- `halving.ts` defines the five emission bands and pure derivation helpers.
- `model.server.ts` stores the lifetime counter plus denormalized stage and multiplier fields.
- `repository.server.ts` atomically increments emission and synchronizes the derived fields.
- `service.server.ts` exposes the server-authoritative halving snapshot.
- `treasury.server.ts` records game payouts through the shared emission path.

`totalLfrgEmitted` is the source of truth. Stored `halvingStage` and `emissionMultiplier` values are denormalized for observability and fast reads.

## Atomic progression

Whenever LFRG is emitted, one database update:

1. Adds the payout to `totalLfrgEmitted`.
2. Derives the stage from the resulting lifetime total.
3. Sets the corresponding multiplier.
4. Updates the record timestamp.

This allows one payout to cross one or more milestones safely and removes the need for a cron job or manual stage advancement.

The server applies the multiplier when calculating rewards. Clients may display the server-provided halving snapshot, but must not independently decide the authoritative stage.

## Sunflower Land comparison

Sunflower Land organizes economic content through date-based chapters. Lucky Frog does not copy that trigger model: its halving progression is based only on cumulative LFRG emission. The useful architectural pattern retained from the reference project is a centralized, typed policy with server-authoritative calculations.

## Invariants

- Halving progression never moves backward.
- Treasury balance never determines the stage.
- Existing-token transfers do not count as emission.
- Every newly created LFRG reward uses the same emission accounting path.
- The multiplier remains `0.0625` after the documented 100M allocation unless a future policy explicitly defines another stage.
