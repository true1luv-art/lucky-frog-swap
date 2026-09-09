"use client";

/**
 * components/game/hud/components/AvatarMenu.tsx
 *
 * Avatar Menu on the ModalShell: hero card (avatar + level) at the top of the
 * body, NavRail for sub-views (Overview / Music), Logout in the ActionDock.
 *
 * Skills and Gear now live on the House modal (Player / Gear tabs) — see
 * SkillsPanel/GearPanel and docs/modal-redesign-plan.md §3.
 *
 * AvatarMenuPanel is exported separately so the /test-modals mock shell can
 * mount it pre-opened without forking this file.
 */

import React, { useState } from "react";

import { HeroAvatar } from "@/components/ui/HeroAvatar";
import { Button } from "@/components/ui/Button";
import { InnerPanel } from "@/components/ui/Panel";
import {
  ModalShell,
  ModalTitleBar,
  NavRail,
  ActionDock,
  SectionLabel,
} from "@/components/ui/modal";
import { getImageSrc } from "@/lib/utils/getImageSrc";
import { getSong } from "@/lib/playlist";
import { useAudio } from "@/context/AudioContext";
import { useGameStore } from "@/lib/stores/game/useGameStore";
import { INITIAL_SKILLS } from "@/shared/types/gameplay/skills";
import { getTotalSkillLevels } from "@/components/game/house/SkillsPanel";
import { MarketplaceModal } from "@/components/game/marketplace/MarketplaceModal";
import { useGameSettings, type ZoomLevel } from "@/lib/stores/game/useGameSettings";

const play = "/assets/ui/music_player/play.png";
const pause = "/assets/ui/music_player/pause.png";
const volume_down = "/assets/ui/music_player/volume-down.png";
const volume_up = "/assets/ui/music_player/volume-up.png";
const music_note = "/assets/ui/music_player/music-note.png";
const playerIcon = "/assets/icons/player.png";
const settingsIcon = "/assets/icons/confirm.png";

export type AvatarMenuView = "overview" | "music" | "display";

// ── AvatarMenuPanel — shell-owning menu panel ────────────────────────────────

const SECTIONS = [
  { id: "overview", label: "Overview", icon: playerIcon   },
  { id: "music",    label: "Music",    icon: music_note   },
  { id: "display",  label: "Display",  icon: settingsIcon },
];

const SECTION_SUBTITLES: Record<AvatarMenuView, string> = {
  overview: "Player menu",
  music:    "Music player",
  display:  "Display settings",
};

interface AvatarMenuPanelProps {
  show:          boolean;
  onClose:       () => void;
  name:          string;
  initialView?:  AvatarMenuView;
  /** Equipped avatar frog portrait — replaces the generated avatar. §2.9 */
  avatarImage?:  string | null;
  /** Equipped avatar frog details for the hero card. §2.9 */
  avatarFrog?:   { name: string; level: number } | null;
  /** Optional quick actions — hidden when not provided (e.g. mock shell) */
  onMarketplace?: () => void;
  onHallOfFame?:  () => void;
  onLogout?:      () => void;
}

