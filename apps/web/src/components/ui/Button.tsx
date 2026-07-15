import { forwardRef } from "react";
import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "../../lib/cn";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg" | "touch";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Stretch the button to fill its container width (common on mobile forms). */
  fullWidth?: boolean;
  /** Shows a spinner and disables the button, without shifting its label. */
  isLoading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-brand-400 text-white hover:bg-brand-500 active:bg-brand-600 disabled:bg-neutral-300",
  secondary:
    "bg-neutral-100 text-neutral-800 hover:bg-neutral-200 active:bg-neutral-300 disabled:text-neutral-400",
  outline:
    "border border-neutral-300 text-neutral-800 hover:bg-neutral-50 active:bg-neutral-100 disabled:text-neutral-400",
  ghost: "text-neutral-700 hover:bg-neutral-100 active:bg-neutral-200 disabled:text-neutral-400",
  danger:
    "bg-danger-500 text-white hover:bg-danger-700 active:bg-danger-700 disabled:bg-neutral-300",
};

// "touch" is the default size floor for SHG-facing screens: a full 48px tap
// target with generous horizontal padding for Telugu copy, which tends to
// run visually taller/wider than the equivalent English string.
const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm gap-1.5",
  md: "h-11 px-4 text-base gap-2",
  lg: "h-12 px-5 text-lg gap-2",
  touch: "min-h-touch px-6 text-lg gap-2.5",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "primary",
    size = "md",
    fullWidth = false,
    isLoading = false,
    leftIcon,
    rightIcon,
    disabled,
    className,
    children,
    ...rest
  },
  ref,
) {
  return (
    <button
      ref={ref}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 focus-visible:ring-offset-2",
        "disabled:cursor-not-allowed",
        variantClasses[variant],
        sizeClasses[size],
        fullWidth && "w-full",
        className,
      )}
      {...rest}
    >
      {isLoading ? (
        <span
          className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent"
          aria-hidden="true"
        />
      ) : (
        leftIcon
      )}
      {children}
      {!isLoading && rightIcon}
    </button>
  );
});
