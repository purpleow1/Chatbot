"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Dialog } from "@base-ui/react/dialog"
import { Menu } from "@base-ui/react/menu"
import {
  ChevronUp,
  LogOut,
  Search,
  Sparkles,
  SquarePen,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  chatKeys,
  clearAllChats,
  createChat,
  fetchChats,
} from "@/lib/api/chats"
import type { Chat } from "@/lib/db/types"
import { signOut } from "@/app/actions/auth"
import { ChatItem } from "./chat-item"
import { SearchDialog } from "./search-dialog"
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

  const [searchOpen, setSearchOpen] = useState(false)
  const [clearOpen, setClearOpen] = useState(false)

  const { data: chats, isLoading, isError } = useQuery({
    queryKey: chatKeys.list(),
    queryFn: fetchChats,
    enabled: !!user,
  })

  const createMutation = useMutation({
    mutationFn: () => createChat(),
    onSuccess: (newChat) => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
      router.push(`/c/${newChat.id}`)
      onClose()
    },
    onError: () => toast.error("Couldn't start a new chat"),
  })

  const clearMutation = useMutation({
    mutationFn: clearAllChats,
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: chatKeys.list() })
      const previous = queryClient.getQueryData<Chat[]>(chatKeys.list())
      queryClient.setQueryData<Chat[]>(chatKeys.list(), [])
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(chatKeys.list(), context.previous)
      }
      toast.error("Couldn't clear chats", { description: "Please try again." })
    },
    onSuccess: () => {
      toast.success("All chats cleared")
      router.push("/")
    },
    onSettled: () => {
      setClearOpen(false)
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
    },
  })

  const hasChats = (chats?.length ?? 0) > 0

  return (
    <div className="flex h-full w-64 flex-col bg-sidebar text-sidebar-foreground">
      {/* Header */}
      <div className="flex h-12 shrink-0 items-center justify-between px-3">
        <span className="text-sm font-semibold">Chatbot</span>
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

      {/* Primary actions */}
      <div className="space-y-0.5 px-2 pb-2">
        <button
          type="button"
          onClick={() => createMutation.mutate()}
          disabled={createMutation.isPending}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none disabled:opacity-50"
        >
          <SquarePen className="size-4 shrink-0" />
          New chat
        </button>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="flex w-full items-center gap-2.5 rounded-md px-2 py-2 text-left text-sm font-medium transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
        >
          <Search className="size-4 shrink-0" />
          Search chats
        </button>
      </div>

      {/* Chat list */}
      <nav className="flex-1 overflow-y-auto px-2 py-1">
        <div className="flex items-center justify-between px-2 pb-1">
          <span className="text-xs font-medium text-sidebar-foreground/50">
            Chats
          </span>
          {hasChats && (
            <button
              type="button"
              onClick={() => setClearOpen(true)}
              className="flex items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-sidebar-foreground/50 transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
            >
              <Trash2 className="size-3" />
              Clear
            </button>
          )}
        </div>

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

        {!isLoading && !isError && !hasChats && (
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
            <button
              type="button"
              onClick={openUpgrade}
              className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none"
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
              <Menu.Trigger className="flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-sidebar-accent focus-visible:ring-2 focus-visible:ring-sidebar-ring focus-visible:outline-none">
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

      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />

      {/* Clear-all confirmation */}
      <Dialog.Root open={clearOpen} onOpenChange={setClearOpen}>
        <Dialog.Portal>
          <Dialog.Backdrop className="fixed inset-0 z-50 bg-black/50 data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0" />
          <Dialog.Popup className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-xl border bg-card p-6 text-card-foreground shadow-lg data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0 data-[ending-style]:zoom-out-95 data-[starting-style]:zoom-in-95">
            <Dialog.Title className="text-lg font-semibold">
              Clear all chats?
            </Dialog.Title>
            <Dialog.Description className="mt-1.5 text-sm text-muted-foreground">
              This permanently deletes every conversation and its messages. This
              can&apos;t be undone.
            </Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setClearOpen(false)}
                disabled={clearMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => clearMutation.mutate()}
                disabled={clearMutation.isPending}
              >
                {clearMutation.isPending ? "Clearing…" : "Clear all"}
              </Button>
            </div>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
