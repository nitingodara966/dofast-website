# DoFast — Implementation Plan

**Status:** Draft v1 — awaiting approval before any product code is written.
**Rule for every milestone:** re-read the relevant guide in `node_modules/next/dist/docs/01-app/` before coding (Next.js 16 conventions differ from prior versions — e.g. `proxy.ts`, not `middleware.ts`).

Milestones are small and independently shippable. Each ends with the app deployable and the landing page untouched in behavior.

---

## M0 — Baseline hardening (preserve landing page & waitlist)

**Objective:** Keep the landing page pixel-identical while removing its technical debt, and set up the hygiene every later milestone relies on (env handling, tests, CI).

**Files:**
- Move `app/page.tsx` → `app/(marketing)/page.tsx` unchanged (route stays `/`).
- New `app/api/waitlist/route.ts` — accepts `{ email }`, validates with Zod, sends welcome email server-side, logs signup (DB storage arrives in M1; until then, keep EmailJS server-side or file/console record).
- Edit `app/(marketing)/page.tsx` *minimally*: swap the direct `emailjs.send()` call for `fetch('/api/waitlist')`. No visual/content changes.
- Edit `app/layout.tsx` metadata: real title/description (currently "Create Next App").
- New `.env.example`, `app/error.tsx`, `app/not-found.tsx`.
- New test setup: Vitest + Testing Library; GitHub Actions workflow running `lint`, `tsc --noEmit`, tests, `next build`.

**DB changes:** none yet.
**Env vars:** `EMAILJS_SERVICE_ID`, `EMAILJS_TEMPLATE_ID`, `EMAILJS_PUBLIC_KEY`, `EMAILJS_PRIVATE_KEY` (server-side EmailJS REST call) — or replacement transactional email vars if we switch providers later.
**Security:** removes hardcoded EmailJS IDs from the client bundle; adds naive in-memory rate limit + email validation on the waitlist endpoint.
**Tests / acceptance:**
- Landing page renders identically (snapshot test); waitlist submit succeeds and shows the 🎉 state.
- `POST /api/waitlist` rejects invalid emails (400) and accepts valid ones (200).
- CI green on a fresh clone with only `.env.example` values documented.

---

## M1 — Database setup & schema

**Objective:** Postgres + Drizzle wired up, initial schema migrated, waitlist persisted.

**Files:** `lib/db/index.ts` (client), `lib/db/schema.ts`, `drizzle.config.ts`, `lib/db/migrations/*`; update `app/api/waitlist/route.ts` to insert into `waitlist_signups`.
**DB changes:** create `waitlist_signups`, `audit_log` tables (full schema in ARCHITECTURE.md §2.4 arrives incrementally per milestone).
**Env vars:** `DATABASE_URL`.
**Security:** DB credentials server-only; Drizzle parameterized queries only (no raw SQL string interpolation); least-privilege DB role.
**Tests / acceptance:**
- Migration runs cleanly on empty DB; repeated runs are no-ops.
- Waitlist signup writes a row (integration test against a local/branch DB).
- `lib/db` never imported from a client component (enforce with `server-only` package import).

---

## M2 — Authentication

**Objective:** Users can sign up, sign in (email/password + GitHub OAuth), and sign out. Sessions verifiable server-side.

