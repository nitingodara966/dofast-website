import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";

const markRevokedMock = vi.fn();
const setSuspendedMock = vi.fn();
const updatePermissionsMock = vi.fn();
const updateSelectionMock = vi.fn();
vi.mock("@/lib/db/installations", () => ({
  markInstallationRevoked: (id: number) => markRevokedMock(id),
  setInstallationSuspended: (id: number, s: boolean) => setSuspendedMock(id, s),
  updateInstallationPermissions: (id: number, p: unknown) =>
    updatePermissionsMock(id, p),
  updateInstallationRepositorySelection: (id: number, s: string) =>
    updateSelectionMock(id, s),
}));

const disconnectReposMock = vi.fn();
const disconnectInstallationMock = vi.fn();
vi.mock("@/lib/db/sites", () => ({
  disconnectSitesForRepos: (id: number, repoIds: number[]) =>
    disconnectReposMock(id, repoIds),
  disconnectSitesForInstallation: (id: number) => disconnectInstallationMock(id),
}));

const auditMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/db/audit", () => ({
  writeAudit: (entry: unknown) => auditMock(entry),
}));

import { POST } from "./route";

const SECRET = "whsec_test";

function sign(body: string, secret = SECRET) {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}

function webhookRequest(
  event: string,
  payload: unknown,
  { signature, body }: { signature?: string; body?: string } = {}
) {
  const raw = body ?? JSON.stringify(payload);
  return new Request("http://localhost:3000/api/webhooks/github", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": event,
      "x-github-delivery": "delivery-guid-1",
      "x-hub-signature-256": signature ?? sign(raw),
    },
    body: raw,
  });
}

const consoleCalls: string[] = [];

