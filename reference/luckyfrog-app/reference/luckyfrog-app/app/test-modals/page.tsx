"use client";

/**
 * app/test-modals/page.tsx
 *
 * Developer-only dashboard for testing every game modal with mock data.
 * No auth guard — accessible at /test-modals in any environment.
 *
 * Phases (see docs/test-modals-plan.md):
 *   Phase 1 — Market, Bazaar, Barn, Blacksmith, Kitchen   ✓ built
 *   Phase 2 — Quest Keeper (mock shell)                   ✓ built
 *   Phase 3 — Hatchery, Drop Result, Fish Caught          ✓ built
 *   Phase 4 — Vault, Hall of Fame, Marketplace            ✓ built
 *   Phase 5 — Bank, House, Wallet                         ✓ built
 *   Phase 6 — Avatar Menu, Music, Skills, Gear, Inventory  ✓ built
 */

import { useState } from "react";

// Phase 1 modals
import { MarketModal }           from "@/components/game/crops/MarketModal";
// Phase 2 stubs
import { QuestKeeperMockShell }  from "@/app/test-modals/stubs/QuestKeeperMockShell";
// Phase 3 modals
import { FishCaughtModal }   from "@/components/game/fishing/FishCaughtModal";
// Phase 4 modals
import { HallOfFameModal }      from "@/components/game/leaderboard/HallOfFameModal";
import { MarketplaceModal }     from "@/components/game/marketplace/MarketplaceModal";
import { MarketplaceMockShell } from "@/app/test-modals/stubs/MarketplaceMockShell";
// Phase 5 modals
import { BankModal }  from "@/components/game/bank/BankModal";
import { HouseModal } from "@/components/game/house/HouseModal";
// Phase 6 stubs
import { AvatarMenuMockShell, type AvatarMenuView } from "@/app/test-modals/stubs/AvatarMenuMockShell";
import { InventoryMockShell }                       from "@/app/test-modals/stubs/InventoryMockShell";
import {
  MOCK_WALLET,
  MOCK_WALLET_BALANCE,
  MOCK_FISH_CAUGHT,
} from "@/app/test-modals/mockup-data";
// Modal redesign — Phase A shell demo (docs/modal-redesign-plan.md)
import { ShellDemoMock } from "@/app/test-modals/stubs/ShellDemoMock";
import { BarnModal }       from "@/components/game/animals/BarnModal";
import { BlacksmithModal } from "@/components/game/blacksmith/BlacksmithModal";
import { KitchenModal }    from "@/components/game/kitchen/KitchenModal";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type Phase1Key = "market" | "barn" | "blacksmith" | "kitchen";
type Phase2Key = "quest-keeper";
type Phase3Key = "fish-caught";
type Phase4Key = "hall-of-fame" | "marketplace-live" | "marketplace-mock";
type Phase5Key = "bank" | "house";
  type Phase6Key = "avatar-main" | "avatar-music" | "inventory";
type ShellKey  = "shell-toast" | "shell-panel" | "shell-fullscreen";
type ModalKey  = Phase1Key | Phase2Key | Phase3Key | Phase4Key | Phase5Key | Phase6Key | ShellKey;

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

interface ButtonProps {
  label:   string;
  onClick: () => void;
  active?: boolean;
}

function TestButton({ label, onClick, active }: ButtonProps) {
  return (
    <button
      onClick={onClick}
      className={[
        "px-4 py-2 text-xs font-bold rounded",
        "border-b-4 active:border-b-0 active:translate-y-0.5",
        "transition-all duration-75 cursor-pointer",
        active
          ? "bg-[#c8922a] border-[#7a5010] text-white"
          : "bg-[#5c3d1e] border-[#3a2410] text-white/90 hover:bg-[#7a5230]",
      ].join(" ")}
      style={{ fontFamily: "var(--font-press-start)" }}
    >
      {label}
    </button>
  );
}

interface PhaseRowProps {
  phase:   number;
  title:   string;
  buttons: { label: string; key: ModalKey }[];
  active:  ModalKey | null;
  onOpen:  (key: ModalKey) => void;
}

