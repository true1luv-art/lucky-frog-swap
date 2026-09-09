

import React, { useState } from "react";
import { ModalShell, ModalTitleBar, ActionDock } from "@/components/ui/modal";
import { Button } from "@/components/ui/Button";
import { InnerPanel } from "@/components/ui/Panel";
import { useTutorialStore } from "@/features/game-stores/useTutorialStore";

const WIZARD = "/assets/brand/lucky_frog_wizard.png";

interface Slide {
  title:       string;
  image:       string;
  imageAlt:    string;
  steps:       string[];
}

const SLIDES: Slide[] = [
  {
    title:    "Welcome to Lucky Frog Farm!",
    image:    "/assets/brand/lucky_frog.png",
    imageAlt: "Lucky Frog mascot",
    steps: [
      "Build and manage your very own farm.",
      "Grow crops, raise animals, craft tools, and trade with other players.",
      "Earn $LFRG tokens by playing and mastering every skill.",
      "Follow this short guide to learn the basics before you start.",
    ],
  },
  {
    title:    "Your House",
    image:    "/assets/buildings/house.png",
    imageAlt: "House building",
    steps: [
      "The House is your home base. Click it to view your skills and progress.",
      "Level up Farming, Mining, Fishing, Cooking, and Smithing.",
      "Each skill level unlocks new crafting recipes and boosts.",
      "Check your quests here to earn bonus rewards.",
    ],
  },
  {
    title:    "Farming — Fields",
    image:    "/assets/buildings/cabin.png",
    imageAlt: "Cabin / fields",
    steps: [
      "Select a Seed from your hotbar, then click an empty field to plant.",
      "Equip your Watering Can and click the planted field to water it.",
      "Once the crop is fully grown, click the field again to harvest.",
      "Harvested crops can be sold or cooked into food.",
    ],
  },
  {
    title:    "Animals & Hatchery",
    image:    "/assets/buildings/hatchery.png",
    imageAlt: "Hatchery building",
    steps: [
      "Buy animals from the Market — Chickens, Cows, Sheep, and more.",
      "Animals live on your farm and produce resources over time.",
      "Chickens lay Eggs, Cows give Milk, and Sheep drop Wool.",
      "Animal products can be cooked, crafted, or sold for Coins.",
    ],
  },
  {
    title:    "Fishing",
    image:    "/assets/tools/fishing_rod.png",
    imageAlt: "Fishing rod",
    steps: [
      "Equip a Fishing Rod from your hotbar and head to the water.",
      "Click the water to cast your line and wait for a bite.",
      "Fish can be cooked into food that restores extra HP.",
      "Rare fish sell for high Coin value at the Market.",
    ],
  },
  {
    title:    "Blacksmith",
    image:    "/assets/buildings/blacksmith_building.gif",
    imageAlt: "Blacksmith building",
    steps: [
      "Click the Blacksmith to smelt ores and craft tools.",
      "Wood-tier tools are free and last forever.",
      "Higher-tier tools (Stone, Iron, Gold…) are faster but have durability.",
      "Craft armor and weapons to boost your player stats.",
    ],
  },
  {
    title:    "Kitchen",
    image:    "/assets/buildings/kitchen_building.png",
    imageAlt: "Kitchen building",
    steps: [
      "Bring harvested crops to the Kitchen to cook meals.",
      "Cooked food restores HP, keeping you in good shape.",
      "Recipes unlock as your Cooking skill increases.",
      "Rare dishes grant temporary stat buffs.",
    ],
  },
  {
    title:    "Market",
    image:    "/assets/buildings/market_building.png",
    imageAlt: "Market building",
    steps: [
      "Visit the Market to buy Seeds, Animals, and crafting materials.",
      "You can also list your crops, food, and items for sale.",
      "Prices fluctuate — check back often for the best deals.",
      "Use your in-game Coins to buy, and earn Coins by selling.",
    ],
  },
  {
    title:    "Bank & Vault",
    image:    "/assets/buildings/bank.gif",
    imageAlt: "Bank building",
    steps: [
      "The Bank lets you withdraw your in-game Coins as $LFRG tokens on-chain.",
      "Earn Coins by selling crops, items, and completing quests.",
      "When you are ready, withdraw Coins to receive $LFRG directly in your wallet.",
      "The Vault stores your unclaimed rewards and full transaction history.",
    ],
  },
  {
    title:    "Health",
    image:    "/assets/icons/heart.png",
    imageAlt: "Heart / health icon",
    steps: [
      "Your HP bar shows how healthy your farmer is.",
      "Eat cooked food to restore HP instantly.",
      "Better recipes restore more HP.",
      "Keep a meal handy before long expeditions!",
    ],
  },
  {
    title:    "Mining",
    image:    "/assets/buildings/mine.gif",
    imageAlt: "Mine building",
    steps: [
      "Click the Mine to collect Stone, Iron, Gold, and rare ores.",
      "Equip a Pickaxe from your hotbar before mining.",
      "Better pickaxes mine faster and unlock deeper ore veins.",
      "Smelted ores are used by the Blacksmith to craft gear.",
    ],
  },
  {
    title:    "You&apos;re all set!",
    image:    "/assets/brand/lucky_frog_wizard.png",
    imageAlt: "Lucky Frog Wizard",
    steps: [
      "That covers the basics — now it's time to play!",
      "You can re-read this guide anytime via the player menu.",
      "Explore the farm, try everything, and have fun.",
      "Good luck, Farmer — may your harvest be plentiful!",
    ],
  },
];

