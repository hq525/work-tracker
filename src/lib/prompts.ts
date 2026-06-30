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
