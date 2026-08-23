"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";

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
  const [ledgerFilter, setLedgerFilter] = useState<"ALL" | "BOOKED" | "RESCHEDULED" | "CANCELLED">("ALL");

  // Fetch doctors & appointments
  const fetchDoctors = async (token: string | null) => {
    if (!token) return;
    try {
      const res = await fetch("http://localhost:8000/api/v1/doctors", {
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
      const res = await fetch("http://localhost:8000/api/v1/appointments/me", {
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
          `http://localhost:8000/api/v1/appointments/availability?doctor_profile_id=${targetDocId}&query_date=${targetDate}`,
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
      const res = await fetch("http://localhost:8000/api/v1/appointments/hold", {
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
        const res = await fetch(`http://localhost:8000/api/v1/appointments/${reschedulingAppointment.id}/reschedule`, {
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
        const res = await fetch("http://localhost:8000/api/v1/appointments/book", {
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
      const res = await fetch(`http://localhost:8000/api/v1/appointments/${appId}/cancel`, {
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
    new Set(doctors.map((d) => d.doctor_profile?.specialization).filter(Boolean))
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
      
      {/* Header */}
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

            <nav className="hidden md:flex gap-6 text-sm font-bold">
              <button
                onClick={() => { setActiveTab("dashboard"); setSelectedAppointment(null); }}
                className={`py-5 border-b-2 transition-all ${activeTab === "dashboard" ? "border-teal-600 text-teal-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                Dashboard
              </button>
              <button
                onClick={() => { setActiveTab("search"); setSelectedAppointment(null); }}
                className={`py-5 border-b-2 transition-all ${activeTab === "search" ? "border-teal-600 text-teal-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                Find Specialist
              </button>
              <button
                onClick={() => { setActiveTab("appointments"); setSelectedAppointment(null); }}
                className={`py-5 border-b-2 transition-all ${activeTab === "appointments" ? "border-teal-600 text-teal-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}
              >
                My Ledger
              </button>
            </nav>
            
            <div className="flex items-center gap-4">
              <div className="text-right hidden sm:block">
                <div className="text-sm font-semibold text-slate-800">{user.name}</div>
                <div className="text-xs text-slate-400 capitalize">{user.role.toLowerCase()}</div>
              </div>
              
              <button
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 rounded-lg bg-white hover:bg-slate-50 transition-all duration-200 active:scale-[0.98]"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-grow w-full">
        
        {/* Mobile Navigation Header Tabs */}
        <div className="flex md:hidden bg-white border border-slate-200 rounded-xl p-1 shadow-sm mb-6 justify-around text-xs font-bold">
          <button onClick={() => { setActiveTab("dashboard"); setSelectedAppointment(null); }} className={`px-3 py-2 rounded-lg ${activeTab === "dashboard" ? "bg-teal-600 text-white" : "text-slate-600"}`}>Dashboard</button>
          <button onClick={() => { setActiveTab("search"); setSelectedAppointment(null); }} className={`px-3 py-2 rounded-lg ${activeTab === "search" ? "bg-teal-600 text-white" : "text-slate-600"}`}>Find Doctor</button>
          <button onClick={() => { setActiveTab("appointments"); setSelectedAppointment(null); }} className={`px-3 py-2 rounded-lg ${activeTab === "appointments" ? "bg-teal-600 text-white" : "text-slate-600"}`}>Ledger</button>
        </div>

        {/* TAB 1: OVERVIEW DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-8 animate-fade-in">
            {/* Banner */}
            <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Welcome, {user.name}</h1>
                <p className="text-slate-500 text-sm mt-1">Here is a quick summary of your upcoming medical logs and consultation reports.</p>
              </div>
              <button
                onClick={() => setActiveTab("search")}
                className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-5 py-2.5 rounded-xl shadow-md shadow-teal-600/10 transition-all cursor-pointer"
              >
                Schedule New Visit
              </button>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Scheduled Consultations</div>
                <div className="text-2xl font-black text-slate-900 mt-2">{upcomingAppointments.length} visits</div>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Closest Visit Date</div>
                <div className="text-lg font-bold text-teal-800 mt-2">
                  {upcomingAppointments.length > 0
                    ? new Date(upcomingAppointments[0].appointment_date).toLocaleDateString()
                    : "None scheduled"}
                </div>
              </div>
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Registered Ledger Items</div>
                <div className="text-2xl font-black text-slate-900 mt-2">{appointments.length} total</div>
              </div>
            </div>

            {/* Layout Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Left widgets */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
                  <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex justify-between items-center">
                    <h3 className="text-base font-bold text-slate-900">Upcoming Visits</h3>
                    <button onClick={() => setActiveTab("appointments")} className="text-xs font-bold text-teal-600 hover:text-teal-700">View Ledger</button>
                  </div>
                  <div className="p-6 divide-y divide-slate-100">
                    {upcomingAppointments.length === 0 ? (
                      <p className="text-sm text-slate-450 italic py-4 text-center">No upcoming consultations found.</p>
                    ) : (
                      upcomingAppointments.slice(0, 3).map((app) => (
                        <div key={app.id} className="py-4 flex justify-between items-center first:pt-0 last:pb-0 gap-4">
                          <div>
                            <h4 className="font-bold text-slate-900">{app.doctor_name}</h4>
                            <p className="text-xs text-slate-500 mt-0.5">{app.specialization}</p>
                            <div className="text-xs text-slate-400 mt-1">
                              {new Date(app.appointment_date).toLocaleDateString()} at {app.start_time.substring(0, 5)}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <span className="px-2 py-0.5 rounded text-xs font-bold bg-emerald-50 text-emerald-800 capitalize">
                              {app.status.toLowerCase()}
                            </span>
                            <button
                              onClick={() => { setSelectedAppointment(app); setActiveTab("details"); }}
                              className="px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 rounded-lg hover:bg-slate-50"
                            >
                              Details
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Right widgets */}
              <div className="lg:col-span-1 space-y-6">
                {/* Active prescriptions widget */}
                <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm flex flex-col items-center text-center">
                  <div className="h-12 w-12 rounded-full bg-teal-50 flex items-center justify-center text-teal-600 mb-4 shadow-sm">
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                  </div>
                  <h3 className="text-base font-bold text-slate-900">Medication Reminders</h3>
                  <p className="text-xs text-slate-400 mt-2 leading-relaxed max-w-xs">
                    Your active prescriptions and physician follow-up summaries will appear here once your medical visits are logged.
                  </p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* TAB 2: FIND SPECIALIST */}
        {activeTab === "search" && (
          <div className="space-y-6 animate-fade-in">
            {/* Find Specialist Header */}
            <div>
              <h2 className="text-xl font-bold text-slate-900">Find Specialist</h2>
              <p className="text-xs text-slate-400 mt-1">Search active doctor profiles and filter by medical specializations.</p>
            </div>

            {/* Search & filters row */}
            <div className="flex flex-col sm:flex-row gap-4 bg-white border border-slate-100 p-4 rounded-xl shadow-sm">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by doctor name or specialty..."
                className="flex-grow px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800 focus:outline-none"
              />
              <select
                value={specializationFilter}
                onChange={(e) => setSpecializationFilter(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm bg-white text-slate-800"
              >
                <option value="">All Specializations</option>
                {specializations.map((spec, idx) => (
                  <option key={idx} value={spec}>{spec}</option>
                ))}
              </select>
            </div>

            {/* Doctors Grid */}
            {filteredDoctors.length === 0 ? (
              <div className="text-center py-16 text-slate-450 italic">
                No active specialist profiles match your search criteria.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {filteredDoctors.map((doc) => (
                  <div key={doc.id} className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm hover:shadow-md hover:border-slate-200 transition-all flex flex-col justify-between">
                    <div>
                      <div className="flex justify-between items-start">
                        <h4 className="font-extrabold text-slate-900 text-base">{doc.name}</h4>
                        <span className="px-2 py-0.5 text-[10px] font-bold tracking-wider uppercase bg-teal-50 text-teal-700 rounded border border-teal-100">
                          {doc.doctor_profile?.specialization || "General"}
                        </span>
                      </div>
                      <p className="text-xs text-slate-400 mt-2">Appointment duration: {doc.doctor_profile?.slot_duration} minutes</p>
                      
                      {doc.doctor_profile?.bio ? (
                        <p className="text-xs text-slate-500 mt-4 leading-relaxed line-clamp-3 italic">"{doc.doctor_profile.bio}"</p>
                      ) : (
                        <p className="text-xs text-slate-355 mt-4 italic">No bio logged.</p>
                      )}
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-50">
                      <button
                        onClick={() => {
                          setSelectedDoctor(doc);
                          setReschedulingAppointment(null);
                          setActiveTab("book");
                        }}
                        className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs py-2 rounded-xl text-center shadow-sm"
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
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 mb-6"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Go Back
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
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            {/* Header filters */}
            <div className="p-6 border-b border-slate-100 bg-slate-50/55 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h3 className="text-base font-bold text-slate-900">Appointments Ledger</h3>
                <p className="text-xs text-slate-400 mt-0.5">Filter and manage your scheduled clinical history.</p>
              </div>

              {/* Tabs filter ledger */}
              <div className="flex gap-2">
                {(["ALL", "BOOKED", "RESCHEDULED", "CANCELLED"] as const).map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setLedgerFilter(filter)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-all ${
                      ledgerFilter === filter
                        ? "bg-teal-600 border-teal-600 text-white shadow-sm"
                        : "bg-white border-slate-200 text-slate-650 hover:bg-slate-50"
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Table */}
            {filteredAppointments.length === 0 ? (
              <div className="text-center py-16 text-slate-450 italic">
                No matching appointments found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Clinic Specialist</th>
                      <th className="px-6 py-4">Specialization</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Time Slot</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredAppointments.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/40">
                        <td className="px-6 py-4 font-semibold text-slate-900">{app.doctor_name}</td>
                        <td className="px-6 py-4 text-slate-500">{app.specialization}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(app.appointment_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">
                          {app.start_time.substring(0, 5)} - {app.end_time.substring(0, 5)}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            app.status === "BOOKED" ? "text-emerald-700 bg-emerald-50" :
                            app.status === "RESCHEDULED" ? "text-indigo-700 bg-indigo-50" :
                            "text-rose-700 bg-rose-50"
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          <button
                            onClick={() => { setSelectedAppointment(app); setActiveTab("details"); }}
                            className="text-xs font-bold text-teal-655 hover:text-teal-750"
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
                                className="text-xs font-bold text-indigo-600 hover:text-indigo-700"
                              >
                                Reschedule
                              </button>
                              <button
                                onClick={() => handleCancelAppointment(app.id)}
                                className="text-xs font-bold text-rose-600 hover:text-rose-700"
                              >
                                Cancel
                              </button>
                            </>
                          )}
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
          <div className="max-w-2xl mx-auto bg-white border border-slate-150 rounded-2xl shadow-sm overflow-hidden animate-fade-in">
            {/* Header receipt card */}
            <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-center">
              <div>
                <button
                  onClick={() => setActiveTab("appointments")}
                  className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-700 mb-2"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                  </svg>
                  Ledger List
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

              {/* AI summary placeholder (For Phase 6) */}
              <div className="p-4 border border-teal-50 bg-teal-50/10 rounded-xl text-xs text-teal-950 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>🤖</span> AI Pre-Visit Insight
                </div>
                <p className="text-slate-500 leading-relaxed">
                  AI diagnostic summary reports and pre-visit medical breakdowns are compiled once the symptoms are verified. This feature will be integrated in the upcoming Phase 6.
                </p>
              </div>

              {/* Prescriptions placeholder (For Phase 6) */}
              <div className="p-4 border border-slate-150 bg-slate-50/40 rounded-xl text-xs text-slate-700 space-y-1">
                <div className="font-bold flex items-center gap-1">
                  <span>💊</span> Clinic Prescription & Recommendations
                </div>
                <p className="text-slate-550 leading-relaxed">
                  Prescription logs, medication dosages, and doctor follow-up schedules are posted here by your practitioner during or after your physical consultation.
                </p>
              </div>

            </div>
          </div>
        )}

      </main>
    </div>
  );
}
