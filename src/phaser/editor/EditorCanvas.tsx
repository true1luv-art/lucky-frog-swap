import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { editorBus } from "@/phaser/editor/editorBus";
import type { AnimalKind, EditorGroup, EditorMarker } from "@/phaser/editor/editorBus";

const GROUPS: EditorGroup[] = ["trees", "stones", "plots", "buildings", "npcs"];
const GROUP_LABEL: Record<EditorGroup, string> = {
  trees: "Trees",
  stones: "Stones",
  plots: "Plots",
  buildings: "Buildings",
  npcs: "NPCs",
};
const ANIMALS: Array<{ kind: AnimalKind; label: string; max: number }> = [
  { kind: "chicken", label: "Chickens", max: 10 },
  { kind: "cow", label: "Cows", max: 5 },
  { kind: "sheep", label: "Sheep", max: 5 },
];

function groupJson(group: EditorGroup, markers: EditorMarker[]): string {
  const items = markers.filter((m) => m.group === group);
  if (group === "buildings") {
    return JSON.stringify(
      { buildings: items.map((m) => ({ type: m.id, x: m.x, y: m.y, width: m.w, height: m.h })) },
      null,
      2,
    );
  }
  if (group === "plots") {
    return JSON.stringify(
      { plots: items.map((m, i) => ({ id: m.id, fieldIndex: i, x: m.x, y: m.y })) },
      null,
      2,
    );
  }
  if (group === "npcs") {
    return JSON.stringify(
      { npcs: items.map((m) => ({ id: m.id, x: m.x, y: m.y, width: m.w, height: m.h })) },
      null,
      2,
    );
  }
  return JSON.stringify({ [group]: items.map((m) => ({ id: m.id, x: m.x, y: m.y })) }, null, 2);
}

const panel = "rounded-lg border border-white/15 bg-black/70 p-3 text-white shadow-lg backdrop-blur-sm";
const button =
  "rounded border border-white/20 bg-white/10 px-2 py-1 text-[11px] uppercase tracking-wide text-white transition hover:bg-white/20";

type Drawer = "map" | "spawns" | "assets";

const DRAWER_LABEL: Record<Drawer, string> = { map: "Map", spawns: "Spawns", assets: "Assets" };

