import { NextResponse } from "next/server";

import "server-only";

import { getCurrentUserInfo } from "@/lib/current-user";
import { isCurrentUserAdmin } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

function parseUserId(value: string | string[] | undefined) {
  const normalized = Array.isArray(value) ? value[0] : value;
  if (!normalized) return null;
  const parsed = Number.parseInt(normalized, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return parsed;
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

    // Remove posts by user first to avoid FK constraints
    await prisma.post.deleteMany({ where: { authorId: userId } });

    await prisma.user.delete({ where: { id: userId } });

    return NextResponse.json({ id: String(userId), deleted: true });
  } catch (error) {
    console.error("[admin.users.delete] failed", error);
    return NextResponse.json(
      { error: "Unable to delete user right now." },
      { status: 500 }
    );
  }
}
