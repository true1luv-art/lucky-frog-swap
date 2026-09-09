import Phaser from "phaser";
import { GAME_CONFIG } from "@/phaser/config/GameConfig";
import { FarmAssetLoader } from "@/phaser/loaders/FarmAssetLoader";
import { NpcAssetLoader } from "@/phaser/loaders/NpcAssetLoader";
import { createNpcSprite } from "@/phaser/entities/npcs";
import { AnimationSystem } from "@/phaser/systems/AnimationSystem";
import {
  BARN_ZONE,
  BUILDING_POSITIONS,
  NPC_POSITIONS,
  PLOT_POSITIONS,
  STONE_POSITIONS,
  TREE_POSITIONS,
} from "@/phaser/positions";
import { editorBus } from "@/phaser/editor/editorBus";
import type { AnimalKind, EditorGroup, EditorMarker } from "@/phaser/editor/editorBus";

const TILE = GAME_CONFIG.TILE_SIZE;
const MARKER_DEPTH = 20;
const OUTLINE_DEPTH = 30;
const GRID_DEPTH = 12;

const GROUP_COLOR: Record<EditorGroup, number> = {
  trees: 0x4ade80,
  stones: 0x9ca3af,
  plots: 0xfbbf24,
  buildings: 0xa78bfa,
  npcs: 0xf87171,
};

const BUILDING_TEXTURE: Record<string, string> = {
  house: "building_house",
  market: "building_market",
  firepit_1: "building_firepit",
  firepit_2: "building_firepit",
  blacksmith: "building_blacksmith",
  bank: "building_bank",
  wishing_well: "building_wishing_well",
};

const ANIMAL_ANIM: Record<AnimalKind, string> = {
  chicken: "editor_walk_chicken",
  cow: "editor_walk_cow",
  sheep: "editor_walk_sheep",
};
const ANIMAL_SPEED: Record<AnimalKind, number> = { chicken: 16, cow: 10, sheep: 12 };
const ANIMAL_MAX: Record<AnimalKind, number> = { chicken: 10, cow: 5, sheep: 5 };

interface MarkerEntry extends EditorMarker {
  sprite: Phaser.GameObjects.Image | Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  outline: Phaser.GameObjects.Rectangle;
}

interface EditorAnimal {
  kind: AnimalKind;
  sprite: Phaser.GameObjects.Sprite;
  timer?: Phaser.Time.TimerEvent | null;
}

/**
 * EditorScene — the map editor rendered with Phaser, so it shares the exact
 * tilemap, sprites, zoom and animal roaming behaviour with FarmScene.
 *
 * Left-drag  → move the highlighted asset (snaps to tiles)
 * Middle-drag → pan the camera
 * Wheel      → zoom around the cursor
 */
export class EditorScene extends Phaser.Scene {
  private markers: MarkerEntry[] = [];
  private animals: EditorAnimal[] = [];
  private grid?: Phaser.GameObjects.Graphics;
  private ranchOutline?: Phaser.GameObjects.Rectangle;
  private selectedKey: string | null = null;
  private dragKey: string | null = null;
  private dragOffset = { x: 0, y: 0 };
  private animalsWalking = true;
  private mapW = 40;
  private mapH = 40;
  private unbind: Array<() => void> = [];

  constructor() {
    super("EditorScene");
  }

  preload() {
    FarmAssetLoader.load(this);
    NpcAssetLoader.load(this);
    this.load.on("loaderror", (file: Phaser.Loader.File) => {
      console.warn(`[EditorScene] missing asset skipped: ${file.key}`);
    });
  }

