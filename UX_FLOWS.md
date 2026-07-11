# DoFast UX Architecture & Flows

**Status:** M7.5 specification — approved direction, not yet implemented.
**Companion:** `DESIGN_SYSTEM.md` (tokens, components, copy, checklist). Component and
copy references below point there.

Mode is presentation, terminology, density, and guardrails — never ownership,
security, backend, or state-machine semantics. Every screen below therefore has one
implementation with two renderings.

---

## 1. Information architecture

### 1.1 Simple Mode

A business owner has *a website*, not a repository. The IA is website-centric and
flat:

```
Top bar: DoFast · [website name ▾ if >1] · History · Help · [account menu]

/dashboard            → if 1 active website: redirect to its workspace
                        if 0: connect-website empty state
/sites/:id            → Website workspace (THE screen: composer + status + recent)
/sites/:id/chat/:tid  → A conversation (request → plan → preview → live, inline)
/history              → All changes across the website(s)
/onboarding           → First-run only
```

**Hidden in Simple Mode** (never rendered, not merely collapsed): repositories,
branches, commits, SHAs, file paths, raw diffs, deployment logs, all GitHub/Vercel
terminology, and infrastructure detail. The Files page and technical proposal
detail are unreachable (not linked and mode-gated at render). The underlying data
is untouched — switching to Advanced reveals it instantly.

Vocabulary map (Simple ← technical): "your website" ← repo/site row · "the service
that stores your website's files" ← GitHub · "private preview" ← preview deployment ·
"make it live" ← merge/publish · "checking your site" ← verification · "undo" ←
revert.

### 1.2 Advanced Mode

Same shell, plus a workspace tab row and full technical surfaces:

```
/sites/:id            → Overview (status, repo, branch, last deploys, index state)
/sites/:id/chat…      → Chat (same threads; technical detail inline)
/sites/:id/changes    → Proposals & history with diffs, SHAs, verification logs
/sites/:id/files      → File browser + snapshot detail (existing M6 surface, restyled)
/sites/:id/settings   → Connection, branch, publish strategy (PR vs merge), reconnect
/repositories         → Repo selection (existing M5 surface, restyled)
```

Advanced shows: repo full name (mono), default branch, commit SHAs (short, mono,
copyable), file paths, unified diffs, preview URLs, deployment/check status,
publish strategy, index/snapshot state. Density per DESIGN_SYSTEM §1.11.

### 1.3 Shared shell

Both modes: 56px top bar (wordmark · site switcher · History · Help · account menu
with mode switcher + sign out), 640/1100px content columns, identical auth, routing,
and proxy protection. The mode value renders at request time from `user.ui_mode` —
one route tree, no duplicate pages.

---

## 2. Shared state patterns

Referenced by every screen spec as L/E/Err/S unless overridden:

- **L (loading):** <300ms nothing · 300ms–2s skeleton matching final layout ·
  >2s or consequential: progress + step label (DESIGN_SYSTEM §2.1 Progress).
- **E (empty):** one serif line stating the situation + one guidance line + one
  primary action (§2.2 Empty states).
- **Err (error):** inline for field-level; status card (danger) for blocking:
  what happened → "your live site is untouched" when true → one recovery action.
  Advanced may add one mono line of safe technical evidence.
- **S (success):** state change shown in place (status indicator update) + toast
  when the user may have navigated away. No celebratory interstitials.

---

## 3. The request lifecycle (spine)

```
Ask → (clarify?) → Plan (Draft) → Preview (private) → Approve → Make live →
Verify → Done  ·  any point → refine / reject  ·  after Done → History / Undo
```

Gates that always require an explicit click, both modes: **create preview** (first
repo write, to a DoFast branch), **make it live** (only production write), **undo**
(a new change via the same pipeline). Simple Mode may *offer* the next step more
insistently; it never takes it.

### 3.1 Quick actions (Simple Mode)

