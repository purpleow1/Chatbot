"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { MessageSquarePlus, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { chatKeys, createChat, fetchChats } from "@/lib/api/chats"
import { ChatItem } from "./chat-item"
import { useAuth } from "@/providers/auth-provider"

interface SidebarProps {
  onClose: () => void
  onToggleCollapse: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()

  const { data: chats, isLoading, isError } = useQuery({
    queryKey: chatKeys.list(),
    queryFn: fetchChats,
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: createChat,
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
      router.push(`/c/${newChat.id}`)
      onClose()
    },
  })

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <span className="text-sm font-semibold">Chats</span>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => createMutation.mutate(undefined)}
            disabled={createMutation.isPending}
            aria-label="New chat"
          >
            <MessageSquarePlus className="size-4" />
          </Button>
          {/* Close button — only useful on mobile */}
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Close sidebar"
            className="lg:hidden"
          >
            <X className="size-4" />
          </Button>
        </div>
      </div>

      {/* Chat list */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        {isLoading && (
          <div className="space-y-1 px-2 py-1">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-7 w-full rounded-md" />
            ))}
          </div>
        )}

        {isError && (
          <p className="px-4 py-3 text-xs text-destructive">
            Failed to load chats.
          </p>
        )}

        {!isLoading && !isError && chats?.length === 0 && (
          <p className="px-2 py-3 text-xs text-sidebar-foreground/50">
            No chats yet. Start a new one!
          </p>
        )}

        {chats?.map((chat) => (
          <ChatItem key={chat.id} chat={chat} />
        ))}
      </nav>

      {/* Footer */}
      {user && (
        <div className="shrink-0 border-t border-sidebar-border px-3 py-2">
          <p className="truncate text-xs text-sidebar-foreground/50">
            {user.is_anonymous
              ? "Anonymous"
              : (user.email ?? user.user_metadata?.name ?? "User")}
          </p>
        </div>
      )}
    </div>
  )
}
