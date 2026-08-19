// Same-origin `/guidance-api` — proxied to the standalone inference/ service
// (the Lakshmi guidance agent, run via the "inference" workspace's `dev`
// script) by Vite (see vite.config.ts), mirroring `/api` and `/voice-api`.
export const GUIDANCE_API_BASE: string =
  (import.meta.env.VITE_GUIDANCE_API_BASE_URL as string | undefined) ?? "/guidance-api";

export interface GuidanceResponse {
  element_id: string | null;
  override_code: string;
  message: string;
}

/**
 * Asks the guidance agent to locate the page element a free-text question
 * is about (e.g. a long-press dictation's transcript). Returns `null` on any
 * failure rather than throwing - this is a best-effort lookup, not something
 * that should break the caller's flow.
 */
export async function requestGuidance(question: string): Promise<GuidanceResponse | null> {
  try {
    const res = await fetch(`${GUIDANCE_API_BASE}/api/guidance`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question }),
    });
    if (!res.ok) return null;
    return (await res.json()) as GuidanceResponse;
  } catch {
    return null;
  }
}
