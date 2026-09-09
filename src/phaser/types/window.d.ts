import type { MobileHint, NodeTooltipData } from "@/phaser/farm/types";

declare global {
  interface Window {
    __gameStore?: {
      getState: () => {
        state: Record<string, unknown>;
        dispatch: (action: Record<string, unknown>) => void;
      };
      subscribe?: (callback: () => void) => () => void;
    };
    __mobileActionHint?: MobileHint | null;
    __nodeTooltip?: NodeTooltipData | null;
    __selectedItem?: string;
    __playerFarmState?: Record<string, unknown>;
  }
}

export {};
