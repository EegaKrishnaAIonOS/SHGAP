import { forwardRef, useId } from "react";
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { cn } from "../../lib/cn";

export type FieldSize = "md" | "touch";

const fieldSizeClasses: Record<FieldSize, string> = {
  md: "h-10 px-3 text-base",
  // Large tap target + text for SHG-facing forms (registration, catalogue
  // search) used by low-digital-literacy, Telugu-first members.
  touch: "min-h-touch px-4 text-lg",
};

interface FieldChromeProps {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  fieldSize?: FieldSize;
}

export interface InputProps
  extends FieldChromeProps, Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  leftAddon?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { label, hint, error, required, fieldSize = "md", leftAddon, id, className, ...rest },
  ref,
) {
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
        {leftAddon && <span className="absolute left-3 text-neutral-400">{leftAddon}</span>}
        <input
          ref={ref}
          id={inputId}
          required={required}
          aria-invalid={Boolean(error) || undefined}
          aria-describedby={cn(hintId, errorId) || undefined}
          className={cn(
            "w-full rounded-md border bg-white text-neutral-900 placeholder:text-neutral-400",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
            "disabled:bg-neutral-100 disabled:text-neutral-400",
            error ? "border-danger-500" : "border-neutral-300",
            fieldSizeClasses[fieldSize],
            leftAddon && "pl-9",
            className,
          )}
          {...rest}
        />
      </div>
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
});

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps
  extends FieldChromeProps, Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  options: SelectOption[];
  placeholder?: string;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { label, hint, error, required, fieldSize = "md", options, placeholder, id, className, ...rest },
  ref,
) {
  const autoId = useId();
  const selectId = id ?? autoId;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={selectId} className="text-sm font-medium text-neutral-700">
        {label}
        {required && (
          <span className="text-danger-500" aria-hidden="true">
            {" "}
            *
          </span>
        )}
      </label>
      <select
        ref={ref}
        id={selectId}
        required={required}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={cn(hintId, errorId) || undefined}
        className={cn(
          "w-full rounded-md border bg-white text-neutral-900",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-1",
          "disabled:bg-neutral-100 disabled:text-neutral-400",
          error ? "border-danger-500" : "border-neutral-300",
          fieldSizeClasses[fieldSize],
          className,
        )}
        {...rest}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
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
});
