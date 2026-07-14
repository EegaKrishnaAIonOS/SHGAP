import base from "../../eslint.config.js";
import react from "eslint-plugin-react-hooks";

export default [
  ...base,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": react },
    rules: {
      ...react.configs.recommended.rules,
    },
  },
];
