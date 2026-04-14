import { NextRequest, NextResponse } from "next/server";

import { resolveAuthenticatedUserId } from "@/lib/address-utils";
import { submitReport, type ReportTargetType } from "@/lib/reports";

export const runtime = "nodejs";

type ReportPayload = {
  targetType?: string;
  targetId?: string | number;
  reason?: string;
  details?: string;
};

function parseTargetId(value: string | number | undefined) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.floor(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function parseTargetType(value: string | undefined): ReportTargetType | null {
  if (value === "post" || value === "user") {
    return value;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: "Please log in to submit a report." },
        { status: 401 }
      );
    }

    const body = (await request.json().catch(() => null)) as ReportPayload | null;

    const targetType = parseTargetType(body?.targetType);
    const targetId = parseTargetId(body?.targetId);
    const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
    const details = typeof body?.details === "string" ? body.details.trim() : "";

    if (!targetType || !targetId || !reason) {
      return NextResponse.json(
        { error: "targetType, targetId, and reason are required." },
        { status: 400 }
      );
    }

    await submitReport({
      reporterId: userId,
      targetType,
      targetId,
      reason,
      details,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to submit report.";
    const status =
      message.includes("not found") || message.includes("cannot report") ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
