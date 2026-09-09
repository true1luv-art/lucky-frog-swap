"use client";

import { useRouter } from "next/navigation";
import {
  ModalShell,
  ModalTitleBar,
  NavRail,
  ActionDock,
  SectionLabel,
  StatChip,
  type NavRailItem,
} from "@/components/ui/modal";
import { useSocketState } from "@/context/SocketContext";
import { useState } from "react";
import { WithdrawModal } from "./WithdrawModal";

const PIXEL_HEAD = "'Press Start 2P', 'Silkscreen', monospace";
const PIXEL_BODY = "'VT323', 'Silkscreen', monospace";

/** True only when the operator explicitly sets NEXT_PUBLIC_WALLET_ENABLED=true */
const WALLET_ENABLED = process.env.NEXT_PUBLIC_WALLET_ENABLED === "true";

const NAV_ITEMS: NavRailItem[] = [
  { id: "display", label: "Display" },
  { id: "account", label: "Account" },
];

interface Props {
  show: boolean;
  onClose: () => void;
}

export function SettingsModal({ show, onClose }: Props) {
  const router            = useRouter();
  const { connected }     = useSocketState();
  const [tab, setTab]     = useState<"display" | "account">("display");
  const [fullscreen, setFullscreen] = useState(false);
  const [withdrawOpen, setWithdrawOpen] = useState(false);

  const handleLogout = () => {
    onClose();
    localStorage.removeItem("bm_token");
    router.replace("/login");
  };

  const toggleFullscreen = () => {
    if (!fullscreen) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setFullscreen(false);
    }
  };

  return (
    <>
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          title="Settings"
          onClose={onClose}
          extra={
            <StatChip
              value={connected ? "Online" : "Offline"}
              caption="Connection"
            />
          }
        />
      }
      navRail={
        <NavRail
          items={NAV_ITEMS}
          activeId={tab}
          onSelect={(id) => setTab(id as "display" | "account")}
        />
      }
      actionDock={
        <ActionDock>
          <button
            type="button"
            onClick={onClose}
            className="wood-frame-light wood-panel-inner px-4 py-2 text-white text-shadow hover:brightness-110 active:translate-y-0.5 transition-all duration-75 cursor-pointer"
            style={{ fontFamily: PIXEL_HEAD, fontSize: 8, letterSpacing: 1 }}
          >
            CLOSE
          </button>
        </ActionDock>
      }
    >
      {tab === "display" ? (
        <div className="flex flex-col gap-4 p-2">
          <div>
            <SectionLabel className="mb-2">Display</SectionLabel>
            <div className="flex items-center justify-between bg-black/30 px-3 py-2 rounded">
              <span style={{ fontFamily: PIXEL_HEAD, fontSize: 8, color: "#ccc", letterSpacing: 1 }}>
                FULLSCREEN
              </span>
              <button
                type="button"
                onClick={toggleFullscreen}
                className="wood-frame-light wood-panel-inner px-3 py-1.5 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75"
                style={{
                  fontFamily: PIXEL_HEAD,
                  fontSize: 8,
                  boxShadow: fullscreen ? "0 0 0 3px #16a34a" : undefined,
                }}
              >
                {fullscreen ? "ON" : "OFF"}
              </button>
            </div>
          </div>

          <div>
            <SectionLabel className="mb-2">Connection</SectionLabel>
            <div
              className="flex items-center gap-2 px-3 py-2 rounded bg-black/30"
            >
              <div
                className="w-2 h-2 rounded-full shrink-0"
                style={{ background: connected ? "#4ade80" : "#ef4444" }}
              />
              <span style={{ fontFamily: PIXEL_BODY, fontSize: 16, color: connected ? "#4ade80" : "#ef4444" }}>
                {connected ? "Connected to game server" : "Disconnected — reconnecting..."}
              </span>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 p-2">
          <SectionLabel className="mb-2">Account</SectionLabel>
          <p style={{ fontFamily: PIXEL_BODY, fontSize: 16, color: "#999" }}>
            Logged in via JWT token.
          </p>
          {WALLET_ENABLED ? (
            <button
              type="button"
              onClick={() => setWithdrawOpen(true)}
              className="wood-frame-light wood-panel-inner w-full py-3 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75"
              style={{
                fontFamily: PIXEL_HEAD,
                fontSize: 9,
                letterSpacing: 2,
                boxShadow: "0 0 0 3px #16a34a",
              }}
            >
              WITHDRAW $BMCOIN
            </button>
          ) : (
            <div
              className="w-full py-3 text-center rounded bg-black/30 border border-white/10"
              style={{ fontFamily: PIXEL_HEAD, fontSize: 8, color: "#666", letterSpacing: 1 }}
            >
              WITHDRAWALS DISABLED
            </div>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className="wood-frame-light wood-panel-inner w-full py-3 text-white text-shadow cursor-pointer hover:brightness-110 active:translate-y-0.5 transition-all duration-75 mt-2"
            style={{
              fontFamily: PIXEL_HEAD,
              fontSize: 9,
              letterSpacing: 2,
              boxShadow: "0 0 0 3px #7f1d1d",
            }}
          >
            LOGOUT
          </button>
        </div>
      )}
    </ModalShell>

    {withdrawOpen && (
      <WithdrawModal show onClose={() => setWithdrawOpen(false)} />
    )}
    </>
  );
}
