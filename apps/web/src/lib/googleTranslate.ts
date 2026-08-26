// Drives Google's client-side Website Translator widget from our own UI
// (see components/TranslateMenu.tsx) instead of showing its default banner.
// There's no standard browser API a page can call to force its own native
// translate feature to a specific target language — Chrome/Edge/Firefox all
// keep that behind a manual, user-triggered address-bar control for privacy
// reasons — so this widget (loaded from translate.google.com) is the
// practical way to offer an in-app "translate to X" control.
export type TranslateLanguage = "en" | "te" | "hi";

const WIDGET_CONTAINER_ID = "google_translate_element";
const INCLUDED_LANGUAGES: TranslateLanguage[] = ["en", "te", "hi"];
const COMBO_POLL_INTERVAL_MS = 200;
const COMBO_POLL_MAX_ATTEMPTS = 25;

declare global {
  interface Window {
    google?: {
      translate: {
        TranslateElement: {
          new (
            options: {
              pageLanguage: string;
              includedLanguages: string;
              autoDisplay: boolean;
            },
            containerId: string,
          ): unknown;
          InlineLayout: Record<string, unknown>;
        };
      };
    };
    googleTranslateElementInit?: () => void;
  }
}

let widgetReadyPromise: Promise<void> | null = null;

function ensureHiddenContainer(): void {
  if (document.getElementById(WIDGET_CONTAINER_ID)) return;
  const container = document.createElement("div");
  container.id = WIDGET_CONTAINER_ID;
  // Off-screen rather than display:none — Google's script needs the element
  // to actually lay out to attach its <select>, so a hard `display:none`
  // container is unreliable in some browsers.
  container.style.position = "absolute";
  container.style.left = "-9999px";
  container.style.top = "0";
  document.body.appendChild(container);
}

function loadWidgetScript(): Promise<void> {
  if (widgetReadyPromise) return widgetReadyPromise;

  widgetReadyPromise = new Promise((resolve) => {
    ensureHiddenContainer();
    window.googleTranslateElementInit = () => {
      new window.google!.translate.TranslateElement(
        {
          pageLanguage: "en",
          includedLanguages: INCLUDED_LANGUAGES.join(","),
          autoDisplay: false,
        },
        WIDGET_CONTAINER_ID,
      );
      resolve();
    };

    const script = document.createElement("script");
    script.src =
      "https://translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
    script.async = true;
    document.body.appendChild(script);
  });

  return widgetReadyPromise;
}

function findReadyComboBox(): HTMLSelectElement | null {
  const combo = document.querySelector<HTMLSelectElement>("select.goog-te-combo");
  // Google populates the <select> asynchronously after constructing
  // TranslateElement — a combo with only its placeholder option is still
  // mid-setup and will get its value clobbered once population finishes.
  return combo && combo.options.length > 1 ? combo : null;
}

function waitForReadyComboBox(attemptsLeft: number): Promise<HTMLSelectElement | null> {
  return new Promise((resolve) => {
    const combo = findReadyComboBox();
    if (combo) {
      resolve(combo);
      return;
    }
    if (attemptsLeft <= 0) {
      resolve(null);
      return;
    }
    setTimeout(() => resolve(waitForReadyComboBox(attemptsLeft - 1)), COMBO_POLL_INTERVAL_MS);
  });
}

function clearTranslateCookie(): void {
  document.cookie = "googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/";
  document.cookie = `googtrans=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; domain=${window.location.hostname}`;
}

// The widget's own (hidden — see index.css) banner carries a "Show
// original" button that restores the untranslated text in place, with no
// reload. Its id is instance-numbered (e.g. ":1.restore") but always ends
// in ".restore", and it lives inside a same-origin iframe we can reach via
// contentDocument.
function findRestoreButton(): HTMLButtonElement | null {
  const banner = document.querySelector<HTMLIFrameElement>("iframe.skiptranslate");
  return (
    banner?.contentDocument?.querySelector<HTMLButtonElement>('button[id$=".restore"]') ?? null
  );
}

function waitForRestoreButton(attemptsLeft: number): Promise<HTMLButtonElement | null> {
  return new Promise((resolve) => {
    const button = findRestoreButton();
    if (button) {
      resolve(button);
      return;
    }
    if (attemptsLeft <= 0) {
      resolve(null);
      return;
    }
    setTimeout(() => resolve(waitForRestoreButton(attemptsLeft - 1)), COMBO_POLL_INTERVAL_MS);
  });
}

/** Reads the widget's own `googtrans=/en/<lang>` cookie to recover which
 * language is currently active — e.g. so an icon can reflect it on mount,
 * since we don't otherwise track this state anywhere ourselves. */
export function getActiveTranslateLanguage(): TranslateLanguage {
  const match = document.cookie.match(/googtrans=\/[^/]*\/([a-z-]+)/);
  const target = match?.[1];
  return target === "te" || target === "hi" ? target : "en";
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function selectComboLanguage(combo: HTMLSelectElement, lang: TranslateLanguage): void {
  combo.value = lang;
  combo.dispatchEvent(new Event("change"));
}

/** Switch the live page to `lang`, or back to the original English with "en". */
export async function setTranslateLanguage(lang: TranslateLanguage): Promise<void> {
  if (lang === "en") {
    if (getActiveTranslateLanguage() === "en") {
      // Nothing was translated in the first place — no-op.
      clearTranslateCookie();
      return;
    }

    const restoreButton = await waitForRestoreButton(COMBO_POLL_MAX_ATTEMPTS);
    if (restoreButton) {
      // Clicking the widget's own "Show original" control restores the
      // untranslated text instantly, in place — no reload — and it clears
      // the googtrans cookie itself as part of doing so.
      restoreButton.click();
      return;
    }

    // Couldn't find the restore control (e.g. the widget hasn't finished
    // reinitializing yet after a fast reload) even though a translation is
    // supposedly active per the cookie — fall back to the guaranteed-correct
    // but jarring reload rather than leaving stale translated content up.
    clearTranslateCookie();
    window.location.reload();
    return;
  }

  await loadWidgetScript();
  const combo = await waitForReadyComboBox(COMBO_POLL_MAX_ATTEMPTS);
  if (!combo) return;

  selectComboLanguage(combo, lang);

  // The widget can briefly reset the combo's value while it finishes
  // settling right after population — reassert once after a short delay
  // so a same-tick race doesn't silently leave the wrong language active.
  await delay(400);
  if (combo.value !== lang) selectComboLanguage(combo, lang);
}

/**
 * Re-applies whatever language is currently active (per the `googtrans`
 * cookie) — a no-op if that's English. The widget only ever translates the
 * document content that existed at the moment it runs; it does NOT follow
 * along when the app-body iframe (see LandingPage.tsx) navigates to a new
 * page, since that's a brand new document in a separate browsing context
 * the widget was never told about. Call this after every iframe navigation
 * (its `onLoad`) and on top-level app mount (a plain page reload also loses
 * the widget instance, even though the cookie survives) to keep newly
 * loaded content in sync with whatever language the reader picked earlier.
 */
export function reapplyActiveTranslateLanguage(): void {
  const active = getActiveTranslateLanguage();
  if (active !== "en") {
    void setTranslateLanguage(active);
  }
}
