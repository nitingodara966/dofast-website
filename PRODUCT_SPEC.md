# DoFast — Product Specification

**Status:** v2 — dual-mode direction, approved. Supersedes v1.
**Companions:** `ARCHITECTURE.md` (system design) · `IMPLEMENTATION_PLAN.md` (roadmap)
· `DESIGN_SYSTEM.md` + `UX_FLOWS.md` (approved M7.5 design/UX baseline).

## 1. What DoFast is

DoFast lets people update their existing website by asking. It connects to the
GitHub repository behind a Next.js/React site; the user describes a change in
chat, reviews a plan, sees a private preview, and explicitly makes it live —
with verification afterward and one-click undo.

**One line:** Your website, updated by asking.

## 2. Two audiences, one product (dual mode)

| | **Simple Mode** (default) | **Advanced Mode** |
|---|---|---|
| Audience | Local business owners, non-technical operators | Developers, agencies, technical founders |
| Language | Plain English; zero git/deploy vocabulary | Branches, diffs, SHAs, deploy detail |
| Request | Chat + quick-action suggestions | Free-form technical chat |
| Review | Plain-language before→after plan; "See your new site" | Same plan + unified diff + technical evidence |
| Publish | "Make it live" | Merge or pull-request strategy |
| After | "Live and working — checked at {time}"; Undo | Verification detail; revert with SHAs |

**Mode policy (ruled):** every account — existing, test, and new — defaults to
**Simple Mode**. Users pick at onboarding and can switch anytime from the account
menu. Switching changes presentation, terminology, density, and guardrail
strictness only — never ownership, security, data, or lifecycle semantics. Both
renderings of every plan are always generated and stored; mode selects what is
shown.

## 3. Core lifecycle (both modes, one state machine)

```
Ask → (clarify) → Plan (Draft) → Preview (private) → Approve → Make live
→ Verify → History  ·  any step → refine/reject  ·  newest published → Undo
```

Product invariants (non-negotiable):
1. AI never writes to the production branch. All proposed changes live on
   DoFast-managed `dofast/*` branches.
2. Two explicit human gates, always: **create preview** (first repo write) and
   **make it live** (only production write). Simple Mode may offer next steps
   more insistently; it never takes them.
3. "Nothing has changed yet" is a rendered state, not an assumption. Preview and
   production are visually and verbally distinct at all times.
4. Publish is not done until **verified** — the post-publish check is visible,
   timestamped, and failure offers undo.
5. Every outcome — published, rejected, failed, superseded, undone — is recorded
   in a complete, visible history.
6. Minimum GitHub access: a GitHub App with per-repository grants and
   least-privilege permissions (read-only until the write milestone), never
   personal access tokens.

## 4. Scope

### Shipped (production-accepted)
Landing page + persisted waitlist · email/password auth · onboarding ·
GitHub App connection (read-only) · repository selection with framework
detection · read-only repository indexing/snapshots · per-site chat with
persisted threads (placeholder responder).

### In scope (remaining MVP)
Design system + full UI migration (incl. landing page) · dual-mode foundation ·
provider-agnostic AI chat · structured change plans with dual renderings ·
approval + branch writes (permission upgrade) · preview deployments via the
user's own Vercel↔GitHub integration · publish + verification · history +
undo/rollback · usage limits, hardening.

### Out of scope for MVP
WordPress/Webflow/non-GitHub sites · non-Next.js/React repos (politely refused)
· DoFast-hosted preview infra · teams/roles · billing (schema stays
billing-ready) · SMS/mobile apps · dark mode (tokens stay dark-ready; ruled:
light-only launch) · brand mark (ruled: text-only wordmark until a genuine need).

## 5. Experience principles (binding)

Defined in full in `DESIGN_SYSTEM.md` and `UX_FLOWS.md`; the contract in brief:
- Calm, precise, accountable — a careful contractor, not a hype machine. No
  unverifiable claims, no hype vocabulary, no emoji UI, no gradients, one accent
  (Kiln rust `#B04A25`) used with restraint.
- Simple reduces anxiety without hiding truth; Advanced provides evidence
  without clogging the workflow.
- Every UI milestone passes the Anti-AI-Template Checklist
  (`DESIGN_SYSTEM.md` §4) before merge.
- The marketing landing page is part of the trust surface: same system, same
  copy principles, waitlist/auth/SEO behavior regression-locked.

## 6. Success criteria (MVP)

- A Simple-Mode user goes from signup to a published, verified one-file copy
  change without encountering a single technical term — in under 10 minutes.
- An Advanced-Mode user can trace any published change to its commit, branch,
  diff, and verification evidence in ≤2 clicks from history.
- Zero AI writes to production branches without both human gates.
- Every published change has a complete audit trail and a working undo path.

## 7. Open product questions

- Quota levels for beta (assumed: configurable daily chat/publish caps — M14).
- Advanced-Mode in-place plan editing (deferred beyond MVP; refine-request is
  the MVP loop).
- When a real brand mark is warranted (explicitly not now).
