// Same-origin `/route` — proxied to the standalone inference/ service
// (the Lakshmi guidance agent, run via the "inference" workspace's `dev`
// script) by Vite (see vite.config.ts), mirroring `/api` and `/voice-api`.
export const GUIDANCE_API_BASE: string =
  (import.meta.env.VITE_GUIDANCE_API_BASE_URL as string | undefined) ?? "/route";

/**
 * Sends free text to agentLakshmi's text-to-text endpoint and returns its
 * reply. Returns `null` on any failure rather than throwing - the chat
 * widget falls back to an inline error message rather than breaking the send.
 */
export async function queryT2T(query: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${GUIDANCE_API_BASE}/message/t2t/message/${encodeURIComponent(query)}`,
    );
    if (!res.ok) return null;
    return (await res.json()) as string;
  } catch {
    return null;
  }
}

/**
 * Sends a base64-encoded audio clip to agentLakshmi's speech-to-text
 * endpoint and returns the transcript. Sent as a JSON body (see
 * inference/route.py's `cls__s2t` model on `POST /route/message/s2t/speech`)
 * rather than a URL path segment - a real recording's base64 easily exceeds
 * uvicorn's ~16KB request-line limit, which otherwise drops the connection
 * outright ("Invalid HTTP request received") before FastAPI ever sees it.
 * Same "null on failure" convention as the other calls here.
 */
export async function queryS2T(audioBase64: string): Promise<string | null> {
  try {
    const res = await fetch(`${GUIDANCE_API_BASE}/message/s2t/speech`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ speech: audioBase64 }),
    });
    if (!res.ok) return null;
    return (await res.json()) as string;
  } catch {
    return null;
  }
}

/** Decodes a base64 string (no data URL prefix) into a Blob of `mimeType`. */
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}

export interface NavigatorReply {
  /** Synthesized spoken reply, decoded from the backend's base64 audio. */
  audio: Blob;
  /** The reply text/code that goes with the spoken audio. */
  element: string;
}

/**
 * Sends a long-press dictation's recorded clip straight to agentLakshmi's
 * navigator endpoint as base64 audio - unlike the guidance flow above, STT,
 * the LLM turn, and TTS all happen server-side in one round trip. The
 * backend replies with JSON (see inference/tools/navigator.py's `reqres`):
 * `{"interaction": "<base64 wav>", "element": "<text>"}` rather than a raw
 * audio body, since a single HTTP response can't mix a binary body with a
 * JSON field. Same "null on failure" convention as the other calls here.
 */
export async function queryNavigator(audioBase64: string): Promise<NavigatorReply | null> {
  try {
    const res = await fetch(`${GUIDANCE_API_BASE}/navigator`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ interaction: audioBase64 }),
    });
    if (!res.ok) return null;
    const { interaction, element } = (await res.json()) as {
      interaction: string;
      element: string;
    };
    return { audio: base64ToBlob(interaction, "audio/wav"), element };
  } catch {
    return null;
  }
}

/**
 * Sends a bot message's text to agentLakshmi's text-to-speech endpoint and
 * returns the synthesized clip. `func__t2s` is still a stub on the backend
 * that echoes the text back as plain JSON rather than real audio - checked
 * for here via content-type so that stub response is logged instead of
 * handed to the caller as a "Blob" that would never fire an audio element's
 * "ended" event. Starts working for real the moment the backend responds
 * with an `audio/*` body, no frontend change needed. Same "null on failure"
 * convention as the other calls here.
 */
export async function queryT2S(text: string): Promise<Blob | null> {
  try {
    const res = await fetch(`${GUIDANCE_API_BASE}/message/t2s/text/${encodeURIComponent(text)}`, {
      method: "POST",
    });
    if (!res.ok) return null;
    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.startsWith("audio/")) {
      console.log("[chatbot] /message/t2s response (not audio yet):", await res.text());
      return null;
    }
    return await res.blob();
  } catch {
    return null;
  }
}
