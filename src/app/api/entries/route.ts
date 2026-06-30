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
