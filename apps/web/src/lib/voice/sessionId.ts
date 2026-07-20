const STORAGE_KEY = "shgap.voice.sessionId.v1";

/**
 * A client-generated id persisted across page reloads — deliberately
 * *not* whatever id the WebRTC connection itself gets (aiortc mints a fresh
 * `pc_id` per connection). Reusing the same `sessionId` across reconnects
 * and across the text-chat fallback is what lets voice-service's
 * `SessionStore` treat them as one ongoing conversation (see ADR-0019).
 */
export function getOrCreateVoiceSessionId(): string {
  const existing = localStorage.getItem(STORAGE_KEY);
  if (existing) return existing;
  const id = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, id);
  return id;
}
