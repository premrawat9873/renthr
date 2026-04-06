'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  RefreshCw,
  SendHorizontal,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/hooks/use-toast';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { cn } from '@/lib/utils';
import type {
  ChatConversationPayload,
  ChatMessagePayload,
  ChatMessagesPagePayload,
} from '@/lib/chat-types';

const MESSAGES_PAGE_SIZE = 40;

type ChatPageClientProps = {
  currentUserName: string;
  initialConversations: ChatConversationPayload[];
  initialConversationId: string | null;
};

type LoadMessagesOptions = {
  cursor?: string | null;
  append?: boolean;
  silent?: boolean;
};

function toReadableTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  return date.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function toConversationTimestamp(value: string | null) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const sameDay =
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate();

  if (sameDay) {
    return date.toLocaleTimeString('en-IN', {
      hour: '2-digit',
      minute: '2-digit',
    });
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
  });
}

function getConversationPreview(conversation: ChatConversationPayload) {
  if (!conversation.lastMessage) {
    return 'No messages yet';
  }

  if (conversation.lastMessage.type === 'IMAGE') {
    return 'Sent an image';
  }

  if (conversation.lastMessage.type === 'SYSTEM') {
    return conversation.lastMessage.content || 'System message';
  }

  return conversation.lastMessage.content;
}

function mergeUniqueMessages(messages: ChatMessagePayload[]) {
  const byId = new Map<string, ChatMessagePayload>();

  for (const message of messages) {
    byId.set(message.id, message);
  }

  return Array.from(byId.values()).sort((a, b) => {
    const first = Number.parseInt(a.id, 10);
    const second = Number.parseInt(b.id, 10);
    if (!Number.isFinite(first) || !Number.isFinite(second)) {
      return a.createdAt.localeCompare(b.createdAt);
    }

    return first - second;
  });
}

