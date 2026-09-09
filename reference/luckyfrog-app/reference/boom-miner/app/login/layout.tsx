import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Login",
  description: "Log in to Boom Miner and start mining $BMCOIN.",
};

export default function LoginLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
