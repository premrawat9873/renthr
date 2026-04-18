import { NextResponse } from "next/server";

import "server-only";

import { getCurrentUserInfo } from "@/lib/current-user";
import { isCurrentUserAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { uploadImageToR2, R2UploadError } from "@/lib/r2";
import { resolveProfileAvatarUrl } from "@/lib/profile-avatar";

export const runtime = "nodejs";

function parseUserId(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
}

function isFile(value: FormDataEntryValue | null): value is File {
  return value instanceof File;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseUserId(id);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const current = await getCurrentUserInfo();
    if (!current) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }

    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const formData = await request.formData();
    const entry = formData.get("avatar") ?? formData.get("image");

    if (!isFile(entry) || entry.size <= 0) {
      return NextResponse.json({ error: "Select an image before uploading." }, { status: 400 });
    }

    const uploaded = await uploadImageToR2(entry, { prefix: "avatars" });

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: uploaded.url },
      select: { avatarUrl: true },
    });

    return NextResponse.json({ avatarUrl: resolveProfileAvatarUrl(updated.avatarUrl) }, { status: 200 });
  } catch (error) {
    if (error instanceof R2UploadError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }

    console.error("[admin.users.avatar.post]", error);
    return NextResponse.json({ error: "Unable to update avatar right now." }, { status: 500 });
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const userId = parseUserId(id);
    if (!userId) {
      return NextResponse.json({ error: "Invalid user id." }, { status: 400 });
    }

    const current = await getCurrentUserInfo();
    if (!current) {
      return NextResponse.json({ error: "Please log in." }, { status: 401 });
    }

    if (!(await isCurrentUserAdmin())) {
      return NextResponse.json({ error: "Not allowed." }, { status: 403 });
    }

    const updated = await prisma.user.update({
      where: { id: userId },
      data: { avatarUrl: null },
      select: { avatarUrl: true },
    });

    return NextResponse.json({ avatarUrl: resolveProfileAvatarUrl(updated.avatarUrl) }, { status: 200 });
  } catch (error) {
    console.error("[admin.users.avatar.delete]", error);
    return NextResponse.json({ error: "Unable to reset avatar right now." }, { status: 500 });
  }
}
