import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import ReactMarkdown from "react-markdown";
import { cn } from "../../lib/cn";
import { queryS2T, queryT2S, queryT2T, queryNavigator } from "../../lib/api/guidance";
import { publishChatWidgetBridge } from "../../lib/chatWidgetBridge";

interface ChatMessage {
  id: string;
  sender: "user" | "bot";
  text: string;
  timestamp: number;
}

const LONG_PRESS_MS = 500;
// The footer mic button's own recording (not long-press dictation, which is
// uncapped) auto-stops after this long if the user never taps stop - same
// treatment as a manual stop, transcribing whatever was captured so far.
const MIC_RECORDING_AUTO_STOP_MS = 28_000;
// Recording itself never auto-stops - only a follow-up click ends it. Instead,
// a 4-second gap with no detected speech flushes whatever's been captured so
// far as its own transcribable chunk (draining the buffered PCM samples
// without tearing down the underlying audio graph), then keeps listening.
// This keeps a single long-press session from producing one giant clip -
// Sarvam's REST STT endpoint hard-rejects anything over 30s, so a gap this
// short (well under a natural mid-sentence pause) keeps chunks well clear of
// that limit too, not just short for its own sake.
const SILENCE_CHUNK_MS = 4_000;
const SILENCE_CHECK_INTERVAL_MS = 300;
// Heuristic RMS threshold on byte time-domain data (0-1 scale, 0 = digital
// silence) below which the mic input counts as "no speech" - ambient
// room/phone-mic noise typically sits well under this.
const SILENCE_RMS_THRESHOLD = 0.02;
// The backend's response template isn't real Markdown: it emits raw <br>/<b>
// tags, which plain ReactMarkdown drops since we don't load rehype-raw, and
// the model sometimes runs multiple "* [title](url)" source bullets together
// on one line instead of one per line. Normalize both into Markdown
// ReactMarkdown can actually render as a proper multi-item list.
function normalizeBotMarkdown(text: string): string {
  return text
    .replace(/<br\s*\/?>/gi, "\n\n")
    .replace(/<(b|strong)>([\s\S]*?)<\/\1>/gi, "**$2**")
    .replace(/\s*\*\s*(?=\[[^\]]+\]\(<?[^)]+>?\))/g, "\n* ");
}

// TTS should only speak the explanation, never a source citation: besides
// being unwanted to read aloud, a source URL's "/" characters break the
// backend's t2s route (a FastAPI {text} path param can't contain a "/" -
// uvicorn decodes %2F back into a literal slash before route matching, which
// 404s since the extra segment no longer fits the single-{text} route).
// The model doesn't always wrap the citation in the <br>/<b> template tags,
// so look for a "source" heading line (plain or **bold**) instead of relying
// on those tags being present, and cut everything from there onward.
function getSpeechText(text: string): string {
  const withoutTags = text.replace(/<br\s*\/?>/gi, "\n").replace(/<\/?[^>]+>/g, "");
  const sourceHeading = withoutTags.match(/^[ \t]*\*{0,2}source\*{0,2}\s*:?\s*$/im);
  const spokenPart = sourceHeading ? withoutTags.slice(0, sourceHeading.index) : withoutTags;
  return spokenPart
    .replace(/\[([^\]]+)\]\([^)]*\)/g, "$1")
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/^[\s*-]+/gm, "")
    .trim();
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

function SpeakerIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={className} aria-hidden="true">
      <path
        d="M3 7.5h3L10.5 4v12L6 12.5H3v-5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M13.5 7a4 4 0 0 1 0 6"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
    </svg>
  );
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
 * Encodes captured PCM (mono, one Float32Array per audio-process callback)
 * into a standard 16-bit PCM WAV Blob. `func__s2t`'s eventual real
 * implementation (see inference/tools/message.py's commented-out Sarvam
 * code) calls `speech_to_text.transcribe(file=open("audio.wav", "rb"), ...)`
 * - a WAV file, not the WebM/Opus a bare `MediaRecorder` would produce -
 * hence encoding it by hand here rather than recording via MediaRecorder.
 */
