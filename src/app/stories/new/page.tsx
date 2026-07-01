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
  const [saving, setSaving] = useState(false);
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
    else setError("Couldn't generate a story. Please try again.");
  }

  async function save() {
    setSaving(true);
    await fetch("/api/stories", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, promptContext: context || null, body: draft, sourceEntryIds: selected }),
    });
    router.push("/stories");
  }

  return (
    <>
      <Nav />
      <main id="main" className="container">
        <div className="page-head">
          <h1>New story</h1>
          <p>Choose the entries that belong together, then let AI shape them into a STAR-style story.</p>
        </div>

        <div className="stack" style={{ gap: "var(--space-6)" }}>
          <section className="field">
            <span className="label">
              1 · Select entries{selected.length > 0 && <span className="tag" style={{ marginLeft: "var(--space-2)" }}>{selected.length} selected</span>}
            </span>
            {entries.length === 0 ? (
              <div className="empty">
                <h3>No entries to use</h3>
                <p>Capture a few accomplishments first.</p>
              </div>
            ) : (
              <div className="stack" style={{ gap: "var(--space-2)" }}>
                {entries.map((e) => (
                  <label key={e.id} className="check-row">
                    <input type="checkbox" checked={selected.includes(e.id)} onChange={() => toggle(e.id)} />
                    <span>{e.body}</span>
                  </label>
                ))}
              </div>
            )}
          </section>

          <section className="field">
            <label className="label" htmlFor="story-context">2 · Angle <span className="helper" style={{ fontWeight: 400 }}>(optional)</span></label>
            <input
              id="story-context"
              className="input"
              value={context}
              placeholder="e.g. a time you handled conflict on a team"
              onChange={(e) => setContext(e.target.value)}
            />
            <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)", marginTop: "var(--space-2)" }}>
              <button className="btn btn-primary" onClick={generate} disabled={selected.length === 0 || busy}>
                {busy ? "Generating…" : draft ? "Regenerate" : "Generate story"}
              </button>
              {error && (
                <span className="error-text" role="alert">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" /><path d="M12 8v4M12 16h.01" />
                  </svg>
                  {error}
                </span>
              )}
            </div>
          </section>

          {draft && (
            <section className="field">
              <span className="label">3 · Review &amp; save</span>
              <article className="card card-pad">
                <p className="prose">{draft}</p>
              </article>
              <label className="label" htmlFor="story-title" style={{ marginTop: "var(--space-3)" }}>Title<span className="req">*</span></label>
              <input
                id="story-title"
                className="input"
                value={title}
                placeholder="Led the payments migration under deadline"
                onChange={(e) => setTitle(e.target.value)}
              />
              <button className="btn btn-primary" onClick={save} disabled={title.trim() === "" || saving} style={{ marginTop: "var(--space-3)", alignSelf: "flex-start" }}>
                {saving ? "Saving…" : "Save story"}
              </button>
            </section>
          )}
        </div>
      </main>
    </>
  );
}
