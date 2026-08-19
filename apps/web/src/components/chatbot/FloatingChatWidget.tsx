import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { speakText, transcribeAudio } from "../../lib/api/voice";
import { requestGuidance } from "../../lib/api/guidance";

type FooterMode = "default" | "text" | "voice";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  kind: "text" | "voice";
  text?: string;
  durationSec?: number;
  transcript?: string;
  timestamp: number;
}

interface ChatSession {
  id: string;
  startedAt: number;
  messages: ChatMessage[];
}

const HISTORY_STORAGE_KEY = "shgap.chatbot.sessions";
const MAX_STORED_SESSIONS = 20;
const LONG_PRESS_MS = 500;
// Recording itself never auto-stops - only a follow-up click ends it. Instead,
// a 4-second gap with no detected speech flushes whatever's been captured so
// far as its own transcribable chunk (via MediaRecorder.requestData(), which
// hands over the buffered audio without stopping the recorder), then keeps
// listening. This keeps a single long-press session from producing one giant
// clip - Sarvam's REST STT endpoint hard-rejects anything over 30s, so a gap
// this short (well under a natural mid-sentence pause) keeps chunks well
// clear of that limit too, not just short for its own sake.
const SILENCE_CHUNK_MS = 4_000;
const SILENCE_CHECK_INTERVAL_MS = 300;
// Heuristic RMS threshold on byte time-domain data (0-1 scale, 0 = digital
// silence) below which the mic input counts as "no speech" - ambient
// room/phone-mic noise typically sits well under this.
const SILENCE_RMS_THRESHOLD = 0.02;

function ChatBubbleIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M4 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8c-1.13 0-2.2-.23-3.17-.66L4 20l1.02-4.24A7.94 7.94 0 0 1 4 12Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function PointerIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-6 w-6" aria-hidden="true">
      <path
        d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HistoryIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <circle cx="10" cy="10" r="7.5" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M10 6v4l3 2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M12.5 4.5 6 10l6.5 5.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M5 5l10 10M15 5 5 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M17.5 2.5 2.5 8.75l5.63 2.12L10.25 17.5 17.5 2.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <rect x="7" y="2.5" width="6" height="10" rx="3" stroke="currentColor" strokeWidth="1.5" />
      <path
        d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

function StopIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className} aria-hidden="true">
      <rect x="5" y="5" width="10" height="10" rx="1.5" />
    </svg>
  );
}

function loadSessions(): ChatSession[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: ChatSession[]) {
  try {
    localStorage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify(sessions.slice(0, MAX_STORED_SESSIONS)),
    );
  } catch {
    // localStorage may be unavailable (private mode / quota) - history just won't persist.
  }
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

let idCounter = 0;
function createId(prefix: string): string {
  idCounter += 1;
  return `${prefix}-${Date.now()}-${idCounter}`;
}

/**
 * Short synthesized "ding" - no audio asset needed - played both when
 * long-press starts listening and when a follow-up click stops it, so the
 * same sound confirms both transitions.
 */
function playNotificationTone(audioContextRef: { current: AudioContext | null }) {
  try {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") {
      void ctx.resume();
    }
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start();
    oscillator.stop(ctx.currentTime + 0.2);
  } catch {
    // Web Audio unavailable/blocked - the visual ripple is still enough feedback.
  }
}

/**
 * Stops `recorder` and resolves with its complete recording as a Blob.
 *
 * This is deliberately a full `stop()`, not `requestData()` mid-stream: a
 * WebM/Opus container's header is only written once, at the very start of a
 * recording session — `requestData()` clears the buffer but does NOT re-emit
 * that header, so every chunk after the first one comes back as a headerless
 * fragment that Sarvam (and most decoders) can't read on its own
 * ("Failed to read the file, please check the audio format"). Stopping and
 * starting a brand-new `MediaRecorder` on the same underlying stream for
 * each chunk (see `startRecorderSegment`) gives every chunk its own valid,
 * independently-decodable header instead.
 */
