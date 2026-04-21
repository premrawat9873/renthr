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

type ConversationPostSummaryRecord = {
  id: number;
  title: string;
  listingType: 'RENT' | 'SELL' | 'BOTH';
  currency: string;
  sellPricePaise: number | null;
  rentHourlyPaise: number | null;
  rentDailyPaise: number | null;
  rentWeeklyPaise: number | null;
  rentMonthlyPaise: number | null;
  images: {
    url: string;
  }[];
};

function formatCurrencyFromPaise(amountPaise: number, currency: string) {
  const amount = amountPaise / 100;
  const maxFractionDigits = amountPaise % 100 === 0 ? 0 : 2;

  try {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency,
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: 0,
    }).format(amount);
  } catch {
    if (currency.toUpperCase() === 'INR') {
      return `₹${amount.toFixed(maxFractionDigits)}`;
    }

    return `${currency} ${amount.toFixed(maxFractionDigits)}`;
  }
}

function getConversationPostPriceLabel(post: ConversationPostSummaryRecord) {
  if (
    (post.listingType === 'RENT' || post.listingType === 'BOTH') &&
    post.rentHourlyPaise != null
  ) {
    return `${formatCurrencyFromPaise(post.rentHourlyPaise, post.currency)}/hr`;
  }

  if (
    (post.listingType === 'RENT' || post.listingType === 'BOTH') &&
    post.rentDailyPaise != null
  ) {
    return `${formatCurrencyFromPaise(post.rentDailyPaise, post.currency)}/day`;
  }

  if (
    (post.listingType === 'RENT' || post.listingType === 'BOTH') &&
    post.rentWeeklyPaise != null
  ) {
    return `${formatCurrencyFromPaise(post.rentWeeklyPaise, post.currency)}/wk`;
  }

  if (
    (post.listingType === 'RENT' || post.listingType === 'BOTH') &&
    post.rentMonthlyPaise != null
  ) {
    return `${formatCurrencyFromPaise(post.rentMonthlyPaise, post.currency)}/mo`;
  }

  if ((post.listingType === 'SELL' || post.listingType === 'BOTH') && post.sellPricePaise != null) {
    return formatCurrencyFromPaise(post.sellPricePaise, post.currency);
  }

  return null;
}

function mapConversationPostSummary(post: ConversationPostSummaryRecord | null | undefined) {
  if (!post) {
    return null;
  }

  return {
    id: String(post.id),
    title: post.title,
    imageUrl: post.images[0]?.url ?? null,
    priceLabel: getConversationPostPriceLabel(post),
  };
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
  userId: number,
  options?: {
    includeEmpty?: boolean;
  }
): Promise<ChatConversationPayload[]> {
  const includeEmpty = options?.includeEmpty === true;
  const conversations = await prisma.conversation.findMany({
    where: {
      type: 'LISTING',
      postId: {
        not: null,
      },
      ...(includeEmpty
        ? {}
        : {
            lastMessageAt: {
              not: null,
            },
          }),
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
          listingType: true,
          currency: true,
          sellPricePaise: true,
          rentHourlyPaise: true,
          rentDailyPaise: true,
          rentWeeklyPaise: true,
          rentMonthlyPaise: true,
          images: {
            select: {
              url: true,
            },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
            take: 1,
          },
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
      post: mapConversationPostSummary(conversation.post),
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
  recipientId?: number | null;
  postId?: number | null;
  initialMessage?: unknown;
}) {
  const { userId } = input;
  const requestedRecipientId = input.recipientId ?? null;
  const postId = input.postId ?? null;

  if (!postId) {
    throw new ChatError(400, 'postId is required to start a listing chat.');
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

  const resolvedRecipientId = post.authorId;

  if (resolvedRecipientId === userId) {
    throw new ChatError(400, 'You cannot start a chat with yourself.');
  }

  const recipient = await prisma.user.findUnique({
    where: {
      id: resolvedRecipientId,
    },
    select: {
      id: true,
    },
  });

  if (!recipient) {
    throw new ChatError(404, 'Recipient user was not found.');
  }

  const participantRecipientId =
    requestedRecipientId && requestedRecipientId === resolvedRecipientId
      ? requestedRecipientId
      : resolvedRecipientId;

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
              userId: participantRecipientId,
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
      participantIds.includes(participantRecipientId)
    );
  });

  const baseConversation = existingConversation
    ? { id: existingConversation.id }
    : await prisma.conversation.create({
        data: {
          type: 'LISTING',
          postId,
          participants: {
            create: [{ userId }, { userId: participantRecipientId }],
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

  const conversations = await listChatConversationsForUser(userId, {
    includeEmpty: true,
  });
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

  const conversationContext = await prisma.conversation.findFirst({
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
      type: true,
      post: {
        select: {
          id: true,
          title: true,
          listingType: true,
          currency: true,
          sellPricePaise: true,
          rentHourlyPaise: true,
          rentDailyPaise: true,
          rentWeeklyPaise: true,
          rentMonthlyPaise: true,
          images: {
            select: {
              url: true,
            },
            orderBy: [{ isPrimary: 'desc' }, { sortOrder: 'asc' }, { id: 'asc' }],
            take: 1,
          },
        },
      },
      participants: {
        select: {
          userId: true,
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
    },
  });

  const peerParticipant = conversationContext?.participants.find(
    (participant) => participant.userId !== userId
  );
  const peerUser = peerParticipant?.user;

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
    conversation: conversationContext
      ? {
          id: String(conversationContext.id),
          type: conversationContext.type,
          post: mapConversationPostSummary(conversationContext.post),
          peer: peerUser
            ? {
                id: String(peerUser.id),
                name: getDisplayName(peerUser.name, peerUser.email),
                avatarUrl: resolveProfileAvatarUrl(peerUser.avatarUrl),
              }
            : null,
        }
      : null,
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
