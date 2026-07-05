# DoFast — Architecture

**Status:** Draft v1 (planning only)
**Last updated:** 2026-07-05

## 1. Current Codebase Assessment

### What exists today

```
app/
  layout.tsx      # Root layout, Geist fonts, still has "Create Next App" metadata
  page.tsx        # Landing page + waitlist form (client component, EmailJS)
  globals.css     # Tailwind v4 via @import, light/dark CSS variables
next.config.ts    # Empty config
package.json      # next 16.2.9, react 19.2.4, @emailjs/browser, tailwindcss v4
```

- **Framework:** Next.js **16.2.9** (App Router), React 19, TypeScript (strict), Tailwind CSS v4 (PostCSS plugin, no tailwind.config — theme via `@theme` in `globals.css`).
- **Routes:** a single route (`/`). No API routes, no proxy, no server code at all.
- **Waitlist:** the form calls EmailJS **directly from the browser** with hardcoded service/template/public-key IDs in `app/page.tsx`. There is no server-side record of waitlist signups — they exist only as emails sent via EmailJS.
- **No tests, no CI, no `.env` files, no database, no auth.**

### Next.js 16 specifics that affect our design

This repo's Next.js version differs from older conventions (see `node_modules/next/dist/docs/`):

- **Middleware is renamed to Proxy**: request interception lives in a root-level `proxy.ts` exporting a `proxy()` function, not `middleware.ts`. Proxy is explicitly *not* a full authorization solution — use it only for optimistic redirect checks; real auth checks belong in a Data Access Layer called from server components/route handlers.
- **Cache Components** (`cacheComponents: true` + `use cache` directive) is the current caching model; `GET` route handlers follow the page prerendering model when it's enabled. Our app is almost entirely dynamic and per-user, so we will keep caching opt-in and conservative.
- Before writing any code in a milestone, re-read the relevant guide under `node_modules/next/dist/docs/01-app/` (per `AGENTS.md`).

### Suitability verdict

The project is a suitable seed for the SaaS: right framework, right language, clean slate. Nothing needs rewriting; the product grows *around* the landing page using route groups.

### Technical debt & security concerns (to fix in Milestone 0)

1. **Client-side EmailJS credentials** in `app/page.tsx:12-17`. EmailJS public keys are designed to be publishable, but the current setup lets anyone script unlimited sends from our EmailJS quota, and we keep **no record** of signups. Fix: route the waitlist through a server endpoint that stores the email (later: in our DB) and sends the welcome email server-side; add basic rate limiting.
2. **`layout.tsx` metadata** still says "Create Next App" — bad for SEO/social sharing. (Metadata fix only; landing page content untouched.)
3. **No `.env.example`**, no documented configuration.
4. **No error/loading conventions**, no `error.tsx`/`not-found.tsx`.
5. **No tests or CI** — must exist before product code lands.
6. **README** is the default create-next-app README.

## 2. Proposed MVP Architecture

### 2.1 Shape: one Next.js app, three surfaces

A single deployed Next.js app (Vercel) with route groups separating concerns:

```
app/
  (marketing)/            # existing landing page, moved here unchanged
    page.tsx
  (auth)/                 # sign-in / sign-up pages
    login/  signup/
  (app)/                  # protected product, e.g. /dashboard, /sites/[id]
    dashboard/
    onboarding/
    sites/[siteId]/       # chat, changes, settings per site
  api/                    # route handlers: auth, webhooks, chat, github
proxy.ts                  # optimistic auth redirects only
lib/
  db/                     # Drizzle schema + queries (Data Access Layer)
  auth/                   # session helpers, requireUser()
  github/                 # GitHub App client (octokit), repo read/write ops
  ai/                     # provider-agnostic AI layer
  changes/                # change-proposal domain logic (validate, diff, apply)
```

**No microservices, no queues, no workers for MVP.** Long-running AI calls stream over HTTP from route handlers. If generation time ever exceeds serverless limits, the first escalation is a single background-jobs library (e.g. Inngest/QStash) — not a service split.

### 2.2 Stack choices

| Concern | Choice | Rationale |
|---|---|---|
| Database | **Postgres** (Neon or Supabase, serverless driver) | Relational fits users/sites/changes; managed; cheap at zero |
| ORM | **Drizzle** | Type-safe, SQL-first migrations, no codegen step, works in serverless |
| Auth | **Better Auth** (email/password + GitHub OAuth sign-in) | Owns its schema in our Postgres, first-class Next.js App Router support, no vendor lock-in |
| GitHub access | **GitHub App** (installation tokens via Octokit) | Per-repo permission grants, short-lived tokens, revocable, webhooks — never user PATs |
| AI | **Anthropic Claude** behind an internal `AIProvider` interface (via Vercel AI SDK) | AI SDK gives streaming + tool-calling + provider swap (Anthropic → OpenAI etc. is a config change) |
| Git operations | **GitHub Git Data API** (blobs/trees/commits/refs) | No cloning repos to disk; stateless, serverless-friendly, atomic commits |
| Previews | **User's existing Vercel↔GitHub integration** | Pushing a branch auto-creates a preview; we read the preview URL from GitHub commit statuses/deployments. Zero preview infra to build |
| Styling | Tailwind v4 (already present) | Keep what exists |
| Validation | **Zod** | Validate all API input and all AI output |
| Logging | Structured console logs (Vercel) + an `audit_log` table for domain events | Boring and sufficient; add Sentry when there are users |

### 2.3 Identity model: two separate GitHub relationships

This distinction is load-bearing:

1. **GitHub OAuth (sign-in):** optional convenience login. Grants us only identity (`read:user`, email). Never used to touch repos.
2. **GitHub App installation (repo access):** the user installs the "DoFast" GitHub App and selects repositories. We store the `installation_id`; Octokit mints short-lived (1-hour) installation tokens server-side per request. Uninstalling the app instantly revokes all access.

