"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { Menu } from "@base-ui/react/menu"
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { cn } from "@/lib/utils"
import { chatKeys, removeChatById, renameChat } from "@/lib/api/chats"
import type { Chat } from "@/lib/db/types"

interface ChatItemProps {
  chat: Chat
}

export function ChatItem({ chat }: ChatItemProps) {
  const pathname = usePathname()
  const router = useRouter()
  const queryClient = useQueryClient()
  const isActive = pathname === `/c/${chat.id}`

  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(chat.title ?? "New Chat")
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus()
      inputRef.current?.select()
    }
  }, [isRenaming])

  const renameMutation = useMutation({
    mutationFn: (title: string) => renameChat(chat.id, title),
    // Optimistically update the sidebar cache so the new title shows instantly,
    // without waiting for the server round-trip.
    onMutate: async (title) => {
      await queryClient.cancelQueries({ queryKey: chatKeys.list() })
      const previous = queryClient.getQueryData<Chat[]>(chatKeys.list())
      queryClient.setQueryData<Chat[]>(chatKeys.list(), (old) =>
        old?.map((c) => (c.id === chat.id ? { ...c, title } : c)),
      )
      return { previous }
    },
    onError: (_err, _title, context) => {
      if (context?.previous) {
        queryClient.setQueryData(chatKeys.list(), context.previous)
      }
      toast.error("Couldn't rename chat", { description: "Please try again." })
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: () => removeChatById(chat.id),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: chatKeys.list() })
      const previous = queryClient.getQueryData<Chat[]>(chatKeys.list())
      queryClient.setQueryData<Chat[]>(chatKeys.list(), (old) =>
        old?.filter((c) => c.id !== chat.id),
      )
      return { previous }
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        queryClient.setQueryData(chatKeys.list(), context.previous)
      }
      toast.error("Couldn't delete chat", { description: "Please try again." })
    },
    onSuccess: () => {
      if (isActive) router.push("/")
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: chatKeys.list() })
    },
  })

  function submitRename() {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== (chat.title ?? "New Chat")) {
      renameMutation.mutate(trimmed)
    }
    setIsRenaming(false)
  }

  if (isRenaming) {
    return (
      <div className="px-2 py-0.5">
        <input
          ref={inputRef}
          className="w-full rounded-md bg-background px-2 py-1 text-sm ring-1 ring-ring outline-none"
          value={renameValue}
          onChange={(e) => setRenameValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") submitRename()
            if (e.key === "Escape") setIsRenaming(false)
          }}
          onBlur={submitRename}
        />
      </div>
    )
  }

  return (
    <div
      className={cn(
        "group/item flex items-center gap-0.5 rounded-md px-2 transition-colors hover:bg-sidebar-accent",
        isActive && "bg-sidebar-accent",
      )}
    >
      <Link
        href={`/c/${chat.id}`}
        className="flex-1 truncate py-1.5 text-sm text-sidebar-foreground"
      >
        {chat.title ?? "New Chat"}
      </Link>

      <Menu.Root>
        <Menu.Trigger
          className={cn(
            "flex size-6 shrink-0 items-center justify-center rounded text-sidebar-foreground/50 opacity-0 transition-opacity hover:text-sidebar-foreground group-hover/item:opacity-100 focus-visible:opacity-100",
            isActive && "opacity-100",
          )}
          aria-label="Chat options"
        >
          <MoreHorizontal className="size-3.5" />
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner sideOffset={4} align="start">
            <Menu.Popup className="z-50 min-w-36 overflow-hidden rounded-md border bg-popover p-1 text-popover-foreground shadow-md data-[ending-style]:animate-out data-[starting-style]:animate-in data-[ending-style]:fade-out-0 data-[starting-style]:fade-in-0 data-[ending-style]:zoom-out-95 data-[starting-style]:zoom-in-95">
              <Menu.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm outline-none data-[highlighted]:bg-accent data-[highlighted]:text-accent-foreground"
                onClick={() => {
                  setRenameValue(chat.title ?? "New Chat")
                  setIsRenaming(true)
                }}
              >
                <Pencil className="size-3.5" />
                Rename
              </Menu.Item>
              <Menu.Item
                className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm text-destructive outline-none data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive"
                onClick={() => deleteMutation.mutate()}
                disabled={deleteMutation.isPending}
              >
                <Trash2 className="size-3.5" />
                {deleteMutation.isPending ? "Deleting…" : "Delete"}
              </Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </div>
  )
}
