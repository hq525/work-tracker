"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    if (res.ok) router.push("/");
    else setError("Wrong password");
  }

  return (
    <form onSubmit={submit}>
      <h1>Work Tracker</h1>
      <input type="password" value={password} placeholder="Password"
        onChange={(e) => setPassword(e.target.value)} autoFocus />
      <button type="submit">Enter</button>
      {error && <p style={{ color: "crimson" }}>{error}</p>}
    </form>
  );
}