Seven ghost chips above the composer, shown only when the composer is empty, on the
workspace screen only (not inside threads): `Change phone number · Update business
hours · Change an image · Update prices · Add a service · Change some text ·
Something else`. Selecting one inserts a fill-in prompt into the composer (e.g.
"Change our phone number to ___") — the user always sends a real message; chips are
accelerators, not a form builder. Advanced Mode: no chips.

---

## 4. Screen-by-screen specification

Format per screen — **Goal** (user's) · **Primary** (action) · **Secondary** ·
**Show** · **Hide** · **Hierarchy** (top→bottom) · states (L/E/Err/S per §2 unless
noted) · **Simple** / **Advanced** deltas. "Both:" means identical.

### 4.1 First visit (landing page)
- **Goal:** understand what DoFast does and whether to trust it. **Primary:** join
  waitlist (pre-launch) / sign up (post-launch). **Secondary:** log in (top-right,
  quiet).
- **Show:** hero (§copy: "Your website, updated by asking."), 3-step how-it-works,
  safety promise section ("You approve every change. Preview first. Undo anytime."),
  what-it-works-with (GitHub-hosted Next.js/React — honest scope), waitlist form.
- **Hide:** fake logos/metrics/testimonials, feature-grid filler, screenshots of UI
  that doesn't exist.
- **Hierarchy:** hero → how it works → safety → fit/scope → CTA repeat → footer.
- **States:** waitlist submit inline success ("You're on the list — we'll email
  you at {address}.") / inline validation / generic failure per existing behavior
  (regression-locked). **Both:** identical (mode doesn't exist pre-auth).

### 4.2 Signup / 4.3 Login
- **Goal:** get in with minimum friction. **Primary:** create account / sign in.
  **Secondary:** switch to the other form; back to landing (wordmark).
- **Show:** labeled fields (name/email/password · email/password), inline errors
  verbatim from Better Auth's safe messages. **Hide:** password rules until relevant
  (show on error), social login (doesn't exist — never show dead buttons).
- **Hierarchy:** title → fields → primary → switch link. **Err:** field-attached.
- **Both:** identical.

### 4.4 Onboarding — welcome & mode choice
- **Goal:** understand the model (ask → preview → approve) and pick how DoFast talks.
- **Primary:** continue. **Secondary:** none (sign out in shell).
- **Show:** 3-step explanation (§copy), then the mode question with the two
  radio descriptions and "you can change this anytime". Default selection: Simple.
- **Hide:** all technical vocabulary until Advanced is chosen.
- **Hierarchy:** welcome → steps → mode question → continue. **S:** proceeds to
  connect. **Both:** this screen *sets* the mode; copy is mode-neutral.

### 4.5 Connect GitHub (connect your website)
- **Goal:** grant DoFast read access without fear. **Primary:** "Connect my website"
  (Simple) / "Install the DoFast GitHub App" (Advanced) → existing install flow.
- **Show:** plain-language permission explanation (§copy: read-only now, approval
  for every future change), what DoFast will never do (§6.4). Advanced adds: exact
  permission list (Contents: read, Metadata: read), App slug, target account choice
  explanation. **Hide (Simple):** the words GitHub App/installation/permissions-scopes
  where avoidable; the mechanics run unchanged underneath.
- **Err:** setup-callback failures return here with the safe reason and a retry.
- **S:** advance to selection.

### 4.6 Select repository (choose your website)
- **Goal:** point DoFast at the right site. **Primary:** per-row "Connect".
- **Show — Simple:** repo list rendered as "websites" (name only, already-connected
  chips). Support is checked at selection time (existing behavior); unsupported
  picks get the plain-language refusal with guidance — no listing-time
  classification calls (ruled at M7.5 review; revisit presentation in M8).
  **Show — Advanced:** full names (mono), private/archived badges, default
  branch, framework detection results.
- **Hide (Simple):** branches, framework jargon ("built with a system DoFast
  supports" instead). **E:** no grants → "Your connection doesn't include any
  sites yet" + manage-access guidance. **Err:** GitHub unreachable per §2.
- **S:** site created → workspace with indexing state (4.7).

### 4.7 Indexing (first snapshot)
- **Goal:** wait confidently while DoFast reads the site.
- **Primary:** none (auto-advances on completion). **Secondary:** none.
- **Show — Simple:** progress + "Reading your website so DoFast knows what it can
  change — under a minute." **Advanced:** same progress + live counts (files
  indexed/skipped), branch + head SHA (mono).
- **Hide (Simple):** counts, SHA, truncation mechanics (surfaced as plain scope
  statements if they occur). **S:** workspace ready. Truncated: banner —
  Simple "Your site is unusually large; DoFast can see most of it and will say so
  if a request touches the rest." / Advanced: truncated-index badge + counts.

### 4.8 Indexing failure
- **Goal:** know it's not their fault and what happens next. **Primary:** "Try
  again". **Secondary:** Help.
- **Show:** §2 Err card: "We couldn't read your website just now. Nothing is wrong
  with your site — this is usually temporary." Advanced adds the safe reason
  (branch not found / GitHub unreachable) + affected branch.
- Existing last-known-good semantics apply: if a previous index exists, the
  workspace stays usable with a "showing your site as of {date}" note.

### 4.9 Dashboard (multi-site home)
- **Goal:** get to my website('s workspace). **Primary:** open site workspace
  (whole card). **Secondary:** connect another website; History.
- Simple with one site: this screen is skipped (redirect to workspace). **Show:**
  site cards (§DS 2.2), each with status + last change. Advanced adds repo/branch/
  framework metadata. **E:** connect-website empty state (§copy). **Hide (Simple):**
  installation/index internals; suspended installations show "Reconnect" language.

### 4.10 Website workspace (the product's center)
- **Goal:** ask for a change; see the site's current state at a glance.
- **Primary:** the composer ("What would you like to change?"). **Secondary:**
  History; open in-flight change; Advanced tabs.
- **Show — Simple (640px, single column):** site name + Live status line ("Live ·
  last change 3 days ago"), any change **Waiting for you** (proposal/preview
  awaiting decision — accent card, top priority), composer + quick actions,
  last 3 changes (history rows). **Show — Advanced (1100px Overview tab):** the
  same + repo/branch (mono), index state + refresh, recent deployments, verification
  of last publish.
- **Hide (Simple):** everything in the §1.1 hidden list. **E:** first-visit
  variant: composer + "Try one of these to start". **Err:** disconnected site →
  reconnect card replacing composer (composer disabled with reason).

### 4.11 Starting a new request
- Sending a message creates/continues a thread (existing M7 mechanics). Composer
  clears, message renders, assistant state appears as "Thinking about your site…"
  (progress label, not fake typing). **Primary:** send. Rate-limit state per 4.34.

### 4.12 AI asks a clarification question
- **Goal:** give the missing fact fast. **Show:** the question as a normal
  assistant message; if the question offers finite options, render them as reply
  chips (tap = sends that answer) + the composer stays open for free text.
- **Both:** identical mechanics; Advanced questions may reference files ("There are
  two Footer components — `components/Footer.tsx` and `app/(marketing)/footer.tsx`.
  Which one?" — Simple version would have asked in visual terms instead).

### 4.13 AI acknowledges understanding
- One assistant message restating the request concretely before planning ("Updating
  the phone number in your footer from X to Y — planning this now."). Functional
  purpose: catches misunderstandings before compute is spent. Auto-continues into
  4.14 — this is not an approval gate.

### 4.14 Plan generation
- **Show:** progress with label "Planning the change — checking the files
  involved." Advanced adds which paths are being read (mono, streaming list).
  Cancel (ghost) available; cancels cleanly to composer.

### 4.15 Plan failure
- Err card in-thread: "I couldn't finish planning this. Your site is untouched."
  + Retry + Refine request. Advanced: safe reason line (provider timeout / context
  too large). Never a dead end: composer remains active.

### 4.16 Proposal review (plan ready)
- **Goal:** decide whether this is the change they meant. **Primary:** "Approve —
  create preview". **Secondary:** Reject. **Ghost:** Refine request.
- **Show — Simple:** Proposal card (§DS 2.2): one-line title, "Your live site has
  not been changed.", plain-language before→after list. **Advanced:** + file count,
  expandable per-file unified diff, base commit (mono), Simple summary above the
  diff (both renderings always stored).
- **Hide (Simple):** paths/diffs. **Err:** stale base (site changed since planning)
  → "Your site changed since this plan was made" + Re-plan.

### 4.17 Unsafe / unsupported request refusal
- Assistant message per §copy (names the plain reason + one alternative). Never a
  scolding tone; never a fake attempt. Advanced adds the category (e.g. "CI/workflow
  files are outside DoFast's write scope by design"). Composer stays active.

### 4.18 Preview generation / 4.19 Preview loading
- After approval: proposal card status → "Building your preview" with determinate-ish
  progress ("usually under two minutes"). The card states: "This builds a private
  copy. Your live site is untouched." Advanced: branch name created (mono), commit
  SHA, deployment status stream.

### 4.20 Preview failure
- Err card on the proposal: "The preview couldn't be built." + Retry preview +
  Refine + Reject. Explicit: "Your live site is unaffected." Advanced: deployment
  status/safe log excerpt. The proposal stays reviewable (diff/summary intact).

### 4.21 Preview comparison (preview ready)
- **Goal:** confirm the change looks right. **Primary:** "Make it live".
  **Secondary:** Reject. **Ghost:** Refine.
- **Show:** Preview frame (§DS 2.2 — labeled "Preview — not your live site"),
  open-in-new-tab; beneath it the plain-language change list for cross-checking;
  side-by-side "current site / preview" links on desktop (two-column permitted:
  comparison is the function). Advanced: preview URL, branch, checks status.
- **Hide (Simple):** URL internals (link labeled "Open my preview").

### 4.22 Approval / 4.23 Rejection
- Approval at either gate is one consequence-labeled click (§DS approval controls);
  the state indicator updates in place (S pattern). Rejection: one click + optional
  "what was wrong?" single-select (wrong content / wrong place / changed too much /
  other) feeding the audit trail — skippable, never blocking. Rejected proposals
  keep their record in History (state honesty) and the branch is cleaned up.

### 4.24 Editing / refining the request
- "Refine" returns focus to the composer pre-filled with context ("About the plan
  above: …"). A refined message supersedes the open proposal (old one → History as
  superseded). No in-place plan editing in this roadmap (Advanced later).

### 4.25 Publishing / 4.26 Publish progress
- "Make it live" → confirm-free (the button *is* the gate; consequence is stated on
  it) → status "Making it live… usually under two minutes" with aria-live updates.
  Advanced: merge strategy chosen in Settings applies (merge/PR); PR mode links the
  PR and pauses at "waiting for merge" honestly.
- Navigation away is safe and stated ("You can leave — we'll keep going.").

### 4.27 Publish failure
- Err card: "Making it live didn't work. Your live site is still running the
  previous version." + Retry + contact help. Advanced: safe reason (merge conflict →
  offers Re-plan on latest; protected branch → offers PR mode). Never auto-retry
  into production.

### 4.28 Verification / verification failure / 4.29 Success
- Per §DS verification states. Success: status → Live ✓ "checked at {time}", toast
  if elsewhere, history row finalized. Failure: warning block + Undo / Retry check
  (+ Advanced deployment detail). Success screen is the workspace itself updated —
  no interstitial celebration.

### 4.30 History
- **Goal:** trust through recall — "what changed, when, by whom". **Primary:** open
  item (drawer). **Secondary:** Undo on the newest published item.
- **Show:** reverse-chronological rows (§DS history item) across all lifecycle
  outcomes (published/verified, rejected, failed, superseded, undone) — full
  honesty, not a highlight reel. Advanced rows add SHAs and expose diff/verification
  logs in the drawer. **E:** "No changes yet — everything you publish will be
  recorded here." **Hide (Simple):** SHAs/branches/logs.

### 4.31 Undo
- Newest published change only (older = Advanced Revert with an explanation that it
  creates a new change). Dialog per §DS undo controls → fast-tracked pipeline:
  plan is mechanical (revert), preview auto-requested, user still clicks
  "Make it live". Progress copy: "Putting it back how it was…"

### 4.32 Rollback failure
- Err card: "The undo couldn't be completed automatically — your site is still
  running the current version." + Retry + help escalation. Advanced: conflict
  detail (intervening changes) + option to open a fresh revert plan on latest.

### 4.33 Switching modes
- Account menu → instant, toast-confirmed ("Advanced mode on — technical details
  are now visible."), reversible, no data change (§DS mode switcher). If switched
  while viewing a Simple-hidden surface (e.g. Files), switching back to Simple
  navigates to the workspace rather than rendering a hidden page.

### 4.34 Reconnecting expired/broken integrations & limit states
- **Suspended/uninstalled GitHub:** workspace composer disabled with reason +
  "Reconnect" primary → install flow (existing mechanics). Copy never blames the
  user. **Advanced:** installation state detail.
- **Quota / rate limits:** per §copy quota message — inline where the action was
  attempted (composer, refresh, publish), with the reset time. Never a modal.
  Existing in-flight work is preserved and stated.

---

## 5. Trust & safety UX

The product's core anxiety: "a robot can break my livelihood's website." Every rule
here exists to make the safe reality *visible*.

1. **Two explicit write gates, always** — create-preview (first repo write, DoFast
   branch only) and make-it-live (only production write). Rendered as
   consequence-labeled buttons; never keyboard-default-submitted from elsewhere;
   idempotent server-side (built in M5–M7 patterns).
2. **"Nothing has changed yet" is a rendered state, not an assumption.** Draft
   proposals and previews carry the reassurance line persistently. The status
   vocabulary (Draft / Preview / Waiting for you / Live / Needs attention) is fixed
   product language across both modes.
3. **Preview ≠ production is typographically enforced** — the preview frame header
   label is mandatory (§DS 2.2) and preview links are labeled "preview" in every
   surface.
4. **What DoFast will and won't change** is stated at connection and enforced
   mechanically: won't touch how the site is built/deployed (workflows), secrets,
   or dependencies; will only change site content and code you approve. Simple
   states it in plain words; Advanced lists the actual allowlist policy. The
   filtering/allowlist implementation from M6 (and M9's write-side lists) is the
   enforcement; the UX is its honest description.
5. **Permissions in plain language** at the moment they're requested (§copy), with
   the read→write upgrade in M10 explained the same way ("DoFast now needs
   permission to *propose* changes as drafts — you still approve everything").
6. **Safe refusals** name the reason and offer an alternative (§4.17); refusals are
   logged to history like any other outcome.
7. **Failure recovery is a path, never a wall:** every Err state carries exactly one
   recovery action and states production impact truthfully ("untouched" / "still
   running the previous version" / "may be affected — you can undo").
8. **Verification is visible proof**, not silent assumption (§4.28) — publish is not
   "done" until checked, and the check time is shown.
9. **Rollback is always communicated as available** on the newest published change,
   including in the verification-failure moment where it matters most.
10. **History is complete** — rejected, failed, superseded, and undone changes all
    appear. An audit trail that only shows successes isn't one.
11. **Destructive confirmations** follow §DS 2.2: consequence-stating title, exact
    loss/no-loss list, verb-labeled destructive button.
12. **Asymmetric mode rule:** Simple reduces anxiety without hiding truth (failures,
    scope limits, and states are always shown — in plain words); Advanced provides
    evidence without clogging the workflow (detail is one click deep, not inline
    walls).

---

## 6. Mode-gating implementation note (for M8+)

`user.ui_mode` (default `'simple'`, all accounts) is read server-side; hidden-in-
Simple surfaces are excluded at render, and their routes redirect to the workspace
in Simple Mode (never 404 — the resource exists and is the user's own). Both
proposal renderings (plain summary + technical diff) are always generated and
stored at plan time; mode selects presentation only. Guardrail deltas (Simple's
stricter path allowlist) are enforced server-side per-request from the same field.
