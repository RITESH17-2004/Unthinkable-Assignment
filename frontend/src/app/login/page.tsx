"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const res = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Invalid email or password");
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);

      const userRes = await fetch("http://localhost:8000/api/v1/auth/me", {
        headers: { Authorization: `Bearer ${data.access_token}` },
      });

      if (!userRes.ok) throw new Error("Failed to retrieve user profile");

      const user = await userRes.json();
      localStorage.setItem("user", JSON.stringify(user));

      const role = user.role.toUpperCase();
      if (role === "ADMIN") router.push("/admin");
      else if (role === "DOCTOR") router.push("/doctor");
      else router.push("/patient");
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const highlights = [
    "AI-powered pre-visit symptom triage",
    "Instant doctor slot booking & holds",
    "Structured prescriptions & reminders",
    "Google Calendar appointment sync",
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Left Panel (Brand) ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800"></div>
        {/* Decorative circles */}
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5"></div>
        <div className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-white/5"></div>
        <div className="absolute top-1/3 right-0 w-48 h-48 rounded-full bg-teal-500/20"></div>

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer w-fit">
            <img src="/logo.png" alt="MediFlow Logo" className="h-10 w-10 object-contain rounded-xl shadow-xs" />
            <span className="font-bold text-white text-xl tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>MediFlow</span>
          </Link>

          {/* Main copy */}
          <div className="space-y-8">
            <div>
              <h2 className="text-4xl xl:text-5xl font-black text-white leading-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                Healthcare,<br />
                <span className="text-teal-200">simplified.</span>
              </h2>
              <p className="mt-4 text-teal-100 leading-relaxed text-base">
                The intelligent platform connecting patients and doctors for better, faster care.
              </p>
            </div>
            <ul className="space-y-3">
              {highlights.map((h, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-400/30 flex items-center justify-center">
                    <svg className="h-3 w-3 text-teal-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {h}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/40 font-mono">MediFlow © 2026 &middot; All rights reserved</p>
        </div>
      </div>

      {/* ── Right Panel (Form) ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-12 animate-slide-in-right">
        <div className="w-full max-w-md space-y-8">
          {/* Mobile Logo */}
          <div className="flex lg:hidden flex-col items-center gap-3 mb-2">
            <img src="/logo.png" alt="MediFlow Logo" className="h-12 w-12 object-contain rounded-2xl shadow-md" />
            <span className="font-black text-2xl text-slate-900" style={{ fontFamily: "var(--font-outfit)" }}>MediFlow</span>
          </div>

          {/* Back to Home Button */}
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-600 transition-colors group cursor-pointer"
            >
              <svg className="h-4 w-4 text-slate-600 group-hover:text-teal-600 group-hover:-translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Home</span>
            </Link>
          </div>

          {/* Header */}
          <div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
              Welcome back
            </h1>
            <p className="mt-1.5 text-sm text-slate-500">
              Don&apos;t have an account?{" "}
              <Link href="/register" className="font-semibold text-teal-600 hover:text-teal-700 underline-offset-2 hover:underline">
                Create one for free
              </Link>
            </p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 p-4 bg-rose-50 border border-rose-200 rounded-xl animate-fade-in-scale">
              <svg className="h-5 w-5 text-rose-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <p className="text-sm font-medium text-rose-800">{error}</p>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="input-field"
                placeholder="you@example.com"
              />
            </div>

            <div className="space-y-1.5">
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="input-field pr-11"
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  tabIndex={-1}
                >
                  {showPassword ? (
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <>
                  Sign In
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                  </svg>
                </>
              )}
            </button>
          </form>

          {/* Help note */}
          <div className="border-t border-slate-100 pt-6">
            <p className="text-xs text-slate-400 leading-relaxed">
              <strong className="text-slate-500">Test accounts:</strong> Register a new account or set a user&apos;s role to{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-teal-700 font-mono">DOCTOR</code> or{" "}
              <code className="bg-slate-100 px-1 py-0.5 rounded text-teal-700 font-mono">ADMIN</code>{" "}
              in Supabase to test all portals.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
