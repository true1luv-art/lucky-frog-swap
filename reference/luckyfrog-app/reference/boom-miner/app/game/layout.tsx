import type { Metadata } from "next";
import { SocketProvider } from "@/context/SocketContext";

export const metadata: Metadata = {
  title: "Play",
  description: "Play Boom Miner. Heroes plant bombs to mine $BMCOIN.",
};

export default function GameLayout({ children }: { children: React.ReactNode }) {
  return <SocketProvider>{children}</SocketProvider>;
}