beforeEach(() => {
  vi.stubEnv("GITHUB_APP_ID", "12345");
  vi.stubEnv(
    "GITHUB_APP_PRIVATE_KEY",
    Buffer.from("-----BEGIN PRIVATE KEY-----\nx\n-----END PRIVATE KEY-----").toString("base64")
  );
  vi.stubEnv("GITHUB_APP_WEBHOOK_SECRET", SECRET);
  vi.stubEnv("GITHUB_APP_SLUG", "dofast-ai");

  markRevokedMock.mockReset().mockResolvedValue(true);
  setSuspendedMock.mockReset().mockResolvedValue(true);
  updatePermissionsMock.mockReset().mockResolvedValue(true);
  updateSelectionMock.mockReset().mockResolvedValue(true);
  disconnectReposMock.mockReset().mockResolvedValue(0);
  disconnectInstallationMock.mockReset().mockResolvedValue(0);
  auditMock.mockClear();

  consoleCalls.length = 0;
  vi.spyOn(console, "log").mockImplementation((line: string) => {
    consoleCalls.push(`log:${line}`);
  });
  vi.spyOn(console, "warn").mockImplementation((line: string) => {
    consoleCalls.push(`warn:${line}`);
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/webhooks/github", () => {
  it("rejects a missing or invalid signature with 401 and touches nothing", async () => {
    const payload = { action: "deleted", installation: { id: 42 } };
    const raw = JSON.stringify(payload);

    const noSig = new Request("http://localhost:3000/api/webhooks/github", {
      method: "POST",
      headers: { "x-github-event": "installation" },
      body: raw,
    });
    expect((await POST(noSig)).status).toBe(401);

    const badSig = webhookRequest("installation", payload, {
      signature: sign(raw, "wrong-secret"),
    });
    expect((await POST(badSig)).status).toBe(401);

    const tampered = webhookRequest("installation", payload, {
      signature: sign(raw),
      body: raw.replace("42", "43"),
    });
    expect((await POST(tampered)).status).toBe(401);

    expect(markRevokedMock).not.toHaveBeenCalled();
  });

  it("installation.created is acknowledged without DB mutation", async () => {
    const res = await POST(
      webhookRequest("installation", { action: "created", installation: { id: 42 } })
    );
    expect(res.status).toBe(200);
    expect(markRevokedMock).not.toHaveBeenCalled();
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({ action: "github.webhook.installation_created" })
    );
    expect(consoleCalls.some((c) => c.includes('"disposition":"acknowledged"'))).toBe(true);
  });

  it("installation.deleted revokes the row and disconnects its sites", async () => {
    disconnectInstallationMock.mockResolvedValue(2);
    const res = await POST(
      webhookRequest("installation", { action: "deleted", installation: { id: 42 } })
    );
    expect(res.status).toBe(200);
    expect(markRevokedMock).toHaveBeenCalledWith(42);
    expect(disconnectInstallationMock).toHaveBeenCalledWith(42);
    expect(consoleCalls.some((c) => c.includes('"disposition":"handled"'))).toBe(true);
  });

  it("suspend and unsuspend toggle suspension", async () => {
    await POST(
      webhookRequest("installation", { action: "suspend", installation: { id: 42 } })
    );
    expect(setSuspendedMock).toHaveBeenLastCalledWith(42, true);
    await POST(
      webhookRequest("installation", { action: "unsuspend", installation: { id: 42 } })
    );
    expect(setSuspendedMock).toHaveBeenLastCalledWith(42, false);
  });

  it("new_permissions_accepted updates stored permissions", async () => {
    await POST(
      webhookRequest("installation", {
        action: "new_permissions_accepted",
        installation: { id: 42, permissions: { contents: "write", metadata: "read" } },
      })
    );
    expect(updatePermissionsMock).toHaveBeenCalledWith(42, {
      contents: "write",
      metadata: "read",
    });
  });

  it("installation_repositories added/removed sync the selection mode", async () => {
    await POST(
      webhookRequest("installation_repositories", {
        action: "added",
        installation: { id: 42, repository_selection: "selected" },
      })
    );
    expect(updateSelectionMock).toHaveBeenCalledWith(42, "selected");
    expect(disconnectReposMock).not.toHaveBeenCalled();

    await POST(
      webhookRequest("installation_repositories", {
        action: "removed",
        installation: { id: 42, repository_selection: "all" },
      })
    );
    expect(updateSelectionMock).toHaveBeenLastCalledWith(42, "all");
  });

  it("repositories_removed disconnects matching sites", async () => {
    disconnectReposMock.mockResolvedValue(1);
    await POST(
      webhookRequest("installation_repositories", {
        action: "removed",
        installation: { id: 42, repository_selection: "selected" },
        repositories_removed: [
          { id: 7, full_name: "owner/site" },
          { id: 8, full_name: "owner/other" },
        ],
      })
    );
    expect(disconnectReposMock).toHaveBeenCalledWith(42, [7, 8]);
    expect(auditMock).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "github.webhook.repositories_removed",
        detail: expect.objectContaining({ sitesDisconnected: 1 }),
      })
    );
  });

  it("unknown installations return 200 with a warn-level log", async () => {
    markRevokedMock.mockResolvedValue(false);
    const res = await POST(
      webhookRequest("installation", { action: "deleted", installation: { id: 999 } })
    );
    expect(res.status).toBe(200);
    expect(
      consoleCalls.some(
        (c) => c.startsWith("warn:") && c.includes('"disposition":"unknown-installation"')
      )
    ).toBe(true);
  });

  it("unknown-but-valid events return 200 and mutate nothing", async () => {
    const res = await POST(webhookRequest("ping", { zen: "Keep it simple." }));
    expect(res.status).toBe(200);
    expect(markRevokedMock).not.toHaveBeenCalled();
    expect(setSuspendedMock).not.toHaveBeenCalled();
    expect(consoleCalls.some((c) => c.includes('"disposition":"ignored-event"'))).toBe(true);
  });

  it("structurally invalid payloads are logged and acknowledged without mutations", async () => {
    const res = await POST(
      webhookRequest("installation", { action: "deleted", installation: { id: "not-a-number" } })
    );
    expect(res.status).toBe(200);
    expect(markRevokedMock).not.toHaveBeenCalled();
    expect(consoleCalls.some((c) => c.includes('"disposition":"invalid-payload"'))).toBe(true);
  });
});
