"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

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
  const [specialization, setSpecialization] = useState("");
  const [editSuccess, setEditSuccess] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

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
      const res = await fetch("http://localhost:8000/api/v1/google-calendar/status", {
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
      const res = await fetch("http://localhost:8000/api/v1/google-calendar/auth-url", {
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
      const res = await fetch("http://localhost:8000/api/v1/google-calendar/disconnect", {
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
      const res = await fetch("http://localhost:8000/api/v1/doctor/profile/me", {
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
      
      const scheduleRes = await fetch(`http://localhost:8000/api/v1/admin/doctors/${userData.id}/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (scheduleRes.ok) {
        const scheduleData = await scheduleRes.json();
        setWorkingHours(scheduleData);
      }

      const leavesRes = await fetch(`http://localhost:8000/api/v1/admin/doctors/${userData.id}/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (leavesRes.ok) {
        const leavesData = await leavesRes.json();
        setLeaves(leavesData);
      }

      // 3. Fetch Appointments (Agenda)
      const appRes = await fetch("http://localhost:8000/api/v1/appointments/me", {
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
      const res = await fetch("http://localhost:8000/api/v1/doctor/profile/me/profile", {
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
      const res = await fetch(`http://localhost:8000/api/v1/appointments/${appId}/cancel`, {
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
      const res = await fetch(`http://localhost:8000/api/v1/appointments/${selectedVisit.id}/complete`, {
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
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-800">
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
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-slate-200 text-xs font-bold text-slate-600 rounded-lg bg-white hover:bg-slate-50 transition-all duration-200"
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

      <main className="max-w-4xl mx-auto px-6 py-8 flex-grow w-full">
        
        {/* Profile Card Header */}
        <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">Doctor Dashboard</h1>
            <p className="text-slate-500 text-sm mt-1.5">Manage your personal profile specialization, bio details, and view your schedule.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("agenda")}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                activeTab === "agenda" ? "bg-teal-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              My Agenda
            </button>
            <button
              onClick={() => setActiveTab("profile")}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                activeTab === "profile" ? "bg-teal-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              My Profile
            </button>
            <button
              onClick={() => setActiveTab("schedule")}
              className={`px-4 py-2 text-sm font-bold rounded-xl transition-all ${
                activeTab === "schedule" ? "bg-teal-600 text-white shadow-md" : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
              }`}
            >
              My Schedule
            </button>
          </div>
        </div>

        {/* TAB A: MY AGENDA */}
        {activeTab === "agenda" && (
          <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
            <div className="p-6 border-b border-slate-100 bg-slate-50/50">
              <h2 className="text-lg font-bold text-slate-950">Patient Visit Schedule</h2>
            </div>

            {appointments.length === 0 ? (
              <div className="text-center py-16 text-slate-400 italic">
                No patient bookings scheduled.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-100 text-left">
                  <thead className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-4">Patient Name</th>
                      <th className="px-6 py-4">Date</th>
                      <th className="px-6 py-4">Time Slot</th>
                      <th className="px-6 py-4">Symptoms description</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {appointments.map((app) => (
                      <tr key={app.id} className="hover:bg-slate-50/40">
                        <td className="px-6 py-4 font-semibold text-slate-900">{app.patient_name}</td>
                        <td className="px-6 py-4 text-slate-600">
                          {new Date(app.appointment_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-4 font-medium text-slate-700">
                          {app.start_time.substring(0, 5)} - {app.end_time.substring(0, 5)}
                        </td>
                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                          {app.symptoms || <span className="text-slate-350 italic">None logged</span>}
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                            app.status === "BOOKED" ? "text-emerald-700 bg-emerald-50" :
                            app.status === "RESCHEDULED" ? "text-indigo-700 bg-indigo-50" :
                            app.status === "COMPLETED" ? "text-teal-700 bg-teal-50" :
                            "text-slate-500 bg-slate-100"
                          }`}>
                            {app.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right space-x-3">
                          {app.status === "COMPLETED" && (
                            <button
                              onClick={() => setViewingVisitSummary(app)}
                              className="text-xs font-bold text-teal-600 hover:text-teal-700"
                            >
                              View Summary
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
                                className="text-xs font-bold text-teal-650 hover:text-teal-700"
                              >
                                Complete Visit
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

        {/* TAB B: MY PROFILE */}
        {activeTab === "profile" && (
          <div className="bg-white border border-slate-100 rounded-2xl p-6 md:p-8 shadow-sm">
            <h2 className="text-lg font-bold text-slate-950 mb-1">Clinical Information</h2>
            <p className="text-xs text-slate-500 mb-6">Modify details visible to patients during slot bookings.</p>

            <form onSubmit={handleUpdateProfile} className="space-y-6">
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

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Specialization</label>
                  <input
                    type="text"
                    required
                    value={specialization}
                    onChange={(e) => setSpecialization(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    placeholder="Pediatrics, Orthopedics..."
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Appointment Slot Duration (mins)</label>
                  <select
                    value={slotDuration}
                    onChange={(e) => setSlotDuration(Number(e.target.value))}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800"
                  >
                    <option value={15}>15 minutes</option>
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Biography</label>
                <textarea
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800"
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

            <div className="border-t border-slate-100 mt-8 pt-8">
              <h2 className="text-lg font-bold text-slate-950 mb-1">Integrations & Sync</h2>
              <p className="text-xs text-slate-500 mb-6">Manage external services connected to your account.</p>
              
              <div className="bg-slate-50/50 border border-slate-100 rounded-2xl p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
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
                    <ul className="list-disc list-inside mt-1 text-slate-705 space-y-1">
                      {selectedVisit.ai_suggested_questions &&
                        (() => {
                          try {
                            const qs = JSON.parse(selectedVisit.ai_suggested_questions);
                            return Array.isArray(qs) ? qs.map((q, idx) => <li key={idx}>{q}</li>) : <li>{qs}</li>;
                          } catch {
                            return <li>{selectedVisit.ai_suggested_questions}</li>;
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
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => setViewingVisitSummary(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-slate-950 mb-1">Consultation Summary</h3>
            <p className="text-xs text-slate-400 mb-6">Patient: {viewingVisitSummary.patient_name} | Date: {new Date(viewingVisitSummary.appointment_date).toLocaleDateString()}</p>

            <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
              <div className="text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Symptom Log</span>
                <div className="p-3 bg-slate-50 rounded-xl text-slate-700">{viewingVisitSummary.symptoms}</div>
              </div>

              <div className="text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1">Clinical Notes</span>
                <div className="p-3 bg-slate-50 rounded-xl text-slate-700 whitespace-pre-wrap">{viewingVisitSummary.clinical_notes}</div>
              </div>

              <div className="text-xs">
                <span className="font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Prescriptions</span>
                <div className="border border-slate-100 rounded-xl overflow-hidden bg-slate-50">
                  <table className="w-full text-[11px] text-left border-collapse">
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
                      {viewingVisitSummary.prescriptions && viewingVisitSummary.prescriptions.length > 0 ? (
                        viewingVisitSummary.prescriptions.map((med, idx) => (
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

              {/* POST-VISIT AI PATIENT FRIENDLY SUMMARY */}
              <div className="p-4 bg-teal-50/20 border border-teal-100 rounded-xl space-y-3">
                <div className="text-xs font-black text-teal-955 flex items-center gap-1">
                  <span>🤖</span> AI Patient-Friendly Translation
                </div>
                {viewingVisitSummary.ai_post_visit_status === "SUCCESS" || viewingVisitSummary.ai_post_visit_status === "FAILED" ? (
                  <div className="space-y-3 text-xs">
                    <div>
                      <span className="font-bold text-slate-500">Friendly Summary:</span>
                      <p className="text-slate-800 leading-relaxed mt-1 font-medium">{viewingVisitSummary.ai_patient_summary}</p>
                    </div>
                    <div>
                      <span className="font-bold text-slate-500">Care Instructions:</span>
                      <ul className="list-disc list-inside mt-1 text-slate-707 space-y-1">
                        {viewingVisitSummary.ai_follow_up_instructions &&
                          (() => {
                            try {
                              const insts = JSON.parse(viewingVisitSummary.ai_follow_up_instructions);
                              return Array.isArray(insts) ? insts.map((i, idx) => <li key={idx}>{i}</li>) : <li>{insts}</li>;
                            } catch {
                              return <li>{viewingVisitSummary.ai_follow_up_instructions}</li>;
                            }
                          })()
                        }
                      </ul>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-slate-450 italic">
                    AI Patient Translation is compiling in the background.
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end pt-4 border-t border-slate-50 mt-4">
              <button
                onClick={() => setViewingVisitSummary(null)}
                className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold rounded-xl"
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
