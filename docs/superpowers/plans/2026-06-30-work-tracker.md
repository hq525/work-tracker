# Work Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A single-user hosted web app to capture work notes, generate STAR interview stories from them, and track behavioral-question coverage via AI semantic matching.

**Architecture:** Next.js (App Router, TypeScript) serving both UI and API routes. All judgment-heavy logic (Claude prompt building, response parsing, coverage aggregation, match-row diffing) lives in **pure functions** so it is unit-tested without a database or network. Thin adapters wrap Postgres (Neon) and the Anthropic SDK; these are mocked in route tests. A single-password gate sets a signed session cookie enforced by middleware.

**Tech Stack:** Next.js 15 (App Router), TypeScript, `@neondatabase/serverless` (Postgres), `@anthropic-ai/sdk`, Vitest (testing), `jose` (signed cookie JWT). Deployed on Vercel; DB on Neon.

## Global Constraints

- Single user. No `user_id` columns, no signup, no per-user isolation.
- Claude model for all calls: `claude-sonnet-4-6` (exact string). Use the official `@anthropic-ai/sdk`; never raw HTTP.
- Story generation must stream (`client.messages.stream(...)` + `.finalMessage()`).
- Adaptive thinking only — never pass `budget_tokens`, `temperature`, `top_p`, or `top_k` to the API (all 400 on this model family).
- `max_tokens`: 4096 for matching, 4096 for story generation.
- All API routes require a valid session cookie; reject with 401 otherwise.
- Secrets via env vars only: `DATABASE_URL`, `ANTHROPIC_API_KEY`, `APP_PASSWORD`, `SESSION_SECRET`. Never hardcode.
- A `matches` row exists only for an actual match; non-matches have no row.
- `strength` is exactly `'strong'` or `'weak'`.

---

### Task 1: Project scaffold & tooling

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`, `src/app/layout.tsx`, `src/app/globals.css`
- Test: `src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: a runnable Next.js + Vitest project. No exported code yet.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "work-tracker",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "test": "vitest run",
    "test:watch": "vitest",
    "db:migrate": "tsx scripts/migrate.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.40.0",
    "@neondatabase/serverless": "^0.10.0",
    "jose": "^5.9.0",
    "next": "^15.1.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/react": "^19.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.7.0",
    "vitest": "^2.1.0"
  }
}
```

- [ ] **Step 2: Install dependencies**

Run: `npm install`
Expected: `node_modules/` created, no errors.

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["dom", "dom.iterable", "ES2022"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "incremental": true,
    "skipLibCheck": true,
    "paths": { "@/*": ["./src/*"] },
    "plugins": [{ "name": "next" }]
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
```

- [ ] **Step 4: Create `next.config.ts`, `vitest.config.ts`, `.gitignore`, `.env.example`**

`next.config.ts`:
```ts
import type { NextConfig } from "next";
const nextConfig: NextConfig = {};
export default nextConfig;
```

`vitest.config.ts`:
```ts
import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: { environment: "node", globals: false },
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
});
```

`.gitignore`:
```
node_modules
.next
.env
.env.local
*.tsbuildinfo
next-env.d.ts
```

`.env.example`:
```
DATABASE_URL=postgres://user:pass@host/db
ANTHROPIC_API_KEY=sk-ant-...
APP_PASSWORD=choose-a-strong-password
SESSION_SECRET=32-plus-random-bytes-base64
```

- [ ] **Step 5: Create root layout and globals**

`src/app/layout.tsx`:
```tsx
import type { ReactNode } from "react";
import "./globals.css";

export const metadata = { title: "Work Tracker" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
```

`src/app/globals.css`:
```css
:root { font-family: system-ui, sans-serif; }
body { margin: 0; padding: 1.5rem; max-width: 760px; }
```

- [ ] **Step 6: Write smoke test**

`src/lib/__tests__/smoke.test.ts`:
```ts
import { expect, test } from "vitest";
test("toolchain runs", () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 7: Run the smoke test**

Run: `npm test`
Expected: PASS (1 test passed).

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js + Vitest project"
```

---

### Task 2: Database schema & migration runner

**Files:**
- Create: `db/schema.sql`, `scripts/migrate.ts`

**Interfaces:**
- Produces: tables `entries`, `stories`, `questions`, `matches` in the target Postgres. `scripts/migrate.ts` reads `DATABASE_URL` and applies `db/schema.sql`.

- [ ] **Step 1: Write `db/schema.sql`**

```sql
CREATE TABLE IF NOT EXISTS entries (
  id          BIGSERIAL PRIMARY KEY,
  occurred_on DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  body        TEXT NOT NULL,
  tags        TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS stories (
  id              BIGSERIAL PRIMARY KEY,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  title           TEXT NOT NULL,
  prompt_context  TEXT,
  body            TEXT NOT NULL,
  source_entry_ids BIGINT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS questions (
  id           BIGSERIAL PRIMARY KEY,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  text         TEXT NOT NULL,
  company_tags TEXT[] NOT NULL DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS matches (
  id          BIGSERIAL PRIMARY KEY,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  entry_id    BIGINT NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  question_id BIGINT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
  strength    TEXT NOT NULL CHECK (strength IN ('strong','weak')),
  reason      TEXT NOT NULL,
  UNIQUE (entry_id, question_id)
);
```

- [ ] **Step 2: Write `scripts/migrate.ts`**

```ts
import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { join } from "node:path";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  const sql = neon(url);
  const schema = readFileSync(join(process.cwd(), "db/schema.sql"), "utf8");
  for (const stmt of schema.split(";").map((s) => s.trim()).filter(Boolean)) {
    await sql.query(stmt);
  }
  console.log("migration complete");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
```

- [ ] **Step 3: Apply the migration**

Run (with a real or test `DATABASE_URL` exported): `npm run db:migrate`
Expected: prints `migration complete`. (If no DB is available yet, defer this run to deployment setup; the file content is the deliverable.)

- [ ] **Step 4: Commit**

```bash
git add db/schema.sql scripts/migrate.ts
git commit -m "feat: add database schema and migration runner"
```

---

### Task 3: Domain types & data-access layer

**Files:**
- Create: `src/lib/types.ts`, `src/lib/db.ts`

