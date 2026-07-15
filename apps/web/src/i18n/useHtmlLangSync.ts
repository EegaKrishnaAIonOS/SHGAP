import { useEffect } from "react";
import { useTranslation } from "react-i18next";

/**
 * Keeps <html lang="..."> in sync with the active i18next language.
 * This drives the `html[lang="te"] body { font-family: ... }` rule in
 * index.css so Telugu content always renders with Noto Sans Telugu, and
 * also keeps assistive tech / browser translation features correctly
 * informed of the page language.
 */
export function useHtmlLangSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    document.documentElement.lang = i18n.language;
    const handleLanguageChanged = (lng: string) => {
      document.documentElement.lang = lng;
    };
    i18n.on("languageChanged", handleLanguageChanged);
    return () => i18n.off("languageChanged", handleLanguageChanged);
  }, [i18n]);
}
