import "dotenv/config";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { DEFAULT_PROFILE_AVATAR_STORAGE_KEY } from "../src/lib/profile-avatar";

function trimEnv(name: string) {
  const value = process.env[name];
  return typeof value === "string" ? value.trim() : "";
}

function ensureTrailingSlash(value: string) {
  return value.endsWith("/") ? value : `${value}/`;
}

function normalizeEndpoint(endpoint: string) {
  const parsed = new URL(endpoint);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error("S3_API must use http:// or https://.");
  }

  return parsed.origin;
}

function getContentTypeFromPath(filePath: string) {
  const extension = path.extname(filePath).toLowerCase();

  if (extension === ".svg") {
    return "image/svg+xml";
  }

  if (extension === ".png") {
    return "image/png";
  }

  if (extension === ".webp") {
    return "image/webp";
  }

  if (extension === ".avif") {
    return "image/avif";
  }

  if (extension === ".gif") {
    return "image/gif";
  }

  return "image/jpeg";
}

async function main() {
  const endpointFromEnv = trimEnv("S3_API");
  const accountId = trimEnv("R2_ACCOUNT_ID");
  const endpointCandidate =
    endpointFromEnv || (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : "");

  if (!endpointCandidate) {
    throw new Error("Set S3_API or R2_ACCOUNT_ID before running this script.");
  }

  const endpoint = normalizeEndpoint(endpointCandidate);
  const bucketName = trimEnv("R2_BUCKET_NAME");
  const publicBaseUrl = trimEnv("R2_PUBLIC_URL");
  const accessKeyId = trimEnv("R2_ACCESS_KEY_ID");
  const secretAccessKey = trimEnv("R2_SECRET_ACCESS_KEY");

  if (!bucketName) {
    throw new Error("R2_BUCKET_NAME is required.");
  }

  if (!publicBaseUrl) {
    throw new Error("R2_PUBLIC_URL is required.");
  }

  if (!accessKeyId || !secretAccessKey) {
    throw new Error("R2_ACCESS_KEY_ID and R2_SECRET_ACCESS_KEY are required.");
  }

  const uploadKey = process.argv[2]?.trim() || DEFAULT_PROFILE_AVATAR_STORAGE_KEY;
  const sourcePath = path.resolve(
    process.cwd(),
    process.argv[3]?.trim() || "public/images/default-avatar.svg"
  );

  const fileBuffer = await readFile(sourcePath);
  const contentType = getContentTypeFromPath(sourcePath);

  const client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  await client.send(
    new PutObjectCommand({
      Bucket: bucketName,
      Key: uploadKey,
      Body: fileBuffer,
      ContentType: contentType,
      CacheControl: "public, max-age=31536000, immutable",
    })
  );

  const publicUrl = new URL(uploadKey, ensureTrailingSlash(publicBaseUrl)).toString();

  console.log(`Uploaded asset to: ${publicUrl}`);

  if (uploadKey === DEFAULT_PROFILE_AVATAR_STORAGE_KEY) {
    console.log(
      `Set NEXT_PUBLIC_DEFAULT_PROFILE_AVATAR_URL=${publicUrl} to use this everywhere in the app.`
    );
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Failed to upload default avatar: ${message}`);
  process.exit(1);
});