**Interfaces:**
- Produces:
  - Types: `Entry { id:number; occurredOn:string; createdAt:string; body:string; tags:string[] }`, `Story { id:number; createdAt:string; title:string; promptContext:string|null; body:string; sourceEntryIds:number[] }`, `Question { id:number; createdAt:string; text:string; companyTags:string[] }`, `Match { id:number; entryId:number; questionId:number; strength:'strong'|'weak'; reason:string }`.
  - `db` object with async methods:
    - `listEntries(): Promise<Entry[]>`
    - `createEntry(body:string, occurredOn:string|null, tags:string[]): Promise<Entry>`
    - `updateEntry(id:number, body:string, occurredOn:string, tags:string[]): Promise<Entry>`
    - `deleteEntry(id:number): Promise<void>`
    - `listQuestions(): Promise<Question[]>`
    - `createQuestion(text:string, companyTags:string[]): Promise<Question>`
    - `updateQuestion(id:number, text:string, companyTags:string[]): Promise<Question>`
    - `deleteQuestion(id:number): Promise<void>`
    - `listStories(): Promise<Story[]>`
    - `createStory(title:string, promptContext:string|null, body:string, sourceEntryIds:number[]): Promise<Story>`
    - `listMatches(): Promise<Match[]>`
    - `replaceMatchesForEntry(entryId:number, rows:{questionId:number;strength:'strong'|'weak';reason:string}[]): Promise<void>`
    - `replaceMatchesForQuestion(questionId:number, rows:{entryId:number;strength:'strong'|'weak';reason:string}[]): Promise<void>`

- [ ] **Step 1: Write `src/lib/types.ts`**

```ts
export type Strength = "strong" | "weak";

export interface Entry {
  id: number;
  occurredOn: string; // ISO date
  createdAt: string;
  body: string;
  tags: string[];
}

export interface Story {
  id: number;
  createdAt: string;
  title: string;
  promptContext: string | null;
  body: string;
  sourceEntryIds: number[];
}

export interface Question {
  id: number;
  createdAt: string;
  text: string;
  companyTags: string[];
}

export interface Match {
  id: number;
  entryId: number;
  questionId: number;
  strength: Strength;
  reason: string;
}
```

- [ ] **Step 2: Write `src/lib/db.ts`**

```ts
import { neon } from "@neondatabase/serverless";
import type { Entry, Story, Question, Match, Strength } from "./types";

function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL not set");
  return neon(url);
}

export const db = {
  async listEntries(): Promise<Entry[]> {
    const rows = await sql()`
      SELECT id, occurred_on, created_at, body, tags
      FROM entries ORDER BY occurred_on DESC, id DESC`;
    return rows.map(mapEntry);
  },

  async createEntry(body: string, occurredOn: string | null, tags: string[]): Promise<Entry> {
    const rows = occurredOn
      ? await sql()`INSERT INTO entries (body, occurred_on, tags)
          VALUES (${body}, ${occurredOn}, ${tags}) RETURNING *`
      : await sql()`INSERT INTO entries (body, tags)
          VALUES (${body}, ${tags}) RETURNING *`;
    return mapEntry(rows[0]);
  },

  async updateEntry(id: number, body: string, occurredOn: string, tags: string[]): Promise<Entry> {
    const rows = await sql()`UPDATE entries
      SET body=${body}, occurred_on=${occurredOn}, tags=${tags}
      WHERE id=${id} RETURNING *`;
    return mapEntry(rows[0]);
  },

  async deleteEntry(id: number): Promise<void> {
    await sql()`DELETE FROM entries WHERE id=${id}`;
  },

  async listQuestions(): Promise<Question[]> {
    const rows = await sql()`
      SELECT id, created_at, text, company_tags
      FROM questions ORDER BY id DESC`;
    return rows.map(mapQuestion);
  },

  async createQuestion(text: string, companyTags: string[]): Promise<Question> {
    const rows = await sql()`INSERT INTO questions (text, company_tags)
      VALUES (${text}, ${companyTags}) RETURNING *`;
    return mapQuestion(rows[0]);
  },

  async updateQuestion(id: number, text: string, companyTags: string[]): Promise<Question> {
    const rows = await sql()`UPDATE questions
      SET text=${text}, company_tags=${companyTags}
      WHERE id=${id} RETURNING *`;
    return mapQuestion(rows[0]);
  },

  async deleteQuestion(id: number): Promise<void> {
    await sql()`DELETE FROM questions WHERE id=${id}`;
  },

  async listStories(): Promise<Story[]> {
    const rows = await sql()`
      SELECT id, created_at, title, prompt_context, body, source_entry_ids
      FROM stories ORDER BY id DESC`;
    return rows.map(mapStory);
  },

  async createStory(
    title: string, promptContext: string | null, body: string, sourceEntryIds: number[],
  ): Promise<Story> {
    const rows = await sql()`INSERT INTO stories (title, prompt_context, body, source_entry_ids)
      VALUES (${title}, ${promptContext}, ${body}, ${sourceEntryIds}) RETURNING *`;
    return mapStory(rows[0]);
  },

  async listMatches(): Promise<Match[]> {
    const rows = await sql()`SELECT id, entry_id, question_id, strength, reason FROM matches`;
    return rows.map(mapMatch);
  },

  async replaceMatchesForEntry(
    entryId: number, rows: { questionId: number; strength: Strength; reason: string }[],
  ): Promise<void> {
    await sql()`DELETE FROM matches WHERE entry_id=${entryId}`;
    for (const r of rows) {
      await sql()`INSERT INTO matches (entry_id, question_id, strength, reason)
        VALUES (${entryId}, ${r.questionId}, ${r.strength}, ${r.reason})`;
    }
  },

  async replaceMatchesForQuestion(
    questionId: number, rows: { entryId: number; strength: Strength; reason: string }[],
  ): Promise<void> {
    await sql()`DELETE FROM matches WHERE question_id=${questionId}`;
    for (const r of rows) {
      await sql()`INSERT INTO matches (entry_id, question_id, strength, reason)
        VALUES (${r.entryId}, ${questionId}, ${r.strength}, ${r.reason})`;
    }
  },
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function mapEntry(r: any): Entry {
  return { id: Number(r.id), occurredOn: String(r.occurred_on), createdAt: String(r.created_at), body: r.body, tags: r.tags ?? [] };
}
function mapStory(r: any): Story {
  return { id: Number(r.id), createdAt: String(r.created_at), title: r.title, promptContext: r.prompt_context ?? null, body: r.body, sourceEntryIds: (r.source_entry_ids ?? []).map(Number) };
}
function mapQuestion(r: any): Question {
  return { id: Number(r.id), createdAt: String(r.created_at), text: r.text, companyTags: r.company_tags ?? [] };
}
function mapMatch(r: any): Match {
  return { id: Number(r.id), entryId: Number(r.entry_id), questionId: Number(r.question_id), strength: r.strength, reason: r.reason };
}
```

