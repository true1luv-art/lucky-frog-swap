

import React, { useMemo, useState } from "react";
import Decimal from "decimal.js-light";
import type { InventoryItemName } from "@/features/types/gameplay/game";

import { TOOLS } from "@/features/types/gameplay/craftables";
import { TOOL_CRAFT_RECIPES, TOOL_MAX_DURABILITY } from "@/features/types/gameplay/tools";
import type { ToolTier, ToolName } from "@/features/types/gameplay/tools";
import type { OreType } from "@/features/types/gameplay/resources";
import { ITEM_DETAILS } from "@/features/types/item-details";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { useFarmToast } from "@/context/ToastContext";
import { ModalShell, ModalTitleBar, ActionDock, NavRail } from "@/components/ui/modal";
import type { NavRailItem } from "@/components/ui/modal/NavRail";
import { Button } from "@/components/ui/Button";
import { ShopShowcase, ShowcaseChip } from "@/components/ui/ShopShowcase";
import { ShopShelf } from "@/components/ui/ShopShelf";
import { Box } from "@/components/ui/Box";
import type { ResourceName } from "@/features/types/gameplay/resources";

const blacksmithIcon = "/assets/icons/anvil.png";
const hammerIcon     = "/assets/icons/hammer.png";

const ORE_TYPES: OreType[] = ["Iron", "Silver", "Emerald", "Diamond", "Ignisite"];

const ORE_TO_INGOT: Record<OreType, string> = {
  Iron:     "Iron Ingot",
  Silver:   "Silver Ingot",
  Emerald:  "Emerald Ingot",
  Diamond:  "Diamond Ingot",
  Ignisite: "Ignisite Ingot",
};

const SMELT_ORE_PER_INGOT  = 10;
const SMELT_COAL_PER_INGOT = 1;
const COAL_WOOD_COST       = 2;

/** Items available on the smelt shelf: Coal craft slot + each ore type. */
type SmeltItem = "Coal" | OreType;

const NAV_ITEMS: NavRailItem[] = [
  { id: "smelt", label: "Smelt", icon: hammerIcon     },
  { id: "tools", label: "Tools", icon: hammerIcon     },
];

function itemImage(name: string): string {
  const detail = ITEM_DETAILS[name as InventoryItemName];
  return detail?.image ?? "/assets/icons/token.png";
}

/** Returns the sprite path for a tool given its tier and type name. */
function getToolImage(tier: ToolTier, name: ToolName): string {
  return `/assets/tools/${tier.toLowerCase()}_${name.toLowerCase().replace(/ /g, "_")}.png`;
}


function inv(inventory: Record<string, unknown>, key: string): number {
  const v = inventory[key];
  return v ? new Decimal(v as Decimal).toNumber() : 0;
}

interface Props {
  show: boolean;
  onClose: () => void;
}

type Tab = "smelt" | "tools";

