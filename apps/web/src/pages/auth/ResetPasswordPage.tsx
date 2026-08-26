import { useState } from "react";
import type { FormEvent } from "react";
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
      nextErrors.newPassword =
        "Password must contain at least 8 characters, including an uppercase letter, a lowercase letter, a number, and a special character.";
    }
    if (confirmPassword !== newPassword) {
      nextErrors.confirmPassword = "Passwords do not match.";
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    setSubmitting(true);
    try {
      await resetPassword(token, newPassword, confirmPassword);
      setDone(true);
    } catch (err) {
      setSubmitError(
        err instanceof ApiError ? err.message : "Couldn't reach the server. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout title="Reset password">
        <p className="text-danger-500">
          This reset link is invalid. Please request a new one from the forgot password page.
        </p>
      </AuthLayout>
    );
  }

  if (done) {
    return (
      <AuthLayout title="Reset password">
        <p className="text-neutral-600">Password updated. You can now log in.</p>
        <Link
          to="/login"
          className="mt-6 inline-flex h-11 w-full items-center justify-center rounded-md bg-marketing-600 px-5 font-medium text-white hover:bg-marketing-700"
        >
          Go to login
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout title="Reset password" subtitle="Choose a new password for your account.">
      <form className="flex flex-col gap-4" onSubmit={(e) => void handleSubmit(e)}>
        <PasswordInput
          label="New Password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          error={errors.newPassword}
          showStrengthMeter
          required
        />
        <PasswordInput
          label="Confirm Password"
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
          Update password
        </Button>
      </form>
    </AuthLayout>
  );
}
