"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setError(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-panel px-4">
      <div className="w-full max-w-sm bg-white border border-border rounded-xl p-8 shadow-sm">
        <div className="text-orange font-bold tracking-widest text-sm mb-1">MOON INC.</div>
        <h1 className="text-xl font-bold mb-6">KOL &amp; Affiliate CRM</h1>

        {sent ? (
          <p className="text-sm text-gray-600">
            Check your inbox for a sign-in link sent to <strong>{email}</strong>.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1">Work email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@mooninc.hk"
                className="w-full border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange"
              />
            </div>
            {error && <p className="text-xs text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-dark text-white text-sm font-semibold rounded-md py-2 hover:bg-black transition disabled:opacity-50"
            >
              {loading ? "Sending link..." : "Send sign-in link"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
