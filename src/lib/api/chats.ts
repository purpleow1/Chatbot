import type { Chat } from "@/lib/db/types"

export const chatKeys = {
  all: ["chats"] as const,
  list: () => [...chatKeys.all, "list"] as const,
  detail: (id: string) => [...chatKeys.all, "detail", id] as const,
}

export async function fetchChats(): Promise<Chat[]> {
  const res = await fetch("/api/chats")
  if (!res.ok) throw new Error("Failed to fetch chats")
  return res.json()
}

export async function createChat(title?: string): Promise<Chat> {
  const res = await fetch("/api/chats", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to create chat")
  return res.json()
}

export async function renameChat(id: string, title: string): Promise<Chat> {
  const res = await fetch(`/api/chats/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) throw new Error("Failed to rename chat")
  return res.json()
}

export async function removeChatById(id: string): Promise<void> {
  const res = await fetch(`/api/chats/${id}`, { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to delete chat")
}

export async function clearAllChats(): Promise<void> {
  const res = await fetch("/api/chats", { method: "DELETE" })
  if (!res.ok) throw new Error("Failed to clear chats")
}