App permissions requested (minimum): `contents: read/write`, `metadata: read`, `pull_requests: read/write` (optional, for publish-via-PR), plus webhook events `installation`, `installation_repositories`, `push`, `deployment_status`.

### 2.4 Core data model

```
users            (id, email, name, created_at, ...)        # Better Auth-owned tables alongside
github_installations (id, user_id, installation_id, account_login, created_at, revoked_at)
sites            (id, user_id, installation_id, repo_full_name, default_branch,
                  framework, status, created_at)
repo_snapshots   (id, site_id, commit_sha, file_index jsonb, indexed_at)   # read-only inspection cache
chat_threads     (id, site_id, user_id, title, created_at)
chat_messages    (id, thread_id, role, content, token_usage jsonb, created_at)
change_proposals (id, site_id, thread_id, status, base_commit_sha, branch_name,
                  summary, files jsonb,            -- structured edits, see 2.6
                  diff text, preview_url,
                  approved_at, rejected_at, published_at, published_commit_sha,
                  error, created_at)
usage_counters   (id, user_id, period, chat_requests, tokens_in, tokens_out, publishes)
audit_log        (id, user_id, site_id, action, detail jsonb, created_at)
waitlist_signups (id, email, created_at, source)
```

`change_proposals.status` state machine (enforced in one place, `lib/changes/`):

```
proposed → approved → branch_created → preview_ready → published
        ↘ rejected                  ↘ discarded        (terminal)
   any step → failed (with error recorded; retryable where safe)
```

### 2.5 The AI layer (provider-agnostic, safe by construction)

```
lib/ai/
  provider.ts      # interface: generateChangeProposal(context, request) → StructuredChange
  anthropic.ts     # Claude implementation (via AI SDK)
  prompts/         # versioned system prompts
```

Safety properties, in order of importance:

1. **The AI's only output channel is a structured tool call** (`propose_changes`) validated with Zod. It cannot run commands, install packages, or touch anything except file contents it explicitly proposes.
2. **The AI sees a read-only snapshot** of the repo (selected files + file index), assembled server-side. It has no credentials and no network access to GitHub.
3. **Applying changes is a separate, deterministic step** performed by our code via the GitHub API, only after human approval, only to a `dofast/*` branch.
4. Path allow-listing: proposals touching `.github/workflows/`, `.env*`, lockfiles, or paths outside the repo root are rejected before the user ever sees them.
5. Prompt-injection stance: repo content is untrusted input. The system prompt instructs the model to treat file contents as data; regardless, items 1–4 mean injected instructions still can't escalate beyond "propose a weird diff a human then reviews."

### 2.6 Structured code changes

The AI proposes, our code disposes. A proposal is JSON:

```jsonc
{
  "summary": "Update contact email in footer",
  "changes": [
    { "path": "components/Footer.tsx", "operation": "update",
      "newContent": "..." },                       // full-file content for MVP
    { "path": "app/team/page.tsx", "operation": "create", "newContent": "..." },
    { "path": "old.tsx", "operation": "delete" }
  ]
}
```

Full-file replacement (not patches) for MVP: trivially diffable, no patch-application failures. Server validates paths, size limits, and file count, computes the unified diff against `base_commit_sha`, and stores everything on the proposal row. If the base branch moved before publish, we detect the stale `base_commit_sha` and ask the user to regenerate.

### 2.7 Branch / preview / publish flow

1. **Approve diff** → server creates branch `dofast/<proposal-id>` from `base_commit_sha` and commits the changes via Git Data API (one commit, authored as the DoFast app bot).
2. **Vercel (user's own integration) builds the branch** → GitHub `deployment_status` webhook (or polling commit statuses as fallback) gives us the preview URL → stored on the proposal, shown in the UI.
3. **Publish** → merge branch into the site's default branch via GitHub merge API (or open+merge a PR — decided per repo's protection rules). Branch deleted after success.
4. **Reject/discard** → branch deleted (if created), status recorded.

Production safety: the *only* code path that can write to a default branch is the publish handler, which hard-requires `status == preview_ready` and a fresh user confirmation.

### 2.8 AuthN/AuthZ enforcement

- `proxy.ts`: optimistic redirect of unauthenticated visitors away from `(app)` routes (cookie presence check only).
- **Real enforcement in the Data Access Layer**: every query in `lib/db/` takes the authenticated user and scopes by ownership (`site.user_id = user.id`). Route handlers call `requireUser()` first. No client component ever receives data that wasn't ownership-checked server-side.
- Webhooks authenticate via GitHub signature verification (`X-Hub-Signature-256`), not sessions.

### 2.9 Secrets & configuration

All secrets are server-only env vars (never `NEXT_PUBLIC_*`):

```
DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
GITHUB_OAUTH_CLIENT_ID / _SECRET,            # sign-in
GITHUB_APP_ID, GITHUB_APP_PRIVATE_KEY,       # repo access
GITHUB_APP_WEBHOOK_SECRET,
ANTHROPIC_API_KEY,
EMAIL_* (server-side waitlist/transactional email)
```

`.env.example` documents every variable; `.env*` already gitignored.

## 3. Decisions Deliberately Deferred

- Billing/plans (schema has `usage_counters` to hook into later).
- Background job runner (only if AI generation outgrows request/response streaming).
- Repo embeddings/vector search for large codebases (MVP: file index + targeted file reads is enough for small marketing sites).
- Multi-tenant orgs/teams; custom preview infra; non-Vercel hosts; non-Next.js frameworks.
- Sentry/OTel (add at first real user traffic).
