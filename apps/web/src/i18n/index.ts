import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import te from "./locales/te.json";

export const SUPPORTED_LANGUAGES = ["en", "te"] as const;
export type SupportedLanguage = (typeof SUPPORTED_LANGUAGES)[number];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      te: { translation: te },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGUAGES,
    // Resources are bundled at build time (no async backend fetch), so we
    // can skip Suspense entirely — there's nothing to wait on.
    react: {
      useSuspense: false,
    },
    interpolation: {
      escapeValue: false, // React already escapes values.
    },
    detection: {
      // Persist the SHG member / official's chosen language across visits —
      // important for low-connectivity users who may reopen the PWA offline.
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "shgap.lang",
    },
  });

export default i18n;
