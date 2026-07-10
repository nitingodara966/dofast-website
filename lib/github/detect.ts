export type Framework = "nextjs" | "react";

const MAX_INPUT_LENGTH = 500_000;

/**
 * Framework detection from a repository's root package.json text. The MVP
 * supports GitHub-connected Next.js/React sites only; anything else returns
 * null and is refused at selection time. Input is untrusted repo content —
 * parse defensively, never execute.
 */
export function detectFramework(packageJsonText: string | null): Framework | null {
  if (!packageJsonText || packageJsonText.length > MAX_INPUT_LENGTH) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(packageJsonText);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) return null;

  const pkg = parsed as {
    dependencies?: Record<string, unknown>;
    devDependencies?: Record<string, unknown>;
  };
  const deps = {
    ...(typeof pkg.dependencies === "object" ? pkg.dependencies : {}),
    ...(typeof pkg.devDependencies === "object" ? pkg.devDependencies : {}),
  };

  if ("next" in deps) return "nextjs";
  if ("react" in deps) return "react";
  return null;
}
