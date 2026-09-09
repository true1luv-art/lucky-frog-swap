"use client";

import { useState } from "react";
import { InnerPanel, OuterPanel } from "@/components/ui/Panel";

const STEPS = [
  [
    "01",
    "Start Your Farm",
    "Begin with 6 crop plots, 5 sunflower seeds, basic tools, 100 stamina, and 0 HFARM.",
    "/assets/crops/sunflower/seed.png",
  ],
  [
    "02",
    "Grow & Gather",
    "Plant crops, chop trees, mine rocks, fish the pond, and care for livestock. Every action trains a skill.",
    "/assets/crops/sunflower/crop.png",
  ],
  [
    "03",
    "Cook & Recover",
    "Turn harvests into meals at the kitchen. Food restores stamina so you can keep progressing.",
    "/assets/buildings/kitchen_building.png",
  ],
  [
    "04",
    "Sell & Trade",
    "Sell to NPCs for predictable income or compete on price in the player marketplace.",
    "/assets/buildings/market_building.png",
  ],
  [
    "05",
    "Complete Quests",
    "Take on easy, medium, and hard objectives for HFARM, useful items, and reputation.",
    "/assets/chests/rare.png",
  ],
  [
    "06",
    "Master The Farm",
    "Train six skills toward level 100 and build an operation that thrives through every emission era.",
    "/assets/buildings/house.png",
  ],
];

const ACTIVITIES = [
  [
    "Farming",
    "Plant eleven crop types with growth times from one minute to a full day.",
    "Planting costs 1 stamina and harvesting costs 2. Harvests grant Farming XP and produce.",
    "/assets/crops/carrot/crop.png",
  ],
  [
    "Woodcutting",
    "Chop regenerating trees for wood used throughout the farm economy.",
    "Each chop costs 2 stamina. Skill levels improve efficiency and bonus yield.",
    "/assets/resources/wood.png",
  ],
  [
    "Mining",
    "Break rocks for stone, iron, and gold across increasingly valuable nodes.",
    "Mining costs 3 stamina per action and grants permanent Mining XP.",
    "/assets/resources/stone.png",
  ],
  [
    "Fishing",
    "Cast into the pond for catches with different rarity, value, and XP.",
    "A cast costs 5 stamina. Better catches support quests, selling, and progression.",
    "/assets/fish/fish.png",
  ],
  [
    "Husbandry",
    "Feed chickens, cows, sheep, and pigs, then collect their produce.",
    "Animals operate on feed and production timers, rewarding consistent care.",
    "/assets/animals/chicken.gif",
  ],
  [
    "Cooking",
    "Combine crops into recipes that restore more stamina than raw ingredients.",
    "Better meals keep long gathering sessions productive.",
    "/assets/foods/pumpkin_soup.png",
  ],
];

const CROPS = [
  ["Sunflower", "1 min", "5"],
  ["Potato", "5 min", "14"],
  ["Pumpkin", "30 min", "30"],
  ["Carrot", "1 hr", "48"],
  ["Cabbage", "2 hr", "70"],
  ["Beetroot", "4 hr", "100"],
  ["Cauliflower", "8 hr", "145"],
  ["Parsnip", "12 hr", "190"],
  ["Radish", "16 hr", "240"],
  ["Wheat", "20 hr", "300"],
  ["Kale", "24 hr", "375"],
];

const SKILLS = [
  ["Farming", "+20% crop yield", "/assets/crops/sunflower/crop.png"],
  ["Woodcutting", "+20% wood yield", "/assets/resources/wood.png"],
  ["Mining", "+20% ore yield", "/assets/resources/stone.png"],
  ["Fishing", "+20% fish yield", "/assets/fish/fish.png"],
  ["Husbandry", "+20% animal yield", "/assets/animals/cow.gif"],
  ["Cooking", "+20% meal output", "/assets/foods/wheat_bread.png"],
];

type Tab = "how" | "activities" | "economy" | "skills";

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={
        active
          ? "border-2 border-neon bg-brown-600 px-4 py-3 font-pixel text-[9px] uppercase text-white text-shadow"
          : "border-2 border-brown-600 bg-brown-200 px-4 py-3 font-pixel text-[9px] uppercase text-brown-700 transition-colors hover:bg-brown-300"
      }
    >
      {children}
    </button>
  );
}

