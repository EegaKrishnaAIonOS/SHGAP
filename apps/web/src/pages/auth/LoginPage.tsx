import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card, CardTitle } from "../../components/ui/Card";
import { LanguageToggle } from "../../components/LanguageToggle";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api/httpClient";

const PHONE_PATTERN = /^[6-9]\d{9}$/;

type Step = "phone" | "otp";

/**
 * Phone-OTP login: the only gate in front of every registry screen, since
 * all core-api endpoints besides request-otp/verify-otp require a Bearer
 * token. No password, matching the low-digital-literacy SHG-member
 * audience — same UX principle the old wireframe's step-3 OTP block used.
 */
export function LoginPage() {
  const { t } = useTranslation();
  const { isAuthenticated, requestOtp, verifyOtp } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isAuthenticated) {
    const redirectTo = (location.state as { from?: string } | null)?.from ?? "/catalogue";
    return <Navigate to={redirectTo} replace />;
  }

  async function handleSendOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!PHONE_PATTERN.test(phone)) {
      setError(t("login.phoneInvalid"));
      return;
    }
    setIsSubmitting(true);
    try {
      await requestOtp(phone);
      setStep("otp");
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleVerifyOtp(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!/^\d{4,8}$/.test(otp)) {
      setError(t("login.otpInvalid"));
      return;
    }
    setIsSubmitting(true);
    try {
      await verifyOtp(phone, otp);
      const redirectTo = (location.state as { from?: string } | null)?.from ?? "/catalogue";
      navigate(redirectTo, { replace: true });
    } catch (err) {
      setError(describeError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-lg font-semibold text-neutral-900">{t("common.appName")}</h1>
        <LanguageToggle size="touch" />
      </div>

      <Card>
        <CardTitle className="mb-1">{t("login.title")}</CardTitle>
        <p className="mb-4 text-sm text-neutral-500">
          {step === "phone" ? t("login.phoneSubtitle") : t("login.otpSubtitle", { phone })}
        </p>

        {step === "phone" ? (
          <form className="flex flex-col gap-4" onSubmit={(e) => void handleSendOtp(e)}>
            <Input
              label={t("registration.phoneNumber")}
              type="tel"
              inputMode="numeric"
              maxLength={10}
              fieldSize="touch"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))}
              error={error ?? undefined}
              required
            />
            <Button type="submit" size="touch" fullWidth isLoading={isSubmitting}>
              {t("registration.sendOtp")}
            </Button>
          </form>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(e) => void handleVerifyOtp(e)}>
            <Input
              label={t("registration.otp")}
              inputMode="numeric"
              maxLength={8}
              fieldSize="touch"
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
              error={error ?? undefined}
              required
            />
            <Button type="submit" size="touch" fullWidth isLoading={isSubmitting}>
              {t("registration.verify")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="touch"
              fullWidth
              onClick={() => {
                setStep("phone");
                setOtp("");
                setError(null);
              }}
            >
              {t("login.changeNumber")}
            </Button>
          </form>
        )}
      </Card>
    </div>
  );
}

function describeError(err: unknown, t: (key: string) => string): string {
  if (err instanceof ApiError) {
    if (err.status === 401) return t("login.otpIncorrect");
    return err.message;
  }
  return t("login.networkError");
}
