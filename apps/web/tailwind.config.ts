import type { Config } from "tailwindcss";
import {
  colors,
  spacing,
  fontFamily,
  fontSize,
  borderRadius,
  boxShadow,
} from "./src/design-tokens";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  darkMode: "media",
  theme: {
    extend: {
      colors: {
        brand: colors.brand,
        sky: colors.sky,
        neutral: colors.neutral,
        success: colors.success,
        warning: colors.warning,
        danger: colors.danger,
        info: colors.info,
        marketing: colors.marketing,
      },
      spacing: {
        "touch-sm": spacing.touchSm,
        touch: spacing.touch,
        "touch-lg": spacing.touchLg,
      },
      fontFamily: {
        sans: fontFamily.sans,
        telugu: fontFamily.telugu,
        devanagari: fontFamily.devanagari,
        mono: fontFamily.mono,
      },
      fontSize: fontSize,
      borderRadius: {
        sm: borderRadius.sm,
        md: borderRadius.md,
        lg: borderRadius.lg,
        xl: borderRadius.xl,
        full: borderRadius.full,
      },
      boxShadow: {
        card: boxShadow.card,
        raised: boxShadow.raised,
        modal: boxShadow.modal,
      },
      keyframes: {
        "speaker-pulse": {
          "0%, 100%": { opacity: "0.55", filter: "brightness(0.75)" },
          "50%": { opacity: "1", filter: "brightness(1.35)" },
        },
        "sound-wave": {
          "0%, 80%, 100%": { opacity: "0.2", transform: "scale(0.55)" },
          "40%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "speaker-pulse": "speaker-pulse 0.9s ease-in-out infinite",
        "sound-wave": "sound-wave 1.1s ease-in-out infinite",
      },
    },
  },
  plugins: [],
} satisfies Config;
