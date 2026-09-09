import React from "react";

import { OuterPanel } from "@/components/ui/Panel";
import { useGameStore } from "@/lib/stores/game/useGameStore";

export const VisitBanner: React.FC = () => {
  const id = useGameStore((s) => s.state.id);

  if (!id) return null;

  return (
    <div className="fixed bottom-2 left-2 z-50 shadow-lg">
      <OuterPanel>
        <div className="flex justify-center p-1">
          <span className="text-sm">{`Farm #${id}`}</span>
        </div>
      </OuterPanel>
    </div>
  );
};
