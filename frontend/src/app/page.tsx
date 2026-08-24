"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
}

const features = [
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
      </svg>
    ),
    badge: "AI Powered",
    title: "Symptom Analysis & Triage",
    desc: "Pre-visit AI triage flags clinical urgency, summarizes complaints, and prepares smart question prompts before your doctor begins.",
    color: "bg-teal-50 text-teal-700 border-teal-200/80 group-hover:bg-teal-600 group-hover:text-white transition-all duration-300",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    ),
    badge: "Zero Conflicts",
    title: "Precision Slot Booking",
    desc: "Real-time calendar slot engine with 10-minute temporary reservation holds, dynamic durations, and automated overlap prevention.",
    color: "bg-emerald-50 text-emerald-700 border-emerald-200/80 group-hover:bg-emerald-600 group-hover:text-white transition-all duration-300",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    ),
    badge: "Structured Care",
    title: "Prescriptions & Notes",
    desc: "Structured e-prescriptions with dosage, frequency, duration tags, and plain-language patient recovery translations.",
    color: "bg-cyan-50 text-cyan-700 border-cyan-200/80 group-hover:bg-cyan-600 group-hover:text-white transition-all duration-300",
  },
  {
    icon: (
      <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16l2.879-2.879m0 0a3 3 0 104.243-4.242 3 3 0 00-4.243 4.242zM21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    badge: "Seamless Sync",
    title: "Google Calendar Sync",
    desc: "One-click OAuth sync directly schedules booked consultations into your personal Google Calendar with automatic alerts.",
    color: "bg-indigo-50 text-indigo-700 border-indigo-200/80 group-hover:bg-indigo-600 group-hover:text-white transition-all duration-300",
  },
];

const portals = [
  {
    role: "Patient Portal",
    badge: "Patients",
    badgeColor: "bg-teal-50 text-teal-700 border-teal-200",
    desc: "Browse verified specialists, view real-time availability, hold target consultation slots, and download visit receipts.",
    icon: "🩺",
    href: "/patient",
    cta: "Access Patient Portal",
  },
  {
    role: "Doctor Agenda",
    badge: "Clinicians",
    badgeColor: "bg-indigo-50 text-indigo-700 border-indigo-200",
    desc: "Manage patient visit queues, review AI pre-triage summaries, generate e-prescriptions, and sync Google Calendar.",
    icon: "👨‍⚕️",
    href: "/doctor",
    cta: "Access Doctor Portal",
  },
  {
    role: "Admin Workspace",
    badge: "Administration",
    badgeColor: "bg-slate-100 text-slate-700 border-slate-200",
    desc: "Onboard medical staff, configure doctor shift schedules, log absence leaves, and monitor clinic profiles.",
    icon: "⚙️",
    href: "/admin",
    cta: "Access Admin Console",
  },
];

