import { test } from "node:test";
import assert from "node:assert/strict";
import { verifyTurnstileToken, isTurnstileConfigured } from "@/lib/turnstile";

/**
 * Tes unit Fase 7-2 (Turnstile). Tidak memanggil Cloudflare asli — fetch
 * di-stub per-test. Memverifikasi: fitur off tanpa env, token kosong
 * ditolak, token valid diterima, token invalid ditolak, dan kegagalan
 * jaringan Cloudflare tidak menggagalkan submit (fail-open by design).
 */

const ORIGINAL_FETCH = globalThis.fetch;

function setEnv(siteKey: string | undefined, secret: string | undefined): void {
  if (siteKey === undefined) delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
  else process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = siteKey;
  if (secret === undefined) delete process.env.TURNSTILE_SECRET_KEY;
  else process.env.TURNSTILE_SECRET_KEY = secret;
}

function stubFetch(response: unknown, status = 200): void {
  globalThis.fetch = (async () =>
    new Response(JSON.stringify(response), {
      status,
      headers: { "content-type": "application/json" },
    })) as typeof fetch;
}

function restoreFetch(): void {
  globalThis.fetch = ORIGINAL_FETCH;
}

test("isTurnstileConfigured: false bila salah satu env kosong", () => {
  setEnv(undefined, undefined);
  assert.equal(isTurnstileConfigured(), false);
  setEnv("site-key", undefined);
  assert.equal(isTurnstileConfigured(), false);
  setEnv(undefined, "secret");
  assert.equal(isTurnstileConfigured(), false);
});

test("isTurnstileConfigured: true bila keduanya terisi", () => {
  setEnv("site-key", "secret");
  assert.equal(isTurnstileConfigured(), true);
});

test("fitur nonaktif (env kosong): submit tetap lolos tanpa token", async () => {
  setEnv(undefined, undefined);
  const res = await verifyTurnstileToken(null);
  assert.equal(res.ok, true);
});

test("token kosong DITOLAK saat fitur aktif", async () => {
  setEnv("site-key", "secret");
  assert.equal((await verifyTurnstileToken("")).ok, false);
  assert.equal((await verifyTurnstileToken(null)).ok, false);
  assert.equal((await verifyTurnstileToken("   ")).ok, false);
});

test("token valid diterima", async () => {
  setEnv("site-key", "secret");
  stubFetch({ success: true });
  const res = await verifyTurnstileToken("tok-valid");
  restoreFetch();
  assert.equal(res.ok, true);
});

test("token invalid ditolak + sertakan error codes", async () => {
  setEnv("site-key", "secret");
  stubFetch({ success: false, "error-codes": ["invalid-input-response"] });
  const res = await verifyTurnstileToken("tok-palsu");
  restoreFetch();
  assert.equal(res.ok, false);
  assert.match(res.reason ?? "", /invalid-input-response/);
});

test("kegagalan jaringan Cloudflare: submit tetap LANJUT (fail-open)", async () => {
  setEnv("site-key", "secret");
  globalThis.fetch = (async () => {
    throw new Error("connection refused");
  }) as typeof fetch;
  const res = await verifyTurnstileToken("tok-valid");
  restoreFetch();
  assert.equal(res.ok, true);
});

test("HTTP error dari siteverify: submit tetap LANJUT (fail-open)", async () => {
  setEnv("site-key", "secret");
  stubFetch({}, 503);
  const res = await verifyTurnstileToken("tok-valid");
  restoreFetch();
  assert.equal(res.ok, true);
});
