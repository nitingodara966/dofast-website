# DoFast Design System

**Status:** M7.5 specification — approved direction, not yet implemented (implementation is M7.6).
**Scope:** the product application AND the marketing landing page. One system, one identity.
**Companion:** `UX_FLOWS.md` (information architecture, screens, trust & safety UX).

Every rule in this document exists for a functional reason, stated inline. If a future
change can't state its functional reason, it doesn't ship. The Anti-AI-Template
Checklist (§7) is a mandatory pass/fail gate for every UI milestone from M7.6 onward.

---

## 0. Identity direction

**DoFast edits live businesses' websites. The identity must read as: calm, precise,
accountable.** The visual metaphor is a well-set document and a workshop tool — not a
dashboard, not a spaceship. Warm paper neutrals, near-black ink, one earthen accent,
generous whitespace, and typography doing the work that decoration usually fakes.

What DoFast deliberately is **not**: dark-mode-by-default, gradient-branded,
glassmorphic, animated, emoji-voiced, or hype-copied. The current landing page's
blue→purple gradient hero and 🎉/🚀 accents are explicitly retired in M7.6.

Theme policy: **light theme only** at launch. One coherent theme beats two half-done
ones; tokens are structured so a dark theme can be added later without component changes.

---

## 1. Design foundations

### 1.1 Color tokens

Implemented as CSS custom properties in `app/globals.css` via Tailwind v4 `@theme`
(the mechanism already in the repo — zero new dependencies). Components may only
reference tokens, never raw hex.

**Neutrals (warm):**

| Token | Value | Usage |
|---|---|---|
| `--color-paper` | `#FAF9F7` | App/page background |
| `--color-surface` | `#FFFFFF` | Cards, inputs, dialogs |
| `--color-sunken` | `#F3F1ED` | Wells, code/diff background, skeleton base |
| `--color-ink` | `#1C1917` | Primary text, primary icons |
| `--color-ink-secondary` | `#57534E` | Supporting text (7.4:1 on paper) |
| `--color-ink-tertiary` | `#79716B` | Meta text ≥14px only (4.9:1 on surface) |
| `--color-border` | `#E7E4DF` | Default 1px borders |
| `--color-border-strong` | `#D6D2CB` | Input borders, emphasized dividers |

**Accent — "Kiln" (rust/terracotta):** chosen because it is warm and human (matches
the local-business audience), rare in the AI-SaaS landscape (distinctive without
gimmick), and dark enough to pass contrast as both text and button fill. It is *not*
alarm-orange; semantic warning uses a distinct amber so accent never reads as danger.

| Token | Value | Usage |
|---|---|---|
| `--color-accent` | `#B04A25` | Primary buttons (white text: 4.6:1), focus rings, active states |
| `--color-accent-strong` | `#8F3A20` | Text links, accent text on light (7:1) |
| `--color-accent-subtle` | `#F6E7DF` | Selected/highlight backgrounds |
| `--color-accent-border` | `#EDD2C4` | Borders on accent-subtle surfaces |

**Accent restraint rule (functional):** accent marks *the* next action and *current*
selection — nothing else. Never for decoration, headings, icons at rest, borders at
rest, or more than one element per view region. If a view has two accent buttons,
one is wrong.

**Semantic:**

| Token | Text | Background | Usage |
|---|---|---|---|
| success | `#15693B` | `#E4F3E9` | Verified/live/connected states |
| warning | `#8A5A00` | `#FBF0DC` | Suspended, stale, attention-needed |
| danger | `#B42318` | `#FBEAE7` | Errors, destructive actions |
| neutral-status | `--color-ink-secondary` | `--color-sunken` | Drafts, pending, informational |

No blue "info" color: informational states are neutral. Blue is reserved for nothing —
its absence is part of the identity.

### 1.2 Typography

Three families, three jobs (loaded via `next/font` — no new packages):

| Family | Role | Weights | Why |
|---|---|---|---|
| **Source Serif 4** | Display: page titles ≥22px, marketing headlines | 500, 600 | Editorial serifs signal care and trust at display sizes; distinctive among sans-only AI SaaS |
| **Geist** (already loaded) | All UI and body text | 400, 500, 600 | Excellent legibility at small sizes; already in the repo |
| **Geist Mono** (already loaded) | Code, diffs, SHAs, paths, URLs | 400, 500 | Technical evidence must be visually distinct from prose |

