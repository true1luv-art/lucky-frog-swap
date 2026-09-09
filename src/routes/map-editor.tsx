import { createFileRoute, ClientOnly } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const EditorCanvas = lazy(() => import("@/phaser/editor/EditorCanvas"));

export const Route = createFileRoute("/map-editor")({
  component: MapEditorRoute,
  head: () => ({
    meta: [
      { title: "Map Editor | Lucky Frog Farm" },
      {
        name: "description",
        content:
          "Move farm objects on the live Phaser map, spawn roaming animals, and copy the updated position JSON.",
      },
      { property: "og:title", content: "Map Editor | Lucky Frog Farm" },
      {
        property: "og:description",
        content:
          "Move farm objects on the live Phaser map, spawn roaming animals, and copy the updated position JSON.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Loading() {
  return (
    <div className="grid h-screen w-screen place-items-center bg-[#5da9e9] text-sm text-white">
      Loading map editor…
    </div>
  );
}

function MapEditorRoute() {
  return (
    <main className="h-screen w-screen overflow-hidden">
      <h1 className="sr-only">Farm map editor</h1>
      <ClientOnly fallback={<Loading />}>
        <Suspense fallback={<Loading />}>
          <EditorCanvas />
        </Suspense>
      </ClientOnly>
    </main>
  );
}
