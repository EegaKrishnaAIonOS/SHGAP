import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { LanguageToggle } from "./LanguageToggle";

export interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Rendered below the form card — e.g. "Don't have an account? Register". */
  footer?: ReactNode;
}

/**
 * Shared two-column shell for the public auth surfaces (signup, password
 * login, forgot/reset password): branding/illustration on the left,
 * form card on the right on desktop; a single stacked column on mobile
 * (logo -> heading -> form -> footer), per the signup/login layout spec.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  const { t } = useTranslation();

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <div className="flex flex-col justify-between bg-marketing-700 px-6 py-8 text-white lg:w-1/2 lg:px-16 lg:py-12">
        <Link to="/" className="text-xl font-semibold">
          {t("common.appName")}
        </Link>
        <div className="hidden lg:block">
          <p className="max-w-md text-3xl font-semibold leading-tight">
            {t("landing.hero.headline")}
          </p>
          <p className="mt-4 max-w-md text-marketing-100">{t("landing.hero.subtext")}</p>
        </div>
        <p className="hidden text-sm text-marketing-200 lg:block">
          {t("landing.footer.copyright", { year: new Date().getFullYear() })}
        </p>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-6">
        <div className="mb-4 flex w-full max-w-md justify-end">
          <LanguageToggle />
        </div>
        <div className="w-full max-w-md rounded-lg border border-neutral-200 bg-white p-6 shadow-card sm:p-8">
          <h1 className="text-2xl font-semibold text-neutral-900">{title}</h1>
          {subtitle && <p className="mt-1 text-sm text-neutral-500">{subtitle}</p>}
          <div className="mt-6">{children}</div>
        </div>
        {footer && <div className="mt-4 w-full max-w-md text-center text-sm">{footer}</div>}
      </div>
    </div>
  );
}