export function AvatarMenuPanel({
  show,
  onClose,
  name,
  initialView = "overview",
  avatarImage,
  avatarFrog,
  onMarketplace,
  onHallOfFame,
  onLogout,
}: AvatarMenuPanelProps) {
  const [view, setView] = useState<AvatarMenuView>(initialView);
  const skills  = useGameStore((s) => s.state.skills ?? INITIAL_SKILLS);
  const stamina = useGameStore((s) => s.state.stamina);

  const { zoom, rotated, setZoom, setRotated } = useGameSettings();

  // Music is driven by the shared AudioContext (the same track the game plays),
  // so the play button always reflects the real state and there's no second
  // audio element to cause duplicate playback.
  const { musicEnabled, toggleMusic, musicVolume, setMusicVolume } = useAudio();

  const song = getSong(0);

  const decreaseVolume = () => setMusicVolume(Math.max(0, Math.round((musicVolume - 0.1) * 10) / 10));
  const increaseVolume = () => setMusicVolume(Math.min(1, Math.round((musicVolume + 0.1) * 10) / 10));

  const totalLevels = getTotalSkillLevels(skills);

  return (
    <ModalShell
      show={show}
      onClose={onClose}
      tier="panel"
      titleBar={
        <ModalTitleBar
          icon={playerIcon}
          title={name}
          subtitle={SECTION_SUBTITLES[view]}
          onClose={onClose}
        />
      }
      navRail={
        <NavRail
          items={SECTIONS}
          activeId={view}
          onSelect={(id) => setView(id as AvatarMenuView)}
        />
      }
      actionDock={
        onLogout ? (
          <ActionDock info={`Signed in as ${name}`}>
            <Button onClick={onLogout}>
              <span className="text-white text-xs text-shadow">Logout</span>
            </Button>
          </ActionDock>
        ) : undefined
      }
      bodyClassName="gap-2 p-0.5"
    >
      {/* ── Hero card (always on top) ── */}
      <InnerPanel className="p-2 flex items-center gap-3 shrink-0">
        <HeroAvatar name={name} size="lg" imageUrl={avatarImage} />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm text-shadow font-bold truncate">{name}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-shadow text-yellow-300">
              {totalLevels} total skill levels
            </span>
            {stamina && (
              <span className="text-xs text-shadow text-white/70">
                {stamina.current ?? 100} / {stamina.max ?? 100} stamina
              </span>
            )}
          </div>
          {avatarFrog && (
            <span className="text-xs text-shadow text-white/60 truncate">
              Avatar: {avatarFrog.name} · Lv.{avatarFrog.level}
            </span>
          )}
        </div>
      </InnerPanel>

      {view === "overview" && (
        <>
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="flex flex-col gap-2">
            {onMarketplace && (
              <Button onClick={onMarketplace}>
                <div className="flex items-center justify-center gap-2">
                  <img src="/assets/buildings/market_building.png" alt="" className="w-4 h-4" style={{ imageRendering: "pixelated" }} onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  <span className="text-white text-xs text-shadow">Marketplace</span>
                </div>
              </Button>
            )}
            {onHallOfFame && (
              <Button onClick={onHallOfFame}>
                <div className="flex items-center justify-center gap-2">
                  <img src="/assets/icons/star.png" alt="" className="w-4 h-4" style={{ imageRendering: "pixelated" }} />
                  <span className="text-white text-xs text-shadow">Hall of Fame</span>
                </div>
              </Button>
            )}
            {!onMarketplace && !onHallOfFame && (
              <p className="text-xs text-white/50 text-shadow p-1">
                Use the rail to control music.
              </p>
            )}
          </div>
        </>
      )}

      {view === "music" && (
        <>
          <SectionLabel icon={music_note}>Now Playing</SectionLabel>
          <InnerPanel className="overflow-hidden px-2 py-1">
            <p className="whitespace-nowrap text-white text-xs">{song.name} - {song.artist}</p>
          </InnerPanel>
          <div className="flex items-center justify-center gap-2">
            <Button onClick={toggleMusic} className="w-10 h-10 flex items-center justify-center">
              <img src={getImageSrc(musicEnabled ? pause : play) || "/placeholder.svg"} alt={musicEnabled ? "Pause" : "Play"} className="w-4 h-4" />
            </Button>
            <Button onClick={decreaseVolume} className="w-10 h-10 flex items-center justify-center">
              <img src={volume_down || "/placeholder.svg"} alt="Vol-" className="w-4 h-4" />
            </Button>
            <Button onClick={increaseVolume} className="w-10 h-10 flex items-center justify-center">
              <img src={volume_up || "/placeholder.svg"} alt="Vol+" className="w-4 h-4" />
            </Button>
          </div>
          <InnerPanel className="p-1">
            <div className="h-2 bg-brown-200 rounded-full overflow-hidden">
              <div className="h-full bg-white transition-all duration-200" style={{ width: `${musicVolume * 100}%` }} />
            </div>
          </InnerPanel>
        </>
      )}

      {view === "display" && (
        <>
          {/* ── Zoom ── */}
          <SectionLabel icon={settingsIcon}>Camera Zoom</SectionLabel>
          <div className="grid grid-cols-4 gap-1.5">
            {([1, 2, 3, 4] as ZoomLevel[]).map((z) => (
              <button
                key={z}
                onClick={() => setZoom(z)}
                aria-pressed={zoom === z}
                className={[
                  "py-2 font-pixel text-[9px] border-2 transition-all",
                  zoom === z
                    ? "border-neon bg-neon/20 text-neon text-shadow"
                    : "border-border bg-black/30 text-white/60 hover:bg-black/50 hover:text-white",
                ].join(" ")}
              >
                {z}x
              </button>
            ))}
          </div>
          <InnerPanel className="px-2 py-1">
            <p className="font-pixel text-[8px] text-white/50 leading-relaxed">
              Zoom {zoom}x — {zoom === 1 ? "zoomed out" : zoom === 2 ? "compact" : zoom === 3 ? "balanced" : "close-up"}. Lower zoom shows more of the world.
            </p>
          </InnerPanel>

          {/* ── Rotate ── */}
          <SectionLabel icon={settingsIcon}>Orientation</SectionLabel>
          <button
            onClick={() => setRotated(!rotated)}
            aria-pressed={rotated}
            className={[
              "w-full py-2.5 flex items-center justify-between gap-3 px-3 border-2 font-pixel text-[9px] transition-all",
              rotated
                ? "border-neon bg-neon/20 text-neon text-shadow"
                : "border-border bg-black/30 text-white/70 hover:bg-black/50",
            ].join(" ")}
          >
            <span>Rotate scene 90°</span>
            <span className={["text-[8px] px-1.5 py-0.5 border", rotated ? "border-neon text-neon" : "border-white/30 text-white/40"].join(" ")}>
              {rotated ? "ON" : "OFF"}
            </span>
          </button>
          <InnerPanel className="px-2 py-1">
            <p className="font-pixel text-[8px] text-white/50 leading-relaxed">
              Rotate the game scene if your wallet app does not support landscape mode.
            </p>
          </InnerPanel>
        </>
      )}
    </ModalShell>
  );
}

