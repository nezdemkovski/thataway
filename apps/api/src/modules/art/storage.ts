import {
  CreateBucketCommand,
  HeadBucketCommand,
  PutBucketPolicyCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import { getConfig } from "@/config";
import { ArtContentType, LogNamespace } from "@/utils/enums";
import { createLogger } from "@/utils/logger";

const logger = createLogger(LogNamespace.Art);

let client: S3Client | null = null;

const s3 = (): S3Client | null => {
  const { s3: settings } = getConfig();
  if (!settings) return null;
  client ??= new S3Client({
    endpoint: settings.endpoint,
    region: "us-east-1",
    forcePathStyle: true,
    credentials: { accessKeyId: settings.accessKey, secretAccessKey: settings.secretKey },
  });
  return client;
};

/** The illustrations' bucket: created with a public-read policy the first time the API runs. */
export const ArtStorage = {
  enabled(): boolean {
    return getConfig().s3 !== null;
  },

  async ensureBucket(): Promise<void> {
    const api = s3();
    const settings = getConfig().s3;
    if (!api || !settings) {
      logger.warn("S3_ENDPOINT is not set: illustrations are off");
      return;
    }
    const { bucket } = settings;
    try {
      await api.send(new HeadBucketCommand({ Bucket: bucket }));
    } catch {
      await api.send(new CreateBucketCommand({ Bucket: bucket }));
      logger.info("bucket created", { bucket });
    }
    await api.send(
      new PutBucketPolicyCommand({
        Bucket: bucket,
        Policy: JSON.stringify({
          Version: "2012-10-17",
          Statement: [
            {
              Sid: "PublicRead",
              Effect: "Allow",
              Principal: { AWS: ["*"] },
              Action: ["s3:GetObject"],
              Resource: [`arn:aws:s3:::${bucket}/*`],
            },
          ],
        }),
      }),
    );
    logger.info("bucket ready", { bucket, publicBaseUrl: getConfig().artPublicBaseUrl });
  },

  /** Stores a picture under `key`; the key carries a hash, so the object may be cached forever. */
  async put(key: string, bytes: Uint8Array, contentType: ArtContentType): Promise<void> {
    const api = s3();
    const settings = getConfig().s3;
    if (!api || !settings) throw new Error("S3 is not configured");
    await api.send(
      new PutObjectCommand({
        Bucket: settings.bucket,
        Key: key,
        Body: bytes,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  },

  publicUrl(key: string): string {
    return `${getConfig().artPublicBaseUrl}/${key}`;
  },
};
