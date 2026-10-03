// Loader tes: jalankan dengan perintah di package.json (`npm run test:unit`).
// Didaftarkan via register() (cara modern pengganti --loader, tanpa warning).
// Tugasnya dua: (1) selesaikan alias `@/` ke path repo, (2) stub modul khusus
// Next (`next/headers`, supabase server) agar fungsi PURE di lib bisa diuji
// tanpa server. Tidak dipakai saat build/deploy.
import { pathToFileURL } from "node:url";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const STUBS = {
  "next/headers": path.join(REPO, "tests", "stubs", "next-headers.mjs"),
  "@/lib/supabase/server": path.join(REPO, "tests", "stubs", "supabase-server.mjs"),
  "react": path.join(REPO, "tests", "stubs", "react.mjs"),
};

export async function resolve(specifier, context, next) {
  if (specifier in STUBS) {
    return { url: pathToFileURL(STUBS[specifier]).href, shortCircuit: true };
  }
  if (specifier.startsWith("@/")) {
    const rel = specifier.slice(2);
    const candidates = [path.join(REPO, rel), path.join(REPO, rel + ".ts"), path.join(REPO, rel + ".tsx")];
    // Pilih kandidat pertama yang ada (TypeScript type-stripping jalan di file .ts asli).
    const { existsSync } = await import("node:fs");
    const target = candidates.find((c) => existsSync(c)) ?? candidates[0];
    return { url: pathToFileURL(target).href, shortCircuit: true };
  }
  return next(specifier, context);
}