// ── AvatarMenu — HUD trigger + live wiring ───────────────────────────────────

interface AvatarMenuProps {
  name: string;
  /** Equipped avatar frog portrait — replaces the generated avatar. §2.9 */
  avatarImage?: string | null;
  /** Equipped avatar frog details for the hero card. §2.9 */
  avatarFrog?: { name: string; level: number } | null;
}

export const AvatarMenu: React.FC<AvatarMenuProps> = ({ name, avatarImage, avatarFrog }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const reset = useGameStore((s) => s.reset);

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) { reset(); setIsOpen(false); }
  };

  const handleHallOfFame = () => {
    // PhaserModals listens for this event and opens the Hall of Fame modal.
    window.dispatchEvent(new CustomEvent("phaser-halloffame-open"));
    setIsOpen(false);
  };

  const handleMarketplace = () => {
    setMarketplaceOpen(true);
    setIsOpen(false);
  };

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="cursor-pointer hover:scale-105 transition-transform focus:outline-none"
        aria-label="Open player menu"
      >
        <HeroAvatar name={name} size="lg" imageUrl={avatarImage} />
      </button>

      {/* Remount on open so the panel always starts on Overview */}
      {isOpen && (
        <AvatarMenuPanel
          show={isOpen}
          onClose={() => setIsOpen(false)}
          name={name}
          avatarImage={avatarImage}
          avatarFrog={avatarFrog}
          onMarketplace={handleMarketplace}
          onHallOfFame={handleHallOfFame}
          onLogout={handleLogout}
        />
      )}

      <MarketplaceModal
        show={marketplaceOpen}
        onHide={() => setMarketplaceOpen(false)}
      />
    </>
  );
};
