import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { randomUUID } from "crypto";
import sharp from "sharp";

const MAX_IMAGE_SIZE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_SIZE_BYTES = 23 * 1024 * 1024;
const TARGET_COMPRESSED_IMAGE_SIZE_BYTES = 250 * 1024;
const MAX_COMPRESSED_IMAGE_SIZE_BYTES = 300 * 1024;
const COMPRESSION_WIDTH_STEPS = [800, 720, 640];
const COMPRESSION_QUALITY_STEPS = [70, 64, 58, 52, 46, 40];
const ALLOWED_IMAGE_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/avif",
  "image/gif",
]);
const ALLOWED_VIDEO_MIME_TYPES = new Set([
  "video/mp4",
  "video/webm",
  "video/quicktime",
]);

const MIME_EXTENSION_MAP: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
};

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

export type UploadedR2Video = {
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

function normalizeEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new R2UploadError("S3_API must use http:// or https://.", 500);
    }

    // S3-compatible SDK clients expect endpoint origin only.
    return url.origin;
  } catch (error) {
    if (error instanceof R2UploadError) {
      throw error;
    }

    throw new R2UploadError("S3_API must be a valid URL.", 500);
  }
}

function toUploadServiceError(error: unknown) {
  const providerError =
    error && typeof error === "object"
      ? (error as {
          name?: string;
          code?: string;
          Code?: string;
          message?: string;
          $metadata?: { httpStatusCode?: number };
        })
      : null;

  const code =
    providerError?.Code ??
    providerError?.code ??
    providerError?.name ??
    "UnknownError";
  const status = providerError?.$metadata?.httpStatusCode;

  if (status === 401 || code === "Unauthorized" || code === "InvalidAccessKeyId") {
    return new R2UploadError(
      "Cloudflare R2 rejected upload credentials. Verify R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY.",
      502
    );
  }

  if (status === 403 || code === "AccessDenied") {
    return new R2UploadError(
      "Cloudflare R2 denied bucket access. Verify R2_BUCKET_NAME permissions for this key pair.",
      502
    );
  }

  if (status === 404 || code === "NoSuchBucket") {
    return new R2UploadError(
      "Cloudflare R2 bucket not found. Verify R2_BUCKET_NAME and endpoint/account settings.",
      502
    );
  }

  const providerMessage =
    typeof providerError?.message === "string" && providerError.message.trim().length > 0
      ? providerError.message.trim()
      : "Unknown provider error.";

  return new R2UploadError(
    `Media upload to Cloudflare R2 failed (${code}). ${providerMessage}`,
    502
  );
}

function getR2Config(): R2Config {
  if (cachedR2Config) {
    return cachedR2Config;
  }

  const accountId = trimEnv("R2_ACCOUNT_ID");
  const endpointFromEnv = trimEnv("S3_API");
  const endpointCandidate =
    endpointFromEnv || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");
  const endpoint = endpointCandidate ? normalizeEndpoint(endpointCandidate) : "";
  const bucketName = trimEnv("R2_BUCKET_NAME");
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

  if (!bucketName) {
    throw new R2UploadError("R2_BUCKET_NAME is missing.", 500);
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

function toUploadKey(fileName: string, contentType: string, prefix: string) {
  const extension = MIME_EXTENSION_MAP[contentType] ?? "bin";
  const daySegment = new Date().toISOString().slice(0, 10);
  const safePrefix = prefix.replace(/^\/+|\/+$/g, "");
  const baseName = sanitizeFileName(fileName);

  return `${safePrefix}/${daySegment}/${randomUUID()}-${baseName}.${extension}`;
}

function toPublicImageUrl(publicBaseUrl: string, key: string) {
  return new URL(key, ensureTrailingSlash(publicBaseUrl)).toString();
}

async function compressImageBuffer(buffer: Buffer) {
  let bestCandidate: Buffer | null = null;

  for (const width of COMPRESSION_WIDTH_STEPS) {
    for (const quality of COMPRESSION_QUALITY_STEPS) {
      const candidate = await sharp(buffer, { failOn: "none" })
        .rotate()
        .resize({
          width,
          fit: "inside",
          withoutEnlargement: true,
        })
        .jpeg({
          quality,
          mozjpeg: true,
          chromaSubsampling: "4:2:0",
        })
        .toBuffer();

      if (!bestCandidate || candidate.length < bestCandidate.length) {
        bestCandidate = candidate;
      }

      if (candidate.length <= TARGET_COMPRESSED_IMAGE_SIZE_BYTES) {
        return candidate;
      }

      if (candidate.length <= MAX_COMPRESSED_IMAGE_SIZE_BYTES) {
        return candidate;
      }
    }
  }

  if (!bestCandidate) {
    throw new R2UploadError("Unable to process this image.", 400);
  }

  return bestCandidate;
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
  const originalBuffer = Buffer.from(await file.arrayBuffer());

  let compressedBody: Buffer;

  try {
    compressedBody = await compressImageBuffer(originalBuffer);
  } catch (error) {
    if (error instanceof R2UploadError) {
      throw error;
    }

    throw new R2UploadError(
      "Unable to optimize this image. Please try another file.",
      400
    );
  }

  const contentType = "image/jpeg";
  const key = toUploadKey(file.name, contentType, options?.prefix ?? "listings");

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: compressedBody,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (error) {
    throw toUploadServiceError(error);
  }

  return {
    key,
    url: toPublicImageUrl(config.publicBaseUrl, key),
    size: compressedBody.length,
    contentType,
  };
}

export async function uploadVideoToR2(
  file: File,
  options?: { prefix?: string }
): Promise<UploadedR2Video> {
  if (!ALLOWED_VIDEO_MIME_TYPES.has(file.type)) {
    throw new R2UploadError("Only MP4, WEBM, and MOV videos are supported.", 400);
  }

  if (file.size <= 0) {
    throw new R2UploadError("The selected video is empty.", 400);
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    throw new R2UploadError("Video must be 23MB or less.", 400);
  }

  const config = getR2Config();
  const client = getR2Client();
  const body = Buffer.from(await file.arrayBuffer());
  const contentType = file.type;
  const key = toUploadKey(file.name, contentType, options?.prefix ?? "listings/videos");

  try {
    await client.send(
      new PutObjectCommand({
        Bucket: config.bucketName,
        Key: key,
        Body: body,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      })
    );
  } catch (error) {
    throw toUploadServiceError(error);
  }

  return {
    key,
    url: toPublicImageUrl(config.publicBaseUrl, key),
    size: body.length,
    contentType,
  };
}