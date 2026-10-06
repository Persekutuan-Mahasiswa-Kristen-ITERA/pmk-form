/**
 * ESLint flat config (UI Overhaul U1).
 *
 * Catatan: `eslint-config-next` 15.5.27 masih mengirim config format eslintrc
 * warisan (`{ extends, rules, plugins, settings }` — BUKAN array flat config).
 * Impor langsung di ESLint 9 flat config menyebabkan
 * "nextCoreWebVitals is not iterable" (error lama di repo ini).
 *
 * Solusi resmi: `FlatCompat` dari `@eslint/eslintrc` (sudah jadi dependency
 * eslint) menerjemahkan config warisan ke flat config, sekaligus menangani
 * `@rushstack/eslint-patch` yang dipakai `eslint-config-next/index.js`.
 */
import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  {
    // File hasil build & dependensi tidak perlu di-lint.
    ignores: [
      "**/node_modules/**",
      ".next/**",
      "next-env.d.ts",
      "build/**",
      "coverage/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
];

export default eslintConfig;
