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

  async updateEntry(id: number, body: string, occurredOn: string | null, tags: string[]): Promise<Entry> {
    const rows = await sql()`UPDATE entries
      SET body=${body}, occurred_on=COALESCE(${occurredOn}, occurred_on), tags=${tags}
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
