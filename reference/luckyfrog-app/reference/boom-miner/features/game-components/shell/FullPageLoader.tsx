"use client";

/**
 * Full-screen boot loader shown while Phaser assets stream in.
 * Used by app/game/page.tsx and previewed on /test-modals.
 */
export function FullPageLoader({ progress, fileKey }: { progress: number; fileKey: string }) {
  const pct = Math.round(progress * 100);
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "radial-gradient(circle at 50% 30%, #1a2b1a 0%, #050505 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "'Press Start 2P', monospace",
        color: "#f5e9c4",
        pointerEvents: "all",
      }}
    >
      <img
        src="/assets/brand_logo.png"
        alt="Boom Miner"
        style={{ width: 420, maxWidth: "70vw", height: "auto", imageRendering: "pixelated", marginBottom: 12 }}
      />
      <p style={{ marginTop: 16, fontFamily: "'VT323', monospace", fontSize: 18, opacity: 0.85 }}>
        Loading the mines...
      </p>
      <div
        style={{
          marginTop: 32,
          width: 480,
          maxWidth: "80vw",
          height: 28,
          background: "#111",
          border: "4px solid #facc15",
          padding: 2,
          boxShadow: "6px 6px 0 #000",
        }}
      >
        <div style={{ width: `${pct}%`, height: "100%", background: "#facc15", transition: "width 120ms linear" }} />
      </div>
      <div style={{ marginTop: 16, fontSize: 14, color: "#facc15" }}>{pct}%</div>
      <div style={{ marginTop: 8, fontFamily: "'VT323', monospace", fontSize: 16, color: "#888", minHeight: 20 }}>
        {fileKey || "\u00a0"}
      </div>
    </div>
  );
}
