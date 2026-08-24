"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface DoctorProfile {
  id: number;
  user_id: number;
  specialization: string;
  slot_duration: number;
  bio: string | null;
}

interface DoctorUser {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
  doctor_profile?: DoctorProfile;
}

interface WorkingHour {
  id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
}

interface DoctorLeave {
  id: number;
  leave_date: string;
  reason: string | null;
}

interface Prescription {
  id?: number;
  appointment_id?: number;
  medicine_name: string;
  dosage: string;
  frequency: string;
  duration: string;
  instructions?: string | null;
}

interface Appointment {
  id: number;
  patient_id: number;
  doctor_profile_id: number;
  appointment_date: string;
  start_time: string;
  end_time: string;
  status: string;
  symptoms: string | null;
  patient_name: string | null;
  clinical_notes?: string | null;
  prescriptions?: Prescription[];
  ai_urgency_level?: string | null;
  ai_chief_complaint?: string | null;
  ai_suggested_questions?: string | null;
  ai_pre_visit_status?: string;
  ai_patient_summary?: string | null;
  ai_follow_up_instructions?: string | null;
  ai_post_visit_status?: string;
  ai_model_info?: string | null;
}

export default function DoctorDashboard() {
  const [user, setUser] = useState<DoctorUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"profile" | "schedule" | "agenda">("agenda");
  const router = useRouter();

  // Profile Edit States
  const [bio, setBio] = useState("");
  const [slotDuration, setSlotDuration] = useState(30);
  const [isSlotDurationOpen, setIsSlotDurationOpen] = useState(false);
  const slotDurationRef = useRef<HTMLDivElement | null>(null);
  const [specialization, setSpecialization] = useState("");
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (slotDurationRef.current && !slotDurationRef.current.contains(e.target as Node)) {
        setIsSlotDurationOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Doctor Schedule & Leave list
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Complete Visit Modal States
  const [selectedVisit, setSelectedVisit] = useState<Appointment | null>(null);
  const [viewingVisitSummary, setViewingVisitSummary] = useState<Appointment | null>(null);
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [medications, setMedications] = useState<Prescription[]>([{ medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
  const [completeLoading, setCompleteLoading] = useState(false);

  // Google Calendar Integration States
  const [googleConnected, setGoogleConnected] = useState(false);
  const [googleEmail, setGoogleEmail] = useState("");
  const [googleLoading, setGoogleLoading] = useState(true);
  const [googleEnabled, setGoogleEnabled] = useState(true);

  const fetchGoogleStatus = async (token: string) => {
    try {
      const res = await fetch(`${API_BASE}/api/v1/google-calendar/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setGoogleConnected(data.connected);
        setGoogleEmail(data.email || "");
        setGoogleEnabled(data.enabled ?? true);
      }
    } catch (e) {
      console.error("Failed to query Google Calendar connection status:", e);
    } finally {
      setGoogleLoading(false);
    }
  };

  const handleConnectGoogle = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/google-calendar/auth-url`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          window.location.href = data.url;
        }
      } else {
        alert("Failed to get Google Calendar auth URL.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to reach server.");
    }
  };

  const handleDisconnectGoogle = async () => {
    const token = localStorage.getItem("token");
    if (!token) return;
    if (!confirm("Are you sure you want to disconnect Google Calendar?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/google-calendar/disconnect`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        setGoogleConnected(false);
        setGoogleEmail("");
        alert("Google Calendar disconnected successfully.");
      } else {
        alert("Failed to disconnect Google Calendar.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to reach server.");
    }
  };

  const fetchDoctorProfileAndSchedule = async (token: string | null) => {
    if (!token) return;
    try {
      // 1. Fetch profile info
      const res = await fetch(`${API_BASE}/api/v1/doctor/profile/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        throw new Error("Failed to load doctor profile");
      }

      const userData: DoctorUser = await res.json();
      setUser(userData);
      
      // Seed edit fields
      if (userData.doctor_profile) {
        setBio(userData.doctor_profile.bio || "");
        setSlotDuration(userData.doctor_profile.slot_duration);
        setSpecialization(userData.doctor_profile.specialization);
      }

      // 2. Fetch Working Hours & leaves
      setScheduleLoading(true);
      
      const scheduleRes = await fetch(`${API_BASE}/api/v1/admin/doctors/${userData.id}/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        setWorkingHours(scheduleData);
      }

      const leavesRes = await fetch(`${API_BASE}/api/v1/admin/doctors/${userData.id}/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (leavesRes.ok) {
        const leavesData = await leavesRes.json();
        setLeaves(leavesData);
      }

      // 3. Fetch Appointments (Agenda)
      const appRes = await fetch(`${API_BASE}/api/v1/appointments/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (appRes.ok) {
        const appData = await appRes.json();
        appData.sort((a: Appointment, b: Appointment) => {
          const dateA = new Date(a.appointment_date + "T" + a.start_time);
          const dateB = new Date(b.appointment_date + "T" + b.start_time);
          return dateA.getTime() - dateB.getTime();
        });
        setAppointments(appData);
      }
    } catch (e: any) {
      console.error(e);
      localStorage.clear();
      router.push("/login");
    } finally {
      setScheduleLoading(false);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      localStorage.clear();
      router.push("/login");
      return;
    }

    try {
      const parsedUser = JSON.parse(storedUser);
      if (parsedUser.role.toUpperCase() !== "DOCTOR") {
        router.push("/login");
        return;
      }
      fetchDoctorProfileAndSchedule(token);
      fetchGoogleStatus(token);
    } catch (e) {
      localStorage.clear();
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setEditSuccess(false);
    setEditError(null);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`${API_BASE}/api/v1/doctor/profile/me/profile`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          bio,
          slot_duration: slotDuration,
          specialization,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update profile info");
      }

      setEditSuccess(true);
      fetchDoctorProfileAndSchedule(token);
    } catch (err: any) {
      setEditError(err.message || "An error occurred.");
    }
  };

  const handleCancelAppointment = async (appId: number) => {
    if (!confirm("Are you sure you want to cancel this patient appointment?")) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/v1/appointments/${appId}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert("Appointment cancelled successfully!");
        fetchDoctorProfileAndSchedule(token);
      } else {
        alert("Failed to cancel appointment.");
      }
    } catch (e) {
      console.error(e);
    }
  };
  const handleCompleteVisit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedVisit) return;

    if (!clinicalNotes.trim()) {
      alert("Clinical notes cannot be empty or blank.");
      return;
    }

    // Filter out completely empty prescription rows
    const activeMedications = medications.filter(
      (m) => m.medicine_name.trim() || m.dosage.trim() || m.frequency.trim() || m.duration.trim() || m.instructions?.trim()
    );

    // Validate medication rows
    for (let i = 0; i < activeMedications.length; i++) {
      const med = activeMedications[i];
      if (!med.medicine_name.trim() || !med.dosage.trim() || !med.frequency.trim() || !med.duration.trim()) {
        alert(`Medication row #${i + 1} has empty fields. Medicine Name, Dosage, Frequency, and Duration are required.`);
        return;
      }
    }

    setCompleteLoading(true);
    const token = localStorage.getItem("token");
    if (!token) {
      setCompleteLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/v1/appointments/${selectedVisit.id}/complete`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          clinical_notes: clinicalNotes.trim(),
          prescriptions: activeMedications,
        }),
      });

      if (res.ok) {
        alert("Visit report submitted successfully! AI summaries are being generated.");
        setSelectedVisit(null);
        setClinicalNotes("");
        setMedications([{ medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
        fetchDoctorProfileAndSchedule(token);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to complete visit.");
      }
    } catch (e) {
      console.error(e);
      alert("Failed to connect to the server.");
    } finally {
      setCompleteLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-medium">Loading your portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      {/* ── Navigation ── */}
      <header className="glass-nav sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-6">
              {/* Logo */}
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="MediFlow Logo" className="h-9 w-9 object-contain rounded-xl shadow-xs" />
                <span className="font-bold text-slate-900 text-lg tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                  Medi<span className="text-teal-600">Flow</span>
                </span>
              </div>

              {/* Desktop Nav Tabs */}
              <nav className="hidden md:flex items-center gap-1">
                {[
                  { key: "agenda",   label: "Agenda" },
                  { key: "profile",  label: "Profile" },
                  { key: "schedule", label: "Schedule" },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => setActiveTab(tab.key as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all cursor-pointer ${
                      activeTab === tab.key
                        ? "bg-teal-50 text-teal-700 shadow-sm"
                        : "text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>
            
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-full py-1 pl-1 pr-3 shadow-2xs">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-xs font-black shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">Dr. {user.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-teal-100/70 text-teal-800 border border-teal-200/60">
                    {user.doctor_profile?.specialization || "Doctor"}
                  </span>
                </div>
              </div>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 rounded-lg bg-white hover:bg-slate-50 transition-all active:scale-95 cursor-pointer"
              >
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow w-full">
        
        {/* Mobile Navigation */}
        <div className="flex md:hidden bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm mb-6 gap-1">
          {[
            { key: "agenda",   label: "Agenda" },
            { key: "profile",  label: "Profile" },
            { key: "schedule", label: "Schedule" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab.key ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Profile Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-2xl p-6 md:p-7 shadow-lg text-white mb-6">
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-10">
            <svg viewBox="0 0 200 200" fill="none" className="h-full w-full">
              <circle cx="160" cy="40" r="120" stroke="white" strokeWidth="40" />
            </svg>
          </div>
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-xl bg-teal-500/20 backdrop-blur-sm flex items-center justify-center text-teal-100 text-2xl font-black border border-teal-400/30 shadow-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 bg-teal-400/20 border border-teal-300/30 text-teal-200 text-[11px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded-full mb-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-teal-300"></span>
                  Doctor Portal
                </div>
                <h1 className="text-xl md:text-2xl font-black tracking-tight mt-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>
                  Dr. {user.name}
                </h1>
                <p className="text-teal-100/80 text-sm mt-0.5">
                  {user.doctor_profile?.specialization || "General Practice"} &middot; {user.email}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* TAB A: MY AGENDA */}
        {activeTab === "agenda" && (
          <div className="card overflow-hidden animate-fade-in">
            <div className="px-6 py-4.5 border-b border-slate-100 flex justify-between items-center">
              <div>
                <h2 className="text-lg font-black text-slate-900" style={{ fontFamily: 'var(--font-outfit)' }}>Patient Visit Schedule</h2>
                <p className="text-xs text-slate-400 mt-0.5">Your upcoming and historical patient appointments.</p>
              </div>
              <span className="badge badge-neutral">{appointments.length} visits</span>
            </div>

            {appointments.length === 0 ? (
              <div className="text-center py-16 text-slate-400 italic">
                No patient bookings scheduled.
              </div>
            ) : (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left divide-y divide-slate-100">
                <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 whitespace-nowrap">Patient</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Date</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Time Slot</th>
                    <th className="px-5 py-3.5">Symptoms</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {appointments.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <div className="flex items-center gap-2.5">
                          <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-black flex-shrink-0">
                            {(app.patient_name || "P").charAt(0)}
                          </div>
                          <span className="font-bold text-slate-900 text-sm">{app.patient_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                        {new Date(app.appointment_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-5 py-3.5 text-sm font-mono text-slate-700 whitespace-nowrap">
                        {app.start_time.substring(0, 5)} – {app.end_time.substring(0, 5)}
                      </td>
                      <td className="px-5 py-3.5 text-sm text-slate-600 max-w-sm truncate">
                        {app.symptoms || <span className="text-slate-300 italic">None logged</span>}
                      </td>
                      <td className="px-5 py-3.5 whitespace-nowrap">
                        <span className={`badge ${
                          app.status === "BOOKED" ? "badge-success" :
                          app.status === "RESCHEDULED" ? "badge-info" :
                          app.status === "COMPLETED" ? "bg-teal-50 text-teal-800 border border-teal-200" :
                          "badge-neutral"
                        }`}>
                          {app.status}
                        </span>
                      </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                          {app.status === "COMPLETED" && (
                            <button
                              onClick={() => setViewingVisitSummary(app)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 active:scale-95 transition-all cursor-pointer"
                            >
                              Summary
                            </button>
                          )}
                          {app.status !== "CANCELLED" && app.status !== "COMPLETED" && (
                            <>
                              <button
                                onClick={() => {
                                  setSelectedVisit(app);
                                  setClinicalNotes(app.clinical_notes || "");
                                  if (app.prescriptions && app.prescriptions.length > 0) {
                                    setMedications(app.prescriptions);
                                  } else {
                                    setMedications([{ medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" }]);
                                  }
                                }}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 hover:border-emerald-300 active:scale-95 transition-all cursor-pointer"
                              >
                                Complete
                              </button>
                              <button
                                onClick={() => handleCancelAppointment(app.id)}
                                className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 active:scale-95 transition-all cursor-pointer"
                              >
                                Cancel
                              </button>
                            </>
                          )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB B: MY PROFILE */}
        {activeTab === "profile" && (
          <div className="card p-6 md:p-7 animate-fade-in">
            <div className="mb-6">
              <h2 className="text-base font-bold text-slate-900">Clinical Information</h2>
              <p className="text-xs text-slate-500 mt-1">Modify details visible to patients during slot bookings.</p>
            </div>

            <form onSubmit={handleUpdateProfile} className="space-y-5">
              {editSuccess && (
                <div className="bg-emerald-50 text-emerald-800 text-xs p-3 rounded-lg border border-emerald-100 font-semibold">
                  Profile updated successfully!
                </div>
              )}
              {editError && (
                <div className="bg-rose-50 text-rose-800 text-xs p-3 rounded-lg border border-rose-100 font-medium">
                  {editError}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-slate-600">Specialization</label>
                  <input
                    type="text"
                    required
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="input-field"
                    placeholder="e.g. Pediatrics, Orthopedics"
                  />
                </div>
                
                {/* Custom Themed Slot Duration Dropdown */}
                <div className="space-y-1.5" ref={slotDurationRef}>
                  <label className="block text-xs font-bold text-slate-600">Appointment Slot Duration</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setIsSlotDurationOpen(!isSlotDurationOpen)}
                      className={`w-full input-field flex items-center justify-between gap-2 text-left cursor-pointer transition-all ${
                        isSlotDurationOpen ? "border-teal-500 ring-2 ring-teal-500/20" : ""
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0"></span>
                        <span className="font-semibold text-slate-800 text-sm">{slotDuration} minutes</span>
                      </div>
                      <svg
                        className={`h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                          isSlotDurationOpen ? "rotate-180 text-teal-600" : ""
                        }`}
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </button>

                    {isSlotDurationOpen && (
                      <div className="absolute right-0 top-full mt-2 w-full bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-30 animate-fade-in-scale">
                        {[15, 30, 45, 60].map((dur) => (
                          <button
                            key={dur}
                            type="button"
                            onClick={() => {
                              setSlotDuration(dur);
                              setIsSlotDurationOpen(false);
                            }}
                            className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                              slotDuration === dur
                                ? "bg-teal-50 text-teal-800 font-bold"
                                : "text-slate-700 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-center gap-2">
                              <span className="text-slate-800 font-bold text-sm">{dur} minutes</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-normal">
                                {dur <= 30 ? "Standard" : "Extended"}
                              </span>
                            </div>
                            {slotDuration === dur && (
                              <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-600">Biography</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="input-field resize-none"
                  placeholder="Share a short summary of your medical career..."
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md transition-all active:scale-[0.98]"
                >
                  Save Profile
                </button>
              </div>
            </form>

            <div className="border-t border-slate-100 mt-6 pt-6">
              <h2 className="text-sm font-bold text-slate-900 mb-0.5">Integrations & Sync</h2>
              <p className="text-xs text-slate-500 mb-5">Manage external services connected to your account.</p>
              
              <div className="bg-slate-50/50 border border-slate-100 rounded-xl p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-xl bg-white border border-slate-200/60 shadow-sm flex items-center justify-center text-2xl">
                    📅
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900">Google Calendar Sync</h4>
                    <p className="text-xs text-slate-500 mt-0.5">Automatically add your scheduled patient appointments to your calendar.</p>
                  </div>
                </div>

                {!googleEnabled ? (
                  <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
                    <span className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-100 px-3 py-1.5 rounded-xl max-w-xs text-right">
                      ⚠️ <strong>Demo Mode Notice:</strong> Google Calendar Integration is unconfigured in this deployment environment. Set OAuth keys in <code>.env</code> to connect.
                    </span>
                    <button
                      disabled
                      className="px-5 py-2.5 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold cursor-not-allowed w-full sm:w-auto"
                    >
                      Sync Disabled
                    </button>
                  </div>
                ) : googleLoading ? (
                  <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                ) : googleConnected ? (
                  <div className="flex items-center gap-4 w-full sm:w-auto justify-between sm:justify-end">
                    <span className="text-xs font-semibold text-slate-500 bg-white px-3 py-1.5 border border-slate-200 rounded-xl">
                      Connected: <strong className="text-teal-700 font-bold">{googleEmail}</strong>
                    </span>
                    <button
                      onClick={handleDisconnectGoogle}
                      className="px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={handleConnectGoogle}
                    className="w-full sm:w-auto px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/10 transition-all text-center cursor-pointer"
                  >
                    Connect Google Calendar
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* TAB C: MY SCHEDULE */}
        {activeTab === "schedule" && (
          <div className="space-y-8">
            {scheduleLoading ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-12 shadow-sm text-center">
                <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                <span className="text-slate-400 text-xs mt-3 block">Loading schedule data...</span>
              </div>
            ) : (
              <>
                {/* Working Hours */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950 mb-1">Weekly Working Hours</h3>
                  <p className="text-xs text-slate-500 mb-6">Assigned duty hours by administrators.</p>

                  {workingHours.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No working hours configured for you. Please contact administrator.</p>
                  ) : (
                    <div className="divide-y divide-slate-100">
                      {workingHours.map((wh) => (
                        <div key={wh.id} className="flex justify-between items-center py-3 text-sm">
                          <span className="font-semibold text-slate-800">{weekdays[wh.day_of_week]}</span>
                          <span className="text-teal-700 font-bold bg-teal-50 px-2 py-0.5 rounded">
                            {wh.start_time.substring(0, 5)} - {wh.end_time.substring(0, 5)}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Leaves */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-lg font-bold text-slate-950 mb-1">Registered Leave Days</h3>
                  <p className="text-xs text-slate-500 mb-6">Your vacation and leave schedules.</p>

                  {leaves.length === 0 ? (
                    <p className="text-sm text-slate-400 italic">No leaves registered.</p>
                  ) : (
                    <div className="space-y-2">
                      {leaves.map((leave) => (
                        <div key={leave.id} className="p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm flex justify-between items-center">
                          <span className="font-semibold text-slate-800">
                            {new Date(leave.leave_date).toLocaleDateString()}
                          </span>
                          {leave.reason && (
                            <span className="text-slate-400 text-xs italic">({leave.reason})</span>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

      </main>

      {/* MODAL 1: COMPLETE VISIT FORM */}
      {selectedVisit && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setSelectedVisit(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-slate-950 mb-1">Complete Visit Report</h3>
            <p className="text-xs text-slate-400 mb-6">Patient: {selectedVisit.patient_name} | {new Date(selectedVisit.appointment_date).toLocaleDateString()} at {selectedVisit.start_time.substring(0, 5)}</p>

            {/* PRE-VISIT AI SUMMARY DRAWER */}
            <div className="mb-6 p-4 bg-teal-50/20 border border-teal-100 rounded-xl space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-black text-teal-955 flex items-center gap-1">
                  <span>🤖</span> AI Symptoms Analysis
                </span>
                {selectedVisit.ai_pre_visit_status === "SUCCESS" || selectedVisit.ai_pre_visit_status === "FAILED" ? (
                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider ${
                    selectedVisit.ai_urgency_level === "HIGH" ? "bg-rose-100 text-rose-800" :
                    selectedVisit.ai_urgency_level === "MEDIUM" ? "bg-amber-100 text-amber-800" :
                    "bg-emerald-100 text-emerald-800"
                  }`}>
                    {selectedVisit.ai_urgency_level} URGENCY
                  </span>
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold animate-pulse">COMPILING...</span>
                )}
              </div>

              {selectedVisit.ai_pre_visit_status === "SUCCESS" || selectedVisit.ai_pre_visit_status === "FAILED" ? (
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="font-bold text-slate-500">Chief Complaint:</span>
                    <p className="text-slate-800 font-medium mt-0.5">"{selectedVisit.ai_chief_complaint}"</p>
                  </div>
                  <div>
                    <span className="font-bold text-slate-500">Suggested Diagnostic Questions:</span>
                    <ul className="list-disc pl-5 mt-1.5 text-slate-800 space-y-1.5">
                      {selectedVisit.ai_suggested_questions &&
                        (() => {
                          try {
                            const qs = JSON.parse(selectedVisit.ai_suggested_questions);
                            return Array.isArray(qs) ? qs.map((q, idx) => <li key={idx} className="pl-1">{q}</li>) : <li className="pl-1">{qs}</li>;
                          } catch {
                            return <li className="pl-1">{selectedVisit.ai_suggested_questions}</li>;
                          }
                        })()
                      }
                    </ul>
                  </div>
                </div>
              ) : (
                <div className="text-xs text-slate-450 italic">
                  AI symptom summarizer is running in the background. Refresh in a few seconds.
                </div>
              )}
            </div>

            {/* Visit Details input form */}
            <form onSubmit={handleCompleteVisit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Clinical Assessment Notes</label>
                <textarea
                  required
                  value={clinicalNotes}
                  onChange={(e) => setClinicalNotes(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="Record your clinical observation, diagnosis notes, and patient diagnosis details..."
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-xs font-bold text-slate-600">Prescriptions & Medications</label>
                  <button
                    type="button"
                    onClick={() => setMedications([...medications, { medicine_name: "", dosage: "", frequency: "", duration: "", instructions: "" }])}
                    className="text-xs font-bold text-teal-600 hover:text-teal-700 flex items-center gap-1"
                  >
                    <span>+</span> Add Medication
                  </button>
                </div>
                
                <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                  {medications.map((med, index) => (
                    <div key={index} className="p-3 bg-slate-50 border border-slate-100 rounded-xl space-y-2 relative">
                      {medications.length > 1 && (
                        <button
                          type="button"
                          onClick={() => setMedications(medications.filter((_, idx) => idx !== index))}
                          className="absolute top-2 right-2 text-rose-500 hover:text-rose-700 text-xs font-bold"
                        >
                          Remove
                        </button>
                      )}
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Medicine Name *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. Paracetamol"
                            value={med.medicine_name}
                            onChange={(e) => {
                              const newMeds = [...medications];
                              newMeds[index].medicine_name = e.target.value;
                              setMedications(newMeds);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Dosage *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 500mg"
                            value={med.dosage}
                            onChange={(e) => {
                              const newMeds = [...medications];
                              newMeds[index].dosage = e.target.value;
                              setMedications(newMeds);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Frequency *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 1-0-1"
                            value={med.frequency}
                            onChange={(e) => {
                              const newMeds = [...medications];
                              newMeds[index].frequency = e.target.value;
                              setMedications(newMeds);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Duration *</label>
                          <input
                            type="text"
                            required
                            placeholder="e.g. 7 days"
                            value={med.duration}
                            onChange={(e) => {
                              const newMeds = [...medications];
                              newMeds[index].duration = e.target.value;
                              setMedications(newMeds);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-slate-500 mb-0.5">Instructions</label>
                          <input
                            type="text"
                            placeholder="e.g. After food"
                            value={med.instructions || ""}
                            onChange={(e) => {
                              const newMeds = [...medications];
                              newMeds[index].instructions = e.target.value;
                              setMedications(newMeds);
                            }}
                            className="w-full px-2 py-1.5 border border-slate-200 rounded-lg text-xs bg-white text-slate-800"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedVisit(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={completeLoading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/10 flex items-center justify-center min-w-36"
                >
                  {completeLoading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : "Submit Report"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: VIEW VISIT SUMMARY RECEIPT */}
      {viewingVisitSummary && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-2xl w-full p-6 md:p-8 relative animate-fade-in-scale">
            {/* Close Button */}
            <button
              onClick={() => setViewingVisitSummary(null)}
              className="absolute top-5 right-5 h-8 w-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-400 hover:text-slate-700 flex items-center justify-center transition-colors cursor-pointer z-20"
              aria-label="Close summary"
            >
              <svg className="h-4.5 w-4.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l18 18" />
              </svg>
            </button>

            {/* Header */}
            <div className="border-b border-slate-100 pb-5 mb-6 pr-12">
              <div className="flex items-center gap-3.5">
                <div className="h-12 w-12 rounded-2xl bg-teal-100 text-teal-700 flex items-center justify-center text-lg font-black shadow-xs flex-shrink-0">
                  {(viewingVisitSummary.patient_name || "P").charAt(0)}
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                      Consultation Summary
                    </h3>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-teal-50 text-teal-800 border border-teal-200">
                      {viewingVisitSummary.status}
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">
                    Patient: <strong className="text-slate-800 font-bold">{viewingVisitSummary.patient_name}</strong> &middot; Visit #{viewingVisitSummary.id} &middot; {new Date(viewingVisitSummary.appointment_date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-5 max-h-[62vh] overflow-y-auto pr-1.5">
              {/* Section 1: Symptom Log */}
              <div className="p-4.5 bg-amber-50/70 border border-amber-200/60 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-amber-900 text-xs font-black uppercase tracking-wider">
                  <span>⚠️</span> Patient Reported Symptoms
                </div>
                <p className="text-sm font-semibold text-amber-950 leading-relaxed pl-6">
                  {viewingVisitSummary.symptoms || "No symptoms recorded during pre-booking."}
                </p>
              </div>

              {/* Section 2: Clinical Notes */}
              <div className="p-4.5 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
                <div className="flex items-center gap-2 text-teal-900 text-xs font-black uppercase tracking-wider">
                  <span>🩺</span> Clinical Diagnosis &amp; Physician Notes
                </div>
                <div className="text-sm font-medium text-slate-800 leading-relaxed whitespace-pre-wrap pl-6">
                  {viewingVisitSummary.clinical_notes || "No doctor notes logged."}
                </div>
              </div>

              {/* Section 3: Prescriptions */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-slate-900 text-xs font-black uppercase tracking-wider">
                  <span>💊</span> Prescribed Medications
                </div>
                <div className="border border-slate-200/80 rounded-2xl overflow-hidden shadow-2xs">
                  <table className="w-full text-xs text-left border-collapse">
                    <thead>
                      <tr className="bg-teal-50/80 text-teal-900 border-b border-teal-100 text-[11px] font-extrabold uppercase tracking-wider">
                        <th className="px-4 py-2.5">Medicine</th>
                        <th className="px-4 py-2.5">Dosage</th>
                        <th className="px-4 py-2.5">Frequency</th>
                        <th className="px-4 py-2.5">Duration</th>
                        <th className="px-4 py-2.5">Instructions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-800 bg-white">
                      {viewingVisitSummary.prescriptions && viewingVisitSummary.prescriptions.length > 0 ? (
                        viewingVisitSummary.prescriptions.map((med, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                            <td className="px-4 py-3 font-bold text-slate-900">{med.medicine_name}</td>
                            <td className="px-4 py-3">
                              <span className="px-2 py-0.5 rounded-md font-bold text-xs bg-teal-50 text-teal-800 border border-teal-200/60">
                                {med.dosage}
                              </span>
                            </td>
                            <td className="px-4 py-3 font-medium text-slate-700">{med.frequency}</td>
                            <td className="px-4 py-3 font-medium text-slate-700">{med.duration}</td>
                            <td className="px-4 py-3 text-slate-500 italic">{med.instructions || "As directed"}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={5} className="px-4 py-6 text-center text-slate-400 italic">No prescriptions issued for this visit.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Section 4: AI Patient Friendly Translation */}
              <div className="p-5 bg-teal-50/70 border border-teal-200/80 rounded-2xl space-y-3 shadow-2xs">
                <div className="text-xs font-black text-teal-900 flex items-center gap-1.5 uppercase tracking-wider">
                  <span>🤖</span> AI Patient-Friendly Care Translation
                </div>
                {viewingVisitSummary.ai_post_visit_status === "SUCCESS" || viewingVisitSummary.ai_post_visit_status === "FAILED" ? (
                  <div className="space-y-3 text-sm">
                    <div className="bg-white/80 border border-teal-100 p-3.5 rounded-xl">
                      <span className="text-xs font-bold text-teal-900 block mb-1">Plain Language Summary:</span>
                      <p className="text-slate-800 leading-relaxed font-medium">{viewingVisitSummary.ai_patient_summary}</p>
                    </div>
                    {viewingVisitSummary.ai_follow_up_instructions && (
                      <div className="bg-white/80 border border-teal-100 p-3.5 rounded-xl">
                        <span className="text-xs font-bold text-teal-900 block mb-1">Next Steps &amp; Recovery Plan:</span>
                        <ul className="list-disc pl-5 mt-1.5 text-slate-800 space-y-1.5 font-medium">
                          {(() => {
                            try {
                              const insts = JSON.parse(viewingVisitSummary.ai_follow_up_instructions);
                              return Array.isArray(insts) ? insts.map((i, idx) => <li key={idx} className="pl-1">{i}</li>) : <li className="pl-1">{insts}</li>;
                            } catch {
                              return <li className="pl-1">{viewingVisitSummary.ai_follow_up_instructions}</li>;
                            }
                          })()}
                        </ul>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 italic">
                    AI Patient Translation is compiling in the background.
                  </div>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end pt-5 border-t border-slate-100 mt-5">
              <button
                onClick={() => setViewingVisitSummary(null)}
                className="px-6 py-2.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-sm font-bold rounded-xl shadow-sm transition-all cursor-pointer"
              >
                Close Summary
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
