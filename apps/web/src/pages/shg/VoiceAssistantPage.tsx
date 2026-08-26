import { useCallback, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { PipecatClient } from "@pipecat-ai/client-js";
import { SmallWebRTCTransport } from "@pipecat-ai/small-webrtc-transport";
import {
  PipecatClientAudio,
  PipecatClientProvider,
  useMediaState,
  usePipecatClient,
  usePipecatClientMicControl,
  usePipecatClientTransportState,
  usePipecatConversation,
  VoiceVisualizer,
} from "@pipecat-ai/client-react";
import type { ConversationMessagePart } from "@pipecat-ai/client-react";
import { Button } from "../../components/ui/Button";
import { Card } from "../../components/ui/Card";
import { cn } from "../../lib/cn";
import { getAccessTokenForRequest } from "../../lib/api/httpClient";
import { sendTextMessage, transliterate, VOICE_API_BASE } from "../../lib/api/voice";
import type { ToolResult } from "../../lib/api/voice";
import { getOrCreateVoiceSessionId } from "../../lib/voice/sessionId";
import { ActionResultCard } from "../../components/voice/ActionResultCard";

type VoiceLanguage = "te" | "en";

/** `parts[].text` is either a plain string/ReactNode (user turns, injected
 * text-chat turns) or a `{spoken, unspoken}` pair (live bot turns, RTVI's
 * BotOutput format) — see `@pipecat-ai/client-react`'s `ConversationMessagePart`. */
function renderPartText(text: ConversationMessagePart["text"]): ReactNode {
  if (text && typeof text === "object" && "spoken" in text && "unspoken" in text) {
    const botText = text as { spoken: string; unspoken: string };
    return `${botText.spoken}${botText.unspoken}`;
  }
  return text as ReactNode;
}

/**
 * Real voice + text assistant (T12) — replaces the T04 wireframe. Connects
 * to voice-service over WebRTC via the official `@pipecat-ai` client SDKs
 * (ADR-0019/ADR-0021), with a text-input fallback that shares the same
 * Redis-backed session, tools and system prompt as the live call.
 *
 * `PipecatClient` is intentionally created once per page mount (not per
 * render) — reconnecting reuses `sessionId` so voice-service resumes the
 * same conversation (see ADR-0019 on why `sessionId` is distinct from
 * aiortc's own per-connection `pc_id`).
 */
export function VoiceAssistantPage() {
  const [client] = useState(
    () => new PipecatClient({ transport: new SmallWebRTCTransport(), enableMic: true }),
  );

  return (
    <PipecatClientProvider client={client}>
      <VoiceAssistantContent />
      <PipecatClientAudio />
    </PipecatClientProvider>
  );
}

function VoiceAssistantContent() {
  const client = usePipecatClient();
  const transportState = usePipecatClientTransportState();
  const { enableMic, isMicEnabled } = usePipecatClientMicControl();
  const { messages, injectMessage } = usePipecatConversation();
  const mediaState = useMediaState();

  const sessionId = useMemo(() => getOrCreateVoiceSessionId(), []);
  const [language, setLanguage] = useState<VoiceLanguage>("en");
  const [lowBandwidth, setLowBandwidth] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [textInput, setTextInput] = useState("");
  const [sending, setSending] = useState(false);
  const [lastToolResults, setLastToolResults] = useState<ToolResult[]>([]);

  const isConnected = transportState === "connected" || transportState === "ready";
  const isConnecting =
    transportState === "connecting" ||
    transportState === "authenticating" ||
    transportState === "initializing";

  const handleConnect = useCallback(async () => {
    if (!client) return;
    setPageError(null);
    try {
      const accessToken = await getAccessTokenForRequest();
      await client.connect({
        webrtcRequestParams: {
          endpoint: `${VOICE_API_BASE}/api/offer`,
          requestData: { sessionId, accessToken, language },
        },
      });
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Couldn't start the call. Please try again.",
      );
    }
  }, [client, sessionId, language]);

  const handleDisconnect = useCallback(() => {
    void client?.disconnect();
  }, [client]);

  const handleLowBandwidthToggle = useCallback(
    (next: boolean) => {
      setLowBandwidth(next);
      if (next && isConnected) handleDisconnect();
    },
    [isConnected, handleDisconnect],
  );

  const handleSendText = useCallback(async () => {
    const trimmed = textInput.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setPageError(null);
    try {
      const accessToken = await getAccessTokenForRequest();
      // Best-effort cleanup of messy Romanized/mixed-script input before it
      // becomes part of the conversation (T11/ADR-0020) — English typing
      // doesn't need this step.
      const normalized = language === "te" ? await transliterate(trimmed) : trimmed;
      setTextInput("");
      injectMessage({
        role: "user",
        parts: [{ text: normalized, final: true, createdAt: new Date().toISOString() }],
      });
      const response = await sendTextMessage(sessionId, normalized, accessToken, language);
      injectMessage({
        role: "assistant",
        parts: [{ text: response.reply, final: true, createdAt: new Date().toISOString() }],
      });
      setLastToolResults(response.tool_results);
    } catch (err) {
      setPageError(
        err instanceof Error ? err.message : "Couldn't send your message. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }, [textInput, sending, language, sessionId, injectMessage]);

  const micErrorMessage =
    mediaState.mic.state === "error"
      ? "Couldn't access your microphone. Check your browser's microphone permission and try again."
      : null;

  return (
    <div className="flex flex-col items-center">
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">Voice Assistant</h1>

      <div className="mb-4 flex w-full flex-wrap items-center justify-center gap-2">
        <LanguageToggle
          language={language}
          onChange={setLanguage}
          disabled={isConnected || isConnecting}
        />
        <button
          type="button"
          aria-pressed={lowBandwidth}
          onClick={() => handleLowBandwidthToggle(!lowBandwidth)}
          className={cn(
            "min-h-touch rounded-md border px-4 text-sm font-medium",
            lowBandwidth
              ? "border-brand-400 bg-brand-50 text-brand-700"
              : "border-neutral-200 bg-white text-neutral-600",
          )}
        >
          {lowBandwidth ? "Low-data mode: on" : "Low-data mode: off"}
        </button>
      </div>

      {lowBandwidth && (
        <p className="mb-4 max-w-md text-center text-sm text-neutral-500">
          Voice calls are turned off to save data. Type your question below instead.
        </p>
      )}

      {!lowBandwidth && (
        <>
          {!isConnected ? (
            <Button
              size="touch"
              onClick={() => void handleConnect()}
              isLoading={isConnecting}
              disabled={isConnecting}
            >
              Start voice call
            </Button>
          ) : (
            <>
              <button
                type="button"
                aria-pressed={isMicEnabled}
                onClick={() => enableMic(!isMicEnabled)}
                className={cn(
                  "flex h-32 w-32 items-center justify-center rounded-full text-5xl text-white shadow-raised transition-colors",
                  isMicEnabled ? "bg-brand-400" : "bg-neutral-400",
                )}
              >
                <span aria-hidden="true">🎙️</span>
                <span className="sr-only">
                  {isMicEnabled ? "Microphone on — tap to mute" : "Microphone off — tap to unmute"}
                </span>
              </button>
              <p className="mt-3 text-lg font-medium text-neutral-700" aria-live="polite">
                {isMicEnabled ? "Listening..." : "Microphone off — tap to unmute"}
              </p>

              <div className="mt-4 flex items-center justify-center gap-8">
                <VoiceVisualizer
                  participantType="local"
                  barColor="#7e14ff"
                  barWidth={4}
                  barGap={2}
                  barMaxHeight={40}
                  backgroundColor="transparent"
                />
                <VoiceVisualizer
                  participantType="bot"
                  barColor="#14b8a6"
                  barWidth={4}
                  barGap={2}
                  barMaxHeight={40}
                  backgroundColor="transparent"
                />
              </div>

              <Button variant="outline" className="mt-4" onClick={handleDisconnect}>
                End call
              </Button>
            </>
          )}
          {micErrorMessage && (
            <p className="mt-2 text-sm text-danger-500" role="alert">
              {micErrorMessage}
            </p>
          )}
        </>
      )}

      {pageError && (
        <p className="mt-3 text-sm text-danger-500" role="alert">
          {pageError}
        </p>
      )}

      <div
        className={cn(
          "mt-6 w-full flex-1 overflow-y-auto rounded-md border border-neutral-200 bg-white p-3",
          // The call's own language toggle (above) selects the spoken
          // language for this voice call only — independent of whatever
          // script the rest of the UI is in — so the transcript switches to
          // the Telugu font stack directly off that state.
          language === "te" && "font-telugu",
        )}
      >
        {messages.length === 0 ? (
          <p className="text-center text-sm text-neutral-400">
            Your conversation will appear here.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {messages.map((message, i) => {
              if (message.role === "function_call") {
                return (
                  <li key={i} className="mr-auto max-w-[90%]">
                    <ActionResultCard result={message.functionCall?.result} />
                  </li>
                );
              }
              return (
                <li
                  key={i}
                  className={cn(
                    "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                    message.role === "user"
                      ? "ml-auto bg-brand-50 text-brand-700"
                      : "mr-auto bg-neutral-100 text-neutral-700",
                  )}
                >
                  {message.parts.map((part, pi) => (
                    <span key={pi}>{renderPartText(part.text)}</span>
                  ))}
                </li>
              );
            })}
          </ul>
        )}
        {lastToolResults.map((toolResult, i) => (
          <div key={i} className="mt-2">
            <ActionResultCard result={toolResult.result} />
          </div>
        ))}
      </div>

      <div className="mt-3 flex w-full items-center gap-2">
        <label className="sr-only" htmlFor="voice-text-input">
          Type a message
        </label>
        <input
          id="voice-text-input"
          type="text"
          value={textInput}
          onChange={(e) => setTextInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handleSendText();
          }}
          placeholder="Type your question..."
          className="min-h-touch flex-1 rounded-md border border-neutral-300 bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        />
        <Button
          onClick={() => void handleSendText()}
          isLoading={sending}
          disabled={!textInput.trim() || sending}
        >
          Send
        </Button>
      </div>

      <div className="mt-6 w-full">
        <Card className="text-sm text-neutral-500">
          Try: "What is the price of turmeric powder?", "Add my new product", or "What loans are
          available for my SHG?"
        </Card>
      </div>
    </div>
  );
}

function LanguageToggle({
  language,
  onChange,
  disabled,
}: {
  language: VoiceLanguage;
  onChange: (language: VoiceLanguage) => void;
  disabled: boolean;
}) {
  return (
    <div className="inline-flex rounded-md border border-neutral-200 bg-white p-0.5">
      {(["te", "en"] as const).map((lang) => (
        <button
          key={lang}
          type="button"
          disabled={disabled}
          onClick={() => onChange(lang)}
          aria-pressed={language === lang}
          className={cn(
            "min-h-touch rounded px-4 text-sm font-medium disabled:cursor-not-allowed disabled:opacity-60",
            language === lang ? "bg-brand-400 text-white" : "text-neutral-600",
          )}
        >
          {lang === "te" ? "Telugu" : "English"}
        </button>
      ))}
    </div>
  );
}