function captureRecorderChunk(recorder: MediaRecorder): Promise<Blob> {
  return new Promise((resolve) => {
    const handleData = (event: BlobEvent) => {
      recorder.removeEventListener("dataavailable", handleData);
      resolve(event.data);
    };
    recorder.addEventListener("dataavailable", handleData);
    recorder.stop();
  });
}

/** Plays a one-off audio Blob (the guidance agent's spoken message) and
 * releases its object URL once playback ends or fails to start. */
function playAudioBlob(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const audio = new Audio(url);
  audio.addEventListener("ended", () => URL.revokeObjectURL(url), { once: true });
  void audio.play().catch(() => URL.revokeObjectURL(url));
}

/**
 * Floating support chatbot, mounted once at the app root so it's present on
 * every route (auth screens, SHG mobile shell, official/admin dashboards).
 * Chat replies are mocked - there is no backend endpoint for this yet - but
 * the mic capture and voice transcription are both real (MediaRecorder +
 * voice-service's Sarvam-backed /api/transcribe).
 *
 * This must stay mounted as a sibling of <Routes> in App.tsx, outside any
 * individual route's element - that's what keeps an in-progress recording
 * (isListening/isRecording) alive across client-side navigation instead of
 * resetting on every route change. Moving it inside a route would unmount
 * it (and drop the mic stream) on navigation.
 */
