"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AudioContextValue {
  musicEnabled: boolean;
  musicVolume: number;
  sfxEnabled: boolean;
  sfxVolume: number;
  toggleMusic: () => void;
  setMusicVolume: (vol: number) => void;
  toggleSfx: () => void;
  setSfxVolume: (vol: number) => void;
  initMusic: (src: string) => void;
  stopMusic: () => void;
  playEggCrack: () => void;
}

const AudioCtx = createContext<AudioContextValue | undefined>(undefined);

export const useAudio = (): AudioContextValue => {
  const ctx = useContext(AudioCtx);
  if (!ctx) throw new Error("useAudio must be used within an AudioProvider");
  return ctx;
};

// Static ref so non-React code (e.g. setTimeout callbacks) can fire SFX
let _playEggCrack: (() => void) | null = null;
export const playEggCrackStatic = (): void => _playEggCrack?.();

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------
export function AudioProvider({ children }: { children: ReactNode }) {
  // Music is enabled by default so it plays automatically when entering the
  // game. Browsers may block autoplay until the first user gesture, so
  // initMusic installs a one-time interaction fallback to start playback.
  const [musicEnabled, setMusicEnabled] = useState(true);
  const [musicVolume, setMusicVolumeState] = useState(0.4);
  const [sfxEnabled, setSfxEnabled] = useState(true);
  const [sfxVolume, setSfxVolumeState] = useState(0.7);

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const eggCrackRef = useRef<HTMLAudioElement | null>(null);

  // Preload the egg crack so it can fire after async awaits without autoplay block
  useEffect(() => {
    const audio = new Audio("/audio/egg_crack.wav");
    audio.preload = "auto";
    eggCrackRef.current = audio;
    return () => {
      eggCrackRef.current = null;
    };
  }, []);

  // ── Music controls ─────────────────────────────────────────────────────────
  const toggleMusic = useCallback(() => {
    setMusicEnabled((prev) => {
      const next = !prev;
      const audio = musicRef.current;
      if (audio) {
        if (next) {
          audio.volume = musicVolume;
          audio.play().catch(() => {});
        } else {
          audio.pause();
        }
      }
      return next;
    });
  }, [musicVolume]);

  const setMusicVolume = useCallback((vol: number) => {
    setMusicVolumeState(vol);
    if (musicRef.current) musicRef.current.volume = vol;
  }, []);

  // Stop and destroy the current music track. Called when leaving (game) routes.
  const stopMusic = useCallback(() => {
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.src = "";
      musicRef.current = null;
    }
  }, []);

  // Initialise (or swap) the background music track.
  // Re-creates when musicEnabled/musicVolume change — matching the reference.
  // music only plays if musicEnabled is true, so no auto-play on first mount.
  const initMusic = useCallback(
    (src: string) => {
      if (musicRef.current) {
        musicRef.current.pause();
        musicRef.current.src = "";
      }
      const audio = new Audio(src);
      audio.loop = true;
      audio.volume = musicVolume;
      audio.preload = "auto";
      musicRef.current = audio;
      if (musicEnabled) {
        audio.play().catch(() => {
          // Autoplay was blocked (no user gesture yet). Retry playback once on
          // the first interaction, then remove the listeners.
          const resume = () => {
            if (musicRef.current !== audio) return;
            audio.play().catch(() => {});
            window.removeEventListener("pointerdown", resume);
            window.removeEventListener("keydown", resume);
            window.removeEventListener("touchstart", resume);
          };
          window.addEventListener("pointerdown", resume, { once: true });
          window.addEventListener("keydown", resume, { once: true });
          window.addEventListener("touchstart", resume, { once: true });
        });
      }
    },
    [musicVolume, musicEnabled],
  );

  // ── SFX controls ───────────────────────────────────────────────────────────
  const toggleSfx = useCallback(() => setSfxEnabled((p) => !p), []);
  const setSfxVolume = useCallback((vol: number) => setSfxVolumeState(vol), []);

  const playEggCrack = useCallback(() => {
    if (!sfxEnabled) return;
    const audio = eggCrackRef.current;
    if (!audio) return;
    audio.volume = sfxVolume;
    audio.currentTime = 0;
    audio.play().catch(() => {});
  }, [sfxEnabled, sfxVolume]);

  // Keep static ref in sync for imperative callers
  useEffect(() => {
    _playEggCrack = playEggCrack;
    return () => {
      _playEggCrack = null;
    };
  }, [playEggCrack]);

  return (
    <AudioCtx.Provider
      value={{
        musicEnabled,
        musicVolume,
        sfxEnabled,
        sfxVolume,
        toggleMusic,
        setMusicVolume,
        toggleSfx,
        setSfxVolume,
        initMusic,
        stopMusic,
        playEggCrack,
      }}
    >
      {children}
    </AudioCtx.Provider>
  );
}
