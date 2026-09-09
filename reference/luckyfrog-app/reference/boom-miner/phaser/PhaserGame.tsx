'use client';

import { useEffect, useRef } from "react";
import { useGameStore } from "@/features/store/gameStore";
import { MAP_HEIGHT, MAP_WIDTH, TILE_SIZE } from "@/features/types/TileTypes";
import { GAME_CONFIG } from "./config/GameConfig";
import { initSocket, destroySocket, getSocket } from "@/context/SocketContext";
import { WS_EVENTS } from "@/server/game-websocket-engine/socket/events";

export function PhaserGame() {
  const hostRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Initialise the shared socket before Phaser boots so WSSyncManager.start()
    // finds an existing socket on its first call and only registers listeners once.
    initSocket();

    let destroyed = false;
    let gameInstance: import("phaser").Game | null = null;

    (async () => {
      const Phaser = await import("phaser");
      const { BootScene } = await import("./scenes/BootScene");
      const { TreasureScene } = await import("./scenes/TreasureScene");
      if (destroyed || !hostRef.current) return;

      gameInstance = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        width: MAP_WIDTH * TILE_SIZE,
        height: MAP_HEIGHT * TILE_SIZE,
        backgroundColor: GAME_CONFIG.RENDER.BG_COLOR,
        scene: [BootScene, TreasureScene],
        fps: { target: GAME_CONFIG.RENDER.FPS_TARGET, forceSetTimeOut: false },
        render: { pixelArt: GAME_CONFIG.RENDER.PIXEL_ART, antialias: GAME_CONFIG.RENDER.ANTIALIAS },
        banner: false,
      });
      (window as unknown as { __phaser?: import("phaser").Game }).__phaser = gameInstance;
    })();

    const onVisibility = () => {
      useGameStore.getState().setPaused(document.hidden);
    };
    const onBlur  = () => useGameStore.getState().setPaused(true);
    const onFocus = () => {
      if (!document.hidden) useGameStore.getState().setPaused(false);
    };
    // Emit session:complete before the tab/window closes so the WS engine
    // flushes the dirty session to DB immediately. The disconnect event may
    // fire after the page is already gone and the flush might be skipped.
    // Using `keepalive` is not available on WS — this synchronous emit is the
    // best-effort guarantee we can make from the browser side.
    const onBeforeUnload = () => {
      const socket = getSocket();
      if (socket?.connected) socket.emit(WS_EVENTS.SESSION_COMPLETE);
    };
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("blur", onBlur);
    window.addEventListener("focus", onFocus);
    window.addEventListener("beforeunload", onBeforeUnload);

    return () => {
      destroyed = true;
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("blur", onBlur);
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("beforeunload", onBeforeUnload);
      gameInstance?.destroy(true);
      useGameStore.getState().setMapHeroes([]);
      // Fully tear down the shared WS socket when the game unmounts (e.g.
      // navigating away / logout). It intentionally survives scene restarts,
      // so it must be closed here rather than in the scene shutdown handler.
      destroySocket();
    };
  }, []);

  return (
    <div
      ref={hostRef}
      style={{
        width: MAP_WIDTH * TILE_SIZE,
        height: MAP_HEIGHT * TILE_SIZE,
        display: "block",
      }}
    />
  );
}
