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

  // Booking Flow States
  const [selectedDoctor, setSelectedDoctor] = useState<DoctorUser | null>(null);
  const [bookingDate, setBookingDate] = useState("");
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(false);

  // Hold / Booking Modal States
  const [activeHold, setActiveHold] = useState<SlotHold | null>(null);
  const [symptoms, setSymptoms] = useState("");
  const [holdTimer, setHoldTimer] = useState(300); // 5 minutes in seconds
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [bookingLoading, setBookingLoading] = useState(false);

  // Rescheduling States
  const [reschedulingAppointment, setReschedulingAppointment] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlots, setRescheduleSlots] = useState<TimeSlot[]>([]);
  const [rescheduleSlotsLoading, setRescheduleSlotsLoading] = useState(false);
  const [activeRescheduleHold, setActiveRescheduleHold] = useState<SlotHold | null>(null);

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

  // Fetch Slots for Booking Date
  useEffect(() => {
    if (!selectedDoctor || !bookingDate) {
      setSlots([]);
      return;
    }
    const fetchSlots = async () => {
      setSlotsLoading(true);
      const token = localStorage.getItem("token");
      try {
        const docProfileId = selectedDoctor.doctor_profile?.id;
        const res = await fetch(
          `http://localhost:8000/api/v1/appointments/availability?doctor_profile_id=${docProfileId}&query_date=${bookingDate}`,
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
  }, [selectedDoctor, bookingDate]);

  // Fetch Slots for Rescheduling Date
  useEffect(() => {
    if (!reschedulingAppointment || !rescheduleDate) {
      setRescheduleSlots([]);
      return;
    }
    const fetchRescheduleSlots = async () => {
      setRescheduleSlotsLoading(true);
      const token = localStorage.getItem("token");
      try {
        const docProfileId = reschedulingAppointment.doctor_profile_id;
        const res = await fetch(
          `http://localhost:8000/api/v1/appointments/availability?doctor_profile_id=${docProfileId}&query_date=${rescheduleDate}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        if (res.ok) {
          const data = await res.json();
          setRescheduleSlots(data.slots);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setRescheduleSlotsLoading(false);
      }
    };
    fetchRescheduleSlots();
  }, [reschedulingAppointment, rescheduleDate]);

  // Hold Timer Logic
  useEffect(() => {
    if (activeHold || activeRescheduleHold) {
      setHoldTimer(300);
      timerRef.current = setInterval(() => {
        setHoldTimer((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setActiveHold(null);
            setActiveRescheduleHold(null);
            alert("Your 5-minute slot hold has expired. Please select a slot again.");
            // Refresh slots
            if (bookingDate) setBookingDate((d) => d);
            if (rescheduleDate) setRescheduleDate((d) => d);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeHold, activeRescheduleHold]);

  const handleLogout = () => {
    localStorage.clear();
    router.push("/login");
  };

  // Create Hold for Booking
  const handleHoldSlot = async (slot: TimeSlot) => {
    if (!selectedDoctor || !bookingDate) return;
    const token = localStorage.getItem("token");
    try {
      const docProfileId = selectedDoctor.doctor_profile?.id;
      const res = await fetch("http://localhost:8000/api/v1/appointments/hold", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_profile_id: docProfileId,
          hold_date: bookingDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }),
      });

      if (res.ok) {
        const holdData = await res.json();
        setActiveHold(holdData);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to hold slot. It might be already held or booked.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Create Hold for Rescheduling
  const handleHoldRescheduleSlot = async (slot: TimeSlot) => {
    if (!reschedulingAppointment || !rescheduleDate) return;
    const token = localStorage.getItem("token");
    try {
      const docProfileId = reschedulingAppointment.doctor_profile_id;
      const res = await fetch("http://localhost:8000/api/v1/appointments/hold", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          doctor_profile_id: docProfileId,
          hold_date: rescheduleDate,
          start_time: slot.start_time,
          end_time: slot.end_time,
        }),
      });

      if (res.ok) {
        const holdData = await res.json();
        setActiveRescheduleHold(holdData);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Failed to hold slot. It might be already held or booked.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Confirm Booking
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeHold) return;
    setBookingLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch("http://localhost:8000/api/v1/appointments/book", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          hold_id: activeHold.id,
          symptoms: symptoms || null,
        }),
      });

      if (res.ok) {
        alert("Appointment booked successfully!");
        if (timerRef.current) clearInterval(timerRef.current);
        setActiveHold(null);
        setSymptoms("");
        setSelectedDoctor(null);
        setBookingDate("");
        fetchAppointments(token);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Booking failed.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBookingLoading(false);
    }
  };

  // Confirm Rescheduling
  const handleConfirmReschedule = async () => {
    if (!reschedulingAppointment || !activeRescheduleHold) return;
    setBookingLoading(true);
    const token = localStorage.getItem("token");
    try {
      const res = await fetch(`http://localhost:8000/api/v1/appointments/${reschedulingAppointment.id}/reschedule`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          new_hold_id: activeRescheduleHold.id,
        }),
      });

      if (res.ok) {
        alert("Appointment rescheduled successfully!");
        if (timerRef.current) clearInterval(timerRef.current);
        setActiveRescheduleHold(null);
        setReschedulingAppointment(null);
        setRescheduleDate("");
        fetchAppointments(token);
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.detail || "Rescheduling failed.");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setBookingLoading(false);
    }
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
              Hello, {user.name}
            </h1>
            <p className="text-slate-500 text-sm mt-1.5">
              Welcome to your health manager portal. Find doctor schedules, book visits, and manage appointments.
            </p>
          </div>
          <span className="px-3 py-1 text-xs font-bold uppercase tracking-wider text-teal-700 bg-teal-50 border border-teal-100 rounded-full">
            Patient Portal
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column: Book Appointment Portal */}
          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-bold text-slate-900 mb-1">Book a Slot</h2>
              <p className="text-xs text-slate-400 mb-6">Choose a specialist and selected date to see available timings.</p>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Select Doctor</label>
                  <select
                    value={selectedDoctor?.id || ""}
                    onChange={(e) => {
                      const doc = doctors.find((d) => d.id === Number(e.target.value));
                      setSelectedDoctor(doc || null);
                    }}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  >
                    <option value="">-- Choose Doctor --</option>
                    {doctors.map((doc) => (
                      <option key={doc.id} value={doc.id}>
                        {doc.name} ({doc.doctor_profile?.specialization || "General"})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-1">Preferred Date</label>
                  <input
                    type="date"
                    min={new Date().toISOString().split("T")[0]}
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Doctor Bio Details if selected */}
            {selectedDoctor?.doctor_profile && (
              <div className="bg-teal-50/20 border border-teal-50 rounded-2xl p-6 shadow-sm">
                <h3 className="text-sm font-bold text-teal-950">About {selectedDoctor.name}</h3>
                <p className="text-xs text-teal-800 font-semibold mt-1">Specialization: {selectedDoctor.doctor_profile.specialization}</p>
                {selectedDoctor.doctor_profile.bio && (
                  <p className="text-xs text-slate-500 mt-3 leading-relaxed italic">"{selectedDoctor.doctor_profile.bio}"</p>
                )}
                <div className="mt-4 text-xs font-bold text-teal-800">
                  Appointment duration: {selectedDoctor.doctor_profile.slot_duration} minutes
                </div>
              </div>
            )}
          </div>

          {/* Right Columns: Slots availability & Appointments List */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Slot Grid View */}
            {selectedDoctor && bookingDate ? (
              <div className="bg-white border border-slate-100 rounded-2xl p-6 shadow-sm">
                <h3 className="text-base font-bold text-slate-900 mb-1">Available Slots for {new Date(bookingDate).toLocaleDateString()}</h3>
                <p className="text-xs text-slate-400 mb-6">Click a slot to reserve/hold it for booking.</p>

                {slotsLoading ? (
                  <div className="py-12 flex justify-center items-center gap-2">
                    <div className="w-5 h-5 border-2 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
                    <span className="text-xs text-slate-400">Checking slot states...</span>
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-12 text-slate-400 italic text-sm">
                    No slots available on this day. The doctor may be off-duty or on leave.
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {slots.map((slot, index) => {
                      const timeStr = slot.start_time.substring(0, 5);
                      if (slot.is_available) {
                        return (
                          <button
                            key={index}
                            onClick={() => handleHoldSlot(slot)}
                            className="p-3 border border-emerald-100 rounded-xl bg-emerald-50/20 text-emerald-800 font-bold text-sm text-center hover:bg-emerald-50 hover:border-emerald-200 transition-all cursor-pointer"
                          >
                            {timeStr}
                          </button>
                        );
                      } else if (slot.is_held) {
                        return (
                          <button
                            key={index}
                            disabled
                            className="p-3 border border-amber-100 rounded-xl bg-amber-50/10 text-amber-700 font-medium text-sm text-center opacity-60 cursor-not-allowed"
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
            ) : null}

            {/* My Appointments list */}
            <div className="bg-white border border-slate-100 rounded-2xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-slate-100 bg-slate-50/50">
                <h3 className="text-base font-bold text-slate-900">My Appointments</h3>
              </div>

              {appointments.length === 0 ? (
                <div className="text-center py-16 text-slate-400 italic">
                  No appointments registered yet.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-slate-100 text-left">
                    <thead className="bg-slate-50/50 text-slate-400 text-xs font-bold uppercase tracking-wider">
                      <tr>
                        <th className="px-6 py-4">Doctor</th>
                        <th className="px-6 py-4">Specialization</th>
                        <th className="px-6 py-4">Date</th>
                        <th className="px-6 py-4">Time</th>
                        <th className="px-6 py-4">Status</th>
                        <th className="px-6 py-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-sm">
                      {appointments.map((app) => (
                        <tr key={app.id} className="hover:bg-slate-50/40">
                          <td className="px-6 py-4 font-semibold text-slate-900">{app.doctor_name}</td>
                          <td className="px-6 py-4 text-slate-500">{app.specialization}</td>
                          <td className="px-6 py-4 text-slate-700">
                            {new Date(app.appointment_date).toLocaleDateString()}
                          </td>
                          <td className="px-6 py-4 text-slate-700 font-medium">
                            {app.start_time.substring(0, 5)} - {app.end_time.substring(0, 5)}
                          </td>
                          <td className="px-6 py-4">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                              app.status === "BOOKED" ? "text-emerald-700 bg-emerald-50" :
                              app.status === "RESCHEDULED" ? "text-indigo-700 bg-indigo-50" :
                              "text-rose-700 bg-rose-50"
                            }`}>
                              {app.status}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-right space-x-3">
                            {app.status !== "CANCELLED" && (
                              <>
                                <button
                                  onClick={() => setReschedulingAppointment(app)}
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

          </div>
        </div>
      </main>

      {/* MODAL: SYMPTOMS ENTRY & CONFIRM BOOKING */}
      {activeHold && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-md w-full p-6 relative">
            <h3 className="text-xl font-bold text-slate-950 mb-1">Confirm Slot Booking</h3>
            <p className="text-xs text-slate-400 mb-6">Complete symptoms log before your temporary hold expires.</p>

            {/* Countdown timer */}
            <div className="mb-6 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between text-amber-900 text-sm font-semibold">
              <span className="flex items-center gap-1.5">
                <svg className="h-4.5 w-4.5 text-amber-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Temporary Slot Reservation Active
              </span>
              <span className="font-mono text-base font-bold bg-white px-2 py-0.5 rounded border border-amber-200">
                {formatTimer(holdTimer)}
              </span>
            </div>

            <form onSubmit={handleConfirmBooking} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">Pre-Visit Symptoms (Optional)</label>
                <textarea
                  value={symptoms}
                  onChange={(e) => setSymptoms(e.target.value)}
                  rows={4}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                  placeholder="Describe what you are experiencing (e.g. fever, headache since 2 days)..."
                />
              </div>

              <div className="pt-2 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (timerRef.current) clearInterval(timerRef.current);
                    setActiveHold(null);
                    setSymptoms("");
                  }}
                  className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                >
                  Cancel Hold
                </button>
                <button
                  type="submit"
                  disabled={bookingLoading}
                  className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md shadow-teal-600/10 flex items-center justify-center min-w-32"
                >
                  {bookingLoading ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : "Confirm Visit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RESCHEDULING SLOT FINDER */}
      {reschedulingAppointment && (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-100 shadow-2xl max-w-lg w-full p-6 relative">
            <button
              onClick={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                setReschedulingAppointment(null);
                setRescheduleDate("");
                setActiveRescheduleHold(null);
              }}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600"
            >
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l18 18" />
              </svg>
            </button>

            <h3 className="text-xl font-bold text-slate-950 mb-1">Reschedule Appointment</h3>
            <p className="text-xs text-slate-400 mb-6">Choose a new available slot for Dr. {reschedulingAppointment.doctor_name}.</p>

            {/* Countdown timer for reschedule hold */}
            {activeRescheduleHold && (
              <div className="mb-6 p-3 bg-amber-50 border border-amber-100 rounded-xl flex items-center justify-between text-amber-900 text-sm font-semibold">
                <span className="flex items-center gap-1.5">
                  <svg className="h-4.5 w-4.5 text-amber-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Reschedule Hold Reserved
                </span>
                <span className="font-mono text-base font-bold bg-white px-2 py-0.5 rounded border border-amber-200">
                  {formatTimer(holdTimer)}
                </span>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-600 mb-1">New Date</label>
                <input
                  type="date"
                  min={new Date().toISOString().split("T")[0]}
                  value={rescheduleDate}
                  onChange={(e) => setRescheduleDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-200 rounded-xl text-sm bg-white text-slate-800 focus:outline-none"
                />
              </div>

              {rescheduleDate && (
                <div>
                  <label className="block text-xs font-bold text-slate-600 mb-2">Select Timings</label>
                  {rescheduleSlotsLoading ? (
                    <div className="py-6 text-center text-xs text-slate-400">Loading timing slots...</div>
                  ) : rescheduleSlots.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 italic">No available timings.</div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {rescheduleSlots.map((slot, idx) => {
                        const timeStr = slot.start_time.substring(0, 5);
                        const isSelected = activeRescheduleHold?.start_time === slot.start_time;

                        if (slot.is_available) {
                          return (
                            <button
                              key={idx}
                              onClick={() => handleHoldRescheduleSlot(slot)}
                              className={`p-2 border rounded-lg text-xs font-bold text-center transition-all ${
                                isSelected
                                  ? "bg-teal-600 border-teal-600 text-white"
                                  : "bg-emerald-50/20 border-emerald-100 text-emerald-800 hover:bg-emerald-50"
                              }`}
                            >
                              {timeStr}
                            </button>
                          );
                        } else {
                          return (
                            <button
                              key={idx}
                              disabled
                              className="p-2 border border-slate-50 bg-slate-50 text-slate-400 text-xs text-center cursor-not-allowed"
                            >
                              {timeStr}
                            </button>
                          );
                        }
                      })}
                    </div>
                  )}
                </div>
              )}

              {activeRescheduleHold && (
                <div className="pt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      if (timerRef.current) clearInterval(timerRef.current);
                      setActiveRescheduleHold(null);
                    }}
                    className="px-4 py-2 border border-slate-200 rounded-xl text-sm font-bold text-slate-600 hover:bg-slate-50"
                  >
                    Release Slot
                  </button>
                  <button
                    onClick={handleConfirmReschedule}
                    disabled={bookingLoading}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-sm font-bold shadow-md"
                  >
                    {bookingLoading ? (
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    ) : "Save Reschedule"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