export const TutorialWizard: React.FC = () => {
  const { isOpen, closeTutorial } = useTutorialStore();
  const [step, setStep] = useState(0);

  const slide    = SLIDES[step];
  const isLast   = step === SLIDES.length - 1;
  const isFirst  = step === 0;

  const handleNext = () => {
    if (isLast) { closeTutorial(); setStep(0); }
    else setStep((s) => s + 1);
  };

  const handleBack = () => setStep((s) => Math.max(0, s - 1));

  const handleSkip = () => { closeTutorial(); setStep(0); };

  if (!isOpen) return null;

  return (
    <ModalShell
      show={isOpen}
      onClose={handleSkip}
      tier="panel"
      static
      titleBar={
        <ModalTitleBar
          icon={WIZARD}
          title="Tutorial"
          subtitle={`Step ${step + 1} of ${SLIDES.length}`}
          onClose={handleSkip}
        />
      }
      actionDock={
        <ActionDock
          info={
            <div className="flex items-center gap-1">
              {SLIDES.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setStep(i)}
                  aria-label={`Go to step ${i + 1}`}
                  className={[
                    "w-2 h-2 transition-all",
                    i === step
                      ? "bg-neon scale-125"
                      : "bg-white/30 hover:bg-white/60",
                  ].join(" ")}
                />
              ))}
            </div>
          }
        >
          {!isFirst && (
            <Button onClick={handleBack} className="w-24">
              <span className="text-white text-xs text-shadow">Back</span>
            </Button>
          )}
          <Button onClick={handleSkip} className="w-24">
            <span className="text-white text-xs text-shadow">Skip</span>
          </Button>
          <Button onClick={handleNext} className="w-32">
            <span className="text-white text-xs text-shadow font-bold">
              {isLast ? "Start Playing" : "Next"}
            </span>
          </Button>
        </ActionDock>
      }
      bodyClassName="p-1"
    >
      {/* Slide image */}
      <InnerPanel className="flex items-center justify-center p-4 min-h-[120px]">
        <img
          key={slide.image}
          src={slide.image}
          alt={slide.imageAlt}
          className="max-h-24 object-contain"
          style={{ imageRendering: "pixelated" }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </InnerPanel>

      {/* Slide title */}
      <div className="px-1">
        <p className="font-pixel text-sm text-white text-shadow text-center leading-relaxed">
          {slide.title}
        </p>
      </div>

      {/* Steps list */}
      <InnerPanel className="p-2 flex flex-col gap-2">
        {slide.steps.map((text, i) => (
          <div key={i} className="flex items-start gap-2">
            <span
              className="shrink-0 w-4 h-4 flex items-center justify-center bg-neon/20 border border-neon text-neon font-pixel text-[8px] leading-none mt-0.5"
              aria-hidden
            >
              {i + 1}
            </span>
            <p className="text-white text-xs text-shadow leading-relaxed">{text}</p>
          </div>
        ))}
      </InnerPanel>
    </ModalShell>
  );
};
