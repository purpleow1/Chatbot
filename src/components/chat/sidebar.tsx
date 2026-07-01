"use client"

import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Menu } from "@base-ui/react/menu"
import { ChevronUp, LogOut, MessageSquarePlus, Sparkles, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { chatKeys, createChat, fetchChats } from "@/lib/api/chats"
import { signOut } from "@/app/actions/auth"
import { ChatItem } from "./chat-item"
import { useAuth } from "@/providers/auth-provider"
import { useUpgrade } from "./upgrade"

interface SidebarProps {
  onClose: () => void
  onToggleCollapse: () => void
}

export function Sidebar({ onClose }: SidebarProps) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { user } = useAuth()
  const { openUpgrade } = useUpgrade()

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
        <div className="shrink-0 border-t border-sidebar-border p-2">
          {user.is_anonymous ? (
            /* Anonymous visitors get a sign-up prompt, not an account menu. */
            <button
              type="button"
              onClick={openUpgrade}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring"
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-sidebar-primary-foreground">
                <Sparkles className="size-3" />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-xs font-medium text-sidebar-foreground">
                  Sign up
                </span>
                <span className="truncate text-[10px] text-sidebar-foreground/50">
                  Save your chats & remove limits
                </span>
              </span>
            </button>
          ) : (
            <Menu.Root>
              <Menu.Trigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sidebar-ring">
                {/* Avatar */}
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-sidebar-primary text-[10px] font-medium text-sidebar-primary-foreground">
                  {(user.email ?? user.user_metadata?.name ?? "U")
                    .charAt(0)
                    .toUpperCase()}
                </span>
                <span className="flex-1 truncate text-xs text-sidebar-foreground">
                  {user.email ?? user.user_metadata?.name ?? "User"}
                </span>
                <ChevronUp className="size-3.5 shrink-0 text-sidebar-foreground/50" />
              </Menu.Trigger>

              <Menu.Portal>
                <Menu.Positioner side="top" sideOffset={6} align="start" alignOffset={0}>
                  <Menu.Popup className="z-50 w-56 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0 data-[ending-style]:zoom-out-95 data-[starting-style]:zoom-in-95">
                    <Menu.Item
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                      onClick={() => signOut()}
                    >
                      <LogOut className="size-3.5" />
                      Log out
                    </Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          )}
        </div>
      )}
    </div>
  )
}
