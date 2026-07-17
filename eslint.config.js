// @ts-check
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");
const reactHooks = require("eslint-plugin-react-hooks");

module.exports = tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/.turbo/**",
      "**/coverage/**",
      "**/*.generated.ts",
      "database/prisma/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    // CommonJS config files (this file included) run under Node, not a bundler/browser,
    // and legitimately use require()/module.exports rather than ESM import/export.
    files: ["**/*.config.js", "**/*.config.cjs"],
    languageOptions: {
      sourceType: "commonjs",
      globals: globals.node,
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  {
    files: ["**/*.{ts,tsx,js,jsx,mjs}"],
    languageOptions: {
      globals: { ...globals.node, ...globals.browser },
    },
  },
  {
    // ESLint's flat config is resolved from the *invoking* cwd, not per-file
    // directory — apps/web/eslint.config.js only takes effect when eslint is
    // run with apps/web as cwd (e.g. `npm run lint --workspace=@shgap/web`).
    // lint-staged (via the root pre-commit hook) invokes eslint from the repo
    // root instead, so it only ever sees *this* config — react-hooks rules
    // must be registered here too, or an `eslint-disable-next-line
    // react-hooks/...` comment in apps/web fails with "rule not found" when
    // linted from root even though it's valid from the workspace's own lint.
    files: ["apps/web/src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
    },
  },
);
