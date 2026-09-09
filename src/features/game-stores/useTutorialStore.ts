

import { create } from "zustand";

const STORAGE_KEY = "luckyfrog:tutorial_seen";

interface TutorialState {
  isOpen: boolean;
  openTutorial:  () => void;
  closeTutorial: () => void;
  /** Returns true when the player has already completed / dismissed the tutorial. */
  hasSeenTutorial: () => boolean;
}

export const useTutorialStore = create<TutorialState>()((set) => ({
  isOpen: false,

  openTutorial: () => set({ isOpen: true }),

  closeTutorial: () => {
    if (typeof window !== "undefined") {
      localStorage.setItem(STORAGE_KEY, "1");
    }
    set({ isOpen: false });
  },

  hasSeenTutorial: () => {
    if (typeof window === "undefined") return false;
    return localStorage.getItem(STORAGE_KEY) === "1";
  },
}));
