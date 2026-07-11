import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { resetRateLimiter } from "@/lib/rate-limit";

const requireOnboardedUserMock = vi.fn();
vi.mock("@/lib/auth/session", () => ({
  requireOnboardedUser: () => requireOnboardedUserMock(),
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`REDIRECT:${url}`);
  },
}));

const getSiteMock = vi.fn();
vi.mock("@/lib/db/sites", () => ({
  getSiteForUser: (siteId: string, userId: string) => getSiteMock(siteId, userId),
}));

const createThreadMock = vi.fn();
const getThreadMock = vi.fn();
const listThreadsMock = vi.fn();
const listMessagesMock = vi.fn();
const addMessageMock = vi.fn();
const touchThreadMock = vi.fn();
vi.mock("@/lib/db/chat", () => ({
  createThread: (s: string, u: string) => createThreadMock(s, u),
  getThreadForUser: (t: string, u: string) => getThreadMock(t, u),
  listThreadsForSite: (s: string, u: string) => listThreadsMock(s, u),
  listMessagesForThread: (t: string) => listMessagesMock(t),
  addMessage: (t: string, r: string, c: string) => addMessageMock(t, r, c),
  touchThread: (t: string, title?: string) => touchThreadMock(t, title),
}));

const replyMock = vi.fn();
vi.mock("@/lib/chat/responder", () => ({
  generateAssistantReply: (ctx: unknown) => replyMock(ctx),
}));

import ChatThreadsPage from "./page";
import ChatThreadPage from "./[threadId]/page";
import { createThreadAction, sendMessageAction } from "./actions";

const SITE_ID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const THREAD_ID = "11111111-2222-3333-4444-555555555555";

const user = {
  id: "user-1",
  email: "user@example.com",
  name: "User",
  onboardingCompletedAt: new Date(),
};

const site = {
  id: SITE_ID,
  userId: "user-1",
  repoFullName: "owner/site",
  status: "active",
  defaultBranch: "main",
  framework: "nextjs",
};

const thread = {
  id: THREAD_ID,
  siteId: SITE_ID,
  userId: "user-1",
  title: "New chat",
  createdAt: new Date(),
  updatedAt: new Date(),
};