export function FloatingChatWidget() {
  const { t, i18n } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [footerMode, setFooterMode] = useState<FooterMode>("default");
  const [textValue, setTextValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [micError, setMicError] = useState<string | null>(null);
  const elapsedSecRef = useRef(0);

  const sessionIdRef = useRef(createId("session"));
  const bodyRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastActivityAtRef = useRef(0);
  const isFlushingChunkRef = useRef(false);
  // Guards the silence-triggered flush: without it, staying silent the whole
  // time (nobody spoke yet) would still fire a flush - and another API call
  // - every SILENCE_CHUNK_MS forever. Only set once real speech is detected,
  // and cleared again after each flush, so a chunk only ever gets sent once
  // there's actually something new since the last one.
  const hasSpeechSinceFlushRef = useRef(false);
  // Long-press is meant to be pure dictation - unlike the footer's "Voice"
  // button (an actual chat turn), it should never trigger the mocked bot
  // auto-reply. Set per recording session in handleStartRecording.
  const isLongPressSessionRef = useRef(false);
  // Cleans up whichever page element the guidance agent last highlighted -
  // set by applyGuidanceHighlight, cleared on focus of that element or when
  // the long-press session ends (handleStopRecording). At most one active
  // highlight at a time: a new one always clears the previous first.
  const clearGuidanceHighlightRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    setSessions(loadSessions());
  }, []);

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, isOpen]);

  useEffect(() => {
    if (footerMode === "text") {
      textInputRef.current?.focus();
    }
  }, [footerMode]);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  // Release the mic and clear any running timer if the widget unmounts
  // mid-recording (e.g. a future route change unmounts the app shell).
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (silenceCheckIntervalRef.current) clearInterval(silenceCheckIntervalRef.current);
      analyserRef.current?.disconnect();
      stopMediaStream();
      void audioContextRef.current?.close();
    };
  }, [stopMediaStream]);

  const appendMessage = useCallback((message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [...prev, { ...message, id: createId("msg"), timestamp: Date.now() }]);
  }, []);

  const sendBotReply = useCallback(
    (replyKey: string) => {
      window.setTimeout(() => {
        appendMessage({ sender: "bot", kind: "text", text: t(replyKey) });
      }, 600);
    },
    [appendMessage, t],
  );

  const stopSilenceWatcher = useCallback(() => {
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
  }, []);

  // Starts a fresh MediaRecorder on the same already-permitted mic stream -
  // used both for the very first segment and to reopen listening right
  // after each silence-triggered chunk (see captureRecorderChunk's comment
  // for why a new recorder, not requestData(), is what makes each chunk
  // independently decodable).
  const startRecorderSegment = useCallback((stream: MediaStream) => {
    const recorder = new MediaRecorder(stream);
    mediaRecorderRef.current = recorder;
    recorder.start();
  }, []);

  // Highlights the element the guidance agent pointed to, until either it
  // gets focused or the long-press session ends (clearGuidanceHighlightRef
  // is also invoked from handleStopRecording). Deliberately does NOT eval()
  // the agent's `override_code` string - that's LLM-generated text arriving
  // over the network, and executing it as code would be a real injection
  // risk. Reproducing the same visual effect (a gray glow) directly from the
  // structured `elementId` field alone gets the identical result safely.
  const applyGuidanceHighlight = useCallback((elementId: string) => {
    clearGuidanceHighlightRef.current?.();
    // The login/register popup renders interface/*.html in its own iframe
    // (a separate document), so an element the guidance agent points to
    // there (e.g. "passwordForm") won't be found via the top document's
    // getElementById - fall back to looking inside that same-origin iframe.
    const el =
      document.getElementById(elementId) ??
      document
        .querySelector<HTMLIFrameElement>("#auth-popup-iframe")
        ?.contentDocument?.getElementById(elementId) ??
      null;
    if (!el) return;
    const originalBoxShadow = el.style.boxShadow;
    el.style.boxShadow = "0 0 10px 4px gray";
    const clear = () => {
      el.style.boxShadow = originalBoxShadow;
      el.removeEventListener("focus", clear);
      clearGuidanceHighlightRef.current = null;
    };
    el.addEventListener("focus", clear, { once: true });
    clearGuidanceHighlightRef.current = clear;
  }, []);

  // Grabs whatever's been recorded since the last flush and sends it to
  // voice-service's batch STT endpoint. `isFinal` (manual stop) always
  // surfaces a message, falling back to a plain duration bubble if
  // transcription comes back empty - a deliberate stop should never look
  // like it silently did nothing. A silence-triggered chunk (`isFinal` false)
  // only surfaces a message when there's actual transcribed text, so a long
  // pause with nothing said doesn't spam the chat with empty voice bubbles.
  const flushChunk = useCallback(
    async (isFinal: boolean) => {
      const recorder = mediaRecorderRef.current;
      const stream = mediaStreamRef.current;
      const duration = elapsedSecRef.current;
      const skipBotReply = isLongPressSessionRef.current;
      // Captured before any reset below - this decides whether the chunk
      // we're about to grab is even worth a network call. Without this, a
      // manual stop right after a silence-chunk already fired would still
      // call /api/transcribe again for whatever few frames of near-silence
      // the fresh segment picked up in between, even though nothing new was
      // actually said.
      const hadSpeech = hasSpeechSinceFlushRef.current;
      if (!recorder || recorder.state === "inactive" || isFlushingChunkRef.current) {
        if (isFinal && duration > 0 && !isFlushingChunkRef.current) {
          elapsedSecRef.current = 0;
          setElapsedSec(0);
          appendMessage({ sender: "user", kind: "voice", durationSec: duration });
          if (!skipBotReply) sendBotReply("chatbot.autoReplyVoice");
        }
        return;
      }
      isFlushingChunkRef.current = true;
      elapsedSecRef.current = 0;
      setElapsedSec(0);
      hasSpeechSinceFlushRef.current = false;
      try {
        const blob = await captureRecorderChunk(recorder);
        // Reopen listening immediately on the same stream (not final) rather
        // than waiting on the transcription network round-trip below, so
        // there's no audible gap in what's being captured.
        if (!isFinal && stream && stream.active) {
          startRecorderSegment(stream);
        }
        if (blob.size > 0 && hadSpeech) {
          const transcript = await transcribeAudio(blob);
          if (skipBotReply) {
            // Long-press is pure dictation, feeding the guidance agent
            // (inference/route.py) rather than the mocked chat reply - the
            // transcript becomes its `question`, and the agent's response
            // (which page element it thinks you meant, if any) is what gets
            // surfaced here, not the raw transcript.
            if (transcript) {
              const guidance = await requestGuidance(transcript);
              console.log(guidance);
              if (guidance?.element_id) {
                applyGuidanceHighlight(guidance.element_id);
              }
              if (guidance?.message) {
                const audioBlob = await speakText(
                  guidance.message,
                  i18n.language === "te" ? "te" : "en",
                );
                if (audioBlob) playAudioBlob(audioBlob);
              }
            }
          } else {
            console.log("[chatbot] transcribed chunk:", transcript);
          }
          if (transcript || isFinal) {
            appendMessage({
              sender: "user",
              kind: "voice",
              durationSec: duration,
              transcript: transcript || undefined,
            });
            if (!skipBotReply) sendBotReply("chatbot.autoReplyVoice");
          }
        } else if (isFinal && duration > 0) {
          appendMessage({ sender: "user", kind: "voice", durationSec: duration });
          if (!skipBotReply) sendBotReply("chatbot.autoReplyVoice");
        }
      } finally {
        isFlushingChunkRef.current = false;
      }
    },
    [appendMessage, sendBotReply, startRecorderSegment, applyGuidanceHighlight, i18n.language],
  );

  // Polls mic input volume every SILENCE_CHECK_INTERVAL_MS; once
  // SILENCE_CHUNK_MS passes with nothing above SILENCE_RMS_THRESHOLD, flushes
  // a chunk and resets the clock so the next silence gap can trigger again.
  const startSilenceWatcher = useCallback(
    (stream: MediaStream) => {
      try {
        const AudioContextClass =
          window.AudioContext ??
          (window as typeof window & { webkitAudioContext?: typeof AudioContext })
            .webkitAudioContext;
        if (!AudioContextClass) return;
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContextClass();
        }
        const ctx = audioContextRef.current;
        if (ctx.state === "suspended") void ctx.resume();

        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        analyserRef.current = analyser;

        const samples = new Uint8Array(analyser.fftSize);
        lastActivityAtRef.current = Date.now();
        silenceCheckIntervalRef.current = setInterval(() => {
          analyser.getByteTimeDomainData(samples);
          let sumSquares = 0;
          for (let i = 0; i < samples.length; i += 1) {
            const normalized = (samples[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / samples.length);
          if (rms > SILENCE_RMS_THRESHOLD) {
            lastActivityAtRef.current = Date.now();
            hasSpeechSinceFlushRef.current = true;
            return;
          }
          if (
            hasSpeechSinceFlushRef.current &&
            Date.now() - lastActivityAtRef.current >= SILENCE_CHUNK_MS
          ) {
            // flushChunk itself resets hasSpeechSinceFlushRef right at entry.
            lastActivityAtRef.current = Date.now();
            void flushChunk(false);
          }
        }, SILENCE_CHECK_INTERVAL_MS);
      } catch {
        // Silence-based chunking is a nice-to-have - if the Web Audio graph
        // can't be built, recording still works via the manual stop, it just
        // won't auto-chunk on long pauses.
      }
    },
    [flushChunk],
  );

  const handleStopRecording = useCallback(
    (shouldSend: boolean) => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      stopSilenceWatcher();
      // "Stopping the long-press interaction" is the other trigger (besides
      // focusing the highlighted element) that clears a still-active
      // guidance highlight - no-ops if none is active.
      clearGuidanceHighlightRef.current?.();
      if (shouldSend) {
        void flushChunk(true).finally(() => {
          stopMediaStream();
          mediaRecorderRef.current = null;
        });
      } else {
        const recorder = mediaRecorderRef.current;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
        stopMediaStream();
        mediaRecorderRef.current = null;
      }
      setIsRecording(false);
      setIsListening(false);
      setFooterMode("default");
      setElapsedSec(0);
      elapsedSecRef.current = 0;
    },
    [flushChunk, stopMediaStream, stopSilenceWatcher],
  );

  const handleToggleOpen = () => {
    setIsOpen((open) => !open);
    setIsHistoryOpen(false);
  };

  const handleClose = () => {
    if (isRecording) handleStopRecording(false);
    setIsOpen(false);
    setIsHistoryOpen(false);
  };

  const handleSendText = () => {
    const trimmed = textValue.trim();
    if (!trimmed) return;
    appendMessage({ sender: "user", kind: "text", text: trimmed });
    setTextValue("");
    sendBotReply("chatbot.autoReplyText");
  };

  const handleStartRecording = async (fromLongPress: boolean) => {
    isLongPressSessionRef.current = fromLongPress;
    hasSpeechSinceFlushRef.current = false;
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError(t("chatbot.micUnsupported"));
      setIsListening(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      startRecorderSegment(stream);
      setFooterMode("voice");
      setIsRecording(true);
      setIsListening(true);
      setElapsedSec(0);
      elapsedSecRef.current = 0;
      timerRef.current = setInterval(() => {
        elapsedSecRef.current += 1;
        setElapsedSec(elapsedSecRef.current);
      }, 1000);
      startSilenceWatcher(stream);
    } catch {
      setMicError(t("chatbot.micDenied"));
      setIsListening(false);
    }
  };

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  // Long-pressing the launcher starts listening in place, without opening the
  // chat panel; a follow-up tap (handled in handleLauncherClick) stops it.
  const handleLauncherPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0 || isListening || isRecording) return;
    longPressTriggeredRef.current = false;
    clearLongPressTimer();
    longPressTimerRef.current = setTimeout(() => {
      longPressTriggeredRef.current = true;
      playNotificationTone(audioContextRef);
      setIsListening(true);
      void handleStartRecording(true);
    }, LONG_PRESS_MS);
  };

  const handleLauncherPointerUp = () => {
    clearLongPressTimer();
  };

  const handleLauncherClick = () => {
    // Releasing the finger/mouse after the long-press fires a native click
    // on this same element — swallow just that one so recording keeps
    // going until a genuinely separate, later click stops it.
    if (longPressTriggeredRef.current) {
      longPressTriggeredRef.current = false;
      return;
    }
    if (isListening || isRecording) {
      playNotificationTone(audioContextRef);
      setIsListening(false);
      handleStopRecording(true);
      return;
    }
    handleToggleOpen();
  };

  const persistCurrentSession = useCallback((currentMessages: ChatMessage[]) => {
    if (currentMessages.length === 0) return;
    const session: ChatSession = {
      id: sessionIdRef.current,
      startedAt: currentMessages[0].timestamp,
      messages: currentMessages,
    };
    const next = [session, ...loadSessions().filter((s) => s.id !== session.id)];
    saveSessions(next);
    setSessions(next);
  }, []);

  const handleOpenHistory = () => {
    setSessions(loadSessions());
    setIsHistoryOpen(true);
  };

  const handleStartNewChat = () => {
    persistCurrentSession(messages);
    sessionIdRef.current = createId("session");
    setMessages([]);
    setIsHistoryOpen(false);
    setFooterMode("default");
  };

  const handleViewSession = (session: ChatSession) => {
    persistCurrentSession(messages);
    sessionIdRef.current = session.id;
    setMessages(session.messages);
    setIsHistoryOpen(false);
    setFooterMode("default");
  };

  return (
    <div
      className={cn(
        // z-[60] keeps this above the auth popup's Modal (z-50, blurred
        // backdrop) so the launcher stays sharp and clickable while that
        // modal is open, instead of being blurred/covered behind it.
        "fixed right-4 z-[60] flex flex-col items-end gap-3 sm:right-6",
        // Clears whichever route's fixed bottom bar is present (e.g.
        // MobileShell's tab bar) via a CSS var that shell sets on mount,
        // instead of a hardcoded offset that only looks right on routes
        // with no bottom bar at all.
        "bottom-[calc(2.5rem_+_var(--mobile-shell-nav-height,0px))] sm:bottom-[calc(3.5rem_+_var(--mobile-shell-nav-height,0px))]",
      )}
    >
      {isOpen && (
        <div
          role="dialog"
          aria-label={t("chatbot.title")}
          className="relative flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-modal"
        >
          <div className="flex items-center justify-between bg-brand-400 px-4 py-3 text-white">
            <button
              type="button"
              onClick={handleOpenHistory}
              aria-label={t("chatbot.historyLabel")}
              className="rounded p-1.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <HistoryIcon />
            </button>
            <span className="text-base font-semibold">{t("chatbot.title")}</span>
            <button
              type="button"
              onClick={handleClose}
              aria-label={t("common.close")}
              className="rounded p-1.5 hover:bg-white/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <CloseIcon />
            </button>
          </div>

          <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-3">
            {messages.length === 0 && (
              <p className="mt-6 text-center text-sm text-neutral-400">{t("chatbot.emptyState")}</p>
            )}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn("flex", message.sender === "user" ? "justify-end" : "justify-start")}
              >
                <div
                  className={cn(
                    "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                    message.sender === "user"
                      ? "bg-brand-400 text-white"
                      : "bg-white text-neutral-800 shadow-card",
                  )}
                >
                  {message.kind === "text" ? (
                    message.text
                  ) : (
                    <span className="flex items-center gap-2">
                      <MicIcon className="h-4 w-4 shrink-0" />
                      {message.transcript ||
                        t("chatbot.voiceMessage", {
                          duration: formatDuration(message.durationSec ?? 0),
                        })}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="border-t border-neutral-200 bg-white px-3 py-3">
            {micError && (
              <p role="alert" className="mb-2 text-xs text-danger-500">
                {micError}
              </p>
            )}

            {footerMode === "default" && (
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setFooterMode("text")}
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  {t("chatbot.textOption")}
                </button>
                <button
                  type="button"
                  onClick={() => void handleStartRecording(false)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-md bg-brand-400 px-3 py-2 text-sm font-medium text-white hover:bg-brand-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1"
                >
                  <MicIcon className="h-4 w-4" />
                  {t("chatbot.voiceOption")}
                </button>
              </div>
            )}

            {footerMode === "text" && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setFooterMode("default")}
                  aria-label={t("chatbot.backToOptions")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  <BackIcon />
                </button>
                <input
                  ref={textInputRef}
                  type="text"
                  value={textValue}
                  onChange={(event) => setTextValue(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") handleSendText();
                    if (event.key === "Escape") setFooterMode("default");
                  }}
                  placeholder={t("chatbot.inputPlaceholder")}
                  className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                />
                <button
                  type="button"
                  onClick={handleSendText}
                  disabled={!textValue.trim()}
                  aria-label={t("chatbot.send")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-400 text-white disabled:bg-neutral-300"
                >
                  <SendIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {footerMode === "voice" && (
              <div className="flex items-center gap-3">
                <span className="relative flex h-3 w-3 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-danger-500 opacity-75" />
                  <span className="relative inline-flex h-3 w-3 rounded-full bg-danger-500" />
                </span>
                <span className="flex-1 text-sm font-medium text-neutral-700">
                  {t("chatbot.recording")} &middot; {formatDuration(elapsedSec)}
                </span>
                <button
                  type="button"
                  onClick={() => handleStopRecording(true)}
                  aria-label={t("chatbot.stopRecording")}
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-danger-500 text-white hover:bg-danger-700"
                >
                  <StopIcon className="h-4 w-4" />
                </button>
              </div>
            )}
          </div>

          {isHistoryOpen && (
            <div className="absolute inset-0 flex flex-col bg-white">
              <div className="flex items-center justify-between border-b border-neutral-200 px-4 py-3">
                <button
                  type="button"
                  onClick={() => setIsHistoryOpen(false)}
                  aria-label={t("chatbot.backToChat")}
                  className="rounded p-1.5 text-neutral-600 hover:bg-neutral-100"
                >
                  <BackIcon />
                </button>
                <span className="text-sm font-semibold text-neutral-800">
                  {t("chatbot.historyTitle")}
                </span>
                <button
                  type="button"
                  onClick={handleStartNewChat}
                  className="text-sm font-medium text-brand-500 hover:text-brand-600"
                >
                  {t("chatbot.newChat")}
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sessions.length === 0 ? (
                  <p className="mt-6 text-center text-sm text-neutral-400">
                    {t("chatbot.noHistory")}
                  </p>
                ) : (
                  sessions.map((session) => {
                    const preview =
                      session.messages.find((m) => m.kind === "text")?.text ??
                      t("chatbot.voiceMessagePreview");
                    return (
                      <button
                        key={session.id}
                        type="button"
                        onClick={() => handleViewSession(session)}
                        className="flex w-full flex-col gap-0.5 border-b border-neutral-100 px-4 py-3 text-left hover:bg-neutral-50"
                      >
                        <span className="truncate text-sm text-neutral-800">{preview}</span>
                        <span className="text-xs text-neutral-400">
                          {new Date(session.startedAt).toLocaleString(i18n.language, {
                            month: "short",
                            day: "numeric",
                            hour: "numeric",
                            minute: "2-digit",
                          })}
                        </span>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={handleLauncherClick}
        onPointerDown={handleLauncherPointerDown}
        onPointerUp={handleLauncherPointerUp}
        onPointerLeave={handleLauncherPointerUp}
        onPointerCancel={handleLauncherPointerUp}
        onContextMenu={(event) => event.preventDefault()}
        aria-label={
          isListening || isRecording
            ? t("chatbot.stopRecording")
            : isOpen
              ? t("common.close")
              : t("chatbot.openLabel")
        }
        aria-expanded={isOpen}
        aria-pressed={isListening || isRecording}
        className="relative flex h-14 w-14 select-none items-center justify-center overflow-hidden rounded-full border border-brand-200 bg-brand-50 text-brand-500 shadow-raised transition-transform hover:scale-105 hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2"
        style={{ touchAction: "manipulation" }}
      >
        {isListening && (
          <>
            {/* Tailwind's animate-ping only defines the 75%-100% keyframe and
                lets the browser interpolate the rest from an implicit start
                state, and resets at full opacity every loop — with 4 staggered
                copies that reset moment reads as a blink. An explicit
                start->end keyframe (defined once, below) avoids both issues. */}
            <style>{`
              @keyframes chatbot-ripple {
                0% { transform: scale(0.4); opacity: 0.6; }
                100% { transform: scale(1.8); opacity: 0; }
              }
            `}</style>
            {[0, 1, 2, 3].map((i) => (
              <span
                key={i}
                aria-hidden="true"
                className="pointer-events-none absolute inset-0 rounded-full border-2 border-neutral-400"
                style={{
                  animationName: "chatbot-ripple",
                  animationDuration: "2.4s",
                  animationTimingFunction: "ease-out",
                  animationIterationCount: "infinite",
                  animationDelay: `${i * 600}ms`,
                }}
              />
            ))}
          </>
        )}
        <span className="relative z-10">
          {isOpen ? (
            <CloseIcon />
          ) : isListening || isRecording ? (
            <PointerIcon />
          ) : (
            <ChatBubbleIcon />
          )}
        </span>
      </button>
    </div>
  );
}