export default function EditorCanvas() {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<import("phaser").Game | null>(null);
  const [ready, setReady] = useState(false);
  const [markers, setMarkers] = useState<EditorMarker[]>([]);
  const [selected, setSelected] = useState<EditorMarker | null>(null);
  const [camera, setCamera] = useState({ zoom: 4, tileX: 0, tileY: 0 });
  const [counts, setCounts] = useState<Record<AnimalKind, number>>({ chicken: 0, cow: 0, sheep: 0 });
  const [grid, setGrid] = useState(true);

  const [drawer, setDrawer] = useState<Drawer | null>(null);
  const [jsonGroup, setJsonGroup] = useState<EditorGroup | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let destroyed = false;
    const offs = [
      editorBus.on("ready", () => setReady(true)),
      editorBus.on("markers", ({ markers: next }) => setMarkers(next)),
      editorBus.on("select", ({ marker }) => setSelected(marker)),
      editorBus.on("camera", (next) => setCamera(next)),
      editorBus.on("animals", ({ counts: next }) => setCounts(next)),
    ];

    void (async () => {
      const [{ default: Phaser }, { EditorScene }] = await Promise.all([
        import("phaser"),
        import("@/phaser/editor/EditorScene"),
      ]);
      if (destroyed || !hostRef.current) return;
      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: hostRef.current,
        backgroundColor: "#5da9e9",
        pixelArt: true,
        render: { antialias: false, roundPixels: true },
        scale: { mode: Phaser.Scale.RESIZE, autoCenter: Phaser.Scale.NO_CENTER, width: "100%", height: "100%" },
        scene: [EditorScene],
      });
    })();

    return () => {
      destroyed = true;
      offs.forEach((off) => off());
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  const json = useMemo(() => (jsonGroup ? groupJson(jsonGroup, markers) : ""), [jsonGroup, markers]);

  const copy = useCallback(async () => {
    if (!json) return;
    try {
      await navigator.clipboard.writeText(json);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }, [json]);

  const grouped = useMemo(
    () => GROUPS.map((group) => ({ group, items: markers.filter((m) => m.group === group) })),
    [markers],
  );

  const toggleDrawer = (next: Drawer) => setDrawer((current) => (current === next ? null : next));

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#5da9e9]">
      <div ref={hostRef} className="absolute inset-0" />

      {!ready && (
        <div className="absolute inset-0 grid place-items-center bg-black/70 text-sm text-white">
          Loading map…
        </div>
      )}

      {/* Stacked drawer buttons — top left */}
      <div className="absolute left-3 top-3 z-20 flex flex-col gap-2">
        {(Object.keys(DRAWER_LABEL) as Drawer[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => toggleDrawer(key)}
            className={`${button} ${drawer === key ? "border-amber-300 bg-amber-300/20 text-amber-300" : "bg-black/70"}`}
          >
            {DRAWER_LABEL[key]}
          </button>
        ))}
      </div>

      {/* Selected asset popover */}
      {selected && (
        <div className={`absolute bottom-3 left-1/2 z-20 w-[19rem] -translate-x-1/2 space-y-2 ${panel}`}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-300">{selected.id}</span>
            <button type="button" className={button} onClick={() => editorBus.emit("cmd:select", { key: null })}>
              Close
            </button>
          </div>
          <div className="grid grid-cols-4 gap-2">
            {(
              [
                ["x", selected.x],
                ["y", selected.y],
                ["w", selected.w],
                ["h", selected.h],
              ] as Array<[string, number]>
            ).map(([field, value]) => (
              <label key={field} className="text-[10px] uppercase text-white/60">
                {field}
                <input
                  type="number"
                  value={value}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    if (Number.isNaN(next)) return;
                    if (field === "x") editorBus.emit("cmd:move", { key: selected.key, x: next, y: selected.y });
                    if (field === "y") editorBus.emit("cmd:move", { key: selected.key, x: selected.x, y: next });
                    if (field === "w") editorBus.emit("cmd:resize", { key: selected.key, w: next, h: selected.h });
                    if (field === "h") editorBus.emit("cmd:resize", { key: selected.key, w: selected.w, h: next });
                  }}
                  className="mt-1 w-full rounded border border-white/20 bg-black/60 px-1 py-1 text-xs text-white"
                />
              </label>
            ))}
          </div>
          <button type="button" className={button} onClick={() => editorBus.emit("cmd:focus", { key: selected.key })}>
            Center camera
          </button>
        </div>
      )}

      {/* Right drawer */}
      <div
        className={`absolute right-0 top-0 z-20 h-full w-[19rem] transform border-l border-white/15 bg-black/80 text-white transition-transform ${
          drawer ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="h-full overflow-y-auto p-3 text-[11px]">
          {drawer === "map" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-amber-300">Map</div>
              <div className="text-[11px] text-white/70">
                Left-drag an asset to move it · middle-drag to pan · wheel to zoom · arrows nudge
              </div>
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  className={button}
                  onClick={() => {
                    setGrid(!grid);
                    editorBus.emit("cmd:grid", { show: !grid });
                  }}
                >
                  Grid {grid ? "on" : "off"}
                </button>
                <button type="button" className={button} onClick={() => editorBus.emit("cmd:reset", {})}>
                  Reset
                </button>
              </div>
              <div className="text-[11px] text-white/60">
                zoom {camera.zoom.toFixed(2)}× · tile {camera.tileX},{camera.tileY}
              </div>
            </div>
          )}

          {drawer === "spawns" && (
            <div className="space-y-3">
              <div className="text-xs font-semibold uppercase tracking-widest text-amber-300">Animal spawns</div>
              {ANIMALS.map(({ kind, label, max }) => (
                <div key={kind} className="flex items-center justify-between gap-2">
                  <span className="text-[11px]">{label}</span>
                  <div className="flex items-center gap-1">
                    <button type="button" className={button} onClick={() => editorBus.emit("cmd:animal-remove", { kind })}>
                      −
                    </button>
                    <span className="w-10 text-center text-[11px] tabular-nums">
                      {counts[kind]}/{max}
                    </span>
                    <button type="button" className={button} onClick={() => editorBus.emit("cmd:animal-add", { kind })}>
                      +
                    </button>
                  </div>
                </div>
              ))}
              <div className="flex gap-1">
                <button type="button" className={button} onClick={() => editorBus.emit("cmd:animal-clear", {})}>
                  Clear
                </button>
              </div>
              <div className="text-[11px] text-white/60">Animals roam inside the yellow ranch outline, same as in game.</div>
            </div>
          )}

          {drawer === "assets" && (
            <div>
              <div className="mb-2 text-xs font-semibold uppercase tracking-widest text-amber-300">Assets</div>
              {grouped.map(({ group, items }) => (
                <div key={group} className="mb-3">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="font-semibold text-white/80">
                      {GROUP_LABEL[group]} ({items.length})
                    </span>
                    <button type="button" className={button} onClick={() => setJsonGroup(group)}>
                      JSON
                    </button>
                  </div>
                  <div className="space-y-1">
                    {items.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => editorBus.emit("cmd:focus", { key: item.key })}
                        className={`flex w-full items-center justify-between rounded border px-2 py-1 text-left ${
                          selected?.key === item.key
                            ? "border-amber-300 bg-amber-300/20"
                            : "border-white/10 bg-white/5 hover:bg-white/10"
                        }`}
                      >
                        <span className="truncate">{item.id}</span>
                        <span className="tabular-nums text-white/70">
                          {item.x},{item.y} · {item.w}×{item.h}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* JSON modal */}
      {jsonGroup && (
        <div className="absolute inset-0 z-30 grid place-items-center bg-black/60 p-4">
          <div className={`w-full max-w-xl space-y-2 ${panel}`}>
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-widest text-amber-300">
                {GROUP_LABEL[jsonGroup]} JSON
              </span>
              <div className="flex gap-1">
                <button type="button" className={button} onClick={copy}>
                  {copied ? "Copied" : "Copy"}
                </button>
                <button type="button" className={button} onClick={() => setJsonGroup(null)}>
                  Close
                </button>
              </div>
            </div>
            <textarea
              readOnly
              value={json}
              className="h-72 w-full resize-none rounded border border-white/20 bg-black/70 p-2 font-mono text-[11px] text-white"
            />
          </div>
        </div>
      )}
    </div>
  );
}
