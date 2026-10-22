// The studio's server: hands the page the spec defaults and places to try, renders prompts,
// and runs the same chain the art worker runs (mflux → rembg → postprocess), keeping every
// run under runs/<id> so the page can show a history.
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ART_SPEC_VERSION,
  ART_STYLE,
  type ArtSpec,
  KIND_SHOW,
  REFERENCE_USE,
  renderArtPrompt,
} from "@thataway/db/art";

import type { PlacePick, RunMeta, RunRequest } from "../shared/types";

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, "..", "..");
const runsDir = join(root, "runs");
const home = process.env.HOME ?? "";
const config = {
  port: Number(process.env.PORT) || 3051,
  placesApi: process.env.PLACES_API ?? "https://thataway.nezdemkovski.cloud",
  wikimediaContact: process.env.WIKIMEDIA_CONTACT ?? "https://github.com/nezdemkovski/thataway",
  mfluxEditBin: process.env.MFLUX_EDIT_BIN ?? `${home}/.local/bin/mflux-generate-qwen-2.1-edit`,
  rembgBin: process.env.REMBG_BIN ?? `${home}/.local/bin/rembg`,
  pythonBin: process.env.PYTHON_BIN ?? `${home}/.local/share/uv/tools/rembg/bin/python`,
  postprocessScript: join(root, "..", "art-worker", "postprocess.py"),
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

const run = async (command: string, args: string[], cwd: string): Promise<string> => {
  const proc = Bun.spawn([command, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${command} exited ${code}: ${stderr.slice(-800) || stdout.slice(-800)}`);
  }
  return stdout;
};

const slug = (name: string) =>
  name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);

let busy = false;

/** The whole chain for one spec; the page waits for it (about a minute). */
const generate = async ({ spec }: RunRequest): Promise<RunMeta> => {
  if (busy) throw new Error("A picture is already being drawn; wait for it");
  busy = true;
  const startedAt = new Date();
  const id = `${startedAt.toISOString().replace(/[:.]/g, "-").slice(0, 19)}-${slug(spec.subject.name)}`;
  const dir = join(runsDir, id);
  try {
    await mkdir(dir, { recursive: true });
    const { prompt, negativePrompt } = renderArtPrompt(spec);
    const seed = spec.render.seed ?? Math.floor(Math.random() * 2 ** 31);
    const render = { ...spec.render, seed };
    const kept: ArtSpec = { ...spec, render };
    await writeFile(join(dir, "spec.json"), JSON.stringify(kept, null, 2));
    await writeFile(join(dir, "prompt.txt"), prompt);
    await writeFile(join(dir, "negative.txt"), negativePrompt);

    const imageArgs: string[] = [];
    if (spec.subject.reference?.url) {
      const photo = await fetch(spec.subject.reference.url, {
        headers: { "User-Agent": `Thataway art studio (${config.wikimediaContact})` },
      });
      if (!photo.ok) throw new Error(`reference photo answered ${photo.status}`);
      const reference = join(dir, "reference.jpg");
      await writeFile(reference, new Uint8Array(await photo.arrayBuffer()));
      imageArgs.push("--image-paths", reference);
    }
    await run(
      config.mfluxEditBin,
      [
        "--model",
        render.model,
        "-q",
        "8",
        "--seed",
        String(seed),
        "--width",
        String(render.size),
        "--height",
        String(render.size),
        ...(render.steps ? ["--steps", String(render.steps)] : []),
        ...(render.guidance ? ["--guidance", String(render.guidance)] : []),
        ...(negativePrompt ? ["--negative-prompt", negativePrompt] : []),
        ...imageArgs,
        "--prompt-file",
        join(dir, "prompt.txt"),
        "--output",
        join(dir, "raw.png"),
      ],
      dir,
    );
    await run(
      config.rembgBin,
      ["i", "-m", "birefnet-general", join(dir, "raw.png"), join(dir, "cut.png")],
      dir,
    );
    const info = JSON.parse(
      (
        await run(
          config.pythonBin,
          [config.postprocessScript, join(dir, "cut.png"), join(dir, "final.png")],
          dir,
        )
      ).trim(),
    ) as { width: number; height: number; anchorX: number; error?: string };
    if (info.error) throw new Error(info.error);
    const meta: RunMeta = {
      id,
      startedAt: startedAt.toISOString(),
      seconds: Math.round((Date.now() - startedAt.getTime()) / 1000),
      name: spec.subject.name,
      seed,
      render,
      width: info.width,
      height: info.height,
      anchorX: info.anchorX,
      raw: `/runs/${id}/raw.png`,
      cut: `/runs/${id}/cut.png`,
      final: `/runs/${id}/final.png`,
      spec: kept,
      prompt,
      negativePrompt,
    };
    await writeFile(join(dir, "meta.json"), JSON.stringify(meta, null, 2));
    return meta;
  } catch (error) {
    await rm(dir, { recursive: true, force: true });
    throw error;
  } finally {
    busy = false;
  }
};

const listRuns = async (): Promise<RunMeta[]> => {
  await mkdir(runsDir, { recursive: true });
  const names = (await readdir(runsDir))
    .filter((n) => !n.startsWith("."))
    .toSorted()
    .toReversed();
  const runs: RunMeta[] = [];
  for (const name of names) {
    try {
      runs.push(JSON.parse(await readFile(join(runsDir, name, "meta.json"), "utf8")) as RunMeta);
    } catch {
      // a run that died halfway leaves no meta
    }
  }
  return runs;
};

/** Places to try, from the live API: what the worker would be asked to draw. */
const places = async (lat: string, lon: string): Promise<PlacePick[]> => {
  const response = await fetch(`${config.placesApi}/places?lat=${lat}&lon=${lon}&limit=60`);
  if (!response.ok) throw new Error(`places answered ${response.status}`);
  const body = (await response.json()) as { places: PlacePick[] };
  return body.places.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    kind: p.kind,
    imageUrl: p.imageUrl,
    imageLicense: p.imageLicense,
    artUrl: p.artUrl,
  }));
};

Bun.serve({
  port: config.port,
  idleTimeout: 255,
  async fetch(request) {
    const url = new URL(request.url);
    try {
      if (url.pathname === "/api/defaults") {
        return json({
          version: ART_SPEC_VERSION,
          style: ART_STYLE,
          kinds: KIND_SHOW,
          referenceUse: REFERENCE_USE,
        });
      }
      if (url.pathname === "/api/places") {
        return json(
          await places(
            url.searchParams.get("lat") ?? "50.0865",
            url.searchParams.get("lon") ?? "14.4114",
          ),
        );
      }
      if (url.pathname === "/api/render" && request.method === "POST") {
        return json(renderArtPrompt(((await request.json()) as RunRequest).spec));
      }
      if (url.pathname === "/api/generate" && request.method === "POST") {
        return json(await generate((await request.json()) as RunRequest));
      }
      if (url.pathname === "/api/runs") {
        return json(await listRuns());
      }
      if (url.pathname.startsWith("/runs/")) {
        const file = Bun.file(join(runsDir, url.pathname.slice("/runs/".length)));
        return (await file.exists())
          ? new Response(file)
          : new Response("not found", { status: 404 });
      }
      return new Response("not found", { status: 404 });
    } catch (error) {
      return json({ error: error instanceof Error ? error.message : String(error) }, 500);
    }
  },
});
console.log(`art studio server on http://localhost:${config.port}`);
