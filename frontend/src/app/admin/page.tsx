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
  id?: number;
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

export default function AdminDashboard() {
  const [user, setUser] = useState<any>(null);
  const [doctors, setDoctors] = useState<DoctorUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"doctors" | "schedule">("doctors");
  const router = useRouter();

  // Create Doctor Form States
  const [showAddModal, setShowAddModal] = useState(false);
  const [docName, setDocName] = useState("");
  const [docEmail, setDocEmail] = useState("");
  const [docPassword, setDocPassword] = useState("");
  const [docSpecialization, setDocSpecialization] = useState("");
  const [docSlotDuration, setDocSlotDuration] = useState(30);
  const [docBio, setDocBio] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  // Edit Doctor Form States
  const [editingDoctor, setEditingDoctor] = useState<DoctorUser | null>(null);
  const [editSpecialization, setEditSpecialization] = useState("");
  const [editSlotDuration, setEditSlotDuration] = useState(30);
  const [editBio, setEditBio] = useState("");
  const [editName, setEditName] = useState("");
  const [editActive, setEditActive] = useState(true);

  // Selected Doctor Schedule States
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorUser | null>(null);
  const [workingHours, setWorkingHours] = useState<WorkingHour[]>([]);
  const [leaves, setLeaves] = useState<DoctorLeave[]>([]);
  const [newLeaveDate, setNewLeaveDate] = useState("");
  const [newLeaveReason, setNewLeaveReason] = useState("");
  const [scheduleLoading, setScheduleLoading] = useState(false);
  const [conflictList, setConflictList] = useState<any[]>([]);
  const [doctorSearch, setDoctorSearch] = useState("");
  const [scheduleDoctorSearch, setScheduleDoctorSearch] = useState("");

  const filteredDoctors = doctors.filter((doc) => {
    const query = doctorSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      doc.name.toLowerCase().includes(query) ||
      doc.email.toLowerCase().includes(query) ||
      (doc.doctor_profile?.specialization || "").toLowerCase().includes(query)
    );
  });

  const scheduleFilteredDoctors = doctors.filter((doc) => {
    const query = scheduleDoctorSearch.toLowerCase().trim();
    if (!query) return true;
    return (
      doc.name.toLowerCase().includes(query) ||
      doc.email.toLowerCase().includes(query) ||
      (doc.doctor_profile?.specialization || "").toLowerCase().includes(query)
    );
  });

  const fetchDoctors = async (token: string) => {
    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/doctors", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setDoctors(data);
      }
    } catch (e) {
      console.error("Failed to fetch doctors", e);
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
      if (parsedUser.role.toUpperCase() !== "ADMIN") {
        router.push("/login");
        return;
      }
      setUser(parsedUser);
      fetchDoctors(token);
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

  // Add Doctor Account
  const handleAddDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch("http://localhost:8000/api/v1/admin/doctors", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: docName,
          email: docEmail,
          password: docPassword,
          specialization: docSpecialization,
          slot_duration: docSlotDuration,
          bio: docBio || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to create doctor account");
      }

      // Reset Form
      setDocName("");
      setDocEmail("");
      setDocPassword("");
      setDocSpecialization("");
      setDocSlotDuration(30);
      setDocBio("");
      setShowAddModal(false);
      
      // Refresh Lists
      fetchDoctors(token);
    } catch (err: any) {
      setFormError(err.message);
    }
  };

  // Edit Doctor Account
  const handleUpdateDoctor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingDoctor) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/doctors/${editingDoctor.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: editName,
          is_active: editActive,
          specialization: editSpecialization,
          slot_duration: editSlotDuration,
          bio: editBio || null,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to update doctor profile");
      }

      setEditingDoctor(null);
      fetchDoctors(token);
    } catch (err: any) {
      alert(err.message);
    }
  };

  // Load Schedule & Leaves for Selected Doctor
  const selectDoctorForSchedule = async (doctor: DoctorUser) => {
    setSelectedDoctor(doctor);
    setScheduleLoading(true);
    setActiveTab("schedule");
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      // 1. Fetch Working Hours
      const hoursRes = await fetch(`http://localhost:8000/api/v1/admin/doctors/${doctor.id}/schedule`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (hoursRes.ok) {
        const hoursData = await hoursRes.json();
        // Setup initial days
        const fullWeek = Array.from({ length: 7 }, (_, i) => {
          const match = hoursData.find((h: any) => h.day_of_week === i);
          return match
            ? { day_of_week: i, start_time: match.start_time.substring(0, 5), end_time: match.end_time.substring(0, 5), is_available: match.is_available }
            : { day_of_week: i, start_time: "09:00", end_time: "17:00", is_available: false };
        });
        setWorkingHours(fullWeek);
      }

      // 2. Fetch Leaves
      const leavesRes = await fetch(`http://localhost:8000/api/v1/admin/doctors/${doctor.id}/leaves`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (leavesRes.ok) {
        const leavesData = await leavesRes.json();
        setLeaves(leavesData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScheduleLoading(false);
    }
  };

  // Save Weekly Hours
  const handleSaveWorkingHours = async () => {
    if (!selectedDoctor) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    // Filter only selected/available days to send to backend
    const filteredHours = workingHours.filter((h) => h.is_available);

    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/doctors/${selectedDoctor.id}/schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(filteredHours),
      });

      if (res.ok) {
        alert("Working schedule updated successfully!");
        selectDoctorForSchedule(selectedDoctor);
      } else {
        alert("Failed to save schedule.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add Leave Day
  const handleAddLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDoctor || !newLeaveDate) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/doctors/${selectedDoctor.id}/leaves`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          leave_date: newLeaveDate,
          reason: newLeaveReason || null,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.detail || "Failed to register leave day");
      }

      const responseData = await res.json();
      if (responseData.conflicting_appointments && responseData.conflicting_appointments.length > 0) {
        setConflictList(responseData.conflicting_appointments);
      } else {
        alert("Leave day registered successfully. No scheduling conflicts detected.");
      }

      setNewLeaveDate("");
      setNewLeaveReason("");
      selectDoctorForSchedule(selectedDoctor);
    } catch (e: any) {
      alert(e.message);
    }
  };

  // Delete Leave Day
  const handleDeleteLeave = async (leaveId: number) => {
    if (!selectedDoctor) return;
    const token = localStorage.getItem("token");
    if (!token) return;

    try {
      const res = await fetch(`http://localhost:8000/api/v1/admin/doctors/${selectedDoctor.id}/leaves/${leaveId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        selectDoctorForSchedule(selectedDoctor);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const weekdays = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

  if (loading || !user) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-sm text-slate-400 font-medium">Loading admin portal...</p>
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
              <div className="flex items-center gap-2.5">
                <img src="/logo.png" alt="MediFlow Logo" className="h-9 w-9 object-contain rounded-xl shadow-xs" />
                <span className="font-bold text-slate-900 text-lg tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                  Medi<span className="text-teal-600">Flow</span>
                </span>
              </div>

              {/* Desktop Nav Tabs in Header */}
              <nav className="hidden md:flex items-center gap-1">
                {[
                  { key: "doctors",  label: "Doctors List" },
                  { key: "schedule", label: "Schedule & Leaves" },
                ].map(tab => (
                  <button
                    key={tab.key}
                    onClick={() => {
                      if (tab.key === "schedule") {
                        if (doctors.length > 0 && !selectedDoctor) {
                          selectDoctorForSchedule(doctors[0]);
                        } else if (selectedDoctor) {
                          setActiveTab("schedule");
                        } else {
                          alert("Please add a doctor first.");
                        }
                      } else {
                        setActiveTab("doctors");
                      }
                    }}
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
                <div className="h-7 w-7 rounded-full bg-gradient-to-br from-rose-500 to-rose-700 flex items-center justify-center text-white text-xs font-black shadow-xs">
                  {user.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-800">{user.name}</span>
                  <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wide bg-rose-100/80 text-rose-700 border border-rose-200/60">
                    Admin
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-grow">
        
        {/* Mobile Navigation */}
        <div className="flex md:hidden bg-white border border-slate-200 rounded-2xl p-1.5 shadow-sm mb-6 gap-1">
          {[
            { key: "doctors",  label: "Doctors List" },
            { key: "schedule", label: "Schedule & Leaves" },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => {
                if (tab.key === "schedule") {
                  if (doctors.length > 0 && !selectedDoctor) {
                    selectDoctorForSchedule(doctors[0]);
                  } else if (selectedDoctor) {
                    setActiveTab("schedule");
                  } else {
                    alert("Please add a doctor first.");
                  }
                } else {
                  setActiveTab("doctors");
                }
              }}
              className={`flex-1 py-2 text-xs font-bold rounded-xl transition-all ${
                activeTab === tab.key ? "bg-teal-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Header Banner */}
        <div className="relative overflow-hidden bg-gradient-to-r from-teal-700 via-teal-800 to-slate-900 rounded-2xl p-6 md:p-7 shadow-lg text-white mb-6">
          <div className="absolute right-0 top-0 h-full w-1/3 opacity-10">
            <svg viewBox="0 0 200 200" fill="none" className="h-full w-full">
              <circle cx="160" cy="40" r="120" stroke="white" strokeWidth="40" />
            </svg>
          </div>
          <div className="relative flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <div className="inline-flex items-center gap-2 bg-teal-400/20 border border-teal-300/30 text-teal-200 text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full mb-3">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-300"></span>
                Admin Portal
              </div>
              <h1 className="text-xl md:text-2xl font-black tracking-tight" style={{ fontFamily: 'var(--font-outfit)' }}>
                {activeTab === "doctors" ? "Manage Doctor Accounts" : "Configure Schedules & Leaves"}
              </h1>
              <p className="text-teal-100/80 text-sm mt-1">
                {activeTab === "doctors" ? "Provision profiles, credentials, slot durations, and account statuses." : "Configure weekly availability and log absence records for doctors."}
              </p>
            </div>
          </div>
        </div>

        {/* TAB 1: DOCTORS LIST */}
        {activeTab === "doctors" && (
          <div className="card overflow-hidden animate-fade-in w-full">
            <div className="px-6 py-4.5 border-b border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <h2 className="text-lg font-black text-slate-900" style={{ fontFamily: 'var(--font-outfit)' }}>Doctor Profiles</h2>
                <p className="text-xs text-slate-400 mt-0.5">{filteredDoctors.length} of {doctors.length} registered doctor{doctors.length !== 1 ? 's' : ''}</p>
              </div>
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <div className="relative flex-grow sm:w-72">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    placeholder="Search doctor, email, specialty..."
                    className="w-full pl-9 pr-3.5 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all text-slate-800 font-medium"
                  />
                </div>
                <button
                  onClick={() => setShowAddModal(true)}
                  className="inline-flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 active:scale-95 text-white text-xs font-bold px-4 py-2 rounded-xl shadow-sm transition-all cursor-pointer flex-shrink-0"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                  </svg>
                  Add Doctor
                </button>
              </div>
            </div>

            <div className="overflow-x-auto min-h-[300px] w-full">
              <table className="w-full text-left divide-y divide-slate-100">
                <thead className="bg-slate-50/80 text-slate-500 text-xs font-bold uppercase tracking-wider">
                  <tr>
                    <th className="px-5 py-3.5 whitespace-nowrap">Name</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Email</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Specialization</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Slot</th>
                    <th className="px-5 py-3.5 whitespace-nowrap">Status</th>
                    <th className="px-5 py-3.5 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {filteredDoctors.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-20 text-slate-400">
                        <div className="flex flex-col items-center justify-center gap-2">
                          <svg className="h-9 w-9 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                          </svg>
                          <span className="italic text-sm">
                            {doctors.length === 0
                              ? "No doctor profiles found. Click Add Doctor to create one."
                              : "No doctors match your search criteria."}
                          </span>
                          {doctorSearch && (
                            <button
                              onClick={() => setDoctorSearch("")}
                              className="text-xs text-teal-600 font-bold hover:underline mt-1 cursor-pointer"
                            >
                              Clear search query
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredDoctors.map((doc) => (
                      <tr key={doc.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 text-xs font-black flex-shrink-0">
                              {(doc.name || "D").charAt(0)}
                            </div>
                            <span className="font-bold text-slate-900 text-sm">{doc.name}</span>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 whitespace-nowrap">{doc.email}</td>
                        <td className="px-5 py-3.5 text-sm font-medium text-slate-800 whitespace-nowrap">
                          {doc.doctor_profile?.specialization || <span className="text-slate-300 italic">Not set</span>}
                        </td>
                        <td className="px-5 py-3.5 text-sm text-slate-600 font-mono whitespace-nowrap">
                          {doc.doctor_profile?.slot_duration ? `${doc.doctor_profile.slot_duration} min` : "30 min"}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <span className={`badge ${doc.is_active ? "badge-success" : "badge-neutral"}`}>
                            {doc.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => selectDoctorForSchedule(doc)}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 hover:bg-indigo-100 hover:border-indigo-300 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                            >
                              Schedule
                            </button>
                            <button
                              onClick={() => {
                                setEditingDoctor(doc);
                                setEditName(doc.name);
                                setEditActive(doc.is_active);
                                setEditSpecialization(doc.doctor_profile?.specialization || "");
                                setEditSlotDuration(doc.doctor_profile?.slot_duration || 30);
                                setEditBio(doc.doctor_profile?.bio || "");
                              }}
                              className="px-2.5 py-1 text-xs font-bold rounded-lg bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100 hover:border-teal-300 active:scale-95 transition-all cursor-pointer flex-shrink-0"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 2: SCHEDULES & LEAVES */}
        {activeTab === "schedule" && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left Column: Doctor Selection & Info */}
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white border border-slate-100 rounded-2xl p-5 shadow-sm">
                <div className="flex justify-between items-center mb-3">
                  <h3 className="text-sm font-bold text-slate-900">Select Doctor</h3>
                  <span className="badge badge-neutral">{doctors.length} total</span>
                </div>

                {/* Doctor Search Filter */}
                <div className="relative mb-3">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    value={scheduleDoctorSearch}
                    onChange={(e) => setScheduleDoctorSearch(e.target.value)}
                    placeholder="Quick find doctor..."
                    className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 text-slate-800"
                  />
                </div>

                <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                  {scheduleFilteredDoctors.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-6 italic">No doctors match search.</p>
                  ) : (
                    scheduleFilteredDoctors.map((doc) => (
                      <button
                        key={doc.id}
                        onClick={() => selectDoctorForSchedule(doc)}
                        className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-semibold transition-all flex justify-between items-center cursor-pointer ${
                          selectedDoctor?.id === doc.id
                            ? "border-teal-500 bg-teal-50/50 text-teal-950 font-bold shadow-2xs"
                            : "border-slate-100 bg-white hover:bg-slate-50 text-slate-700"
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="h-7 w-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center text-[10px] font-black flex-shrink-0">
                            {(doc.name || "D").charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-slate-900 truncate">{doc.name}</div>
                            <div className="text-[11px] text-slate-400 font-normal truncate">{doc.doctor_profile?.specialization || "General"}</div>
                          </div>
                        </div>
                        <svg className={`h-4 w-4 flex-shrink-0 ${selectedDoctor?.id === doc.id ? "text-teal-600" : "text-slate-300"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Right Columns: Working Hours & Leave management */}
            <div className="lg:col-span-2 space-y-8">
              {selectedDoctor ? (
                <>
                  {scheduleLoading ? (
                    <div className="bg-white border border-slate-100 rounded-2xl p-12 shadow-sm text-center flex flex-col items-center justify-center">
                      <div className="w-6 h-6 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                      <span className="text-slate-400 text-xs mt-3">Loading schedule details...</span>
                    </div>
                  ) : (
                    <>
                      {/* Section A: Working Hours */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        {/* Selected Doctor Header */}
                        <div className="flex items-center gap-3 pb-4 mb-5 border-b border-slate-100">
                          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-500 to-indigo-700 flex items-center justify-center text-white text-sm font-black shadow-xs flex-shrink-0">
                            {(selectedDoctor.name || "D").charAt(0)}
                          </div>
                          <div>
                            <h3 className="text-base font-bold text-slate-900 leading-tight">Dr. {selectedDoctor.name}</h3>
                            <span className="text-xs text-slate-500">{selectedDoctor.doctor_profile?.specialization || "General Specialist"} &middot; {selectedDoctor.email}</span>
                          </div>
                        </div>

                        <div className="mb-6">
                          <h3 className="text-lg font-bold text-slate-950 mb-1">Weekly Working Hours</h3>
                          <p className="text-xs text-slate-500">Configure appointment check-in availability per day.</p>
                        </div>

                        <div className="space-y-4">
                          {workingHours.map((wh, index) => (
                            <div key={wh.day_of_week} className="flex flex-col sm:flex-row justify-between items-start sm:items-center py-3 border-b border-slate-50/80 gap-3">
                              <label className="flex items-center gap-3 font-semibold text-sm text-slate-800 w-32">
                                <input
                                  type="checkbox"
                                  checked={wh.is_available}
                                  onChange={(e) => {
                                    const updated = [...workingHours];
                                    updated[index].is_available = e.target.checked;
                                    setWorkingHours(updated);
                                  }}
                                  className="h-4.5 w-4.5 accent-teal-600 cursor-pointer rounded border-slate-300 bg-white"
                                />
                                {weekdays[wh.day_of_week]}
                              </label>

                              {wh.is_available ? (
                                <div className="flex items-center gap-2 text-sm">
                                  <input
                                    type="time"
                                    value={wh.start_time}
                                    onChange={(e) => {
                                      const updated = [...workingHours];
                                      updated[index].start_time = e.target.value;
                                      setWorkingHours(updated);
                                    }}
                                    className="px-2 py-1 border border-slate-200 rounded-lg text-slate-800 bg-white"
                                  />
                                  <span className="text-slate-400">to</span>
                                  <input
                                    type="time"
                                    value={wh.end_time}
                                    onChange={(e) => {
                                      const updated = [...workingHours];
                                      updated[index].end_time = e.target.value;
                                      setWorkingHours(updated);
                                    }}
                                    className="px-2 py-1 border border-slate-200 rounded-lg text-slate-800 bg-white"
                                  />
                                </div>
                              ) : (
                                <span className="text-xs text-slate-400 italic">Off duty</span>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="mt-6 flex justify-end">
                          <button
                            onClick={handleSaveWorkingHours}
                            className="bg-teal-600 hover:bg-teal-700 text-white font-bold text-sm px-5 py-2 rounded-xl shadow-md shadow-teal-600/10 transition-all duration-200 active:scale-[0.98]"
                          >
                            Save Weekly Hours
                          </button>
                        </div>
                      </div>

                      {/* Section B: Leaves Configuration */}
                      <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                        <h3 className="text-lg font-bold text-slate-950 mb-1">
                          Leave Days Management
                        </h3>
                        <p className="text-xs text-slate-500 mb-6">Register leave days for Dr. {selectedDoctor.name}.</p>

                        <form onSubmit={handleAddLeave} className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8 pb-6 border-b border-slate-100">
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Leave Date</label>
                            <input
                              type="date"
                              required
                              value={newLeaveDate}
                              onChange={(e) => setNewLeaveDate(e.target.value)}
                              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2.5">Reason (Optional)</label>
                            <input
                              type="text"
                              value={newLeaveReason}
                              onChange={(e) => setNewLeaveReason(e.target.value)}
                              className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm text-slate-800 bg-white focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                              placeholder="Vacation, conference..."
                            />
                          </div>
                          <div className="flex flex-col justify-end">
                            <button
                              type="submit"
                              className="w-full bg-teal-600 hover:bg-teal-700 active:scale-[0.98] text-white font-bold text-sm py-2.5 rounded-xl shadow-sm transition-all cursor-pointer"
                            >
                              Add Leave
                            </button>
                          </div>
                        </form>

                        {/* Leaves List */}
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Upcoming Registered Leaves</h4>
                          {leaves.length === 0 ? (
                            <p className="text-xs text-slate-400 italic">No leaves registered for this doctor.</p>
                          ) : (
                            <div className="space-y-2">
                              {leaves.map((leave) => (
                                <div key={leave.id} className="flex justify-between items-center p-3 bg-slate-50 border border-slate-100 rounded-xl text-sm">
                                  <div>
                                    <span className="font-semibold text-slate-800">{new Date(leave.leave_date).toLocaleDateString()}</span>
                                    {leave.reason && <span className="text-slate-500 ml-2">({leave.reason})</span>}
                                  </div>
                                  <button
                                    onClick={() => handleDeleteLeave(leave.id)}
                                    className="px-2.5 py-1 text-xs font-bold rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 hover:border-rose-300 active:scale-95 transition-all cursor-pointer"
                                  >
                                    Remove
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="bg-white border border-slate-100 rounded-2xl p-12 shadow-sm text-center text-slate-400 italic">
                  Select a doctor from the list to view or edit their schedule.
                </div>
              )}
            </div>
          </div>
        )}

      </main>

      {/* MODAL: ADD DOCTOR PROFILE */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-slate-950 mb-1">Create Doctor Profile</h3>
            <p className="text-xs text-slate-500 mb-6">Create a doctor credentials account and profile.</p>

            <form onSubmit={handleAddDoctor} className="space-y-4.5">
              {formError && (
                <div className="bg-rose-50 text-rose-800 text-xs p-3 rounded-lg border border-rose-100 font-medium">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Full Name</label>
                <input
                  type="text"
                  required
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  placeholder="Dr. Gregory House"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Email Address</label>
                <input
                  type="email"
                  required
                  value={docEmail}
                  onChange={(e) => setDocEmail(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  placeholder="house@caresync.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Login Password</label>
                <input
                  type="password"
                  required
                  value={docPassword}
                  onChange={(e) => setDocPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  placeholder="••••••••"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Specialization</label>
                <input
                  type="text"
                  required
                  value={docSpecialization}
                  onChange={(e) => setDocSpecialization(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  placeholder="Cardiology, Pediatrics..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Slot Appointment Duration (mins)</label>
                <select
                  value={docSlotDuration}
                  onChange={(e) => setDocSlotDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Bio (Optional)</label>
                <textarea
                  value={docBio}
                  onChange={(e) => setDocBio(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                  placeholder="Add bio details about doctor..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/10"
                >
                  Save Doctor
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDIT DOCTOR PROFILE */}
      {editingDoctor && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setEditingDoctor(null)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-slate-950 mb-1">Edit Doctor Profile</h3>
            <p className="text-xs text-slate-500 mb-6">Modify Dr. {editingDoctor.name}'s profile details.</p>

            <form onSubmit={handleUpdateDoctor} className="space-y-4.5">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Name</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Specialization</label>
                <input
                  type="text"
                  required
                  value={editSpecialization}
                  onChange={(e) => setEditSpecialization(e.target.value)}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Slot Duration (mins)</label>
                <select
                  value={editSlotDuration}
                  onChange={(e) => setEditSlotDuration(Number(e.target.value))}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                >
                  <option value={15}>15 minutes</option>
                  <option value={30}>30 minutes</option>
                  <option value={45}>45 minutes</option>
                  <option value={60}>60 minutes</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-600 mb-2">Bio (Optional)</label>
                <textarea
                  value={editBio}
                  onChange={(e) => setEditBio(e.target.value)}
                  rows={3}
                  className="w-full px-3.5 py-2.5 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editActive}
                    onChange={(e) => setEditActive(e.target.checked)}
                    className="h-4.5 w-4.5 accent-teal-600 cursor-pointer rounded border-slate-300 bg-white"
                  />
                  Doctor account is Active
                </label>
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditingDoctor(null)}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold"
                >
                  Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LEAVE CONFLICTS ALERT */}
      {conflictList.length > 0 && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 relative">
            <button
              onClick={() => setConflictList([])}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-slate-950 mb-1">Leave Conflicts Resolved</h3>
            <p className="text-xs text-slate-500 mb-6">The following active patient appointments were automatically cancelled due to doctor leave:</p>

            <div className="space-y-3 max-h-60 overflow-y-auto mb-6">
              {conflictList.map((app) => (
                <div key={app.id} className="p-3 bg-rose-50/30 border border-rose-100/50 rounded-xl text-xs space-y-1">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">{app.patient_name}</span>
                    <span className="text-slate-400 font-semibold">{app.patient_email}</span>
                  </div>
                  <div className="text-slate-600">
                    Slot: {new Date(app.appointment_date).toLocaleDateString()} at {app.start_time.substring(0, 5)} - {app.end_time.substring(0, 5)}
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setConflictList([])}
                className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/10"
              >
                Acknowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