**Files:** `lib/auth/index.ts` (Better Auth config), `lib/auth/session.ts` (`getUser()`, `requireUser()`), `app/api/auth/[...all]/route.ts`, `app/(auth)/login/page.tsx`, `app/(auth)/signup/page.tsx`, Better Auth schema tables via Drizzle.
**DB changes:** Better Auth tables (`user`, `session`, `account`, `verification`).
**Env vars:** `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `GITHUB_OAUTH_CLIENT_ID`, `GITHUB_OAUTH_CLIENT_SECRET`.
**Security:** httpOnly/secure/sameSite cookies (library default); password hashing (scrypt, library default); OAuth `state` handled by library; sign-in GitHub OAuth scopes limited to identity/email — **no repo scopes**; rate-limit auth endpoints.
**Tests / acceptance:**
- Sign up → session cookie set → `getUser()` returns the user in a server component.
- Wrong password rejected; sign-out invalidates the session.
- GitHub OAuth round-trip works locally (manual acceptance) and links to an existing email account correctly.

---

## M3 — Protected dashboard shell

**Objective:** A `(app)` route group that only authenticated users can reach, with nav and an empty dashboard.

**Files:** `proxy.ts` (optimistic redirect to `/login` for `(app)` paths), `app/(app)/layout.tsx` (calls `requireUser()` — the real check), `app/(app)/dashboard/page.tsx`, shared UI components (`components/`).
**DB changes:** none.
**Env vars:** none new.
**Security:** defense in depth — proxy redirect is UX only; every `(app)` server component/route handler independently enforces auth via the DAL. Verify no user data is fetched before the auth check.
**Tests / acceptance:**
- Anonymous request to `/dashboard` → redirected to `/login` (and direct route-handler access returns 401, even with proxy bypassed).
- Authenticated user sees dashboard with their email; landing page still public.

---

## M4 — Onboarding flow

**Objective:** First-login experience that walks the user toward connecting GitHub; dashboard empty-states.

**Files:** `app/(app)/onboarding/page.tsx` (+ step components), redirect logic (users with no sites → onboarding).
**DB changes:** `users` gain `onboarding_completed_at` (or derive from having ≥1 site — prefer deriving; decide here).
**Env vars:** none new.
**Security:** nothing new; same auth enforcement.
**Tests / acceptance:** new user lands on onboarding after signup; user with a connected site goes straight to dashboard.

---

## M5 — GitHub App integration

**Objective:** Users install the DoFast GitHub App; we store installations and can mint installation tokens server-side. Webhooks keep installation state in sync.

**Files:** `lib/github/app.ts` (Octokit App client, token minting), `app/api/github/setup/route.ts` (post-install callback: verifies `installation_id` belongs to the signed-in user via the GitHub API before saving), `app/api/webhooks/github/route.ts` (signature-verified; handles `installation`, `installation_repositories` created/deleted/revoked), onboarding step UI linking to the App's install URL.
**DB changes:** `github_installations` table.
**Env vars:** `GITHUB_APP_ID`, `GITHUB_APP_PRIVATE_KEY`, `GITHUB_APP_WEBHOOK_SECRET`, `GITHUB_APP_SLUG` (for the install URL).
**Security:**
- Webhook: constant-time `X-Hub-Signature-256` verification before parsing; reject unsigned.
- Installation claim: never trust `installation_id` from the query string alone — confirm via API that the installing account matches, or list installations for authenticated app and match.
- Private key stored as env var (base64), never in repo; app requests minimum permissions (contents rw, metadata r, pull_requests rw).
- Handle uninstall webhook → mark installation revoked, disable dependent sites.
**Tests / acceptance:**
- Webhook handler unit tests: valid signature accepted, tampered payload rejected.
- Install flow (manual acceptance with a test GitHub account): install → row created; uninstall → row revoked and sites disabled.
- Token minting returns a working installation token (integration test, mocked in CI).

---

## M6 — Repository selection

**Objective:** User picks one repo from their installation as their "site"; we detect whether it's a supported Next.js/React project.

**Files:** `app/(app)/onboarding/select-repo/` UI, `lib/github/repos.ts` (list installation repos, read `package.json` + config files for framework detection), `lib/db/sites.ts`, `app/(app)/sites/[siteId]/page.tsx` stub.
**DB changes:** `sites` table.
**Env vars:** none new.
**Security:** only repos from the user's *own* installations are listable/selectable (ownership check in DAL); framework detection reads files via the API — treat contents as untrusted data (parse `package.json` defensively).
**Tests / acceptance:**
- User sees exactly the repos granted to the App; selecting one creates a `sites` row with detected framework + default branch.
- Unsupported repo (no Next.js/React deps) → clear "not supported yet" message, no site created.

---

## M7 — Read-only repository inspection

**Objective:** Build the repo context the AI will need: a cached file index and on-demand file reads, strictly read-only.

**Files:** `lib/github/inspect.ts` (tree listing via Git Data API, file reads with size caps), `lib/repo/snapshot.ts` (build/refresh `repo_snapshots`: paths, sizes, inferred roles like "page", "component", "config"), site page showing basic repo info.
**DB changes:** `repo_snapshots` table (jsonb file index keyed by commit SHA).
**Env vars:** none new.
**Security:** enforce read-only in this module (no write scopes exercised); cap file count/size to bound memory; skip binaries and files >200KB; **never read `.env*` or secret-looking files into AI context** (denylist).
**Tests / acceptance:**
- Snapshot of a fixture repo produces expected index; re-snapshot on new commit updates SHA.
- Denylisted paths absent from every snapshot; oversized files skipped with a marker.

---

## M8 — Chat interface

**Objective:** Per-site chat UI with persisted threads/messages. No AI yet (echo/canned responder) so UI and persistence are testable in isolation.

**Files:** `app/(app)/sites/[siteId]/chat/` (thread list, message stream UI), `app/api/sites/[siteId]/chat/route.ts` (POST message, streams response), `lib/db/chat.ts`.
**DB changes:** `chat_threads`, `chat_messages`.
**Env vars:** none new.
**Security:** thread/message access scoped to site owner; message length limits; sanitize rendered content (messages render as text/markdown, never `dangerouslySetInnerHTML` of raw model output).
**Tests / acceptance:** send message → persisted → response streams into UI → survives reload; user B cannot read/post to user A's thread (403 test).

---

## M9 — AI service layer (provider-agnostic)

**Objective:** Replace the canned responder with real AI behind an `AIProvider` interface, with streaming, token accounting, and repo context injection. Chat can *answer questions* about the site; it cannot propose changes yet.

**Files:** `lib/ai/provider.ts` (interface + types), `lib/ai/anthropic.ts` (Claude via AI SDK), `lib/ai/context.ts` (assemble system prompt + repo snapshot + selected file contents within a token budget), `lib/ai/prompts/`.
**DB changes:** `chat_messages.token_usage` jsonb; `usage_counters` table (start counting now).
**Env vars:** `ANTHROPIC_API_KEY`, `AI_MODEL` (default `claude-sonnet-5`), optional `AI_PROVIDER`.
**Security:** API key server-only; repo content wrapped as untrusted data in prompts; per-user request caps enforced *before* calling the provider; provider errors mapped to safe user-facing messages (no key/stack leakage).
**Tests / acceptance:**
- Provider interface has a mock implementation used in all CI tests (no live API in CI).
- Swapping provider = config change only (demonstrated by the mock).
- Token usage recorded per message; over-limit user gets a clear refusal.

---

## M10 — Structured code changes

**Objective:** The AI can emit a validated `propose_changes` tool call; proposals are stored with a computed diff. Nothing is written to GitHub yet.

**Files:** `lib/ai/tools/proposeChanges.ts` (tool schema), `lib/changes/validate.ts` (Zod + path allow-list + size/count caps), `lib/changes/diff.ts` (unified diff vs `base_commit_sha` content), `lib/changes/proposals.ts` (create/read, state machine), chat route wiring.
**DB changes:** `change_proposals` table.
**Env vars:** none new.
**Security:** the critical boundary —
- reject proposals touching `.github/workflows/`, `.env*`, `package-lock.json`/lockfiles, dotfiles outside an allow-list, or any path with `..`/absolute components;
- cap: ≤10 files, ≤100KB per file per proposal (tunable);
- proposals are inert data until a human acts; AI output never executed or eval'd.
**Tests / acceptance:**
- Malicious proposal fixtures (workflow edit, path traversal, giant file) all rejected with recorded reasons.
- Valid proposal produces a correct unified diff (fixture-tested) and status `proposed`.

---

## M11 — Diff review & approve/reject workflow

**Objective:** User sees a readable per-file diff in the chat/site UI and approves or rejects. Approval creates the git branch + commit (first write to GitHub).

**Files:** diff viewer components, `app/api/proposals/[id]/approve/route.ts`, `.../reject/route.ts`, `lib/github/write.ts` (create ref `dofast/<id>` from base SHA; create blobs/tree/commit via Git Data API), state-machine transitions in `lib/changes/`.
**DB changes:** proposal status/timestamps columns exercised; `audit_log` entries for approve/reject.
**Env vars:** none new.
**Security:**
- Only the site owner can approve; approval endpoint re-validates the proposal server-side (never trusts client-supplied file content — applies what's stored).
- Writes allowed **only** to `dofast/*` refs in this module; default-branch ref names rejected at the lowest level (`lib/github/write.ts` guard).
- Stale-base check: if default branch moved past `base_commit_sha`, warn and require regeneration (MVP: no rebase).
**Tests / acceptance:**
- Approve on fixture site → branch exists with exactly the proposed contents; status `branch_created`; audit row written.
- Reject → status `rejected`, no GitHub write.
- Attempted write to `main` via the write module throws (unit test).
- Cross-user approval attempt → 403.

---

## M12 — Preview deployments

**Objective:** Surface the Vercel preview URL for the proposal branch and let the user review it.

**Files:** extend `app/api/webhooks/github/route.ts` for `deployment_status` events; `lib/github/previews.ts` (fallback: poll commit statuses/checks for the branch head); proposal UI shows preview link + "waiting for preview" state; site settings flag for "no Vercel integration detected".
**DB changes:** `change_proposals.preview_url`, `preview_state`.
**Env vars:** none new (previews come from the *user's* Vercel↔GitHub integration; no Vercel token needed for MVP).
**Security:** preview URLs displayed as external links (`rel="noopener"`); webhook events matched to proposals by repo + SHA, ignoring events for unknown repos; note in UI that preview deployments run the user's own code on the user's own Vercel account (their trust domain, not ours).
**Tests / acceptance:**
- Simulated `deployment_status` webhook → proposal gains preview URL, status `preview_ready`.
- Repo without Vercel integration → honest "no preview available; review the diff" path (user can still publish; decide whether to gate publish on preview — default: allow with extra confirmation).

---

## M13 — Publishing approved changes

**Objective:** One-click publish merges the `dofast/*` branch into the default branch; branch cleanup; full audit trail. Completes the end-to-end MVP loop.

**Files:** `app/api/proposals/[id]/publish/route.ts`, `.../discard/route.ts`, `lib/github/publish.ts` (merge via GitHub merge API; detect branch-protection failures and fall back to opening a PR the user merges), changes-history page `app/(app)/sites/[siteId]/changes/`.
**DB changes:** `published_at`, `published_commit_sha`; audit entries.
**Env vars:** none new.
**Security:** the **only** code path that writes to a default branch; requires status `preview_ready` (or the M12 no-preview override) + fresh confirmation; idempotent (double-click publishes once — guard with a status transition inside a transaction); merge conflicts → status `failed` with a human-readable explanation, never a force push.
**Tests / acceptance:**
- Publish on fixture repo → default branch contains the change, branch deleted, status `published`, audit row complete (who/what/when/SHA).
- Concurrent double-publish → single merge.
- Conflicting base → clean failure, repo untouched.

---

## M14 — Security hardening, usage limits, logging, error handling

**Objective:** Make the MVP operable and abuse-resistant before real users.

**Files:** rate limiting on all mutating endpoints (per-user + per-IP; Upstash Ratelimit or Postgres-based), `lib/usage/limits.ts` (daily chat/publish caps read from env/config), structured logger `lib/log.ts` (request-id correlation), global `error.tsx`/route-handler error mapping, security headers + CSP in `next.config.ts`, dependency audit in CI.
**DB changes:** `usage_counters` finalized; indexes for hot queries.
**Env vars:** `RATE_LIMIT_*`, `USAGE_DAILY_CHAT_LIMIT`, `USAGE_DAILY_PUBLISH_LIMIT`, optionally `UPSTASH_REDIS_REST_URL/TOKEN`.
**Security (checklist to verify end-to-end):**
- No secret reaches the client bundle (`grep` build output for key prefixes in CI).
- All webhooks signature-verified; all mutating routes auth + ownership + rate-limit checked.
- AI can only ever produce inert proposals; only publish handler touches default branches.
- Audit log covers: signup, install, site connect, proposal created/approved/rejected, branch created, published, discarded, limit-hit.
**Tests / acceptance:** rate-limit integration tests (429s); limit-exceeded UX is clear; error pages never leak stack traces; a full happy-path E2E (Playwright) run: signup → connect → chat → propose → approve → preview → publish, against fixture/test repo.

---

## Milestone order & dependencies

```
M0 → M1 → M2 → M3 → M4
             M5 → M6 → M7 ──┐
                  M8 ───────┼→ M9 → M10 → M11 → M12 → M13 → M14
```

M8 (chat UI with canned responses) can proceed in parallel with M5–M7. Everything else is sequential. M14 items that are cheap (rate limiting a new endpoint) should be done *within* earlier milestones; M14 is the sweep that verifies nothing was missed.

## Standing rules for every milestone

1. Landing page behavior and appearance never regress (snapshot test from M0 guards this).
2. No milestone merges without tests for its acceptance criteria and green CI.
3. New env vars land in `.env.example` in the same PR.
4. Consult `node_modules/next/dist/docs/` before using any Next.js API.
5. AI-generated changes (our own dogfooding included) never target the production branch directly.
