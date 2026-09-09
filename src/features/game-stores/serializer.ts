/**
 * Serializer for the farming game store.
 * Converts Date objects to ISO strings for localStorage persistence
 * and restores them on rehydration.
 */
import type { GameState } from "@/features/types/gameplay";

/**
 * Replacer for JSON.stringify — converts Date → ISO string.
 */
export function replacer(_key: string, value: unknown): unknown {
  if (value instanceof Date) {
    return { __type: "Date", value: value.toISOString() };
  }
  return value;
}

/**
 * Reviver for JSON.parse — restores ISO string → Date.
 */
export function reviver(_key: string, value: unknown): unknown {
  if (
    value !== null &&
    typeof value === "object" &&
    (value as Record<string, unknown>).__type === "Date"
  ) {
    return new Date((value as Record<string, unknown>).value as string);
  }
  return value;
}

export function serialize(state: GameState): string {
  return JSON.stringify(state, replacer);
}

export function deserialize(raw: string): GameState {
  return JSON.parse(raw, reviver) as GameState;
}
