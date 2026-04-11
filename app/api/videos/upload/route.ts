import { NextResponse } from "next/server";
import { R2UploadError, uploadVideoToR2 } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_VIDEO_DURATION_SECONDS = 60;

function isFile(entry: FormDataEntryValue | null): entry is File {
  return entry instanceof File;
}

function parseDurationSeconds(value: FormDataEntryValue | null) {
  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const fileEntry = formData.get("video");

    if (!isFile(fileEntry) || fileEntry.size <= 0) {
      return NextResponse.json(
        { error: "Select a video to upload." },
        { status: 400 }
      );
    }

    const durationSeconds = parseDurationSeconds(formData.get("durationSeconds"));

    if (durationSeconds == null) {
      return NextResponse.json(
        { error: "Video duration metadata is required." },
        { status: 400 }
      );
    }

    if (durationSeconds > MAX_VIDEO_DURATION_SECONDS) {
      return NextResponse.json(
        { error: `Video must be ${MAX_VIDEO_DURATION_SECONDS} seconds or shorter.` },
        { status: 400 }
      );
    }

    const uploadedVideo = await uploadVideoToR2(fileEntry, {
      prefix: "listings/videos",
    });

    return NextResponse.json({
      video: {
        url: uploadedVideo.url,
        key: uploadedVideo.key,
        sizeBytes: uploadedVideo.size,
        contentType: uploadedVideo.contentType,
        durationSeconds: Math.ceil(durationSeconds),
      },
    });
  } catch (error) {
    if (error instanceof R2UploadError) {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode }
      );
    }

    return NextResponse.json(
      { error: "Unable to upload video right now. Please try again." },
      { status: 500 }
    );
  }
}
