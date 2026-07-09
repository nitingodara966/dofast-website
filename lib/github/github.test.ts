import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createVerify, generateKeyPairSync } from "node:crypto";
import { createAppJwt } from "./app";
import { getGitHubAppConfig } from "./config";
import { createStateToken, verifyStateToken, safeEqual } from "./state";

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
});

function stubGitHubEnv() {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv("GITHUB_APP_PRIVATE_KEY", Buffer.from(privateKey).toString("base64"));
  vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET", "whsec_test");
  vi.stubEnv("GITHUB_APP_SLUG", "dofast-ai");
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});

describe("getGitHubAppConfig", () => {
  it("decodes a valid base64 PEM and returns full config", () => {
    stubGitHubEnv();
    const config = getGitHubAppConfig();
    expect(config.appId).toBe("12345");
    expect(config.slug).toBe("dofast-ai");
    expect(config.privateKeyPem).toContain("BEGIN PRIVATE KEY");
  });

  it("throws listing missing variable names, never values", () => {
    stubGitHubEnv();
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", "");
    vi.stubEnv("GITHUB_APP_SLUG", "");
    expect(() => getGitHubAppConfig()).toThrow(
      "Missing GitHub App configuration: GITHUB_APP_PRIVATE_KEY, GITHUB_APP_SLUG"
    );
  });

  it("rejects a key that does not decode to a PEM", () => {
    stubGitHubEnv();
    vi.stubEnv("GITHUB_APP_PRIVATE_KEY", Buffer.from("not a key").toString("base64"));
    expect(() => getGitHubAppConfig()).toThrow(/not a base64-encoded PEM/);
  });

  it("rejects malformed slug and non-numeric app id", () => {
    stubGitHubEnv();
    vi.stubEnv("GITHUB_APP_SLUG", "bad/slug?x=1");
    expect(() => getGitHubAppConfig()).toThrow(/GITHUB_APP_SLUG/);
    stubGitHubEnv();
    vi.stubEnv("GITHUB_APP_ID", "abc");
    expect(() => getGitHubAppConfig()).toThrow(/GITHUB_APP_ID/);
  });
});

describe("createAppJwt", () => {
  it("produces an RS256 JWT with iss/iat/exp within GitHub limits", () => {
    const now = 1_750_000_000_000;
    const jwt = createAppJwt({ appId: "12345", privateKeyPem: privateKey }, now);
    const [header, payload, signature] = jwt.split(".");

    expect(JSON.parse(Buffer.from(header, "base64url").toString())).toEqual({
      alg: "RS256",
      typ: "JWT",
    });
    const claims = JSON.parse(Buffer.from(payload, "base64url").toString());
    expect(claims.iss).toBe("12345");
    expect(claims.iat).toBe(Math.floor(now / 1000) - 60);
    expect(claims.exp - claims.iat).toBeLessThanOrEqual(600);

    const verifier = createVerify("RSA-SHA256");
    verifier.update(`${header}.${payload}`);
    expect(
      verifier.verify(publicKey, Buffer.from(signature, "base64url"))
    ).toBe(true);
  });
});

describe("state tokens", () => {
  beforeEach(() => {
    vi.stubEnv("BETTER_AUTH_SECRET", "state-secret-for-tests");
  });

  it("round-trips for the same user", () => {
    const token = createStateToken("user-1");
    expect(verifyStateToken(token, "user-1")).toBe(true);
  });

  it("fails for a different user", () => {
    const token = createStateToken("user-1");
    expect(verifyStateToken(token, "user-2")).toBe(false);
  });

  it("fails after expiry", () => {
    const now = Date.now();
    const token = createStateToken("user-1", now);
    expect(verifyStateToken(token, "user-1", now + 10 * 60 * 1000 + 1)).toBe(false);
  });

  it("fails on tampered signature or malformed token", () => {
    const token = createStateToken("user-1");
    const [expires, nonce] = token.split(".");
    expect(verifyStateToken(`${expires}.${nonce}.${"0".repeat(64)}`, "user-1")).toBe(false);
    expect(verifyStateToken("garbage", "user-1")).toBe(false);
    expect(verifyStateToken("", "user-1")).toBe(false);
  });

  it("safeEqual rejects different lengths without throwing", () => {
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("same", "same")).toBe(true);
  });
});