function encodeWavBlob(chunks: Float32Array[], sampleRate: number): Blob {
  let sampleCount = 0;
  for (const chunk of chunks) sampleCount += chunk.length;

  const bytesPerSample = 2;
  const blockAlign = bytesPerSample; // mono
  const dataSize = sampleCount * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true); // fmt chunk size
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true); // byte rate
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bytesPerSample * 8, true); // bits per sample
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  let offset = 44;
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i += 1) {
      const clamped = Math.max(-1, Math.min(1, chunk[i]));
      view.setInt16(offset, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
      offset += 2;
    }
  }

  return new Blob([buffer], { type: "audio/wav" });
}

/** Base64-encodes a recorded clip for the s2t endpoint, which - like the
 * chat's t2t endpoint - takes its payload as a URL path segment rather than
 * a multipart body. Strips the "data:...;base64," prefix FileReader's
 * data URL comes wrapped in, leaving just the encoded bytes. */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

/** Plays a one-off audio Blob (the guidance agent's spoken message),
 * releasing its object URL once playback ends or fails to start, and
 * resolving at that same point - callers use this to know when the
 * guidance highlight should stop blinking. */
function playAudioBlob(blob: Blob): Promise<void> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    const finish = () => {
      URL.revokeObjectURL(url);
      resolve();
    };
    audio.addEventListener("ended", finish, { once: true });
    void audio.play().catch(finish);
  });
}

/**
 * Floating support chatbot, mounted once at the app root so it's present on
 * every route (auth screens, SHG mobile shell, official/admin dashboards).
 * Chat replies are mocked - there is no backend endpoint for this yet - but
 * the mic capture and voice transcription are both real (Web Audio PCM
 * capture encoded to WAV + voice-service's Sarvam-backed /api/transcribe).
 *
 * This must stay mounted as a sibling of <Routes> in App.tsx, outside any
 * individual route's element - that's what keeps an in-progress recording
 * (isListening/isRecording) alive across client-side navigation instead of
 * resetting on every route change. Moving it inside a route would unmount
 * it (and drop the mic stream) on navigation.
 */
