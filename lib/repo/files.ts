import "server-only";
import { getBlobText } from "../github/inspect";
import { isSensitivePath, MAX_FILE_READ_BYTES, type IndexedFile } from "./filters";

export type FileReadResult =
  | { ok: true; text: string }
  | { ok: false; reason: "not-found" | "denied" | "too-large" | "binary" | "unavailable" };

const CONTROL_CHARS = /[\0-\x1f]/;

/**
 * Read one file out of a snapshot. Readable paths are exactly the snapshot's
 * index entries (built from GitHub's own tree); content is fetched by
 * immutable blob SHA. The sensitive-path check re-runs here as defense in
 * depth. File contents are never logged.
 */
export async function readSnapshotFile(opts: {
  token: string;
  repoFullName: string;
  fileIndex: IndexedFile[];
  path: string;
}): Promise<FileReadResult> {
  const { token, repoFullName, fileIndex, path } = opts;

  if (
    !path ||
    path.length > 1024 ||
    path.startsWith("/") ||
    path.includes("..") ||
    CONTROL_CHARS.test(path)
  ) {
    return { ok: false, reason: "not-found" };
  }
  if (isSensitivePath(path)) return { ok: false, reason: "denied" };

  const entry = fileIndex.find((f) => f.p === path);
  if (!entry) return { ok: false, reason: "not-found" };
  if (entry.s > MAX_FILE_READ_BYTES) return { ok: false, reason: "too-large" };

  let text: string | null;
  try {
    text = await getBlobText(token, repoFullName, entry.h);
  } catch {
    return { ok: false, reason: "unavailable" };
  }
  if (text === null || text.includes("\0")) {
    return { ok: false, reason: "binary" };
  }
  if (Buffer.byteLength(text) > MAX_FILE_READ_BYTES) {
    return { ok: false, reason: "too-large" };
  }
  return { ok: true, text };
}
