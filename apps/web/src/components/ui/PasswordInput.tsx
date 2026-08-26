import { forwardRef, useId, useState } from "react";
import type { InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn";
import type { FieldSize } from "./Input";

function EyeIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M1.5 10S4.5 4 10 4s8.5 6 8.5 6-3 6-8.5 6-8.5-6-8.5-6Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="10" cy="10" r="2.5" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5" aria-hidden="true">
      <path
        d="M2.5 2.5l15 15M8.03 4.24A8.6 8.6 0 0 1 10 4c5.5 0 8.5 6 8.5 6a15.3 15.3 0 0 1-2.6 3.42M6.1 6.1C3.5 7.7 1.5 10 1.5 10s3 6 8.5 6c1.06 0 2.02-.22 2.87-.58M11.77 11.77a2.5 2.5 0 0 1-3.54-3.54"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export type PasswordStrength = "weak" | "medium" | "strong";

/** Scores against: min length, uppercase, lowercase, number, special
 * character — same signals called out in the registration spec's password
 * requirements list. */
export function scorePasswordStrength(password: string): {
  score: number;
  strength: PasswordStrength;
} {
  const checks = [
    password.length >= 8,
    /[A-Z]/.test(password),
    /[a-z]/.test(password),
    /\d/.test(password),
    /[^A-Za-z0-9]/.test(password),
  ];
  const score = checks.filter(Boolean).length;
  const strength: PasswordStrength = score <= 2 ? "weak" : score <= 4 ? "medium" : "strong";
  return { score, strength };
}

const STRENGTH_BAR_CLASSES: Record<PasswordStrength, string> = {
  weak: "w-1/3 bg-danger-500",
  medium: "w-2/3 bg-warning-500",
  strong: "w-full bg-success-500",
};

const STRENGTH_LABELS: Record<PasswordStrength, string> = {
  weak: "Weak",
  medium: "Medium",
  strong: "Strong",
};

export function PasswordStrengthMeter({ password }: { password: string }) {
  const { strength } = scorePasswordStrength(password);

  if (!password) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-200">
        <div className={cn("h-full rounded-full transition-all", STRENGTH_BAR_CLASSES[strength])} />
      </div>
      <span className="text-xs font-medium text-neutral-500">{STRENGTH_LABELS[strength]}</span>
    </div>
  );
}

export interface PasswordInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "size" | "type"
> {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  fieldSize?: FieldSize;
  /** Shows the strength meter + requirements hint below the field — only for a *new* password (register/reset), never for a login password field. */
  showStrengthMeter?: boolean;
}

const fieldSizeClasses: Record<FieldSize, string> = {
  md: "h-10 pl-3 pr-10 text-base",
  touch: "min-h-touch pl-4 pr-12 text-lg",
};

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput(
    {
      label,
      hint,
      error,
      required,
      fieldSize = "md",
      showStrengthMeter,
      id,
      className,
      value,
      ...rest
    },
    ref,
  ) {
    const [visible, setVisible] = useState(false);
    const autoId = useId();
    const inputId = id ?? autoId;
    const hintId = hint ? `${inputId}-hint` : undefined;
    const errorId = error ? `${inputId}-error` : undefined;

    return (
      <div className="flex flex-col gap-1.5">
        <label htmlFor={inputId} className="text-sm font-medium text-neutral-700">
          {label}
          {required && (
            <span className="text-danger-500" aria-hidden="true">
              {" "}
              *
            </span>
          )}
        </label>
        <div className="relative flex items-center">
          <input
            ref={ref}
            id={inputId}
            type={visible ? "text" : "password"}
            required={required}
            value={value}
            aria-invalid={Boolean(error) || undefined}
            aria-describedby={cn(hintId, errorId) || undefined}
            className={cn(
              "w-full rounded-md border bg-white text-neutral-900 placeholder:text-neutral-400",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
              "disabled:bg-neutral-100 disabled:text-neutral-400",
              error ? "border-danger-500" : "border-neutral-300",
              fieldSizeClasses[fieldSize],
              className,
            )}
            {...rest}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-label={visible ? "Hide password" : "Show password"}
            aria-pressed={visible}
            className="absolute right-3 text-neutral-400 hover:text-neutral-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1 rounded"
          >
            {visible ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        </div>
        {showStrengthMeter && (
          <PasswordStrengthMeter password={typeof value === "string" ? value : ""} />
        )}
        {hint && !error && (
          <p id={hintId} className="text-sm text-neutral-500">
            {hint}
          </p>
        )}
        {error && (
          <p id={errorId} role="alert" className="text-sm text-danger-500">
            {error}
          </p>
        )}
      </div>
    );
  },
);
