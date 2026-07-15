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
      },
      spacing: {
        "touch-sm": spacing.touchSm,
        touch: spacing.touch,
        "touch-lg": spacing.touchLg,
      },
      fontFamily: {
        sans: fontFamily.sans,
        telugu: fontFamily.telugu,
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
    },
  },
  plugins: [],
} satisfies Config;
