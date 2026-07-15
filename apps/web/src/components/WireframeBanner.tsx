import { useTranslation } from "react-i18next";

/**
 * Shown on every wireframe screen so it's unmistakable, in the running app
 * itself, that this is a low-fidelity structural wireframe (T04) rather
 * than a finished, data-connected screen. See apps/web/README.md for the
 * "why code instead of Figma" rationale.
 */
export function WireframeBanner() {
  const { t } = useTranslation();
  return (
    <p className="mb-4 rounded-md border border-dashed border-neutral-300 bg-neutral-100 px-3 py-2 text-xs text-neutral-500">
      {t("common.wireframeNotice")}
    </p>
  );
}
