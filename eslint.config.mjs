/**
 * ESLint flat config.
 *
 * eslint-config-next 16 sudah mengirim FLAT CONFIG native (array), jadi tidak
 * perlu lagi jembatan FlatCompat seperti versi 15 (dulu memicu
 * "Converting circular structure to JSON" karena config warisan dipaksa
 * lewat FlatCompat). Ambil kedua preset resmi langsung sebagai spread array.
 */
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

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
  ...nextCoreWebVitals,
  ...nextTypescript,
];

export default eslintConfig;
