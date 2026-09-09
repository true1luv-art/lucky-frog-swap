# NPC Phaser Module Refactor

## Goal
Give NPCs the same clean module structure as the player while preserving every current position, interaction, sprite size, facing direction, and editor workflow.

## Changes
- Add `Npcs.ts` as the NPC entity/factory responsible for creating, sizing, animating, depth-sorting, flipping, and destroying NPC sprites.
- Add `NpcAssetLoader.ts` as the single loader for Rancher, Trader, Blacksmith, and the shared fallback NPC sprite.
- Expand `AnimationConfig.ts` with typed NPC animation definitions for Rancher, Trader, Blacksmith, and fallback NPCs.
- Update `AnimationSystem` to register player and NPC animations from the shared animation configuration instead of maintaining duplicate animation constants.
- Remove NPC asset loading from the player and farm loaders, then wire the dedicated NPC loader into both the main game loader and map editor.
- Update world NPC spawning and map-editor markers to use the new NPC entity/animation helpers, preserving modal events and draggable editor behavior.
- Export the new loader through the loader index and verify the full project build.

## Technical Notes
- Rancher and Trader remain 9-frame, 96×64 spritesheets and use the player-style idle frame rate.
- Blacksmith remains a 23-frame, 84×56 spritesheet at its current animation rate.
- NPC IDs and events remain stable except the already-completed Barn Keeper → Rancher rename.
