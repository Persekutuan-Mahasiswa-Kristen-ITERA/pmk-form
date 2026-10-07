/**
 * Tes unit helper format tanggal & agregasi bulan (UI Overhaul U1).
 *
 * Pola tes sama dengan `tests/forms.test.ts`: `node:test` + `assert/strict`.
 * Semua kasus memakai timestamp tetap (bukan `Date.now()`) supaya tes
 * deterministik di zona server apa pun.
 *
 * Dijalankan: `npm run test:unit`
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  formatDate,
  daysUntil,
  isPast,
  lastMonths,
  bucketizeByMonth,
} from "@/lib/format";

// 7 Okt 2026, 12:00:00 UTC → 19:00 WIB (UTC+7).
const T_OCT_2026 = "2026-10-07T12:00:00Z";

test("formatDate: format pendek bahasa Indonesia zona WIB", () => {
  assert.equal(formatDate(T_OCT_2026, "short"), "7 Okt 2026");
});

test("formatDate: format panjang", () => {
  assert.equal(formatDate(T_OCT_2026, "long"), "7 Oktober 2026");
});

test("formatDate: input Date object bukan hanya string", () => {
  assert.equal(formatDate(new Date(T_OCT_2026)), "7 Okt 2026");
});

test("formatDate: zona WIB — tanggal bergeser bila UTC masuk awal hari", () => {
  // 31 Des 2026 22:00 UTC = 1 Jan 2027 05:00 WIB.
  assert.equal(formatDate("2026-12-31T22:00:00Z", "short"), "1 Jan 2027");
});

test("formatDate: string kosong/null/undefined mengembalikan string kosong", () => {
  assert.equal(formatDate(""), "");
  assert.equal(formatDate(null), "");
  assert.equal(formatDate(undefined), "");
});

test("formatDate: tanggal invalid mengembalikan string kosong (tidak throw)", () => {
  assert.equal(formatDate("not-a-date"), "");
});

test("daysUntil: hari di masa depan positif", () => {
  const inThreeDays = new Date(Date.now() + 3 * 86400000).toISOString();
  assert.equal(daysUntil(inThreeDays), 3);
});

test("daysUntil: hari ini = 0 (hari kalender, bukan 24-jam pecahan)", () => {
  const sameDay = new Date().toISOString();
  assert.equal(daysUntil(sameDay), 0);
});

test("daysUntil: hari yang sudah lewat negatif", () => {
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  assert.equal(daysUntil(yesterday), -1);
});

test("daysUntil: null/invalid = Infinity (tidak pernah jatuh tempo)", () => {
  assert.equal(daysUntil(null), Number.POSITIVE_INFINITY);
  assert.equal(daysUntil("nope"), Number.POSITIVE_INFINITY);
});

test("isPast: true bila sudah lewat, false bila masa depan", () => {
  const future = new Date(Date.now() + 60000).toISOString();
  const past = new Date(Date.now() - 60000).toISOString();
  assert.equal(isPast(past), true);
  assert.equal(isPast(future), false);
});

test("isPast: null/invalid = false (aman, tidak dianggap lewat)", () => {
  assert.equal(isPast(null), false);
  assert.equal(isPast("bukan-tanggal"), false);
});

test("lastMonths: 6 bulan terakhir berakhir di bulan saat ini (WIB)", () => {
  // 15 Okt 2026 12:00 UTC = 15 Okt 2026 19:00 WIB.
  const now = new Date("2026-10-15T12:00:00Z").getTime();
  const buckets = lastMonths(6, now);
  assert.equal(buckets.length, 6);
  assert.deepEqual(
    buckets.map((b) => b.key),
    ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"],
  );
  assert.deepEqual(
    buckets.map((b) => b.label),
    ["Mei", "Jun", "Jul", "Agu", "Sep", "Okt"],
  );
});

test("lastMonths: label panjang membawa tahun", () => {
  const now = new Date("2026-01-15T12:00:00Z").getTime();
  const buckets = lastMonths(3, now);
  assert.deepEqual(
    buckets.map((b) => b.labelLong),
    ["Nov 2025", "Des 2025", "Jan 2026"],
  );
});

test("lastMonths: membungkus tahun baru dengan benar", () => {
  const now = new Date("2027-01-10T12:00:00Z").getTime();
  const buckets = lastMonths(3, now);
  assert.deepEqual(
    buckets.map((b) => b.key),
    ["2026-11", "2026-12", "2027-01"],
  );
});

test("bucketizeByMonth: kelompokkan timestamp ke bucket WIB yang benar", () => {
  const now = new Date("2026-10-15T12:00:00Z").getTime();
  const buckets = lastMonths(2, now); // Sep + Okt 2026
  const counts = bucketizeByMonth(
    [
      "2026-09-01T00:00:00Z", // 1 Sep 07:00 WIB → Sep
      "2026-10-15T12:00:00Z", // 15 Okt 19:00 WIB → Okt
      "2026-10-31T20:00:00Z", // 1 Nov 03:00 WIB → NOV (di luar bucket)
      "not-valid", // diabaikan
    ],
    buckets,
  );
  assert.deepEqual(counts, { "2026-09": 1, "2026-10": 1 });
});

test("bucketizeByMonth: bucket kosong tetap muncul dengan nilai 0", () => {
  const now = new Date("2026-10-15T12:00:00Z").getTime();
  const buckets = lastMonths(2, now);
  const counts = bucketizeByMonth([], buckets);
  assert.deepEqual(counts, { "2026-09": 0, "2026-10": 0 });
});
