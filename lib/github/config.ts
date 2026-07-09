import "server-only";

export type GitHubAppConfig = {
  appId: string;
  privateKeyPem: string;
  webhookSecret: string;
  slug: string;
};

/**
 * Reads and validates GitHub App configuration at call time (never at import,
 * so builds don't need the env vars). Throws with variable NAMES only —
 * values must never appear in errors or logs.
 */
export function getGitHubAppConfig(): GitHubAppConfig {
  const appId = process.env.GITHUB_APP_ID;
  const privateKeyBase64 = process.env.GITHUB_APP_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  const slug = process.env.GITHUB_APP_SLUG;

  const missing = [
    !appId && "GITHUB_APP_ID",
    !privateKeyBase64 && "GITHUB_APP_PRIVATE_KEY",
    !webhookSecret && "GITHUB_APP_WEBHOOK_SECRET",
    !slug && "GITHUB_APP_SLUG",
  ].filter(Boolean);
  if (missing.length > 0) {
    throw new Error(`Missing GitHub App configuration: ${missing.join(", ")}`);
  }

  if (!/^\d+$/.test(appId!)) {
    throw new Error("GITHUB_APP_ID must be numeric");
  }
  // The slug is interpolated into the install URL — keep it strictly shaped.
  if (!/^[a-z0-9-]+$/i.test(slug!)) {
    throw new Error("GITHUB_APP_SLUG has an invalid format");
  }

  const privateKeyPem = Buffer.from(privateKeyBase64!, "base64").toString("utf8");
  if (!privateKeyPem.includes("BEGIN") || !privateKeyPem.includes("PRIVATE KEY")) {
    throw new Error("GITHUB_APP_PRIVATE_KEY is not a base64-encoded PEM private key");
  }

  return { appId: appId!, privateKeyPem, webhookSecret: webhookSecret!, slug: slug! };
}
