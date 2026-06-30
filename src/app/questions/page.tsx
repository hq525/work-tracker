"use client";
import { useEffect, useState } from "react";
import Nav from "../_components/Nav";

interface Question { id: number; text: string; companyTags: string[]; }

export default function Questions() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [text, setText] = useState("");
  const [companies, setCompanies] = useState("");
  const [note, setNote] = useState("");

  async function load() { setQuestions(await (await fetch("/api/questions")).json()); }
  useEffect(() => { load(); }, []);

  async function add(e: React.FormEvent) {
    e.preventDefault();
    if (text.trim() === "") return;
    const res = await fetch("/api/questions", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, companyTags: companies.split(",").map((t) => t.trim()).filter(Boolean) }),
    });
    const json = await res.json();
    setNote(json.matchedCount === null ? "Added (matching unavailable)" : `Added — matched ${json.matchedCount} entry(ies)`);
    setText(""); setCompanies(""); load();
  }

  async function remove(id: number) {
    await fetch(`/api/questions/${id}`, { method: "DELETE" }); load();
  }

  return (
    <>
      <Nav />
      <form onSubmit={add}>
        <input value={text} placeholder="Behavioral question" style={{ width: "100%" }} onChange={(e) => setText(e.target.value)} />
        <input value={companies} placeholder="company tags, comma separated" style={{ width: "100%", marginTop: "0.5rem" }} onChange={(e) => setCompanies(e.target.value)} />
        <button type="submit" style={{ marginTop: "0.5rem" }}>Add</button>
        {note && <span style={{ marginLeft: "1rem" }}>{note}</span>}
      </form>
      <ul>
        {questions.map((q) => (
          <li key={q.id}>{q.text} {q.companyTags.length > 0 && <em>[{q.companyTags.join(", ")}]</em>}
            <button style={{ marginLeft: "0.5rem" }} onClick={() => remove(q.id)}>×</button>
          </li>
        ))}
      </ul>
    </>
  );
}
