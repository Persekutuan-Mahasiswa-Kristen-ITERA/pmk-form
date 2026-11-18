import { test } from "node:test";
import assert from "node:assert/strict";
import { toDateTimeLocal } from "@/lib/datetime-local";

test("toDateTimeLocal: memakai jam lokal, dan bolak-balik tidak menggeser tanggal", () => {
  const d = new Date(2026, 10, 18, 9, 5); // 18 Nov 2026 09:05 waktu lokal
  assert.equal(toDateTimeLocal(d), "2026-11-18T09:05");
  // Simpan (new Date(value)) lalu muat lagi harus menghasilkan nilai yang sama.
  const once = toDateTimeLocal(d);
  assert.equal(toDateTimeLocal(new Date(once)), once);
});
