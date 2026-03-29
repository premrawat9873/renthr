import { NextResponse } from "next/server";
import { R2UploadError, uploadImageToR2 } from "@/lib/r2";

export const runtime = "nodejs";

const MAX_FILES_PER_REQUEST = 3;

function isFile(entry: FormDataEntryValue): entry is File {
  return entry instanceof File;
}

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const files = formData
      .getAll("images")
      .filter(isFile)
      .filter((file) => file.size > 0);

    if (files.length === 0) {
      return NextResponse.json({ error: "Select at least one image to upload." }, { status: 400 });
    }

    if (files.length > MAX_FILES_PER_REQUEST) {
      return NextResponse.json(
        {
          error: `You can upload at most ${MAX_FILES_PER_REQUEST} images at a time.`,
        },
        { status: 400 }
      );
    }

    const uploadedImages = await Promise.all(
      files.map((file) => uploadImageToR2(file, { prefix: "listings" }))
    );

    return NextResponse.json({
      images: uploadedImages.map((image) => image.url),
      keys: uploadedImages.map((image) => image.key),
    });
  } catch (error) {
    if (error instanceof R2UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: "Unable to upload images right now. Please try again." },
      { status: 500 }
    );
  }
}