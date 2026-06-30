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
