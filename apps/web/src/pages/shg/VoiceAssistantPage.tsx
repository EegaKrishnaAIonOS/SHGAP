import { useState } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "../../lib/cn";
import { WireframeBanner } from "../../components/WireframeBanner";

interface TranscriptEntry {
  speaker: "user" | "assistant";
  text: string;
}

/**
 * Voice assistant wireframe — the primary interaction surface for
 * low-literacy / low-typing users. A single oversized mic button dominates
 * the screen (no menus to parse), with a transcript area below and a row of
 * tappable "quick command" suggestions so first-time users know what to
 * say. Speech capture itself is stubbed (T04 is structure only); the real
 * voice pipeline lands with the voice-service integration in a later
 * sprint.
 */
export function VoiceAssistantPage() {
  const { t, i18n } = useTranslation();
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);

  const quickCommands = [
    t("voice.quickCommand1"),
    t("voice.quickCommand2"),
    t("voice.quickCommand3"),
  ];

  function simulateCommand(text: string) {
    setTranscript((prev) => [
      ...prev,
      { speaker: "user", text },
      { speaker: "assistant", text: t("voice.sampleAssistant") },
    ]);
  }

  return (
    <div className="flex flex-col items-center">
      <div className="w-full">
        <WireframeBanner />
      </div>
      <h1 className="mb-1 text-xl font-semibold text-neutral-900">{t("voice.title")}</h1>
      <p className="mb-6 text-sm text-neutral-500">
        {t("voice.languageLabel")}:{" "}
        {i18n.resolvedLanguage === "te" ? t("common.telugu") : t("common.english")}
      </p>

      <button
        type="button"
        aria-pressed={listening}
        onClick={() => setListening((v) => !v)}
        className={cn(
          "flex h-32 w-32 items-center justify-center rounded-full text-5xl text-white shadow-raised transition-colors",
          listening ? "bg-danger-500" : "bg-brand-400",
        )}
      >
        <span aria-hidden="true">🎙️</span>
        <span className="sr-only">{listening ? t("voice.listening") : t("voice.tapToSpeak")}</span>
      </button>
      <p className="mt-3 text-lg font-medium text-neutral-700" aria-live="polite">
        {listening ? t("voice.listening") : t("voice.tapToSpeak")}
      </p>

      <div className="mt-6 w-full">
        <p className="mb-2 text-sm font-medium text-neutral-500">{t("voice.quickCommandsLabel")}</p>
        <div className="flex flex-col gap-2">
          {quickCommands.map((cmd) => (
            <button
              key={cmd}
              type="button"
              onClick={() => simulateCommand(cmd)}
              className="min-h-touch rounded-md border border-neutral-200 bg-white px-4 text-left text-base text-neutral-700 hover:bg-neutral-50"
            >
              {cmd}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 w-full flex-1 rounded-md border border-neutral-200 bg-white p-3">
        {transcript.length === 0 ? (
          <p className="text-center text-sm text-neutral-400">{t("voice.transcriptEmpty")}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {transcript.map((entry, i) => (
              <li
                key={i}
                className={cn(
                  "max-w-[85%] rounded-lg px-3 py-2 text-sm",
                  entry.speaker === "user"
                    ? "ml-auto bg-brand-50 text-brand-700"
                    : "mr-auto bg-neutral-100 text-neutral-700",
                )}
              >
                {entry.text}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
