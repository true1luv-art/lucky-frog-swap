# HUD coin placement and circular minimap

## Changes
- Move the coin/token counter beneath the existing menu button, keeping both together in the upper-left corner shown in the game.
- Add a circular minimap in the upper-right corner that shows the full farm and updates the player’s position live.
- Size and reposition the minimap on smaller screens so it stays clear of the gameplay controls.

## Technical details
- Add a secondary Phaser camera in `FarmScene`, centered on the whole map and clipped with a circular mask.
- Keep the minimap camera synchronized on resize and clean it up when the scene closes.
- Add a lightweight pixel-style circular rim in the HUD while preserving pointer access to gameplay underneath.

## Verification
- Check the game at desktop and mobile sizes.
- Confirm the coin counter no longer overlaps the minimap and the live map remains circular after resizing.
