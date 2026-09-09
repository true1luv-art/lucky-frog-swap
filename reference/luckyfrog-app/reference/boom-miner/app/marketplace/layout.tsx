import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Marketplace",
  description: "Trade Boom Miner heroes with $BMCOIN. Filter by rarity, price and stats.",
  openGraph: {
    title: "Boom Miner Marketplace",
    description: "Buy and sell pixel-mining heroes on the Boom Miner marketplace.",
  },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
