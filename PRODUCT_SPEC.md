# DoFast — Product Specification

**Status:** Draft v1 (planning only — no product code written yet)
**Last updated:** 2026-07-05

## 1. What DoFast Is

DoFast is an AI-powered SaaS that lets non-technical website owners update their existing website by chatting with an AI. The user connects their site's GitHub repository once; after that, changes like "update our contact email" or "add a new team member" happen through a chat conversation, with a visual preview and an explicit approve step before anything goes live.

**One-line pitch:** Update your website by just texting AI.

## 2. Target Users

- **Primary (MVP):** Small business owners, founders, and marketers whose website lives in a GitHub-hosted **Next.js/React** repository (typically deployed on Vercel), who don't want to wait on a developer for small content and copy changes.
- **Secondary (post-MVP):** Agencies managing many client sites; WordPress and other-stack site owners (explicitly out of scope for MVP despite being mentioned on the landing page).

## 3. Core Product Flow

```
Landing Page → Sign Up / Login → Dashboard → Connect GitHub (GitHub App install)
→ Select Repository → Chat with Website → AI Generates Proposed Code Changes
→ Show Diff → User Approves or Rejects → Create Temporary Branch
→ Generate Preview Deployment → User Reviews Preview → Publish Approved Changes
```

Key product invariants (non-negotiable):

1. **AI never writes to the production branch directly.** All AI-generated changes land on a DoFast-managed temporary branch.
2. **Nothing goes live without explicit user approval** — approval of the diff, then approval after seeing the preview.
3. **Every change is traceable**: who asked for it, what the AI proposed, what was approved, and what was published.
4. **DoFast asks for the minimum GitHub access needed** (GitHub App with per-repository installation, not personal access tokens).

## 4. MVP Scope

### In scope

| Area | MVP behavior |
|---|---|
| Marketing | Existing landing page + waitlist (preserved as-is) |
| Auth | Email/password + GitHub OAuth sign-in |
| Dashboard | Protected area listing connected sites and recent changes |
| Onboarding | Guided flow: install GitHub App → pick a repo → confirm it's a supported Next.js/React site |
| GitHub connection | GitHub App installation scoped to selected repositories |
| Repo inspection | Read-only browsing/indexing of the repo so the AI has context |
| Chat | Per-site chat threads; user describes a change in plain English |
| AI changes | AI proposes structured file edits (never executes arbitrary commands) |
| Diff review | Human-readable diff of proposed changes; approve or reject |
| Branching | Approved changes committed to a `dofast/<change-id>` branch via GitHub API |
| Preview | Preview URL surfaced from the user's existing Vercel↔GitHub integration |
| Publish | Merge the DoFast branch into the production branch after final approval |
| Safety | Usage limits, audit logging, error handling, secret isolation |

### Out of scope for MVP

- WordPress, Webflow, or any non-GitHub site connection (landing page mentions these as vision; product ships GitHub-only).
- Non-Next.js/React repositories (detect and politely refuse at onboarding).
- DoFast-hosted preview infrastructure (we piggyback on the user's Vercel project).
- Image generation/asset uploads, e-commerce data edits, CMS integrations.
- Teams/multi-user organizations, roles and permissions beyond a single owner.
- Billing (beta is free; design the schema so plans/limits can be added).
- Mobile apps; real "texting" (SMS) — chat is in-app.

## 5. User Stories (MVP)

1. As a visitor, I can join the waitlist from the landing page (already live — must keep working).
2. As a user, I can create an account and sign in securely.
3. As a user, I can install the DoFast GitHub App on my account/org and grant access to only the repos I choose.
4. As a user, I can select one repository as my "site" and see basic info about it (framework detected, default branch, last deploy).
5. As a user, I can open a chat for my site and ask for a change in plain English.
6. As a user, I see exactly which files the AI wants to change and a readable diff, and I can approve or reject.
7. As a user, after approving, I get a preview link showing my site with the change applied.
8. As a user, I can publish the previewed change to my live site, or discard it.
9. As a user, I can see a history of all changes: requested → proposed → approved/rejected → previewed → published/discarded.
10. As DoFast operators, we can see errors, AI token usage per user, and enforce per-user usage limits.

## 6. Success Criteria for MVP

- A real user with a Vercel-deployed Next.js site can go from sign-up to a published one-file copy change in **under 10 minutes** without touching git.
- Zero incidents of AI writing to a production branch without approval.
- Every published change has a complete audit trail row.

## 7. Constraints & Principles

- Single Next.js application (no microservices) until scale demands otherwise.
- GitHub App auth only; never ask users for personal access tokens.
- AI provider must be swappable behind an internal interface (start with Anthropic Claude).
- Secrets live only in server-side environment variables; nothing sensitive in client bundles.
- The existing landing page and waitlist are preserved; marketing site and product share one repo/app for MVP.

## 8. Open Product Questions

- Should rejected proposals allow "revise" (feed rejection reason back to the AI) in MVP, or is reject-and-re-ask enough? (Plan assumes simple reject + new message.)
- What are beta usage limits? (Plan assumes N chat requests/day and M published changes/day per user, configurable.)
- Do we auto-delete `dofast/*` branches after publish/discard? (Plan assumes yes, after a grace period.)
