# DoFast — Architecture

**Status:** v2 — as-built through M7.5, plus the approved dual-mode design.
Supersedes v1. Companions: `PRODUCT_SPEC.md`, `IMPLEMENTATION_PLAN.md`,
`DESIGN_SYSTEM.md`, `UX_FLOWS.md`.

## 1. Shape: one Next.js app, three surfaces (as built)

Single Next.js **16.2.9** (App Router, React 19, TypeScript strict, Tailwind v4)
app deployed on Vercel from `main`. No microservices, no queues, no workers.

```
app/
  (marketing)/page.tsx        # landing + waitlist (server-backed)
  (auth)/login, signup        # Better Auth email/password
  (app)/                      # protected product
    onboarding/  dashboard/  repositories/
    sites/[siteId]/           # workspace: files/snapshot, chat/, chat/[threadId]
  api/  waitlist · auth/[...all] · github/install · github/setup · webhooks/github
proxy.ts                      # Next 16 middleware: optimistic redirects ONLY
lib/
  db/       # Drizzle schema, migrations 0000–0006, ownership-scoped DAL
  auth/     # Better Auth (lazy init), session helpers (headers-first, see §7.4)
  github/   # zero-dep GitHub App auth: RS256 JWT via node:crypto, tokens,
            # repos, inspect (read-only), config, state, githubFetch (15s timeout)
  repo/     # snapshot engine: filters, builder, guarded file reads
  chat/     # responder seam (placeholder → AI layer at M8)
```

Next 16 specifics honored throughout: middleware is `proxy.ts`; docs consulted
from `node_modules/next/dist/docs/` before using framework APIs (per AGENTS.md).

## 2. Stack (as built)

| Concern | Choice | Notes |
|---|---|---|
| DB | Supabase Postgres via transaction pooler (6543) | postgres.js `prepare: false`; lazy `getDb()` |
| ORM | Drizzle + drizzle-kit migrate | Additive migrations only; CHECK constraints standard |
| Auth | Better Auth (email/password) | Lazy `getAuth()`; `onboarding_completed_at` + (M8) `ui_mode` as additionalFields, `input:false` |
| GitHub | GitHub App, hand-rolled auth (no octokit) | App JWT ≤10min, per-request installation tokens, never persisted/logged |
| AI (M8+) | Anthropic Claude behind `AIProvider` via AI SDK | Mock provider in CI; provider swap = config |
| Previews (M11+) | User's own Vercel↔GitHub integration | Preview URL via `deployment_status` webhooks |
| Styling | Tailwind v4 `@theme` tokens + `components/ui` primitives | See §6; defined in DESIGN_SYSTEM.md |
| Validation | Zod at every boundary (API input, webhooks, GitHub payloads, AI output) | |
| Rate limiting | In-memory fixed-window per instance | Durable store at M14 |

## 3. Identity & GitHub model (as built)

- Sign-in: email/password only (GitHub OAuth deliberately absent).
- Repo access: GitHub App `dofast-ai`, **read-only** permissions (Contents: read,
  Metadata: read) until M10 upgrades to write — the upgrade uses GitHub's
  re-approval flow; `new_permissions_accepted` webhooks keep the stored
  `permissions` jsonb current, and the UI prompts users whose grants lag.
- Installation claiming: signed user-bound state (HMAC, 10-min expiry, httpOnly
  cookie scoped to `/api/github`, double-submit with the install URL);
  installation metadata stored only from App-API-verified responses;
  `UNIQUE(installation_id)` makes claims atomic under concurrency.
- Webhooks: timing-safe HMAC over the raw body before parsing; lifecycle
  handling (created=ack, deleted=revoke+disconnect sites, suspend/unsuspend,
  permissions, repo-selection sync + site invalidation); disposition-logged
  with delivery GUIDs; only signature failures return non-2xx.

## 4. Data model

**As built (migrations 0000–0006):** `user`/`session`/`account`/`verification`
(Better Auth; `user.onboarding_completed_at`) · `waitlist_signups` (unique
normalized email) · `audit_log` · `github_installations` (unique
`installation_id`, permissions jsonb, suspended/revoked) · `sites` (user+
installation FKs, `UNIQUE(user_id, repo_id)`, status active/disconnected) ·
`repo_snapshots` (one per site, commit-SHA-keyed file index jsonb, status
ready/truncated/failed with CHECKs, stale-write ordering guard, last-known-good
preservation) · `chat_threads` / `chat_messages` (role + content-length CHECKs,
`token_usage` jsonb reserved).

**Planned additions:**
- M8: `user.ui_mode` text NOT NULL DEFAULT `'simple'` (all accounts) ·
  `usage_counters`.
- M9: `change_proposals` — site/thread FKs, state machine
  (`draft → previewing → preview_ready → approved → publishing → published →
  verified | rejected | superseded | failed | rolled_back`, CHECK-constrained),
  `base_commit_sha`, `branch_name`, structured `changes` jsonb, **both**
  renderings (`plain_summary`, `technical_diff`), `preview_url`,
  `published_commit_sha`, `verification_status`/`verified_at`,
  `revert_commit_sha`, `revert_of_proposal_id`.