**Scale** (px / line-height):

| Token | Size | Usage |
|---|---|---|
| `text-xs` | 12 / 1.4 | Timestamps, badges (never body copy) |
| `text-sm` | 13 / 1.5 | Advanced-Mode dense UI, table cells, meta |
| `text-base` | 14 / 1.5 | Default UI text |
| `text-body` | 16 / 1.6 | Simple-Mode reading text, chat messages, forms |
| `text-lg` | 18 / 1.4 | Section headings (sans, 600) |
| `text-xl` | 22 / 1.3 | Card/page subtitles (serif, 500) |
| `text-2xl` | 28 / 1.25 | Page titles (serif, 600) |
| `text-3xl` | 36 / 1.2 | Marketing section titles (serif, 600) |
| `text-4xl` | 48 / 1.1 | Landing hero only (serif, 600) |

Rules: no weight above 600 anywhere; no letter-spacing tricks except `text-xs`
uppercase labels (+0.04em); no gradient text, ever; maximum two type sizes per
component.

### 1.3 Spacing scale

4px base: `4, 8, 12, 16, 20, 24, 32, 40, 48, 64, 96`. Off-scale values are a
checklist failure. Vertical rhythm between page sections: 48 (app), 96 (marketing).
Card padding: 20 (Advanced) / 24 (Simple). Form field gap: 16.

### 1.4 Grid & layout

- App shell: full-width top bar (56px), centered content column.
- Content max-widths: **640px** Simple Mode & all reading/chat surfaces; **1100px**
  Advanced Mode workspaces and tables; **1120px** marketing sections.
- Single-column by default. Two-column only where comparison is the function
  (diff viewer, preview comparison).
- Page gutter: 24 mobile, 32 desktop.

### 1.5 Radius

Two radii + one exception: **6px** (buttons, inputs, badges, menu items), **10px**
(cards, dialogs, preview frames), **999px** only for status dots and avatar.
**No pill buttons** (retires the current rounded-full style — pills at button scale
read as marketing, not tools). Any third radius value is a checklist failure.

### 1.6 Borders & shadows

Structure comes from borders and background shifts, not shadows:
- Default: 1px `--color-border`; inputs 1px `--color-border-strong`.
- Exactly one shadow token, `--shadow-overlay` (`0 8px 24px rgb(28 25 23 / 0.10)`),
  used **only** on floating layers: dialogs, drawers, menus, toasts. Cards never
  cast shadows.
- Focus: 2px outline in `--color-accent`, offset 2px — on every interactive element,
  keyboard-visible always.

### 1.7 Iconography

- One style: stroke icons, 1.5px stroke, round joins, 16px (inline/dense) and 20px
  (buttons/nav) sizes, drawn on a 24px grid.
- Implemented as a small local SVG component set (~15 icons) in M7.6 — no icon
  dependency until the set outgrows hand-maintenance (adding a library requires
  approval).
- Icons always accompany text or carry `aria-label`; never decorative scatter.
  **No emoji in UI.** Emoji may appear only inside user-authored content.

### 1.8 Motion

Motion communicates state change; it never entertains:
- Micro (hover, focus, toggle): 120ms ease-out, opacity/color only.
- Layer entry (dialog, drawer, menu, toast): 160–200ms ease-out, translate ≤8px + fade.
- Progress: determinate bars whenever the system can estimate; indeterminate only
  with a text label of what's happening.
- Forbidden: entrance animations on page content, parallax, looping/pulsing
  decoration, skeleton shimmer faster than 1.2s.
- `prefers-reduced-motion`: all transitions collapse to instant state changes.

### 1.9 Responsive breakpoints

Tailwind defaults — `640 / 768 / 1024 / 1280` (functional reason: zero framework
friction). Rules: mobile-first; no horizontal page scroll ever (wide artifacts like
diffs scroll inside their own container); touch targets ≥44px on <768px; Advanced
tables collapse to definition-list rows below 768px.

### 1.10 Accessibility standards

WCAG 2.1 AA is the floor, enforced by the checklist:
- Text contrast ≥4.5:1; UI component/graphic contrast ≥3:1 (all §1.1 tokens comply).
- Every interactive element keyboard-reachable with visible focus (§1.6).
- Real `<label>` on every input — placeholder-as-label is banned (current auth and
  waitlist forms violate this; fixed in M7.6).