export default function ChatPageClient({
  currentUserName,
  initialConversations,
  initialConversationId,
}: ChatPageClientProps) {
  const router = useRouter();
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);

  const [conversations, setConversations] = useState(initialConversations);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(
    initialConversationId ?? initialConversations[0]?.id ?? null
  );
  const [messagesByConversation, setMessagesByConversation] = useState<
    Record<string, ChatMessagesPagePayload>
  >({});
  const [draftMessage, setDraftMessage] = useState('');
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isRefreshingConversations, setIsRefreshingConversations] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const activeConversation = useMemo(
    () =>
      activeConversationId
        ? conversations.find((conversation) => conversation.id === activeConversationId) ?? null
        : null,
    [activeConversationId, conversations]
  );

  const activeMessagesPage = activeConversationId
    ? messagesByConversation[activeConversationId]
    : null;

  const activeMessages = activeMessagesPage?.messages ?? [];

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  const loadConversations = useCallback(
    async (showSpinner: boolean) => {
      if (showSpinner) {
        setIsRefreshingConversations(true);
      }

      try {
        const response = await fetch('/api/chat/conversations', {
          cache: 'no-store',
        });
        const payload = (await response.json()) as {
          conversations?: ChatConversationPayload[];
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load conversations.');
        }

        setConversations(Array.isArray(payload.conversations) ? payload.conversations : []);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load conversations.';
        toast({
          title: 'Chat sync failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        if (showSpinner) {
          setIsRefreshingConversations(false);
        }
      }
    },
    []
  );

  const loadMessages = useCallback(
    async (conversationId: string, options?: LoadMessagesOptions) => {
      const shouldAppend = Boolean(options?.append);
      const queryParams = new URLSearchParams({
        limit: String(MESSAGES_PAGE_SIZE),
      });

      if (options?.cursor) {
        queryParams.set('cursor', options.cursor);
      }

      if (!options?.silent) {
        if (shouldAppend) {
          setIsLoadingOlder(true);
        } else {
          setIsLoadingMessages(true);
        }
      }

      try {
        const response = await fetch(
          `/api/chat/conversations/${conversationId}/messages?${queryParams.toString()}`,
          {
            cache: 'no-store',
          }
        );

        const payload = (await response.json()) as ChatMessagesPagePayload & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(payload.error || 'Unable to load messages.');
        }

        setMessagesByConversation((previous) => {
          const existing = previous[conversationId];
          const mergedMessages = shouldAppend
            ? mergeUniqueMessages([...(payload.messages ?? []), ...(existing?.messages ?? [])])
            : mergeUniqueMessages(payload.messages ?? []);

          return {
            ...previous,
            [conversationId]: {
              messages: mergedMessages,
              nextCursor: payload.nextCursor,
              hasMore: payload.hasMore,
            },
          };
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unable to load messages.';
        toast({
          title: 'Message loading failed',
          description: message,
          variant: 'destructive',
        });
      } finally {
        if (!options?.silent) {
          if (shouldAppend) {
            setIsLoadingOlder(false);
          } else {
            setIsLoadingMessages(false);
          }
        }
      }
    },
    []
  );

  const markConversationRead = useCallback(async (conversationId: string) => {
    try {
      await fetch(`/api/chat/conversations/${conversationId}/read`, {
        method: 'POST',
      });
    } catch {
      // Ignore read marker failures; next sync can retry.
    }
  }, []);

  useEffect(() => {
    if (
      activeConversationId &&
      conversations.some((conversation) => conversation.id === activeConversationId)
    ) {
      return;
    }

    if (
      initialConversationId &&
      conversations.some((conversation) => conversation.id === initialConversationId)
    ) {
      setActiveConversationId(initialConversationId);
      return;
    }

    setActiveConversationId(conversations[0]?.id ?? null);
  }, [activeConversationId, conversations, initialConversationId]);

  useEffect(() => {
    if (!activeConversationId) {
      return;
    }

    let isDisposed = false;

    const syncConversation = async () => {
      await loadMessages(activeConversationId, { silent: true });
      await loadConversations(false);
      await markConversationRead(activeConversationId);
    };

    void loadMessages(activeConversationId);
    void markConversationRead(activeConversationId);

    const intervalId = window.setInterval(() => {
      if (isDisposed) {
        return;
      }

      void syncConversation();
    }, 6000);

    let removeChannel: (() => Promise<void>) | null = null;

    try {
      const supabase = getSupabaseBrowserClient();
      const channel = supabase
        .channel(`chat-conversation-${activeConversationId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'Message',
            filter: `conversationId=eq.${activeConversationId}`,
          },
          () => {
            if (isDisposed) {
              return;
            }

            void syncConversation();
          }
        )
        .subscribe();

      removeChannel = async () => {
        await supabase.removeChannel(channel);
      };
    } catch {
      // Supabase client may be unavailable in some local setups; polling still keeps chat updated.
    }

    return () => {
      isDisposed = true;
      window.clearInterval(intervalId);
      if (removeChannel) {
        void removeChannel();
      }
    };
  }, [activeConversationId, loadConversations, loadMessages, markConversationRead]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) {
      return;
    }

    container.scrollTop = container.scrollHeight;
  }, [activeConversationId, activeMessages.length]);

  const openConversation = (conversationId: string) => {
    setActiveConversationId(conversationId);
    router.replace(`/messages?conversation=${encodeURIComponent(conversationId)}`, {
      scroll: false,
    });
  };

  const handleLoadOlderMessages = async () => {
    if (!activeConversationId || !activeMessagesPage?.nextCursor || isLoadingOlder) {
      return;
    }

    await loadMessages(activeConversationId, {
      append: true,
      cursor: activeMessagesPage.nextCursor,
    });
  };

  const handleSendMessage = async () => {
    if (!activeConversationId || isSending) {
      return;
    }

    const content = draftMessage.trim();
    if (!content) {
      return;
    }

    setIsSending(true);

    try {
      const response = await fetch(
        `/api/chat/conversations/${activeConversationId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ content }),
        }
      );

      const payload = (await response.json()) as {
        message?: ChatMessagePayload;
        error?: string;
      };

      if (!response.ok || !payload.message) {
        throw new Error(payload.error || 'Unable to send message.');
      }

      setDraftMessage('');
      setMessagesByConversation((previous) => {
        const existing = previous[activeConversationId] ?? {
          messages: [],
          nextCursor: null,
          hasMore: false,
        };

        return {
          ...previous,
          [activeConversationId]: {
            ...existing,
            messages: mergeUniqueMessages([...existing.messages, payload.message]),
          },
        };
      });

      await markConversationRead(activeConversationId);
      await loadConversations(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to send message.';
      toast({
        title: 'Send failed',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setIsSending(false);
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>

            <div>
              <h1 className="text-2xl font-semibold tracking-tight">Messages</h1>
              <p className="text-sm text-muted-foreground">
                Signed in as {currentUserName}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadConversations(true)}
            disabled={isRefreshingConversations}
            className="gap-2"
          >
            {isRefreshingConversations ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <aside className="overflow-hidden rounded-2xl border border-border/60 bg-card">
            <div className="border-b border-border/60 px-4 py-3">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Conversations
              </h2>
            </div>

            <div className="max-h-[70vh] overflow-y-auto p-2">
              {conversations.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border/70 p-6 text-center text-sm text-muted-foreground">
                  <MessageCircle className="h-5 w-5" />
                  No conversations yet.
                </div>
              ) : (
                conversations.map((conversation) => (
                  <button
                    key={conversation.id}
                    type="button"
                    onClick={() => openConversation(conversation.id)}
                    className={cn(
                      'mb-2 w-full rounded-xl border px-3 py-3 text-left transition-colors',
                      activeConversationId === conversation.id
                        ? 'border-primary/50 bg-primary/5'
                        : 'border-border/50 hover:bg-accent/40'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {conversation.peer.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {conversation.post ? `Listing: ${conversation.post.title}` : 'Direct chat'}
                        </p>
                      </div>

                      <div className="flex shrink-0 flex-col items-end gap-1">
                        <span className="text-[11px] text-muted-foreground">
                          {toConversationTimestamp(conversation.lastMessageAt)}
                        </span>
                        {conversation.unreadCount > 0 ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground">
                            {conversation.unreadCount}
                          </span>
                        ) : null}
                      </div>
                    </div>

                    <p className="mt-2 truncate text-xs text-muted-foreground">
                      {getConversationPreview(conversation)}
                    </p>
                  </button>
                ))
              )}
            </div>
          </aside>

          <section className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl border border-border/60 bg-card">
            {!activeConversation ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                <MessageCircle className="h-7 w-7" />
                Select a conversation to start chatting.
              </div>
            ) : (
              <>
                <header className="border-b border-border/60 px-4 py-3">
                  <p className="text-sm font-semibold text-foreground">
                    {activeConversation.peer.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {activeConversation.post
                      ? `About ${activeConversation.post.title}`
                      : 'Direct conversation'}
                  </p>
                </header>

                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-muted/10 p-4">
                  <div className="mx-auto w-full max-w-2xl space-y-3">
                    {activeMessagesPage?.hasMore ? (
                      <div className="flex justify-center pb-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleLoadOlderMessages()}
                          disabled={isLoadingOlder}
                        >
                          {isLoadingOlder ? (
                            <>
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              Loading...
                            </>
                          ) : (
                            'Load older messages'
                          )}
                        </Button>
                      </div>
                    ) : null}

                    {isLoadingMessages ? (
                      <div className="flex items-center justify-center py-8 text-muted-foreground">
                        <Loader2 className="h-5 w-5 animate-spin" />
                      </div>
                    ) : activeMessages.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border/70 bg-background/70 p-6 text-center text-sm text-muted-foreground">
                        No messages yet. Say hello to start the conversation.
                      </div>
                    ) : (
                      activeMessages.map((message) => (
                        <div
                          key={message.id}
                          className={cn(
                            'flex',
                            message.mine ? 'justify-end' : 'justify-start'
                          )}
                        >
                          <div
                            className={cn(
                              'max-w-[82%] rounded-2xl border px-3 py-2',
                              message.mine
                                ? 'border-primary/30 bg-primary text-primary-foreground'
                                : 'border-border/60 bg-background'
                            )}
                          >
                            {!message.mine ? (
                              <p className="mb-1 text-[11px] font-semibold text-primary">
                                {message.senderName}
                              </p>
                            ) : null}

                            <p
                              className={cn(
                                'whitespace-pre-wrap break-words text-sm',
                                message.mine
                                  ? 'text-primary-foreground'
                                  : 'text-foreground'
                              )}
                            >
                              {message.content || (message.imageUrl ? 'Image message' : '')}
                            </p>

                            <p
                              className={cn(
                                'mt-1 text-right text-[11px]',
                                message.mine
                                  ? 'text-primary-foreground/85'
                                  : 'text-muted-foreground'
                              )}
                            >
                              {toReadableTime(message.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>

                <form
                  className="border-t border-border/60 p-3"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSendMessage();
                  }}
                >
                  <Textarea
                    value={draftMessage}
                    onChange={(event) => setDraftMessage(event.target.value)}
                    placeholder="Type your message..."
                    className="min-h-[74px] resize-y"
                    maxLength={2000}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                  />
                  <div className="mt-2 flex items-center justify-between">
                    <p className="text-xs text-muted-foreground">
                      {draftMessage.length}/2000
                    </p>
                    <Button
                      type="submit"
                      disabled={isSending || draftMessage.trim().length === 0}
                      className="gap-2"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SendHorizontal className="h-4 w-4" />
                      )}
                      Send
                    </Button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>

        <p className="mt-4 text-xs text-muted-foreground">
          Real-time updates are powered by Supabase Realtime with polling fallback.
        </p>
      </div>
    </main>
  );
}
