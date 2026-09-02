"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const data = await res.json();
      setError(data.error || "Login failed");
      setLoading(false);
      return;
    }

    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="relative flex min-h-full items-center justify-center overflow-hidden px-4 py-10">
      <img
        src="/brand/login-background.jpg"
        alt=""
        className="absolute inset-0 h-full w-full object-cover"
      />
      <div className="absolute inset-0 bg-forest-deep/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-forest-deep/40 via-transparent to-forest-deep/70" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="rounded-3xl border border-gold-soft/30 bg-ivory/95 p-8 shadow-[0_30px_80px_rgba(15,28,22,0.45)] backdrop-blur-sm sm:p-10">
          <div className="mb-8 flex flex-col items-center text-center">
            <img
              src="/brand/logo.png"
              alt="Grand Holdings"
              className="h-28 w-28 rounded-full object-cover shadow-[0_8px_30px_rgba(26,46,36,0.25)]"
            />
            <h1 className="mt-5 font-serif text-4xl tracking-[0.12em] text-forest">
              GRAND HOLDINGS
            </h1>
            <p className="mt-2 text-[11px] tracking-[0.35em] text-gold uppercase">
              Game lodges · Winelands · Robertson
            </p>
            <div className="gold-rule mt-5 w-32" />
            <p className="mt-4 font-serif text-xl text-forest/80">
              Checklist Manager
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block text-sm">
              <span className="mb-1.5 block text-[11px] font-medium tracking-[0.18em] text-forest/70 uppercase">
                Email
              </span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
                placeholder="you@example.com"
              />
            </label>

            <label className="block text-sm">
              <span className="mb-1.5 block text-[11px] font-medium tracking-[0.18em] text-forest/70 uppercase">
                Password
              </span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl border border-forest/15 bg-white px-3.5 py-2.5 text-ink outline-none transition focus:border-gold focus:ring-2 focus:ring-gold/20"
              />
            </label>

            {error && (
              <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-800">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 w-full rounded-xl bg-forest px-4 py-3 text-sm font-medium tracking-[0.18em] text-cream uppercase transition hover:bg-forest-deep disabled:opacity-50"
            >
              {loading ? "Signing in..." : "Sign in"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
