/**
 * Design tokens for the SHGAP web app.
 *
 * This is the single source of truth for colour, spacing and typography
 * values. `tailwind.config.ts` imports this file so that Tailwind utility
 * classes and any hand-written CSS/JS stay in sync with the same palette.
 *
 * Users of this app are bimodal:
 *  - SHG members: Telugu-first, low-end Android phones, low digital
 *    literacy -> large touch targets, high-contrast colours, minimal text.
 *  - Officials (district/ULB/state, admin): desktop power users -> denser
 *    layouts, more neutral/data-oriented colours, smaller comfortable text.
 *
 * The `touch` spacing tokens exist specifically to keep SHG-facing tap
 * targets at/above the 44-48px accessibility recommendation.
 */

export const colors = {
  // Brand purple, taken from the existing favicon/brand mark so the design
  // system doesn't invent a competing palette.
  brand: {
    50: "#f5eeff",
    100: "#ede6ff",
    200: "#d9c3ff",
    300: "#c084fc",
    400: "#aa3bff",
    500: "#8a2be6",
    600: "#7e14ff",
    700: "#63189c",
    800: "#4a1275",
    900: "#320c4e",
  },
  // Secondary accent (used for links / info states in charts & tables).
  sky: {
    50: "#eef9ff",
    100: "#d9f2ff",
    200: "#b0e4ff",
    300: "#47bfff",
    400: "#1aa3f0",
    500: "#0d84c9",
    600: "#0a67a0",
  },
  neutral: {
    0: "#ffffff",
    50: "#f9f9fb",
    100: "#f4f3ec",
    200: "#e5e4e7",
    300: "#d1cfd6",
    400: "#9ca3af",
    500: "#6b6375",
    600: "#4b4650",
    700: "#332f38",
    800: "#1f2028",
    900: "#08060d",
  },
  success: {
    50: "#eafaf0",
    500: "#1b9c5a",
    700: "#0f6b3d",
  },
  warning: {
    50: "#fff8e6",
    500: "#c9821a",
    700: "#8f5a0d",
  },
  danger: {
    50: "#fdecec",
    500: "#d0342c",
    700: "#961f19",
  },
  info: {
    50: "#eef4ff",
    500: "#2f5fd0",
    700: "#1f3f8f",
  },
} as const;

// 4px base spacing scale, plus dedicated "touch" tokens for minimum
// accessible tap-target sizing on SHG-facing (mobile-first) screens.
export const spacing = {
  touchSm: "2.75rem", // 44px - WCAG minimum
  touch: "3rem", // 48px - comfortable default for low-literacy/mobile UI
  touchLg: "3.5rem", // 56px - primary CTAs (e.g. voice assistant mic button)
} as const;

export const fontFamily = {
  // Latin-script UI text (English copy, numerals, official/admin surfaces).
  sans: ['"Noto Sans"', "system-ui", '"Segoe UI"', "Roboto", "sans-serif"],
  // Telugu-script UI text. Falls back to Noto Sans / system UI for any
  // Latin characters mixed into the same string (product names, numerals).
  telugu: ['"Noto Sans Telugu"', '"Noto Sans"', "system-ui", "sans-serif"],
  mono: ["ui-monospace", "Consolas", "monospace"],
} as const;

export const fontSize = {
  xs: ["0.75rem", { lineHeight: "1.4" }],
  sm: ["0.875rem", { lineHeight: "1.45" }],
  base: ["1rem", { lineHeight: "1.5" }],
  lg: ["1.125rem", { lineHeight: "1.5" }],
  xl: ["1.25rem", { lineHeight: "1.4" }],
  "2xl": ["1.5rem", { lineHeight: "1.3" }],
  "3xl": ["1.875rem", { lineHeight: "1.25" }],
  "4xl": ["2.25rem", { lineHeight: "1.2" }],
  // Extra-large size reserved for the primary SHG-facing CTA/mic button
  // labels, kept legible for low-literacy users at arm's length.
  display: ["2.75rem", { lineHeight: "1.15" }],
} as const;

export const borderRadius = {
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  full: "9999px",
} as const;

export const boxShadow = {
  card: "0 1px 2px 0 rgba(8, 6, 13, 0.06), 0 1px 3px 0 rgba(8, 6, 13, 0.08)",
  raised: "0 4px 6px -2px rgba(8, 6, 13, 0.08), 0 10px 15px -3px rgba(8, 6, 13, 0.1)",
  modal: "0 10px 15px -3px rgba(8, 6, 13, 0.25), 0 4px 6px -2px rgba(8, 6, 13, 0.15)",
} as const;
