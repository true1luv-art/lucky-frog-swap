import Image            from "next/image";
import type { Metadata } from "next";
import { LoginRobinhood } from "@/components/login/LoginRobinhood";

export const metadata: Metadata = {
  title:       "Sign In — Lucky Frog",
  description: "Connect your Robinhood Chain wallet to enter the farm and earn $LFRG.",
};

const TOKEN_NAME = process.env.NEXT_PUBLIC_TOKEN_NAME ?? "$LFRG";

export default function LoginPage() {
  return (
    <main
      className="relative min-h-screen w-full overflow-hidden"
      style={{
        backgroundImage:    "url('/bg-login.png')",
        backgroundSize:     "cover",
        backgroundPosition: "center",
        backgroundRepeat:   "no-repeat",
      }}
    >
      {/* Subtle dark overlay so the card reads cleanly */}
      <div className="absolute inset-0 bg-black/30 pointer-events-none" />

      {/* Centered column: logo on top, card below */}
      <div className="relative flex flex-col items-center justify-center min-h-screen px-4 gap-6">

        {/* Game logo */}
        <Image
          src="/assets/brand/lucky_frog_banner.png"
          alt="Lucky Frog"
          width={420}
          height={180}
          className="object-contain drop-shadow-2xl"
          priority
        />

        {/* Login card — same width as in the screenshot */}
        <LoginRobinhood tokenName={TOKEN_NAME} />

      </div>
    </main>
  );
}
