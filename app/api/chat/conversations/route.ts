import { NextResponse } from 'next/server';

import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import {
  ChatError,
  listChatConversationsForUser,
  parsePositiveInt,
  startOrGetDirectConversation,
} from '@/lib/chat';

export const runtime = 'nodejs';

type StartConversationRequestBody = {
  recipientId?: unknown;
  postId?: unknown;
  initialMessage?: unknown;
};

export async function GET() {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Please log in to view your chats.' }, { status: 401 });
    }

    const conversations = await listChatConversationsForUser(userId);
    return NextResponse.json({ conversations });
  } catch {
    return NextResponse.json({ error: 'Unable to load conversations right now.' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Please log in to start a chat.' }, { status: 401 });
    }

    const body = (await request.json()) as StartConversationRequestBody;
    const recipientId = parsePositiveInt(body.recipientId);
    const postId = parsePositiveInt(body.postId);

    if (!recipientId) {
      return NextResponse.json({ error: 'recipientId is required.' }, { status: 400 });
    }

    if (!postId) {
      return NextResponse.json({ error: 'postId is required for product chat.' }, { status: 400 });
    }

    const conversation = await startOrGetDirectConversation({
      userId,
      recipientId,
      postId,
      initialMessage: body.initialMessage,
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Unable to start chat right now.' }, { status: 500 });
  }
}