- Dialogs/menus: focus trap, Escape closes, focus returns to invoker, correct ARIA
  roles.
- Status changes announced via `aria-live="polite"` (publish progress, verification).
- Color never the sole carrier of meaning (status = dot + word).
- Touch targets ≥44×44 on touch layouts.

### 1.11 Density rules — Simple vs Advanced

Same tokens, different defaults. Density is a *parameter*, not a fork:

| Property | Simple | Advanced |
|---|---|---|
| Base text | 16px (`text-body`) | 14px (`text-base`) |
| Content width | 640px | 1100px |
| Card padding | 24 | 20 |
| List rows | 64px min, 2-line | 44px min, 1-line |
| Information per view | One decision per screen | Multiple panels permitted |
| Tables | Never (lists instead) | Permitted |
| Technical metadata | Hidden (see `UX_FLOWS.md` §1) | Inline, mono-set |

---

## 2. Shared component system

Nine primitives; everything else is a composition. Creating a new primitive requires
demonstrating no composition works — variety without function is a checklist failure.

### 2.1 Primitives

**Button.** Variants: `primary` (accent fill, white text — max one per view region),
`secondary` (surface + strong border), `ghost` (text-only, for tertiary/inline),
`destructive` (danger fill — only inside confirmation contexts, never side-by-side
with primary as an equal choice). Sizes: `md` 36px, `sm` 28px (Advanced dense areas).
States: hover (darken 6%), focus ring, disabled (40% opacity + no pointer), loading
(spinner replaces label, width locked to prevent reflow). Icon+label allowed;
icon-only requires `aria-label`.

**Link.** Inline: `--color-accent-strong`, underline on hover (underline always
present inside body prose). Standalone navigational links: ink, 500 weight, no
underline. External links marked with the external icon.

**Input / Textarea.** 1px strong border, 6px radius, surface bg, 36px height (input),
visible label above, optional help text below, error state = danger border + danger
help text + `aria-invalid`. Textarea min 3 rows, vertical resize only.

**Card.** Surface bg, 1px border, 10px radius, no shadow. Variants: `default`,
`interactive` (hover: border-strong + sunken bg tint; entire card is the link),
`status` (4px left border in a semantic color). Cards must contain a heading; cards
may not nest cards.

**Dialog.** Centered, max-width 480px, overlay `rgb(28 25 23 / 0.4)`, overlay shadow,
title (serif `text-xl`) + body + right-aligned actions (primary rightmost). Focus
trap + Escape + return focus. Used for decisions; never for content browsing.

**Drawer.** Right-side panel, 480px (Simple) / 640px (Advanced), same layer rules as
Dialog. Used for detail-on-demand (history item detail, technical detail in Advanced).

**Dropdown menu.** Anchored, 6px radius items, 200ms max open animation, full
keyboard support (arrows/Home/End/Escape/typeahead). Destructive items styled danger
and separated by a divider.

**Status indicator.** Dot (8px, 999px radius) + word, semantic colors from §1.1.
The five product statuses and their fixed vocabulary:
`Draft` (neutral) · `Preview` (neutral, globe icon) · `Waiting for you` (accent) ·
`Live` (success) · `Needs attention` (warning/danger). Color never appears without
the word.

