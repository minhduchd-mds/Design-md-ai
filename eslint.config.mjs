// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import tseslint from "@typescript-eslint/eslint-plugin";
import tsparser from "@typescript-eslint/parser";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";

export default [{
  ignores: ["dist/**", "release/**", "node_modules/**", "coverage/**", "storybook-static/**"],
}, {
  files: ["**/*.{ts,tsx}"],
  languageOptions: {
    parser: tsparser,
    parserOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      ecmaFeatures: { jsx: true },
    },
  },
  plugins: {
    "@typescript-eslint": tseslint,
    react,
    "react-hooks": reactHooks,
  },
  rules: {
    ...tseslint.configs.recommended.rules,
    ...reactHooks.configs.recommended.rules,
    "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    "@typescript-eslint/no-explicit-any": "warn",
    "react/react-in-jsx-scope": "off",
    "no-console": ["warn", { allow: ["warn", "error"] }],
  },
  settings: {
    react: { version: "detect" },
  },
}, prettier, ...storybook.configs["flat/recommended"]];
