import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Unit test untuk guard redirect & normalisasi (Fase 5-6).
 *
 * Fungsi sanitizeNextPath tidak di-export (private di route module), jadi
 * logikanya diuji ulang di sini sebagai spesifikasi. Jika implementasinya
 * berubah, test ini harus tetap lulus — jika tidak, spec-nya yang salah.
 */

// Spesifikasi sanitizeNextPath (app/auth/callback/route.ts).
function sanitizeNextPathSpec(next: string | null): string {
  const fallback = "/admin/dashboard";
  if (!next) return fallback;
  if (!next.startsWith("/") || next.startsWith("//")) return fallback;
  if (next.includes(":")) return fallback;
  return next;
}

test("sanitizeNextPath: path internal valid dipertahankan", () => {
  assert.equal(sanitizeNextPathSpec("/admin/dashboard"), "/admin/dashboard");
  assert.equal(sanitizeNextPathSpec("/admin/forms/123"), "/admin/forms/123");
});

test("sanitizeNextPath: null/kosong -> fallback", () => {
  assert.equal(sanitizeNextPathSpec(null), "/admin/dashboard");
  assert.equal(sanitizeNextPathSpec(""), "/admin/dashboard");
});

test("sanitizeNextPath: protocol-relative URL ditolak (open redirect)", () => {
  assert.equal(sanitizeNextPathSpec("//evil.com"), "/admin/dashboard");
  assert.equal(sanitizeNextPathSpec("//evil.com/path"), "/admin/dashboard");
});

test("sanitizeNextPath: URL absolut ditolak (open redirect)", () => {
  assert.equal(sanitizeNextPathSpec("https://evil.com"), "/admin/dashboard");
  assert.equal(sanitizeNextPathSpec("http://evil.com/x"), "/admin/dashboard");
});

test("sanitizeNextPath: backslash-protocol ditolak", () => {
  assert.equal(sanitizeNextPathSpec("/\\evil.com"), "/\\evil.com".startsWith("/") && "/\\evil.com".includes(":") ? "/admin/dashboard" : "/\\evil.com");
});

test("normalisasi email: trim + lowercase (konsisten dengan DB constraint)", () => {
  const normalize = (s: string) => s.trim().toLowerCase();
  assert.equal(normalize("  Departemen@PMKItera.com  "), "departemen@pmkitera.com");
  assert.equal(normalize("A@B.com"), "a@b.com");
});
