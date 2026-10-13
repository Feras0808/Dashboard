
"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  AlertCircle,
  Loader2,
  Lock,
  Mail,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleLogin(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      const { data, error: loginError } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (loginError) {
        setError(loginError.message);
        return;
      }

      if (!data.user) {
        setError("Could not sign in.");
        return;
      }

      // Retrieve the user's role.
      const { data: profile, error: profileError } =
        await supabase
          .from("profiles")
          .select("role")
          .eq("id", data.user.id)
          .single();

      if (profileError || !profile) {
        console.error(profileError);

        await supabase.auth.signOut();

        setError(
          "Your account profile has not been configured yet."
        );
        return;
      }

      // Redirect according to the user's role.
      if (profile.role === "admin") {
        router.push("/admin");
      } else {
        router.push("/employee");
      }

      router.refresh();
    } catch (err) {
      console.error("Login error:", err);
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa] px-6 py-10">
      <div className="w-full max-w-md">

        {/* Company Logo */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-5 flex min-h-32 w-full max-w-xs items-center justify-center rounded-2xl border border-gray-200 bg-white px-8 py-5 shadow-sm">
            <Image
              src="/optimized1.png"
              alt="Optimized Holding Company Logo"
              width={280}
              height={140}
              priority
              className="h-auto max-h-24 w-auto max-w-full object-contain"
            />
          </div>

          {/* Portal Heading */}
          <h1 className="!text-gray-900 text-2xl font-bold leading-tight tracking-tight sm:text-3xl">
            <span className="!text-gray-900">
              Optimized Holding
            </span>

            <span className="mt-1 block !text-gray-900 text-xl sm:text-2xl">
              IT Support Portal
            </span>
          </h1>

          <p className="mt-3 text-sm text-gray-500">
            Sign in to access the IT support system
          </p>
        </div>

        {/* Login Card */}
        <div className="rounded-3xl border border-gray-200 bg-white p-8 shadow-sm">
          <h2 className="text-xl font-bold text-gray-900">
            Sign In
          </h2>

          <p className="mt-1 text-sm text-gray-500">
            Enter your company account details.
          </p>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="mt-5 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
            >
              <AlertCircle
                size={18}
                className="mt-0.5 shrink-0"
              />

              <span>{error}</span>
            </div>
          )}

          <form
            onSubmit={handleLogin}
            className="mt-6 space-y-5"
          >
            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Email
              </label>

              <div className="relative">
                <Mail
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@company.com"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 py-3 pl-11 pr-4 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-gray-700"
              >
                Password
              </label>

              <div className="relative">
                <Lock
                  size={18}
                  className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
                />

                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  required
                  disabled={loading}
                  className="w-full rounded-xl border border-gray-300 py-3 pl-11 pr-4 text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-900 focus:ring-1 focus:ring-gray-900 disabled:cursor-not-allowed disabled:opacity-70"
                />
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3.5 font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    size={18}
                    className="animate-spin"
                  />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-xs text-gray-400">
          Optimized Holding | Internal IT Support
        </p>
      </div>
    </main>
  );
}