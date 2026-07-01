"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { Skeleton } from "@/components/ui/skeleton"
import { chatKeys } from "@/lib/api/chats"
import { fetchMessages, messageKeys, toUIMessage } from "@/lib/api/messages"
import { fetchUsage, usageKeys } from "@/lib/api/usage"
import { takePendingMessage } from "@/lib/pending-message"
import { consumePendingDraft, peekPendingDraft } from "@/lib/pending-draft"
import { MessageBubble, TypingIndicator } from "./message-bubble"
import { Composer, type ComposerSubmitPayload } from "./composer"
import { useUpgrade } from "./upgrade"

// ---------------------------------------------------------------------------
// ChatView (loading shell)
// ---------------------------------------------------------------------------

export function ChatView({ chatId }: { chatId: string }) {
  const {
    data: initialMessages,
    isPending,
    isError,
  } = useQuery({
    queryKey: messageKeys.list(chatId),
    queryFn: () => fetchMessages(chatId),
    staleTime: Infinity,
  })

  if (isPending) {
    return (
      <div className="mx-auto flex h-full w-full max-w-3xl flex-col gap-4 p-4">
        <Skeleton className="h-16 w-2/3" />
        <Skeleton className="ml-auto h-16 w-1/2" />
        <Skeleton className="h-24 w-3/4" />
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8 text-center text-sm text-destructive">
        Failed to load this conversation. Try refreshing the page.
      </div>
    )
  }

  return (
    <Conversation
      key={chatId}
      chatId={chatId}
      initialMessages={initialMessages.map(toUIMessage)}
    />
  )
}

// ---------------------------------------------------------------------------
// Conversation (live chat)
// ---------------------------------------------------------------------------

function Conversation({
  chatId,
  initialMessages,
}: {
  chatId: string
  initialMessages: ReturnType<typeof toUIMessage>[]
}) {
  const queryClient = useQueryClient()
  const { openUpgrade } = useUpgrade()

  // A draft handed off from the home screen when a document was attached
  // before this chat existed. Read once (peek is side-effect-free, so it's
  // safe under Strict Mode); the effect below consumes it.
  const [draft] = useState(() => peekPendingDraft(chatId))
  useEffect(() => {
    consumePendingDraft(chatId)
  }, [chatId])

  const { data: usage } = useQuery({
    queryKey: usageKeys.detail(),
    queryFn: fetchUsage,
  })

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { chatId },
      }),
    [chatId],
  )

  const { messages, sendMessage, status, stop, error, setMessages } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
      queryClient.invalidateQueries({ queryKey: usageKeys.all })
    },
    onError: (err) => {
      if (err.message.includes("message_limit_reached")) {
        queryClient.invalidateQueries({ queryKey: usageKeys.all })
        openUpgrade()
      }
    },
  })

  const send = (payload: ComposerSubmitPayload) => {
    sendMessage(
      {
        text: payload.text,
        files: payload.files.length > 0 ? payload.files : undefined,
      },
      payload.attachments.length > 0
        ? { body: { attachments: payload.attachments } }
        : undefined,
    )
  }

  // Auto-send a message composed on the home screen before this chat existed.
  const sentPendingRef = useRef(false)
  useEffect(() => {
    if (sentPendingRef.current) return
    const pending = takePendingMessage(chatId)
    if (pending && (pending.text || pending.files.length > 0)) {
      sentPendingRef.current = true
      send(pending)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatId])

  // Cross-tab sync: shares the cache with ChatView's query, so a realtime
  // broadcast that invalidates messageKeys.list(chatId) refetches here.
  const { data: syncedMessages } = useQuery({
    queryKey: messageKeys.list(chatId),
    queryFn: () => fetchMessages(chatId),
    staleTime: Infinity,
  })

  const statusRef = useRef(status)
  useEffect(() => {
    statusRef.current = status
  }, [status])

  useEffect(() => {
    if (!syncedMessages) return
    if (statusRef.current === "streaming" || statusRef.current === "submitted") {
      return
    }
    setMessages(syncedMessages.map(toUIMessage))
  }, [syncedMessages, setMessages])

  const atFreeLimit = usage?.isAnonymous === true && usage.remaining <= 0
  const isBusy = status === "submitted" || status === "streaming"
  const lastMessage = messages[messages.length - 1]
  const awaitingReply =
    status === "submitted" ||
    (status === "streaming" && lastMessage?.role === "user")

  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, awaitingReply])

  return (
    <div className="flex h-full flex-col">
      {/* Message list */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {awaitingReply && <TypingIndicator />}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              {error.message ||
                "Something went wrong generating a response. Please try again."}
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Composer */}
      <div className="bg-background">
        {atFreeLimit && (
          <div className="mx-auto w-full max-w-3xl px-4 pt-3">
            <button
              type="button"
              onClick={openUpgrade}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-center text-sm text-amber-700 transition-colors hover:bg-amber-500/15 dark:text-amber-400"
            >
              You&apos;ve used all your free messages.{" "}
              <span className="font-semibold underline underline-offset-2">
                Sign up or log in
              </span>{" "}
              to keep chatting — your history is saved.
            </button>
          </div>
        )}

        <div className="mx-auto w-full max-w-3xl px-4 pt-2 pb-4">
          <Composer
            chatId={chatId}
            onSend={send}
            isBusy={isBusy}
            onStop={stop}
            atFreeLimit={atFreeLimit}
            onBlocked={openUpgrade}
            initialText={draft?.text}
            initialImageAttachments={draft?.imageAttachments}
            initialDocumentFiles={draft?.documentFiles}
          />
          <p className="mt-2 text-center text-xs text-muted-foreground">
            The assistant can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  )
}
