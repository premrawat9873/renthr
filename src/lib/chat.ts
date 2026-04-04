import 'server-only';

import { prisma } from '@/lib/prisma';
import { resolveProfileAvatarUrl } from '@/lib/profile-avatar';
import { decryptChatMessageContent, encryptChatMessageContent } from '@/lib/chat-encryption';
import type {
  ChatConversationPayload,
  ChatMessagePayload,
  ChatMessagesPagePayload,
  ChatMessageType,
} from '@/lib/chat-types';

const DEFAULT_MESSAGE_PAGE_SIZE = 40;
const MAX_MESSAGE_PAGE_SIZE = 80;
const MAX_MESSAGE_LENGTH = 2000;

export class ChatError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function parsePositiveInt(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }

  if (typeof value !== 'string') {
    return null;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
}

function getDisplayName(name: string | null | undefined, email: string) {
  const normalizedName = name?.trim();
  if (normalizedName) {
    return normalizedName;
  }

  const [localPart] = email.split('@');
  return localPart?.trim() || 'User';
}

function normalizeMessageContent(input: unknown) {
  if (typeof input !== 'string') {
    return '';
  }

  return input.trim();
}

async function assertConversationMembership(conversationId: number, userId: number) {
  const conversation = await prisma.conversation.findFirst({
    where: {
      id: conversationId,
      type: 'LISTING',
      postId: {
        not: null,
      },
      participants: {
        some: {
          userId,
        },
      },
    },
    select: {
      id: true,
    },
  });

  if (!conversation) {
    throw new ChatError(404, 'Conversation not found.');
  }
}

function mapMessagePayload(
  message: {
    id: number;
    conversationId: number;
    senderId: number;
    type: string;
    content: string;
    imageUrl: string | null;
    createdAt: Date;
    sender: {
      id: number;
      name: string | null;
      email: string;
      avatarUrl: string | null;
    };
  },
  viewerUserId: number
): ChatMessagePayload {
  return {
    id: String(message.id),
    conversationId: String(message.conversationId),
    senderId: String(message.senderId),
    senderName: getDisplayName(message.sender.name, message.sender.email),
    senderAvatarUrl: resolveProfileAvatarUrl(message.sender.avatarUrl),
    type: message.type as ChatMessageType,
    content: decryptChatMessageContent(message.content),
    imageUrl: message.imageUrl,
    createdAt: message.createdAt.toISOString(),
    mine: message.senderId === viewerUserId,
  };
}

function parseMessagePageSize(limit: unknown) {
  const parsed = parsePositiveInt(limit);
  if (!parsed) {
    return DEFAULT_MESSAGE_PAGE_SIZE;
  }

  return Math.min(parsed, MAX_MESSAGE_PAGE_SIZE);
}

export async function listChatConversationsForUser(
  userId: number
): Promise<ChatConversationPayload[]> {
  const conversations = await prisma.conversation.findMany({
    where: {
      type: 'LISTING',
      postId: {
        not: null,
      },
      participants: {
        some: {
          userId,
        },
      },
    },
    orderBy: [{ lastMessageAt: 'desc' }, { updatedAt: 'desc' }],
    include: {
      post: {
        select: {
          id: true,
          title: true,
        },
      },
      participants: {
        select: {
          userId: true,
          lastReadAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              avatarUrl: true,
            },
          },
        },
      },
      messages: {
        orderBy: {
          createdAt: 'desc',
        },
        take: 1,
        select: {
          id: true,
          senderId: true,
          content: true,
          type: true,
          createdAt: true,
        },
      },
    },
  });

  const unreadCounts = await Promise.all(
    conversations.map(async (conversation) => {
      const selfParticipant = conversation.participants.find(
        (participant) => participant.userId === userId
      );

      if (!selfParticipant) {
        return 0;
      }

      return prisma.message.count({
        where: {
          conversationId: conversation.id,
          senderId: {
            not: userId,
          },
          ...(selfParticipant.lastReadAt
            ? {
                createdAt: {
                  gt: selfParticipant.lastReadAt,
                },
              }
            : {}),
        },
      });
    })
  );

  return conversations.map((conversation, index) => {
    const peerParticipant =
      conversation.participants.find((participant) => participant.userId !== userId) ??
      conversation.participants[0];

    const peer = peerParticipant?.user;
    const latestMessage = conversation.messages[0] ?? null;

    return {
      id: String(conversation.id),
      type: conversation.type,
      post: conversation.post
        ? {
            id: String(conversation.post.id),
            title: conversation.post.title,
          }
        : null,
      peer: {
        id: String(peer?.id ?? userId),
        name: peer ? getDisplayName(peer.name, peer.email) : 'User',
        avatarUrl: resolveProfileAvatarUrl(peer?.avatarUrl),
      },
      lastMessage: latestMessage
        ? {
            id: String(latestMessage.id),
            senderId: String(latestMessage.senderId),
            content: decryptChatMessageContent(latestMessage.content),
            type: latestMessage.type as ChatMessageType,
            createdAt: latestMessage.createdAt.toISOString(),
          }
        : null,
      unreadCount: unreadCounts[index] ?? 0,
      updatedAt: conversation.updatedAt.toISOString(),
      lastMessageAt: conversation.lastMessageAt?.toISOString() ?? null,
    };
  });
}

