import { describe, expect, it } from "vitest";
import {
  buildFileIndex,
  classifyRole,
  isExcludedBinaryOrLockfile,
  isSensitivePath,
  MAX_INDEX_FILES,
} from "./filters";

describe("isSensitivePath", () => {
  it.each([
    ".env",
    ".env.local",
    "apps/web/.env.production",
    "certs/server.pem",
    "deploy/key.key",
    "id_rsa",
    ".ssh/id_rsa.pub",
    ".npmrc",
    ".netrc",
    "config/secrets.json",
    "aws-credentials.txt",
    ".github/workflows/ci.yml",
  ])("excludes %s", (path) => {
    expect(isSensitivePath(path)).toBe(true);
  });

  it.each(["app/page.tsx", "package.json", "README.md", "environment.ts", ".github/dependabot.yml"])(
    "allows %s",
    (path) => {
      expect(isSensitivePath(path)).toBe(false);
    }
  );
});

describe("isExcludedBinaryOrLockfile", () => {
  it.each(["logo.png", "font.woff2", "video.mp4", "bundle.js.map", "package-lock.json", "yarn.lock", "bun.lockb"])(
    "excludes %s",
    (path) => {
      expect(isExcludedBinaryOrLockfile(path)).toBe(true);
    }
  );
  it.each(["app/page.tsx", "styles.css", "data.json"])("allows %s", (path) => {
    expect(isExcludedBinaryOrLockfile(path)).toBe(false);
  });
});

describe("classifyRole", () => {
  it.each([
    ["app/page.tsx", "page"],
    ["app/about/page.tsx", "page"],
    ["pages/index.js", "page"],
    ["app/layout.tsx", "layout"],
    ["components/Footer.tsx", "component"],
    ["src/widgets/Card.jsx", "component"],
    ["package.json", "config"],
    ["next.config.ts", "config"],
    ["tsconfig.json", "config"],
    ["app/globals.css", "style"],
    ["README.md", "content"],
    ["content/posts/hello.json", "content"],
    ["lib/utils.ts", "other"],
  ])("%s → %s", (path, role) => {
    expect(classifyRole(path)).toBe(role);
  });
});

function blob(path: string, size = 100, mode = "100644") {
  return { path, mode, type: "blob", sha: "b".repeat(40), size };
}

describe("buildFileIndex", () => {
  it("indexes regular files and skips symlinks, submodules, sensitive, binary, oversized", () => {
    const result = buildFileIndex([
      blob("app/page.tsx"),
      blob("link-to-page", 20, "120000"), // symlink
      { path: "vendored", mode: "160000", type: "commit", sha: "c".repeat(40) }, // submodule
      { path: "app", mode: "040000", type: "tree", sha: "d".repeat(40) }, // dir
      blob(".env.local"),
      blob("logo.png"),
      blob("huge.ts", 900_000),
      blob("components/Nav.tsx", 300),
    ]);
    expect(result.files.map((f) => f.p)).toEqual(["app/page.tsx", "components/Nav.tsx"]);
    // symlink + .env + png + oversized (submodule/tree are not blobs, not counted)
    expect(result.skippedCount).toBe(4);
    expect(result.totalSize).toBe(400);
    expect(result.truncatedByCaps).toBe(false);
    expect(result.files[0].r).toBe("page");
  });

  it("caps the index and reports truncation", () => {
    const entries = Array.from({ length: MAX_INDEX_FILES + 5 }, (_, i) =>
      blob(`lib/f${i}.ts`)
    );
    const result = buildFileIndex(entries);
    expect(result.files).toHaveLength(MAX_INDEX_FILES);
    expect(result.skippedCount).toBe(5);
    expect(result.truncatedByCaps).toBe(true);
  });
});
