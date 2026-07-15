/**
 * Minimal class-name combinator (a tiny stand-in for `clsx`) so the
 * component library doesn't need an extra runtime dependency.
 * Falsy values are dropped; everything else is joined with a space.
 */
export type ClassValue = string | number | null | undefined | false;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
