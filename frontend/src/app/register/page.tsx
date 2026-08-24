"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const getPasswordStrength = (pw: string) => {
    if (!pw) return 0;
    let score = 0;
    if (pw.length >= 8) score++;
    if (/[A-Z]/.test(pw)) score++;
    if (/[0-9]/.test(pw)) score++;
    if (/[^A-Za-z0-9]/.test(pw)) score++;
    return score;
  };

  const strengthScore = getPasswordStrength(password);
  const strengthLabels = ["", "Weak", "Fair", "Good", "Strong"];
  const strengthColors = ["", "bg-rose-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500"];
  const strengthTextColors = ["", "text-rose-500", "text-amber-500", "text-lime-600", "text-emerald-600"];

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/auth/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role: "PATIENT" }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Registration failed. Try a different email.");
      }

      setSuccess(true);
      setTimeout(() => router.push("/login"), 2500);
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const benefits = [
    "Book appointments with verified specialists",
    "Receive AI-generated symptom insights",
    "Track prescriptions & get reminders",
    "Sync your visits to Google Calendar",
  ];

  return (
    <div className="min-h-screen flex bg-slate-50">
      {/* ── Left Panel ── */}
      <div className="hidden lg:flex lg:w-5/12 xl:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-teal-700 to-cyan-800"></div>
        <div className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-white/5"></div>
        <div className="absolute -bottom-32 -right-16 w-96 h-96 rounded-full bg-white/5"></div>

        <div className="relative z-10 flex flex-col justify-between p-10 xl:p-14 w-full">
          <Link href="/" className="flex items-center gap-2.5 group cursor-pointer w-fit">
            <img src="/logo.png" alt="MediFlow Logo" className="h-10 w-10 object-contain rounded-xl shadow-xs" />
            <span className="font-bold text-white text-xl tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>MediFlow</span>
          </Link>

          <div className="space-y-8">
            <div>
              <h2 className="text-4xl xl:text-5xl font-black text-white leading-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                Your health,<br />
                <span className="text-teal-200">your control.</span>
              </h2>
              <p className="mt-4 text-teal-100 leading-relaxed text-base">
                Join thousands of patients managing their healthcare journey with confidence.
              </p>
            </div>
            <ul className="space-y-3">
              {benefits.map((b, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-white/90">
                  <span className="flex-shrink-0 w-5 h-5 rounded-full bg-teal-400/30 flex items-center justify-center">
                    <svg className="h-3 w-3 text-teal-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </span>
                  {b}
                </li>
              ))}
            </ul>
          </div>

          <p className="text-xs text-white/40 font-mono">MediFlow © 2026 &middot; All rights reserved</p>
        </div>
      </div>

      {/* ── Right Panel (Form) ── */}
      <div className="flex-1 flex flex-col justify-center items-center px-6 py-10 animate-slide-in-right">
        <div className="w-full max-w-md space-y-7">
          {/* Mobile Logo */}
          <div className="flex lg:hidden flex-col items-center gap-3 mb-2">
            <img src="/logo.png" alt="MediFlow Logo" className="h-12 w-12 object-contain rounded-2xl shadow-md" />
            <span className="font-black text-2xl text-slate-900" style={{ fontFamily: "var(--font-outfit)" }}>MediFlow</span>
          </div>

          {/* Success State */}
          {success ? (
            <div className="text-center py-8 space-y-5 animate-fade-in-scale">
              <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-emerald-100 border-2 border-emerald-200">
                <svg className="h-8 w-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900" style={{ fontFamily: "var(--font-outfit)" }}>Account Created!</h3>
                <p className="text-sm text-slate-500 mt-1.5">Redirecting you to sign in...</p>
              </div>
              <div className="w-8 h-1.5 rounded-full bg-teal-100 mx-auto overflow-hidden">
                <div className="h-full bg-teal-500 rounded-full animate-pulse"></div>
              </div>
            </div>
          ) : (
            <>
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
                  Create account
                </h1>
                <p className="mt-1.5 text-sm text-slate-500">
                  Already have one?{" "}
                  <Link href="/login" className="font-semibold text-teal-600 hover:text-teal-700 underline-offset-2 hover:underline">
                    Sign in instead
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
              <form onSubmit={handleRegister} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="name" className="block text-sm font-semibold text-slate-700">Full Name</label>
                  <input
                    id="name" name="name" type="text" required
                    value={name} onChange={(e) => setName(e.target.value)}
                    className="input-field" placeholder="Jane Doe"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="email" className="block text-sm font-semibold text-slate-700">Email Address</label>
                  <input
                    id="email" name="email" type="email" autoComplete="email" required
                    value={email} onChange={(e) => setEmail(e.target.value)}
                    className="input-field" placeholder="you@example.com"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-semibold text-slate-700">Password</label>
                  <div className="relative">
                    <input
                      id="password" name="password"
                      type={showPassword ? "text" : "password"}
                      required value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="input-field pr-11" placeholder="Min 8 characters"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                      tabIndex={-1}
                    >
                      <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        {showPassword
                          ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          : <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></>
                        }
                      </svg>
                    </button>
                  </div>
                  {/* Password strength */}
                  {password && (
                    <div className="space-y-1 mt-1">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4].map(i => (
                          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${i <= strengthScore ? strengthColors[strengthScore] : "bg-slate-200"}`}></div>
                        ))}
                      </div>
                      <p className={`text-xs font-semibold ${strengthTextColors[strengthScore]}`}>{strengthLabels[strengthScore]}</p>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-sm font-semibold text-slate-700">Confirm Password</label>
                  <input
                    id="confirmPassword" name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className={`input-field ${confirmPassword && confirmPassword !== password ? "border-rose-400 focus:border-rose-400" : ""}`}
                    placeholder="••••••••"
                  />
                  {confirmPassword && confirmPassword !== password && (
                    <p className="text-xs text-rose-500 font-medium">Passwords do not match</p>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full flex items-center justify-center gap-2 py-3 px-4 bg-teal-600 hover:bg-teal-700 active:scale-[0.99] disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold rounded-xl shadow-md shadow-teal-600/20 transition-all mt-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      Create Account
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                      </svg>
                    </>
                  )}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
