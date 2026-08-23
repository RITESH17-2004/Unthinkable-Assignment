"use client";

import { useState, useEffect } from "react";

interface HealthResponse {
  status: string;
  database: string;
  detail?: any;
}

export default function Home() {
  const [backendHealth, setBackendHealth] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [checkCount, setCheckCount] = useState<number>(0);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("http://localhost:8000/api/v1/health");
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData?.detail?.database || "Backend responded with an error");
      }
      const data: HealthResponse = await res.json();
      setBackendHealth(data);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to reach backend server. Ensure FastAPI is running on port 8000.");
      setBackendHealth(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, [checkCount]);

  const handleRecheck = () => {
    setCheckCount((prev) => prev + 1);
  };

  const isBackendConnected = backendHealth !== null && !error;
  const isDatabaseConnected = backendHealth?.database === "healthy";

  return (
    <main className="relative min-h-screen bg-slate-950 flex flex-col justify-between overflow-hidden font-sans">
      {/* Dynamic Background Gradients */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-indigo-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />

      {/* Main Content */}
      <div className="w-full max-w-4xl mx-auto px-6 py-12 md:py-20 flex-grow flex flex-col justify-center relative z-10">
        
        {/* Header */}
        <div className="text-center mb-12">
          <span className="px-3 py-1 text-xs font-semibold uppercase tracking-wider text-indigo-400 bg-indigo-500/10 border border-indigo-500/20 rounded-full">
            Phase 1
          </span>
          <h1 className="mt-4 text-4xl md:text-5xl font-extrabold tracking-tight text-white">
            Healthcare Appointment <br />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-emerald-400">
              & Follow-up Manager
            </span>
          </h1>
          <p className="mt-4 text-lg text-slate-400 max-w-2xl mx-auto">
            Initializing full-stack services. Verify end-to-end connectivity between Next.js frontend, FastAPI backend, and PostgreSQL database.
          </p>
        </div>

        {/* Status Dashboard */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          
          {/* Frontend Status */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:border-slate-700/80">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Frontend</p>
                <h3 className="text-2xl font-bold text-white mt-1">Next.js</h3>
                <p className="text-xs text-slate-500 mt-1">Running on Port 3000</p>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                Active
              </div>
            </div>
          </div>

          {/* Backend Status */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:border-slate-700/80">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Backend</p>
                <h3 className="text-2xl font-bold text-white mt-1">FastAPI</h3>
                <p className="text-xs text-slate-500 mt-1">Running on Port 8000</p>
              </div>
              {loading ? (
                <div className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Checking...
                </div>
              ) : isBackendConnected ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  Offline
                </div>
              )}
            </div>
          </div>

          {/* Database Status */}
          <div className="bg-slate-900/60 backdrop-blur-xl border border-slate-800 rounded-2xl p-6 shadow-2xl transition-all duration-300 hover:border-slate-700/80">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-400 uppercase tracking-wider">Database</p>
                <h3 className="text-2xl font-bold text-white mt-1">PostgreSQL</h3>
                <p className="text-xs text-slate-500 mt-1">Supabase Cloud</p>
              </div>
              {loading ? (
                <div className="flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></span>
                  Checking...
                </div>
              ) : isDatabaseConnected ? (
                <div className="flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  Connected
                </div>
              ) : (
                <div className="flex items-center gap-1.5 bg-rose-500/10 text-rose-400 px-2.5 py-1 rounded-full text-xs font-semibold">
                  <span className="h-2 w-2 rounded-full bg-rose-500"></span>
                  Unreachable
                </div>
              )}
            </div>
          </div>

        </div>

        {/* Detailed Logs & Diagnosis */}
        <div className="bg-slate-900/40 backdrop-blur-md border border-slate-800/80 rounded-2xl p-6 mb-8">
          <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
            <svg className="w-5 h-5 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            System Diagnostics
          </h2>
          
          {loading ? (
            <div className="py-6 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              <span className="ml-3 text-slate-400 text-sm">Testing connectivity...</span>
            </div>
          ) : error ? (
            <div className="p-4 bg-rose-500/10 border border-rose-500/20 rounded-xl">
              <div className="flex gap-3">
                <svg className="w-5 h-5 text-rose-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div>
                  <h4 className="text-sm font-semibold text-rose-200">Connection Error</h4>
                  <p className="text-xs text-rose-300 mt-1 font-mono">{error}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-center text-sm py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Backend Response Status</span>
                <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                  200 OK
                </span>
              </div>
              <div className="flex justify-between items-center text-sm py-2 border-b border-slate-800/60">
                <span className="text-slate-400">Database Driver</span>
                <span className="font-mono text-slate-300 bg-slate-800 px-2 py-0.5 rounded">SQLAlchemy + Psycopg2</span>
              </div>
              <div className="flex justify-between items-center text-sm py-2">
                <span className="text-slate-400">Supabase Connection State</span>
                <span className="font-mono text-emerald-400 font-semibold bg-emerald-500/10 px-2 py-0.5 rounded">
                  {backendHealth?.database === "healthy" ? "Active (Pool Connection Verified)" : "Failed"}
                </span>
              </div>
            </div>
          )}

          {/* Action Trigger */}
          <div className="mt-6 flex justify-end">
            <button
              onClick={handleRecheck}
              disabled={loading}
              className={`px-5 py-2.5 rounded-xl font-semibold text-sm transition-all duration-200 flex items-center gap-2 ${
                loading
                  ? "bg-slate-800 text-slate-500 cursor-not-allowed"
                  : "bg-indigo-600 text-white hover:bg-indigo-500 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]"
              }`}
            >
              <svg className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 12H16" />
              </svg>
              Verify Connectivity
            </button>
          </div>
        </div>

        {/* Roadmap Summary */}
        <div className="border border-slate-800/60 rounded-2xl p-6 bg-slate-900/10">
          <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider mb-4">Project Roadmap & Portals</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-slate-900/30 border border-slate-800/60 rounded-xl">
              <h4 className="font-bold text-white text-sm">👤 Patient Portal</h4>
              <p className="text-xs text-slate-400 mt-1">Book doctor slots, pre-visit AI symptoms review, medical prescriptions & schedules.</p>
            </div>
            <div className="p-4 bg-slate-900/30 border border-slate-800/60 rounded-xl">
              <h4 className="font-bold text-white text-sm">👨‍⚕️ Doctor Portal</h4>
              <p className="text-xs text-slate-400 mt-1">Manage today's appointments, add visit summary/prescriptions, view AI chief complaint.</p>
            </div>
            <div className="p-4 bg-slate-900/30 border border-slate-800/60 rounded-xl">
              <h4 className="font-bold text-white text-sm">👨‍💼 Admin Portal</h4>
              <p className="text-xs text-slate-400 mt-1">Configure slot duration, create doctor profiles, specialization setup & mark leave days.</p>
            </div>
          </div>
        </div>

      </div>

      {/* Footer */}
      <footer className="w-full text-center py-6 border-t border-slate-900 z-10">
        <p className="text-xs text-slate-500 font-mono">
          Antigravity Coding pair-programming workspace &copy; 2026.
        </p>
      </footer>
    </main>
  );
}