## 5. Mode layer (approved semantics)

`user.ui_mode` is read server-side per request. It selects **presentation,
terminology, density, and guardrail strictness** — nothing else:
- Hidden-in-Simple surfaces (files, diffs, repo/branch/SHA detail) are excluded
  at render; their routes redirect to the workspace in Simple Mode (never 404 —
  the resource exists and belongs to the user).
- Both plan renderings are always generated and stored at plan time; switching
  modes reveals/hides, never regenerates or loses data.
- Guardrail delta: Simple Mode applies a stricter write-path allowlist (M9),
  enforced server-side from the same field — not in the client.
- Ownership, sessions, approval gates, state machine, and audit are mode-blind.

## 6. Presentation architecture (approved at M7.5)

- **Tokens:** all color/type/space/radius tokens live as CSS custom properties
  in `app/globals.css` (Tailwind v4 `@theme`). Light theme only (ruled);
  token structure stays dark-ready but no dark theme is built or toggled.
- **Type:** Source Serif 4 (display) · Geist (UI) · Geist Mono (technical
  evidence) — strict role separation (ruled).
- **Accent:** single accent `#B04A25` with the restraint rule; no secondary
  accents, no gradients, no glow, no excessive tinted surfaces (ruled).
- **Primitives:** nine zero-dependency components in `components/ui/` +
  ~15-icon local SVG set. Dialogs/menus are hand-rolled against the documented
  accessibility contract (keyboard nav, focus trap/restore, Escape,
  outside-click, ARIA); if the contract cannot be met reliably, work STOPS and
  a dependency recommendation is presented — no headless library without
  explicit approval (ruled).
- **Consumption rule:** M8–M14 UI may only use tokens + primitives + documented
  compositions, and every UI milestone passes the Anti-AI-Template Checklist.
- Wordmark is text-only (ruled).

## 7. Security boundaries (as built + planned)

1. **Ownership at the DAL** — every site/thread/snapshot lookup filters by the
   session user (`getSiteForUser`, `getThreadForUser`, …); UUIDs pre-validated;
   pages/actions never trust route or form params for identity.
2. **Proxy is UX, not auth** — `proxy.ts` does optimistic cookie-presence
   redirects; real enforcement is `requireUser`/`requireOnboardedUser` in every
   protected surface and server action (server functions re-check regardless of
   UI state).
3. **GitHub credential hygiene** — base64 PEM env var; JWTs short-lived;
   installation tokens minted per request against live suspended/revoked state,
   never stored or logged; all GitHub calls through `githubFetch` (15s abort,
   sanitized pre-response failures: no URLs/headers/bodies in logs).
4. **Build-time safety** — `getDb()`/`getAuth()` are lazy; `getUser()` awaits
   `headers()` *before* auth init so env-less builds (CI) prerender safely.
5. **Snapshot safety** — read-only module; sensitive-path denylist (`.env*`,
   keys, `.npmrc`/`.netrc`, secret/credential names, workflows) enforced at
   index AND read; symlinks/submodules/binaries/lockfiles/oversize excluded;
   truncation always surfaced, never silent; stale-build ordering guard at the
   DB (`indexed_at <=` upsert condition, driver-encoded param); last-known-good
   never destroyed by transient failures.
6. **Chat safety** — content stored/rendered as plain text; length CHECKs;
   per-user rate limits; (M8+) repo content and user messages are untrusted
   input to the model; the model's only side-effect channel is the validated
   `propose_changes` tool.
7. **Write-path safety (M9–M13)** — proposals are inert data; path allowlists
   (Simple stricter) reject workflows/env/lockfiles/traversal before review;
   only `dofast/*` refs writable at the lowest layer; exactly one code path
   (publish) touches default branches, gated on preview_ready + fresh
   confirmation, idempotent; rollback = revert commits through the same
   pipeline, never force-push.
8. **Observability** — structured logs with status codes/ids only (no tokens,
   contents, or sensitive paths); `audit_log` rows for domain events; webhook
   delivery dispositions; secrets confined to server env vars (verified absent
   from client bundles as a standing release check).

## 8. Environment variables

Current: `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`,
`EMAILJS_SERVICE_ID/TEMPLATE_ID/PUBLIC_KEY/PRIVATE_KEY`,
`GITHUB_APP_ID/PRIVATE_KEY/WEBHOOK_SECRET/SLUG`.
M8 adds: `ANTHROPIC_API_KEY`, `AI_MODEL` (default `claude-sonnet-5`), optional
`AI_PROVIDER`. M14 adds rate-limit/quota configuration. All server-only; names
documented in `.env.example`, values never in the repo or chat.

## 9. Deliberately deferred

Dark theme (tokens ready) · billing (counters ready) · background-job runner
(only if AI generation outgrows request/streaming) · vector search over repos ·
teams/orgs · non-Vercel hosts · automated axe + Playwright visual regression
(M14, each requiring dependency approval) · brand mark.
