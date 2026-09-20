import { FlatCompat } from "@eslint/eslintrc";

const compat = new FlatCompat({
  baseDirectory: import.meta.dirname,
});

// Ignore generated/gitignored build output so `npm run lint` only checks
// hand-written source. These directories are regenerated on every build.
const generatedIgnores = [
  ".open-next/**",
  ".next/**",
  "node_modules/**",
  "next-env.d.ts",
  "cloudflare-env.d.ts",
];

const eslintConfig = [{ ignores: generatedIgnores }, ...compat.extends("next/core-web-vitals", "next/typescript")];

export default eslintConfig;