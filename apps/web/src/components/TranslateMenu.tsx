import { useEffect, useRef, useState } from "react";
import { cn } from "../lib/cn";
import { IconChip } from "./ui/IconChip";
import { Tooltip } from "./ui/Tooltip";
import {
  getActiveTranslateLanguage,
  reapplyActiveTranslateLanguage,
  setTranslateLanguage,
  type TranslateLanguage,
} from "../lib/googleTranslate";

const LANGUAGE_OPTIONS: TranslateLanguage[] = ["en", "te", "hi"];

// Each language's own name for itself, in its own script — used for the
// dropdown's option labels, so "English"/"తెలుగు"/"हिन्दी" always read as
// themselves regardless of which language is currently active. Must carry
// `notranslate` wherever rendered (see below) — otherwise Google's widget
// tries to translate these labels too once active, e.g. turning "हिन्दी"
// into something else entirely once some *other* language is selected.
//
// Deliberately the full native word, not a short abbreviation ("తె"/"हि"):
// an isolated consonant+vowel-sign combo that short renders as the wrong
// glyph entirely in some environments (confirmed on Telugu AND Hindi here,
// even after confirming via document.fonts.load() that the right font face
// was fully loaded) — the full word gives the text-shaping engine enough
// context to render correctly and consistently.
const NATIVE_LANGUAGE_NAME: Record<TranslateLanguage, string> = {
  en: "English",
  te: "తెలుగు",
  hi: "हिन्दी",
};
const LANGUAGE_FONT_CLASS: Record<TranslateLanguage, string> = {
  en: "",
  te: "font-telugu",
  hi: "font-devanagari",
};

/**
 * Mirrors GovtLinksMenu's icon-in-a-bar-that-opens-a-dropdown pattern, at
 * the opposite (left) end of the same footer divider bar (see AppShell) —
 * unlike GovtLinksMenu's bar near the top, this one sits near the bottom of
 * the viewport, so its dropdown opens upward instead of down to avoid
 * clipping under the viewport edge. Picking Telugu/Hindi hands off to
 * Google's Website Translator widget (lib/googleTranslate.ts) to translate
 * the live page in place; English restores the original text in place too,
 * via the widget's own hidden "Show original" control (see
 * setTranslateLanguage) — no reload for any of the three options.
 */
export function TranslateMenu() {
  const [isOpen, setIsOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [activeLanguage, setActiveLanguage] = useState<TranslateLanguage>("en");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setActiveLanguage(getActiveTranslateLanguage());
    // The `googtrans` cookie survives a reload, but the widget itself
    // doesn't — it's only ever constructed when this component drives it,
    // so a plain page reload/revisit would otherwise silently fall back to
    // English content even though a translation was previously active.
    // Re-applying here keeps the live page in sync with it on every load.
    // (The app-body iframe navigating on its own — see LandingPage.tsx's
    // onLoad — needs the same re-apply and is handled separately there,
    // since this component doesn't remount for that.)
    reapplyActiveTranslateLanguage();
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    function handlePointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  async function handleSelect(lang: TranslateLanguage) {
    setIsOpen(false);
    setIsSwitching(true);
    try {
      await setTranslateLanguage(lang);
      setActiveLanguage(lang);
    } finally {
      setIsSwitching(false);
    }
  }

  return (
    <div ref={containerRef} className="relative flex h-full items-center">
      <Tooltip label="language">
        <button
          type="button"
          onClick={() => setIsOpen((open) => !open)}
          disabled={isSwitching}
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label="Translate this page"
          className="flex items-center justify-center disabled:opacity-50"
        >
          <IconChip active={isOpen}>
            {/* Fixed icon-style label — deliberately not the active language's
                name; this button's job is just to open the picker. */}
            <span className="notranslate text-[8px] font-bold leading-none">{"<\\:/>"}</span>
          </IconChip>
        </button>
      </Tooltip>

      {/* bottom-full/left-0 are relative to this h-full container (the bar's
          own height, not just the icon's own small box) so the dropdown
          starts flush with the bar's top edge and the icon's left edge,
          instead of appearing to float up out of the icon's vertical
          center partway through the bar. */}
      {isOpen && (
        <div
          role="menu"
          aria-label="Translate this page"
          className="absolute bottom-full left-0 z-20 min-w-[160px] rounded-md border border-neutral-200 bg-white py-1"
        >
          {LANGUAGE_OPTIONS.map((lang) => (
            <button
              key={lang}
              type="button"
              role="menuitem"
              aria-current={lang === activeLanguage}
              onClick={() => handleSelect(lang)}
              className={cn(
                "notranslate block w-full px-3 py-2 text-center text-sm text-neutral-800 hover:bg-neutral-100",
                lang === activeLanguage && "bg-neutral-100",
                LANGUAGE_FONT_CLASS[lang],
              )}
            >
              {NATIVE_LANGUAGE_NAME[lang]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
