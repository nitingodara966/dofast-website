import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { getGitHubAppConfig } from "@/lib/github/config";
import {
  markInstallationRevoked,
  setInstallationSuspended,
  updateInstallationPermissions,
  updateInstallationRepositorySelection,
} from "@/lib/db/installations";
import { writeAudit } from "@/lib/db/audit";

const installationPayloadSchema = z
  .object({
    action: z.string(),
    installation: z
      .object({
        id: z.number().int().positive(),
        repository_selection: z.string().nullish(),
        permissions: z.record(z.string(), z.string()).optional(),
      })
      .loose(),
  })
  .loose();

function verifySignature(rawBody: string, header: string | null, secret: string): boolean {
  if (!header) return false;
  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(header);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

type Disposition =
  | "handled"
  | "acknowledged"
  | "ignored-event"
  | "unknown-installation"
  | "invalid-payload";

/**
 * GitHub App webhook receiver. Signature is verified over the raw body before
 * any parsing. Only signature failures return non-2xx; everything else is
 * acknowledged with 200 and disposition-logged per the observability plan
 * (unknown-installation logs at warn — that's the integration-failure signal).
 */
export async function POST(request: Request) {
  let secret: string;
  try {
    secret = getGitHubAppConfig().webhookSecret;
  } catch (error) {
    console.error("github-webhook: missing configuration", error);
    return Response.json({ error: "Webhook unavailable." }, { status: 503 });
  }

  const rawBody = await request.text();
  if (!verifySignature(rawBody, request.headers.get("x-hub-signature-256"), secret)) {
    return Response.json({ error: "Invalid signature." }, { status: 401 });
  }

  const event = request.headers.get("x-github-event") ?? "unknown";
  const delivery = request.headers.get("x-github-delivery") ?? "unknown";

  let payload: unknown;
  try {
    payload = JSON.parse(rawBody);
  } catch {
    log({ delivery, event, disposition: "invalid-payload" });
    return Response.json({ ok: true });
  }

  let disposition: Disposition = "ignored-event";
  let action: string | undefined;
  let installationId: number | undefined;

  if (event === "installation" || event === "installation_repositories") {
    const parsed = installationPayloadSchema.safeParse(payload);
    if (!parsed.success) {
      log({ delivery, event, disposition: "invalid-payload" });
      return Response.json({ ok: true });
    }
    action = parsed.data.action;
    installationId = parsed.data.installation.id;

    if (event === "installation") {
      disposition = await handleInstallation(
        action,
        installationId,
        parsed.data.installation.permissions
      );
    } else {
      disposition = await handleInstallationRepositories(
        action,
        installationId,
        parsed.data.installation.repository_selection ?? null
      );
    }
  }

  log({ delivery, event, action, installationId, disposition });
  return Response.json({ ok: true });
}

async function handleInstallation(
  action: string,
  installationId: number,
  permissions: Record<string, string> | undefined
): Promise<Disposition> {
  switch (action) {
    case "created":
      // The setup callback is the sole claim authority (the webhook carries no
      // DoFast identity); this event is observability only.
      await writeAudit({
        action: "github.webhook.installation_created",
        detail: { installationId },
      });
      return "acknowledged";
    case "deleted": {
      const found = await markInstallationRevoked(installationId);
      await writeAudit({
        action: "github.webhook.installation_deleted",
        detail: { installationId, found },
      });
      return found ? "handled" : "unknown-installation";
    }
    case "suspend":
    case "unsuspend": {
      const found = await setInstallationSuspended(
        installationId,
        action === "suspend"
      );
      await writeAudit({
        action: `github.webhook.installation_${action}`,
        detail: { installationId, found },
      });
      return found ? "handled" : "unknown-installation";
    }
    case "new_permissions_accepted": {
      const found = await updateInstallationPermissions(
        installationId,
        permissions ?? {}
      );
      await writeAudit({
        action: "github.webhook.new_permissions_accepted",
        detail: { installationId, found, permissions },
      });
      return found ? "handled" : "unknown-installation";
    }
    default:
      return "ignored-event";
  }
}

async function handleInstallationRepositories(
  action: string,
  installationId: number,
  repositorySelection: string | null
): Promise<Disposition> {
  if (action !== "added" && action !== "removed") return "ignored-event";
  // M4 scope: keep the selection mode in sync; per-repo tracking arrives with
  // repository selection in the next milestone.
  const found = repositorySelection
    ? await updateInstallationRepositorySelection(installationId, repositorySelection)
    : false;
  await writeAudit({
    action: `github.webhook.repositories_${action}`,
    detail: { installationId, found, repositorySelection },
  });
  return found ? "handled" : "unknown-installation";
}

function log(entry: {
  delivery: string;
  event: string;
  action?: string;
  installationId?: number;
  disposition: Disposition;
}) {
  const line = JSON.stringify({ src: "github-webhook", ...entry });
  if (entry.disposition === "unknown-installation") console.warn(line);
  else console.log(line);
}
