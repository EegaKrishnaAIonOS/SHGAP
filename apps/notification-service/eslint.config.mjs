import base from "../../eslint.config.js";

export default [
  ...base,
  {
    languageOptions: {
      globals: {
        node: true,
        jest: true,
      },
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
];
