"use client";

import { useEffect, useMemo, useState } from "react";
import { LoaderCircle } from "lucide-react";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function UpdatePasswordPage() {
  const sb = useMemo(() => createBrowserSupabase(), []);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("Checking your recovery session…");

  useEffect(() => {
    let alive = true;

    (async () => {
      const {
        data: { session },
      } = await sb.auth.getSession();

      if (!alive) return;
      setReady(Boolean(session));
      setLoading(false);
      setMessage(
        session
          ? "Enter a new password for VIP-Hunter."
          : "Recovery session not found. Request a new password setup link from VIP-Hunter.",
      );
    })();

    const { data } = sb.auth.onAuthStateChange((_event, session) => {
      if (!alive) return;
      setReady(Boolean(session));
      setLoading(false);
      if (session) setMessage("Enter a new password for VIP-Hunter.");
    });

    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, [sb]);

  async function updatePassword(event: React.FormEvent) {
    event.preventDefault();

    if (password.length < 8) {
      setMessage("Use at least 8 characters.");
      return;
    }

    if (password !== confirm) {
      setMessage("The passwords do not match.");
      return;
    }

    setLoading(true);
    setMessage("Updating password…");
    const { error } = await sb.auth.updateUser({ password });
    setLoading(false);

    if (error) {
      setMessage(`Password update error: ${error.message}`);
      return;
    }

    setMessage("Password updated. Redirecting to VIP-Hunter…");
    window.setTimeout(() => {
      window.location.href = "/";
    }, 900);
  }

  return (
    <main>
      <section className="hero">
        <b className="brand">VIP-Hunter</b>
        <h1>
          Set your <span>password.</span>
        </h1>
        <p>After this one-time setup, you can sign in without requesting a magic link every time.</p>
      </section>

      <form className="panel login" onSubmit={updatePassword}>
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="New password"
          disabled={!ready || loading}
        />
        <input
          type="password"
          required
          minLength={8}
          autoComplete="new-password"
          value={confirm}
          onChange={(event) => setConfirm(event.target.value)}
          placeholder="Confirm password"
          disabled={!ready || loading}
        />
        <button type="submit" disabled={!ready || loading}>
          {loading ? <LoaderCircle className="spin" size={16} /> : "Save password"}
        </button>
        <small>{message}</small>
      </form>
    </main>
  );
}
