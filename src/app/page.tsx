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
