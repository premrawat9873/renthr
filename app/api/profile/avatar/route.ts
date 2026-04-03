import { NextResponse } from "next/server";

import { resolveAuthenticatedUserId } from "@/lib/address-utils";
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar";
import { prisma } from "@/lib/prisma";
import { R2UploadError, uploadImageToR2 } from "@/lib/r2";

export const runtime = "nodejs";

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

export async function POST(request: Request) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in before updating your profile image." },
        { status: 401 }
      );
    }

    const formData = await request.formData();
    const entry = formData.get("avatar") ?? formData.get("image");

    if (!isFile(entry) || entry.size <= 0) {
      return NextResponse.json(
        { error: "Select an image before uploading." },
        { status: 400 }
      );
    }

    const uploadedAvatar = await uploadImageToR2(entry, { prefix: "avatars" });

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarUrl: uploadedAvatar.url,
      },
      select: {
        avatarUrl: true,
      },
    });

    return NextResponse.json(
      {
        avatarUrl: resolveProfileAvatarUrl(updatedUser.avatarUrl),
      },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof R2UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    return NextResponse.json(
      { error: "Unable to update profile image right now. Please try again." },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in before updating your profile image." },
        { status: 401 }
      );
    }

    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        avatarUrl: null,
      },
      select: {
        avatarUrl: true,
      },
    });

    return NextResponse.json(
      {
        avatarUrl: resolveProfileAvatarUrl(updatedUser.avatarUrl),
      },
      { status: 200 }
    );
  } catch {
    return NextResponse.json(
      { error: "Unable to reset profile image right now. Please try again." },
      { status: 500 }
    );
  }
}
