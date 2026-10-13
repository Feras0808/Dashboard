"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Clock3,
  LogOut,
  Plus,
  Ticket,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type Profile = {
  full_name: string;
};

export default function EmployeeDashboard() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();

    setProfile(data);

    setLoading(false);
  }

  async function logout() {
    await supabase.auth.signOut();

    router.replace("/login");
    router.refresh();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="text-gray-500">
          Loading...
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa]">

      {/* Header */}
      <header className="border-b bg-white">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-6">

          <div className="flex items-center gap-3">

            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-950 text-white">
              <Ticket size={20} />
            </div>

            <div>
              <p className="font-bold text-gray-900">
                IT Support
              </p>

              <p className="text-xs text-gray-500">
                Employee Portal
              </p>
            </div>

          </div>

          <button
            onClick={logout}
            className="flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
          >
            <LogOut size={16} />
            Sign Out
          </button>

        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-10">

        {/* Welcome */}
        <div>
          <p className="text-sm text-gray-500">
            Welcome back
          </p>

          <h1 className="mt-1 text-3xl font-bold text-gray-900">
            {profile?.full_name || "Employee"}
          </h1>

          <p className="mt-2 text-gray-500">
            How can we help you today?
          </p>
        </div>

        {/* Cards */}
        <div className="mt-8 grid gap-5 md:grid-cols-2">

          {/* Submit */}
          <button
            onClick={() =>
              router.push("/employee/submit")
            }
            className="group rounded-3xl border border-gray-200 bg-white p-7 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >

            <div className="flex items-start justify-between">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-950 text-white">
                <Plus size={24} />
              </div>

              <ArrowRight
                size={20}
                className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-gray-900"
              />

            </div>

            <h2 className="mt-6 text-xl font-bold text-gray-900">
              Submit IT Ticket
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Report a technical issue or request IT assistance.
            </p>

          </button>

          {/* My tickets */}
          <button
            onClick={() =>
              router.push("/employee/tickets")
            }
            className="group rounded-3xl border border-gray-200 bg-white p-7 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-md"
          >

            <div className="flex items-start justify-between">

              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gray-100 text-gray-900">
                <Clock3 size={24} />
              </div>

              <ArrowRight
                size={20}
                className="text-gray-400 transition group-hover:translate-x-1 group-hover:text-gray-900"
              />

            </div>

            <h2 className="mt-6 text-xl font-bold text-gray-900">
              My Tickets
            </h2>

            <p className="mt-2 text-sm leading-6 text-gray-500">
              Check your submitted tickets and see their current status.
            </p>

          </button>

        </div>

      </section>

    </main>
  );
}