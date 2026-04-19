'use client';

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  Loader2,
  MessageCircle,
  Plus,
  RefreshCw,
  SendHorizontal,
  Smile,
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
  initialDraftMessage?: string | null;
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

function toDayMarkerLabel(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfMessageDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayDiff = Math.round(
    (startOfToday.getTime() - startOfMessageDay.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (dayDiff === 0) {
    return 'Today';
  }

  if (dayDiff === 1) {
    return 'Yesterday';
  }

  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: now.getFullYear() === date.getFullYear() ? undefined : 'numeric',
  });
}

function isSameCalendarDay(first: string, second: string) {
  const firstDate = new Date(first);
  const secondDate = new Date(second);

  if (Number.isNaN(firstDate.getTime()) || Number.isNaN(secondDate.getTime())) {
    return false;
  }

  return (
    firstDate.getFullYear() === secondDate.getFullYear() &&
    firstDate.getMonth() === secondDate.getMonth() &&
    firstDate.getDate() === secondDate.getDate()
  );
}

function getInitials(name: string) {
  const segments = name
    .split(' ')
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 2);

  if (segments.length === 0) {
    return 'U';
  }

  return segments.map((segment) => segment[0]?.toUpperCase() ?? '').join('');
}

function isLikelyOnline(lastMessageAt: string | null) {
  if (!lastMessageAt) {
    return false;
  }

  const value = new Date(lastMessageAt).getTime();
  if (!Number.isFinite(value)) {
    return false;
  }

  return Date.now() - value <= 20 * 60 * 1000;
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
  initialDraftMessage,
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
  const [hasAppliedInitialDraft, setHasAppliedInitialDraft] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingOlder, setIsLoadingOlder] = useState(false);
  const [isRefreshingConversations, setIsRefreshingConversations] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);

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
  const peerLikelyOnline = useMemo(
    () => isLikelyOnline(activeConversation?.lastMessageAt ?? null),
    [activeConversation?.lastMessageAt]
  );
  const listingContextTitle = activeConversation?.post?.title?.trim() || 'Direct conversation';

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
      return;
    }

    router.push('/');
  };

  const openProfile = useCallback(
    (userId: string | null | undefined) => {
      if (!userId) {
        return;
      }

      router.push(`/profile/${encodeURIComponent(userId)}`);
    },
    [router]
  );

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
    const draft = initialDraftMessage?.trim();

    if (hasAppliedInitialDraft) {
      return;
    }

    if (!draft) {
      setHasAppliedInitialDraft(true);
      return;
    }

    if (!activeConversationId) {
      return;
    }

    if (initialConversationId && activeConversationId !== initialConversationId) {
      return;
    }

    setDraftMessage(draft);
    setHasAppliedInitialDraft(true);
  }, [
    activeConversationId,
    hasAppliedInitialDraft,
    initialConversationId,
    initialDraftMessage,
  ]);

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
    if (!activeConversationId || isSendingRef.current || isSending) {
      return;
    }

    const content = draftMessage.trim();
    if (!content) {
      return;
    }

    isSendingRef.current = true;
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
      isSendingRef.current = false;
    }
  };

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-foreground">
      <div className="mx-auto w-full max-w-[1280px] px-3 py-4 sm:px-6 sm:py-6">
        <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl border border-[#dfe6e1] bg-white/90 px-4 py-3 shadow-[0_8px_24px_-22px_rgba(0,0,0,0.45)] backdrop-blur-sm sm:px-5">
          <div className="flex min-w-0 items-center gap-3">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="h-9 rounded-full px-3 text-muted-foreground hover:bg-[#eef3ef] hover:text-foreground"
            >
              <ArrowLeft className="mr-1.5 h-4 w-4" />
              Back
            </Button>

            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight sm:text-2xl">Messages</h1>
              <p className="truncate text-xs text-muted-foreground sm:text-sm">
                Signed in as {currentUserName}
              </p>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadConversations(true)}
            disabled={isRefreshingConversations}
            className="gap-2 border-[#d3ddd7] bg-white hover:bg-[#f3f6f4]"
          >
            {isRefreshingConversations ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            Refresh
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[330px_minmax(0,1fr)]">
          <aside className="overflow-hidden rounded-3xl border border-[#dfe6e1] bg-white shadow-[0_20px_50px_-44px_rgba(0,0,0,0.6)]">
            <div className="border-b border-[#e4ebe6] px-4 py-3">
              <h2 className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Conversations
              </h2>
            </div>

            <div className="max-h-[72vh] overflow-y-auto px-2 py-2">
              {conversations.length === 0 ? (
                <div className="m-2 flex flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[#d3ddd7] bg-[#f8faf8] p-6 text-center text-sm text-muted-foreground">
                  <MessageCircle className="h-5 w-5" />
                  No conversations yet.
                </div>
              ) : (
                conversations.map((conversation) => {
                  const active = activeConversationId === conversation.id;
                  const peerName = conversation.peer.name || 'User';

                  return (
                    <button
                      key={conversation.id}
                      type="button"
                      onClick={() => openConversation(conversation.id)}
                      className={cn(
                        'mb-2 w-full rounded-2xl border p-3 text-left transition-all',
                        active
                          ? 'border-primary/35 bg-[#edf6f0] shadow-[0_10px_22px_-20px_rgba(0,0,0,0.5)]'
                          : 'border-[#e4ebe6] bg-white hover:border-primary/20 hover:bg-[#f5f8f6]'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className="relative mt-0.5 h-11 w-11 shrink-0 overflow-hidden rounded-full border border-[#d9e4de] bg-[#e7efe9]"
                          role={conversation.peer.id ? 'link' : undefined}
                          tabIndex={conversation.peer.id ? 0 : undefined}
                          onClick={(event) => {
                            event.stopPropagation();
                            openProfile(conversation.peer.id);
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault();
                              event.stopPropagation();
                              openProfile(conversation.peer.id);
                            }
                          }}
                          aria-label={
                            conversation.peer.id
                              ? `View ${peerName} profile`
                              : undefined
                          }
                        >
                          {conversation.peer.avatarUrl ? (
                            <img
                              src={conversation.peer.avatarUrl}
                              alt={peerName}
                              className="h-full w-full object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary">
                              {getInitials(peerName)}
                            </span>
                          )}
                          {conversation.unreadCount > 0 ? (
                            <span className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-white bg-primary" />
                          ) : null}
                        </div>

                        <div className="min-w-0 flex-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">{peerName}</p>
                            <span className="shrink-0 text-[11px] text-muted-foreground">
                              {toConversationTimestamp(conversation.lastMessageAt)}
                            </span>
                          </div>

                          <p className="mt-0.5 truncate text-[11px] font-medium text-muted-foreground">
                            {conversation.post ? conversation.post.title : 'Direct chat'}
                          </p>

                          <div className="mt-1.5 flex items-center justify-between gap-2">
                            <p className="truncate text-xs text-muted-foreground">
                              {getConversationPreview(conversation)}
                            </p>
                            {conversation.unreadCount > 0 ? (
                              <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                                {conversation.unreadCount}
                              </span>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </aside>

          <section className="flex min-h-[72vh] flex-col overflow-hidden rounded-3xl border border-[#dfe6e1] bg-white shadow-[0_20px_50px_-40px_rgba(0,0,0,0.55)]">
            {!activeConversation ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted-foreground">
                <MessageCircle className="h-7 w-7" />
                Select a conversation to start chatting.
              </div>
            ) : (
              <>
                <header className="border-b border-[#e4ebe6] bg-white/95">
                  <div className="flex items-center gap-3 px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <button
                        type="button"
                        onClick={() => openProfile(activeConversation.peer.id)}
                        className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full border border-[#d9e4de] bg-[#e7efe9] transition-transform hover:scale-[1.03]"
                        aria-label={`View ${activeConversation.peer.name || 'user'} profile`}
                      >
                        {activeConversation.peer.avatarUrl ? (
                          <img
                            src={activeConversation.peer.avatarUrl}
                            alt={activeConversation.peer.name}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-semibold text-primary">
                            {getInitials(activeConversation.peer.name || 'User')}
                          </span>
                        )}
                        <span
                          className={cn(
                            'absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-white',
                            peerLikelyOnline ? 'bg-emerald-500' : 'bg-zinc-400'
                          )}
                        />
                      </button>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground sm:text-base">
                          {activeConversation.peer.name}
                        </p>
                        <p className="truncate text-[11px] font-semibold uppercase tracking-[0.14em] text-emerald-600">
                          {peerLikelyOnline
                            ? 'Online now'
                            : `Last seen ${
                                toConversationTimestamp(activeConversation.lastMessageAt) || 'recently'
                              }`}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-3 border-t border-[#e9efeb] bg-[#f4f7f4] px-4 py-3 sm:px-5">
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#dfe9e2] text-primary">
                        <MessageCircle className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {listingContextTitle}
                        </p>
                        <p className="text-xs font-medium text-primary">
                          {activeConversation.post ? 'Listing chat' : 'Direct chat'}
                        </p>
                      </div>
                    </div>

                    <span className="shrink-0 rounded-full bg-[#fdd04f] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-[#5f4300]">
                      Verified
                    </span>
                  </div>
                </header>

                <div ref={messagesContainerRef} className="flex-1 overflow-y-auto bg-[#f6f8f6] px-3 py-4 sm:px-4">
                  <div className="mx-auto w-full max-w-3xl space-y-3">
                    {activeMessagesPage?.hasMore ? (
                      <div className="flex justify-center pb-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void handleLoadOlderMessages()}
                          disabled={isLoadingOlder}
                          className="rounded-full border-[#d6dfd9] bg-white"
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
                      <div className="rounded-2xl border border-dashed border-[#d3ddd7] bg-white/80 p-6 text-center text-sm text-muted-foreground">
                        No messages yet. Say hello to start the conversation.
                      </div>
                    ) : (
                      activeMessages.map((message, index) => {
                        const previousMessage = activeMessages[index - 1];
                        const shouldShowDayMarker =
                          !previousMessage ||
                          !isSameCalendarDay(previousMessage.createdAt, message.createdAt);

                        return (
                          <Fragment key={message.id}>
                            {shouldShowDayMarker ? (
                              <div className="flex justify-center py-1">
                                <span className="rounded-full bg-[#e8ece8] px-3 py-1 text-[11px] font-semibold text-muted-foreground">
                                  {toDayMarkerLabel(message.createdAt)}
                                </span>
                              </div>
                            ) : null}

                            <div
                              className={cn(
                                'flex items-end gap-2',
                                message.mine ? 'justify-end' : 'justify-start'
                              )}
                            >
                              {!message.mine ? (
                                <button
                                  type="button"
                                  onClick={() => openProfile(message.senderId)}
                                  className="mb-5 h-8 w-8 shrink-0 overflow-hidden rounded-full border border-[#d9e4de] bg-[#e7efe9]"
                                  aria-label={`View ${message.senderName || 'user'} profile`}
                                >
                                  {message.senderAvatarUrl ? (
                                    <img
                                      src={message.senderAvatarUrl}
                                      alt={message.senderName}
                                      className="h-full w-full object-cover"
                                    />
                                  ) : (
                                    <span className="flex h-full w-full items-center justify-center text-[10px] font-semibold text-primary">
                                      {getInitials(message.senderName || 'User')}
                                    </span>
                                  )}
                                </button>
                              ) : null}

                              <div
                                className={cn(
                                  'max-w-[86%] rounded-2xl px-4 py-3 shadow-sm',
                                  message.mine
                                    ? 'rounded-br-md bg-gradient-to-br from-primary to-[#1a5f3d] text-white'
                                    : 'rounded-bl-md border border-[#e2e8e4] bg-white text-foreground'
                                )}
                              >
                                {!message.mine ? (
                                  <p className="mb-1 text-[11px] font-semibold text-primary">
                                    {message.senderName}
                                  </p>
                                ) : null}

                                <p
                                  className={cn(
                                    'whitespace-pre-wrap break-words text-sm leading-relaxed',
                                    message.mine ? 'text-white' : 'text-foreground'
                                  )}
                                >
                                  {message.content || (message.imageUrl ? 'Image message' : '')}
                                </p>

                                <p
                                  className={cn(
                                    'mt-1 text-right text-[11px]',
                                    message.mine ? 'text-white/80' : 'text-muted-foreground'
                                  )}
                                >
                                  {toReadableTime(message.createdAt)}
                                </p>
                              </div>
                            </div>
                          </Fragment>
                        );
                      })
                    )}
                  </div>
                </div>

                <form
                  className="border-t border-[#e4ebe6] bg-white px-3 py-3 sm:px-4 sm:py-4"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void handleSendMessage();
                  }}
                >
                  <div className="flex items-end gap-2">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-11 w-11 shrink-0 rounded-full bg-[#eef3ef] text-muted-foreground hover:bg-[#e3ebe5]"
                    >
                      <Plus className="h-5 w-5" />
                    </Button>

                    <div className="flex min-h-11 flex-1 items-end gap-2 rounded-[999px] border border-[#e1e8e3] bg-[#f3f5f3] px-3 py-1.5">
                      <Textarea
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        placeholder="Type your message..."
                        className="min-h-[38px] max-h-28 flex-1 resize-none border-0 bg-transparent px-0 py-1 text-sm shadow-none focus-visible:ring-0"
                        maxLength={2000}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault();
                            void handleSendMessage();
                          }
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 shrink-0 rounded-full text-muted-foreground hover:bg-[#e8eee9]"
                      >
                        <Smile className="h-4 w-4" />
                      </Button>
                    </div>

                    <Button
                      type="submit"
                      disabled={isSending || draftMessage.trim().length === 0}
                      className="h-11 w-11 shrink-0 rounded-full p-0"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <SendHorizontal className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  <p className="mt-2 px-1 text-[11px] text-muted-foreground">{draftMessage.length}/2000</p>
                </form>
              </>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