export async function startOrGetDirectConversation(input: {
  userId: number;
  recipientId: number;
  postId?: number | null;
  initialMessage?: unknown;
}) {
  const { userId, recipientId } = input;
  const postId = input.postId ?? null;

  if (!postId) {
    throw new ChatError(400, 'postId is required to start a listing chat.');
  }

  if (recipientId === userId) {
    throw new ChatError(400, 'You cannot start a chat with yourself.');
  }

  const recipient = await prisma.user.findUnique({
    where: {
      id: recipientId,
    },
    select: {
      id: true,
    },
  });

  if (!recipient) {
    throw new ChatError(404, 'Recipient user was not found.');
  }

  const post = await prisma.post.findUnique({
    where: {
      id: postId,
    },
    select: {
      id: true,
      authorId: true,
    },
  });

  if (!post) {
    throw new ChatError(404, 'Listing was not found.');
  }

  if (post.authorId !== recipientId) {
    throw new ChatError(
      400,
      'Messages for a listing can only be sent to the listing publisher.'
    );
  }

  const candidates = await prisma.conversation.findMany({
    where: {
      type: 'LISTING',
      postId,
      participants: {
        some: {
          userId,
        },
      },
      AND: [
        {
          participants: {
            some: {
              userId: recipientId,
            },
          },
        },
      ],
    },
    include: {
      participants: {
        select: {
          userId: true,
        },
      },
    },
    orderBy: {
      updatedAt: 'desc',
    },
    take: 20,
  });

  const existingConversation = candidates.find((conversation) => {
    const participantIds = conversation.participants.map((participant) => participant.userId);
    return (
      participantIds.length === 2 &&
      participantIds.includes(userId) &&
      participantIds.includes(recipientId)
    );
  });

  const baseConversation = existingConversation
    ? { id: existingConversation.id }
    : await prisma.conversation.create({
        data: {
          type: 'LISTING',
          postId,
          participants: {
            create: [{ userId }, { userId: recipientId }],
          },
        },
        select: {
          id: true,
        },
      });

  const initialMessage = normalizeMessageContent(input.initialMessage);

  if (initialMessage) {
    if (initialMessage.length > MAX_MESSAGE_LENGTH) {
      throw new ChatError(400, `Message must be at most ${MAX_MESSAGE_LENGTH} characters.`);
    }

    await prisma.$transaction(async (tx) => {
      const createdMessage = await tx.message.create({
        data: {
          conversationId: baseConversation.id,
          senderId: userId,
          content: encryptChatMessageContent(initialMessage),
          type: 'TEXT',
        },
        select: {
          createdAt: true,
        },
      });

      await tx.conversation.update({
        where: {
          id: baseConversation.id,
        },
        data: {
          lastMessageAt: createdMessage.createdAt,
        },
      });

      await tx.conversationParticipant.updateMany({
        where: {
          conversationId: baseConversation.id,
          userId,
        },
        data: {
          lastReadAt: createdMessage.createdAt,
        },
      });
    });
  }

  const conversations = await listChatConversationsForUser(userId);
  const selectedConversation = conversations.find(
    (conversation) => conversation.id === String(baseConversation.id)
  );

  if (!selectedConversation) {
    throw new ChatError(500, 'Unable to load conversation.');
  }

  return selectedConversation;
}

export async function listMessagesForConversation(input: {
  userId: number;
  conversationId: number;
  cursor?: unknown;
  limit?: unknown;
}): Promise<ChatMessagesPagePayload> {
  const { userId, conversationId } = input;
  await assertConversationMembership(conversationId, userId);

  const limit = parseMessagePageSize(input.limit);
  const cursorId = parsePositiveInt(input.cursor);

  const rows = await prisma.message.findMany({
    where: {
      conversationId,
      ...(cursorId
        ? {
            id: {
              lt: cursorId,
            },
          }
        : {}),
    },
    orderBy: {
      id: 'desc',
    },
    take: limit + 1,
    include: {
      sender: {
        select: {
          id: true,
          name: true,
          email: true,
          avatarUrl: true,
        },
      },
    },
  });

  const hasMore = rows.length > limit;
  const visibleRows = hasMore ? rows.slice(0, limit) : rows;
  const nextCursor =
    hasMore && visibleRows.length > 0
      ? String(visibleRows[visibleRows.length - 1].id)
      : null;

  return {
    messages: visibleRows.reverse().map((message) => mapMessagePayload(message, userId)),
    nextCursor,
    hasMore,
  };
}

export async function sendMessageToConversation(input: {
  userId: number;
  conversationId: number;
  content?: unknown;
  imageUrl?: unknown;
}) {
  const { userId, conversationId } = input;
  await assertConversationMembership(conversationId, userId);

  const content = normalizeMessageContent(input.content);
  const imageUrl = typeof input.imageUrl === 'string' ? input.imageUrl.trim() : '';

  if (!content && !imageUrl) {
    throw new ChatError(400, 'Message content cannot be empty.');
  }

  if (content.length > MAX_MESSAGE_LENGTH) {
    throw new ChatError(400, `Message must be at most ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const createdMessage = await prisma.$transaction(async (tx) => {
    const message = await tx.message.create({
      data: {
        conversationId,
        senderId: userId,
        content: encryptChatMessageContent(content),
        type: imageUrl ? 'IMAGE' : 'TEXT',
        imageUrl: imageUrl || null,
      },
      include: {
        sender: {
          select: {
            id: true,
            name: true,
            email: true,
            avatarUrl: true,
          },
        },
      },
    });

    await tx.conversation.update({
      where: {
        id: conversationId,
      },
      data: {
        lastMessageAt: message.createdAt,
      },
    });

    await tx.conversationParticipant.updateMany({
      where: {
        conversationId,
        userId,
      },
      data: {
        lastReadAt: message.createdAt,
      },
    });

    return message;
  });

  return mapMessagePayload(createdMessage, userId);
}

export async function markConversationAsRead(input: {
  userId: number;
  conversationId: number;
}) {
  const { userId, conversationId } = input;
  await assertConversationMembership(conversationId, userId);

  await prisma.conversationParticipant.updateMany({
    where: {
      conversationId,
      userId,
    },
    data: {
      lastReadAt: new Date(),
    },
  });
}
