/**
 * editorBus
 * Tiny typed event bus bridging the Phaser EditorScene and the React HUD.
 * Kept dependency-free so it can be imported from both sides.
 */

export type EditorGroup = "trees" | "stones" | "plots" | "buildings" | "npcs";

export type AnimalKind = "chicken" | "cow" | "sheep";

export interface EditorMarker {
  key: string;
  group: EditorGroup;
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditorEvents {
  /** Scene finished building the world. */
  ready: { mapWidth: number; mapHeight: number };
  /** Full marker snapshot after any change. */
  markers: { markers: EditorMarker[] };
  /** Selection changed (null when cleared). */
  select: { marker: EditorMarker | null };
  /** Live camera state for the HUD readout. */
  camera: { zoom: number; tileX: number; tileY: number };
  /** Animal counts changed. */
  animals: { counts: Record<AnimalKind, number> };

  // ── Commands (HUD → scene) ────────────────────────────────────────────────
  "cmd:move": { key: string; x: number; y: number };
  "cmd:resize": { key: string; w: number; h: number };
  "cmd:select": { key: string | null };
  "cmd:focus": { key: string };
  "cmd:zoom": { zoom: number };
  "cmd:grid": { show: boolean };
  "cmd:reset": Record<string, never>;
  "cmd:animal-add": { kind: AnimalKind };
  "cmd:animal-remove": { kind: AnimalKind };
  "cmd:animal-clear": Record<string, never>;
  "cmd:animal-walk": { walking: boolean };
}

type Handler<K extends keyof EditorEvents> = (payload: EditorEvents[K]) => void;

class EditorBus {
  private handlers = new Map<string, Set<(payload: never) => void>>();

  on<K extends keyof EditorEvents>(event: K, handler: Handler<K>): () => void {
    let set = this.handlers.get(event as string);
    if (!set) {
      set = new Set();
      this.handlers.set(event as string, set);
    }
    set.add(handler as (payload: never) => void);
    return () => set?.delete(handler as (payload: never) => void);
  }

  emit<K extends keyof EditorEvents>(event: K, payload: EditorEvents[K]): void {
    const set = this.handlers.get(event as string);
    set?.forEach((handler) => (handler as (value: EditorEvents[K]) => void)(payload));
  }

  clear(): void {
    this.handlers.clear();
  }
}

export const editorBus = new EditorBus();
