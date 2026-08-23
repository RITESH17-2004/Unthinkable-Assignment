"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

export default function DoctorDashboard() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      localStorage.clear();
      router.push("/login");
      return;
    }

    try {
      const parsedUser: UserProfile = JSON.parse(storedUser);
      if (parsedUser.role.toUpperCase() !== "DOCTOR") {
        // Role check redirect
        const role = parsedUser.role.toUpperCase();
        if (role === "ADMIN") router.push("/admin");
        else if (role === "PATIENT") router.push("/patient");
        else router.push("/login");
        return;
      }
      setUser(parsedUser);
    } catch (e) {
      localStorage.clear();
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Navigation */}
      <header className="bg-white border-b border-slate-100 shadow-sm sticky top-0 z-20">
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
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-800">Dr. {user.name}</div>
                <div className="text-xs text-slate-400 capitalize">{user.role.toLowerCase()}</div>
              </div>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 rounded-lg bg-white hover:bg-slate-50 transition-all duration-200 active:scale-[0.98]"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Page Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow">
        
        {/* Welcome Section */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm mb-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
              Welcome, Dr. {user.name}
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              Access your clinical agenda, review pre-visit AI diagnostics, and create post-visit prescriptions.
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-rose-700 bg-rose-50 border border-rose-100 rounded-full">
            Doctor Portal
          </span>
        </div>

        {/* Dashboard Grid Placeholders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Clinical Agenda</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Review booked appointments, check-in statuses, and scheduled visit hours for today.
            </p>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-purple-50 flex items-center justify-center text-purple-600 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Pre-visit AI Diagnosis</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Analyze AI urgency assessments and suggested clinical questions before patient check-in.
            </p>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-600 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Consultation Notes</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Write medical notes, log symptoms, generate medication schedules and follow-up guides.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
