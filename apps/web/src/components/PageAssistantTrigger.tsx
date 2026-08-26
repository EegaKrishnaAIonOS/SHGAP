import { useSyncExternalStore } from "react";
import { ChatBubbleIcon } from "./icons/ChatBubbleIcon";
import { PointerIcon } from "./icons/PointerIcon";
import { getChatWidgetBridge, subscribeChatWidgetBridge } from "../lib/chatWidgetBridge";
import { cn } from "../lib/cn";
import { IconChip } from "./ui/IconChip";
import { Tooltip } from "./ui/Tooltip";

/**
 * Flat (no circular background) message-icon trigger for the nav bar —
 * replaces FloatingChatWidget's old round floating launcher, reusing its
 * exact open/close and long-press-to-dictate behavior via the bridge in
 * lib/chatWidgetBridge, since that widget's recording state/refs live in a
 * separate part of the tree and aren't worth lifting out.
 */
export function PageAssistantTrigger({ className }: { className?: string }) {
  const bridge = useSyncExternalStore(subscribeChatWidgetBridge, getChatWidgetBridge);

  const isOpen = bridge?.isOpen ?? false;
  const isListening = bridge?.isListening ?? false;
  const isRecording = bridge?.isRecording ?? false;

  return (
    <Tooltip label="agent">
      <button
        type="button"
        onClick={bridge?.onTriggerClick}
        onPointerDown={bridge?.onTriggerPointerDown}
        onPointerUp={bridge?.onTriggerPointerUp}
        onPointerLeave={bridge?.onTriggerPointerUp}
        onPointerCancel={bridge?.onTriggerPointerUp}
        onContextMenu={(event) => event.preventDefault()}
        disabled={!bridge}
        aria-label={
          isListening || isRecording ? "Stop recording" : isOpen ? "Close" : "Open chat assistant"
        }
        aria-expanded={isOpen}
        aria-pressed={isListening || isRecording}
        className={cn(
          "group flex select-none items-center justify-center disabled:opacity-50",
          className,
        )}
        style={{ touchAction: "manipulation" }}
      >
        {/* Stays the same chat-bubble icon even while open — the IconChip's
            black/white invert (active = isOpen here) is what signals "open",
            not swapping to a separate close/X icon. */}
        <IconChip active={isOpen || isListening || isRecording}>
          {isListening || isRecording ? (
            <PointerIcon className="h-4 w-4" />
          ) : (
            <ChatBubbleIcon className="h-4 w-4" />
          )}
        </IconChip>
      </button>
    </Tooltip>
  );
}
