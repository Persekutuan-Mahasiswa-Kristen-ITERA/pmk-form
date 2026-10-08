/**
 * Tes unit helper status form (UI Overhaul U1).
 *
 * Memastikan:
 * - "aktif" memakai definisi tunggal `isFormActive` (Fase 2-4),
 * - status "segera ditutup" = aktif + close_date <= 7 hari,
 * - status "belum dibuka" muncul bila sekarang < open_date,
 * - setiap status membawa label teks (bukan hanya warna).
 *
 * Dijalankan: `npm run test:unit`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { getFormStatus, CLOSING_SOON_DAYS } from "@/lib/form-status";

const NOW = new Date().setHours(0, 0, 0, 0); // tengah malam hari ini, zona server

/** Form aktif standar: dibuka 1 hari lalu, ditutup 30 hari lagi. */
const ACTIVE = {
  is_open: true,
  open_date: new Date(NOW - 86400000).toISOString(),
  close_date: new Date(NOW + 30 * 86400000).toISOString(),
};

test("getFormStatus: form aktif biasa = open", () => {
  assert.deepEqual(getFormStatus(ACTIVE), {
    kind: "open",
    label: "Dibuka",
  });
});

test("getFormStatus: form aktif & close_date <= 7 hari = closing_soon", () => {
  const soon = {
    ...ACTIVE,
    close_date: new Date(NOW + 3 * 86400000).toISOString(),
  };
  assert.deepEqual(getFormStatus(soon), {
    kind: "closing_soon",
    label: "Segera ditutup",
  });
});

test("getFormStatus: form aktif & close_date tepat 7 hari = closing_soon", () => {
  const exactly = {
    ...ACTIVE,
    close_date: new Date(NOW + CLOSING_SOON_DAYS * 86400000).toISOString(),
  };
  assert.equal(getFormStatus(exactly).kind, "closing_soon");
});

test("getFormStatus: close_date 8 hari lagi = open (bukan closing_soon)", () => {
  const eight = {
    ...ACTIVE,
    close_date: new Date(NOW + 8 * 86400000).toISOString(),
  };
  assert.equal(getFormStatus(eight).kind, "open");
});

test("getFormStatus: is_open false = closed (meski tanggal belum lewat)", () => {
  assert.equal(
    getFormStatus({ ...ACTIVE, is_open: false }).kind,
    "closed",
  );
});

test("getFormStatus: close_date sudah lewat = closed", () => {
  const expired = {
    ...ACTIVE,
    close_date: new Date(NOW - 86400000).toISOString(),
  };
  assert.equal(getFormStatus(expired).kind, "closed");
});

test("getFormStatus: is_open true tapi open_date masa depan = not_open", () => {
  const notYet = {
    is_open: true,
    open_date: new Date(NOW + 7 * 86400000).toISOString(),
    close_date: new Date(NOW + 30 * 86400000).toISOString(),
  };
  assert.deepEqual(getFormStatus(notYet), {
    kind: "not_open",
    label: "Belum dibuka",
  });
});

test("getFormStatus: semua null = closed (bukan crash)", () => {
  assert.equal(
    getFormStatus({ is_open: null, open_date: null, close_date: null }).kind,
    "closed",
  );
});

test("getFormStatus: setiap status membawa label teks (bukan hanya warna)", () => {
  const cases = [
    ACTIVE,
    { ...ACTIVE, close_date: new Date(NOW + 86400000).toISOString() },
    { ...ACTIVE, is_open: false },
    {
      is_open: true,
      open_date: new Date(NOW + 86400000).toISOString(),
      close_date: new Date(NOW + 86400000 * 30).toISOString(),
    },
  ];
  for (const c of cases) {
    const status = getFormStatus(c);
    assert.ok(
      status.label.length > 0,
      `status ${status.kind} harus punya label teks`,
    );
    assert.ok(
      ["not_open", "open", "closing_soon", "closed"].includes(status.kind),
    );
  }
});
