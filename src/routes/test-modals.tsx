import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { useState } from "react";

import { AudioProvider } from "@/context/AudioContext";
import { PlayerProvider } from "@/context/PlayerContext";
import { MarketModal } from "@/features/game-components/market/MarketModal";
import { KitchenModal } from "@/features/game-components/kitchen/KitchenModal";
import { BarnModal } from "@/features/game-components/animals/BarnModal";
import { InventoryItems } from "@/features/game-components/hud/components/InventoryItems";
import { FishCaughtModal } from "@/features/game-components/fishing/FishCaughtModal";
import { ModalShell, ModalTitleBar, NavRail, ActionDock, StatChip, SectionLabel } from "@/components/ui/modal";
import { InnerPanel } from "@/components/ui/Panel";
import { Button } from "@/components/ui/Button";


export const Route = createFileRoute("/test-modals")({
  head: () => ({
    meta: [
      { title: "Modal Test Dashboard — Lucky Frog" },
      { name: "description", content: "Developer page for previewing every Lucky Frog modal shell and panel." },
      { property: "og:title", content: "Modal Test Dashboard — Lucky Frog" },
      { property: "og:description", content: "Developer page for previewing every Lucky Frog modal shell and panel." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: TestModalsPage,
});

const DEMO_SECTIONS = [
  { id: "one", label: "Section 1", icon: "/assets/icons/basket.png" },
  { id: "two", label: "Section 2", icon: "/assets/tools/hammer.png" },
  { id: "three", label: "Section 3", icon: "/assets/icons/seedling.png" },
];

function ShellDemo({ tier, onClose }: { tier: "toast" | "panel" | "fullscreen"; onClose: () => void }) {
  const [active, setActive] = useState("one");
  return (
    <ModalShell
      show
      onClose={onClose}
      tier={tier}
      titleBar={
        <ModalTitleBar
          icon="/assets/icons/basket.png"
          title={`${tier} shell`}
          subtitle="Shell demo"
          onClose={onClose}
        />
      }
      navRail={
        tier === "toast" ? undefined : (
          <NavRail items={DEMO_SECTIONS} activeId={active} onSelect={setActive} />
        )
      }
      actionDock={
        <ActionDock info={<span>Context info · stock 12</span>}>
          <Button onClick={onClose}>Secondary</Button>
          <Button onClick={onClose}>Primary</Button>
        </ActionDock>
      }
    >
      {tier !== "toast" && (
        <div className="flex flex-wrap items-center gap-1">
          <SectionLabel>{`Demo · ${active}`}</SectionLabel>
          <StatChip icon="/assets/icons/coins.png" caption="Coins" value="1,234" />
          <StatChip icon="/assets/icons/heart.png" caption="Health" value="87 / 100" />

        </div>
      )}
      <InnerPanel className="flex min-h-24 items-center justify-center p-3 text-center text-[10px] text-white text-shadow">
        Body content area — scrolls independently. Active section: {active}
      </InnerPanel>
      <InnerPanel className="flex min-h-24 items-center justify-center p-3 text-center text-[10px] text-white text-shadow">
        Second content section
      </InnerPanel>
    </ModalShell>
  );
}

function TestModalsPage() {
  const [open, setOpen] = useState<string | null>(null);
  const close = () => setOpen(null);

  const groups: { phase: string; title: string; items: string[] }[] = [
    { phase: "Shell", title: "Shell tiers", items: ["Shell (Toast)", "Shell (Panel)", "Shell (Fullscreen)"] },
    { phase: "Game", title: "Farming & Trading", items: ["Market", "Barn", "Kitchen"] },
    { phase: "HUD", title: "Inventory & Rewards", items: ["Inventory", "Fish Caught"] },
  ];

  return (
    <PlayerProvider initialPlayer={{ username: "Farmer", wallet: "local", sol: 0 }}>
      <AudioProvider>
        <div data-game-route className="min-h-screen bg-[#1a0f0a] p-6">
          <h1 className="font-pixel text-sm text-gold">Modal Test Dashboard</h1>
          <p className="mt-2 font-pixel text-[9px] text-white/50">/test-modals — developer use only</p>

          <div className="mt-6 space-y-6">
            {groups.map((g) => (
              <section key={g.phase} className="border-t border-white/10 pt-4">
                <p className="font-pixel text-[9px] text-white/60">
                  <span className="mr-2 rounded bg-brown-700 px-2 py-1 text-gold">{g.phase}</span>
                  {g.title}
                </p>
                <div className="mt-3 flex flex-wrap gap-3">
                  {g.items.map((label) => (
                    <Button key={label} onClick={() => setOpen(label)}>
                      {label}
                    </Button>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <ClientOnly fallback={null}>
            {open === "Shell (Toast)" && <ShellDemo tier="toast" onClose={close} />}
            {open === "Shell (Panel)" && <ShellDemo tier="panel" onClose={close} />}
            {open === "Shell (Fullscreen)" && <ShellDemo tier="fullscreen" onClose={close} />}
            <MarketModal show={open === "Market"} onClose={close} />
            <BarnModal show={open === "Barn"} onClose={close} />
            <KitchenModal show={open === "Kitchen"} onClose={close} />
            <InventoryItems show={open === "Inventory"} onClose={close} />
            {open === "Fish Caught" && <FishCaughtModal fish={"Anchovy" as never} amount={2} onClose={close} />}
          </ClientOnly>
        </div>
      </AudioProvider>
    </PlayerProvider>
  );
}
