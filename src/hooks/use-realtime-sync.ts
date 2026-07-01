"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { realtimeClient } from "@/lib/supabase/realtime";
import { chatKeys } from "@/lib/api/chats";
import { useAuth } from "@/providers/auth-provider";

/**
 * Subscribes to the per-user Supabase Realtime Broadcast channel and
 * invalidates the TanStack Query chat-list cache whenever another tab (or the
 * server) emits a chat.created / chat.updated / chat.deleted event.
 *
 * Mount this once at the chat layout level. It cleans up the channel
 * subscription on unmount or when the user changes.
 */
export function useRealtimeSync() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!user) return;

    const channel = realtimeClient
      .channel(`user:${user.id}`)
      .on("broadcast", { event: "chat.created" }, () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      })
      .on("broadcast", { event: "chat.updated" }, () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      })
      .on("broadcast", { event: "chat.deleted" }, () => {
        queryClient.invalidateQueries({ queryKey: chatKeys.list() });
      })
      .subscribe();

    return () => {
      realtimeClient.removeChannel(channel);
    };
  }, [user?.id, queryClient]);
}