export const BlacksmithModal: React.FC<Props> = ({ show, onClose }) => {
  const items     = useGameStore((s) => s.state?.items ?? {});
  const tools     = useGameStore((s) => s.state?.tools ?? []);
  const send      = useGameStore((s) => s.send);
  const { addToast } = useFarmToast();

  const [tab,          setTab]          = useState<Tab>("smelt");
  const [smeltItem,    setSmeltItem]    = useState<SmeltItem>("Iron");
  const [selectedTool, setSelectedTool] = useState<string>("Axe");
  const [toolTier,     setToolTier]     = useState<ToolTier>("Wood");

  const woodBalance  = inv(items as Record<string, unknown>, "Wood");
  const coalBalance  = inv(items as Record<string, unknown>, "Coal");

  // ── Smelt — coal ──────────────────────────────────────────────────────
  const canCraftCoal = woodBalance >= COAL_WOOD_COST;
  const craftCoal = () => {
    if (!canCraftCoal) return;
    try {
      send({ type: "coal.crafted", amount: 1 });
      addToast("Made 1 Coal");
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Cannot craft coal");
    }
  };

  // ── Smelt — ingot ─────────────────────────────────────────────────────
  const isSmeltingCoal = smeltItem === "Coal";
  const smeltOre       = isSmeltingCoal ? "Iron" : (smeltItem as OreType);
  const oreBalance     = inv(items as Record<string, unknown>, smeltOre);
  const ingotName      = ORE_TO_INGOT[smeltOre];
  const ingotBalance   = inv(items as Record<string, unknown>, ingotName);
  const canSmelt       = oreBalance >= SMELT_ORE_PER_INGOT && coalBalance >= SMELT_COAL_PER_INGOT;

  const smelt = () => {
    if (!canSmelt) return;
    try {
      send({ type: "ore.smelted", ore: smeltOre, amount: 1 });
      addToast(`Smelted 1 ${ingotName}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Cannot smelt");
    }
  };

  // ── Tools ─────────────────────────────────────────────────────────────
  const toolsConfig  = TOOLS();
  const toolEntries  = Object.entries(toolsConfig);
  const ORE_TIERS: ToolTier[] = ["Iron", "Silver", "Emerald", "Diamond", "Ignisite"];
  const allToolTiers: ToolTier[] = ["Wood", ...ORE_TIERS];

  const selectedToolCfg = toolsConfig[selectedTool as keyof typeof toolsConfig];
  const woodOwnedForTool = tools.some((t) => t.name === selectedTool && t.tier === "Wood");

  const getToolIngot = (t: ToolTier): { ingotName: string; cost: number } => {
    if (t === "Wood") return { ingotName: "", cost: 0 };
    const r = TOOL_CRAFT_RECIPES[t];
    const [n, c] = Object.entries(r)[0] ?? ["", 3];
    return { ingotName: n, cost: c as number };
  };

  const selectedToolIngot = toolTier === "Wood" ? { ingotName: "", cost: 0 } : getToolIngot(toolTier);
  const toolIngotBal      = selectedToolIngot.ingotName
    ? inv(items as Record<string, unknown>, selectedToolIngot.ingotName)
    : 0;
  const ownedToolInstance = tools.find((t) => t.name === selectedTool && t.tier === toolTier);
  const canCraftTool      = toolTier === "Wood" ? !woodOwnedForTool : toolIngotBal >= selectedToolIngot.cost;

  const craftTool = () => {
    if (toolTier === "Wood" && woodOwnedForTool) {
      addToast(`You already own a Wood ${selectedTool}`);
      return;
    }
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      send({ type: "tool.crafted", tool: selectedTool, tier: toolTier } as any);
      addToast(`Crafted ${toolTier} ${selectedTool}`);
    } catch (err) {
      addToast(err instanceof Error ? err.message : "Cannot craft tool");
    }
  };

  // ── Action Dock ────────────────────────────────────────────────────────
  const actionDock =
    tab === "smelt" ? (
      <ActionDock
        info={
          <span className="flex items-center gap-1 truncate text-[10px] text-shadow text-gray-400">
            <img src={itemImage("Coal")} alt="" className="w-4 h-4 pixelated" />
            {coalBalance} Coal owned
          </span>
        }
      >
        {isSmeltingCoal ? (
          <Button className="text-xs px-4 w-auto" disabled={!canCraftCoal} onClick={craftCoal}>
            Craft Coal
          </Button>
        ) : (
          <Button className="text-xs px-4 w-auto" disabled={!canSmelt} onClick={smelt}>
            Smelt Ingot
          </Button>
        )}
      </ActionDock>
    ) : tab === "tools" ? (
      <ActionDock
        info={
          <span className="truncate text-[10px] text-shadow text-gray-400">
            {toolTier} {selectedTool} {ownedToolInstance ? `— ${ownedToolInstance.durability ?? "∞"} uses left` : ""}
          </span>
        }
      >
        <Button className="text-xs px-4 w-auto" disabled={!canCraftTool} onClick={craftTool}>
          {toolTier === "Wood" ? "Craft Free" : "Craft"}
        </Button>
      </ActionDock>
    ) : null;

  // ── Render ───────────────────���─────────────────────────────────────────
  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={<ModalTitleBar title="Blacksmith" icon={blacksmithIcon} onClose={onClose} />}
      navRail={
        <NavRail
          items={NAV_ITEMS}
          activeId={tab}
          onSelect={(id) => setTab(id as Tab)}
        />
      }
      actionDock={actionDock}
      bodyClassName="overflow-y-auto px-1 pb-1"
    >

      {/* ═�� SMELT ══════════════════════════════════════════════════════════ */}
      {tab === "smelt" && (
        <>
          {/* Info box — Coal craft or ingot smelt details */}
          {isSmeltingCoal ? (
            <ShopShowcase
              name="Coal"
              image={itemImage("Coal")}
              description="Fuel the forge. 2 Wood per coal. Required for all ingot smelting."
              chips={
                <>
                  <ShowcaseChip icon={itemImage("Wood")} danger={woodBalance < COAL_WOOD_COST}>
                    {woodBalance} / {COAL_WOOD_COST} Wood
                  </ShowcaseChip>
                  <ShowcaseChip icon={itemImage("Coal")}>
                    {coalBalance} owned
                  </ShowcaseChip>
                </>
              }
            />
          ) : (
            <ShopShowcase
              name={ingotName}
              image={itemImage(ingotName)}
              description={`Refined ${smeltOre.toLowerCase()}. Used to forge ${smeltOre}-tier equipment.`}
              chips={
                <>
                  <ShowcaseChip
                    icon={itemImage(smeltOre)}
                    danger={oreBalance < SMELT_ORE_PER_INGOT}
                  >
                    {oreBalance} / {SMELT_ORE_PER_INGOT} {smeltOre}
                  </ShowcaseChip>
                  <ShowcaseChip
                    icon={itemImage("Coal")}
                    danger={coalBalance < SMELT_COAL_PER_INGOT}
                  >
                    {coalBalance} / {SMELT_COAL_PER_INGOT} Coal
                  </ShowcaseChip>
                  <ShowcaseChip icon={itemImage(ingotName)}>
                    {ingotBalance} owned
                  </ShowcaseChip>
                </>
              }
            />
          )}

          {/* Item list — Coal craft slot + ore type selectors */}
          <ShopShelf>
            <Box
              image={itemImage("Coal")}
              isSelected={smeltItem === "Coal"}
              onClick={() => setSmeltItem("Coal")}
              count={coalBalance}
            />
            {ORE_TYPES.map((ore) => (
              <Box
                key={ore}
                image={itemImage(ore)}
                isSelected={smeltItem === ore}
                onClick={() => setSmeltItem(ore)}
                count={inv(items as Record<string, unknown>, ore)}
              />
            ))}
          </ShopShelf>
        </>
      )}

      {/* ══ TOOLS ══════════════════════════════════════════════════════════ */}
      {tab === "tools" && (
        <>
          {/* Info box — selected tool × tier with requirements chips */}
          <ShopShowcase
            name={`${toolTier} ${selectedTool}`}
            image={getToolImage(toolTier, selectedTool as ToolName)}
            description={selectedToolCfg?.description ?? ""}
            chips={
              toolTier === "Wood" ? (
                <>
                  <ShowcaseChip>Free</ShowcaseChip>
                  <ShowcaseChip>Infinite durability</ShowcaseChip>
                  {woodOwnedForTool && <ShowcaseChip>Already owned</ShowcaseChip>}
                </>
              ) : (
                <>
                  <ShowcaseChip
                    icon={itemImage(selectedToolIngot.ingotName)}
                    danger={toolIngotBal < selectedToolIngot.cost}
                  >
                    {toolIngotBal} / {selectedToolIngot.cost} {selectedToolIngot.ingotName}
                  </ShowcaseChip>
                  <ShowcaseChip>
                    {TOOL_MAX_DURABILITY[toolTier] ?? 0} uses
                  </ShowcaseChip>
                  {ownedToolInstance && (
                    <ShowcaseChip>
                      Active — {ownedToolInstance.durability ?? "∞"} left
                    </ShowcaseChip>
                  )}
                </>
              )
            }
          />

          {/* Item list — tool type (Axe, Pickaxe, Rod…) */}
          <ShopShelf>
            {toolEntries.map(([name]) => (
              <Box
                key={name}
                image={getToolImage(toolTier, name as ToolName)}
                imageClassName="scale-150"
                isSelected={selectedTool === name}
                onClick={() => setSelectedTool(name)}
              />
            ))}
          </ShopShelf>

          {/* Item list — tier selector */}
          <ShopShelf>
            {allToolTiers.map((t) => (
              <Box
                key={t}
                image={getToolImage(t, selectedTool as ToolName)}
                imageClassName="scale-150"
                isSelected={toolTier === t}
                onClick={() => setToolTier(t)}
              />
            ))}
          </ShopShelf>
        </>
      )}


    </ModalShell>
  );
};
