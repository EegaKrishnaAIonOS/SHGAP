import type { PointerEvent } from "react";

/**
 * Publishes FloatingChatWidget's launcher state/handlers so an external
 * trigger elsewhere in the tree (e.g. PageAssistantTrigger, rendered inside
 * a page's own layout) can open/close the chat panel and drive long-press
 * voice dictation without FloatingChatWidget's ~300 lines of recording
 * state/refs being lifted out of it. FloatingChatWidget is the sole
 * publisher; consumers just subscribe via useSyncExternalStore.
 */
export interface ChatWidgetBridgeState {
  isOpen: boolean;
  isListening: boolean;
  isRecording: boolean;
  // True only when the in-progress recording was started via long-press on
  // this trigger itself, as opposed to the in-panel voice button - drives
  // PageAssistantTrigger swapping to the pointer/dictation icon, which
  // should stay the plain chat-bubble icon for an in-panel voice message.
  isLongPressRecording: boolean;
  // True for the span between a long-press dictation chunk being sent to
  // /api/transcribe and its /api/guidance round-trip resolving — drives the
  // "analyzing the page" overlay AppShell renders on top of the iframe.
  isAnalyzingPage: boolean;
  onTriggerClick: () => void;
  onTriggerPointerDown: (event: PointerEvent<HTMLButtonElement>) => void;
  onTriggerPointerUp: () => void;
}

let state: ChatWidgetBridgeState | null = null;
const listeners = new Set<() => void>();

export function publishChatWidgetBridge(next: ChatWidgetBridgeState | null) {
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeChatWidgetBridge(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getChatWidgetBridge() {
  return state;
}
