"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useChat } from "@ai-sdk/react"
import { DefaultChatTransport } from "ai"
import { ArrowUp, Square } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { chatKeys } from "@/lib/api/chats"
import { fetchMessages, messageKeys, toUIMessage } from "@/lib/api/messages"
import { MessageBubble, TypingIndicator } from "./message-bubble"

export function ChatView({ chatId }: { chatId: string }) {
  const {
    data: initialMessages,
    isPending,
    isError,
  } = useQuery({
    queryKey: messageKeys.list(chatId),
    queryFn: () => fetchMessages(chatId),
    // History is loaded once per chat; live updates come from useChat itself.
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

function Conversation({
  chatId,
  initialMessages,
}: {
  chatId: string
  initialMessages: ReturnType<typeof toUIMessage>[]
}) {
  const queryClient = useQueryClient()
  const [input, setInput] = useState("")

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: { chatId },
      }),
    [chatId],
  )

  const { messages, sendMessage, status, stop, error } = useChat({
    id: chatId,
    messages: initialMessages,
    transport,
    onFinish: () => {
      // Auto-title + updated_at changed server-side — refresh the sidebar.
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
    },
  })

  const isBusy = status === "submitted" || status === "streaming"
  const lastMessage = messages[messages.length - 1]
  const awaitingReply = status === "submitted" || (status === "streaming" && lastMessage?.role === "user")

  const bottomRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, awaitingReply])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const text = input.trim()
    if (!text || isBusy) return
    sendMessage({ text })
    setInput("")
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e)
    }
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 p-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-1 pt-24 text-center">
              <p className="text-sm text-muted-foreground">
                Send a message to start the conversation.
              </p>
            </div>
          )}

          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}

          {awaitingReply && <TypingIndicator />}

          {error && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-sm text-destructive">
              Something went wrong generating a response. Please try again.
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t bg-background">
        <form
          onSubmit={handleSubmit}
          className="mx-auto flex w-full max-w-3xl items-end gap-2 p-4"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Message the assistant…"
            className={cn(
              "flex-1 resize-none rounded-2xl border bg-background px-4 py-2.5 text-sm",
              "max-h-40 min-h-[44px] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
            )}
          />
          {isBusy ? (
            <Button
              type="button"
              size="icon"
              variant="secondary"
              onClick={() => stop()}
              aria-label="Stop generating"
              className="size-11 shrink-0 rounded-full"
            >
              <Square className="size-4" />
            </Button>
          ) : (
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim()}
              aria-label="Send message"
              className="size-11 shrink-0 rounded-full"
            >
              <ArrowUp className="size-4" />
            </Button>
          )}
        </form>
      </div>
    </div>
  )
}
