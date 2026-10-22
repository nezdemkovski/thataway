import type { ArtSpec, ArtStyle } from "@thataway/db/art";
import { PlaceKind } from "@thataway/db/enums";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import type { PlacePick, RenderedPrompt, RunMeta } from "../shared/types";
import { api, type Defaults } from "./api";
import { MapPlane } from "./MapPlane";

const STYLE_FIELDS: (keyof Omit<ArtStyle, "avoid">)[] = [
  "medium",
  "camera",
  "framing",
  "base",
  "background",
  "form",
  "materials",
  "light",
  "palette",
];

const specFor = (defaults: Defaults, place: PlacePick | null): ArtSpec => ({
  version: defaults.version,
  style: defaults.style,
  subject: {
    name: place?.name ?? "Charles Bridge",
    city: "Prague",
    what: place?.description ?? "bridge in Prague, Czech Republic",
    kind: place?.kind ?? PlaceKind.Bridge,
    ...defaults.kinds[place?.kind ?? PlaceKind.Bridge],
    reference: place?.imageUrl
      ? { url: place.imageUrl, license: place.imageLicense, use: defaults.referenceUse }
      : null,
  },
  render: { model: "qwen-image-2.1-turbo", size: 1024, steps: null, guidance: null, seed: null },
});

export function App() {
  const [defaults, setDefaults] = useState<Defaults | null>(null);
  const [places, setPlaces] = useState<PlacePick[]>([]);
  const [filter, setFilter] = useState("");
  const [spec, setSpec] = useState<ArtSpec | null>(null);
  const [rendered, setRendered] = useState<RenderedPrompt | null>(null);
  const [runs, setRuns] = useState<RunMeta[]>([]);
  const [shown, setShown] = useState<RunMeta | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [styleOpen, setStyleOpen] = useState(false);
  const startedAt = useRef(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    api
      .defaults()
      .then((d) => {
        setDefaults(d);
        setSpec(specFor(d, null));
      })
      .catch((e) => setError(String(e)));
    api
      .places(50.0865, 14.4114)
      .then(setPlaces)
      .catch(() => setPlaces([]));
    api.runs().then((r) => {
      setRuns(r);
      setShown(r[0] ?? null);
    });
  }, []);

  // The prompt as the model would get it, a moment after each edit
  useEffect(() => {
    if (!spec) return;
    const handle = setTimeout(
      () =>
        api
          .render(spec)
          .then(setRendered)
          .catch(() => {}),
      250,
    );
    return () => clearTimeout(handle);
  }, [spec]);

  useEffect(() => {
    if (!busy) return;
    const handle = setInterval(
      () => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)),
      1000,
    );
    return () => clearInterval(handle);
  }, [busy]);

  const update = useCallback(
    (patch: (s: ArtSpec) => ArtSpec) => setSpec((s) => (s ? patch(s) : s)),
    [],
  );
  const setSubject = (key: keyof ArtSpec["subject"], value: unknown) =>
    update((s) => ({ ...s, subject: { ...s.subject, [key]: value } }));
  const setStyle = (key: keyof ArtStyle, value: unknown) =>
    update((s) => ({ ...s, style: { ...s.style, [key]: value } }));
  const setRender = (key: keyof ArtSpec["render"], value: unknown) =>
    update((s) => ({ ...s, render: { ...s.render, [key]: value } }));

  const pick = (place: PlacePick) => {
    if (!defaults) return;
    update((s) => ({ ...specFor(defaults, place), style: s.style, render: s.render }));
  };

  const generate = async () => {
    if (!spec) return;
    setBusy(true);
    setError(null);
    startedAt.current = Date.now();
    setElapsed(0);
    try {
      const run = await api.generate(spec);
      setRuns((r) => [run, ...r]);
      setShown(run);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const changedStyle = useMemo(() => {
    if (!defaults || !spec) return new Set<string>();
    return new Set(
      (Object.keys(spec.style) as (keyof ArtStyle)[]).filter(
        (k) => JSON.stringify(spec.style[k]) !== JSON.stringify(defaults.style[k]),
      ),
    );
  }, [defaults, spec]);

  const visiblePlaces = places.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()));

  if (!defaults || !spec) {
    return <div className="p-8 text-tertiary">{error ?? "Loading…"}</div>;
  }

  return (
    <div className="grid min-h-screen grid-cols-[360px_1fr_380px] gap-0">
      {/* Left: the subject and the render */}
      <aside className="flex flex-col gap-4 overflow-y-auto border-r border-white/8 p-4">
        <h1 className="text-lg font-semibold">
          Art studio{" "}
          <span className="ml-1 text-xs font-normal text-tertiary">spec v{spec.version}</span>
        </h1>

        <section>
          <label>Place (from the live API, Prague centre)</label>
          <input placeholder="Filter…" value={filter} onChange={(e) => setFilter(e.target.value)} />
          <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-white/8">
            {visiblePlaces.map((p) => (
              <button
                key={p.id}
                onClick={() => pick(p)}
                className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left text-sm hover:bg-white/5"
              >
                <span className="w-16 shrink-0 text-[11px] text-tertiary">{p.kind}</span>
                <span className="truncate">{p.name}</span>
                {p.artUrl && <span className="ml-auto text-[10px] text-accent">art</span>}
              </button>
            ))}
          </div>
        </section>

        <section className="flex flex-col gap-2">
          <div>
            <label>Name</label>
            <input value={spec.subject.name} onChange={(e) => setSubject("name", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label>City</label>
              <input
                value={spec.subject.city ?? ""}
                onChange={(e) => setSubject("city", e.target.value || null)}
              />
            </div>
            <div>
              <label>Kind</label>
              <select
                value={spec.subject.kind}
                onChange={(e) => {
                  const kind = e.target.value as PlaceKind;
                  update((s) => ({
                    ...s,
                    subject: { ...s.subject, kind, ...defaults.kinds[kind] },
                  }));
                }}
              >
                {Object.values(PlaceKind).map((k) => (
                  <option key={k}>{k}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label>What (Wikidata description)</label>
            <input
              value={spec.subject.what ?? ""}
              onChange={(e) => setSubject("what", e.target.value || null)}
            />
          </div>
          <div>
            <label>Show</label>
            <textarea
              rows={4}
              value={spec.subject.show}
              onChange={(e) => setSubject("show", e.target.value)}
            />
          </div>
          <div>
            <label>Tallest element</label>
            <input
              value={spec.subject.tallest}
              onChange={(e) => setSubject("tallest", e.target.value)}
            />
          </div>
          <div>
            <label>Reference photo URL</label>
            <input
              value={spec.subject.reference?.url ?? ""}
              onChange={(e) =>
                setSubject(
                  "reference",
                  e.target.value
                    ? {
                        url: e.target.value,
                        license: spec.subject.reference?.license ?? null,
                        use: defaults.referenceUse,
                      }
                    : null,
                )
              }
            />
            {spec.subject.reference?.url && (
              <img
                src={spec.subject.reference.url}
                alt=""
                className="mt-2 max-h-28 rounded-md border border-white/8"
              />
            )}
          </div>
          <div>
            <label>Reference use</label>
            <textarea
              rows={3}
              value={spec.subject.reference?.use ?? ""}
              disabled={!spec.subject.reference}
              onChange={(e) =>
                setSubject("reference", { ...spec.subject.reference!, use: e.target.value })
              }
            />
          </div>
        </section>

        <section className="grid grid-cols-4 gap-2">
          <div className="col-span-2">
            <label>Model</label>
            <input value={spec.render.model} onChange={(e) => setRender("model", e.target.value)} />
          </div>
          <div>
            <label>Size</label>
            <input
              type="number"
              step={64}
              value={spec.render.size}
              onChange={(e) => setRender("size", Number(e.target.value))}
            />
          </div>
          <div>
            <label>Seed</label>
            <input
              type="number"
              placeholder="random"
              value={spec.render.seed ?? ""}
              onChange={(e) =>
                setRender("seed", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
          <div>
            <label>Steps</label>
            <input
              type="number"
              placeholder="default"
              value={spec.render.steps ?? ""}
              onChange={(e) =>
                setRender("steps", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
          <div>
            <label>Guidance</label>
            <input
              type="number"
              step={0.5}
              placeholder="default"
              value={spec.render.guidance ?? ""}
              onChange={(e) =>
                setRender("guidance", e.target.value === "" ? null : Number(e.target.value))
              }
            />
          </div>
        </section>

        <button
          onClick={generate}
          disabled={busy}
          className="rounded-full bg-accent px-4 py-2.5 text-sm font-semibold text-ink disabled:opacity-50"
        >
          {busy ? `Drawing… ${elapsed}s` : "Generate"}
        </button>
        {error && <p className="text-xs text-red-400">{error}</p>}

        <section>
          <button
            onClick={() => setStyleOpen((o) => !o)}
            className="text-sm text-secondary hover:text-label"
          >
            {styleOpen ? "▾" : "▸"} Style{" "}
            {changedStyle.size > 0 && (
              <span className="text-accent">({changedStyle.size} changed)</span>
            )}
          </button>
          {styleOpen && (
            <div className="mt-2 flex flex-col gap-2">
              {STYLE_FIELDS.map((field) => (
                <div key={field}>
                  <label className={changedStyle.has(field) ? "text-accent" : ""}>{field}</label>
                  <textarea
                    rows={4}
                    value={spec.style[field]}
                    onChange={(e) => setStyle(field, e.target.value)}
                  />
                </div>
              ))}
              <div>
                <label className={changedStyle.has("avoid") ? "text-accent" : ""}>
                  avoid (one per line, also the negative prompt)
                </label>
                <textarea
                  rows={8}
                  value={spec.style.avoid.join("\n")}
                  onChange={(e) =>
                    setStyle(
                      "avoid",
                      e.target.value
                        .split("\n")
                        .map((s) => s.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </div>
              <button
                onClick={() => update((s) => ({ ...s, style: defaults.style }))}
                className="self-start text-xs text-tertiary hover:text-label"
              >
                Reset style to the code's default
              </button>
            </div>
          )}
        </section>
      </aside>

      {/* Middle: the result */}
      <main className="flex flex-col gap-4 overflow-y-auto p-4">
        {shown ? (
          <>
            <div className="flex items-baseline gap-3 text-sm">
              <span className="font-semibold">{shown.name}</span>
              <span className="text-tertiary">
                seed {shown.seed} · {shown.seconds}s · {shown.width}×{shown.height} · anchor{" "}
                {shown.anchorX}
              </span>
              <span className="ml-auto text-xs text-tertiary">
                {new Date(shown.startedAt).toLocaleString()}
              </span>
            </div>
            <MapPlane src={shown.final} anchorX={shown.anchorX} />
            <div className="grid grid-cols-2 gap-3">
              <figure>
                <img src={shown.raw} alt="" className="w-full rounded-xl border border-white/8" />
                <figcaption className="mt-1 text-xs text-tertiary">raw model output</figcaption>
              </figure>
              <figure>
                <img
                  src={shown.cut}
                  alt=""
                  className="w-full rounded-xl border border-white/8 bg-[conic-gradient(#333_25%,#222_0_50%,#333_0_75%,#222_0)] bg-[length:20px_20px]"
                />
                <figcaption className="mt-1 text-xs text-tertiary">after BiRefNet</figcaption>
              </figure>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setSpec(shown.spec);
                }}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-secondary hover:text-label"
              >
                Load this run's spec
              </button>
              <button
                onClick={() => navigator.clipboard.writeText(JSON.stringify(shown.spec, null, 2))}
                className="rounded-full border border-white/10 px-3 py-1.5 text-xs text-secondary hover:text-label"
              >
                Copy spec JSON
              </button>
            </div>
          </>
        ) : (
          <p className="text-tertiary">
            No runs yet. Pick a place, press Generate, wait about a minute.
          </p>
        )}
      </main>

      {/* Right: the prompt and the history */}
      <aside className="flex flex-col gap-4 overflow-y-auto border-l border-white/8 p-4">
        <section>
          <label>Prompt as the model gets it</label>
          <pre className="max-h-[42vh] overflow-y-auto whitespace-pre-wrap rounded-md border border-white/8 bg-surface p-2.5 text-[11px] leading-snug text-secondary">
            {rendered?.prompt ?? ""}
          </pre>
          <label className="mt-2">Negative prompt</label>
          <pre className="max-h-24 overflow-y-auto whitespace-pre-wrap rounded-md border border-white/8 bg-surface p-2.5 text-[11px] leading-snug text-secondary">
            {rendered?.negativePrompt ?? ""}
          </pre>
        </section>
        <section>
          <label>Runs</label>
          <div className="grid grid-cols-3 gap-2">
            {runs.map((run) => (
              <button
                key={run.id}
                onClick={() => setShown(run)}
                className={`rounded-lg border p-1 ${shown?.id === run.id ? "border-accent" : "border-white/8"}`}
              >
                <img src={run.final} alt="" className="aspect-square w-full object-contain" />
                <div className="mt-1 truncate text-[10px] text-tertiary">{run.name}</div>
                <div className="text-[10px] text-tertiary">
                  v{run.spec.version} · {run.seed}
                </div>
              </button>
            ))}
          </div>
        </section>
      </aside>
    </div>
  );
}
