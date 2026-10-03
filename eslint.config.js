import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";
import { defineConfig, globalIgnores } from "eslint/config";

// Desktop app frontend only; website/ and blog/ have their own lint setups.
export default defineConfig([
  globalIgnores([
    "dist",
    "src-tauri",
    "website",
    "blog",
    "cf-dashboard",
    "ops",
    "node_modules",
    // shadcn-generated components, kept as generated.
    "src/components/ui",
  ]),
  {
    files: ["**/*.{ts,tsx}"],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat["recommended-latest"],
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      // Warn, not error, until the refactors land (tracked as harness tasks):
      // - refs: App.tsx's incremental duplicate trackers read refs inside a useMemo.
      // - set-state-in-effect: Overview.tsx opens the active group from an effect.
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);
