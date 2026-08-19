import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api/httpClient";

type Status = "verifying" | "success" | "error";

/** Lands here from the link in the verification email — auto-verifies on
 * mount using the token in the URL (see AuthService.verifyEmail on the
 * backend). No form to fill in; this is a one-click confirmation page. */
export function VerifyEmailPage() {
  const { t } = useTranslation();
  const { verifyEmail, resendVerification } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [status, setStatus] = useState<Status>(token ? "verifying" : "error");
  const [message, setMessage] = useState<string | null>(null);

  const [resendEmail, setResendEmail] = useState("");
  const [resendSubmitting, setResendSubmitting] = useState(false);
  const [resendMessage, setResendMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    verifyEmail(token)
      .then((result) => {
        if (cancelled) return;
        setMessage(result.message);
        setStatus("success");
      })
      .catch((err) => {
        if (cancelled) return;
        setMessage(err instanceof ApiError ? err.message : t("verifyEmail.networkError"));
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [token, verifyEmail, t]);

  async function handleResend() {
    if (!resendEmail || resendSubmitting) return;
    setResendSubmitting(true);
    setResendMessage(null);
    try {
      const result = await resendVerification(resendEmail);
      setResendMessage(result.message);
    } catch {
      setResendMessage(t("verifyEmail.networkError"));
    } finally {
      setResendSubmitting(false);
    }
  }

  return (
    <AuthLayout title={t("verifyEmail.title")}>
      {status === "verifying" && <p className="text-neutral-600">{t("verifyEmail.verifying")}</p>}

      {status === "success" && (
        <>
          <p className="text-neutral-600">{message}</p>
          <Link
            to="/login"
            className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-marketing-600 px-5 font-medium text-white hover:bg-marketing-700"
          >
            {t("verifyEmail.goToLogin")}
          </Link>
        </>
      )}

      {status === "error" && (
        <div className="flex flex-col gap-4">
          <p role="alert" className="text-danger-500">
            {message ?? t("verifyEmail.missingToken")}
          </p>

          {resendMessage ? (
            <p className="text-neutral-600">{resendMessage}</p>
          ) : (
            <>
              <p className="text-sm text-neutral-500">{t("verifyEmail.resendHint")}</p>
              <Input
                label={t("verifyEmail.email")}
                type="email"
                value={resendEmail}
                onChange={(e) => setResendEmail(e.target.value)}
              />
              <Button
                onClick={() => void handleResend()}
                isLoading={resendSubmitting}
                fullWidth
                className="!bg-marketing-600 hover:!bg-marketing-700"
              >
                {t("verifyEmail.resendSubmit")}
              </Button>
            </>
          )}
        </div>
      )}
    </AuthLayout>
  );
}
