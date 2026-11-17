import { test } from "node:test";
import assert from "node:assert/strict";
import { googleLoginError, handoffMatches, newHandoff, picoreGoogleUrl } from "@/lib/google-login";

test("handoff values are fresh 43-char base64url", () => {
    const a = newHandoff();
    assert.match(a, /^[A-Za-z0-9_-]{43}$/);
    assert.notEqual(a, newHandoff());
});

test("PI-CORE start URL names the app and carries the handoff", () => {
    const u = new URL(picoreGoogleUrl("x".repeat(43)));
    assert.equal(u.pathname, "/auth/google");
    assert.equal(u.searchParams.get("app"), "form");
    assert.equal(u.searchParams.get("handoff"), "x".repeat(43));
});

test("handoff must match the cookie exactly", () => {
    assert.equal(handoffMatches("abc", "abc"), true);
    assert.equal(handoffMatches("abc", "abd"), false);
    assert.equal(handoffMatches("abc", "abcd"), false);
    assert.equal(handoffMatches(undefined, "abc"), false);
    assert.equal(handoffMatches("abc", null), false);
});

test("only known error codes reach the login page", () => {
    assert.equal(googleLoginError("notRegistered"), "notRegistered");
    assert.equal(googleLoginError("inactive"), "inactive");
    assert.equal(googleLoginError("<script>"), "failed");
    assert.equal(googleLoginError(null), "failed");
});