**Progress.** Determinate bar (4px, accent) with step label ("Building preview —
usually under a minute"); indeterminate variant requires a label. Multi-step
lifecycle progress uses the Stepper composition (§2.2).

Also standardized at primitive level: **Toast** (bottom-right, max 3 stacked,
auto-dismiss 6s except errors which persist until dismissed, always includes a noun —
"Change published", never "Success!"), **Skeleton** (sunken bg blocks matching final
layout, 1.2s pulse, only for >300ms loads), **Badge** (`text-xs` uppercase,
semantic or neutral colors; used for facts — "Private", "Next.js" — never decoration).

### 2.2 Compositions (domain components)

**Chat composer.** The product's centerpiece. Textarea-styled single field, `text-body`,
placeholder "What would you like to change?", send button (primary, icon+label
"Send"), 4,000-char counter appearing at 3,500. Quick-action chips (§ UX_FLOWS 3.1)
render *above* the composer as ghost-style suggestions — dismissible, never a grid.
Disabled state carries the reason inline ("Reconnect GitHub to continue").

**Site card.** Composition of interactive Card: site display name (Simple: the
domain/business name; Advanced: `repoFullName` in mono), status indicator, last-change
line ("Menu prices updated · 2 days ago"), primary affordance = open workspace.
Advanced adds framework badge + branch in mono. No stats, no sparkline, no fake
activity.

**Navigation (app shell).** 56px top bar: wordmark (text "DoFast", serif 600 — no
logo mark until one exists), center: current-site name (switcher when >1 site),
right: History link, help link, account menu (contains mode switcher, sign out).
No sidebar in Simple Mode. Advanced workspaces add a tab row under the bar:
`Overview · Chat · Changes · Files · Settings`. Current tab: ink + 2px accent
underline; inactive: ink-secondary.

**Mode switcher.** Inside the account menu: two radio rows ("Simple — plain language,
guided" / "Advanced — technical detail, full control") + one line: "Changes how
DoFast talks to you. Nothing about your website or history changes." Switching is
instant, announced by toast, reversible; no dialog.

**Proposal card.** The plan-review surface (both modes; see UX_FLOWS §4 for screens).
Structure: title (what will change, one sentence) · status indicator (`Draft`) ·
"Your live site has not been changed." reassurance line · body: Simple = plain-language
change list ("Your phone number in the footer: (512) 555-0134 → (512) 555-0199");
Advanced = same list + file count + expandable unified diff · footer actions:
primary consequence-labeled per stage ("Approve — create preview", then
"Make it live"), secondary "Reject", ghost "Refine request". Never auto-advances
past a gate.

**Diff viewer** (Advanced; Simple never renders it). Mono 13px, unified diff,
sunken bg, additions `#E4F3E9`/deletions `#FBEAE7` full-line tints (no red/green
text — colorblind-safe with +/− gutters), per-file collapsible sections with path
headers in mono, horizontal scroll contained. Max-height 480px per file with
"Show all" expansion.

**Preview frame.** Bordered container (10px radius) with a labeled header bar:
globe icon + "Preview — not your live site" (neutral status) + "Open in new tab"
ghost button. Contains iframe or screenshot link-out. The header label is
non-negotiable trust UI: previews must never be mistakable for production.

**Approval controls.** One primary button whose label states the consequence:
"Approve — create preview" / "Make it live". Adjacent secondary "Reject" and ghost
"Refine". Approval buttons never appear while state is loading; double-submit
locked at the button (loading state) *and* server (idempotency, already built).

**Publish controls.** Simple: primary "Make it live" + line "You can undo this
afterward." Advanced: same primary plus a select for merge strategy (direct merge /
pull request) with branch names in mono. Publishing is always behind its own click —
never bundled with approval.

**Verification states.** Post-publish status block: `Checking your site…`
(determinate progress) → success: "Live and working — checked HH:MM" (success
indicator) → failure: warning block "Published, but the check didn't pass" with
recovery actions (Retry check / Undo this change / Advanced: view deployment detail).

**History item.** Row: one-sentence title (from proposal), date, status indicator,
who requested it. Click → drawer: full plain-language summary, before/after where
applicable, "Undo this change" (if newest published) — Advanced adds commit SHAs
(mono), branch, diff link, verification log.

**Undo / rollback controls.** "Undo" appears on the most recent published change
only (older reverts = Advanced "Revert", which explains it creates a new change).
Undo opens a Dialog: "Put it back how it was?" + summary of what will be restored +
primary "Yes, undo" — then runs the standard preview→publish pipeline in a
fast-tracked UI (§UX_FLOWS 4.30).

**Empty states.** Pattern: one serif `text-xl` line stating the situation, one
`text-base` line of guidance, one primary action. No illustration until a real
illustration system exists (placeholder art is a checklist failure). Max 3 per app
visible lifetime — empty states are onboarding, not decoration.

**Loading states.** <300ms: nothing. 300ms–2s: skeleton. >2s or consequential
(plan, preview, publish): progress with step label. Buttons carry their own loading
state; whole-page spinners are banned.

**Errors.** Inline errors attach to their field/section (danger text + border).
Blocking errors use a status Card (danger left border): what happened (plain), what
DoFast did about it ("your live site is untouched"), one recovery action. Raw
provider/stack detail never renders; Advanced may show a mono one-line safe detail
(status codes, SHA) when it aids action.

**Destructive confirmations.** Dialog with consequence-stating title ("Disconnect
this website?"), body listing exactly what is and isn't lost ("Your site and its
history stay on GitHub. DoFast will no longer be able to read or change it."),
destructive-variant confirm button labeled with the verb ("Disconnect") — never
"OK/Yes". Type-to-confirm is reserved for irreversible multi-entity loss (none
exist yet).

---

## 3. Product copy system

### 3.1 Voice

Calm, specific, and accountable. DoFast talks like a careful contractor: says what
it will do, does it, says what it did, and never oversells.

Rules:
1. Concrete nouns and numbers over adjectives ("Checked at 2:41 PM" not "All good!").
2. Present tense, active voice, second person.
3. State the system's status truthfully even when reassuring ("Published, but the
   check didn't pass" — never hide failure behind cheer).
4. No hype vocabulary: revolutionize, supercharge, magical, blazing, effortless,
   10x, AI-powered-as-adjective. No exclamation marks in system copy.
5. No unverifiable claims (retires "Join hundreds of businesses").
6. Simple register: no git/deploy vocabulary, sentence-case everything, contractions
   welcome. Advanced register: precise technical nouns (branch, merge, SHA) — but the
   same calm tone; jargon is permitted, attitude is not.
7. Errors: what happened → what it means for the user → the one next step.

### 3.2 Example copy (canonical — M7.6+ uses these verbatim unless superseded)

| Touchpoint | Copy |
|---|---|
| Landing hero | **"Your website, updated by asking."** — sub: "DoFast connects to the code behind your site and makes the changes you describe. You see a preview of every change before it goes live." CTA: "Join the waitlist" |
| Landing how-it-works | "Connect your site" / "Ask for a change" / "Preview it, then make it live" — each with one factual sentence |
| Onboarding welcome | "Let's connect your website. DoFast works with sites built on Next.js or React and hosted through GitHub — you'll approve every change before it goes live." |
| Mode question | "How should DoFast talk to you?" — "Simple: plain language, no technical terms. Best if someone else built your site." / "Advanced: branches, diffs, and deploy detail. Best if that sentence made sense." + "You can change this anytime." |
| Connection permissions (Simple) | "DoFast asks GitHub — the service that stores your website's files — for permission to read your site. It can't change anything yet; you'll grant that later, and every change will need your approval first." |
| Empty dashboard | "No website connected yet." / "Connect your site to start making changes by asking." / [Connect my website] |
| Request composer placeholder | "What would you like to change?" |
| AI clarification | "Quick question before I plan this: which phone number should I update — the one in the footer, the contact page, or both?" |
| Proposal ready (Simple) | "Here's the plan. Your live site hasn't been touched." |
| Proposal ready (Advanced) | "Plan ready — 2 files, +6 −2. Nothing has been written to the repository." |
| Preview ready | "Your preview is ready. This is a private copy — your live site is unchanged." |
| Approval | "Approve — create preview" → later: "Make it live" |
| Publishing | "Making it live… usually under two minutes." |
| Verification success | "Live and working. Checked at {time}." |
| Verification failure | "Published, but our check didn't pass. Your visitors may be affected — you can undo this change now, or retry the check." |
| Undo | "Put it back how it was? This restores your site to how it looked before '{change title}'." |
| Unsupported request | "That's outside what DoFast can safely change — it would affect {plain reason, e.g. 'how your site is built and deployed'}. Here's what I can do instead: {alternative}." |
| Quota limit | "You've reached today's limit of {n} changes. It resets at {time}. Nothing you've done is lost." |
| Generic error | "Something went wrong on our side. Your live site is untouched. Try again in a moment." |

---

## 4. Anti-AI-Template Review Checklist

Mandatory gate for every UI milestone (M7.6–M14). Every item is pass/fail; any FAIL
blocks merge. Reviewer records the table in the milestone report.

| # | Check | Pass condition |
|---|---|---|
| 1 | Spacing discipline | Every margin/padding on the §1.3 scale |
| 2 | Radius discipline | Only 6px / 10px / 999px-for-dots present |
| 3 | Card restraint | No nested cards; no card without a heading; lists are lists, not card grids |
| 4 | No gradients | Zero gradient backgrounds/text/borders anywhere |
| 5 | Accent restraint | ≤1 accent action per view region; accent never decorative |
| 6 | Copy is specific | No hype vocabulary (§3.1.4); every system message names a concrete noun/outcome |
| 7 | Function-only decoration | Every visual element answers "what does this communicate?" |
| 8 | Icon consistency | Single stroke set, 2 sizes, no emoji in UI chrome |
| 9 | Motion restraint | No entrance animations on content; all transitions ≤200ms; reduced-motion honored |
| 10 | No fake proof | Zero invented metrics, testimonials, logos, or activity |
| 11 | Badge restraint | Badges state verifiable facts only |
| 12 | Hierarchy | Each screen has exactly one visual primary action; heading levels sequential |
| 13 | Mobile integrity | No horizontal page scroll at 360px; wide artifacts scroll internally; touch targets ≥44px |
| 14 | Contrast | All text ≥4.5:1, UI graphics ≥3:1 (token-derived, spot-checked) |
| 15 | Simple Mode purity | No repo/branch/commit/SHA/path/diff/deploy/GitHub/Vercel terminology reachable in Simple Mode surfaces |
| 16 | Advanced Mode evidence | Every lifecycle state exposes its technical evidence (SHA, branch, deployment status) within one click |
| 17 | Label integrity | Every input has a real label; placeholder never the only label |
| 18 | State honesty | Every failure state names the failure; no error hidden behind a success-toned message |

---

## 5. Implementation strategy (executed as M7.6; consumed by M8–M14)

### 5.1 Token architecture
All §1 tokens land as CSS custom properties in `app/globals.css` under Tailwind v4
`@theme`, replacing the current two-variable dark scheme. Fonts via `next/font`
(add Source Serif 4 alongside the existing Geist pair). No configuration files, no
new dependencies. Components reference tokens through Tailwind utilities only.

### 5.2 Shared primitives
`components/ui/` gains the nine primitives (§2.1) as thin, typed, zero-dependency
React components (+ the ~15-icon local SVG set). Compositions (§2.2) live beside the
features that own them and may import only primitives + tokens. If Dialog/Dropdown
accessibility proves too costly to hand-roll correctly, adopting a headless library
requires explicit approval first — the default plan is hand-rolled with the §1.10
keyboard/focus contract tested.

### 5.3 Migration order (M7.6, one PR-sized step each)
1. Tokens + fonts + primitives (no page changes yet; old pages temporarily coexist).
2. App shell: navigation, layout backgrounds, error/not-found pages.
3. Auth (login/signup) + onboarding — includes the label-integrity fixes.
4. Dashboard + repositories.
5. Site workspace (files/snapshot page) + chat.
6. Landing page last — full redesign to §3.2 copy and §1 foundations with the
   waitlist flow regression-locked (existing tests must pass with only copy-assertion
   updates made in the same change, reviewed one-by-one).

### 5.4 Replace vs preserve

| Existing surface | Decision |
|---|---|
| Landing page visuals/copy | **Replace** (gradient, emoji, unverifiable claims retired) |
| Waitlist form behavior, API, validation, rate limiting | **Preserve exactly** (regression-locked) |
| Auth/onboarding/dashboard/chat/files behavior, routing, actions | **Preserve exactly**; visual layer replaced |
| SEO metadata | Preserve structure; copy updated with the redesign |
| All backend, DAL, webhooks, proxy, migrations | **Untouched** |

### 5.5 Testing strategy
- Existing 238 behavioral tests remain the functional safety net; copy-assertion
  updates are made alongside the copy they test, never loosened to regex-anything.
- New primitive tests: variant rendering, disabled/loading behavior, keyboard
  contract for Dialog/Dropdown (focus trap, Escape, arrows).
- Accessibility: M7.6 ships a manual audit against §1.10 recorded in the milestone
  report; automated axe checks are proposed for M14 (dependency — needs approval).
- Responsive: manual matrix at 360/768/1024/1440 recorded in the milestone report;
  automated visual regression (Playwright screenshot baseline) is an M14 deliverable.
- The §4 checklist is executed and reported for every migrated surface.

### 5.6 How M8–M14 consume the system
Hard rules: new UI may only use tokens + primitives + documented compositions; any
new component must be specified against §2 conventions before implementation; every
milestone report includes the §4 checklist table; Simple/Advanced presentations of
any new surface must both be specified (UX_FLOWS.md pattern) before code.
