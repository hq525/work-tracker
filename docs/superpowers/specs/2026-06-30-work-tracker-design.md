# Work Tracker — Design Spec

**Date:** 2026-06-30
**Status:** Approved design, ready for implementation planning

## Purpose

A personal web app for capturing work accomplishments and turning them into
interview-ready material. The driving pain: when behavioral interviews come up,
there are no concrete, STAR-style stories to draw on because nothing was
captured along the way.

The app does three jobs:

1. **Frictionless capture** of daily work notes — so raw material exists.
2. **AI-generated STAR stories** from selected notes — the interview payoff.
3. **Interview-question coverage** — track behavioral questions and see, per
   question, whether captured entries can answer them and how strongly.

**Primary risk we design against:** the capture habit never sticks. If logging
is even slightly annoying, it stops, and there is nothing to build stories or
coverage from. Capture friction is the enemy; every capture-path decision biases
toward zero friction.

## Users & scope

- **Single user (the author).** Hosted in the cloud so it is reachable from any
  device, but there is exactly one account. No signup flow, no per-user data
  isolation, no multi-tenant concerns.
- This is a deliberate trade for cost and simplicity. Growing to real
  multi-user later means adding an auth provider and a `user_id` column — not a
  rewrite.

## Architecture & stack

- **Framework:** Next.js (App Router). One project serves both the UI and the
  API routes — a single deployable unit.
- **Hosting:** Vercel free (Hobby) tier. Deploy on git push.
- **Database:** Neon (serverless Postgres, free tier). Chosen for clean
  serverless/Vercel connection handling.
- **Auth:** Single-password gate. One secret stored in an env var; a password
  screen sets a signed, HTTP-only session cookie on success. No auth provider,
  no user tables. API routes reject requests without a valid session cookie.
  - Secure enough for a one-user personal tool (one secret, HTTPS, signed
    cookie). Explicitly **not** the design for opening the app to other people.
- **AI:** Official Anthropic SDK calling the Claude API; key in an env var.
  - Model: **Claude Sonnet 4.6** (`claude-sonnet-4-6`) for both story
    generation and matching — cheaper than Opus and well within range for these
    tasks. Swappable to Opus later via config.
  - Story generation **streams** its response to avoid request timeouts on
    longer drafts.

Cost profile: everything runs on free tiers. The only real spend is per-use
Claude API calls (story generation + matching), each a few cents.

## Data model

Single user, so no `user_id` columns anywhere.

### `entries` — raw work notes (the capture habit)

| Column        | Notes                                                            |
| ------------- | --------------------------------------------------------------- |
| `id`          | primary key                                                     |
| `occurred_on` | date the work happened; defaults to today (allows backfilling)  |
| `created_at`  | timestamp                                                       |
| `body`        | freeform text; the only required field — capture must be cheap  |
| `tags`        | text array; optional (e.g. `project-x`, `leadership`)           |

Deliberately minimal: no title, no required structure. Type a sentence, save.

### `stories` — AI-generated STAR drafts

| Column             | Notes                                                       |
| ------------------ | ----------------------------------------------------------- |
| `id`               | primary key                                                 |
| `created_at`       | timestamp                                                   |
| `title`            | short label for findability                                 |
| `prompt_context`   | optional interview question/angle the user provided         |
| `body`             | generated STAR story, stored as **markdown** (single blob)  |
| `source_entry_ids` | which entries were selected to generate it (traceability)   |

Stored as one markdown blob with S/T/A/R headers inline — simplest and most
flexible for reading and copying.

### `questions` — behavioral interview questions

| Column         | Notes                                          |
| -------------- | ---------------------------------------------- |
| `id`           | primary key                                    |
| `created_at`   | timestamp                                      |
| `text`         | the behavioral question                        |
| `company_tags` | text array (e.g. `stripe`, `google`)           |

### `matches` — entry ↔ question join (only present when matched)

| Column        | Notes                                                  |
| ------------- | ------------------------------------------------------ |
| `id`          | primary key                                            |
| `created_at`  | timestamp                                              |
| `entry_id`    | FK to entries                                          |
| `question_id` | FK to questions                                        |
| `strength`    | `strong` \| `weak`                                     |
| `reason`      | one-line justification from Claude                     |

