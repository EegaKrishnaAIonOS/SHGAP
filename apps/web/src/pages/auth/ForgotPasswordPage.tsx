import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { useAuth } from "../../context/AuthContext";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Step 1 of the reset flow: email in, generic "if this email exists"
 * response back — the same message whether or not the account exists, so
 * the UI can never be used to enumerate registered emails. */
export function ForgotPasswordPage() {
  const { t } = useTranslation();
  const { forgotPassword } = useAuth();

  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!EMAIL_PATTERN.test(email)) {
      setError(t("forgotPassword.emailInvalid"));
      return;
    }
    setSubmitting(true);
    try {
      const result = await forgotPassword(email);
      setMessage(result.message);
    } catch {
      setError(t("forgotPassword.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout
      title={t("forgotPassword.title")}
      subtitle={t("forgotPassword.subtitle")}
      footer={
        <Link to="/login" className="font-medium text-marketing-700 hover:underline">
          {t("forgotPassword.backToLogin")}
        </Link>
      }
    >
      {message ? (
        <p className="text-neutral-600">{message}</p>
      ) : (
        <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
          <Input
            label={t("forgotPassword.email")}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={error ?? undefined}
            required
          />
          <Button
            type="submit"
            fullWidth
            isLoading={submitting}
            className="!bg-marketing-600 hover:!bg-marketing-700"
          >
            {t("forgotPassword.submit")}
          </Button>
        </form>
      )}
    </AuthLayout>
  );
}
