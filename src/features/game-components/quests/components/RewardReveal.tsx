

/**
 * components/game/quests/components/RewardReveal.tsx
 *
 * Simple reward confirmation shown after a quest is completed.
 * Displays the Skill XP and Gold earned.
 */

interface CompletionPayload {
  skillXp:     number;
  goldAwarded: number;
  seedAwarded: string | null;
}

interface RewardRevealProps {
  payload:   CompletionPayload;
  questName: string;
  onDismiss: () => void;
}

export function RewardReveal({ payload, questName, onDismiss }: RewardRevealProps) {
  return (
    <div className="flex flex-col gap-4 py-2">
      {/* Quest name */}
      <p className="text-center text-sm font-semibold opacity-70">{questName}</p>

      {/* Rewards */}
      <div className="rounded-lg bg-black/30 px-4 py-4 flex flex-col gap-3">
        <p className="text-xs font-bold text-yellow-300 uppercase tracking-wide">
          Quest Complete!
        </p>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between text-sm">
            <span className="opacity-70">Skill XP earned</span>
            <span className="font-bold text-green-300">+{payload.skillXp.toLocaleString()} XP</span>
          </div>
          {payload.goldAwarded > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-70">Gold earned</span>
              <span className="font-bold text-yellow-300">+{payload.goldAwarded.toLocaleString()} Gold</span>
            </div>
          )}
          {payload.seedAwarded && (
            <div className="flex items-center justify-between text-sm">
              <span className="opacity-70">Seed reward</span>
              <span className="font-bold text-lime-300">{payload.seedAwarded}</span>
            </div>
          )}
        </div>
      </div>

      <button
        onClick={onDismiss}
        className="w-full py-2.5 rounded-lg bg-yellow-400 hover:bg-yellow-300
                   text-brown-800 font-black text-sm transition-colors
                   focus:outline-none focus-visible:ring-2 focus-visible:ring-yellow-300"
      >
        Collect Rewards
      </button>
    </div>
  );
}
