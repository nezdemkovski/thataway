// The art worker: runs on a Mac with mflux, takes places from the API one at a time, draws
// each with Qwen Image 2.1 from its Commons photo and the API's prompt, cuts the background
// away, and hands the picture back. `--once` draws one and exits (for trying things out).
import { mkdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

import type { ArtSpec } from "@thataway/db/art";
import { PlaceKind } from "@thataway/db/enums";

import { getConfig } from "./config";
import { ArtModel, HttpHeader, LogLevel } from "./enums";
import { log } from "./log";

interface ArtJob {
  placeId: string;
  name: string;
  description: string | null;
  kind: PlaceKind;
  spec: ArtSpec;
  prompt: string;
  negativePrompt: string;
  referenceImageUrl: string | null;
  referenceImageLicense: string | null;
}

interface CutOut {
  width: number;
  height: number;
  anchorX: number;
}

const config = getConfig();
const once = process.argv.includes("--once");

const api = (path: string, init: RequestInit = {}) =>
  fetch(`${config.apiUrl}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      [HttpHeader.Authorization]: `Bearer ${config.workerToken}`,
    },
  });

const run = async (command: string, args: string[], cwd: string): Promise<string> => {
  const proc = Bun.spawn([command, ...args], { cwd, stdout: "pipe", stderr: "pipe" });
  const [stdout, stderr, code] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ]);
  if (code !== 0) {
    throw new Error(`${command} exited ${code}: ${stderr.slice(-600) || stdout.slice(-600)}`);
  }
  return stdout;
};

const claim = async (): Promise<ArtJob | null> => {
  const response = await api("/art/jobs/claim", { method: "POST" });
  if (!response.ok) throw new Error(`claim answered ${response.status}: ${await response.text()}`);
  return ((await response.json()) as { job: ArtJob | null }).job;
};

const draw = async (job: ArtJob): Promise<{ file: string; seed: number; cut: CutOut }> => {
  const dir = join(config.workDir, job.placeId);
  await rm(dir, { recursive: true, force: true });
  await mkdir(dir, { recursive: true });

  // The photo the shape is drawn from; a place without one is drawn from the prompt alone
  const imageArgs: string[] = [];
  if (job.referenceImageUrl) {
    const photo = await fetch(job.referenceImageUrl, {
      headers: { [HttpHeader.UserAgent]: `Thataway art worker (${config.wikimediaContact})` },
    });
    if (!photo.ok) throw new Error(`reference photo answered ${photo.status}`);
    const reference = join(dir, "reference.jpg");
    await writeFile(reference, new Uint8Array(await photo.arrayBuffer()));
    imageArgs.push("--image-paths", reference);
  }
  const promptFile = join(dir, "prompt.txt");
  // The model paints on a flat dark ground; the cut-out step takes it away
  await writeFile(
    promptFile,
    job.prompt.replace(
      "fully transparent background (PNG with alpha)",
      "a perfectly flat, uniform very dark background, hex #0A0B0D, with nothing else in it",
    ),
  );

  const seed = Math.floor(Math.random() * 2 ** 31);
  const raw = join(dir, "raw.png");
  log(LogLevel.Info, "drawing", { placeId: job.placeId, name: job.name, seed });
  await run(
    config.mfluxEditBin,
    [
      "--model",
      "qwen-image-2.1-turbo",
      "-q",
      "8",
      "--seed",
      String(seed),
      "--width",
      "1024",
      "--height",
      "1024",
      ...imageArgs,
      "--prompt-file",
      promptFile,
      "--output",
      raw,
    ],
    dir,
  );
  const noBackground = join(dir, "cut.png");
  await run(config.rembgBin, ["i", "-m", "birefnet-general", raw, noBackground], dir);
  const final = join(dir, "final.png");
  const info = await run(config.pythonBin, [config.postprocessScript, noBackground, final], dir);
  const cut = JSON.parse(info.trim()) as CutOut & { error?: string };
  if (cut.error) throw new Error(cut.error);
  return { file: final, seed, cut };
};

const complete = async (job: ArtJob, result: Awaited<ReturnType<typeof draw>>) => {
  const form = new FormData();
  const png = new File([await Bun.file(result.file).arrayBuffer()], `${job.placeId}.png`, {
    type: "image/png",
  });
  form.append("file", png);
  form.append("model", ArtModel.QwenImage21Turbo);
  form.append("seed", String(result.seed));
  form.append("anchorX", String(result.cut.anchorX));
  form.append("width", String(result.cut.width));
  form.append("height", String(result.cut.height));
  const response = await api(`/art/jobs/${job.placeId}/complete`, { method: "POST", body: form });
  if (!response.ok)
    throw new Error(`complete answered ${response.status}: ${await response.text()}`);
  const { artUrl } = (await response.json()) as { artUrl: string };
  log(LogLevel.Info, "handed in", { placeId: job.placeId, artUrl });
};

const fail = async (job: ArtJob, error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  log(LogLevel.Warn, "failed", { placeId: job.placeId, error: message });
  await api(`/art/jobs/${job.placeId}/fail`, {
    method: "POST",
    headers: { [HttpHeader.ContentType]: "application/json" },
    body: JSON.stringify({ error: message }),
  }).catch((reportError: unknown) =>
    log(LogLevel.Error, "could not report the failure", { error: String(reportError) }),
  );
};

const sleep = (seconds: number) => new Promise((resolve) => setTimeout(resolve, seconds * 1000));

log(LogLevel.Info, "art worker up", { api: config.apiUrl, once });
while (true) {
  let job: ArtJob | null = null;
  try {
    job = await claim();
  } catch (error) {
    log(LogLevel.Error, "could not reach the API", { error: String(error) });
  }
  if (job) {
    try {
      await complete(job, await draw(job));
    } catch (error) {
      await fail(job, error);
    }
    if (once) break;
    continue;
  }
  if (once) {
    log(LogLevel.Info, "nothing to draw");
    break;
  }
  await sleep(config.idleSeconds);
}
