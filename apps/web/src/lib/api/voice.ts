// Same-origin `/voice-api` — proxied to voice-service by Vite (see
// vite.config.ts), mirroring how `/api` is proxied to core-api in
// httpClient.ts. voice-service's endpoints take the caller's access token
// as a JSON field (`accessToken`), not an Authorization header — it forwards
// that token to core-api itself per-tool-call (see ADR-0019/ADR-0021), so
// there's no bearer header to attach here.
export const VOICE_API_BASE: string =
  (import.meta.env.VITE_VOICE_API_BASE_URL as string | undefined) ?? "/voice-api";

export interface ToolResult {
  tool: string;
  result: Record<string, unknown>;
}

export interface TextMessageResponse {
  reply: string;
  tool_results: ToolResult[];
}

async function voiceFetch<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${VOICE_API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  const data = text ? (JSON.parse(text) as unknown) : undefined;
  if (!res.ok) {
    const message =
      (data as { detail?: string } | undefined)?.detail ?? res.statusText ?? "Request failed";
    throw new Error(message);
  }
  return data as T;
}

/** Text-input fallback (T12) — same session, tools and system prompt as the live voice call. */
export function sendTextMessage(
  sessionId: string,
  message: string,
  accessToken: string,
  language: "te" | "en",
): Promise<TextMessageResponse> {
  return voiceFetch<TextMessageResponse>(`/sessions/${sessionId}/message`, {
    message,
    accessToken,
    language,
  });
}

/** Normalizes Romanized/mixed-script Telugu text before it's sent as a chat message (T11/ADR-0020). */
export async function transliterate(text: string): Promise<string> {
  const { text: normalized } = await voiceFetch<{ text: string }>("/transliterate", { text });
  return normalized;
}

/**
 * One-shot batch transcription for a fully-recorded clip (the floating chat
 * widget's long-press voice messages) — as opposed to the live WebRTC call
 * VoiceAssistantPage uses. Multipart, not JSON, so this doesn't go through
 * `voiceFetch`. Returns an empty string (never throws) on failure so a
 * transcription hiccup falls back to the widget's plain duration bubble
 * instead of breaking the send. `blob` is a WAV clip encoded client-side
 * (see FloatingChatWidget's encodeWavBlob) — not the WebM/Opus a bare
 * MediaRecorder would have produced.
 */
export async function transcribeAudio(blob: Blob): Promise<string> {
  try {
    const form = new FormData();
    form.append("file", blob, "recording.wav");
    const res = await fetch(`${VOICE_API_BASE}/api/transcribe`, { method: "POST", body: form });
    if (!res.ok) return "";
    const data = (await res.json()) as { transcript?: string };
    return data.transcript ?? "";
  } catch {
    return "";
  }
}

/**
 * One-shot batch TTS for spoken feedback outside a live call - e.g. reading
 * the guidance agent's message aloud after a long-press dictation. Returns
 * `null` (never throws) on failure, same fail-quiet convention as
 * `transcribeAudio`.
 */
export async function speakText(text: string, language: "te" | "en"): Promise<Blob | null> {
  try {
    const res = await fetch(`${VOICE_API_BASE}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    });
    if (!res.ok) return null;
    return await res.blob();
  } catch {
    return null;
  }
}