Unique on (`entry_id`, `question_id`). A non-match has **no row**, keeping the
table small and coverage queries trivial. Deleting an entry or question removes
its match rows (cascade).

## Matching execution model (cost-aware)

Re-checking every entry × every question on each change is too expensive.
Instead, **one Claude call per add/edit**:

- **Add a question** → one call passing that question + the existing entries
  (compact list). Claude returns which entries match, each with `strong`/`weak`
  and a one-line reason. Upsert match rows.
- **Add an entry** → one call passing that entry + all questions. Same shape
  back. Upsert match rows.
- **Edit** an entry or question → re-run that one item's matching against the
  other side; replace its match rows.
- **Delete** an entry or question → remove its match rows.

Matching cost scales with how often items are added/edited, not with dataset
size squared. At personal scale (tens–low hundreds of each), per-call token size
is trivial. If the dataset ever grew large enough that passing the full
candidate list became costly, that would be the point to revisit — out of scope
now (YAGNI).

## Screens & flows

Everything sits behind the password gate. Routes:

- `/login` — password screen.
- `/` — **capture + entries.** An always-focused text box at the top ("What did
  you do?"), optional date + tags, Save button. Below: reverse-chronological
  entry list with inline edit/delete. Saving an entry triggers its match call;
  the UI surfaces "matched N questions" as feedback, closing the capture loop.
- `/stories` — list of saved stories.
- `/stories/new` — select one or more entries, optionally type an interview
  question, Generate. Claude drafts the STAR story (streamed); user titles and
  saves it. Saved stories link back to their source entries.
- `/questions` — add a question (text + company tags), list existing ones.
  Adding triggers the match call; matched entries appear.
- `/coverage` — **summary page.** Every question listed with a coverage
  indicator: number of matching entries and best strength, e.g.
  "✅ 2 matches (1 strong)", "⚠️ 1 weak match", "❌ no match — gap". Filterable
  by company tag. Gaps are highlighted as the actionable signal.

API routes: entries CRUD, questions CRUD, story generation + story CRUD, and the
matching calls (invoked internally on entry/question add/edit).

## Error handling

Scaled to a single-user app — handle what actually happens, nothing speculative.

- **Claude API failure** (timeout, rate limit, error) on story generation or
  matching: catch it, show a clear "try again" message, preserve the user's
  input/selection so nothing is lost. Story generation streams to avoid
  timeouts. A failed match call leaves existing match rows untouched and is
  retryable.
- **Empty generation input:** Generate button disabled until at least one entry
  is selected.
- **Auth:** wrong password → clear message; missing/expired cookie → redirect to
  `/login`; API routes return 401 without a valid cookie.
- **DB:** Neon free-tier cold starts are covered by driver retries. No further
  handling.

No handling for multi-user races or concurrent edits — there is one user.

## Testing

Goal-driven, focused where bugs would hurt:

- **Entries CRUD** — create / list / edit / delete against a test database.
- **Questions CRUD** — create / list / edit / delete.
- **Auth gate** — correct password sets a session; wrong password rejected; API
  routes return 401 without a valid cookie.
- **Story generation** — Claude call mocked (no real spend). Assert selected
  entries + question are assembled into the prompt correctly and the returned
  markdown is saved with its `source_entry_ids`.
- **Matching** — Claude call mocked. Assert that on add/edit the right candidate
  set is sent and that returned matches are written as rows with correct
  `strength` and linkage; non-matches produce no rows; edits replace prior rows;
  deletes cascade.
- **Coverage query** — given seeded matches, assert per-question counts and best
  strength are computed correctly, including the gap (no-match) case and the
  company-tag filter.
- One optional hand-run live smoke call to confirm the real API key works.

## Explicitly out of scope

- Multi-user accounts / signup / per-user data isolation.
- Mobile-native app (the web app is reachable from a mobile browser).
- Importing from external systems (Jira, GitHub, Slack).
- Re-matching the entire dataset in bulk; large-dataset token optimization.
