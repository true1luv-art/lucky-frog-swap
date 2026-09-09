import React, { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Panel } from "@/components/ui/Panel";
import { getSong, getSongCount } from "@/lib/playlist";
import { useStepper } from "@/hooks/useStepper";

export const AudioPlayer: React.FC = () => {
  const volume = useStepper({ initial: 0.1, step: 0.1, max: 1, min: 0 });
  const [visible, setIsVisible] = useState<boolean>(false);
  const [isPlaying, setPlaying] = useState<boolean>(true);
  const [songIndex, setSongIndex] = useState<number>(0);
  const musicPlayer = useRef<HTMLAudioElement>(null);

  const handlePlayState = () => {
    if (!musicPlayer.current) return;
    if (musicPlayer.current.paused) {
      musicPlayer.current.play();
    } else {
      musicPlayer.current.pause();
    }
    setPlaying(!isPlaying);
  };

  const handleNextSong = () => {
    if (getSongCount() === songIndex + 1) {
      setSongIndex(0);
    } else {
      setSongIndex(songIndex + 1);
    }
  };

  const song = getSong(songIndex);

  useEffect(() => {
    if (musicPlayer.current) {
      musicPlayer.current.volume = volume.value;
    }
  }, [volume.value]);

  useEffect(() => {
    if (navigator.userAgent.match(/chrome|chromium|crios/i)) {
      setPlaying(false);
      if (musicPlayer.current) musicPlayer.current.pause();
    }
  }, []);

  return (
    <div
      className="fixed bottom-4 z-50 md:w-56 w-48 h-fit transition-all duration-500 ease-in-out"
      style={{
        transform: `translateX(${visible ? 0 : "calc(100% + 8px)"})`,
        right: visible ? "-6px" : "8px",
      }}
    >
      <Panel className="pointer-events-auto w-40 sm:w-56">
        <audio
          ref={musicPlayer}
          onEnded={handleNextSong}
          onPause={() => musicPlayer.current && setPlaying(!musicPlayer.current.paused)}
          onPlay={() => musicPlayer.current && setPlaying(!musicPlayer.current.paused)}
          src={song.path}
          className="hidden"
          autoPlay
        />
        <div className="p-1 sm:mr-2 relative">
          <div className="mb-1.5 overflow-hidden bg-brown-200">
            <p
              className="whitespace-no-wrap w-fit text-white font-italic text-sm"
              style={{
                animation: "marquee-like-effect 10s infinite linear",
                whiteSpace: "nowrap",
                animationPlayState: isPlaying ? "running" : "paused",
              }}
            >
              {song.name} - {song.artist}
            </p>
          </div>
          <div className="flex space-x-2 justify-between">
            <Button onClick={handlePlayState} className="w-10 h-8">
              <span>{isPlaying ? "⏸" : "▶"}</span>
            </Button>
            <Button onClick={handleNextSong} className="w-10 h-8">
              <span>⏭</span>
            </Button>
            <Button onClick={volume.decrease} className="w-10 h-8 hidden sm:flex">
              <span>-</span>
            </Button>
            <Button onClick={volume.increase} className="w-10 h-8 hidden sm:flex">
              <span>+</span>
            </Button>
          </div>
        </div>
      </Panel>
      <div className="absolute -left-11 bottom-0 transition-all -z-10 duration-500 ease-in-out w-fit z-50 flex items-center overflow-hidden">
        <Button onClick={() => setIsVisible(!visible)}>
          <span className="w-4 h-4 sm:w-6 sm:h-5">{visible ? ">" : "♫"}</span>
        </Button>
      </div>
    </div>
  );
};