function PhaseRow({ phase, title, buttons, active, onOpen }: PhaseRowProps) {
  return (
    <section className="mb-8">
      {/* row header */}
      <div className="flex items-center gap-3 mb-4">
        <span
          className="text-[10px] px-2 py-1 rounded bg-[#3a2410] text-yellow-400 border border-yellow-900"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          Phase {phase}
        </span>
        <h2
          className="text-[10px] text-white/80 tracking-wide"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          {title}
        </h2>
      </div>

      {/* buttons */}
      <div className="flex flex-wrap gap-3">
        {buttons.map((b) => (
          <TestButton
            key={b.key}
            label={b.label}
            active={active === b.key}
            onClick={() => onOpen(b.key)}
          />
        ))}
      </div>
    </section>
  );
}

interface PendingRowProps {
  phase: number;
  title: string;
}

function PendingRow({ phase, title }: PendingRowProps) {
  return (
    <section className="mb-8 opacity-35">
      <div className="flex items-center gap-3 mb-3">
        <span
          className="text-[10px] px-2 py-1 rounded bg-[#1e1408] text-white/30 border border-white/10"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          Phase {phase}
        </span>
        <h2
          className="text-[10px] text-white/30"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          {title}
        </h2>
      </div>
      <p
        className="text-[9px] text-white/25 pl-1"
        style={{ fontFamily: "var(--font-press-start)" }}
      >
        Run &quot;implement Phase {phase}&quot; to add this row.
      </p>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function TestModalsPage() {
  const [active, setActive] = useState<ModalKey | null>(null);

  const open  = (key: ModalKey) => setActive(key);
  const close = ()              => setActive(null);

  return (
    <main
      className="min-h-screen"
      style={{ background: "#120d07" }}
    >
      {/* top bar */}
      <div
        className="w-full border-b border-[#3a2410] px-8 py-4 flex items-center justify-between"
        style={{ background: "#1a1008" }}
      >
        <div>
          <h1
            className="text-sm text-yellow-300 mb-1"
            style={{ fontFamily: "var(--font-press-start)" }}
          >
            Modal Test Dashboard
          </h1>
          <p
            className="text-[9px] text-white/40"
            style={{ fontFamily: "var(--font-press-start)" }}
          >
            /test-modals — developer use only
          </p>
        </div>
        <a
          href="/docs/test-modals-plan.md"
          className="text-[9px] text-yellow-600 hover:text-yellow-400 underline"
          style={{ fontFamily: "var(--font-press-start)" }}
        >
          docs/test-modals-plan.md
        </a>
      </div>

      {/* body */}
      <div className="px-8 py-8 max-w-3xl">

        {/* divider helper */}
        <div className="border-b border-[#2a1c0c] mb-8" />

        {/* Redesign Phase A — shell demo (temporary, docs/modal-redesign-plan.md) */}
        <PhaseRow
          phase={0}
          title="Redesign Shell Demo (Phase A — temporary)"
          active={active}
          onOpen={open}
          buttons={[
            { label: "Shell (Toast)",      key: "shell-toast"      },
            { label: "Shell (Panel)",      key: "shell-panel"      },
            { label: "Shell (Fullscreen)", key: "shell-fullscreen" },
          ]}
        />

        <div className="border-b border-[#2a1c0c] mb-8" />

        {/* Phase 1 — live */}
        <PhaseRow
          phase={1}
          title="Farming & Trading"
          active={active}
          onOpen={open}
          buttons={[
            { label: "Market",     key: "market"     },
            { label: "Barn",       key: "barn"       },
            { label: "Blacksmith", key: "blacksmith" },
            { label: "Kitchen",    key: "kitchen"    },
          ]}
        />

        <div className="border-b border-[#2a1c0c] mb-8" />

        {/* Phase 2 — live */}
        <PhaseRow
          phase={2}
          title="Quest Keeper"
          active={active}
          onOpen={open}
          buttons={[
            { label: "Quest Board (mock)", key: "quest-keeper" },
          ]}
        />

        <div className="border-b border-[#2a1c0c] mb-8" />

        {/* Phase 3 — live */}
        <PhaseRow
          phase={3}
          title="Fish Caught"
          active={active}
          onOpen={open}
          buttons={[
            { label: "Fish Caught", key: "fish-caught" },
          ]}
        />

        <div className="border-b border-[#2a1c0c] mb-8" />

        {/* Phase 4 — live */}
        <PhaseRow
          phase={4}
          title="Hall of Fame · Marketplace"
          active={active}
          onOpen={open}
          buttons={[
            { label: "Hall of Fame",       key: "hall-of-fame"     },
            { label: "Marketplace (live)", key: "marketplace-live" },
            { label: "Marketplace (mock)", key: "marketplace-mock" },
          ]}
        />

        <div className="border-b border-[#2a1c0c] mb-8" />

        {/* Phase 5 — live */}
        <PhaseRow
          phase={5}
          title="Bank · House · Wallet"
          active={active}
          onOpen={open}
          buttons={[
            { label: "Bank",  key: "bank"  },
            { label: "House", key: "house" },
          ]}
        />

        <div className="border-b border-[#2a1c0c] mb-8" />

        {/* Phase 6 — live */}
        <PhaseRow
          phase={6}
          title="Avatar Menu · Music · Inventory"
          active={active}
          onOpen={open}
          buttons={[
            { label: "Avatar Menu", key: "avatar-main"  },
            { label: "Music",       key: "avatar-music" },
            { label: "Inventory",   key: "inventory"    },
          ]}
        />

        {/* active modal indicator */}
        {active && (
          <div className="mt-6 text-[9px] text-green-400/70" style={{ fontFamily: "var(--font-press-start)" }}>
            Active: {active} &mdash;{" "}
            <button onClick={close} className="underline cursor-pointer hover:text-green-300">
              close
            </button>
          </div>
        )}
      </div>

      {/* ── Redesign Phase A shell demo mounts ── */}
      <ShellDemoMock
        open={active === "shell-toast"}
        tier="toast"
        onClose={close}
      />
      <ShellDemoMock
        open={active === "shell-panel"}
        tier="panel"
        onClose={close}
      />
      <ShellDemoMock
        open={active === "shell-fullscreen"}
        tier="fullscreen"
        onClose={close}
      />

      {/* ── Phase 6 modal mounts ── */}
      {(() => {
        const avatarViewMap: Record<string, AvatarMenuView> = {
          "avatar-main":  "main",
          "avatar-music": "music",
        };
        const isAvatarKey = active != null && active in avatarViewMap;
        return (
          <AvatarMenuMockShell
            open={isAvatarKey}
            onClose={close}
            initialView={isAvatarKey ? avatarViewMap[active!] : "main"}
          />
        );
      })()}
      <InventoryMockShell
        open={active === "inventory"}
        onClose={close}
      />

      {/* ── Phase 3 modal mounts ── */}
      {active === "fish-caught" && (
        <FishCaughtModal
          fish={MOCK_FISH_CAUGHT.fish}
          amount={MOCK_FISH_CAUGHT.amount}
          onClose={close}
        />
      )}

      {/* ── Phase 5 modal mounts ── */}
      <HouseModal
        open={active === "house"}
        onClose={close}
        wallet={MOCK_WALLET}
      />

      {/* ── Phase 4 modal mounts ── */}
      <HallOfFameModal
        open={active === "hall-of-fame"}
        onClose={close}
        wallet={MOCK_WALLET}
      />
      <MarketplaceModal
        show={active === "marketplace-live"}
        onHide={close}
      />
      <MarketplaceMockShell
        open={active === "marketplace-mock"}
        onClose={close}
      />

      {/* ── Phase 1 modal mounts ── */}
      {/* ── Phase 2 modal mounts ── */}
      <QuestKeeperMockShell
        open={active === "quest-keeper"}
        onClose={close}
      />
      <MarketModal
        open={active === "market"}
        onClose={close}
      />
      <BarnModal
        open={active === "barn"}
        onClose={close}
      />
      <BlacksmithModal
        open={active === "blacksmith"}
        onClose={close}
      />
      <KitchenModal
        open={active === "kitchen"}
        onClose={close}
      />
    </main>
  );
}
