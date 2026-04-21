import type { Metadata } from 'next';
import Link from 'next/link';

import ChatPageClient from '@/components/chat/ChatPageClient';
import { resolveAuthenticatedUserId } from '@/lib/address-utils';
import { listChatConversationsForUser } from '@/lib/chat';
import { getCurrentUserInfo } from '@/lib/current-user';

type MessagesPageSearchParams = {
  conversation?: string;
  draft?: string;
};

export const metadata: Metadata = {
  title: 'Messages',
  description: 'Chat with buyers and sellers in real time.',
  robots: {
    index: false,
    follow: false,
  },
};

export default async function MessagesPage({
  searchParams,
}: {
  searchParams: Promise<MessagesPageSearchParams>;
}) {
  const currentUser = await getCurrentUserInfo();
  if (!currentUser) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="container space-y-4 py-10">
          <h1 className="font-heading text-2xl font-semibold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            Please sign in to view your conversations.
          </p>
          <div className="flex items-center gap-4">
            <Link href="/login?next=/messages" className="text-sm font-medium text-primary hover:underline">
              Go to login
            </Link>
            <Link href="/" className="text-sm font-medium text-primary hover:underline">
              Back to marketplace
            </Link>
          </div>
        </div>
      </main>
    );
  }

  const userId = await resolveAuthenticatedUserId();

  if (!userId) {
    return (
      <main className="min-h-screen bg-background text-foreground">
        <div className="container space-y-4 py-10">
          <h1 className="font-heading text-2xl font-semibold">Messages</h1>
          <p className="text-sm text-muted-foreground">
            We could not resolve your account right now. Please sign in again.
          </p>
          <Link href="/login?next=/messages" className="text-sm font-medium text-primary hover:underline">
            Go to login
          </Link>
        </div>
      </main>
    );
  }

  const params = await searchParams;
  const initialConversationId =
    typeof params.conversation === 'string' ? params.conversation : null;
  const initialDraftMessage =
    typeof params.draft === 'string' ? params.draft.slice(0, 2000) : null;
  const conversations = await listChatConversationsForUser(userId, {
    includeEmpty: Boolean(initialConversationId),
  });

  return (
    <ChatPageClient
      currentUserName={
        currentUser.name?.trim() ||
        currentUser.email.split('@')[0] ||
        'User'
      }
      initialConversations={conversations}
      initialConversationId={initialConversationId}
      initialDraftMessage={initialDraftMessage}
    />
  );
}
