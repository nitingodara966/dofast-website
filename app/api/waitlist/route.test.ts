import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetRateLimiter } from "@/lib/rate-limit";
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

  it("accepts a valid email and sends the welcome email server-side", async () => {
    const res = await POST(waitlistRequest({ email: "User@Example.com " }));
    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    expect(sendMock).toHaveBeenCalledTimes(1);
    const [url, init] = sendMock.mock.calls[0];
    expect(url).toBe("https://api.emailjs.com/api/v1.0/email/send");
    const payload = JSON.parse(init.body);
    expect(payload.template_params.email).toBe("user@example.com");
    expect(payload.accessToken).toBe("private_test");
  });

  it("rejects an invalid email with 400 and does not send", async () => {
    const res = await POST(waitlistRequest({ email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rejects malformed JSON with 400", async () => {
    const res = await POST(waitlistRequest("{not json"));
    expect(res.status).toBe(400);
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("rate limits repeated requests from the same IP with 429", async () => {
    for (let i = 0; i < 5; i++) {
      const res = await POST(waitlistRequest({ email: `a${i}@example.com` }));
      expect(res.status).toBe(200);
    }
    const res = await POST(waitlistRequest({ email: "a6@example.com" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("does not rate limit a different IP", async () => {
    for (let i = 0; i < 6; i++) {
      await POST(waitlistRequest({ email: `a${i}@example.com` }, "203.0.113.1"));
    }
    const res = await POST(waitlistRequest({ email: "b@example.com" }, "203.0.113.2"));
    expect(res.status).toBe(200);
  });

  it("returns a generic 500 when EMAILJS_* env vars are missing", async () => {
    vi.stubEnv("EMAILJS_PRIVATE_KEY", "");
    const res = await POST(waitlistRequest({ email: "a@example.com" }));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Something went wrong. Please try again later.");
    expect(sendMock).not.toHaveBeenCalled();
  });

  it("returns a generic 502 when the email provider fails, without leaking details", async () => {
    sendMock.mockResolvedValue(
      new Response("secret internal provider error", { status: 403 })
    );
    const res = await POST(waitlistRequest({ email: "a@example.com" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(JSON.stringify(body)).not.toContain("secret internal provider error");
    expect(body.error).toBe("Something went wrong. Please try again later.");
  });
});
