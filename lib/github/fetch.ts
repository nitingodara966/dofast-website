import "server-only";

export const GITHUB_FETCH_TIMEOUT_MS = 15_000;

/**
 * Every GitHub API request goes through here: hard timeout so a hung request
 * can never pin an in-flight snapshot build (or a serverless invocation), and
 * network/timeout failures collapse to one safe generic error. Never log or
 * rethrow anything that could carry the URL (repo names), headers (tokens),
 * or a response body.
 */
export async function githubFetch(
  url: string,
  init: RequestInit = {}
): Promise<Response> {
  try {
    return await fetch(url, {
      ...init,
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });
  } catch (error) {
    const kind =
      error && typeof error === "object" && "name" in error
        ? String((error as { name: unknown }).name)
        : "UnknownError";
    console.error(`github: request failed before response (${kind})`);
    throw new Error("GitHub API request failed");
  }
}
