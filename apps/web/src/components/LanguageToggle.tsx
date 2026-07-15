import { useTranslation } from "react-i18next";
import { cn } from "../lib/cn";
import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "../i18n";

const LANGUAGE_LABEL: Record<SupportedLanguage, string> = {
  en: "EN",
  te: "తె",
};

export interface LanguageToggleProps {
  /** Use the larger touch-friendly variant on SHG-facing mobile screens. */
  size?: "sm" | "touch";
}

/** Two-way English / Telugu switch, persisted to localStorage via i18next. */
export function LanguageToggle({ size = "sm" }: LanguageToggleProps) {
  const { i18n, t } = useTranslation();
  const current = (i18n.resolvedLanguage ?? "en") as SupportedLanguage;

  return (
    <div
      role="group"
      aria-label={t("common.language")}
      className={cn(
        "inline-flex items-center rounded-full border border-neutral-200 bg-white p-0.5",
        size === "touch" && "p-1",
      )}
    >
      {SUPPORTED_LANGUAGES.map((lng) => {
        const active = lng === current;
        return (
          <button
            key={lng}
            type="button"
            aria-pressed={active}
            onClick={() => void i18n.changeLanguage(lng)}
            className={cn(
              "rounded-full font-medium transition-colors",
              size === "touch" ? "min-h-touch-sm px-4 text-base" : "h-8 px-3 text-sm",
              active ? "bg-brand-400 text-white" : "text-neutral-600 hover:bg-neutral-100",
            )}
          >
            {LANGUAGE_LABEL[lng]}
          </button>
        );
      })}
    </div>
  );
}