export function FloatingChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  // When AppShell's iframe layout provides a docked slot (id="chat-panel-slot",
  // sized 20% of the main area beside the iframe — see AppShell.tsx), the
  // panel portals into it instead of floating over the page. Looked up once
  // on mount: the slot is always rendered by AppShell regardless of open
  // state (just zero-width when closed), so it already exists by the time
  // this effect runs. Routes without an AppShell simply have no slot, and
  // the panel falls back to its original floating position.
  const [chatPanelSlot, setChatPanelSlot] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setChatPanelSlot(document.getElementById("chat-panel-slot"));
  }, []);
  const [textValue, setTextValue] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isSending, setIsSending] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isAnalyzingPage, setIsAnalyzingPage] = useState(false);
  const [micError, setMicError] = useState<string | null>(null);
  // Which bot message (if any) is currently being read aloud via the
  // per-message speaker button, and what stage that playback is at -
  // "loading" while /api/speak is in flight, "playing" once the returned
  // clip has started. Only one message can speak at a time.
  const [speakingMessageId, setSpeakingMessageId] = useState<string | null>(null);
  const [speakingPhase, setSpeakingPhase] = useState<"loading" | "playing" | null>(null);

  const bodyRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Raw PCM capture (replaces MediaRecorder - see encodeWavBlob's comment for
  // why). pcmChunksRef accumulates one Float32Array per audio-process tick
  // since the last flush; the processor keeps running across flushes (no
  // MediaRecorder-style restart needed, since raw PCM has no per-chunk
  // container header to worry about) until stopPcmCapture tears the graph
  // down at the end of the recording session.
  const pcmProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const pcmSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const pcmSilentGainRef = useRef<GainNode | null>(null);
  const pcmChunksRef = useRef<Float32Array[]>([]);
  const pcmSampleRateRef = useRef(48000);
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

  useEffect(() => {
    if (bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight;
    }
  }, [messages, isOpen, isSending]);

  useEffect(() => {
    if (isOpen) {
      textInputRef.current?.focus();
    }
  }, [isOpen]);

  const stopMediaStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
  }, []);

  // Release the mic and clear any running timer if the widget unmounts
  // mid-recording (e.g. a future route change unmounts the app shell).
  useEffect(() => {
    return () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (autoStopTimerRef.current) clearTimeout(autoStopTimerRef.current);
      if (silenceCheckIntervalRef.current) clearInterval(silenceCheckIntervalRef.current);
      analyserRef.current?.disconnect();
      pcmProcessorRef.current?.disconnect();
      pcmSourceRef.current?.disconnect();
      pcmSilentGainRef.current?.disconnect();
      stopMediaStream();
      void audioContextRef.current?.close();
    };
  }, [stopMediaStream]);

  const appendMessage = useCallback((message: Omit<ChatMessage, "id" | "timestamp">) => {
    setMessages((prev) => [...prev, { ...message, id: createId("msg"), timestamp: Date.now() }]);
  }, []);

  const stopSilenceWatcher = useCallback(() => {
    if (silenceCheckIntervalRef.current) {
      clearInterval(silenceCheckIntervalRef.current);
      silenceCheckIntervalRef.current = null;
    }
    analyserRef.current?.disconnect();
    analyserRef.current = null;
  }, []);

  // Builds the raw-PCM capture graph on an already-permitted mic stream:
  // source -> ScriptProcessorNode -> a zero-gain node -> destination. The
  // silent gain node is required, not decorative - Chrome only fires
  // onaudioprocess once the graph reaches the destination, and routing
  // straight to it would otherwise loop the mic back out the speakers.
  // ScriptProcessorNode is deprecated in favor of AudioWorklet, but stays
  // simple here (no separate worklet module to host/fetch) and both
  // Chromium and Firefox still ship it.
  const startPcmCapture = useCallback((stream: MediaStream) => {
    const AudioContextClass =
      window.AudioContext ??
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContextClass();
    }
    const ctx = audioContextRef.current;
    if (ctx.state === "suspended") void ctx.resume();

    const source = ctx.createMediaStreamSource(stream);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    const silentGain = ctx.createGain();
    silentGain.gain.value = 0;

    pcmChunksRef.current = [];
    pcmSampleRateRef.current = ctx.sampleRate;
    processor.onaudioprocess = (event) => {
      pcmChunksRef.current.push(new Float32Array(event.inputBuffer.getChannelData(0)));
    };

    source.connect(processor);
    processor.connect(silentGain);
    silentGain.connect(ctx.destination);

    pcmSourceRef.current = source;
    pcmProcessorRef.current = processor;
    pcmSilentGainRef.current = silentGain;
  }, []);

  const stopPcmCapture = useCallback(() => {
    pcmProcessorRef.current?.disconnect();
    pcmSourceRef.current?.disconnect();
    pcmSilentGainRef.current?.disconnect();
    pcmProcessorRef.current = null;
    pcmSourceRef.current = null;
    pcmSilentGainRef.current = null;
  }, []);

  // Grabs whatever's been recorded since the last flush. Runs on both a
  // manual stop (`isFinal`) and on each silence-triggered chunk during a
  // longer recording, so a long dictation session fills the textbox
  // incrementally instead of all at once at the end. Long-press dictation
  // and the footer mic button are otherwise unrelated features that just
  // happen to share this capture pipeline - they part ways below over which
  // transcription endpoint each one calls and what it does with the result.
  const flushChunk = useCallback(
    async (isFinal: boolean) => {
      const skipBotReply = isLongPressSessionRef.current;
      // Captured before any reset below - this decides whether the chunk
      // we're about to grab is even worth a network call. Without this, a
      // manual stop right after a silence-chunk already fired would still
      // call the transcription endpoint again for whatever few frames of
      // near-silence the fresh segment picked up in between, even though
      // nothing new was actually said.
      const hadSpeech = hasSpeechSinceFlushRef.current;
      if (!pcmProcessorRef.current || isFlushingChunkRef.current) {
        return;
      }
      isFlushingChunkRef.current = true;
      hasSpeechSinceFlushRef.current = false;
      try {
        // Drains whatever's accumulated since the last flush - the capture
        // graph itself keeps running (not final) so there's no gap in what's
        // being recorded while the transcription network round-trip below is
        // in flight.
        const chunks = pcmChunksRef.current;
        pcmChunksRef.current = [];
        if (isFinal) stopPcmCapture();
        if (chunks.length === 0 || !hadSpeech) return;
        const blob = encodeWavBlob(chunks, pcmSampleRateRef.current);
        if (blob.size === 0) return;

        if (skipBotReply) {
          // Long-press dictation: send the recorded clip straight to
          // agentLakshmi's navigator endpoint (inference/route.py's
          // /route/navigator) - STT, the LLM turn, and TTS all happen
          // server-side in one round trip, so there's no separate
          // transcribe/guidance/speak sequence to orchestrate here. The
          // backend replies with both the spoken audio and its text/code
          // (see queryNavigator's comment in lib/api/guidance.ts) - show the
          // latter as a bot message while the former plays.
          setIsAnalyzingPage(true);
          try {
            const audioBase64 = await blobToBase64(blob);
            const reply = await queryNavigator(audioBase64);
            setIsAnalyzingPage(false);
            if (reply) {
              appendMessage({ sender: "bot", text: reply.element });
              await playAudioBlob(reply.audio);
            }
          } finally {
            setIsAnalyzingPage(false);
          }
        } else {
          // Footer mic button: agentLakshmi's own speech-to-text (inference's
          // s2t endpoint), fed back into the textbox for the user to
          // review/edit before hitting Send.
          setIsTranscribing(true);
          try {
            const audioBase64 = await blobToBase64(blob);
            const transcript = await queryS2T(audioBase64);
            if (transcript) {
              setTextValue((prev) => (prev ? `${prev} ${transcript}` : transcript));
            }
          } finally {
            setIsTranscribing(false);
          }
        }
      } finally {
        isFlushingChunkRef.current = false;
      }
    },
    [stopPcmCapture, appendMessage],
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
            // Footer mic (s2t) only ever posts once, on explicit stop - see
            // S2T_CHUNK_SAMPLE_RATE's comment - so this mid-recording,
            // silence-triggered flush is long-press dictation only.
            isLongPressSessionRef.current &&
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
      if (autoStopTimerRef.current) {
        clearTimeout(autoStopTimerRef.current);
        autoStopTimerRef.current = null;
      }
      stopSilenceWatcher();
      if (shouldSend) {
        void flushChunk(true).finally(() => {
          stopMediaStream();
        });
      } else {
        stopPcmCapture();
        stopMediaStream();
      }
      setIsRecording(false);
      setIsListening(false);
    },
    [flushChunk, stopMediaStream, stopPcmCapture, stopSilenceWatcher],
  );

  const handleToggleOpen = () => {
    setIsOpen((open) => !open);
  };

  const handleSendText = async () => {
    const trimmed = textValue.trim();
    if (!trimmed || isSending) return;
    appendMessage({ sender: "user", text: trimmed });
    setTextValue("");
    setIsSending(true);
    try {
      const reply = await queryT2T(trimmed);
      appendMessage({
        sender: "bot",
        text: reply ?? "Sorry, something went wrong. Please try again.",
      });
    } finally {
      setIsSending(false);
    }
  };

  // Reads a bot message aloud via voice-service's TTS endpoint. Guarded to
  // one at a time - a click while another message is already speaking is a
  // no-op rather than overlapping two clips.
  const handleSpeakMessage = async (message: ChatMessage) => {
    if (speakingMessageId) return;
    setSpeakingMessageId(message.id);
    setSpeakingPhase("loading");
    try {
      const audioBlob = await queryT2S(getSpeechText(message.text));
      if (!audioBlob) return;
      setSpeakingPhase("playing");
      await playAudioBlob(audioBlob);
    } finally {
      setSpeakingMessageId(null);
      setSpeakingPhase(null);
    }
  };

  const handleStartRecording = async (fromLongPress: boolean) => {
    isLongPressSessionRef.current = fromLongPress;
    hasSpeechSinceFlushRef.current = false;
    setMicError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMicError("Voice messages aren't supported in this browser.");
      setIsListening(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      startPcmCapture(stream);
      setIsRecording(true);
      setIsListening(true);
      startSilenceWatcher(stream);
      if (!fromLongPress) {
        autoStopTimerRef.current = setTimeout(() => {
          handleStopRecording(true);
        }, MIC_RECORDING_AUTO_STOP_MS);
      }
    } catch {
      setMicError(
        "Microphone access was denied. Please allow microphone access to send a voice message.",
      );
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

  // Publishes the launcher's state/handlers so PageAssistantTrigger (mounted
  // in a page's own header/footer, a separate part of the tree) can drive
  // this same open/close and long-press-to-dictate behavior without this
  // widget's recording state/refs being lifted out of it.
  useEffect(() => {
    publishChatWidgetBridge({
      isOpen,
      isListening,
      isRecording,
      isLongPressRecording: isLongPressSessionRef.current && (isListening || isRecording),
      isAnalyzingPage,
      onTriggerClick: handleLauncherClick,
      onTriggerPointerDown: handleLauncherPointerDown,
      onTriggerPointerUp: handleLauncherPointerUp,
    });
  });

  // Unpublish only on true unmount — the effect above already refreshes the
  // published state after every render, so this must not re-run per render
  // (it would otherwise flip the bridge to null and back on every one).
  useEffect(() => {
    return () => publishChatWidgetBridge(null);
  }, []);

  const dialog = isOpen && (
    <div
      role="dialog"
      aria-label="SHG Assistant"
      // Excluded from Google's Website Translator (see lib/googleTranslate.ts
      // and TranslateMenu.tsx's own use of `notranslate`) - the widget's
      // messages re-render constantly (new messages, the typing indicator),
      // which fights with Google's DOM rewriting the same way the header
      // greeting does, and a live agent reply shouldn't get retranslated out
      // from under the language it actually answered in anyway.
      translate="no"
      className={cn(
        "notranslate",
        chatPanelSlot
          ? // Docked beside the iframe (AppShell's chat-panel-slot already
            // sizes/borders the column) — fill it exactly, no floating-card
            // chrome. absolute+inset-0 (not h-full/w-full) because the slot's
            // own height comes from flex-stretch, which h-full's percentage
            // resolution doesn't reliably see — see AppShell.tsx's comment
            // on the same pattern for the iframe itself.
            "absolute inset-0 flex flex-col overflow-hidden bg-white"
          : "relative flex h-[32rem] w-[22rem] max-w-[calc(100vw-2rem)] flex-col overflow-hidden rounded-xl bg-white shadow-modal",
      )}
    >
      <div ref={bodyRef} className="flex-1 space-y-3 overflow-y-auto bg-neutral-50 px-4 py-3">
        {messages.length === 0 && (
          <p className="mt-6 text-center text-sm text-neutral-400">
            agentLakshmi
            <br />
            an innovative intelligent assistant
          </p>
        )}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "group flex items-center gap-1.5",
              message.sender === "user" ? "justify-start" : "justify-end",
            )}
          >
            {message.sender === "bot" && (
              <div
                className={cn(
                  "flex shrink-0 items-center gap-1 transition-opacity duration-150",
                  speakingMessageId === message.id
                    ? "opacity-100"
                    : "opacity-0 group-hover:opacity-100 focus-within:opacity-100",
                )}
              >
                {speakingMessageId === message.id && speakingPhase === "playing" && (
                  <span className="flex items-center gap-0.5" aria-hidden="true">
                    <span className="animate-sound-wave text-xs font-semibold leading-none text-brand-400 [animation-delay:-0.3s]">
                      )
                    </span>
                    <span className="animate-sound-wave text-xs font-semibold leading-none text-brand-400 [animation-delay:-0.15s]">
                      )
                    </span>
                    <span className="animate-sound-wave text-xs font-semibold leading-none text-brand-400">
                      )
                    </span>
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => void handleSpeakMessage(message)}
                  disabled={speakingMessageId !== null}
                  aria-label="Listen to this message"
                  className={cn(
                    "flex h-7 w-7 items-center justify-center rounded-full bg-white/60 text-neutral-600 backdrop-blur-sm transition hover:bg-white/80 disabled:cursor-not-allowed",
                    speakingMessageId === message.id &&
                      speakingPhase === "loading" &&
                      "animate-speaker-pulse",
                  )}
                >
                  <SpeakerIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm text-justify",
                "[&_p]:my-1.5 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0",
                "[&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4",
                "[&_strong]:font-semibold [&_a]:underline",
                message.sender === "user"
                  ? "bg-brand-400 text-white"
                  : "bg-white text-neutral-800 shadow-card",
              )}
            >
              {message.sender === "bot" ? (
                <ReactMarkdown
                  components={{
                    a: ({ ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
                  }}
                >
                  {normalizeBotMarkdown(message.text)}
                </ReactMarkdown>
              ) : (
                message.text
              )}
            </div>
          </div>
        ))}
        {isSending && (
          <div className="flex justify-end">
            <div className="flex items-center gap-1 rounded-lg bg-white px-3 py-2.5 shadow-card">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-neutral-200 bg-white px-3 py-3">
        {micError && (
          <p role="alert" className="mb-2 text-xs text-danger-500">
            {micError}
          </p>
        )}

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() =>
              isRecording ? handleStopRecording(true) : void handleStartRecording(false)
            }
            disabled={!isRecording && (textValue.trim().length > 0 || isTranscribing)}
            aria-label={isRecording ? "Stop recording" : "Send voice message"}
            className={cn(
              "flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-neutral-300 disabled:hover:bg-neutral-300",
              isRecording ? "bg-danger-500 hover:bg-danger-700" : "bg-brand-400 hover:bg-brand-500",
            )}
          >
            {isRecording ? <StopIcon className="h-4 w-4" /> : <MicIcon className="h-4 w-4" />}
          </button>
          <div className="relative flex-1">
            <input
              ref={textInputRef}
              type="text"
              value={textValue}
              onChange={(event) => setTextValue(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void handleSendText();
              }}
              disabled={isTranscribing}
              placeholder="message"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:bg-neutral-50"
            />
            {/* Covers the input while agentLakshmi's s2t call is in flight -
                the transcript replaces this in place once it resolves. */}
            {isTranscribing && (
              <div className="absolute inset-0 flex items-center justify-center gap-1 rounded-md border border-neutral-300 bg-white">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-neutral-400" />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => void handleSendText()}
            disabled={!textValue.trim() || isSending || isTranscribing}
            aria-label="Send"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-brand-400 text-white disabled:bg-neutral-300"
          >
            <SendIcon className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );

  if (chatPanelSlot) {
    return createPortal(dialog, chatPanelSlot);
  }

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
      {dialog}
    </div>
  );
}
