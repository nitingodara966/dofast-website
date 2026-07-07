import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimiter } from "@/lib/rate-limit";

const addWaitlistSignupMock = vi.fn();
vi.mock("@/lib/db/waitlist", () => ({
  addWaitlistSignup: (...args: unknown[]) => addWaitlistSignupMock(...args),
}));

import { POST } from "./route";

function waitlistRequest(body: unknown, ip = "203.0.113.1") {
  return new Request("http://localhost/api/waitlist", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-forwarded-for": ip,
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("POST /api/waitlist", () => {
  const sendMock = vi.fn();

  beforeEach(() => {
    resetRateLimiter();
    addWaitlistSignupMock.mockReset().mockResolvedValue({ created: true });
    sendMock.mockReset().mockResolvedValue(new Response("OK", { status: 200 }));
    vi.stubGlobal("fetch", sendMock);
    vi.stubEnv("EMAILJS_SERVICE_ID", "service_test");
    vi.stubEnv("EMAILJS_TEMPLATE_ID", "template_test");
    vi.stubEnv("EMAILJS_PUBLIC_KEY", "public_test");
    vi.stubEnv("EMAILJS_PRIVATE_KEY", "private_test");
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("persists a normalized signup and sends the welcome email", async () => {
    const res = await POST(waitlistRequest({ email: "User@Example.com " }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(addWaitlistSignupMock).toHaveBeenCalledTimes(1);
    expect(addWaitlistSignupMock).toHaveBeenCalledWith(
      "user@example.com",
      "landing_page"
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [url, init] = sendMock.mock.calls[0];
    expect(url).toBe("https://api.emailjs.com/api/v1.0/email/send");
    const payload = JSON.parse(init.body);
    expect(payload.template_params.email).toBe("user@example.com");
    expect(payload.accessToken).toBe("private_test");
  });

  it("treats a duplicate signup as success without re-sending the email", async () => {
    addWaitlistSignupMock.mockResolvedValue({ created: false });
    const res = await POST(waitlistRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns a generic 500 on database failure without sending email or leaking details", async () => {
    addWaitlistSignupMock.mockRejectedValue(
      new Error('connect ECONNREFUSED db.supabase.co:6543 password "hunter2"')
    );
    const res = await POST(waitlistRequest({ email: "user@example.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body).toEqual({ error: "Something went wrong. Please try again later." });
    expect(JSON.stringify(body)).not.toContain("supabase");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("still succeeds when the signup persists but EmailJS fails, without leaking details", async () => {
    sendMock.mockResolvedValue(
      new Response("secret internal provider error", { status: 403 })
    );
    const res = await POST(waitlistRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
    expect(JSON.stringify(body)).not.toContain("secret internal provider error");
  });

  it("still succeeds when EMAILJS_* env vars are missing (signup persisted, email skipped)", async () => {
    vi.stubEnv("EMAILJS_PRIVATE_KEY", "");
    const res = await POST(waitlistRequest({ email: "user@example.com" }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(addWaitlistSignupMock).toHaveBeenCalledTimes(1);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects an invalid email with 400 before touching the database", async () => {
    const res = await POST(waitlistRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(addWaitlistSignupMock).not.toHaveBeenCalled();
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await POST(waitlistRequest("{not json"));
    expect(res.status).toBe(400);
    expect(addWaitlistSignupMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated requests from the same IP with 429", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await POST(waitlistRequest({ email: `a${i}@example.com` }));
      expect(res.status).toBe(200);
    }
    const res = await POST(waitlistRequest({ email: "a6@example.com" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(addWaitlistSignupMock).toHaveBeenCalledTimes(5);
  });

  it("does not rate limit a different IP", async () => {
    for (let i = 0; i < 6; i++) {
      await POST(waitlistRequest({ email: `a${i}@example.com` }, "203.0.113.1"));
    }
    const res = await POST(waitlistRequest({ email: "b@example.com" }, "203.0.113.2"));
    expect(res.status).toBe(200);
  });
});
