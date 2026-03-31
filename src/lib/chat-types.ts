export type ChatMessageType = 'TEXT' | 'IMAGE' | 'SYSTEM';

export type ChatMessagePayload = {
  id: string;
  conversationId: string;
  senderId: string;
  senderName: string;
  senderAvatarUrl: string | null;
  type: ChatMessageType;
  content: string;
  imageUrl: string | null;
  createdAt: string;
  mine: boolean;
};

export type ChatConversationPayload = {
  id: string;
  type: 'DIRECT' | 'LISTING';
  post: {
    id: string;
    title: string;
  } | null;
  peer: {
    id: string;
    name: string;
    avatarUrl: string | null;
  };
  lastMessage: {
    id: string;
    senderId: string;
    content: string;
    type: ChatMessageType;
    createdAt: string;
  } | null;
  unreadCount: number;
  updatedAt: string;
  lastMessageAt: string | null;
};

export type ChatMessagesPagePayload = {
  messages: ChatMessagePayload[];
  nextCursor: string | null;
  hasMore: boolean;
};
