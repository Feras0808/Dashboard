
"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [allowed, setAllowed] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function checkAccount() {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active) return;

      if (!user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, must_change_password")
        .eq("id", user.id)
        .single();

      if (!active) return;

      if (error) {
        setErrorMessage("Unable to verify your account. Contact IT if this continues.");
      } else if (!profile?.must_change_password) {
        router.replace(profile?.role === "admin" ? "/admin" : "/employee");
        return;
      } else {
        setAllowed(true);
      }

      setLoading(false);
    }

    void checkAccount();

    return () => {
      active = false;
    };
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");

    if (password.length < 6) {
      setErrorMessage("Use at least 6 characters for your new password.");
      return;
    }

    if (password !== confirmPassword) {
      setErrorMessage("The passwords do not match.");
      return;
    }

    setSubmitting(true);

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) throw updateError;

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.access_token) {
        throw new Error("Please sign in again to complete account setup.");
      }

      const response = await fetch("/api/account/complete-password-setup", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to complete account setup.");
      }

      router.replace("/employee");
      router.refresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to change password."
      );
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        Checking your account…
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border bg-white p-6 shadow-sm sm:p-8">
        <h1 className="text-2xl font-bold">Change your temporary password</h1>
        <p className="mt-2 text-sm text-gray-600">
          Choose a new password before accessing the IT ticket dashboard.
        </p>

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-800">
            {errorMessage}
          </p>
        )}

        {allowed && (
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <label className="block text-sm font-medium">
              New password
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2.5"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Confirm new password
              <input
                className="mt-1 w-full rounded-lg border px-3 py-2.5"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </label>

            <button
              disabled={submitting}
              className="w-full rounded-lg bg-gray-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
            >
              {submitting ? "Updating…" : "Save New Password"}
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
