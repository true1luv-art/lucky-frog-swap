"use client";

import dynamic from "next/dynamic";

/**
 * Dynamically import PhaserV1Canvas with ssr:false so Phaser (which requires
 * window/document) is never executed during server-side rendering.
 */
const PhaserCanvas = dynamic(
  () => import("@/phaser/PhaserCanvas"),
  { ssr: false },
);

export default function PhaserPage() {
  return <PhaserCanvas />;
}
