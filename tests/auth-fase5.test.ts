import { test } from "node:test";
import assert from "node:assert/strict";

/**
 * Login memakai akun PI-CORE (email + password). Route /auth/callback (Google OAuth) sudah
 * dihapus, jadi spesifikasi sanitizeNextPath ikut dihapus.
 */

test("normalisasi email: trim + lowercase (konsisten dengan DB constraint)", () => {
  const normalize = (s: string) => s.trim().toLowerCase();
  assert.equal(normalize("  Departemen@PMKItera.com  "), "departemen@pmkitera.com");
  assert.equal(normalize("A@B.com"), "a@b.com");
});
