import { NextResponse } from 'next/server';
import { getCurrentUserInfo } from '@/lib/current-user';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function GET() {
  try {
    const currentUser = await getCurrentUserInfo();

    return NextResponse.json(
      { authenticated: Boolean(currentUser) },
      { headers: NO_STORE_HEADERS }
    );
  } catch {
    return NextResponse.json(
      { authenticated: false },
      { headers: NO_STORE_HEADERS }
    );
  }
}
