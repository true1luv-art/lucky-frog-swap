import type Phaser from 'phaser'

/**
 * The 80×80 character pack ships every action as a 4-row sheet:
 *   row 0 → facing away from camera (up)
 *   row 1 → facing the camera       (down)
 *   row 2 → facing left
 *   row 3 → facing right
 *
 * Animations are therefore registered as `<base>_<facing>` plus a `<base>`
 * alias that points at the front-facing row, so any legacy call site that
 * plays the bare key still renders a sane animation.
 */
export type Facing = 'up' | 'down' | 'left' | 'right'

export const FACINGS: Facing[] = ['up', 'down', 'left', 'right']

/** Row index inside a 4-row sheet for each facing. */
export const DIRECTION_ROW: Record<Facing, number> = {
  up: 0,
  down: 1,
  left: 2,
  right: 3,
}

/** Default facing used when a caller has no direction information. */
export const DEFAULT_FACING: Facing = 'down'

export function directionalKey(base: string, facing: Facing): string {
  return `${base}_${facing}`
}

/** Strips the `_up|_down|_left|_right` suffix from an animation key. */
export function animBase(key?: string | null): string {
  if (!key) return ''
  const match = /^(.*)_(up|down|left|right)$/.exec(key)
  return match ? match[1] : key
}

/** Reads the facing suffix from an animation key, if it has one. */
export function animFacing(key?: string | null): Facing | null {
  if (!key) return null
  const match = /_(up|down|left|right)$/.exec(key)
  return match ? (match[1] as Facing) : null
}

/** Picks the facing that best matches a movement/aim vector. */
export function facingFromVector(dx: number, dy: number): Facing {
  if (Math.abs(dx) >= Math.abs(dy)) return dx < 0 ? 'left' : 'right'
  return dy < 0 ? 'up' : 'down'
}

/**
 * Plays the directional variant of `base` for the given facing, falling back
 * to the bare key when the directional variant is not registered.
 * Directional rows already contain left/right art, so horizontal flipping is
 * cleared here.
 */
export function playDirectional(
  sprite: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite,
  base: string,
  facing: Facing = DEFAULT_FACING,
  ignoreIfPlaying = true,
): string | null {
  const scene = sprite.scene
  if (!scene) return null
  const directional = directionalKey(base, facing)
  const key = scene.anims.exists(directional)
    ? directional
    : scene.anims.exists(base)
      ? base
      : null
  if (!key) return null
  if (sprite.flipX) sprite.setFlipX(false)
  sprite.play(key, ignoreIfPlaying)
  return key
}
