

/**
 * components/game/hud/components/AvatarMenu.tsx
 *
 * Consolidated avatar menu — hero card, music player, and camera zoom are all
 * shown in a single scrollable body with no NavRail tabs.
 */

import React, { useState } from "react";

import { HeroAvatar } from "@/components/ui/HeroAvatar";
import { Button } from "@/components/ui/Button";
import { InnerPanel } from "@/components/ui/Panel";
import {
  ModalShell,
  ModalTitleBar,
  ActionDock,
  SectionLabel,
} from "@/components/ui/modal";
import { getImageSrc } from "@/features/utils/getImageSrc";
import { getSong } from "@/features/utils/playlist";
import { useAudio } from "@/context/AudioContext";
import { useGameStore } from "@/features/game-stores/useGameStore";
import { INITIAL_SKILLS } from "@/features/types/gameplay/skills";
import { getTotalSkillLevels } from "@/features/game-components/house/SkillsPanel";
import { MarketplaceModal } from "@/features/game-components/marketplace/MarketplaceModal";
import { useGameSettings, ZOOM_LEVELS, type ZoomLevel } from "@/features/game-stores/useGameSettings";
import { useTutorialStore } from "@/features/game-stores/useTutorialStore";

const play         = "/assets/ui/music_player/play.png";
const pause        = "/assets/ui/music_player/pause.png";
const volume_down  = "/assets/ui/music_player/volume-down.png";
const volume_up    = "/assets/ui/music_player/volume-up.png";
const music_note   = "/assets/ui/music_player/music-note.png";
const playerIcon   = "/assets/brand/lucky_frog_wizard.png";
const settingsIcon = "/assets/icons/confirm.png";

// ── AvatarMenuPanel — consolidated single-view panel ────────────────────────

interface AvatarMenuPanelProps {
  show:           boolean;
  onClose:        () => void;
  name:           string;
  /** Optional image override for the hero card avatar. */
  avatarImage?:   string | null;
  /** Optional quick actions — hidden when not provided (e.g. mock shell) */
  onMarketplace?: () => void;
  onHowToPlay?:   () => void;
  onLogout?:      () => void;
}

export function AvatarMenuPanel({
  show,
  onClose,
  name,
  avatarImage,
  onMarketplace,
  onHowToPlay,
  onLogout,
}: AvatarMenuPanelProps) {
  const skills  = useGameStore((s) => s.state.skills ?? INITIAL_SKILLS);

  const { zoom, setZoom } = useGameSettings();

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
          subtitle="Player menu"
          onClose={onClose}
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
      {/* ── Hero card ── */}
      <InnerPanel className="p-2 flex items-center gap-3 shrink-0">
        <HeroAvatar name={name} size="lg" imageUrl={avatarImage} />
        <div className="flex flex-col gap-1 min-w-0">
          <span className="text-sm text-shadow font-bold truncate">{name}</span>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-shadow text-yellow-300">
              {totalLevels} total skill levels
            </span>
          </div>
        </div>
      </InnerPanel>

      {/* ── Quick Actions ── */}
      {(onMarketplace || onHowToPlay) && (
        <>
          <SectionLabel>Quick Actions</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5">
            {onMarketplace && (
              <Button onClick={onMarketplace}>
                <div className="flex items-center justify-center gap-2">
                  <img
                    src="/assets/buildings/market_building.png"
                    alt=""
                    className="w-4 h-4"
                    style={{ imageRendering: "pixelated" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-white text-xs text-shadow">Marketplace</span>
                </div>
              </Button>
            )}
            {onHowToPlay && (
              <Button onClick={onHowToPlay}>
                <div className="flex items-center justify-center gap-2">
                  <img
                    src="/assets/brand/lucky_frog_wizard.png"
                    alt=""
                    className="w-4 h-4"
                    style={{ imageRendering: "pixelated" }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                  <span className="text-white text-xs text-shadow">How to Play</span>
                </div>
              </Button>
            )}
          </div>
        </>
      )}

      {/* ── Music ── */}
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

      {/* ── Camera Zoom ── */}
      <SectionLabel icon={settingsIcon}>Camera Zoom</SectionLabel>
      <div className="grid grid-cols-4 gap-1.5">
        {ZOOM_LEVELS.map((z) => (
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
          Zoom {zoom}x —{" "}
          {zoom === 2.5 ? "zoomed out" : zoom === 3 ? "compact" : zoom === 3.5 ? "balanced" : "close-up"}.{" "}
          Lower zoom shows more of the world.
        </p>
      </InnerPanel>
    </ModalShell>
  );
}

// ── AvatarMenu — HUD trigger + live wiring ───────────────────────────────────

interface AvatarMenuProps {
  name: string;
  /** Optional image override for the hero card avatar. */
  avatarImage?: string | null;
}

export const AvatarMenu: React.FC<AvatarMenuProps> = ({ name, avatarImage }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const reset = useGameStore((s) => s.reset);
  const { openTutorial } = useTutorialStore();

  const handleLogout = () => {
    if (confirm("Are you sure you want to logout?")) { reset(); setIsOpen(false); }
  };

  const handleMarketplace = () => {
    setMarketplaceOpen(true);
    setIsOpen(false);
  };

  const handleHowToPlay = () => {
    openTutorial();
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
          onMarketplace={handleMarketplace}
          onHowToPlay={handleHowToPlay}
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
