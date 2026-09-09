

/**
 * components/game/quests/components/QuestKeeperContent.tsx
 *
 * Quest Board screen — daily quests only.
 * Weekly quests have been removed. §fold-quests design decision.
 *
 * - Fetches GET /api/quests (embedded quest board) via SWR.
 * - Fetches GET /api/farm/inventory via SWR (for live inventory check).
 * - On Complete click: POST /api/quests/:id/complete → shows RewardReveal.
 * - After RewardReveal dismiss: returns to board and revalidates both caches.
 */

import { useMemo, useState }     from "react";
import useSWR                    from "swr";
import { ModalShell, ModalTitleBar, ActionDock } from "@/components/ui/modal";
import { QuestRow }     from "@/features/game-components/quests/components/QuestRow";
import { RewardReveal } from "@/features/game-components/quests/components/RewardReveal";
import type { EmbeddedQuest } from "@/features/types/quests";

const questIcon = "/assets/icons/quest.png";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestBoardResponse {
  success: boolean;
  daily:   EmbeddedQuest[];
}

interface InventoryResponse {
  items:   Record<string, number>;
  balance: number;
}

interface CompletionPayload {
  skillXp:     number;
  goldAwarded: number;
  seedAwarded: string | null;
}

// ---------------------------------------------------------------------------
// SWR fetcher
// ---------------------------------------------------------------------------

async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error ?? `Request failed: ${url}`);
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Reset timer helper
// ---------------------------------------------------------------------------

function useDailyResetLabel(): string {
  return useMemo(() => {
    const now = new Date();
    const nextDaily = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    ));
    const ms = nextDaily.getTime() - now.getTime();
    const h  = Math.floor(ms / 3_600_000);
    const m  = Math.floor((ms % 3_600_000) / 60_000);
    return `${h}h ${m}m`;
  }, []);
}

// ---------------------------------------------------------------------------
// Skeleton loader
// ---------------------------------------------------------------------------

function RowSkeleton() {
  return (
    <div
      className="rounded bg-brown-600/60 animate-pulse"
      style={{ minHeight: 72 }}
    />
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface QuestKeeperModalProps {
  show:    boolean;
  onClose: () => void;
}

export function QuestKeeperModal({ show, onClose }: QuestKeeperModalProps) {
  const [completing, setCompleting]           = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const [revealPayload, setRevealPayload]     = useState<CompletionPayload | null>(null);
  const [revealQuestName, setRevealQuestName] = useState<string>("");

  const resetLabel = useDailyResetLabel();

  const {
    data:      questData,
    error:     questError,
    isLoading: questLoading,
    mutate:    mutateQuests,
  } = useSWR<QuestBoardResponse>(show ? "/api/quests" : null, fetcher, {
    refreshInterval: 60_000,
  });

  const {
    data:      inventoryData,
    error:     inventoryError,
    isLoading: inventoryLoading,
    mutate:    mutateInventory,
  } = useSWR<InventoryResponse>(show ? "/api/farm/inventory" : null, fetcher, {
    refreshInterval: 30_000,
  });

  const inventory = inventoryData?.items ?? {};
  const isLoading = questLoading || inventoryLoading;
  const error     = questError ?? inventoryError;

  // ── Complete handler ───────────────────────────────────────────────────────

  async function handleComplete(questId: string) {
    if (completing) return;
    setCompleting(questId);
    setCompletionError(null);

    try {
      const res = await fetch(`/api/quests/${questId}/complete`, {
        method: "POST",
      });

      const body = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(body.error ?? "Failed to complete quest");
      }

      const completedQuest = (questData?.daily ?? []).find((q) => q.id === questId);
      if (completedQuest) {
        const cat  = completedQuest.category.charAt(0).toUpperCase() + completedQuest.category.slice(1);
        const diff = completedQuest.difficulty.charAt(0).toUpperCase() + completedQuest.difficulty.slice(1);
        setRevealQuestName(`Daily Quest — ${cat} (${diff})`);
      }

      setRevealPayload({
        skillXp:     body.skillXp     ?? 0,
        goldAwarded: body.goldAwarded ?? 0,
        seedAwarded: body.seedAwarded ?? null,
      });

    } catch (err) {
      setCompletionError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setCompleting(null);
    }
  }

  // ── Reveal dismiss ─────────────────────────────────────────────────────────

  async function handleRevealDismiss() {
    setRevealPayload(null);
    setRevealQuestName("");
    await Promise.all([mutateQuests(), mutateInventory()]);
  }

  // ── Body content ───────────────────────────────────────────────────────────

  const dailyQuests = questData?.daily ?? [];

  let body: React.ReactNode;

  if (revealPayload) {
    body = (
      <RewardReveal
        payload={revealPayload}
        questName={revealQuestName}
        onDismiss={handleRevealDismiss}
      />
    );
  } else if (isLoading) {
    body = (
      <div className="flex flex-col gap-2 p-1">
        {Array.from({ length: 5 }).map((_, i) => <RowSkeleton key={i} />)}
      </div>
    );
  } else if (error) {
    body = (
      <div className="p-4 text-center">
        <p className="text-sm text-red-300 font-semibold">
          Failed to load quests: {error.message}
        </p>
        <p className="text-xs opacity-60 mt-1">
          Make sure you are logged in and try again.
        </p>
      </div>
    );
  } else {
    body = (
      <div className="flex flex-col gap-2 p-0.5">
        {completionError && (
          <div
            className="rounded px-3 py-2 text-xs text-red-300 bg-red-900/40"
            role="alert"
          >
            {completionError}
          </div>
        )}

        <p className="text-[10px] text-white/60 px-0.5">
          One per skill category. Resets at midnight UTC.
        </p>

        {dailyQuests.length === 0 ? (
          <p className="text-xs opacity-50 italic px-0.5 py-4">No quests available.</p>
        ) : (
          dailyQuests.map((q) => (
            <QuestRow
              key={q.id}
              quest={q}
              inventory={inventory}
              onComplete={handleComplete}
              completing={completing === q.id}
            />
          ))
        )}
      </div>
    );
  }

  // ── Shell ──────────────────────────────────────────────────────────────────

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={questIcon}
          title="Quest Board"
          subtitle="Daily Quests"
          onClose={onClose}
        />
      }
      actionDock={
        revealPayload ? undefined : (
          <ActionDock
            info={
              <span className="truncate">
                Resets in {resetLabel}
              </span>
            }
          />
        )
      }
    >
      {body}
    </ModalShell>
  );
}
