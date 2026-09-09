import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

/**
 * Local session store.
 *
 * This build has no backend: "signing in" just names the farmer and unlocks
 * the game route. The name is persisted in localStorage alongside the farm.
 */
export interface SessionState {
  username: string | null;
  signIn: (username: string) => void;
  signOut: () => void;
}

const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

export const useSession = create<SessionState>()(
  persist(
    (set) => ({
      username: null,
      signIn: (username: string) => set({ username: username.trim().slice(0, 20) || "Farmer" }),
      signOut: () => set({ username: null }),
    }),
    {
      name: "rhf_session",
      storage: createJSONStorage(() =>
        typeof window === "undefined" ? noopStorage : window.localStorage,
      ),
    },
  ),
);
