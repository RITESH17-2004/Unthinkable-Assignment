"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      // API expects url-encoded Form data for OAuth2 login
      const formData = new URLSearchParams();
      formData.append("username", email);
      formData.append("password", password);

      const res = await fetch("http://localhost:8000/api/v1/auth/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: formData,
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.detail || "Invalid email or password");
      }

      const data = await res.json();
      localStorage.setItem("token", data.access_token);

      // Fetch user details to get the role
      const userRes = await fetch("http://localhost:8000/api/v1/auth/me", {
        headers: {
          Authorization: `Bearer ${data.access_token}`,
        },
      });

      if (!userRes.ok) {
        throw new Error("Failed to retrieve user profile");
      }

      const user = await userRes.json();
      localStorage.setItem("user", JSON.stringify(user));

      // Redirect based on role (roles are stored in uppercase)
      const role = user.role.toUpperCase();
      if (role === "ADMIN") {
        router.push("/admin");
      } else if (role === "DOCTOR") {
        router.push("/doctor");
      } else {
        router.push("/patient");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* Logo and Icon */}
        <div className="flex justify-center">
          <div className="h-12 w-12 rounded-xl bg-teal-600 flex items-center justify-center shadow-md">
            <svg className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900 tracking-tight">
          Welcome Back
        </h2>
        <p className="mt-2 text-center text-sm text-slate-600">
          Or{" "}
          <Link href="/register" className="font-semibold text-teal-600 hover:text-teal-500 transition-colors">
            create a new patient account
          </Link>
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl border border-slate-100 rounded-2xl sm:px-10">
          <form className="space-y-6" onSubmit={handleLogin}>
            
            {error && (
              <div className="rounded-lg bg-rose-50 p-4 border border-rose-100">
                <div className="flex gap-2">
                  <svg className="h-5 w-5 text-rose-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                  <p className="text-sm font-medium text-rose-800">{error}</p>
                </div>
              </div>
            )}

            <div>
              <label htmlFor="email" className="block text-sm font-semibold text-slate-700">
                Email Address
              </label>
              <div className="mt-1.5">
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="appearance-none block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 sm:text-sm text-slate-900 bg-white"
                  placeholder="name@example.com"
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-slate-700">
                Password
              </label>
              <div className="mt-1.5">
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="appearance-none block w-full px-3.5 py-2.5 border border-slate-200 rounded-xl shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 sm:text-sm text-slate-900 bg-white"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-md text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-teal-500 disabled:bg-slate-400 transition-all duration-200 active:scale-[0.99]"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : (
                  "Sign In"
                )}
              </button>
            </div>
          </form>

          {/* Diagnostic Note / Help */}
          <div className="mt-6 border-t border-slate-100 pt-6">
            <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Test Accounts Info</h4>
            <p className="text-xs text-slate-500 leading-normal">
              Register a new account or insert a user in Supabase with role <code className="bg-slate-100 px-1 py-0.5 rounded text-teal-700">DOCTOR</code> or <code className="bg-slate-100 px-1 py-0.5 rounded text-teal-700">ADMIN</code> to test specific role redirects.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
