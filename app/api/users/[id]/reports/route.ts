import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import { submitReport } from '@/lib/reports';

export const runtime = 'nodejs';

type RouteParams = {
  id: string;
};

type ReportBody = {
  reason?: unknown;
  details?: unknown;
};

function parsePositiveInt(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

export async function POST(
  request: Request,
  { params }: { params: Promise<RouteParams> }
) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json(
        { error: 'Please log in to submit a report.' },
        { status: 401 }
      );
    }

    const { id } = await params;
    const targetId = parsePositiveInt(id);
    if (!targetId) {
      return NextResponse.json({ error: 'User ID is invalid.' }, { status: 400 });
    }

    const body = (await request.json().catch(() => null)) as ReportBody | null;
    const reason = typeof body?.reason === 'string' ? body.reason.trim() : '';
    const details = typeof body?.details === 'string' ? body.details.trim() : '';

    if (!reason) {
      return NextResponse.json({ error: 'Reason is required.' }, { status: 400 });
    }

    await submitReport({
      reporterId: userId,
      targetType: 'user',
      targetId,
      reason,
      details,
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit report.';
    const status =
      message.includes('not found') || message.includes('cannot report') ? 400 : 500;

    return NextResponse.json({ error: message }, { status });
  }
}
