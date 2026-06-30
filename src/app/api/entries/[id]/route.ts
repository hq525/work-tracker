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
  const entry = await db.updateEntry(entryId, body.trim(), occurredOn ?? null, Array.isArray(tags) ? tags : []);
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
