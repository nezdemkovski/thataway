import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));

const required = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    console.error(`${name} is not set (see .env.example)`);
    process.exit(1);
  }
  return value;
};

const config = {
  apiUrl: required("API_URL").replace(/\/$/, ""),
  workerToken: required("ART_WORKER_TOKEN"),
  wikimediaContact: process.env.WIKIMEDIA_CONTACT ?? "no contact set",
  mfluxEditBin:
    process.env.MFLUX_EDIT_BIN ?? `${process.env.HOME}/.local/bin/mflux-generate-qwen-2.1-edit`,
  rembgBin: process.env.REMBG_BIN ?? `${process.env.HOME}/.local/bin/rembg`,
  pythonBin: process.env.PYTHON_BIN ?? `${process.env.HOME}/.local/share/uv/tools/rembg/bin/python`,
  postprocessScript: join(here, "..", "postprocess.py"),
  workDir: process.env.WORK_DIR ?? "/tmp/thataway-art",
  idleSeconds: Number(process.env.IDLE_SECONDS) || 60,
};

export const getConfig = () => config;
