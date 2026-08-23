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

export default function AdminDashboard() {
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
      if (parsedUser.role.toUpperCase() !== "ADMIN") {
        // Role check redirect
        const role = parsedUser.role.toUpperCase();
        if (role === "DOCTOR") router.push("/doctor");
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
                <div className="text-sm font-semibold text-slate-800">{user.name}</div>
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
              Control Panel, {user.name}
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              Manage doctor profile registration, configure slot durations, set specializations, and schedule leave days.
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-blue-700 bg-blue-50 border border-blue-100 rounded-full">
            Admin Portal
          </span>
        </div>

        {/* Dashboard Grid Placeholders */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Doctor Profiles</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Create, edit, and deactivate doctor accounts, assign clinical specializations, and view profiles.
            </p>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-600 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Configure Slots</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Set working hours, define default slot durations (e.g. 15, 30, 60 mins), and configure global system rules.
            </p>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow">
            <div className="h-10 w-10 rounded-lg bg-orange-50 flex items-center justify-center text-orange-600 mb-4">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-slate-800">Leave Management</h3>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Mark doctor holidays and leaves, and view the list of affected appointments for rescheduling.
            </p>
          </div>
        </div>

      </main>
    </div>
  );
}
