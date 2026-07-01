import type { UploadResult } from "@/lib/api/uploads";

/**
 * A composer draft handed off from the home screen to a freshly-created chat
 * when the user attaches a document before any chat exists (Option A: eager
 * chat creation). Unlike `PendingMessage`, this is NOT auto-sent — the chat
 * view restores it into the composer so the user keeps composing while the
 * attached documents upload/ingest in the background.
 *
 * `documentFiles` are raw Files (uploaded once the chat view mounts).
 * `imageAttachments` are already-uploaded image results carried over so an
 * in-progress image attachment isn't lost during the handoff.
 */
export interface PendingDraft {
  text: string;
  imageAttachments: UploadResult[];
  documentFiles: File[];
}

const store = new Map<string, PendingDraft>();

export function setPendingDraft(chatId: string, draft: PendingDraft) {
  store.set(chatId, draft);
}

/** Read a draft without removing it (safe under React Strict Mode double-render). */
export function peekPendingDraft(chatId: string): PendingDraft | undefined {
  return store.get(chatId);
}

/** Remove a consumed draft; call once from an effect after reading it. */
export function consumePendingDraft(chatId: string) {
  store.delete(chatId);
}
