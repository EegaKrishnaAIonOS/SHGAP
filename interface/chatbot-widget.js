/**
 * Floating support chatbot, self-injected into every static page in this
 * folder (login/signup/register + the SHG/retailer/consumer dashboards).
 * Chat replies are mocked - there is no backend endpoint for this yet -
 * but voice capture itself is real (MediaRecorder + getUserMedia).
 */
(function () {
  var HISTORY_KEY = "shgap.chatbot.sessions";
  var CURRENT_KEY = "shgap.chatbot.current";
  var MAX_STORED_SESSIONS = 20;
  var LONG_PRESS_MS = 500;
  // Recording itself never auto-stops - only a follow-up click ends it.
  // Instead, a 4-second gap with no detected speech flushes whatever's been
  // captured so far as its own transcribable chunk (via
  // MediaRecorder.requestData(), which hands over the buffered audio
  // without stopping the recorder), then keeps listening. Mirrors the React
  // app's FloatingChatWidget exactly. Sarvam's REST STT endpoint
  // hard-rejects clips over 30s, so a gap this short (well under a natural
  // mid-sentence pause) keeps chunks well clear of that limit too.
  var SILENCE_CHUNK_MS = 4000;
  var SILENCE_CHECK_INTERVAL_MS = 300;
  // Heuristic RMS threshold on byte time-domain data (0-1 scale, 0 = digital
  // silence) below which the mic input counts as "no speech".
  var SILENCE_RMS_THRESHOLD = 0.02;
  // Same same-origin proxy as apps/web/src/lib/api/voice.ts's VOICE_API_BASE
  // (Vite in dev, nginx in prod) - these static pages are served through the
  // same host, so the relative path resolves the same way.
  var VOICE_API_BASE = "/voice-api";
  // Same idea, proxied to the standalone inference/ guidance agent (run via
  // the "inference" workspace's `dev` script on port 8090).
  var GUIDANCE_API_BASE = "/guidance-api";

  // One-shot batch transcription for a fully-recorded clip. Never rejects -
  // resolves to "" on any failure so a transcription hiccup falls back to
  // the widget's plain duration bubble instead of breaking the send.
  function transcribeAudio(blob) {
    var form = new FormData();
    form.append("file", blob, "recording.webm");
    return fetch(VOICE_API_BASE + "/api/transcribe", { method: "POST", body: form })
      .then(function (res) {
        if (!res.ok) return "";
        return res.json().then(function (data) {
          return (data && data.transcript) || "";
        });
      })
      .catch(function () {
        return "";
      });
  }

  // Asks the guidance agent to locate the page element a free-text question
  // is about (e.g. a long-press dictation's transcript). Resolves to `null`
  // on any failure rather than rejecting - this is a best-effort lookup.
  function requestGuidance(question) {
    return fetch(GUIDANCE_API_BASE + "/api/guidance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: question }),
    })
      .then(function (res) {
        if (!res.ok) return null;
        return res.json();
      })
      .catch(function () {
        return null;
      });
  }

  // One-shot batch TTS for spoken feedback (e.g. the guidance agent's
  // message). Resolves to `null` on any failure rather than rejecting.
  function speakText(text, language) {
    return fetch(VOICE_API_BASE + "/api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: text, language: language }),
    })
      .then(function (res) {
        if (!res.ok) return null;
        return res.blob();
      })
      .catch(function () {
        return null;
      });
  }

  // Plays a one-off audio Blob (the guidance agent's spoken message) and
  // releases its object URL once playback ends or fails to start.
  function playAudioBlob(blob) {
    var url = URL.createObjectURL(blob);
    var audio = new Audio(url);
    audio.addEventListener(
      "ended",
      function () {
        URL.revokeObjectURL(url);
      },
      { once: true },
    );
    audio.play().catch(function () {
      URL.revokeObjectURL(url);
    });
  }

  // Stops `recorder` and resolves with its complete recording as a Blob.
  //
  // This is deliberately a full stop(), not requestData() mid-stream: a
  // WebM/Opus container's header is only written once, at the very start of
  // a recording session - requestData() clears the buffer but does NOT
  // re-emit that header, so every chunk after the first one comes back as a
  // headerless fragment that Sarvam (and most decoders) can't read on its
  // own ("Failed to read the file, please check the audio format").
  // Stopping and starting a brand-new MediaRecorder on the same underlying
  // stream for each chunk (see startRecorderSegment) gives every chunk its
  // own valid, independently-decodable header instead.
  function captureRecorderChunk(recorder) {
    return new Promise(function (resolve) {
      function handleData(event) {
        recorder.removeEventListener("dataavailable", handleData);
        resolve(event.data);
      }
      recorder.addEventListener("dataavailable", handleData);
      recorder.stop();
    });
  }

  var ICONS = {
    chat: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12c0-4.42 3.58-8 8-8s8 3.58 8 8-3.58 8-8 8c-1.13 0-2.2-.23-3.17-.66L4 20l1.02-4.24A7.94 7.94 0 0 1 4 12Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    close:
      '<svg viewBox="0 0 20 20" fill="none"><path d="M5 5l10 10M15 5 5 15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    pointer:
      '<svg viewBox="0 0 24 24" fill="none"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3Z" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    history:
      '<svg viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="7.5" stroke="currentColor" stroke-width="1.5"/><path d="M10 6v4l3 2" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    back: '<svg viewBox="0 0 20 20" fill="none"><path d="M12.5 4.5 6 10l6.5 5.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    send: '<svg viewBox="0 0 20 20" fill="none"><path d="M17.5 2.5 2.5 8.75l5.63 2.12L10.25 17.5 17.5 2.5Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
    mic: '<svg viewBox="0 0 20 20" fill="none"><rect x="7" y="2.5" width="6" height="10" rx="3" stroke="currentColor" stroke-width="1.5"/><path d="M4.5 9.5a5.5 5.5 0 0 0 11 0M10 15v2.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
    stop: '<svg viewBox="0 0 20 20" fill="currentColor"><rect x="5" y="5" width="10" height="10" rx="1.5"/></svg>',
  };

  var STRINGS = {
    title: "SHG Assistant",
    openLabel: "Open chat assistant",
    stopRecording: "Stop recording",
    close: "Close",
    historyLabel: "Chat history",
    historyTitle: "Previous conversations",
    newChat: "New chat",
    noHistory: "No previous conversations yet.",
    emptyState: "Ask us anything, by text or voice.",
    textOption: "Text",
    voiceOption: "Voice",
    inputPlaceholder: "Type your message...",
    recording: "Recording",
    voiceMessagePreview: "Voice message",
    micUnsupported: "Voice messages aren't supported in this browser.",
    micDenied:
      "Microphone access was denied. Please allow microphone access to send a voice message.",
    autoReplyText: "Thanks for your message! Our support team will get back to you shortly.",
    autoReplyVoice: "Thanks for your voice message! Our support team will get back to you shortly.",
  };

  function loadSessions() {
    try {
      var raw = localStorage.getItem(HISTORY_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  function saveSessions(sessions) {
    try {
      localStorage.setItem(HISTORY_KEY, JSON.stringify(sessions.slice(0, MAX_STORED_SESSIONS)));
    } catch (err) {
      // localStorage may be unavailable (private mode / quota) - history just won't persist.
    }
  }

  // The "current" record is the live, possibly-unfinished conversation and
  // panel open/closed state - separate from HISTORY_KEY's list of finished
  // sessions. Every page here is a full document load (not a single-page
  // app), so without this, navigating from one page to another would reset
  // the widget to a blank, closed state every time.
  function loadCurrent() {
    try {
      var raw = localStorage.getItem(CURRENT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function saveCurrent(current) {
    try {
      localStorage.setItem(CURRENT_KEY, JSON.stringify(current));
    } catch (err) {
      // localStorage may be unavailable (private mode / quota) - state just won't carry over.
    }
  }

  function formatDuration(totalSeconds) {
    var minutes = Math.floor(totalSeconds / 60);
    var seconds = totalSeconds % 60;
    return minutes + ":" + String(seconds).padStart(2, "0");
  }

  function escapeHtml(value) {
    var div = document.createElement("div");
    div.textContent = value;
    return div.innerHTML;
  }

  // Short synthesized "ding" - no audio asset needed - played both when
  // long-press starts listening and when a follow-up click stops it, so the
  // same sound confirms both transitions. Mirrors the React app's
  // FloatingChatWidget tone exactly.
  var sharedAudioContext = null;
  function playNotificationTone() {
    try {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;
      if (!sharedAudioContext) {
        sharedAudioContext = new AudioContextClass();
      }
      var ctx = sharedAudioContext;
      if (ctx.state === "suspended") {
        ctx.resume();
      }
      var oscillator = ctx.createOscillator();
      var gain = ctx.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = 880;
      gain.gain.setValueAtTime(0.0001, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.18);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start();
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (err) {
      // Web Audio unavailable/blocked - the visual ripple is still enough feedback.
    }
  }

  var idCounter = 0;
  function createId(prefix) {
    idCounter += 1;
    return prefix + "-" + Date.now() + "-" + idCounter;
  }

  function init() {
    var root = document.createElement("div");
    root.className = "cbw-root";
    root.setAttribute("data-open", "false");
    root.innerHTML =
      '<div class="cbw-panel">' +
      '<div class="cbw-header">' +
      '<button type="button" class="cbw-icon-btn cbw-history-toggle" aria-label="' +
      STRINGS.historyLabel +
      '">' +
      ICONS.history +
      "</button>" +
      '<span class="cbw-title">' +
      STRINGS.title +
      "</span>" +
      '<button type="button" class="cbw-icon-btn cbw-close-btn" aria-label="' +
      STRINGS.close +
      '">' +
      ICONS.close +
      "</button>" +
      "</div>" +
      '<div class="cbw-body"><p class="cbw-empty">' +
      STRINGS.emptyState +
      "</p></div>" +
      '<div class="cbw-footer">' +
      '<p class="cbw-mic-error" hidden></p>' +
      '<div class="cbw-footer-default">' +
      '<div class="cbw-footer-row">' +
      '<button type="button" class="cbw-btn cbw-text-btn">' +
      STRINGS.textOption +
      "</button>" +
      '<button type="button" class="cbw-btn cbw-btn-primary cbw-voice-btn">' +
      ICONS.mic +
      " " +
      STRINGS.voiceOption +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="cbw-footer-text" hidden>' +
      '<div class="cbw-text-row">' +
      '<input type="text" class="cbw-text-input" placeholder="' +
      STRINGS.inputPlaceholder +
      '" />' +
      '<button type="button" class="cbw-send-btn" disabled aria-label="Send">' +
      ICONS.send +
      "</button>" +
      "</div>" +
      "</div>" +
      '<div class="cbw-footer-voice" hidden>' +
      '<div class="cbw-voice-row">' +
      '<span class="cbw-rec-dot" aria-hidden="true"></span>' +
      '<span class="cbw-rec-label">' +
      STRINGS.recording +
      ' &middot; <span class="cbw-rec-timer">0:00</span></span>' +
      '<button type="button" class="cbw-stop-btn" aria-label="Stop recording">' +
      ICONS.stop +
      "</button>" +
      "</div>" +
      "</div>" +
      "</div>" +
      '<div class="cbw-history" hidden>' +
      '<div class="cbw-history-header">' +
      '<button type="button" class="cbw-icon-btn cbw-history-back" aria-label="Back to chat" style="color: var(--text);">' +
      ICONS.back +
      "</button>" +
      '<span class="cbw-history-title">' +
      STRINGS.historyTitle +
      "</span>" +
      '<button type="button" class="cbw-history-new">' +
      STRINGS.newChat +
      "</button>" +
      "</div>" +
      '<div class="cbw-history-list"></div>' +
      "</div>" +
      "</div>" +
      '<button type="button" class="cbw-trigger" aria-label="' +
      STRINGS.openLabel +
      '" aria-expanded="false">' +
      '<span class="cbw-ripple-group" aria-hidden="true">' +
      '<span class="cbw-ripple" style="animation-delay: 0ms"></span>' +
      '<span class="cbw-ripple" style="animation-delay: 600ms"></span>' +
      '<span class="cbw-ripple" style="animation-delay: 1200ms"></span>' +
      '<span class="cbw-ripple" style="animation-delay: 1800ms"></span>' +
      "</span>" +
      '<span class="cbw-trigger-icon">' +
      ICONS.chat +
      "</span>" +
      "</button>";

    document.body.appendChild(root);

    var panel = root.querySelector(".cbw-panel");
    var trigger = root.querySelector(".cbw-trigger");
    var triggerIcon = root.querySelector(".cbw-trigger-icon");
    var closeBtn = root.querySelector(".cbw-close-btn");
    var body = root.querySelector(".cbw-body");
    var footerDefault = root.querySelector(".cbw-footer-default");
    var footerText = root.querySelector(".cbw-footer-text");
    var footerVoice = root.querySelector(".cbw-footer-voice");
    var micErrorEl = root.querySelector(".cbw-mic-error");
    var textBtn = root.querySelector(".cbw-text-btn");
    var voiceBtn = root.querySelector(".cbw-voice-btn");
    var textInput = root.querySelector(".cbw-text-input");
    var sendBtn = root.querySelector(".cbw-send-btn");
    var stopBtn = root.querySelector(".cbw-stop-btn");
    var recTimerEl = root.querySelector(".cbw-rec-timer");
    var historyPanel = root.querySelector(".cbw-history");
    var historyToggle = root.querySelector(".cbw-history-toggle");
    var historyBack = root.querySelector(".cbw-history-back");
    var historyNewBtn = root.querySelector(".cbw-history-new");
    var historyList = root.querySelector(".cbw-history-list");

    // Resume the same in-progress conversation (and panel open/closed state)
    // this tab was left in on whichever page you were on before - rather
    // than always starting blank, which is what made every page feel like a
    // separate, disconnected chatbot instead of one consistent assistant.
    var restored = loadCurrent();
    var state = {
      sessionId: restored ? restored.sessionId : createId("session"),
      messages: restored ? restored.messages : [],
      mediaRecorder: null,
      mediaStream: null,
      timer: null,
      elapsedSec: 0,
      listening: false,
      analyser: null,
      silenceCheckInterval: null,
      lastActivityAt: 0,
      isFlushingChunk: false,
      // Guards the silence-triggered flush: without it, staying silent the
      // whole time (nobody spoke yet) would still fire a flush - and another
      // API call - every SILENCE_CHUNK_MS forever. Only set once real speech
      // is detected, cleared again after each flush.
      hasSpeechSinceFlush: false,
      // Long-press is meant to be pure dictation - unlike the footer's
      // "Voice" button (an actual chat turn), it should never trigger the
      // mocked bot auto-reply. Set per recording session in startRecording.
      isLongPressSession: false,
      // Cleans up whichever page element the guidance agent last
      // highlighted - set by applyGuidanceHighlight, cleared on focus of
      // that element or when the long-press session ends (stopRecording).
      clearGuidanceHighlight: null,
    };
    var longPressTimer = null;
    var longPressTriggered = false;

    function clearLongPressTimer() {
      if (longPressTimer) {
        clearTimeout(longPressTimer);
        longPressTimer = null;
      }
    }

    function setListening(isListening) {
      state.listening = isListening;
      trigger.setAttribute("data-listening", isListening ? "true" : "false");
      trigger.setAttribute("aria-pressed", isListening ? "true" : "false");
      // Panel only ever toggles open/closed while not listening (the click
      // handler intercepts clicks during listening to stop it instead), so
      // it's safe to always own the trigger icon/label here.
      triggerIcon.innerHTML = isListening ? ICONS.pointer : ICONS.chat;
      trigger.setAttribute("aria-label", isListening ? STRINGS.stopRecording : STRINGS.openLabel);
    }

    function persistLive() {
      saveCurrent({
        sessionId: state.sessionId,
        messages: state.messages,
        isOpen: root.getAttribute("data-open") === "true",
      });
    }

    function setFooterMode(mode) {
      footerDefault.hidden = mode !== "default";
      footerText.hidden = mode !== "text";
      footerVoice.hidden = mode !== "voice";
      if (mode === "text") {
        textInput.focus();
      }
    }

    function renderMessages() {
      if (state.messages.length === 0) {
        body.innerHTML = '<p class="cbw-empty">' + STRINGS.emptyState + "</p>";
        return;
      }
      body.innerHTML = state.messages
        .map(function (message) {
          var rowClass =
            "cbw-msg-row " + (message.sender === "user" ? "cbw-msg-user" : "cbw-msg-bot");
          var voiceText = message.transcript
            ? escapeHtml(message.transcript)
            : "Voice message (" + formatDuration(message.durationSec || 0) + ")";
          var content =
            message.kind === "text"
              ? escapeHtml(message.text)
              : '<span class="cbw-voice-bubble">' + ICONS.mic + " " + voiceText + "</span>";
          return (
            '<div class="' + rowClass + '"><div class="cbw-bubble">' + content + "</div></div>"
          );
        })
        .join("");
      body.scrollTop = body.scrollHeight;
    }

    function appendMessage(message) {
      message.id = createId("msg");
      message.timestamp = Date.now();
      state.messages.push(message);
      renderMessages();
      persistLive();
    }

    function sendBotReply(text) {
      window.setTimeout(function () {
        appendMessage({ sender: "bot", kind: "text", text: text });
      }, 600);
    }

    function openPanel() {
      root.setAttribute("data-open", "true");
      triggerIcon.innerHTML = ICONS.close;
      trigger.setAttribute("aria-expanded", "true");
      trigger.setAttribute("aria-label", STRINGS.close);
      persistLive();
    }

    function closePanel() {
      root.setAttribute("data-open", "false");
      triggerIcon.innerHTML = ICONS.chat;
      trigger.setAttribute("aria-expanded", "false");
      trigger.setAttribute("aria-label", STRINGS.openLabel);
      historyPanel.hidden = true;
      if (state.mediaRecorder) stopRecording(false);
      persistLive();
    }

    // Long-pressing the launcher starts listening in place, without opening
    // the chat panel; a follow-up tap (below) stops it. Mirrors the React
    // app's FloatingChatWidget so the gesture works the same on every page.
    trigger.addEventListener("pointerdown", function (event) {
      if (event.button !== 0 || state.listening || state.mediaRecorder) return;
      longPressTriggered = false;
      clearLongPressTimer();
      longPressTimer = setTimeout(function () {
        longPressTriggered = true;
        playNotificationTone();
        setListening(true);
        startRecording(true);
      }, LONG_PRESS_MS);
    });
    trigger.addEventListener("pointerup", clearLongPressTimer);
    trigger.addEventListener("pointerleave", clearLongPressTimer);
    trigger.addEventListener("pointercancel", clearLongPressTimer);
    trigger.addEventListener("contextmenu", function (event) {
      event.preventDefault();
    });

    trigger.addEventListener("click", function () {
      // Releasing the finger/mouse after the long-press fires a native click
      // on this same element - swallow just that one so recording keeps
      // going until a genuinely separate, later click stops it.
      if (longPressTriggered) {
        longPressTriggered = false;
        return;
      }
      if (state.listening || state.mediaRecorder) {
        playNotificationTone();
        setListening(false);
        stopRecording(true);
        return;
      }
      if (root.getAttribute("data-open") === "true") {
        closePanel();
      } else {
        openPanel();
      }
    });
    closeBtn.addEventListener("click", closePanel);

    textBtn.addEventListener("click", function () {
      setFooterMode("text");
    });

    function handleSendText() {
      var value = textInput.value.trim();
      if (!value) return;
      appendMessage({ sender: "user", kind: "text", text: value });
      textInput.value = "";
      sendBtn.disabled = true;
      sendBotReply(STRINGS.autoReplyText);
    }

    textInput.addEventListener("input", function () {
      sendBtn.disabled = !textInput.value.trim();
    });
    textInput.addEventListener("keydown", function (event) {
      if (event.key === "Enter") handleSendText();
      if (event.key === "Escape") setFooterMode("default");
    });
    sendBtn.addEventListener("click", handleSendText);

    function showMicError(message) {
      micErrorEl.textContent = message;
      micErrorEl.hidden = false;
    }

    function clearMicError() {
      micErrorEl.hidden = true;
      micErrorEl.textContent = "";
    }

    function stopSilenceWatcher() {
      if (state.silenceCheckInterval) {
        clearInterval(state.silenceCheckInterval);
        state.silenceCheckInterval = null;
      }
      if (state.analyser) state.analyser.disconnect();
      state.analyser = null;
    }

    // Starts a fresh MediaRecorder on the same already-permitted mic stream -
    // used both for the very first segment and to reopen listening right
    // after each silence-triggered chunk (see captureRecorderChunk's comment
    // for why a new recorder, not requestData(), is what makes each chunk
    // independently decodable).
    function startRecorderSegment(stream) {
      var recorder = new MediaRecorder(stream);
      state.mediaRecorder = recorder;
      recorder.start();
    }

    // Highlights the element the guidance agent pointed to, until either it
    // gets focused or the long-press session ends (stopRecording also calls
    // state.clearGuidanceHighlight). Deliberately does NOT eval() the
    // agent's `override_code` string - that's LLM-generated text arriving
    // over the network, and executing it as code would be a real injection
    // risk. Reproducing the same visual effect (a gray glow) directly from
    // the structured `element_id` field alone gets the identical result
    // safely.
    function applyGuidanceHighlight(elementId) {
      if (state.clearGuidanceHighlight) state.clearGuidanceHighlight();
      var el = document.getElementById(elementId);
      if (!el) return;
      var originalBoxShadow = el.style.boxShadow;
      el.style.boxShadow = "0 0 10px 4px gray";
      function clear() {
        el.style.boxShadow = originalBoxShadow;
        el.removeEventListener("focus", clear);
        state.clearGuidanceHighlight = null;
      }
      el.addEventListener("focus", clear, { once: true });
      state.clearGuidanceHighlight = clear;
    }

    // Grabs whatever's been recorded since the last flush and sends it to
    // voice-service's batch STT endpoint. `isFinal` (manual stop) always
    // surfaces a message, falling back to a plain duration bubble if
    // transcription comes back empty - a deliberate stop should never look
    // like it silently did nothing. A silence-triggered chunk (`isFinal`
    // false) only surfaces a message when there's actual transcribed text,
    // so a long pause with nothing said doesn't spam the chat with empty
    // voice bubbles.
    function flushChunk(isFinal) {
      var recorder = state.mediaRecorder;
      var stream = state.mediaStream;
      var duration = state.elapsedSec;
      var skipBotReply = state.isLongPressSession;
      // Captured before any reset below - this decides whether the chunk
      // we're about to grab is even worth a network call. Without this, a
      // manual stop right after a silence-chunk already fired would still
      // call /api/transcribe again for whatever few frames of near-silence
      // the fresh segment picked up in between, even though nothing new was
      // actually said.
      var hadSpeech = state.hasSpeechSinceFlush;
      if (!recorder || recorder.state === "inactive" || state.isFlushingChunk) {
        if (isFinal && duration > 0 && !state.isFlushingChunk) {
          state.elapsedSec = 0;
          appendMessage({ sender: "user", kind: "voice", durationSec: duration });
          if (!skipBotReply) sendBotReply(STRINGS.autoReplyVoice);
        }
        return Promise.resolve();
      }
      state.isFlushingChunk = true;
      state.elapsedSec = 0;
      state.hasSpeechSinceFlush = false;
      recTimerEl.textContent = "0:00";
      return captureRecorderChunk(recorder)
        .then(function (blob) {
          // Reopen listening immediately on the same stream (not final) rather
          // than waiting on the transcription network round-trip below, so
          // there's no audible gap in what's being captured.
          if (!isFinal && stream && stream.active) {
            startRecorderSegment(stream);
          }
          if (blob.size > 0 && hadSpeech) {
            return transcribeAudio(blob).then(function (transcript) {
              // Long-press is pure dictation, feeding the guidance agent
              // (inference/route.py) rather than the mocked chat reply - the
              // transcript becomes its `question`, and the agent's response
              // (which page element it thinks you meant, if any) is what gets
              // surfaced here, not the raw transcript. The footer's "Voice"
              // button (an actual chat turn) keeps the labeled transcript log.
              var afterGuidance = Promise.resolve();
              if (skipBotReply) {
                if (transcript) {
                  afterGuidance = requestGuidance(transcript).then(function (guidance) {
                    console.log(guidance);
                    if (guidance && guidance.element_id) {
                      applyGuidanceHighlight(guidance.element_id);
                    }
                    if (guidance && guidance.message) {
                      // This prototype has no language toggle (unlike the
                      // React app's i18n) - defaults to English, matching its
                      // hardcoded STRINGS.
                      return speakText(guidance.message, "en").then(function (audioBlob) {
                        if (audioBlob) playAudioBlob(audioBlob);
                      });
                    }
                  });
                }
              } else {
                console.log("[chatbot] transcribed chunk:", transcript);
              }
              return afterGuidance.then(function () {
                if (transcript || isFinal) {
                  appendMessage({
                    sender: "user",
                    kind: "voice",
                    durationSec: duration,
                    transcript: transcript || undefined,
                  });
                  if (!skipBotReply) sendBotReply(STRINGS.autoReplyVoice);
                }
              });
            });
          }
          if (isFinal && duration > 0) {
            appendMessage({ sender: "user", kind: "voice", durationSec: duration });
            if (!skipBotReply) sendBotReply(STRINGS.autoReplyVoice);
          }
        })
        .then(function () {
          state.isFlushingChunk = false;
        });
    }

    // Polls mic input volume every SILENCE_CHECK_INTERVAL_MS; once
    // SILENCE_CHUNK_MS passes with nothing above SILENCE_RMS_THRESHOLD,
    // flushes a chunk and resets the clock so the next silence gap can
    // trigger again.
    function startSilenceWatcher(stream) {
      try {
        var AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        if (!sharedAudioContext) {
          sharedAudioContext = new AudioContextClass();
        }
        var ctx = sharedAudioContext;
        if (ctx.state === "suspended") ctx.resume();

        var source = ctx.createMediaStreamSource(stream);
        var analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        state.analyser = analyser;

        var samples = new Uint8Array(analyser.fftSize);
        state.lastActivityAt = Date.now();
        state.silenceCheckInterval = setInterval(function () {
          analyser.getByteTimeDomainData(samples);
          var sumSquares = 0;
          for (var i = 0; i < samples.length; i += 1) {
            var normalized = (samples[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          var rms = Math.sqrt(sumSquares / samples.length);
          if (rms > SILENCE_RMS_THRESHOLD) {
            state.lastActivityAt = Date.now();
            state.hasSpeechSinceFlush = true;
            return;
          }
          if (state.hasSpeechSinceFlush && Date.now() - state.lastActivityAt >= SILENCE_CHUNK_MS) {
            // flushChunk itself resets state.hasSpeechSinceFlush right at entry.
            state.lastActivityAt = Date.now();
            flushChunk(false);
          }
        }, SILENCE_CHECK_INTERVAL_MS);
      } catch (err) {
        // Silence-based chunking is a nice-to-have - if the Web Audio graph
        // can't be built, recording still works via the manual stop, it just
        // won't auto-chunk on long pauses.
      }
    }

    function startRecording(fromLongPress) {
      state.isLongPressSession = fromLongPress;
      state.hasSpeechSinceFlush = false;
      clearMicError();
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        showMicError(STRINGS.micUnsupported);
        setListening(false);
        return;
      }
      navigator.mediaDevices
        .getUserMedia({ audio: true })
        .then(function (stream) {
          state.mediaStream = stream;
          startRecorderSegment(stream);
          state.elapsedSec = 0;
          recTimerEl.textContent = "0:00";
          setFooterMode("voice");
          setListening(true);
          state.timer = setInterval(function () {
            state.elapsedSec += 1;
            recTimerEl.textContent = formatDuration(state.elapsedSec);
          }, 1000);
          startSilenceWatcher(stream);
        })
        .catch(function () {
          showMicError(STRINGS.micDenied);
          setListening(false);
        });
    }

    function stopRecording(shouldSend) {
      setListening(false);
      if (state.timer) {
        clearInterval(state.timer);
        state.timer = null;
      }
      stopSilenceWatcher();
      // "Stopping the long-press interaction" is the other trigger (besides
      // focusing the highlighted element) that clears a still-active
      // guidance highlight - no-ops if none is active.
      if (state.clearGuidanceHighlight) state.clearGuidanceHighlight();
      if (shouldSend) {
        // Wait for the final chunk's dataavailable/stop (inside flushChunk)
        // before releasing the mic, so nothing gets cut off mid-flush.
        flushChunk(true).then(releaseMediaStream);
      } else {
        var recorder = state.mediaRecorder;
        if (recorder && recorder.state !== "inactive") {
          recorder.stop();
        }
        releaseMediaStream();
      }
      state.elapsedSec = 0;
      setFooterMode("default");
    }

    function releaseMediaStream() {
      if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(function (track) {
          track.stop();
        });
        state.mediaStream = null;
      }
      state.mediaRecorder = null;
    }

    voiceBtn.addEventListener("click", function () {
      startRecording(false);
    });
    stopBtn.addEventListener("click", function () {
      stopRecording(true);
    });

    function persistCurrentSession() {
      if (state.messages.length === 0) return;
      var session = {
        id: state.sessionId,
        startedAt: state.messages[0].timestamp,
        messages: state.messages,
      };
      var next = [session].concat(
        loadSessions().filter(function (s) {
          return s.id !== session.id;
        }),
      );
      saveSessions(next);
    }

    function renderHistoryList() {
      var sessions = loadSessions();
      if (sessions.length === 0) {
        historyList.innerHTML = '<p class="cbw-history-empty">' + STRINGS.noHistory + "</p>";
        return;
      }
      historyList.innerHTML = sessions
        .map(function (session, index) {
          var firstText = session.messages.filter(function (m) {
            return m.kind === "text";
          })[0];
          var preview = firstText ? escapeHtml(firstText.text) : STRINGS.voiceMessagePreview;
          var time = new Date(session.startedAt).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "numeric",
            minute: "2-digit",
          });
          return (
            '<button type="button" class="cbw-history-item" data-index="' +
            index +
            '"><span class="cbw-history-preview">' +
            preview +
            '</span><span class="cbw-history-time">' +
            time +
            "</span></button>"
          );
        })
        .join("");

      Array.prototype.forEach.call(
        historyList.querySelectorAll(".cbw-history-item"),
        function (item) {
          item.addEventListener("click", function () {
            var session = sessions[Number(item.getAttribute("data-index"))];
            persistCurrentSession();
            state.sessionId = session.id;
            state.messages = session.messages;
            renderMessages();
            historyPanel.hidden = true;
            setFooterMode("default");
            persistLive();
          });
        },
      );
    }

    historyToggle.addEventListener("click", function () {
      renderHistoryList();
      historyPanel.hidden = false;
    });
    historyBack.addEventListener("click", function () {
      historyPanel.hidden = true;
    });
    historyNewBtn.addEventListener("click", function () {
      persistCurrentSession();
      state.sessionId = createId("session");
      state.messages = [];
      renderMessages();
      historyPanel.hidden = true;
      setFooterMode("default");
      persistLive();
    });

    // Pick up right where the previous page left off: same conversation,
    // and the panel open if it was open there.
    renderMessages();
    if (restored && restored.isOpen) {
      openPanel();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
