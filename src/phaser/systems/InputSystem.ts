import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import type { MovementResult } from "@/phaser/entities/Player";

const MOBILE_REGEX =
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;

interface JoystickInput {
  active:      boolean;
  normalizedX: number;
  normalizedY: number;
}

type Win = Window & {
  __mobileJoystickInput?: JoystickInput;
};

/**
 * InputSystem
 * Translates keyboard / mobile joystick state into a normalised movement vector.
 * Stateless output per frame — no side effects.
 */
export class InputSystem {
  private scene:       Phaser.Scene;
  private speed:       number;
  private isMobile:    boolean;
  private lastFacing:  MovementResult["facing"];
  private keys: {
    w: Phaser.Input.Keyboard.Key;
    a: Phaser.Input.Keyboard.Key;
    s: Phaser.Input.Keyboard.Key;
    d: Phaser.Input.Keyboard.Key;
  } | null;
  private _touchCleanup: (() => void) | null = null;

  constructor(scene: Phaser.Scene, options: { speed?: number } = {}) {
    this.scene      = scene;
    this.speed      = options.speed ?? GAME_CONFIG.PLAYER_SPEED;
    this.isMobile   = this._detectMobile();
    this.lastFacing = "down";

    this.keys = scene.input.keyboard
      ? (scene.input.keyboard.addKeys({
          w: Phaser.Input.Keyboard.KeyCodes.W,
          a: Phaser.Input.Keyboard.KeyCodes.A,
          s: Phaser.Input.Keyboard.KeyCodes.S,
          d: Phaser.Input.Keyboard.KeyCodes.D,
        }) as typeof this.keys)
      : null;

    if (this.isMobile) {
      this._preventCanvasTouchDefault(scene.game.canvas);
    }
  }

  getMovement(): MovementResult {
    return this.isMobile
      ? this._getMobileMovement()
      : this._getKeyboardMovement();
  }

  destroy() {
    this._touchCleanup?.();
    this.keys = null;
  }

  // ── Private ──────────────────────────────────────────────────────────────

  private _getKeyboardMovement(): MovementResult {
    if (!this.keys) return this._idle();

    let vx = 0;
    let vy = 0;
    let moving = false;

    if (this.keys.a.isDown) { vx -= 1; moving = true; }
    if (this.keys.d.isDown) { vx += 1; moving = true; }
    if (this.keys.w.isDown) { vy -= 1; moving = true; }
    if (this.keys.s.isDown) { vy += 1; moving = true; }

    if (!moving) return this._idle();

    const len = Math.hypot(vx, vy);
    if (len > 0) { vx = (vx / len) * this.speed; vy = (vy / len) * this.speed; }

    let facing = this.lastFacing;
    let flipX  = this.lastFacing === "left";

    if      (vx < 0) { facing = "left";  flipX = true;  }
    else if (vx > 0) { facing = "right"; flipX = false; }
    else if (vy < 0) { facing = "up";    }
    else if (vy > 0) { facing = "down";  }

    this.lastFacing = facing;
    return { vx, vy, moving, facing, flipX };
  }

  private _getMobileMovement(): MovementResult {
    const joystick =
      typeof window !== "undefined"
        ? (window as Win).__mobileJoystickInput
        : null;

    if (!joystick?.active) return this._idle();

    const vx = (joystick.normalizedX ?? 0) * this.speed;
    const vy = (joystick.normalizedY ?? 0) * this.speed;
    const moving = Math.abs(vx) > 0.1 || Math.abs(vy) > 0.1;

    if (!moving) return this._idle();

    let facing = this.lastFacing;
    let flipX  = this.lastFacing === "left";

    if (Math.abs(vx) > 0.1) {
      facing = vx > 0 ? "right" : "left";
      flipX  = vx < 0;
    } else if (Math.abs(vy) > 0.1) {
      facing = vy > 0 ? "down" : "up";
    }

    this.lastFacing = facing;
    return { vx, vy, moving, facing, flipX };
  }

  private _idle(): MovementResult {
    return {
      vx: 0, vy: 0,
      moving: false,
      facing: this.lastFacing,
      flipX: this.lastFacing === "left",
    };
  }

  private _detectMobile(): boolean {
    if (typeof navigator === "undefined") return false;
    const ua    = MOBILE_REGEX.test(navigator.userAgent);
    const touch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
    const small = typeof window !== "undefined" && window.innerWidth <= 768;
    const forced =
      typeof window !== "undefined" &&
      window.localStorage?.getItem("forceMobileMode") === "true";
    return forced || ua || (touch && small);
  }

  private _preventCanvasTouchDefault(canvas: HTMLCanvasElement | null) {
    if (!canvas) return;
    const opts = { passive: false } as EventListenerOptions;
    const noop = (e: Event) => e.preventDefault?.();
    canvas.addEventListener("touchstart", noop, opts);
    canvas.addEventListener("touchmove",  noop, opts);
    canvas.addEventListener("touchend",   noop, opts);
    this._touchCleanup = () => {
      canvas.removeEventListener("touchstart", noop);
      canvas.removeEventListener("touchmove",  noop);
      canvas.removeEventListener("touchend",   noop);
    };
  }
}
