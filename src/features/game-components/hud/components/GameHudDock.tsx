import { useContext, useEffect, useState } from "react";
import Decimal from "decimal.js-light";

import { Context } from "@/context/GameContext";
import { AvatarMenuPanel } from "@/features/game-components/hud/components/AvatarMenu";
import { InventoryItems } from "@/features/game-components/hud/components/InventoryItems";
import { getShortcuts } from "@/features/game-components/hud/lib/shortcuts";
import { MarketplaceModal } from "@/features/game-components/marketplace/MarketplaceModal";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { useTutorialStore } from "@/features/game-stores/useTutorialStore";
import { getMaxHp } from "@/features/game/hp";
import type { ToolInstance } from "@/features/types/gameplay/tools";
import { ITEM_DETAILS } from "@/features/types/item-details";

const basket = "/assets/icons/basket.png";
const button = "/assets/ui/button/round_button.png";
const darkBorder = "/assets/ui/panel/dark_border.png";

const menu = "/assets/icons/hamburger_menu.png";
const token = "/assets/icons/luckyfrog_token.png";

function shortcutImage(item: string, tools: ToolInstance[]) {
  const detail = ITEM_DETAILS[item as keyof typeof ITEM_DETAILS];
  if (detail?.image) return detail.image;
  const tool = tools.find((entry) => entry.name === item);
  return tool
    ? `/assets/tools/${tool.tier.toLowerCase()}_${tool.name.toLowerCase().replace(/ /g, "_")}.png`
    : undefined;
}

const slotBorder: React.CSSProperties = {
  borderStyle: "solid",
  borderWidth: 6,
  borderImage: `url(${darkBorder}) 25% repeat`,
  imageRendering: "pixelated",
};

export function GameHudDock({ wallet }: { wallet?: string }) {
  const state = useGameStore((store) => store.state);
  const reset = useGameStore((store) => store.reset);
  const { selectedItem, shortcutItem } = useContext(Context);
  const { openTutorial } = useTutorialStore();
  const [inventoryOpen, setInventoryOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [shortcuts, setShortcuts] = useState(() => getShortcuts());

  // Equipping from the inventory, market or a slot rewrites the cached
  // shortcut list — re-read it so the dock always shows the current tools.
  useEffect(() => {
    setShortcuts(getShortcuts());
  }, [selectedItem]);


  const maxHealth = getMaxHp(state.farmLevel);
  const health = Math.max(0, Math.min(maxHealth, state.hp ?? maxHealth));
  const healthPct = (health / maxHealth) * 100;
  const tools = (state.tools ?? []) as ToolInstance[];
  const actionSlots = shortcuts.slice(0, 3);
  const coins = new Decimal(state.coins ?? 0).toDecimalPlaces(3, Decimal.ROUND_DOWN).toString();

  const closeInventory = () => {
    setInventoryOpen(false);
    setShortcuts(getShortcuts());
  };

  return (
    <>
      {/* ── Upper-left: settings (menu) button ── */}
      <div className="pointer-events-none fixed top-2 left-1 sm:left-2 z-50 select-none">
        <button
          type="button"
          aria-label="Open player menu"
          title="Menu"
          onClick={() => setSettingsOpen(true)}
          className="pointer-events-auto relative grid h-10 w-10 sm:h-14 sm:w-14 place-items-center active:translate-y-px"
        >
          <img src={button} alt="" className="absolute inset-0 h-full w-full pixelated" />
          <img src={menu} alt="" className="relative h-1/2 w-1/2 object-contain pixelated" />
        </button>
      </div>

      {/* ── Upper-right: coins ── */}
      <div className="pointer-events-none fixed top-2 right-1 sm:right-2 z-50 select-none">
        <div
          className="pointer-events-auto flex items-center gap-1 whitespace-nowrap border-2 border-brown-700 bg-brown-600 px-1.5 py-1 sm:px-2"
          style={slotBorder}
          title={`${coins} coins`}
        >
          <img src={token} alt="" className="h-3.5 w-3.5 pixelated sm:h-4 sm:w-4" />
          <span className="font-pixel text-[8px] text-gold text-outline sm:text-[10px]">
            {coins}
          </span>
        </div>
      </div>

      {/* ── Bottom-center dock: hp bar, shortcuts + inventory ── */}
      <div className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+0.5rem)] z-40 flex justify-center px-1 select-none">
        <div className="flex flex-col items-center gap-1">
          <div
            className="pointer-events-auto relative flex h-4 w-full min-w-0 items-center overflow-hidden border-2 border-brown-700 bg-foreground/60 p-0.5 sm:h-5"
            style={slotBorder}
          >
            <div
              className="h-full bg-rose transition-[width] duration-500"
              style={{ width: `${healthPct}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center font-pixel text-[8px] text-primary-foreground text-outline sm:text-[10px]">
              {health}/{maxHealth}
            </span>
          </div>

          <div className="grid grid-cols-[auto_auto] items-end gap-1 sm:gap-2">
            <div className="grid grid-cols-3 gap-1">
              {Array.from({ length: 3 }, (_, index) => {
                const item = actionSlots[index];
                const image = item ? shortcutImage(item, tools) : undefined;
                const isEquipped = !!item && item === selectedItem;
                return (
                  <button
                    type="button"
                    key={item ?? `empty-${index}`}
                    aria-label={item ? `Equip ${item}` : `Empty shortcut ${index + 1}`}
                    aria-pressed={isEquipped}
                    title={item ?? "Empty shortcut"}
                    disabled={!item}
                    onClick={() => item && shortcutItem(item)}
                    className={`pointer-events-auto relative grid h-12 w-12 place-items-center active:translate-y-px sm:h-16 sm:w-16 ${
                      isEquipped ? "bg-brown-200 brightness-110" : "bg-brown-600"
                    }`}
                    style={slotBorder}
                  >
                    {image && (
                      <img
                        src={image}
                        alt=""
                        className={`relative h-4/5 w-4/5 object-contain pixelated ${
                          isEquipped ? "img-highlight" : ""
                        }`}
                      />
                    )}
                    <span className="absolute bottom-0.5 right-0.5 font-pixel text-[6px] text-primary-foreground text-outline">
                      {index + 1}
                    </span>
                  </button>
                );
              })}
            </div>


            <button
              type="button"
              aria-label="Open inventory"
              title="Inventory"
              onClick={() => setInventoryOpen(true)}
              className="pointer-events-auto relative grid h-12 w-12 place-items-center active:translate-y-px sm:h-16 sm:w-16"
            >
              <img src={button} alt="" className="absolute inset-0 h-full w-full pixelated" />
              <img src={basket} alt="" className="relative h-5 w-5 pixelated sm:h-8 sm:w-8" />
            </button>
          </div>
        </div>
      </div>

      <InventoryItems show={inventoryOpen} onClose={closeInventory} wallet={wallet} />

      {settingsOpen && (
        <AvatarMenuPanel
          show={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          name={state.username ?? "Hero"}
          onMarketplace={() => {
            setMarketplaceOpen(true);
            setSettingsOpen(false);
          }}
          onHowToPlay={() => {
            openTutorial();
            setSettingsOpen(false);
          }}
          onLogout={() => {
            if (confirm("Are you sure you want to logout?")) {
              reset();
              setSettingsOpen(false);
            }
          }}
        />
      )}

      <MarketplaceModal show={marketplaceOpen} onHide={() => setMarketplaceOpen(false)} />
    </>
  );
}