- [ ] **Step 2b: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts src/lib/db.ts
git commit -m "feat: add domain types and data-access layer"
```

> Note: `db.ts` is a thin adapter exercised end-to-end at deploy time, not unit-tested (it only forwards to Postgres). All logic that *needs* testing lives in the pure modules below.

---

### Task 4: Auth — password gate, session cookie, middleware

**Files:**
- Create: `src/lib/auth.ts`, `middleware.ts`, `src/app/api/auth/route.ts`, `src/app/login/page.tsx`
- Test: `src/lib/__tests__/auth.test.ts`

**Interfaces:**
- Consumes: env `APP_PASSWORD`, `SESSION_SECRET`.
- Produces:
  - `verifyPassword(input:string): boolean`
  - `createSessionToken(): Promise<string>`
  - `verifySessionToken(token:string|undefined): Promise<boolean>`
  - `SESSION_COOKIE = "wt_session"` (constant)

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/auth.test.ts`:
```ts
import { beforeAll, expect, test } from "vitest";
import { verifyPassword, createSessionToken, verifySessionToken } from "@/lib/auth";

beforeAll(() => {
  process.env.APP_PASSWORD = "secret123";
  process.env.SESSION_SECRET = "test-secret-test-secret-test-secret-32";
});

test("verifyPassword accepts correct and rejects wrong", () => {
  expect(verifyPassword("secret123")).toBe(true);
  expect(verifyPassword("nope")).toBe(false);
});

test("session token round-trips", async () => {
  const token = await createSessionToken();
  expect(await verifySessionToken(token)).toBe(true);
});

test("invalid/missing token rejected", async () => {
  expect(await verifySessionToken(undefined)).toBe(false);
  expect(await verifySessionToken("garbage")).toBe(false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: FAIL (cannot find module `@/lib/auth`).

- [ ] **Step 3: Write `src/lib/auth.ts`**

```ts
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "wt_session";

function secret(): Uint8Array {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET not set");
  return new TextEncoder().encode(s);
}

export function verifyPassword(input: string): boolean {
  const pw = process.env.APP_PASSWORD;
  if (!pw) throw new Error("APP_PASSWORD not set");
  return input === pw;
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ ok: true })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
}

