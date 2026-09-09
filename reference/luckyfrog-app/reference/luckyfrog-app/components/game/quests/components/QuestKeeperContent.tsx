"use client";

/**
 * components/game/quests/components/QuestKeeperContent.tsx
 *
 * Full Quest Board screen on ModalShell (Phase D of
 * docs/modal-redesign-plan.md §3): NavRail sections (Daily / Weekly),
 * row-list quests (QuestRow) with per-row Complete buttons,
 * and an ActionDock showing reset timers.
 *
 * Village orders have been removed. §fold-quests design decision.
 *
 * - Fetches GET /api/quests (embedded quest board) via SWR.
 * - Fetches GET /api/farm/inventory via SWR (for live inventory check).
 * - On Complete click: POST /api/quests/:id/complete → shows RewardReveal.
 * - After RewardReveal dismiss: returns to board and revalidates both caches.
 */

import { useMemo, useState }     from "react";
import useSWR                    from "swr";
import { ModalShell, ModalTitleBar, NavRail, ActionDock } from "@/components/ui/modal";
import { QuestRow }              from "@/components/game/quests/components/QuestRow";
import { RewardReveal }          from "@/components/game/quests/components/RewardReveal";
import type { EmbeddedQuest, FrogmentRollResult } from "@/shared/types/quests";

const questIcon = "/assets/icons/quest.png";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface QuestBoardResponse {
  success: boolean;
  daily:   EmbeddedQuest[];
  weekly:  EmbeddedQuest[];
}

interface InventoryResponse {
  items:   Record<string, number>;
  balance: number;
}

interface CompletionPayload {
  guaranteed:  EmbeddedQuest["rewards"];
  rolls:       FrogmentRollResult[];
  totalRolls:  number;
}

type QuestSectionId = "daily" | "weekly";

const SECTIONS = [
  { id: "daily",  label: "Daily",  icon: "/assets/icons/stopwatch.png" },
  { id: "weekly", label: "Weekly", icon: "/assets/icons/timer.png" },
];

const SECTION_META: Record<QuestSectionId, { title: string; subtitle: string }> = {
  daily:  { title: "Daily Quests",  subtitle: "One per skill category. Reset at midnight UTC." },
  weekly: { title: "Weekly Quest",  subtitle: "Harder delivery — resets every Monday at midnight UTC." },
};

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

function useResetLabels() {
  return useMemo(() => {
    const now = new Date();
    // Daily: next midnight UTC
    const nextDaily = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1,
    ));
    const dailyMs = nextDaily.getTime() - now.getTime();
    const dailyH  = Math.floor(dailyMs / 3_600_000);
    const dailyM  = Math.floor((dailyMs % 3_600_000) / 60_000);

    // Weekly: next Monday midnight UTC
    const day = now.getUTCDay(); // 0 Sun … 6 Sat
    const daysToMonday = ((8 - day) % 7) || 7;
    const nextWeekly = new Date(Date.UTC(
      now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysToMonday,
    ));
    const weeklyMs = nextWeekly.getTime() - now.getTime();
    const weeklyD  = Math.floor(weeklyMs / 86_400_000);
    const weeklyH  = Math.floor((weeklyMs % 86_400_000) / 3_600_000);

    return {
      daily:  `${dailyH}h ${dailyM}m`,
      weekly: weeklyD > 0 ? `${weeklyD}d ${weeklyH}h` : `${weeklyH}h`,
    };
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

interface QuestKeeperContentProps {
  show:    boolean;
  onClose: () => void;
}

export function QuestKeeperContent({ show, onClose }: QuestKeeperContentProps) {
  const [section, setSection]                 = useState<QuestSectionId>("daily");
  const [completing, setCompleting]           = useState<string | null>(null);
  const [completionError, setCompletionError] = useState<string | null>(null);

  const [revealPayload, setRevealPayload]     = useState<CompletionPayload | null>(null);
  const [revealQuestName, setRevealQuestName] = useState<string>("");

  const resets = useResetLabels();

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

      // Determine which section the quest belongs to so we can label it.
      const isWeekly       = (questData?.weekly ?? []).some((q) => q.id === questId);
      const completedQuest = [
        ...(questData?.daily  ?? []),
        ...(questData?.weekly ?? []),
      ].find((q) => q.id === questId);
      if (completedQuest) {
        const cat  = completedQuest.category.charAt(0).toUpperCase() + completedQuest.category.slice(1);
        const type = isWeekly ? "Weekly Quest" : "Daily Quest";
        const diff = completedQuest.difficulty.charAt(0).toUpperCase() + completedQuest.difficulty.slice(1);
        setRevealQuestName(`${type} — ${cat} (${diff})`);
      }

      setRevealPayload({
        guaranteed: body.guaranteed,
        rolls:      body.rolls ?? [],
        totalRolls: body.totalRolls ?? 0,
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

  // ── Section quests ─────────────────────────────────────────────────────────

  const sectionQuests: EmbeddedQuest[] =
    section === "daily" ? (questData?.daily ?? []) : (questData?.weekly ?? []);

  const meta = SECTION_META[section];

  // ── Body content ─────────��─────────────────────────────────────────────────

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
        {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
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

        <p className="text-[10px] text-white/60 px-0.5">{meta.subtitle}</p>

        {sectionQuests.length === 0 ? (
          <p className="text-xs opacity-50 italic px-0.5 py-4">No quests available.</p>
        ) : (
          sectionQuests.map((q) => (
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
          subtitle={meta.title}
          onClose={onClose}
        />
      }
      navRail={
        revealPayload ? undefined : (
          <NavRail
            items={SECTIONS}
            activeId={section}
            onSelect={(id) => setSection(id as QuestSectionId)}
          />
        )
      }
      actionDock={
        revealPayload ? undefined : (
          <ActionDock
            info={
              <span className="truncate">
                Daily reset in {resets.daily} · Weekly reset in {resets.weekly}
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
