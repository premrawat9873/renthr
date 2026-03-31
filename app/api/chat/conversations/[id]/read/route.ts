import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import { ChatError, markConversationAsRead, parsePositiveInt } from '@/lib/chat';

export const runtime = 'nodejs';

type ConversationReadRouteParams = {
  id: string;
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<ConversationReadRouteParams> }
) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Please log in to update read status.' }, { status: 401 });
    }

    const { id } = await params;
    const conversationId = parsePositiveInt(id);

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is invalid.' }, { status: 400 });
    }

    await markConversationAsRead({ userId, conversationId });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof ChatError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json(
      { error: 'Unable to update read status right now.' },
      { status: 500 }
    );
  }
}
