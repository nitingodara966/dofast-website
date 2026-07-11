# DoFast — Implementation Plan

**Status:** v2 — M0–M7.5 complete; M7.6 next (awaiting explicit approval).
Supersedes v1 (whose original M4–M14 numbering is retired; the as-built ledger
below is authoritative).

## Standing rules (every milestone)

1. Consult `node_modules/next/dist/docs/` before using framework APIs (AGENTS.md).
2. Additive, CHECK-constrained migrations via `drizzle-kit generate`; applied
   only through `npm run db:migrate` with explicit approval; never destructive.
3. Ownership-scoped DAL for all data access; server actions re-run auth.
4. Deterministic tests (mocked providers/DB/GitHub) + lint + typecheck +
   production build + **env-less build** green before commit.
5. Security review of every diff; secrets never in repo, logs, or client bundle.
6. From M7.6: UI uses tokens/primitives only and passes the Anti-AI-Template
   Checklist (`DESIGN_SYSTEM.md` §4), recorded in the milestone report.
7. One clean commit per milestone; push and production migration only on
   approval; production acceptance by the owner gates the next milestone.
8. New dependencies, env vars, or GitHub App permission changes require
   explicit approval before introduction.

## As-built ledger (production-accepted)

| M | Delivered | Commit |
|---|---|---|
| M0 | Landing preserved; waitlist moved server-side (validation, rate limit, safe errors); metadata fix; Vitest+CI | `1e70634` |
| M1 | Supabase Postgres + Drizzle; `waitlist_signups`/`audit_log`; persistence-first waitlist semantics | `6964cba` |
| M2 | Better Auth email/password; protected `(app)` shell; `proxy.ts` + `requireUser` defense-in-depth | `88cdbcd` |
| M3 | Onboarding with persisted `onboarding_completed_at` (input:false); `requireOnboardedUser` | `5ff01b1` |
| M4 | GitHub App (read-only): signed-state install flow, atomic claim, HMAC webhooks, lifecycle handling; zero-dep App auth | `e288700` |
| M5 | Repository selection: paginated listing, token-scoped access validation, framework detection, `sites` table, webhook invalidation | `35e3827` |
| M6 | Read-only inspection: `repo_snapshots`, filter pipeline + denylist, guarded file reads, stale-write ordering guard, site workspace page | `128044f` (+`9566a89` env-less build fix, `c64fb7c` Date-param driver fix) |
| M7 | Per-site chat: threads/messages with CHECKs, ownership-scoped DAL, rate limits, placeholder responder seam | `a8f69c6` |
| M7.5 | `DESIGN_SYSTEM.md` + `UX_FLOWS.md` approved with rulings: Kiln accent; Source Serif 4/Geist/Geist Mono; hand-rolled dialogs under a11y contract (stop-and-ask fallback); light-only; text wordmark; Simple default for ALL accounts; M7.6→M8 sequencing accepted | docs |

Current DB migrations: 0000–0006. Tests: 238. CI green; production healthy.

---

## M7.6 — Design System Foundation & Shell Migration

**Objective:** implement the approved design system and migrate every existing
surface (including the landing page) with **zero functional behavior change**.

**Files:** `app/globals.css` (token set via `@theme`), font loading (Source
Serif 4 added beside Geist via `next/font` — no packages), `components/ui/*`
(nine primitives + icon set + tests), restyled: shell/layouts, error/not-found,
login/signup (adds real labels — a11y fix, not behavior change), onboarding,
dashboard, repositories, site workspace, chat, landing page **last**.

**DB / env:** none. **Dependencies:** none (dialog/menu a11y contract per
ruling 3 — if unmeetable, STOP and present failure + dependency recommendation).

**Hard constraints (rulings):** no functional/ownership/security/state changes;
no information loss; no premature Simple-Mode behavior (`ui_mode` is M8 — all
users see the restyled full surfaces until then); no new backend touchpoints
(reply chips, rejection reasons, repo classification all deferred to their
milestones); Simple-Mode repo grouping softened per ruling C (no listing-time
detection); landing page keeps waitlist/auth/routing/SEO behavior
regression-locked; light theme only; copy updated to the §3.2 canon with test
assertions updated in lockstep, never weakened.

**Tests/acceptance:** all 238 behavioral tests pass (copy assertions updated
alongside intentional copy changes, reviewed one-by-one); new primitive tests
incl. the full dialog/menu keyboard contract; manual a11y audit (§1.10) and
responsive matrix (360/768/1024/1440) recorded; Anti-AI-Template Checklist
table recorded per surface; env-less build green; owner production acceptance.

---

## M8 — AI Service Layer + Mode Foundation

**Objective:** real AI chat replaces the placeholder responder; dual-mode
foundation lands.

**Files:** `lib/ai/` (provider interface, Anthropic via AI SDK, **mock provider
for CI**, context assembly from M6 snapshots within a token budget, versioned
prompts conforming to the copy voice), streaming chat UI (composer/thread per
DESIGN_SYSTEM), quick-action chips (Simple), clarification reply chips (the
backend touchpoint deferred from M7.5 ruling D), mode switcher in account menu,
mode-gating of Simple-hidden surfaces (redirect-to-workspace, never 404),
Simple-Mode repo-listing presentation revisited (ruling C).
**DB (0007):** `user.ui_mode` NOT NULL DEFAULT `'simple'` (additionalField,
input:false — set via onboarding question + switcher server actions only);
`usage_counters`; `chat_messages.token_usage` populated.
**Env:** `ANTHROPIC_API_KEY`, `AI_MODEL` (default `claude-sonnet-5`) — names in
`.env.example`, values configured by owner in `.env.local` + Vercel.
**Security:** key server-only; repo content and messages wrapped as untrusted
data; per-user caps enforced **before** provider calls; provider errors mapped
to safe copy; model has no tools this milestone (answers only).
**Tests/acceptance:** provider mocked in CI (no live AI); mode gating matrix
(Simple never renders hidden vocabulary — checklist item 15); streaming +
persistence; token accounting rows; caps produce the canonical quota copy;
existing suites green.

