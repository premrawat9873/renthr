import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import {
  ChatError,
  listMessagesForConversation,
  parsePositiveInt,
  sendMessageToConversation,
} from '@/lib/chat';

export const runtime = 'nodejs';

type ConversationMessagesRouteParams = {
  id: string;
};

type SendMessageRequestBody = {
  content?: unknown;
  imageUrl?: unknown;
};

export async function GET(
  request: Request,
  { params }: { params: Promise<ConversationMessagesRouteParams> }
) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Please log in to view messages.' }, { status: 401 });
    }

    const { id } = await params;
    const conversationId = parsePositiveInt(id);

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is invalid.' }, { status: 400 });
    }

    const searchParams = new URL(request.url).searchParams;
    const payload = await listMessagesForConversation({
      userId,
      conversationId,
      cursor: searchParams.get('cursor'),
      limit: searchParams.get('limit'),
    });

    return NextResponse.json(payload);
  } catch (error) {
    if (error instanceof ChatError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Unable to load messages right now.' }, { status: 500 });
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<ConversationMessagesRouteParams> }
) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Please log in to send a message.' }, { status: 401 });
    }

    const { id } = await params;
    const conversationId = parsePositiveInt(id);

    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation ID is invalid.' }, { status: 400 });
    }

    const body = (await request.json()) as SendMessageRequestBody;
    const message = await sendMessageToConversation({
      userId,
      conversationId,
      content: body.content,
      imageUrl: body.imageUrl,
    });

    return NextResponse.json({ message }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Unable to send message right now.' }, { status: 500 });
  }
}
