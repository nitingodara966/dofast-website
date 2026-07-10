// Pure filtering/classification for repository snapshots. Everything here
// treats repo paths and contents as untrusted data.

export const MAX_TREE_ENTRIES = 30_000;
export const MAX_INDEX_FILES = 2_000;
export const MAX_FILE_READ_BYTES = 200_000;

export type FileRole =
  | "page"
  | "layout"
  | "component"
  | "config"
  | "style"
  | "content"
  | "other";

export type IndexedFile = {
  /** path */ p: string;
  /** size in bytes */ s: number;
  /** blob sha */ h: string;
  /** role */ r: FileRole;
};

const SENSITIVE_EXTENSIONS = new Set(["pem", "key", "p12", "pfx"]);
const SENSITIVE_BASENAMES = new Set([".npmrc", ".netrc"]);

/**
 * Paths that must never be indexed, read, or fed to AI context — checked at
 * index build AND again at read time (defense in depth).
 */
export function isSensitivePath(path: string): boolean {
  if (path.startsWith(".github/workflows/")) return true;
  const basename = path.split("/").pop() ?? path;
  const lower = basename.toLowerCase();
  if (lower.startsWith(".env")) return true;
  if (lower.startsWith("id_rsa")) return true;
  if (SENSITIVE_BASENAMES.has(lower)) return true;
  const ext = lower.includes(".") ? lower.split(".").pop()! : "";
  if (SENSITIVE_EXTENSIONS.has(ext)) return true;
  if (/secret|credential/i.test(basename)) return true;
  return false;
}

const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "avif", "bmp", "ico", "icns",
  "woff", "woff2", "ttf", "otf", "eot",
  "mp3", "mp4", "wav", "ogg", "webm", "mov", "avi",
  "zip", "gz", "tar", "tgz", "bz2", "7z", "rar",
  "wasm", "pdf", "map", "jar", "class", "exe", "dll", "so", "dylib",
  "sqlite", "db", "bin", "dat", "lockb",
]);

const LOCKFILE_BASENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
]);

export function isExcludedBinaryOrLockfile(path: string): boolean {
  const basename = (path.split("/").pop() ?? path).toLowerCase();
  if (LOCKFILE_BASENAMES.has(basename)) return true;
  const ext = basename.includes(".") ? basename.split(".").pop()! : "";
  return BINARY_EXTENSIONS.has(ext);
}

export function classifyRole(path: string): FileRole {
  const lower = path.toLowerCase();
  const basename = lower.split("/").pop() ?? lower;

  if (/(^|\/)(page|route)\.(tsx?|jsx?|mdx?)$/.test(lower)) return "page";
  if (lower.startsWith("pages/") || /\/pages\//.test(lower)) return "page";
  if (/(^|\/)layout\.(tsx?|jsx?)$/.test(lower)) return "layout";
  if (
    basename === "package.json" ||
    /^(next|tailwind|postcss|eslint|prettier|tsconfig|vitest|jest|drizzle)\.?.*\.(js|cjs|mjs|ts|mts|json)$/.test(
      basename
    ) ||
    basename === "tsconfig.json"
  ) {
    return "config";
  }
  if (/\.(css|scss|sass|less)$/.test(lower)) return "style";
  if (lower.startsWith("components/") || /\/components\//.test(lower)) {
    return "component";
  }
  if (/\.(tsx|jsx)$/.test(lower)) return "component";
  if (/\.(md|mdx)$/.test(lower)) return "content";
  if (/\.(json|ya?ml)$/.test(lower) && /(^|\/)(content|data)\//.test(lower)) {
    return "content";
  }
  return "other";
}

export type BuildIndexResult = {
  files: IndexedFile[];
  skippedCount: number;
  totalSize: number;
  truncatedByCaps: boolean;
};

/** Filter a raw git tree into the indexable file list. */
export function buildFileIndex(
  entries: Array<{ path: string; mode: string; type: string; sha: string; size?: number }>
): BuildIndexResult {
  const truncatedByEntries = entries.length > MAX_TREE_ENTRIES;
  const considered = truncatedByEntries ? entries.slice(0, MAX_TREE_ENTRIES) : entries;

  const files: IndexedFile[] = [];
  let skippedCount = 0;
  let totalSize = 0;
  let truncatedByCaps = truncatedByEntries;

  for (const entry of considered) {
    // Regular files only: no symlinks (120000), no submodules (type commit),
    // no directories.
    if (entry.type !== "blob") continue;
    if (entry.mode === "120000") {
      skippedCount++;
      continue;
    }
    const size = entry.size ?? 0;
    if (
      isSensitivePath(entry.path) ||
      isExcludedBinaryOrLockfile(entry.path) ||
      size > MAX_FILE_READ_BYTES
    ) {
      skippedCount++;
      continue;
    }
    if (files.length >= MAX_INDEX_FILES) {
      skippedCount++;
      truncatedByCaps = true;
      continue;
    }
    files.push({ p: entry.path, s: size, h: entry.sha, r: classifyRole(entry.path) });
    totalSize += size;
  }

  return { files, skippedCount, totalSize, truncatedByCaps };
}
