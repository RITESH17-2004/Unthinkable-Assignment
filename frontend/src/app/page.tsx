"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface HealthResponse {
  status: string;
  database: string;
}

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
}

export default function Home() {
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [loadingHealth, setLoadingHealth] = useState<boolean>(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Check if user is logged in
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (storedUser && token) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.clear();
      }
    }

    // Fetch backend health status
    const fetchHealth = async () => {
      try {
        const res = await fetch("http://localhost:8000/api/v1/health");
        if (!res.ok) throw new Error("Health check failed");
        const data = await res.json();
        setBackendHealth(data);
      } catch (err: any) {
        setHealthError("Backend server is offline or database is unreachable.");
      } finally {
        setLoadingHealth(false);
      }
    };
    fetchHealth();
  }, []);

  const handleDashboardRedirect = () => {
    if (!currentUser) return;
    const role = currentUser.role.toUpperCase();
    if (role === "ADMIN") router.push("/admin");
    else if (role === "DOCTOR") router.push("/doctor");
    else router.push("/patient");
  };

  const handleLogout = () => {
    localStorage.clear();
    setCurrentUser(null);
  };

  return (
    <main className="min-h-screen bg-slate-50 flex flex-col justify-between font-sans text-slate-800">
      
      {/* Navbar */}
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-teal-600 flex items-center justify-center shadow-sm">
                <svg className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                </svg>
              </div>
              <span className="font-bold text-lg text-slate-900 tracking-tight">CareSync</span>
            </div>

            <div className="flex items-center gap-4">
              {currentUser ? (
                <>
                  <button
                    onClick={handleDashboardRedirect}
                    className="text-sm font-semibold text-teal-600 hover:text-teal-700 bg-teal-50 px-4 py-2 rounded-xl transition-all"
                  >
                    Go to Portal
                  </button>
                  <button
                    onClick={handleLogout}
                    className="text-sm text-slate-500 hover:text-slate-700 font-semibold"
                  >
                    Logout
                  </button>
                </>
              ) : (
                <>
                  <Link href="/login" className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors">
                    Sign In
                  </Link>
                  <Link href="/register" className="text-sm font-bold text-white bg-teal-600 hover:bg-teal-700 px-4 py-2 rounded-xl shadow-md shadow-teal-600/10 transition-all duration-200 active:scale-[0.98]">
                    Register
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <div className="w-full max-w-4xl mx-auto px-6 py-16 md:py-24 text-center flex-grow flex flex-col justify-center">
        <div>
          <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-100 rounded-full">
            Full-Stack Appointment Platform
          </span>
          <h1 className="mt-6 text-4xl md:text-5xl font-extrabold text-slate-900 tracking-tight leading-tight">
            Connecting Patients, Doctors & <br />
            <span className="text-teal-600">Healthcare Management</span>
          </h1>
          <p className="mt-4 text-base md:text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
            Experience smart symptom checking, custom consultation notes, slot management, and AI-driven health follow-up insights.
          </p>

          <div className="mt-8 flex justify-center gap-4">
            {currentUser ? (
              <button
                onClick={handleDashboardRedirect}
                className="px-6 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all duration-200 active:scale-[0.98] flex items-center gap-2"
              >
                Access {currentUser.role.toLowerCase()} Portal
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            ) : (
              <>
                <Link
                  href="/register"
                  className="px-6 py-3 bg-teal-600 text-white font-bold rounded-xl shadow-md shadow-teal-600/20 hover:bg-teal-700 transition-all duration-200 active:scale-[0.98]"
                >
                  Create Patient Account
                </Link>
                <Link
                  href="/login"
                  className="px-6 py-3 bg-white text-slate-700 border border-slate-200 font-bold rounded-xl hover:bg-slate-50 transition-all duration-200 active:scale-[0.98]"
                >
                  Sign In
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Diagnosis Health Panel (Light Themed) */}
        <div className="mt-16 bg-white border border-slate-100 rounded-2xl p-6 shadow-md max-w-2xl mx-auto w-full text-left">
          <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2 mb-3">
            <span className="relative flex h-2.5 w-2.5">
              {loadingHealth ? (
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              ) : backendHealth?.database === "healthy" ? (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              ) : (
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-rose-500"></span>
              )}
            </span>
            Connection Diagnostic Status
          </h3>
          
          {loadingHealth ? (
            <p className="text-xs text-slate-500">Checking system dependencies...</p>
          ) : healthError ? (
            <p className="text-xs text-rose-600 font-medium">{healthError}</p>
          ) : (
            <div className="grid grid-cols-3 gap-4 mt-2">
              <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                <span className="text-[10px] uppercase font-bold text-slate-400">Frontend</span>
                <div className="text-xs font-bold text-slate-700 mt-1">Active</div>
              </div>
              <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                <span className="text-[10px] uppercase font-bold text-slate-400">FastAPI</span>
                <div className="text-xs font-bold text-emerald-600 mt-1">Online</div>
              </div>
              <div className="border border-slate-100 p-3 rounded-xl bg-slate-50/50">
                <span className="text-[10px] uppercase font-bold text-slate-400">Supabase DB</span>
                <div className="text-xs font-bold text-emerald-600 mt-1">Connected</div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <footer className="w-full text-center py-6 border-t border-slate-100 bg-white">
        <p className="text-xs text-slate-400 font-mono">
          CareSync platform &copy; 2026. Built with Next.js & FastAPI.
        </p>
      </footer>
    </main>
  );
}