function form(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

beforeEach(() => {
  resetRateLimiter();
  requireOnboardedUserMock.mockReset().mockResolvedValue(user);
  getSiteMock.mockReset().mockResolvedValue(site);
  createThreadMock.mockReset().mockResolvedValue(thread);
  getThreadMock.mockReset().mockResolvedValue(thread);
  listThreadsMock.mockReset().mockResolvedValue([]);
  listMessagesMock.mockReset().mockResolvedValue([]);
  addMessageMock.mockReset().mockResolvedValue({ id: "m1" });
  touchThreadMock.mockReset().mockResolvedValue(undefined);
  replyMock.mockReset().mockResolvedValue("Thanks — your message is saved.");
});

afterEach(() => cleanup());

describe("createThreadAction", () => {
  it("creates a thread on an owned active site and opens it", async () => {
    await expect(
      createThreadAction(form({ siteId: SITE_ID }))
    ).rejects.toThrow(`REDIRECT:/sites/${SITE_ID}/chat/${THREAD_ID}`);
    expect(createThreadMock).toHaveBeenCalledWith(SITE_ID, "user-1");
  });

  it("refuses sites the user does not own (ownership isolation)", async () => {
    getSiteMock.mockResolvedValue(null);
    await expect(createThreadAction(form({ siteId: SITE_ID }))).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
    expect(createThreadMock).not.toHaveBeenCalled();
  });

  it("refuses disconnected sites", async () => {
    getSiteMock.mockResolvedValue({ ...site, status: "disconnected" });
    await expect(createThreadAction(form({ siteId: SITE_ID }))).rejects.toThrow(
      "REDIRECT:/dashboard"
    );
  });

  it("rate limits thread creation", async () => {
    for (let i = 0; i < 10; i++) {
      await createThreadAction(form({ siteId: SITE_ID })).catch(() => {});
    }
    createThreadMock.mockClear();
    await expect(createThreadAction(form({ siteId: SITE_ID }))).rejects.toThrow(
      `REDIRECT:/sites/${SITE_ID}/chat?error=rate_limited`
    );
    expect(createThreadMock).not.toHaveBeenCalled();
  });
});

describe("sendMessageAction", () => {
  const send = (message: string) =>
    sendMessageAction(form({ threadId: THREAD_ID, message }));

  it("persists the user message and the assistant reply, then returns to the thread", async () => {
    await expect(send("Change the contact email")).rejects.toThrow(
      `REDIRECT:/sites/${SITE_ID}/chat/${THREAD_ID}`
    );
    expect(addMessageMock).toHaveBeenNthCalledWith(
      1,
      THREAD_ID,
      "user",
      "Change the contact email"
    );
    expect(addMessageMock).toHaveBeenNthCalledWith(
      2,
      THREAD_ID,
      "assistant",
      "Thanks — your message is saved."
    );
    // first message becomes the thread title
    expect(touchThreadMock).toHaveBeenCalledWith(
      THREAD_ID,
      "Change the contact email"
    );
  });

  it("keeps an existing title on later messages", async () => {
    getThreadMock.mockResolvedValue({ ...thread, title: "Existing title" });
    await send("another message").catch(() => {});
    expect(touchThreadMock).toHaveBeenCalledWith(THREAD_ID, undefined);
  });

  it("refuses threads owned by another user without any writes", async () => {
    getThreadMock.mockResolvedValue(null);
    await expect(send("hi")).rejects.toThrow("REDIRECT:/dashboard");
    expect(addMessageMock).not.toHaveBeenCalled();
  });

  it("rejects empty and oversized messages without writes", async () => {
    await expect(send("   ")).rejects.toThrow(
      `REDIRECT:/sites/${SITE_ID}/chat/${THREAD_ID}?error=invalid_message`
    );
    await expect(send("x".repeat(4001))).rejects.toThrow("invalid_message");
    expect(addMessageMock).not.toHaveBeenCalled();
  });

  it("rate limits sends", async () => {
    for (let i = 0; i < 20; i++) await send("msg").catch(() => {});
    addMessageMock.mockClear();
    await expect(send("over the limit")).rejects.toThrow("rate_limited");
    expect(addMessageMock).not.toHaveBeenCalled();
  });

  it("propagates authentication redirects", async () => {
    requireOnboardedUserMock.mockRejectedValue(new Error("REDIRECT:/login"));
    await expect(send("hi")).rejects.toThrow("REDIRECT:/login");
  });
});

describe("chat pages", () => {
  const pageProps = {
    params: Promise.resolve({ siteId: SITE_ID }),
    searchParams: Promise.resolve({}),
  };
  const threadProps = {
    params: Promise.resolve({ siteId: SITE_ID, threadId: THREAD_ID }),
    searchParams: Promise.resolve({}),
  };

  it("thread list shows the empty state and new-chat form", async () => {
    render(await ChatThreadsPage(pageProps));
    expect(screen.getByText("No chats yet")).toBeTruthy();
    expect(screen.getByText("New chat")).toBeTruthy();
  });

  it("thread list renders threads scoped to the owner", async () => {
    listThreadsMock.mockResolvedValue([
      { ...thread, title: "Update the footer" },
    ]);
    render(await ChatThreadsPage(pageProps));
    expect(screen.getByText("Update the footer")).toBeTruthy();
    expect(listThreadsMock).toHaveBeenCalledWith(SITE_ID, "user-1");
  });

  it("thread list redirects for unowned sites", async () => {
    getSiteMock.mockResolvedValue(null);
    await expect(ChatThreadsPage(pageProps)).rejects.toThrow("REDIRECT:/dashboard");
  });

  it("thread page renders messages with content as plain text", async () => {
    listMessagesMock.mockResolvedValue([
      { id: "m1", role: "user", content: "<script>alert(1)</script>", createdAt: new Date() },
      { id: "m2", role: "assistant", content: "Saved!", createdAt: new Date() },
    ]);
    render(await ChatThreadPage(threadProps));
    // React renders it as inert text, not markup
    expect(screen.getByText("<script>alert(1)</script>")).toBeTruthy();
    expect(screen.getByText("Saved!")).toBeTruthy();
    expect(document.querySelector("script")).toBeNull();
  });

  it("thread page refuses unowned or mismatched threads", async () => {
    getThreadMock.mockResolvedValue(null);
    await expect(ChatThreadPage(threadProps)).rejects.toThrow("REDIRECT:/dashboard");

    getThreadMock.mockResolvedValue({ ...thread, siteId: "other-site" });
    await expect(ChatThreadPage(threadProps)).rejects.toThrow("REDIRECT:/dashboard");
  });
});
