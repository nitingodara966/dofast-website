import { beforeEach, describe, expect, it, vi } from "vitest";

const selectWhereMock = vi.fn();
const insertReturningValues: unknown[] = [];
const updateSetMock = vi.fn();

vi.mock("./index", () => ({
  getDb: () => ({
    select: () => ({
      from: () => ({
        where: (condition: unknown) => {
          const result = selectWhereMock(condition);
          return Object.assign(Promise.resolve(result), {
            orderBy: async () => result,
          });
        },
      }),
    }),
    insert: () => ({
      values: (values: unknown) => {
        insertReturningValues.push(values);
        return { returning: async () => [{ id: "row-1", ...(values as object) }] };
      },
    }),
    update: () => ({
      set: (set: unknown) => {
        updateSetMock(set);
        return { where: async () => undefined };
      },
    }),
  }),
}));

import {
  addMessage,
  createThread,
  getThreadForUser,
  listThreadsForSite,
  touchThread,
} from "./chat";

const THREAD_ID = "11111111-2222-3333-4444-555555555555";

beforeEach(() => {
  selectWhereMock.mockReset().mockReturnValue([]);
  insertReturningValues.length = 0;
  updateSetMock.mockReset();
});

describe("chat DAL", () => {
  it("getThreadForUser refuses malformed ids without querying", async () => {
    for (const bad of ["", "abc", "1; drop table chat_threads;--"]) {
      await expect(getThreadForUser(bad, "user-1")).resolves.toBeNull();
    }
    expect(selectWhereMock).not.toHaveBeenCalled();
  });

  it("getThreadForUser returns the owned row or null", async () => {
    selectWhereMock.mockReturnValue([{ id: THREAD_ID, userId: "user-1" }]);
    await expect(getThreadForUser(THREAD_ID, "user-1")).resolves.toMatchObject({
      id: THREAD_ID,
    });
    selectWhereMock.mockReturnValue([]);
    await expect(getThreadForUser(THREAD_ID, "user-2")).resolves.toBeNull();
  });

  it("createThread inserts site and user scoping", async () => {
    await createThread("site-1", "user-1");
    expect(insertReturningValues[0]).toEqual({ siteId: "site-1", userId: "user-1" });
  });

  it("addMessage inserts role and content", async () => {
    await addMessage(THREAD_ID, "assistant", "hello");
    expect(insertReturningValues[0]).toEqual({
      threadId: THREAD_ID,
      role: "assistant",
      content: "hello",
    });
  });

  it("listThreadsForSite queries scoped by site and user", async () => {
    await listThreadsForSite("site-1", "user-1");
    expect(selectWhereMock).toHaveBeenCalledTimes(1);
  });

  it("touchThread updates timestamp and optionally the title", async () => {
    await touchThread(THREAD_ID);
    expect(updateSetMock.mock.calls[0][0]).not.toHaveProperty("title");
    await touchThread(THREAD_ID, "My first request");
    expect(updateSetMock.mock.calls[1][0]).toMatchObject({ title: "My first request" });
  });
});
