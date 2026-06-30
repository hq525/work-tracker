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
