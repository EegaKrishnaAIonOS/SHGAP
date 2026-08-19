import { useState } from "react";
import type { FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useSearchParams } from "react-router-dom";
import { AuthLayout } from "../../components/AuthLayout";
import { Button } from "../../components/ui/Button";
import { PasswordInput } from "../../components/ui/PasswordInput";
import { useAuth } from "../../context/AuthContext";
import { ApiError } from "../../lib/api/httpClient";

const PASSWORD_PATTERN = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{8,}$/;

/** Step 2 of the reset flow: the token from the emailed link (see
 * AuthService.forgotPassword's resetUrl) plus a new password. */
export function ResetPasswordPage() {
  const { t } = useTranslation();
  const { resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") ?? "";

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<{ newPassword?: string; confirmPassword?: string }>({});
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitError(null);

    const nextErrors: typeof errors = {};
    if (!PASSWORD_PATTERN.test(newPassword)) {
      nextErrors.newPassword = t("resetPassword.passwordWeak");
    }
    if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = t("resetPassword.passwordMismatch");
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await resetPassword(token, newPassword, confirmPassword);
      setDone(true);
    } catch (err) {
      setSubmitError(err instanceof ApiError ? err.message : t("resetPassword.networkError"));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title={t("resetPassword.title")}>
        <p className="text-danger-500">{t("resetPassword.missingToken")}</p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title={t("resetPassword.title")}>
        <p className="text-neutral-600">{t("resetPassword.success")}</p>
        <Link
          to="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-marketing-600 px-5 font-medium text-white hover:bg-marketing-700"
        >
          {t("resetPassword.goToLogin")}
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title={t("resetPassword.title")} subtitle={t("resetPassword.subtitle")}>
      <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <PasswordInput
          label={t("resetPassword.newPassword")}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
          showStrengthMeter
          required
        />
        <PasswordInput
          label={t("resetPassword.confirmPassword")}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          required
        />
        {submitError && (
          <p role="alert" className="text-sm text-danger-500">
            {submitError}
          </p>
        )}
        <Button
          type="submit"
          fullWidth
          isLoading={submitting}
          className="!bg-marketing-600 hover:!bg-marketing-700"
        >
          {t("resetPassword.submit")}
        </Button>
      </form>
    </AuthLayout>
  );
}
