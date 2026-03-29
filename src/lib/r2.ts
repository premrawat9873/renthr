import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
};

const FALLBACK_BUCKET_NAME = "rent-hr-bucket";

type R2Config = {
  bucketName: string;
  publicBaseUrl: string;
  endpoint: string;
  accessKeyId: string;
  secretAccessKey: string;
};

export class R2UploadError extends Error {
  statusCode: number;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

export type UploadedR2Image = {
  key: string;
  url: string;
  size: number;
  contentType: string;
};

let cachedR2Client: S3Client | null = null;
let cachedR2Config: R2Config | null = null;

function ensureTrailingSlash(url: string) {
  return url.endsWith("/") ? url : `${url}/`;
}

function trimEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function getR2Config(): R2Config {
  if (cachedR2Config) {
    return cachedR2Config;
  }

  const accountId = trimEnv("R2_ACCOUNT_ID");
  const endpointFromEnv = trimEnv("S3_API");
  const endpoint = endpointFromEnv || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const bucketName = trimEnv("R2_BUCKET_NAME") || FALLBACK_BUCKET_NAME;
  const publicBaseUrl = trimEnv("R2_PUBLIC_URL");
  const accessKeyId = trimEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = trimEnv("R2_SECRET_ACCESS_KEY");

  if (!endpoint) {
    throw new R2UploadError(
      "Cloudflare R2 endpoint is missing. Set S3_API or R2_ACCOUNT_ID.",
      500
    );
  }

  if (!publicBaseUrl) {
    throw new R2UploadError("R2_PUBLIC_URL is missing.", 500);
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new R2UploadError(
      "R2_ACCESS_KEY_ID or R2_SECRET_ACCESS_KEY is missing.",
      500
    );
  }

  try {
    new URL(publicBaseUrl);
  } catch {
    throw new R2UploadError("R2_PUBLIC_URL must be a valid URL.", 500);
  }

  cachedR2Config = {
    bucketName,
    publicBaseUrl,
    endpoint,
    accessKeyId,
    secretAccessKey,
  };

  return cachedR2Config;
}

function getR2Client() {
  if (cachedR2Client) {
    return cachedR2Client;
  }

  const config = getR2Config();

  cachedR2Client = new S3Client({
    region: "auto",
    endpoint: config.endpoint,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  return cachedR2Client;
}

function sanitizeFileName(name: string) {
  const withoutExtension = name.replace(/\.[^.]+$/, "");
  const sanitized = withoutExtension
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  return sanitized || "image";
}

function toUploadKey(file: File, prefix: string) {
  const contentType = file.type;
  const extension = MIME_EXTENSION_MAP[contentType] ?? "bin";
  const daySegment = new Date().toISOString().slice(0, 10);
  const safePrefix = prefix.replace(/^\/+|\/+$/g, "");
  const baseName = sanitizeFileName(file.name);

  return `${safePrefix}/${daySegment}/${randomUUID()}-${baseName}.${extension}`;
}

function toPublicImageUrl(publicBaseUrl: string, key: string) {
  return new URL(key, ensureTrailingSlash(publicBaseUrl)).toString();
}

export async function uploadImageToR2(
  file: File,
  options?: { prefix?: string }
): Promise<UploadedR2Image> {
  if (!ALLOWED_IMAGE_MIME_TYPES.has(file.type)) {
    throw new R2UploadError("Only JPG, PNG, WEBP, AVIF, and GIF images are supported.", 400);
  }

  if (file.size <= 0) {
    throw new R2UploadError("One of the selected files is empty.", 400);
  }

  if (file.size > MAX_IMAGE_SIZE_BYTES) {
    throw new R2UploadError("Each image must be 8MB or less.", 400);
  }

  const config = getR2Config();
  const client = getR2Client();
  const key = toUploadKey(file, options?.prefix ?? "listings");
  const body = Buffer.from(await file.arrayBuffer());

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: body,
        ContentType: file.type,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch {
    throw new R2UploadError("Image upload to Cloudflare R2 failed.", 502);
  }

  return {
    key,
    url: toPublicImageUrl(config.publicBaseUrl, key),
    size: file.size,
    contentType: file.type,
  };
}