## M9 — Structured Change Proposals (plan stage)

**Objective:** the AI can emit one validated `propose_changes` tool call;
proposals become reviewable Drafts. **No GitHub writes.**

**Files:** `lib/ai/tools/proposeChanges` (Zod schema), `lib/changes/`
(validation + path allowlists — base list forbids `.github/workflows`, `.env*`,
lockfiles, traversal; **Simple Mode stricter content-level list**, server-side
from `ui_mode`), diff computation vs `base_commit_sha`, dual renderings
generated and stored at plan time, proposal card (both modes), refusal UX,
optional rejection-reason capture (deferred touchpoint from ruling D).
**DB (0008):** `change_proposals` per ARCHITECTURE §4 with state-machine CHECKs.
**Security:** proposals are inert data; malicious-proposal fixtures (workflow
edit, traversal, oversize) rejected pre-review; stale-base detection.
**Tests/acceptance:** validation matrix incl. both allowlist tiers; dual
renderings always present; state transitions; diff fixtures; checklist.

## M10 — Approval Gate 1 + Branch Writes

**Objective:** approving a Draft creates `dofast/<id>` and commits it — the
first GitHub write.

**Files:** permission-upgrade flow (App permissions raised to Contents:
read/write + Pull requests: read/write; UI prompts installations whose stored
`permissions` lag, using M4's `new_permissions_accepted` plumbing),
`lib/github/write.ts` (blobs/trees/commits/refs; **lowest-level guard: only
`dofast/*` refs writable**), approve/reject actions with audit.
**DB:** proposal transitions. **Env:** none.
**Security:** server re-validates stored proposal content (never client-supplied);
default-branch ref names rejected at the write layer (unit-tested); idempotent
approval; cross-user attempts 403.
**Acceptance:** owner performs the GitHub re-approval on the test installation;
branch contents exactly match the stored proposal.

## M11 — Preview Deployments

**Objective:** every approved proposal gets a preview URL from the user's own
Vercel↔GitHub integration.

**Files:** App webhook subscription extended (`push`, `deployment_status`);
preview capture matched by repo+SHA; push-webhook snapshot invalidation
(retires M6's TTL-only staleness); preview frame per DESIGN_SYSTEM — labeled
"Preview — not your live site", **link-out fallback preserved; no unsafe iframe
workarounds** (ruling B); no-Vercel-integration honest path.
**DB:** `preview_url`/`preview_state` on proposals. **Env:** none.
**Tests/acceptance:** simulated webhooks drive state; unknown repos/SHAs
dropped; preview failure keeps the proposal reviewable and production untouched.

## M12 — Publish + Verification (Gate 2)

**Objective:** "Make it live" merges to the default branch; publish is done
only when verified.

**Files:** publish/discard actions (the **only** default-branch write path;
requires preview_ready + fresh confirmation; idempotent via transactional state
transition), Advanced merge-vs-PR strategy (protected-branch fallback),
verification stage (poll production deployment for the merged SHA + site
response check; success/failure states per UX_FLOWS 4.28), branch cleanup.
**DB:** `published_commit_sha`, `verification_status`, `verified_at`.
**Security:** merge conflicts fail cleanly (never force-push); double-publish
single-merge test; verification failure prominently offers undo.

## M13 — History & Rollback

**Objective:** complete, honest history and one-click undo.

**Files:** history page (all outcomes: published/verified, rejected, failed,
superseded, undone), history drawer (Advanced adds SHAs/branch/diff/verification
log), undo on newest published change → mechanical revert proposal through the
**same** preview→approve→publish pipeline (fast-tracked UI, zero new write
paths), rollback-failure recovery per UX_FLOWS 4.32.
**DB:** `revert_commit_sha`, `revert_of_proposal_id` usage.
**Tests/acceptance:** revert correctness on fixtures; undo honors both gates;
history completeness; Simple/Advanced renderings.

## M14 — Hardening & Operability

**Objective:** abuse-resistant, observable, launch-ready.

**Files/scope:** durable rate limiting (per-user + per-IP; store choice needs
approval if it adds a dependency), quota enforcement with canonical copy,
structured-logging sweep (request-id correlation), client-bundle secret scan in
CI, security-header/CSP pass, full-lifecycle E2E (Playwright — dependency
approval required), automated axe accessibility checks (dependency approval
required), Playwright visual-regression baseline, load-reasonable indexes.
**Env:** rate-limit/quota configuration.
**Acceptance:** E2E signup→connect→ask→plan→preview→publish→verify→undo on a
fixture repo; limit UX matches canon; no secret material in any log or bundle.

## Order & dependencies

Strictly sequential: M7.6 → M8 → M9 → M10 → M11 → M12 → M13 → M14. Each ends
with owner production acceptance. Cheap hardening (rate limits on new
endpoints, audit rows) lands inside each milestone; M14 is the sweep that
verifies nothing was missed.
