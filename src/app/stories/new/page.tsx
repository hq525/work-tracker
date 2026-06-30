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
