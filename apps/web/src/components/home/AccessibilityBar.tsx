import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Landmark } from "lucide-react";

const FONT_SCALES = [100, 112, 125] as const;

/**
 * Top utility strip mimicking a real Indian government portal's letterhead
 * bar (e.g. india.gov.in) — always bilingual regardless of the app's own
 * EN/Telugu toggle, since this identity line is brand/letterhead text, not
 * page content. The emblem is a placeholder (Landmark icon in a circle) —
 * this project has no licensed AP Government emblem asset; swap in the real
 * one before this ever goes in front of the public.
 */
export function AccessibilityBar() {
  const { t } = useTranslation();
  const [scaleIndex, setScaleIndex] = useState(0);

  function setFontScale(index: number) {
    setScaleIndex(index);
    document.documentElement.style.fontSize = `${FONT_SCALES[index]}%`;
  }

  return (
    <div className="bg-indigo-950 text-indigo-100">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-1.5 text-xs sm:px-6">
        <div className="flex items-center gap-2">
          <span
            className="flex h-5 w-5 items-center justify-center rounded-full bg-amber-400 text-indigo-950"
            aria-hidden="true"
          >
            <Landmark size={12} strokeWidth={2.5} />
          </span>
          <span className="hidden sm:inline">
            Government of Andhra Pradesh / ఆంధ్రప్రదేశ్ ప్రభుత్వం
          </span>
          <span className="sm:hidden">Govt. of Andhra Pradesh</span>
          <span className="hidden text-indigo-400 md:inline">•</span>
          <span className="hidden text-indigo-300 md:inline">{t("home.department")}</span>
        </div>

        <div
          className="flex items-center gap-1"
          role="group"
          aria-label={t("home.fontSizeControl")}
        >
          <span className="hidden text-indigo-300 sm:inline">{t("home.fontSizeControl")}</span>
          {FONT_SCALES.map((scale, index) => (
            <button
              key={scale}
              type="button"
              aria-pressed={scaleIndex === index}
              aria-label={t("home.fontSizeOption", { percent: scale })}
              onClick={() => setFontScale(index)}
              className={`h-5 w-5 rounded text-xs font-semibold leading-none transition-colors ${
                scaleIndex === index
                  ? "bg-amber-400 text-indigo-950"
                  : "text-indigo-200 hover:bg-indigo-800"
              }`}
            >
              A
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}