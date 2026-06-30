"use client";
import { useEffect, useState } from "react";
import Nav from "../_components/Nav";

interface Question { id: number; text: string; companyTags: string[]; }

export default function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [text, setText] = useState("");
  const [companies, setCompanies] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setQuestions(await (await fetch("/api/questions")).json());
    setLoaded(true);
  }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() === "") return;
    setSaving(true);
    const res = await fetch("/api/questions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, companyTags: companies.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    const json = await res.json();
    setSaving(false);
    setNote(json.matchedCount === null ? "Added — matching unavailable" : `Added — matched ${json.matchedCount} entry(ies)`);
    setText(""); setCompanies(""); load();
  }

  async function remove(id: number) {
    if (!confirm("Delete this question?")) return;
    await fetch(`/api/questions/${id}`, { method: "DELETE" }); load();
  }

  return (
    <>
      <Nav />
      <main id="main" className="container">
        <div className="page-head">
          <h1>Questions</h1>
          <p>Behavioral questions you want to be ready for. We match your entries against them.</p>
        </div>

        <form className="card card-pad stack" onSubmit={add} style={{ marginBottom: "var(--space-6)" }}>
          <div className="field">
            <label className="label" htmlFor="q-text">Behavioral question</label>
            <input
              id="q-text"
              className="input"
              value={text}
              placeholder="Tell me about a time you led a project under pressure."
              onChange={(e) => setText(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="label" htmlFor="q-companies">Company tags</label>
            <input
              id="q-companies"
              className="input"
              value={companies}
              placeholder="Stripe, Amazon"
              onChange={(e) => setCompanies(e.target.value)}
            />
            <span className="helper">Comma-separated. Optional.</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
            <button type="submit" className="btn btn-primary" disabled={saving || text.trim() === ""}>
              {saving ? "Adding…" : "Add question"}
            </button>
            {note && (
              <span className="note" role="status" aria-live="polite">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="16" height="16" aria-hidden="true">
                  <path d="M20 6 9 17l-5-5" />
                </svg>
                {note}
              </span>
            )}
          </div>
        </form>

        {!loaded ? null : questions.length === 0 ? (
          <div className="empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3" />
              <path d="M12 17h.01" />
            </svg>
            <h3>No questions yet</h3>
            <p>Add the behavioral questions you want to prepare for.</p>
          </div>
        ) : (
          <ul className="list">
            {questions.map((q) => (
              <li key={q.id} className="item">
                <div className="item-body">
                  <p className="text">{q.text}</p>
                  {q.companyTags.length > 0 && (
                    <div className="tag-row" style={{ marginTop: "var(--space-2)" }}>
                      {q.companyTags.map((t) => <span key={t} className="tag">{t}</span>)}
                    </div>
                  )}
                </div>
                <button className="icon-btn" onClick={() => remove(q.id)} aria-label="Delete question">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m2 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
