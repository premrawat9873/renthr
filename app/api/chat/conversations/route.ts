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
  recipientUserId?: unknown;
  ownerId?: unknown;
  listingOwnerId?: unknown;
  postId?: unknown;
  post_id?: unknown;
  listingId?: unknown;
  initialMessage?: unknown;
  message?: unknown;
};

export async function GET(request: Request) {
  try {
    const userId = await resolveAuthenticatedUserId();
    if (!userId) {
      return NextResponse.json({ error: 'Please log in to view your chats.' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const includeEmpty =
      searchParams.get('includeEmpty') === '1' ||
      searchParams.get('includeEmpty') === 'true';

    const conversations = await listChatConversationsForUser(userId, {
      includeEmpty,
    });
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
    const recipientId =
      parsePositiveInt(body.recipientId) ??
      parsePositiveInt(body.recipientUserId) ??
      parsePositiveInt(body.ownerId) ??
      parsePositiveInt(body.listingOwnerId);
    const postId =
      parsePositiveInt(body.postId) ??
      parsePositiveInt(body.post_id) ??
      parsePositiveInt(body.listingId);

    if (!postId) {
      return NextResponse.json({ error: 'postId is required for product chat.' }, { status: 400 });
    }

    const initialMessage =
      typeof body.initialMessage === 'string'
        ? body.initialMessage
        : body.message;

    const conversation = await startOrGetDirectConversation({
      userId,
      recipientId,
      postId,
      initialMessage,
    });

    return NextResponse.json({ conversation }, { status: 201 });
  } catch (error) {
    if (error instanceof ChatError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    return NextResponse.json({ error: 'Unable to start chat right now.' }, { status: 500 });
  }
}