  create() {
    const map = this.make.tilemap({ key: "farm" });
    const tileset = map.addTilesetImage("spr_tileset_sunnysideworld_16px", "tiles");
    if (tileset) {
      const layers = [
        "ground", "dirt", "trees", "path_1", "path_2",
        "plots", "pond", "fence", "decoration_1", "decoration_2",
      ];
      layers.forEach((name, index) => map.createLayer(name, tileset, 0, 0)?.setDepth(index));
    }
    this.mapW = map.width;
    this.mapH = map.height;

    const worldW = this.mapW * TILE;
    const worldH = this.mapH * TILE;
    this.cameras.main.setBounds(0, 0, worldW, worldH);
    this.cameras.main.setZoom(GAME_CONFIG.ZOOM);
    this.cameras.main.centerOn(worldW / 2, worldH / 2);

    // Sub-thin grid lines (fractional world px so they stay hairline at 4x zoom)
    this.grid = this.add.graphics().setDepth(GRID_DEPTH);
    this.grid.lineStyle(0.3, 0xffffff, 0.35);
    for (let x = 0; x <= worldW; x += TILE) {
      this.grid.lineBetween(x, 0, x, worldH);
    }
    for (let y = 0; y <= worldH; y += TILE) {
      this.grid.lineBetween(0, y, worldW, y);
    }

    this.ranchOutline = this.add
      .rectangle(
        BARN_ZONE.x * TILE,
        BARN_ZONE.y * TILE,
        BARN_ZONE.width * TILE,
        BARN_ZONE.height * TILE,
      )
      .setOrigin(0, 0)
      .setStrokeStyle(0.3, 0xfacc15, 0.9)
      .setDepth(GRID_DEPTH + 1);

    new AnimationSystem(this).createNpcAnimations();
    this.buildMarkers();
    this.createAnimalAnimations();
    this.bindInput();
    this.bindCommands();

    editorBus.emit("ready", { mapWidth: this.mapW, mapHeight: this.mapH });
    this.emitMarkers();
    this.emitAnimalCounts();
    this.emitCamera();

    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.teardown());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.teardown());
  }

  override update() {
    this.emitCamera();
  }

  // ── World markers ──────────────────────────────────────────────────────────

  private buildMarkers(): void {
    const add = (
      group: EditorGroup,
      id: string,
      x: number,
      y: number,
      w: number,
      h: number,
      texture?: string,
      facing?: "left" | "right",
    ) => {
      const px = x * TILE;
      const py = y * TILE;
      const color = GROUP_COLOR[group];
      const npcTexture = texture ?? "";
      const animatedNpc = group === "npcs" && npcTexture.startsWith("npc_") && this.textures.exists(npcTexture);
      const sprite = animatedNpc
        ? createNpcSprite(this, {
            x: px,
            y: py,
            width: w * TILE,
            height: h * TILE,
            texture: npcTexture,
            facing,
            origin: 0,
          })
        : texture && this.textures.exists(texture)
          ? this.add.image(px, py, texture).setOrigin(0, 0).setDisplaySize(w * TILE, h * TILE)
          : this.add.rectangle(px, py, w * TILE, h * TILE, color, 0.5).setOrigin(0, 0);
      sprite.setDepth(MARKER_DEPTH);

      const outline = this.add
        .rectangle(px, py, w * TILE, h * TILE)
        .setOrigin(0, 0)
        .setStrokeStyle(0.3, color, 0.85)
        .setDepth(OUTLINE_DEPTH);

      const entry: MarkerEntry = {
        key: `${group}:${id}`,
        group,
        id,
        x,
        y,
        w,
        h,
        sprite,
        outline,
      };
      sprite.setInteractive({ useHandCursor: true });
      sprite.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
        if (!pointer.leftButtonDown()) return;
        this.select(entry.key);
        this.dragKey = entry.key;
        this.dragOffset = {
          x: pointer.worldX - entry.x * TILE,
          y: pointer.worldY - entry.y * TILE,
        };
      });
      this.markers.push(entry);
    };

    TREE_POSITIONS.forEach((t) => add("trees", t.id, t.x, t.y, 2, 2, "tree_node"));
    STONE_POSITIONS.forEach((s) => add("stones", s.id, s.x, s.y, 2, 2, "stone_rock"));
    PLOT_POSITIONS.forEach((p) => add("plots", p.id, p.x, p.y, 1, 1, "plot_soil"));
    BUILDING_POSITIONS.forEach((b) =>
      add("buildings", b.type, b.x, b.y, b.width, b.height, BUILDING_TEXTURE[b.type]),
    );
    NPC_POSITIONS.forEach((n) =>
      add("npcs", n.id, n.x, n.y, n.width, n.height, n.texture ?? "npc_base", n.facing),
    );
  }

  private syncMarker(entry: MarkerEntry): void {
    const px = entry.x * TILE;
    const py = entry.y * TILE;
    entry.sprite.setPosition(px, py);
    if (entry.sprite instanceof Phaser.GameObjects.Image || entry.sprite instanceof Phaser.GameObjects.Sprite) {
      entry.sprite.setDisplaySize(entry.w * TILE, entry.h * TILE);
    } else {
      entry.sprite.setSize(entry.w * TILE, entry.h * TILE);
    }
    entry.outline.setPosition(px, py).setSize(entry.w * TILE, entry.h * TILE);
  }

  private select(key: string | null): void {
    this.selectedKey = key;
    for (const entry of this.markers) {
      const active = entry.key === key;
      entry.outline.setStrokeStyle(active ? 0.6 : 0.3, active ? 0xffffff : GROUP_COLOR[entry.group], active ? 1 : 0.85);
    }
    const found = this.markers.find((m) => m.key === key);
    editorBus.emit("select", { marker: found ? this.plain(found) : null });
  }

  private plain(entry: MarkerEntry): EditorMarker {
    return { key: entry.key, group: entry.group, id: entry.id, x: entry.x, y: entry.y, w: entry.w, h: entry.h };
  }

  private emitMarkers(): void {
    editorBus.emit("markers", { markers: this.markers.map((m) => this.plain(m)) });
  }

  private emitCamera(): void {
    const cam = this.cameras.main;
    const pointer = this.input.activePointer;
    editorBus.emit("camera", {
      zoom: cam.zoom,
      tileX: Math.floor(pointer.worldX / TILE),
      tileY: Math.floor(pointer.worldY / TILE),
    });
  }

  // ── Input ──────────────────────────────────────────────────────────────────

  private bindInput(): void {
    this.input.mouse?.disableContextMenu();

    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.leftButtonDown() && !this.hitMarker(pointer)) this.select(null);
    });

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const cam = this.cameras.main;
      if (pointer.middleButtonDown() || (pointer.rightButtonDown() && pointer.isDown)) {
        cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
        cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
        return;
      }
      if (!this.dragKey || !pointer.leftButtonDown()) return;
      const entry = this.markers.find((m) => m.key === this.dragKey);
      if (!entry) return;
      const nextX = Math.round((pointer.worldX - this.dragOffset.x) / TILE);
      const nextY = Math.round((pointer.worldY - this.dragOffset.y) / TILE);
      entry.x = Phaser.Math.Clamp(nextX, 0, this.mapW - entry.w);
      entry.y = Phaser.Math.Clamp(nextY, 0, this.mapH - entry.h);
      this.syncMarker(entry);
      editorBus.emit("select", { marker: this.plain(entry) });
    });

    this.input.on("pointerup", () => {
      if (!this.dragKey) return;
      this.dragKey = null;
      this.emitMarkers();
    });

    this.input.on(
      "wheel",
      (_p: Phaser.Input.Pointer, _o: unknown, _dx: number, dy: number) => {
        const cam = this.cameras.main;
        cam.setZoom(Phaser.Math.Clamp(cam.zoom * (dy > 0 ? 0.9 : 1.1), 1, 10));
      },
    );

    const nudge = (dx: number, dy: number) => {
      const entry = this.markers.find((m) => m.key === this.selectedKey);
      if (!entry) return;
      entry.x = Phaser.Math.Clamp(entry.x + dx, 0, this.mapW - entry.w);
      entry.y = Phaser.Math.Clamp(entry.y + dy, 0, this.mapH - entry.h);
      this.syncMarker(entry);
      editorBus.emit("select", { marker: this.plain(entry) });
      this.emitMarkers();
    };
    const keyboard = this.input.keyboard;
    keyboard?.on("keydown-LEFT", () => nudge(-1, 0));
    keyboard?.on("keydown-RIGHT", () => nudge(1, 0));
    keyboard?.on("keydown-UP", () => nudge(0, -1));
    keyboard?.on("keydown-DOWN", () => nudge(0, 1));
  }

  private hitMarker(pointer: Phaser.Input.Pointer): boolean {
    return this.markers.some(
      (m) =>
        pointer.worldX >= m.x * TILE &&
        pointer.worldX <= (m.x + m.w) * TILE &&
        pointer.worldY >= m.y * TILE &&
        pointer.worldY <= (m.y + m.h) * TILE,
    );
  }

  // ── HUD commands ───────────────────────────────────────────────────────────

  private bindCommands(): void {
    const withMarker = (key: string, fn: (entry: MarkerEntry) => void) => {
      const entry = this.markers.find((m) => m.key === key);
      if (!entry) return;
      fn(entry);
      this.syncMarker(entry);
      editorBus.emit("select", { marker: this.plain(entry) });
      this.emitMarkers();
    };

    this.unbind.push(
      editorBus.on("cmd:move", ({ key, x, y }) =>
        withMarker(key, (entry) => {
          entry.x = Phaser.Math.Clamp(x, 0, this.mapW - entry.w);
          entry.y = Phaser.Math.Clamp(y, 0, this.mapH - entry.h);
        }),
      ),
      editorBus.on("cmd:resize", ({ key, w, h }) =>
        withMarker(key, (entry) => {
          entry.w = Phaser.Math.Clamp(w, 1, 12);
          entry.h = Phaser.Math.Clamp(h, 1, 12);
        }),
      ),
      editorBus.on("cmd:select", ({ key }) => this.select(key)),
      editorBus.on("cmd:focus", ({ key }) => {
        const entry = this.markers.find((m) => m.key === key);
        if (!entry) return;
        this.cameras.main.pan(
          (entry.x + entry.w / 2) * TILE,
          (entry.y + entry.h / 2) * TILE,
          250,
          "Sine.easeInOut",
        );
        this.select(key);
      }),
      editorBus.on("cmd:zoom", ({ zoom }) =>
        this.cameras.main.setZoom(Phaser.Math.Clamp(zoom, 1, 10)),
      ),
      editorBus.on("cmd:grid", ({ show }) => this.grid?.setVisible(show)),
      editorBus.on("cmd:reset", () => {
        this.markers.forEach((m) => {
          m.sprite.destroy();
          m.outline.destroy();
        });
        this.markers = [];
        this.buildMarkers();
        this.select(null);
        this.emitMarkers();
      }),
      editorBus.on("cmd:animal-add", ({ kind }) => this.spawnAnimal(kind)),
      editorBus.on("cmd:animal-remove", ({ kind }) => this.removeAnimal(kind)),
      editorBus.on("cmd:animal-clear", () => this.clearAnimals()),
    );
  }

  // ── Animal spawn system ────────────────────────────────────────────────────

  private createAnimalAnimations(): void {
    const defs: Array<{ kind: AnimalKind; texture: string; frameRate: number }> = [
      { kind: "chicken", texture: "animal_chicken", frameRate: 6 },
      { kind: "cow", texture: "animal_cow", frameRate: 5 },
      { kind: "sheep", texture: "animal_sheep", frameRate: 5 },
    ];
    for (const def of defs) {
      const key = ANIMAL_ANIM[def.kind];
      if (this.anims.exists(key) || !this.textures.exists(def.texture)) continue;
      this.anims.create({
        key,
        frames: this.anims.generateFrameNumbers(def.texture, { start: 0, end: 3 }),
        frameRate: def.frameRate,
        repeat: -1,
      });
    }
  }

  private penBounds() {
    return {
      minX: (BARN_ZONE.x + 1) * TILE,
      maxX: (BARN_ZONE.x + BARN_ZONE.width - 1) * TILE,
      minY: (BARN_ZONE.y + 1) * TILE,
      maxY: (BARN_ZONE.y + BARN_ZONE.height - 1) * TILE,
    };
  }

  private spawnAnimal(kind: AnimalKind): void {
    if (this.animals.filter((a) => a.kind === kind).length >= ANIMAL_MAX[kind]) return;
    const bounds = this.penBounds();
    const sprite = this.add
      .sprite(
        Phaser.Math.Between(bounds.minX, bounds.maxX),
        Phaser.Math.Between(bounds.minY, bounds.maxY),
        `animal_${kind}`,
      )
      .setDepth(MARKER_DEPTH + 5)
      .setDisplaySize(TILE * 2, TILE * 2);
    if (this.anims.exists(ANIMAL_ANIM[kind])) sprite.play(ANIMAL_ANIM[kind]);
    const animal: EditorAnimal = { kind, sprite, timer: null };
    this.animals.push(animal);
    if (this.animalsWalking) this.scheduleWalk(animal);
    this.emitAnimalCounts();
  }

  private removeAnimal(kind: AnimalKind): void {
    let index = -1;
    for (let i = this.animals.length - 1; i >= 0; i -= 1) {
      if (this.animals[i]?.kind === kind) { index = i; break; }
    }
    if (index < 0) return;
    const [animal] = this.animals.splice(index, 1);
    if (animal) {
      animal.timer?.remove();
      this.tweens.killTweensOf(animal.sprite);
      animal.sprite.destroy();
    }
    this.emitAnimalCounts();
  }

  private clearAnimals(): void {
    for (const animal of this.animals) {
      animal.timer?.remove();
      this.tweens.killTweensOf(animal.sprite);
      animal.sprite.destroy();
    }
    this.animals = [];
    this.emitAnimalCounts();
  }

  /** Mirrors AnimalSystem roaming: idle 2–6 s, then walk to a random pen tile. */
  private scheduleWalk(animal: EditorAnimal): void {
    if (!animal.sprite.active) return;
    animal.timer?.remove();
    animal.sprite.anims.pause();
    animal.timer = this.time.delayedCall(2000 + Math.random() * 4000, () => {
      if (!animal.sprite.active || !this.animalsWalking) return;
      const bounds = this.penBounds();
      const targetX = Phaser.Math.Between(bounds.minX, bounds.maxX);
      const targetY = Phaser.Math.Between(bounds.minY, bounds.maxY);
      const distance = Phaser.Math.Distance.Between(animal.sprite.x, animal.sprite.y, targetX, targetY);
      animal.sprite.setFlipX(targetX > animal.sprite.x);
      animal.sprite.anims.resume();
      this.tweens.add({
        targets: animal.sprite,
        x: targetX,
        y: targetY,
        duration: Math.max(500, (distance / ANIMAL_SPEED[animal.kind]) * 1000),
        ease: "Linear",
        onComplete: () => this.scheduleWalk(animal),
      });
    });
  }

  private emitAnimalCounts(): void {
    const counts: Record<AnimalKind, number> = { chicken: 0, cow: 0, sheep: 0 };
    for (const animal of this.animals) counts[animal.kind] += 1;
    editorBus.emit("animals", { counts });
  }

  private teardown(): void {
    this.unbind.forEach((off) => off());
    this.unbind = [];
    this.clearAnimals();
  }
}
