"use client";

import { useState } from "react";
import { CheckCircle2, LoaderCircle } from "lucide-react";

import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) {
        setError("That email or password didn't work. Try again.");
        setBusy(false);
        return;
      }
      // Hard navigation (not router.replace) so the server renders with the
      // freshly-written session cookie — avoids a soft-nav/cookie race that
      // bounces back to login. The role router at "/" sends admins to /admin.
      window.location.assign("/");
    } catch {
      setError("Something went wrong signing in. Please try again.");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="flex size-16 items-center justify-center rounded-2xl bg-sky-deep text-primary-foreground shadow-sm">
          <CheckCircle2 className="size-9" aria-hidden />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-ink">
          ChoreTracker
        </h1>
        <p className="text-sm text-muted-foreground">Sign in to see your chores</p>
      </div>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Email</span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-13 rounded-xl border border-input bg-card px-4 text-base outline-none focus:border-sky focus:ring-2 focus:ring-ring/40"
            placeholder="you@example.com"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-semibold text-ink">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-13 rounded-xl border border-input bg-card px-4 text-base outline-none focus:border-sky focus:ring-2 focus:ring-ring/40"
            placeholder="••••••••"
          />
        </label>

        {error && (
          <p className="rounded-xl bg-destructive/10 px-4 py-3 text-sm font-medium text-destructive">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={busy}
          className="mt-2 flex h-13 items-center justify-center gap-2 rounded-xl bg-sky-deep text-base font-bold text-primary-foreground shadow-sm transition active:scale-[0.98] disabled:opacity-60"
        >
          {busy && <LoaderCircle className="size-5 animate-spin" aria-hidden />}
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