export function GamePreview() {
  const [tab, setTab] = useState<Tab>("how");
  const [expanded, setExpanded] = useState<number | null>(null);

  return (
    <section
      id="how-to-play"
      className="relative mx-auto max-w-7xl scroll-mt-24 px-4 py-20 sm:px-8"
    >
      <div className="mx-auto mb-12 max-w-3xl text-center">
        <p className="font-pixel text-[9px] uppercase tracking-widest text-gold">
          From first seed to thriving homestead
        </p>
        <h2 className="mt-4 font-pixel text-xl text-foreground sm:text-2xl md:text-3xl">
          HOW ROBINHOOD FARM WORKS
        </h2>
        <p className="mt-4 font-body text-xl leading-relaxed text-brown-700">
          A stamina-driven farming RPG where every harvest, catch, recipe, and trade builds
          permanent progression.
        </p>
      </div>

      <div
        role="tablist"
        aria-label="Game mechanics"
        className="mb-8 flex flex-wrap justify-center gap-2"
      >
        <TabButton active={tab === "how"} onClick={() => setTab("how")}>
          How to Play
        </TabButton>
        <TabButton active={tab === "activities"} onClick={() => setTab("activities")}>
          Activities
        </TabButton>
        <TabButton active={tab === "economy"} onClick={() => setTab("economy")}>
          Economy & Prices
        </TabButton>
        <TabButton active={tab === "skills"} onClick={() => setTab("skills")}>
          Skills
        </TabButton>
      </div>

      <div role="tabpanel">
        {tab === "how" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {STEPS.map(([step, title, desc, image]) => (
              <div key={step} className="relative pt-4">
                <span className="absolute left-5 top-0 z-10 border-2 border-gold bg-brown-600 px-3 py-1 font-pixel text-[9px] text-gold">
                  {step}
                </span>
                <OuterPanel>
                  <InnerPanel className="h-full p-6 pt-8">
                    <img
                      src={image}
                      alt=""
                      className="size-12 object-contain [image-rendering:pixelated]"
                    />
                    <h3 className="mt-4 font-pixel text-[11px] text-neon text-shadow">{title}</h3>
                    <p className="mt-3 font-body text-lg leading-relaxed text-white/80">{desc}</p>
                  </InnerPanel>
                </OuterPanel>
              </div>
            ))}
          </div>
        )}

        {tab === "activities" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ACTIVITIES.map(([title, desc, detail, image], index) => {
              const open = expanded === index;
              return (
                <OuterPanel key={title}>
                  <InnerPanel className="h-full p-0">
                    <button
                      type="button"
                      aria-expanded={open}
                      onClick={() => setExpanded(open ? null : index)}
                      className="h-full w-full p-6 text-left transition-[filter] hover:brightness-110"
                    >
                      <img
                        src={image}
                        alt=""
                        className="size-14 object-contain [image-rendering:pixelated]"
                      />
                      <h3 className="mt-4 font-pixel text-[11px] text-neon text-shadow">{title}</h3>
                      <p className="mt-3 font-body text-lg leading-relaxed text-white/80">{desc}</p>
                      {open && (
                        <p className="mt-4 border-t-2 border-dashed border-brown-700 pt-4 font-body text-base leading-relaxed text-white">
                          {detail}
                        </p>
                      )}
                      <span className="mt-4 block font-pixel text-[8px] text-gold">
                        {open ? "SHOW LESS" : "READ DETAILS"}
                      </span>
                    </button>
                  </InnerPanel>
                </OuterPanel>
              );
            })}
          </div>
        )}

        {tab === "economy" && (
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <OuterPanel>
              <InnerPanel className="overflow-hidden p-0">
                <div className="border-b-2 border-brown-700 px-5 py-4">
                  <h3 className="font-pixel text-[11px] text-neon text-shadow">CROP SELL PRICES</h3>
                </div>
                <div className="overflow-x-auto p-5">
                  <table className="w-full min-w-[440px] border-collapse text-left">
                    <thead>
                      <tr className="border-b-2 border-brown-700 font-pixel text-[8px] text-white/60">
                        <th className="pb-3">CROP</th>
                        <th className="pb-3">GROW TIME</th>
                        <th className="pb-3 text-right">HFARM</th>
                      </tr>
                    </thead>
                    <tbody>
                      {CROPS.map(([crop, time, price]) => (
                        <tr
                          key={crop}
                          className="border-b border-brown-700/50 font-body text-lg text-white"
                        >
                          <td className="py-2">{crop}</td>
                          <td className="py-2 text-white/70">{time}</td>
                          <td className="py-2 text-right text-gold">{price}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </InnerPanel>
            </OuterPanel>
            <div className="flex flex-col gap-6">
              <OuterPanel>
                <InnerPanel className="p-6">
                  <p className="font-pixel text-[9px] text-gold">FIXED SUPPLY</p>
                  <p className="mt-3 font-pixel text-2xl text-white text-shadow">100,000,000</p>
                  <p className="mt-3 font-body text-lg leading-relaxed text-white/80">
                    HFARM has a hard cap. Emissions halve through five stages as supply grows.
                  </p>
                </InnerPanel>
              </OuterPanel>
              <OuterPanel>
                <InnerPanel className="p-6">
                  <h3 className="font-pixel text-[10px] text-neon text-shadow">PLAYER MARKET</h3>
                  <dl className="mt-4 flex flex-col gap-3 font-body text-lg text-white/80">
                    <div className="flex justify-between">
                      <dt>Listing fee</dt>
                      <dd className="text-gold">5%</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Active listings</dt>
                      <dd className="text-gold">10 max</dd>
                    </div>
                    <div className="flex justify-between">
                      <dt>Pricing</dt>
                      <dd className="text-gold">Player-set</dd>
                    </div>
                  </dl>
                </InnerPanel>
              </OuterPanel>
            </div>
          </div>
        )}

        {tab === "skills" && (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {SKILLS.map(([name, bonus, image]) => (
              <OuterPanel key={name}>
                <InnerPanel className="flex h-full items-center gap-5 p-6">
                  <img
                    src={image}
                    alt=""
                    className="size-14 object-contain [image-rendering:pixelated]"
                  />
                  <div>
                    <h3 className="font-pixel text-[11px] text-neon text-shadow">{name}</h3>
                    <p className="mt-2 font-body text-lg text-white/80">
                      Level 100: <span className="text-gold">{bonus}</span>
                    </p>
                  </div>
                </InnerPanel>
              </OuterPanel>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