export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  try {
    await jwtVerify(token, secret());
    return true;
  } catch {
    return false;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/auth.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Write `middleware.ts`**

```ts
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/auth";

const PUBLIC = ["/login", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((p) => pathname.startsWith(p))) return NextResponse.next();

  const ok = await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
  if (ok) return NextResponse.next();

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const url = req.nextUrl.clone();
  url.pathname = "/login";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
```

- [ ] **Step 6: Write `src/app/api/auth/route.ts`**

```ts
import { NextResponse } from "next/server";
import { SESSION_COOKIE, verifyPassword, createSessionToken } from "@/lib/auth";

export async function POST(req: Request) {
  const { password } = await req.json();
  if (typeof password !== "string" || !verifyPassword(password)) {
    return NextResponse.json({ error: "invalid password" }, { status: 401 });
  }
  const token = await createSessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
  });
  return res;
}
```

- [ ] **Step 7: Write `src/app/login/page.tsx`**

```tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) router.push("/");
    else setError("Wrong password");
  }

  return (
    <form onSubmit={submit}>
      <h1>Work Tracker</h1>
      <input type="password" value={password} placeholder="Password"
        onChange={(e) => setPassword(e.target.value)} autoFocus />
      <button type="submit">Enter</button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}
```

- [ ] **Step 8: Commit**

```bash
git add src/lib/auth.ts src/lib/__tests__/auth.test.ts middleware.ts src/app/api/auth/route.ts src/app/login/page.tsx
git commit -m "feat: add password gate, session cookie, and auth middleware"
```

---

### Task 5: Claude prompt builders & response parsers (pure)

**Files:**
- Create: `src/lib/prompts.ts`
- Test: `src/lib/__tests__/prompts.test.ts`

**Interfaces:**
- Consumes: `Entry`, `Question` from `@/lib/types`.
- Produces:
  - `buildStoryPrompt(entries:Entry[], promptContext:string|null): string`
  - `buildMatchPrompt(target:{kind:'entry';entry:Entry;questions:Question[]} | {kind:'question';question:Question;entries:Entry[]}): string`
  - `parseMatchResponse(text:string): { id:number; strength:'strong'|'weak'; reason:string }[]` — `id` is the question id (entry-target) or entry id (question-target). Throws on malformed JSON.

- [ ] **Step 1: Write the failing test**

`src/lib/__tests__/prompts.test.ts`:
```ts
import { expect, test } from "vitest";
import { buildStoryPrompt, buildMatchPrompt, parseMatchResponse } from "@/lib/prompts";
import type { Entry, Question } from "@/lib/types";

const entry: Entry = { id: 1, occurredOn: "2026-06-01", createdAt: "", body: "Led the DB migration under a tight deadline", tags: ["project-x"] };
const question: Question = { id: 9, createdAt: "", text: "Tell me about a time you handled a tight deadline", companyTags: ["stripe"] };

test("story prompt includes entry bodies and the question context", () => {
  const p = buildStoryPrompt([entry], "conflict with a teammate");
  expect(p).toContain("Led the DB migration");
  expect(p).toContain("conflict with a teammate");
  expect(p.toUpperCase()).toContain("STAR");
});

test("match prompt (entry target) lists candidate questions with ids", () => {
  const p = buildMatchPrompt({ kind: "entry", entry, questions: [question] });
  expect(p).toContain("Led the DB migration");
  expect(p).toContain("9");
  expect(p).toContain("tight deadline");
});

test("parseMatchResponse reads a JSON array, ignoring surrounding prose", () => {
  const text = 'Sure!\n[{"id":9,"strength":"strong","reason":"direct deadline example"}]\nDone.';
  expect(parseMatchResponse(text)).toEqual([{ id: 9, strength: "strong", reason: "direct deadline example" }]);
});

test("parseMatchResponse returns [] for an empty array", () => {
  expect(parseMatchResponse("[]")).toEqual([]);
});

test("parseMatchResponse throws on malformed output", () => {
  expect(() => parseMatchResponse("no json here")).toThrow();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/prompts.test.ts`
Expected: FAIL (cannot find module `@/lib/prompts`).

- [ ] **Step 3: Write `src/lib/prompts.ts`**

```ts
import type { Entry, Question, Strength } from "./types";

export function buildStoryPrompt(entries: Entry[], promptContext: string | null): string {
  const notes = entries.map((e) => `- (${e.occurredOn}) ${e.body}`).join("\n");
  const context = promptContext
    ? `The interview question / angle to target:\n"${promptContext}"\n\n`
    : "";
  return `You are helping the user prepare a behavioral interview answer.
${context}Using ONLY the work notes below, write a single STAR-format story (Situation, Task, Action, Result).
Return Markdown with bold "**Situation**", "**Task**", "**Action**", "**Result**" headers. Be concrete and quantify impact where the notes support it. Do not invent facts beyond the notes.

Work notes:
${notes}`;
}

type MatchTarget =
  | { kind: "entry"; entry: Entry; questions: Question[] }
  | { kind: "question"; question: Question; entries: Entry[] };

export function buildMatchPrompt(target: MatchTarget): string {
  const instruction = `You judge whether a work note can answer behavioral interview questions.
For each candidate that the note could genuinely support, decide a match strength:
- "strong": the note is a direct, substantial example for the question.
- "weak": the note is tangentially related and would need stretching.
Omit candidates that do not match at all.
Respond with ONLY a JSON array (no prose) of objects: {"id": <candidate id>, "strength": "strong"|"weak", "reason": "<one short sentence>"}.
If nothing matches, respond with [].`;

  if (target.kind === "entry") {
    const candidates = target.questions
      .map((q) => `id ${q.id}: ${q.text}`).join("\n");
    return `${instruction}

Work note:
"${target.entry.body}"

Candidate questions:
${candidates}`;
  }
  const candidates = target.entries
    .map((e) => `id ${e.id}: ${e.body}`).join("\n");
  return `${instruction}

Behavioral question:
"${target.question.text}"

Candidate work notes:
${candidates}`;
}

export function parseMatchResponse(text: string): { id: number; strength: Strength; reason: string }[] {
  const start = text.indexOf("[");
  const end = text.lastIndexOf("]");
  if (start === -1 || end === -1 || end < start) {
    throw new Error("no JSON array found in match response");
  }
  const parsed = JSON.parse(text.slice(start, end + 1));
  if (!Array.isArray(parsed)) throw new Error("match response is not an array");
  return parsed.map((r: { id: unknown; strength: unknown; reason: unknown }) => {
    const id = Number(r.id);
    const strength = r.strength === "strong" ? "strong" : "weak";
    if (!Number.isFinite(id)) throw new Error("match item missing numeric id");
    return { id, strength, reason: String(r.reason ?? "") };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/prompts.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/prompts.ts src/lib/__tests__/prompts.test.ts
git commit -m "feat: add Claude prompt builders and match-response parser"
```

---

### Task 6: Claude adapter

**Files:**
- Create: `src/lib/claude.ts`

**Interfaces:**
- Consumes: `buildStoryPrompt`, `buildMatchPrompt`, `parseMatchResponse` from `@/lib/prompts`; env `ANTHROPIC_API_KEY`.
- Produces:
  - `generateStory(entries:Entry[], promptContext:string|null): Promise<string>` (returns markdown)
  - `matchEntry(entry:Entry, questions:Question[]): Promise<{questionId:number;strength:Strength;reason:string}[]>`
  - `matchQuestion(question:Question, entries:Entry[]): Promise<{entryId:number;strength:Strength;reason:string}[]>`

- [ ] **Step 1: Write `src/lib/claude.ts`**

```ts
import Anthropic from "@anthropic-ai/sdk";
import type { Entry, Question, Strength } from "./types";
import { buildStoryPrompt, buildMatchPrompt, parseMatchResponse } from "./prompts";

const MODEL = "claude-sonnet-4-6";

function client() {
  return new Anthropic(); // reads ANTHROPIC_API_KEY from env
}

export async function generateStory(entries: Entry[], promptContext: string | null): Promise<string> {
  const stream = client().messages.stream({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: buildStoryPrompt(entries, promptContext) }],
  });
  const msg = await stream.finalMessage();
  return msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
}

async function runMatch(prompt: string): Promise<{ id: number; strength: Strength; reason: string }[]> {
  const msg = await client().messages.create({
    model: MODEL,
    max_tokens: 4096,
    messages: [{ role: "user", content: prompt }],
  });
  const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
  return parseMatchResponse(text);
}

export async function matchEntry(entry: Entry, questions: Question[]) {
  if (questions.length === 0) return [];
  const rows = await runMatch(buildMatchPrompt({ kind: "entry", entry, questions }));
  return rows.map((r) => ({ questionId: r.id, strength: r.strength, reason: r.reason }));
}

export async function matchQuestion(question: Question, entries: Entry[]) {
  if (entries.length === 0) return [];
  const rows = await runMatch(buildMatchPrompt({ kind: "question", question, entries }));
  return rows.map((r) => ({ entryId: r.id, strength: r.strength, reason: r.reason }));
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add Claude adapter for story generation and matching"
```

> Note: this adapter is mocked in route tests (Tasks 7–8); its only logic is delegated to the pure functions already tested in Task 5.

---

### Task 7: Entries API + Stories API (with Claude mocked)

**Files:**
- Create: `src/app/api/entries/route.ts`, `src/app/api/entries/[id]/route.ts`, `src/app/api/stories/route.ts`, `src/app/api/stories/generate/route.ts`
- Test: `src/lib/__tests__/entries-api.test.ts`, `src/lib/__tests__/stories-api.test.ts`

**Interfaces:**
- Consumes: `db` (Task 3), `generateStory`/`matchEntry` (Task 6).
- Produces HTTP routes:
  - `GET /api/entries` → `Entry[]`; `POST /api/entries` `{body, occurredOn?, tags?}` → creates entry, runs `matchEntry`, stores via `replaceMatchesForEntry`, returns `{entry, matchedCount}`.
  - `PUT /api/entries/:id` `{body, occurredOn, tags}` → updates + re-matches → `{entry, matchedCount}`; `DELETE /api/entries/:id` → `{ok:true}`.
  - `GET /api/stories` → `Story[]`; `POST /api/stories` `{title, promptContext, body, sourceEntryIds}` → `Story`.
  - `POST /api/stories/generate` `{entryIds, promptContext?}` → `{body}` (markdown; not yet saved).

- [ ] **Step 1: Write the failing entries-API test**

`src/lib/__tests__/entries-api.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    listQuestions: vi.fn(),
    createEntry: vi.fn(),
    replaceMatchesForEntry: vi.fn(),
  },
}));
vi.mock("@/lib/claude", () => ({ matchEntry: vi.fn() }));

import { db } from "@/lib/db";
import { matchEntry } from "@/lib/claude";
import { POST } from "@/app/api/entries/route";

afterEach(() => vi.clearAllMocks());

test("POST creates an entry, runs matching, and reports matched count", async () => {
  (db.listQuestions as any).mockResolvedValue([{ id: 9, text: "deadline?", companyTags: [], createdAt: "" }]);
  (db.createEntry as any).mockResolvedValue({ id: 1, body: "shipped", occurredOn: "2026-06-01", createdAt: "", tags: [] });
  (matchEntry as any).mockResolvedValue([{ questionId: 9, strength: "strong", reason: "x" }]);
  (db.replaceMatchesForEntry as any).mockResolvedValue(undefined);

  const req = new Request("http://t/api/entries", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "shipped", tags: [] }),
  });
  const res = await POST(req);
  const json = await res.json();

  expect(res.status).toBe(200);
  expect(json.matchedCount).toBe(1);
  expect(db.replaceMatchesForEntry).toHaveBeenCalledWith(1, [{ questionId: 9, strength: "strong", reason: "x" }]);
});

test("POST rejects an empty body", async () => {
  const req = new Request("http://t/api/entries", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "  " }),
  });
  const res = await POST(req);
  expect(res.status).toBe(400);
});

test("POST still returns the entry if matching fails", async () => {
  (db.listQuestions as any).mockResolvedValue([{ id: 9, text: "q", companyTags: [], createdAt: "" }]);
  (db.createEntry as any).mockResolvedValue({ id: 2, body: "x", occurredOn: "2026-06-01", createdAt: "", tags: [] });
  (matchEntry as any).mockRejectedValue(new Error("claude down"));

  const req = new Request("http://t/api/entries", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ body: "x" }),
  });
  const res = await POST(req);
  const json = await res.json();
  expect(res.status).toBe(200);
  expect(json.entry.id).toBe(2);
  expect(json.matchedCount).toBe(null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/entries-api.test.ts`
Expected: FAIL (cannot find module `@/app/api/entries/route`).

- [ ] **Step 3: Write `src/app/api/entries/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchEntry } from "@/lib/claude";

export async function GET() {
  return NextResponse.json(await db.listEntries());
}

export async function POST(req: Request) {
  const { body, occurredOn, tags } = await req.json();
  if (typeof body !== "string" || body.trim() === "") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const entry = await db.createEntry(body.trim(), occurredOn ?? null, Array.isArray(tags) ? tags : []);

  let matchedCount: number | null = null;
  try {
    const questions = await db.listQuestions();
    const rows = await matchEntry(entry, questions);
    await db.replaceMatchesForEntry(entry.id, rows);
    matchedCount = rows.length;
  } catch {
    matchedCount = null; // matching failed; entry is still saved
  }
  return NextResponse.json({ entry, matchedCount });
}
```

- [ ] **Step 4: Write `src/app/api/entries/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchEntry } from "@/lib/claude";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const entryId = Number(id);
  const { body, occurredOn, tags } = await req.json();
  if (typeof body !== "string" || body.trim() === "") {
    return NextResponse.json({ error: "body is required" }, { status: 400 });
  }
  const entry = await db.updateEntry(entryId, body.trim(), occurredOn, Array.isArray(tags) ? tags : []);
  let matchedCount: number | null = null;
  try {
    const rows = await matchEntry(entry, await db.listQuestions());
    await db.replaceMatchesForEntry(entry.id, rows);
    matchedCount = rows.length;
  } catch {
    matchedCount = null;
  }
  return NextResponse.json({ entry, matchedCount });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.deleteEntry(Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 5: Run entries test to verify it passes**

Run: `npx vitest run src/lib/__tests__/entries-api.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Write the failing stories-API test**

`src/lib/__tests__/stories-api.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { listEntries: vi.fn(), createStory: vi.fn() },
}));
vi.mock("@/lib/claude", () => ({ generateStory: vi.fn() }));

import { db } from "@/lib/db";
import { generateStory } from "@/lib/claude";
import { POST as GENERATE } from "@/app/api/stories/generate/route";
import { POST as SAVE } from "@/app/api/stories/route";

afterEach(() => vi.clearAllMocks());

test("generate requires at least one entry id", async () => {
  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ entryIds: [] }) });
  const res = await GENERATE(req);
  expect(res.status).toBe(400);
});

test("generate passes selected entries to Claude and returns markdown", async () => {
  (db.listEntries as any).mockResolvedValue([
    { id: 1, body: "a", occurredOn: "", createdAt: "", tags: [] },
    { id: 2, body: "b", occurredOn: "", createdAt: "", tags: [] },
  ]);
  (generateStory as any).mockResolvedValue("**Situation** ...");
  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ entryIds: [2], promptContext: "deadline" }) });
  const res = await GENERATE(req);
  const json = await res.json();
  expect(json.body).toContain("Situation");
  expect((generateStory as any).mock.calls[0][0]).toEqual([{ id: 2, body: "b", occurredOn: "", createdAt: "", tags: [] }]);
  expect((generateStory as any).mock.calls[0][1]).toBe("deadline");
});

test("save persists the story with its source entry ids", async () => {
  (db.createStory as any).mockResolvedValue({ id: 5, title: "T", promptContext: null, body: "B", sourceEntryIds: [2], createdAt: "" });
  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ title: "T", promptContext: null, body: "B", sourceEntryIds: [2] }) });
  const res = await SAVE(req);
  const json = await res.json();
  expect(json.id).toBe(5);
  expect(db.createStory).toHaveBeenCalledWith("T", null, "B", [2]);
});
```

- [ ] **Step 7: Run stories test to verify it fails**

Run: `npx vitest run src/lib/__tests__/stories-api.test.ts`
Expected: FAIL (cannot find route modules).

- [ ] **Step 8: Write `src/app/api/stories/generate/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { generateStory } from "@/lib/claude";

export async function POST(req: Request) {
  const { entryIds, promptContext } = await req.json();
  if (!Array.isArray(entryIds) || entryIds.length === 0) {
    return NextResponse.json({ error: "select at least one entry" }, { status: 400 });
  }
  const ids = entryIds.map(Number);
  const entries = (await db.listEntries()).filter((e) => ids.includes(e.id));
  try {
    const body = await generateStory(entries, promptContext ?? null);
    return NextResponse.json({ body });
  } catch {
    return NextResponse.json({ error: "generation failed, try again" }, { status: 502 });
  }
}
```

- [ ] **Step 9: Write `src/app/api/stories/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET() {
  return NextResponse.json(await db.listStories());
}

export async function POST(req: Request) {
  const { title, promptContext, body, sourceEntryIds } = await req.json();
  if (typeof title !== "string" || typeof body !== "string") {
    return NextResponse.json({ error: "title and body required" }, { status: 400 });
  }
  const story = await db.createStory(
    title, promptContext ?? null, body,
    Array.isArray(sourceEntryIds) ? sourceEntryIds.map(Number) : [],
  );
  return NextResponse.json(story);
}
```

- [ ] **Step 10: Run stories test to verify it passes**

Run: `npx vitest run src/lib/__tests__/stories-api.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 11: Commit**

```bash
git add src/app/api/entries src/app/api/stories src/lib/__tests__/entries-api.test.ts src/lib/__tests__/stories-api.test.ts
git commit -m "feat: add entries and stories API routes with matching on save"
```

---

### Task 8: Questions API + coverage aggregation

**Files:**
- Create: `src/lib/coverage.ts`, `src/app/api/questions/route.ts`, `src/app/api/questions/[id]/route.ts`, `src/app/api/coverage/route.ts`
- Test: `src/lib/__tests__/coverage.test.ts`, `src/lib/__tests__/questions-api.test.ts`

**Interfaces:**
- Consumes: `db`, `matchQuestion`, `Match`, `Question`.
- Produces:
  - Pure: `computeCoverage(questions:Question[], matches:Match[], companyTag?:string): CoverageRow[]` where `CoverageRow = { question:Question; total:number; strong:number; weak:number; best:'strong'|'weak'|'none' }`.
  - Routes: `GET/POST /api/questions`, `PUT/DELETE /api/questions/:id` (POST/PUT run `matchQuestion` + `replaceMatchesForQuestion`, return `{question, matchedCount}`), `GET /api/coverage?company=<tag>` → `CoverageRow[]`.

- [ ] **Step 1: Write the failing coverage test**

`src/lib/__tests__/coverage.test.ts`:
```ts
import { expect, test } from "vitest";
import { computeCoverage } from "@/lib/coverage";
import type { Question, Match } from "@/lib/types";

const q1: Question = { id: 1, text: "deadline", companyTags: ["stripe"], createdAt: "" };
const q2: Question = { id: 2, text: "conflict", companyTags: ["google"], createdAt: "" };
const matches: Match[] = [
  { id: 1, entryId: 10, questionId: 1, strength: "strong", reason: "" },
  { id: 2, entryId: 11, questionId: 1, strength: "weak", reason: "" },
];

test("aggregates counts and best strength per question", () => {
  const rows = computeCoverage([q1, q2], matches);
  const r1 = rows.find((r) => r.question.id === 1)!;
  expect(r1).toMatchObject({ total: 2, strong: 1, weak: 1, best: "strong" });
  const r2 = rows.find((r) => r.question.id === 2)!;
  expect(r2).toMatchObject({ total: 0, strong: 0, weak: 0, best: "none" });
});

test("company tag filter narrows the question set", () => {
  const rows = computeCoverage([q1, q2], matches, "google");
  expect(rows.map((r) => r.question.id)).toEqual([2]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/coverage.test.ts`
Expected: FAIL (cannot find module `@/lib/coverage`).

- [ ] **Step 3: Write `src/lib/coverage.ts`**

```ts
import type { Question, Match, Strength } from "./types";

export interface CoverageRow {
  question: Question;
  total: number;
  strong: number;
  weak: number;
  best: Strength | "none";
}

export function computeCoverage(questions: Question[], matches: Match[], companyTag?: string): CoverageRow[] {
  const selected = companyTag
    ? questions.filter((q) => q.companyTags.includes(companyTag))
    : questions;
  return selected.map((question) => {
    const m = matches.filter((x) => x.questionId === question.id);
    const strong = m.filter((x) => x.strength === "strong").length;
    const weak = m.filter((x) => x.strength === "weak").length;
    const best: Strength | "none" = strong > 0 ? "strong" : weak > 0 ? "weak" : "none";
    return { question, total: m.length, strong, weak, best };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/coverage.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Write the failing questions-API test**

`src/lib/__tests__/questions-api.test.ts`:
```ts
import { afterEach, expect, test, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: { listEntries: vi.fn(), createQuestion: vi.fn(), replaceMatchesForQuestion: vi.fn() },
}));
vi.mock("@/lib/claude", () => ({ matchQuestion: vi.fn() }));

import { db } from "@/lib/db";
import { matchQuestion } from "@/lib/claude";
import { POST } from "@/app/api/questions/route";

afterEach(() => vi.clearAllMocks());

test("POST creates a question, runs matching, reports count", async () => {
  (db.listEntries as any).mockResolvedValue([{ id: 10, body: "x", occurredOn: "", createdAt: "", tags: [] }]);
  (db.createQuestion as any).mockResolvedValue({ id: 1, text: "deadline?", companyTags: ["stripe"], createdAt: "" });
  (matchQuestion as any).mockResolvedValue([{ entryId: 10, strength: "weak", reason: "r" }]);

  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ text: "deadline?", companyTags: ["stripe"] }) });
  const res = await POST(req);
  const json = await res.json();
  expect(json.matchedCount).toBe(1);
  expect(db.replaceMatchesForQuestion).toHaveBeenCalledWith(1, [{ entryId: 10, strength: "weak", reason: "r" }]);
});

test("POST rejects empty text", async () => {
  const req = new Request("http://t", { method: "POST", body: JSON.stringify({ text: " " }) });
  const res = await POST(req);
  expect(res.status).toBe(400);
});
```

- [ ] **Step 6: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/questions-api.test.ts`
Expected: FAIL (cannot find route module).

- [ ] **Step 7: Write `src/app/api/questions/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchQuestion } from "@/lib/claude";

export async function GET() {
  return NextResponse.json(await db.listQuestions());
}

export async function POST(req: Request) {
  const { text, companyTags } = await req.json();
  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const question = await db.createQuestion(text.trim(), Array.isArray(companyTags) ? companyTags : []);
  let matchedCount: number | null = null;
  try {
    const rows = await matchQuestion(question, await db.listEntries());
    await db.replaceMatchesForQuestion(question.id, rows);
    matchedCount = rows.length;
  } catch {
    matchedCount = null;
  }
  return NextResponse.json({ question, matchedCount });
}
```

- [ ] **Step 8: Write `src/app/api/questions/[id]/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { matchQuestion } from "@/lib/claude";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { text, companyTags } = await req.json();
  if (typeof text !== "string" || text.trim() === "") {
    return NextResponse.json({ error: "text is required" }, { status: 400 });
  }
  const question = await db.updateQuestion(Number(id), text.trim(), Array.isArray(companyTags) ? companyTags : []);
  let matchedCount: number | null = null;
  try {
    const rows = await matchQuestion(question, await db.listEntries());
    await db.replaceMatchesForQuestion(question.id, rows);
    matchedCount = rows.length;
  } catch {
    matchedCount = null;
  }
  return NextResponse.json({ question, matchedCount });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await db.deleteQuestion(Number(id));
  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 9: Write `src/app/api/coverage/route.ts`**

```ts
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { computeCoverage } from "@/lib/coverage";

export async function GET(req: Request) {
  const company = new URL(req.url).searchParams.get("company") ?? undefined;
  const [questions, matches] = await Promise.all([db.listQuestions(), db.listMatches()]);
  return NextResponse.json(computeCoverage(questions, matches, company));
}
```

- [ ] **Step 10: Run questions test to verify it passes**

Run: `npx vitest run src/lib/__tests__/questions-api.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 11: Commit**

```bash
git add src/lib/coverage.ts src/app/api/questions src/app/api/coverage src/lib/__tests__/coverage.test.ts src/lib/__tests__/questions-api.test.ts
git commit -m "feat: add questions API and coverage aggregation"
```

---

### Task 9: UI pages — capture, stories, questions, coverage

**Files:**
- Create: `src/app/page.tsx`, `src/app/_components/Nav.tsx`, `src/app/stories/page.tsx`, `src/app/stories/new/page.tsx`, `src/app/questions/page.tsx`, `src/app/coverage/page.tsx`

**Interfaces:**
- Consumes: the API routes from Tasks 7–8 via `fetch`. No new exports.

- [ ] **Step 1: Write `src/app/_components/Nav.tsx`**

```tsx
import Link from "next/link";

export default function Nav() {
  return (
    <nav style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
      <Link href="/">Capture</Link>
      <Link href="/stories">Stories</Link>
      <Link href="/questions">Questions</Link>
      <Link href="/coverage">Coverage</Link>
    </nav>
  );
}
```

- [ ] **Step 2: Write `src/app/page.tsx` (capture + entry list)**

```tsx
"use client";
import { useEffect, useState } from "react";
import Nav from "./_components/Nav";

interface Entry { id: number; occurredOn: string; body: string; tags: string[]; }

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [body, setBody] = useState("");
  const [tags, setTags] = useState("");
  const [note, setNote] = useState("");

  async function load() {
    const res = await fetch("/api/entries");
    setEntries(await res.json());
  }
  useEffect(() => { load(); }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (body.trim() === "") return;
    const res = await fetch("/api/entries", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body, tags: tags.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    const json = await res.json();
    setNote(json.matchedCount === null ? "Saved (matching unavailable)" : `Saved — matched ${json.matchedCount} question(s)`);
    setBody(""); setTags("");
    load();
  }

  async function remove(id: number) {
    await fetch(`/api/entries/${id}`, { method: "DELETE" });
    load();
  }

  return (
    <>
      <Nav />
      <form onSubmit={save}>
        <textarea autoFocus value={body} placeholder="What did you do?" rows={3}
          style={{ width: "100%" }} onChange={(e) => setBody(e.target.value)} />
        <input value={tags} placeholder="tags, comma separated"
          style={{ width: "100%", marginTop: "0.5rem" }} onChange={(e) => setTags(e.target.value)} />
        <button type="submit" style={{ marginTop: "0.5rem" }}>Save</button>
        {note && <span style={{ marginLeft: "1rem" }}>{note}</span>}
      </form>
      <ul>
        {entries.map((e) => (
          <li key={e.id}>
            <small>{e.occurredOn}</small> — {e.body}
            {e.tags.length > 0 && <em> [{e.tags.join(", ")}]</em>}
            <button style={{ marginLeft: "0.5rem" }} onClick={() => remove(e.id)}>×</button>
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 3: Write `src/app/stories/page.tsx` (list) and `src/app/stories/new/page.tsx` (generate + save)**

`src/app/stories/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Nav from "../_components/Nav";

interface Story { id: number; title: string; body: string; }

export default function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  useEffect(() => { fetch("/api/stories").then((r) => r.json()).then(setStories); }, []);
  return (
    <>
      <Nav />
      <Link href="/stories/new">+ New story</Link>
      {stories.map((s) => (
        <article key={s.id}>
          <h3>{s.title}</h3>
          <pre style={{ whiteSpace: "pre-wrap" }}>{s.body}</pre>
        </article>
      ))}
    </>
  );
}
```

`src/app/stories/new/page.tsx`:
```tsx
"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Nav from "../../_components/Nav";

interface Entry { id: number; occurredOn: string; body: string; }

export default function NewStory() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [context, setContext] = useState("");
  const [draft, setDraft] = useState("");
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  useEffect(() => { fetch("/api/entries").then((r) => r.json()).then(setEntries); }, []);

  function toggle(id: number) {
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  async function generate() {
    setBusy(true); setError("");
    const res = await fetch("/api/stories/generate", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entryIds: selected, promptContext: context || null }),
    });
    setBusy(false);
    if (res.ok) setDraft((await res.json()).body);
    else setError("Couldn't generate — try again");
  }

  async function save() {
    await fetch("/api/stories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, promptContext: context || null, body: draft, sourceEntryIds: selected }),
    });
    router.push("/stories");
  }

  return (
    <>
      <Nav />
      <p>Select entries:</p>
      <ul>
        {entries.map((e) => (
          <li key={e.id}>
            <label><input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} /> {e.body}</label>
          </li>
        ))}
      </ul>
      <input value={context} placeholder="interview question / angle (optional)"
        style={{ width: "100%" }} onChange={(e) => setContext(e.target.value)} />
      <button onClick={generate} disabled={selected.length === 0 || busy} style={{ marginTop: "0.5rem" }}>
        {busy ? "Generating…" : "Generate"}
      </button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
      {draft && (
        <>
          <pre style={{ whiteSpace: "pre-wrap" }}>{draft}</pre>
          <input value={title} placeholder="story title" onChange={(e) => setTitle(e.target.value)} />
          <button onClick={save} disabled={title.trim() === ""}>Save story</button>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 4: Write `src/app/questions/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import Nav from "../_components/Nav";

interface Question { id: number; text: string; companyTags: string[]; }

export default function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [companies, setCompanies] = useState("");
  const [note, setNote] = useState("");

  async function load() { setQuestions(await (await fetch("/api/questions")).json()); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() === "") return;
    const res = await fetch("/api/questions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, companyTags: companies.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    const json = await res.json();
    setNote(json.matchedCount === null ? "Added (matching unavailable)" : `Added — matched ${json.matchedCount} entry(ies)`);
    setText(""); setCompanies(""); load();
  }

  async function remove(id: number) {
    await fetch(`/api/questions/${id}`, { method: "DELETE" }); load();
  }

  return (
    <>
      <Nav />
      <form onSubmit={add}>
        <input value={text} placeholder="Behavioral question" style={{ width: "100%" }} onChange={(e) => setText(e.target.value)} />
        <input value={companies} placeholder="company tags, comma separated" style={{ width: "100%", marginTop: "0.5rem" }} onChange={(e) => setCompanies(e.target.value)} />
        <button type="submit" style={{ marginTop: "0.5rem" }}>Add</button>
        {note && <span style={{ marginLeft: "1rem" }}>{note}</span>}
      </form>
      <ul>
        {questions.map((q) => (
          <li key={q.id}>{q.text} {q.companyTags.length > 0 && <em>[{q.companyTags.join(", ")}]</em>}
            <button style={{ marginLeft: "0.5rem" }} onClick={() => remove(q.id)}>×</button>
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 5: Write `src/app/coverage/page.tsx`**

```tsx
"use client";
import { useEffect, useState } from "react";
import Nav from "../_components/Nav";

interface Row {
  question: { id: number; text: string; companyTags: string[] };
  total: number; strong: number; weak: number; best: "strong" | "weak" | "none";
}

function badge(r: Row): string {
  if (r.best === "none") return "❌ no match — gap";
  if (r.best === "strong") return `✅ ${r.total} match(es) (${r.strong} strong)`;
  return `⚠️ ${r.total} weak match(es)`;
}

export default function Coverage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [company, setCompany] = useState("");

  async function load() {
    const url = company ? `/api/coverage?company=${encodeURIComponent(company)}` : "/api/coverage";
    setRows(await (await fetch(url)).json());
  }
  useEffect(() => { load(); }, [company]);

  return (
    <>
      <Nav />
      <input value={company} placeholder="filter by company tag" onChange={(e) => setCompany(e.target.value)} />
      <ul>
        {rows.map((r) => (
          <li key={r.question.id}>
            <strong>{badge(r)}</strong> — {r.question.text}
          </li>
        ))}
      </ul>
    </>
  );
}
```

- [ ] **Step 6: Build to verify everything compiles**

Run: `npm run build`
Expected: build succeeds with no type errors.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`
Expected: all tests PASS.

- [ ] **Step 8: Commit**

```bash
git add src/app
git commit -m "feat: add capture, stories, questions, and coverage UI"
```

---

### Task 10: Deployment notes

**Files:**
- Create: `README.md`

- [ ] **Step 1: Write `README.md`**

```md
# Work Tracker

Personal app to capture work notes, generate STAR interview stories, and track behavioral-question coverage.

## Setup
1. Create a Neon Postgres database; copy its connection string.
2. Copy `.env.example` to `.env` and fill in:
   - `DATABASE_URL` (Neon)
   - `ANTHROPIC_API_KEY`
   - `APP_PASSWORD` (your login password)
   - `SESSION_SECRET` (32+ random bytes, e.g. `openssl rand -base64 32`)
3. `npm install`
4. `npm run db:migrate` (applies `db/schema.sql`)
5. `npm run dev`

## Deploy (Vercel)
- Import the repo in Vercel.
- Set the four env vars above in Project Settings → Environment Variables.
- Run the migration once against the production `DATABASE_URL` (`npm run db:migrate`).
- Deploy.

## Test
`npm test`
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add setup and deployment instructions"
```

---

## Spec coverage check

- Frictionless capture → Task 9 Step 2 (auto-focused textarea, body-only required); Task 7 (entries API).
- AI STAR story generation (streamed, markdown blob) → Tasks 5, 6, 7, 9.
- Single-password auth + session cookie + 401 on API → Task 4.
- Questions with company tags → Task 8, Task 9 Step 4.
- AI semantic matching, one call per add/edit, strong/weak + reason, rows only on match → Tasks 5, 6, 7, 8.
- Edit re-matches; delete cascades → Task 3 (`replaceMatchesFor*`, `ON DELETE CASCADE`), Tasks 7–8 PUT/DELETE.
- Coverage page with counts, best strength, gap highlight, company filter → Task 8 (`computeCoverage`, `/api/coverage`), Task 9 Step 5.
- Error handling: generation/matching failure preserves data, entry still saved, retryable → Task 7 (try/catch, `matchedCount: null`), Task 9 (error states).
- Model `claude-sonnet-4-6`, streaming for stories, no banned params → Task 6 (Global Constraints).
- Tables entries/stories/questions/matches → Task 2.
- Testing strategy (CRUD via mocked db, auth gate, mocked Claude, coverage query, prompt assembly) → Tasks 4, 5, 7, 8.
