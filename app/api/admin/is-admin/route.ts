import { NextResponse } from 'next/server';

import 'server-only';

import { isCurrentUserAdmin } from '@/lib/admin';

export const runtime = 'nodejs';

export async function GET() {
  try {
    const isAdmin = await isCurrentUserAdmin();
    return NextResponse.json({ isAdmin });
  } catch (error) {
    console.error('[admin.is-admin] failed', error);
    return NextResponse.json({ isAdmin: false });
  }
}
