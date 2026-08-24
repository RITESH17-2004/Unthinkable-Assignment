"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

function GoogleCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const token = localStorage.getItem("token");
    const storedUser = localStorage.getItem("user");

    if (!token || !storedUser) {
      setErrorMsg("Session expired. Please log in again.");
      setTimeout(() => {
        router.push("/login");
      }, 3000);
      return;
    }

    if (!code) {
      setErrorMsg("Authorization code not found from Google callback.");
      setTimeout(() => {
        goBackToDashboard();
      }, 3000);
      return;
    }

    const connectGoogleCalendar = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/v1/google-calendar/connect`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ code }),
        });

        if (res.ok) {
          alert("Successfully connected Google Calendar to MediFlow!");
          goBackToDashboard();
        } else {
          const errData = await res.json().catch(() => ({}));
          setErrorMsg(errData.detail || "Failed to exchange Google credentials.");
          setTimeout(() => {
            goBackToDashboard();
          }, 4000);
        }
      } catch (e) {
        console.error(e);
        setErrorMsg("Failed to connect to backend server.");
        setTimeout(() => {
          goBackToDashboard();
        }, 4000);
      }
    };

    connectGoogleCalendar();
  }, [searchParams]);

  const goBackToDashboard = () => {
    try {
      const storedUser = localStorage.getItem("user");
      if (storedUser) {
        const user = JSON.parse(storedUser);
        if (user.role === "PATIENT") {
          router.push("/patient");
          return;
        } else if (user.role === "DOCTOR") {
          router.push("/doctor");
          return;
        }
      }
    } catch (e) {
      console.error(e);
    }
    router.push("/login");
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-2xl shadow-xl border border-slate-100 p-8 max-w-md w-full text-center space-y-6">
        <div className="flex justify-center">
          {errorMsg ? (
            <div className="w-16 h-16 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 text-3xl">
              ⚠️
            </div>
          ) : (
            <div className="w-16 h-16 bg-teal-50 rounded-full flex items-center justify-center text-teal-600 text-3xl animate-bounce">
              📅
            </div>
          )}
        </div>

        <h3 className="text-xl font-black text-slate-900">
          {errorMsg ? "Connection Failed" : "Google Calendar Integration"}
        </h3>

        <p className="text-sm text-slate-500 leading-relaxed">
          {errorMsg ? errorMsg : "Completing authorization checks and linking your Google account. Please wait..."}
        </p>

        {!errorMsg && (
          <div className="flex justify-center">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
          </div>
        )}

        <p className="text-xs text-slate-400">
          Redirecting you back to dashboard shortly.
        </p>
      </div>
    </div>
  );
}

export default function GoogleCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
          <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      }
    >
      <GoogleCallbackContent />
    </Suspense>
  );
}
