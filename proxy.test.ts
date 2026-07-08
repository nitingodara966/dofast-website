import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { proxy } from "./proxy";

function requestFor(path: string, withSessionCookie = false) {
  return new NextRequest(`http://localhost:3000${path}`, {
    headers: withSessionCookie
      ? { cookie: "better-auth.session_token=token123.signature" }
      : {},
  });
}

describe("proxy (optimistic auth redirects)", () => {
  it("redirects unauthenticated users away from /dashboard to /login", () => {
    const res = proxy(requestFor("/dashboard"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("redirects unauthenticated users away from nested dashboard paths", () => {
    const res = proxy(requestFor("/dashboard/settings"));
    expect(res.headers.get("location")).toBe("http://localhost:3000/login");
  });

  it("lets users with a session cookie through to /dashboard", () => {
    const res = proxy(requestFor("/dashboard", true));
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects users with a session cookie away from /login and /signup", () => {
    for (const path of ["/login", "/signup"]) {
      const res = proxy(requestFor(path, true));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe("http://localhost:3000/dashboard");
    }
  });

  it("lets unauthenticated users reach /login and /signup", () => {
    for (const path of ["/login", "/signup"]) {
      const res = proxy(requestFor(path));
      expect(res.headers.get("location")).toBeNull();
    }
  });
});
