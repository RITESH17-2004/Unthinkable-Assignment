"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface UserProfile {
  id: number;
  name: string;
  email: string;
  role: string;
  is_active: boolean;
}

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

interface TimeSlot {
  start_time: string;
  end_time: string;
  is_available: boolean;
  is_held: boolean;
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
  doctor_name: string | null;
  specialization: string | null;
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

interface SlotHold {
  id: number;
  doctor_profile_id: number;
  hold_date: string;
  start_time: string;
  end_time: string;
  expires_at: string;
}

export default function PatientDashboard() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // Multi-View View Tab: "dashboard" | "search" | "book" | "appointments" | "details"
  const [activeTab, setActiveTab] = useState<"dashboard" | "search" | "book" | "appointments" | "details">("dashboard");

  // Selection States
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorUser | null>(null);
  const [selectedAppointment, setSelectedAppointment] = useState<Appointment | null>(null);
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null);

  // Booking Flow States
  const [bookingDate, setBookingDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Symptoms & Hold States
  const [activeHold, setActiveHold] = useState<SlotHold | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [symptomsError, setSymptomsError] = useState<string | null>(null);
  const [holdTimer, setHoldTimer] = useState(300); // 5 minutes (300 secs)
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("");
  const [isSpecOpen, setIsSpecOpen] = useState(false);
  const specDropdownRef = useRef<HTMLDivElement | null>(null);
  const [ledgerFilter, setLedgerFilter] = useState<"ALL" | "BOOKED" | "RESCHEDULED" | "CANCELLED">("ALL");

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (specDropdownRef.current && !specDropdownRef.current.contains(e.target as Node)) {
        setIsSpecOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

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

  // Fetch doctors & appointments
  const fetchDoctors = async (token: string | null) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/doctors`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchAppointments = async (token: string | null) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_BASE}/api/v1/appointments/me`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setAppointments(data);
      }
    } catch (e) {
      console.error(e);
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
      const parsedUser: UserProfile = JSON.parse(storedUser);
      if (parsedUser.role.toUpperCase() !== "PATIENT") {
        router.push("/login");
        return;
      }
      setUser(parsedUser);
      fetchDoctors(token);
      fetchAppointments(token);
      fetchGoogleStatus(token);
    } catch (e) {
      localStorage.clear();
      router.push("/login");
    } finally {
      setLoading(false);
    }
  }, [router]);

  // Fetch Available Slots for Date
  useEffect(() => {
    const targetDocId = selectedDoctor?.doctor_profile?.id || reschedulingAppointment?.doctor_profile_id;
    const targetDate = bookingDate;

    if (!targetDocId || !targetDate) {
      setSlots([]);
      return;
    }

    const fetchSlots = async () => {
      setSlotsLoading(true);
      const token = localStorage.getItem("token");
      try {
        const res = await fetch(
          `${API_BASE}/api/v1/appointments/availability?doctor_profile_id=${targetDocId}&query_date=${targetDate}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setSlots(data.slots);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchSlots();
  }, [selectedDoctor, reschedulingAppointment, bookingDate]);

  // Countdown timer for Hold
  useEffect(() => {
    if (activeHold) {
      setHoldTimer(300);
      timerRef.current = setInterval(() => {
        setHoldTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setActiveHold(null);
            alert("Your 5-minute slot reservation has expired. Please select a slot again.");
            if (bookingDate) setBookingDate((d) => d); // trigger reload
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeHold]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  // Handle slot click (Hold slot)
  const handleHoldSlot = async (slot: TimeSlot) => {
    const targetDocId = selectedDoctor?.doctor_profile?.id || reschedulingAppointment?.doctor_profile_id;
    if (!targetDocId || !bookingDate) return;
    
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/v1/appointments/hold", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_profile_id: targetDocId,
          hold_date: bookingDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }),
      });

      if (res.ok) {
        const holdData = await res.json();
        setActiveHold(holdData);
        setSymptomsError(null);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to hold slot. It might be already held or booked.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Confirm booking or reschedule
  const handleConfirmAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    setSymptomsError(null);

    // Validate symptoms
    const cleanSymptoms = symptoms.trim();
    if (!reschedulingAppointment) {
      if (!cleanSymptoms) {
        setSymptomsError("Symptom details are required to complete the booking.");
        return;
      }
      if (cleanSymptoms.length < 10) {
        setSymptomsError("Symptom log is too short. Please provide at least 10 characters describing your condition.");
        return;
      }
      if (cleanSymptoms.length > 1000) {
        setSymptomsError("Symptom description must not exceed 1000 characters.");
        return;
      }
    }

    if (!activeHold) return;
    setBookingLoading(true);
    const token = localStorage.getItem("token");

    try {
      if (reschedulingAppointment) {
        // Reschedule endpoint
        const res = await fetch(`${API_BASE}/api/v1/appointments/${reschedulingAppointment.id}/reschedule`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            new_hold_id: activeHold.id,
          }),
        });

        if (res.ok) {
          alert("Appointment rescheduled successfully!");
          resetStateAndRedirect();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.detail || "Rescheduling failed.");
        }
      } else {
        // Normal Booking
        const res = await fetch(`${API_BASE}/api/v1/appointments/book`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            hold_id: activeHold.id,
            symptoms: cleanSymptoms,
          }),
        });

        if (res.ok) {
          alert("Appointment booked successfully!");
          resetStateAndRedirect();
        } else {
          const err = await res.json().catch(() => ({}));
          alert(err.detail || "Booking failed.");
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBookingLoading(false);
    }
  };

  const resetStateAndRedirect = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setActiveHold(null);
    setSymptoms("");
    setSelectedDoctor(null);
    setReschedulingAppointment(null);
    setBookingDate("");
    setSlots([]);
    fetchAppointments(localStorage.getItem("token"));
    setActiveTab("appointments");
  };

  // Cancel Appointment
  const handleCancelAppointment = async (appId: number) => {
    if (!confirm("Are you sure you want to cancel this appointment?")) return;
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/v1/appointments/${appId}/cancel`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        alert("Appointment cancelled successfully!");
        fetchAppointments(token);
      } else {
        alert("Failed to cancel appointment.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Doctor Finder Filter logic
  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch = doc.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          doc.doctor_profile?.specialization.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesSpec = specializationFilter === "" || doc.doctor_profile?.specialization === specializationFilter;
    return doc.is_active && matchesSearch && matchesSpec;
  });

  // Extract all unique specializations for the filter buttons
  const specializations = Array.from(
    new Set(doctors.map((d) => d.doctor_profile?.specialization).filter((s): s is string => Boolean(s)))
  );

  // Appointments ledger filters
  const filteredAppointments = appointments.filter((app) => {
    if (ledgerFilter === "ALL") return true;
    return app.status === ledgerFilter;
  });

  const upcomingAppointments = appointments.filter((app) => app.status !== "CANCELLED" && new Date(app.appointment_date) >= new Date());

  const formatTimer = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? "0" : ""}${remainingSecs}`;
  };

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-medium">Loading your health portal...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* ── Header ── */}
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
                  { key: "dashboard", label: "Dashboard" },
                  { key: "search",    label: "Find Specialist" },
                  { key: "appointments", label: "My Ledger" },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => { setActiveTab(tab.key as "dashboard" | "search" | "appointments"); setSelectedAppointment(null); }}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
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

            {/* User info + logout */}
            <div className="flex items-center gap-3">
              <div className="hidden sm:flex items-center gap-2 bg-slate-50 border border-slate-200/80 rounded-full py-1 pl-1 pr-3 shadow-2xs">
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-500 to-teal-700 flex items-center justify-center text-white text-xs font-black shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">{user.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-teal-100/70 text-teal-800 border border-teal-200/60">
                    {user.role.toLowerCase()}
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

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow w-full">
        
        {/* Mobile Navigation */}
        <div className="flex md:hidden bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm mb-6 gap-1">
          {[
            { key: "dashboard", label: "Dashboard" },
            { key: "search",    label: "Find Doctor" },
            { key: "appointments", label: "Ledger" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => { setActiveTab(tab.key as "dashboard" | "search" | "appointments"); setSelectedAppointment(null); }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab.key ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6 animate-fade-in">
            {/* Welcome Banner */}
            <div className="relative overflow-hidden bg-gradient-to-r from-teal-600 to-cyan-600 rounded-2xl p-6 md:p-8 shadow-lg text-white">
              <div className="absolute right-0 top-0 h-full w-1/3 opacity-10">
                <svg viewBox="0 0 200 200" fill="none" className="h-full w-full">
                  <circle cx="160" cy="40" r="120" stroke="white" strokeWidth="40" />
                </svg>
              </div>
              <div className="relative flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                  <p className="text-teal-100 text-sm font-semibold">Good day,</p>
                  <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-0.5" style={{ fontFamily: 'var(--font-outfit)' }}>{user.name}</h1>
                  <p className="text-teal-100/80 text-sm mt-1.5">Here&apos;s a summary of your upcoming medical visits.</p>
                </div>
                <button
                  onClick={() => setActiveTab("search")}
                  className="flex items-center gap-2 bg-white/20 hover:bg-white/30 active:scale-95 border border-white/30 text-white font-bold text-sm px-5 py-2.5 rounded-xl backdrop-blur-sm transition-all cursor-pointer"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  New Visit
                </button>
              </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Upcoming Visits</div>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">{upcomingAppointments.length}</div>
                </div>
              </div>
              <div className="card p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-violet-50 border border-violet-100 flex items-center justify-center text-violet-600 flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Next Appointment</div>
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {upcomingAppointments.length > 0
                      ? new Date(upcomingAppointments[0].appointment_date).toLocaleDateString("en-US", { month: "short", day: "numeric" })
                      : "None scheduled"}
                  </div>
                </div>
              </div>
              <div className="card p-5 flex items-center gap-4">
                <div className="h-11 w-11 rounded-xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-cyan-600 flex-shrink-0">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Total Records</div>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">{appointments.length}</div>
                </div>
              </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left widgets */}
              <div className="lg:col-span-2 space-y-5">
                <div className="card overflow-hidden">
                  <div className="px-5 py-4 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-sm font-bold text-slate-900">Upcoming Visits</h3>
                    <button onClick={() => setActiveTab("appointments")} className="text-xs font-bold text-teal-600 hover:text-teal-700 cursor-pointer">View All →</button>
                  </div>
                  <div className="divide-y divide-slate-100">
                    {upcomingAppointments.length === 0 ? (
                      <p className="text-sm text-slate-400 italic py-8 text-center">No upcoming consultations scheduled.</p>
                    ) : (
                      upcomingAppointments.slice(0, 3).map((app) => (
                        <div key={app.id} className="px-5 py-4 flex justify-between items-center gap-4 hover:bg-slate-50/70 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-black flex-shrink-0">
                              {(app.doctor_name || "D").charAt(0)}
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-slate-900 leading-tight">{app.doctor_name}</h4>
                              <p className="text-xs text-slate-500 mt-0.5">{app.specialization}</p>
                              <div className="text-xs text-slate-400 mt-0.5">
                                {new Date(app.appointment_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} &middot; {app.start_time.substring(0, 5)}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="badge badge-success">
                              {app.status.toLowerCase()}
                            </span>
                            <button
                              onClick={() => { setSelectedAppointment(app); setActiveTab("details"); }}
                              className="px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer transition-colors"
                            >
                              View
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right widgets */}
              <div className="lg:col-span-1 space-y-4">
                {/* Active prescriptions widget */}
                <div className="card p-5 text-center space-y-3">
                  <div className="h-11 w-11 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 mx-auto">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Medication Reminders</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-xs">
                    Your active prescriptions and physician follow-up summaries will appear here once your medical visits are logged.
                  </p>
                </div>

                {/* Google Calendar Connection Widget */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center text-teal-600 font-bold text-lg shadow-sm">
                      📅
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">Google Calendar</h3>
                      <p className="text-[10px] text-slate-400">Sync visits & slot alerts</p>
                    </div>
                  </div>
                  
                  {!googleEnabled ? (
                    <div className="space-y-3">
                      <div className="p-3 bg-amber-50 border border-amber-150 rounded-xl text-[11px] text-amber-800 leading-relaxed font-medium">
                        ⚠️ <strong>Demo Mode Notice:</strong> Google Calendar Integration is unconfigured in this deployment environment. Set OAuth keys in <code>.env</code> to connect.
                      </div>
                      <button
                        disabled
                        className="w-full py-2 bg-slate-100 text-slate-400 rounded-xl text-xs font-bold transition-all cursor-not-allowed"
                      >
                        Calendar Disabled
                      </button>
                    </div>
                  ) : googleLoading ? (
                    <div className="flex items-center justify-center py-2">
                      <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                  ) : googleConnected ? (
                    <div className="space-y-3">
                      <div className="p-2.5 bg-emerald-50/50 border border-emerald-100 rounded-xl flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="text-[11px] font-bold text-emerald-800">Connected</span>
                        </div>
                        <span className="text-[10px] text-emerald-700 truncate max-w-[140px]" title={googleEmail}>
                          {googleEmail}
                        </span>
                      </div>
                      <button
                        onClick={handleDisconnectGoogle}
                        className="w-full py-2 border border-slate-200 hover:bg-slate-50 text-slate-600 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Disconnect Calendar
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[11px] text-slate-500 leading-relaxed">
                        Authorize MediFlow to automatically add booked appointments to your personal Google Calendar.
                      </p>
                      <button
                        onClick={handleConnectGoogle}
                        className="w-full py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-bold shadow-md shadow-teal-600/10 transition-all flex items-center justify-center gap-2 cursor-pointer"
                      >
                        <span>Connect Google Calendar</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: FIND SPECIALIST */}
        {activeTab === "search" && (
          <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div>
              <h2 className="text-xl font-black text-slate-900" style={{ fontFamily: 'var(--font-outfit)' }}>Find a Specialist</h2>
              <p className="text-xs text-slate-400 mt-1">Browse active doctor profiles and book a consultation.</p>
            </div>

            {/* Search & filters row */}
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-grow">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by specialist name or specialty..."
                  className="input-field"
                  style={{ paddingLeft: '2.6rem' }}
                />
              </div>
              {/* Custom Specialization Dropdown */}
              <div className="relative sm:w-64" ref={specDropdownRef}>
                <button
                  type="button"
                  onClick={() => setIsSpecOpen(!isSpecOpen)}
                  className={`w-full input-field flex items-center justify-between gap-2 text-left cursor-pointer transition-all ${
                    isSpecOpen ? "border-teal-500 ring-2 ring-teal-500/20" : ""
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="h-2 w-2 rounded-full bg-teal-500 flex-shrink-0"></span>
                    <span className="font-semibold text-slate-800 text-sm truncate">
                      {specializationFilter || "All Specializations"}
                    </span>
                  </div>
                  <svg
                    className={`h-4 w-4 text-slate-400 transition-transform duration-200 flex-shrink-0 ${
                      isSpecOpen ? "rotate-180 text-teal-600" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Dropdown Menu */}
                {isSpecOpen && (
                  <div className="absolute right-0 top-full mt-2 w-full sm:w-72 bg-white rounded-2xl shadow-xl border border-slate-100 p-1.5 z-30 animate-fade-in-scale max-h-64 overflow-y-auto">
                    <button
                      type="button"
                      onClick={() => {
                        setSpecializationFilter("");
                        setIsSpecOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors cursor-pointer ${
                        specializationFilter === ""
                          ? "bg-teal-50 text-teal-800 font-extrabold"
                          : "text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="h-6 w-6 rounded-lg bg-teal-100 text-teal-700 flex items-center justify-center text-xs">
                          ✦
                        </div>
                        <span>All Specializations</span>
                      </div>
                      {specializationFilter === "" && (
                        <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>

                    <div className="my-1 border-t border-slate-100"></div>

                    {specializations.map((spec, idx) => {
                      const count = doctors.filter(d => (d.doctor_profile?.specialization || "General") === spec).length;
                      const isSelected = specializationFilter === spec;

                      return (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => {
                            setSpecializationFilter(spec);
                            setIsSpecOpen(false);
                          }}
                          className={`w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-colors cursor-pointer ${
                            isSelected
                              ? "bg-teal-50 text-teal-800 font-bold"
                              : "text-slate-700 hover:bg-slate-50"
                          }`}
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <div className="h-6 w-6 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-[11px] font-bold flex-shrink-0">
                              {spec.charAt(0)}
                            </div>
                            <span className="truncate">{spec}</span>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-slate-100 text-slate-500">
                              {count} doc{count !== 1 ? 's' : ''}
                            </span>
                            {isSelected && (
                              <svg className="h-4 w-4 text-teal-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Doctors Grid */}
            {filteredDoctors.length === 0 ? (
              <div className="text-center py-16 text-slate-400 italic">
                <svg className="h-12 w-12 text-slate-200 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                No active specialist profiles match your search.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                {filteredDoctors.map((doc) => (
                  <div key={doc.id} className="card card-hover p-5 flex flex-col justify-between group cursor-default">
                    <div className="space-y-4">
                      <div className="flex items-start gap-3">
                        <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-teal-400 to-teal-600 flex items-center justify-center text-white text-base font-black flex-shrink-0 shadow-sm">
                          {(doc.name || "D").charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <h4 className="font-bold text-slate-900 text-sm leading-tight">{doc.name}</h4>
                          <span className="inline-block mt-1 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-teal-50 text-teal-700 rounded-md border border-teal-100">
                            {doc.doctor_profile?.specialization || "General"}
                          </span>
                        </div>
                      </div>

                      <p className="text-xs text-slate-400">
                        <span className="font-semibold text-slate-600">{doc.doctor_profile?.slot_duration} min</span> per consultation
                      </p>
                      
                      {doc.doctor_profile?.bio ? (
                        <p className="text-xs text-slate-500 leading-relaxed line-clamp-2 italic">&ldquo;{doc.doctor_profile.bio}&rdquo;</p>
                      ) : (
                        <p className="text-xs text-slate-300 italic">No bio available.</p>
                      )}
                    </div>

                    <div className="mt-5 pt-4 border-t border-slate-100">
                      <button
                        onClick={() => {
                          setSelectedDoctor(doc);
                          setReschedulingAppointment(null);
                          setActiveTab("book");
                        }}
                        className="w-full bg-teal-600 hover:bg-teal-700 active:scale-95 text-white font-bold text-xs py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
                      >
                        Book Consultation
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 3: SCHEDULER & BOOKING WORKFLOW */}
        {activeTab === "book" && (selectedDoctor || reschedulingAppointment) && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
            
            {/* Scheduler Settings column */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <button
                  onClick={() => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setActiveHold(null);
                    setReschedulingAppointment(null);
                    setSelectedDoctor(null);
                    setActiveTab(reschedulingAppointment ? "appointments" : "search");
                  }}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-teal-600 mb-5 group cursor-pointer transition-colors"
                >
                  <svg className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Back
                </button>

                <h3 className="text-lg font-bold text-slate-900 mb-1">
                  {reschedulingAppointment ? "Reschedule Appointment" : "Consultation Booking"}
                </h3>
                <p className="text-xs text-slate-400 mb-6">
                  {reschedulingAppointment
                    ? `Move your visit with Dr. ${reschedulingAppointment.doctor_name} to a new timing.`
                    : `Schedule an appointment slot with Dr. ${selectedDoctor?.name}.`}
                </p>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Clinic Specialist</label>
                    <div className="px-3 py-2 bg-slate-50 rounded-xl text-sm font-semibold text-slate-800">
                      {reschedulingAppointment ? reschedulingAppointment.doctor_name : selectedDoctor?.name}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-slate-600 mb-1">Target Date</label>
                    <input
                      type="date"
                      min={new Date().toISOString().split("T")[0]}
                      value={bookingDate}
                      onChange={(e) => {
                        if (timerRef.current) clearInterval(timerRef.current);
                        setActiveHold(null);
                        setBookingDate(e.target.value);
                      }}
                      className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-850 focus:outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Specialist clinic description */}
              {!reschedulingAppointment && selectedDoctor?.doctor_profile && (
                <div className="bg-teal-50/20 border border-teal-50 rounded-2xl p-6 shadow-sm">
                  <h4 className="text-sm font-bold text-teal-950">About {selectedDoctor.name}</h4>
                  <p className="text-xs text-teal-800 font-semibold mt-1">Specialization: {selectedDoctor.doctor_profile.specialization}</p>
                  {selectedDoctor.doctor_profile.bio && (
                    <p className="text-xs text-slate-500 mt-3 leading-relaxed italic">"{selectedDoctor.doctor_profile.bio}"</p>
                  )}
                </div>
              )}
            </div>

            {/* Availability Slots Grid and booking checkout form */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Date Selected slot picker */}
              {bookingDate ? (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-base font-bold text-slate-900 mb-1">Available Timings</h3>
                  <p className="text-xs text-slate-400 mb-6">Select a slot to hold it while reviewing visit details.</p>

                  {slotsLoading ? (
                    <div className="py-12 text-center flex items-center justify-center gap-2 text-xs text-slate-450">
                      <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                      Generating doctor slots...
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="text-center py-12 text-xs text-slate-400 italic">
                      No timeslots configured. Doctor may be off duty or on leave on this date.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                      {slots.map((slot, index) => {
                        const isSelected = activeHold?.start_time === slot.start_time;
                        const timeStr = slot.start_time.substring(0, 5);

                        if (slot.is_available) {
                          return (
                            <button
                              key={index}
                              onClick={() => handleHoldSlot(slot)}
                              className={`p-3 border rounded-xl text-sm font-bold text-center transition-all ${
                                isSelected
                                  ? "bg-teal-600 border-teal-600 text-white shadow-md"
                                  : "border-emerald-100 bg-emerald-50/20 text-emerald-800 hover:bg-emerald-50"
                              }`}
                            >
                              {timeStr}
                            </button>
                          );
                        } else if (slot.is_held) {
                          return (
                            <button
                              key={index}
                              disabled
                              className="p-3 border border-amber-100 rounded-xl bg-amber-50/10 text-amber-600 text-sm font-medium text-center opacity-60 cursor-not-allowed"
                            >
                              {timeStr} (Held)
                            </button>
                          );
                        } else {
                          return (
                            <button
                              key={index}
                              disabled
                              className="p-3 border border-slate-100 rounded-xl bg-slate-50 text-slate-400 text-sm text-center cursor-not-allowed"
                            >
                              {timeStr} (Booked)
                            </button>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl p-12 text-center text-slate-450 italic shadow-sm">
                  Select a target consultation date on the calendar.
                </div>
              )}

              {/* Symptom Input Form & Confirmation Details Checkout */}
              {activeHold && (
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm space-y-6 animate-slide-up">
                  
                  {/* Reservation warning countdown */}
                  <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl flex justify-between items-center text-amber-900 text-xs font-bold">
                    <span className="flex items-center gap-1.5">
                      <svg className="h-4.5 w-4.5 text-amber-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Temporary Slot Reservation Locked
                    </span>
                    <span className="font-mono text-sm bg-white px-2 py-0.5 rounded border border-amber-200">
                      {formatTimer(holdTimer)}
                    </span>
                  </div>

                  {/* Summary receipt review */}
                  <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 space-y-2 text-xs">
                    <h4 className="font-bold text-slate-800 uppercase tracking-wider mb-2">Booking Summary Review</h4>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Doctor Specialist:</span>
                      <span className="font-bold text-slate-900">
                        {reschedulingAppointment ? reschedulingAppointment.doctor_name : selectedDoctor?.name}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Schedule Date:</span>
                      <span className="font-bold text-slate-900">{new Date(activeHold.hold_date).toLocaleDateString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Selected Timings:</span>
                      <span className="font-bold text-teal-800">
                        {activeHold.start_time.substring(0, 5)} - {activeHold.end_time.substring(0, 5)}
                      </span>
                    </div>
                  </div>

                  {/* Symptom logger form */}
                  <form onSubmit={handleConfirmAppointment} className="space-y-4">
                    {symptomsError && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-800 text-xs font-medium">
                        {symptomsError}
                      </div>
                    )}

                    {!reschedulingAppointment ? (
                      <div>
                        <label className="block text-xs font-bold text-slate-600 mb-1">Pre-Visit Symptom Log</label>
                        <textarea
                          required
                          value={symptoms}
                          onChange={(e) => setSymptoms(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                          placeholder="Please describe your current symptoms in detail (minimum 10 characters)..."
                        />
                      </div>
                    ) : (
                      <div className="p-3 bg-indigo-50/30 border border-indigo-100 rounded-xl text-xs text-indigo-955">
                        <strong>Rescheduling Notice</strong>: Your pre-visit symptom logs will remain linked to this appointment.
                      </div>
                    )}

                    <div className="flex justify-end pt-2">
                      <button
                        type="submit"
                        disabled={bookingLoading}
                        className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-6 py-2.5 rounded-xl shadow-md shadow-teal-600/10 flex items-center justify-center min-w-36"
                      >
                        {bookingLoading ? (
                          <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        ) : reschedulingAppointment ? "Save Reschedule" : "Confirm Booking"}
                      </button>
                    </div>
                  </form>

                </div>
              )}
            </div>

          </div>
        )}

        {/* TAB 4: MY APPOINTMENTS LEDGER */}
        {activeTab === "appointments" && (
          <div className="card overflow-hidden animate-fade-in">
            {/* Header filters */}
            <div className="px-6 py-4.5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900" style={{ fontFamily: 'var(--font-outfit)' }}>Appointments Ledger</h2>
                <p className="text-xs text-slate-400 mt-0.5">Filter and manage your scheduled clinical history.</p>
              </div>

              {/* Filter pills */}
              <div className="flex flex-wrap gap-1.5">
                {(["ALL", "BOOKED", "RESCHEDULED", "CANCELLED"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setLedgerFilter(filter)}
                    className={`px-3.5 py-1.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${
                      ledgerFilter === filter
                        ? "bg-teal-600 border-teal-600 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-16 text-slate-400 italic">
                No matching appointments found.
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left divide-y divide-slate-100">
                  <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-5 py-3.5 whitespace-nowrap">Specialist</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Specialization</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Date</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Slot</th>
                      <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                      <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredAppointments.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-teal-100 flex items-center justify-center text-teal-700 text-xs font-black flex-shrink-0">
                              {(app.doctor_name || "D").charAt(0)}
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{app.doctor_name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-700 whitespace-nowrap">{app.specialization}</td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">
                          {new Date(app.appointment_date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                        </td>
                        <td className="px-5 py-3.5 text-sm font-mono text-slate-700 whitespace-nowrap">
                          {app.start_time.substring(0, 5)} – {app.end_time.substring(0, 5)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`badge ${
                            app.status === "BOOKED" ? "badge-success" :
                            app.status === "RESCHEDULED" ? "badge-info" :
                            "badge-danger"
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => { setSelectedAppointment(app); setActiveTab("details"); }}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 active:scale-95 transition-all cursor-pointer"
                            >
                              Details
                            </button>

                            {app.status !== "CANCELLED" && (
                              <>
                                <button
                                  onClick={() => {
                                    setReschedulingAppointment(app);
                                    setSelectedDoctor(null);
                                    setBookingDate(app.appointment_date);
                                    setActiveTab("book");
                                  }}
                                  className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 active:scale-95 transition-all cursor-pointer"
                                >
                                  Reschedule
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

        {/* TAB 5: APPOINTMENT DETAILS */}
        {activeTab === "details" && selectedAppointment && (
          <div className="max-w-2xl mx-auto card overflow-hidden animate-fade-in">
            {/* Header */}
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/70 flex justify-between items-center">
              <div>
                <button
                  onClick={() => setActiveTab("appointments")}
                  className="inline-flex items-center gap-2 text-xs font-bold text-slate-500 hover:text-teal-600 mb-4 group cursor-pointer transition-colors"
                >
                  <svg className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  <span>Back to Ledger</span>
                </button>
                <h3 className="text-lg font-bold text-slate-900">Clinical Visit Receipt</h3>
                <p className="text-xs text-slate-400 mt-0.5">Booking ID: #CS-{selectedAppointment.id}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-extrabold tracking-wider uppercase ${
                selectedAppointment.status === "BOOKED" ? "text-emerald-700 bg-emerald-50" :
                selectedAppointment.status === "RESCHEDULED" ? "text-indigo-700 bg-indigo-50" :
                "text-rose-700 bg-rose-50"
              }`}>
                {selectedAppointment.status}
              </span>
            </div>

            {/* Body Info */}
            <div className="p-6 md:p-8 space-y-6">
              
              {/* Doctor and timings metadata */}
              <div className="grid grid-cols-2 gap-6 text-sm pb-6 border-b border-slate-50">
                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Physician</div>
                  <div className="font-extrabold text-slate-900 mt-1">{selectedAppointment.doctor_name}</div>
                  <div className="text-xs text-slate-505 mt-0.5">{selectedAppointment.specialization}</div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Timings</div>
                  <div className="font-bold text-slate-900 mt-1">
                    {new Date(selectedAppointment.appointment_date).toLocaleDateString()}
                  </div>
                  <div className="text-xs text-teal-800 font-bold mt-0.5">
                    {selectedAppointment.start_time.substring(0, 5)} - {selectedAppointment.end_time.substring(0, 5)}
                  </div>
                </div>
              </div>

              {/* Patient details */}
              <div className="pb-6 border-b border-slate-50 text-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide">Patient</div>
                <div className="font-semibold text-slate-800 mt-1">{selectedAppointment.patient_name}</div>
              </div>

              {/* Symptom logs details */}
              <div className="text-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-2">Submitted Symptoms Log</div>
                <div className="p-4 bg-slate-50/50 border border-slate-100 rounded-xl text-slate-700 leading-relaxed">
                  {selectedAppointment.symptoms || <span className="text-slate-400 italic">No symptom details logged.</span>}
                </div>
              </div>

              {/* AI Pre-Visit Insight */}
              <div className="p-4 border border-teal-50 bg-teal-50/10 rounded-xl text-xs text-teal-955 space-y-2">
                <div className="flex justify-between items-center font-bold">
                  <span className="flex items-center gap-1">🤖 AI Pre-Visit Insight</span>
                  {selectedAppointment.ai_pre_visit_status === "SUCCESS" || selectedAppointment.ai_pre_visit_status === "FAILED" ? (
                    <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider ${
                      selectedAppointment.ai_urgency_level === "HIGH" ? "bg-rose-100 text-rose-800" :
                      selectedAppointment.ai_urgency_level === "MEDIUM" ? "bg-amber-100 text-amber-800" :
                      "bg-emerald-100 text-emerald-800"
                    }`}>
                      {selectedAppointment.ai_urgency_level} URGENCY
                    </span>
                  ) : (
                    <span className="text-[10px] text-slate-400 font-bold animate-pulse">COMPILING...</span>
                  )}
                </div>

                {selectedAppointment.ai_pre_visit_status === "SUCCESS" || selectedAppointment.ai_pre_visit_status === "FAILED" ? (
                  <div className="space-y-2">
                    <div>
                      <span className="font-bold text-slate-500">Chief Complaint Summary:</span>
                      <p className="text-slate-800 font-medium mt-0.5">"{selectedAppointment.ai_chief_complaint}"</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-slate-500 leading-relaxed">
                    AI symptom logs and urgency categorization is compiling in the background...
                  </p>
                )}
              </div>

              {/* Doctor Clinical Notes & AI Post-Visit Summary */}
              {selectedAppointment.status === "COMPLETED" && (
                <>
                  <div className="text-sm border-t border-slate-50 pt-4">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1">Doctor's Clinical Notes</div>
                    <div className="p-3 bg-slate-50/60 rounded-xl text-slate-700 whitespace-pre-wrap">{selectedAppointment.clinical_notes}</div>
                  </div>

                  <div className="text-sm">
                    <div className="text-xs font-bold text-slate-400 uppercase tracking-wide mb-1.5">Prescribed Medications</div>
                    <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
                      <table className="w-full text-xs text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-100/80 text-slate-500 border-b border-slate-200/50">
                            <th className="px-3 py-2 font-bold">Medicine</th>
                            <th className="px-3 py-2 font-bold">Dosage</th>
                            <th className="px-3 py-2 font-bold">Frequency</th>
                            <th className="px-3 py-2 font-bold">Duration</th>
                            <th className="px-3 py-2 font-bold">Instructions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {selectedAppointment.prescriptions && selectedAppointment.prescriptions.length > 0 ? (
                            selectedAppointment.prescriptions.map((med, idx) => (
                              <tr key={idx}>
                                <td className="px-3 py-2 font-semibold text-slate-900">{med.medicine_name}</td>
                                <td className="px-3 py-2">{med.dosage}</td>
                                <td className="px-3 py-2">{med.frequency}</td>
                                <td className="px-3 py-2">{med.duration}</td>
                                <td className="px-3 py-2 text-slate-500 italic">{med.instructions || "None"}</td>
                              </tr>
                            ))
                          ) : (
                            <tr>
                              <td colSpan={5} className="px-3 py-3 text-center text-slate-400 italic">No prescriptions issued.</td>
                            </tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="p-4 border border-indigo-50 bg-indigo-50/10 rounded-xl text-xs text-indigo-950 space-y-2">
                    <div className="font-bold flex items-center gap-1 text-indigo-900">
                      <span>🤖</span> AI Patient-Friendly Translation
                    </div>
                    {selectedAppointment.ai_post_visit_status === "SUCCESS" || selectedAppointment.ai_post_visit_status === "FAILED" ? (
                      <div className="space-y-2">
                        <div>
                          <span className="font-bold text-slate-500">Simple Explanation:</span>
                          <p className="text-slate-700 leading-relaxed mt-0.5">{selectedAppointment.ai_patient_summary}</p>
                        </div>
                        <div>
                          <span className="font-bold text-slate-500">Care Instructions:</span>
                          <ul className="list-disc pl-5 mt-1.5 text-slate-700 space-y-1.5">
                            {selectedAppointment.ai_follow_up_instructions &&
                              (() => {
                                try {
                                  const insts = JSON.parse(selectedAppointment.ai_follow_up_instructions);
                                  return Array.isArray(insts) ? insts.map((i, idx) => <li key={idx} className="pl-1">{i}</li>) : <li className="pl-1">{insts}</li>;
                                } catch {
                                  return <li className="pl-1">{selectedAppointment.ai_follow_up_instructions}</li>;
                                }
                              })()
                            }
                          </ul>
                        </div>
                      </div>
                    ) : (
                      <p className="text-slate-500 leading-relaxed">
                        AI patient-friendly translation is compiling in the background...
                      </p>
                    )}
                  </div>
                </>
              )}

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