export default function Home() {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const router = useRouter();

  useEffect(() => {
    const storedUser = localStorage.getItem("user");
    const token = localStorage.getItem("token");
    if (storedUser && token) {
      try {
        setCurrentUser(JSON.parse(storedUser));
      } catch (e) {
        localStorage.clear();
      }
    }
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
    <main className="min-h-screen flex flex-col hero-gradient relative overflow-hidden font-sans text-slate-800">

      {/* Decorative Ambient Background Elements */}
      <div className="absolute -top-32 left-1/2 -translate-x-1/2 w-[750px] h-[350px] bg-gradient-to-tr from-teal-400/20 via-cyan-400/20 to-emerald-400/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-1/3 -left-40 w-96 h-96 bg-teal-500/10 blur-3xl pointer-events-none rounded-full" />
      <div className="absolute top-2/3 -right-40 w-96 h-96 bg-cyan-500/10 blur-3xl pointer-events-none rounded-full" />

      {/* ── Navbar ── */}
      <header className="glass-nav sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            {/* Brand Logo */}
            <Link href="/" className="flex items-center gap-2.5 group">
              <img
                src="/logo.png"
                alt="MediFlow Logo"
                className="h-9 w-9 object-contain rounded-xl shadow-xs group-hover:scale-105 transition-transform"
              />
              <span className="font-bold text-slate-900 text-xl tracking-tight" style={{ fontFamily: "var(--font-outfit)" }}>
                Medi<span className="text-teal-600">Flow</span>
              </span>
            </Link>

            {/* Nav Actions */}
            <div className="flex items-center gap-3">
              {currentUser ? (
                <>
                  <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-full py-1 pl-1 pr-3 shadow-2xs">
                    <div className="h-6 w-6 rounded-full bg-teal-600 text-white flex items-center justify-center text-xs font-black">
                      {currentUser.name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-xs font-bold text-slate-800">{currentUser.name.split(" ")[0]}</span>
                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wide bg-teal-100/70 text-teal-800 border border-teal-200/60">
                      {currentUser.role}
                    </span>
                  </div>
                  <button
                    onClick={handleDashboardRedirect}
                    className="text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 px-4 py-2 rounded-xl shadow-sm shadow-teal-600/20 transition-all cursor-pointer"
                  >
                    Go to Portal
                  </button>
                  <button
                    onClick={handleLogout}
                    className="text-xs text-slate-500 hover:text-slate-800 font-bold px-2 py-1 cursor-pointer transition-colors"
                  >
                    Sign Out
                  </button>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    className="text-xs font-bold text-slate-600 hover:text-slate-900 px-3.5 py-2 rounded-xl hover:bg-slate-100 transition-all"
                  >
                    Sign In
                  </Link>
                  <Link
                    href="/register"
                    className="text-xs font-bold text-white bg-teal-600 hover:bg-teal-700 active:scale-95 px-4.5 py-2 rounded-xl shadow-sm shadow-teal-600/20 transition-all"
                  >
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── Hero Section ── */}
      <section className="flex-grow flex flex-col items-center justify-center px-4 py-16 md:py-24 text-center relative z-10 max-w-7xl mx-auto w-full">

        {/* Hero Pill Badge */}
        <div className="animate-fade-in inline-flex items-center gap-2 bg-teal-50/90 border border-teal-200/80 text-teal-800 text-xs font-black uppercase tracking-widest px-4.5 py-1.5 rounded-full mb-6 shadow-xs backdrop-blur-sm">
          <span className="w-2 h-2 rounded-full bg-teal-500 animate-pulse"></span>
          <span>MediFlow Intelligent Healthcare</span>
        </div>

        {/* Headline */}
        <h1
          className="animate-fade-in delay-100 text-5xl sm:text-6xl md:text-7xl font-black tracking-tight text-slate-900 leading-[1.06] max-w-4xl"
          style={{ fontFamily: "var(--font-outfit)" }}
        >
          <span className="gradient-text">MediFlow</span> — Clinical care,<br />
          made intelligent.
        </h1>

        {/* Sub-headline */}
        <p className="animate-fade-in delay-150 mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto leading-relaxed font-medium">
          <strong className="text-slate-900 font-bold">MediFlow</strong> is an AI-augmented healthcare platform that seamlessly unifies patient consultation booking, real-time clinical triage, structured digital prescriptions, and automatic calendar synchronization in one frictionless experience.
        </p>

        {/* Floating Feature Tags */}
        <div className="animate-fade-in delay-200 mt-8 flex flex-wrap items-center justify-center gap-2 max-w-3xl">
          {[
            { label: "AI Pre-Triage", icon: "🩺" },
            { label: "10-Min Temporary Slot Locks", icon: "⏱️" },
            { label: "Conflict-Free Engine", icon: "🛡️" },
            { label: "Google Calendar Sync", icon: "📅" },
            { label: "AI Patient Translations", icon: "🤖" },
          ].map((tag, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1 bg-white/80 border border-slate-200/90 rounded-full text-xs font-bold text-slate-700 shadow-2xs backdrop-blur-xs hover:border-teal-300 hover:text-teal-800 transition-colors"
            >
              <span>{tag.icon}</span>
              {tag.label}
            </span>
          ))}
        </div>

        {/* CTA Buttons */}
        <div className="animate-fade-in delay-250 mt-10 flex flex-wrap justify-center gap-4">
          {currentUser ? (
            <button
              onClick={handleDashboardRedirect}
              className="group flex items-center gap-2.5 px-8 py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg shadow-teal-600/25 transition-all cursor-pointer"
            >
              Go to {currentUser.role.charAt(0) + currentUser.role.slice(1).toLowerCase()} Portal
              <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : (
            <>
              <Link
                href="/register"
                className="group flex items-center gap-2.5 px-8 py-3.5 bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-sm rounded-2xl shadow-lg shadow-teal-600/25 transition-all"
              >
                Create Patient Account
                <svg className="h-4 w-4 group-hover:translate-x-1 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
              <Link
                href="/login"
                className="flex items-center gap-2 px-8 py-3.5 bg-white hover:bg-slate-50 active:scale-[0.98] text-slate-800 font-bold text-sm rounded-2xl border border-slate-200 shadow-sm transition-all"
              >
                Sign In to Account
              </Link>
            </>
          )}
        </div>

        {/* ── Feature Grid ── */}
        <div className="animate-fade-in delay-300 mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 w-full text-left">
          {features.map((f, i) => (
            <div
              key={i}
              className="card p-6 flex flex-col justify-between hover:shadow-xl hover:border-teal-200 transition-all duration-300 group cursor-default"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shadow-xs ${f.color}`}>
                    {f.icon}
                  </div>
                  <span className="text-[10px] font-extrabold uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 group-hover:bg-teal-50 group-hover:text-teal-700 transition-colors">
                    {f.badge}
                  </span>
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base leading-snug group-hover:text-teal-700 transition-colors">
                    {f.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed mt-1.5 font-medium">{f.desc}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* ── Portal Ecosystem Showcase ── */}
        <div className="animate-fade-in delay-400 mt-20 w-full text-left">
          <div className="text-center mb-10">
            <h2
              className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight"
              style={{ fontFamily: "var(--font-outfit)" }}
            >
              The MediFlow Ecosystem for Every Medical Role
            </h2>
            <p className="text-sm text-slate-500 mt-2 max-w-xl mx-auto font-medium">
              Seamlessly connect patients, physicians, and administrative clinic managers.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {portals.map((p, idx) => (
              <div
                key={idx}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-sm hover:shadow-lg hover:border-teal-300 transition-all duration-300 group"
              >
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-3xl">{p.icon}</span>
                    <span className={`text-[10px] font-black uppercase tracking-wider px-2.5 py-1 rounded-full border ${p.badgeColor}`}>
                      {p.badge}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 group-hover:text-teal-700 transition-colors" style={{ fontFamily: "var(--font-outfit)" }}>
                    {p.role}
                  </h3>
                  <p className="text-xs text-slate-500 mt-2 leading-relaxed font-medium">
                    {p.desc}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t border-slate-100">
                  <Link
                    href={p.href}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-teal-600 group-hover:text-teal-700 group-hover:gap-2 transition-all"
                  >
                    <span>{p.cta}</span>
                    <span>→</span>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>

      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-slate-200/70 bg-white/80 backdrop-blur-md py-6 px-6 mt-auto">
        <div className="max-w-7xl mx-auto flex justify-center items-center text-center text-sm text-slate-500 font-semibold tracking-wide">
          &copy; 2026 MediFlow Inc. All rights reserved.
        </div>
      </footer>

    </main>
  );
}
