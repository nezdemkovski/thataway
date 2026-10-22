import { NodeEnv } from "@/utils/enums";

const isDev = process.env.NODE_ENV === NodeEnv.Development;
const port = Number(process.env.PORT) || 3040;
const postgresUrl = process.env.POSTGRES_URL;
// Goes into the User-Agent of every Wikimedia request, as their policy asks
const wikimediaContact = process.env.WIKIMEDIA_CONTACT;
const logLevel = process.env.LOG_LEVEL;
// Where clients reach this API from outside: art URLs are built on it
const publicUrl = (process.env.PUBLIC_URL ?? `http://localhost:${port}`).replace(/\/$/, "");

// The illustrations' bucket; without an endpoint the API runs with art turned off
const s3 = process.env.S3_ENDPOINT
  ? {
      endpoint: process.env.S3_ENDPOINT,
      bucket: process.env.S3_BUCKET ?? "thataway-art",
      accessKey: process.env.S3_ACCESS_KEY ?? "",
      secretKey: process.env.S3_SECRET_KEY ?? "",
    }
  : null;
// Where the app reads the bucket from (the tunnel path in the homelab), without a trailing slash
const artPublicBaseUrl = (
  process.env.ART_PUBLIC_BASE_URL ?? `${s3?.endpoint ?? ""}/${s3?.bucket ?? ""}`
).replace(/\/$/, "");
// The art worker on the Mac presents this; unset means no worker may claim jobs
const artWorkerToken = process.env.ART_WORKER_TOKEN;
// How many places without a picture one GET /places may queue for the worker
const artQueuePerAnswer = Number(process.env.ART_QUEUE_PER_ANSWER) || 8;

const config = {
  isDev,
  port,
  postgresUrl,
  wikimediaContact,
  logLevel,
  publicUrl,
  s3,
  artPublicBaseUrl,
  artWorkerToken,
  artQueuePerAnswer,
};

export const getConfig = () => config;
