
"use client";

import { useState } from "react";
import {
    KeyRound,
    X,
    Eye,
    EyeOff,
    Loader2,
    CheckCircle2,
    AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
    employeeId: string;
    employeeName: string;
};

export default function AdminResetEmployeePassword({
    employeeId,
    employeeName,
}: Props) {
    const [open, setOpen] = useState(false);
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [error, setError] = useState("");

    function closeModal() {
        if (loading) return;

        setOpen(false);
        setPassword("");
        setConfirmPassword("");
        setMessage("");
        setError("");
        setShowPassword(false);
    }

    async function handleReset() {
        setError("");
        setMessage("");

        if (password.length < 8) {
            setError("Password must contain at least 8 characters.");
            return;
        }

        if (password.length > 72) {
            setError("Password cannot exceed 72 characters.");
            return;
        }

        if (password !== confirmPassword) {
            setError("The passwords do not match.");
            return;
        }

        setLoading(true);

        try {
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError || !session?.access_token) {
                throw new Error("Your session has expired. Please log in again.");
            }

            const response = await fetch(
                "/api/admin/reset-employee-password",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        employeeId,
                        newPassword: password,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || "Password reset failed.");
            }

            setMessage("Password updated successfully.");
            setPassword("");
            setConfirmPassword("");
        } catch (err) {
            setError(
                err instanceof Error
                    ? err.message
                    : "Something went wrong. Please try again."
            );
        } finally {
            setLoading(false);
        }
    }

    return (
        <>
            <button
                type="button"
                onClick={() => {
                    setError("");
                    setMessage("");
                    setOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
                <KeyRound className="h-4 w-4" />
                Reset Password
            </button>

            {open && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
                        <div className="flex items-start justify-between gap-4">
                            <div className="flex items-center gap-3">
                                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                                    <KeyRound className="h-5 w-5" />
                                </div>

                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">
                                        Reset Password
                                    </h2>
                                    <p className="mt-1 text-sm text-gray-500">
                                        Set a new password for this employee.
                                    </p>
                                </div>
                            </div>

                            <button
                                type="button"
                                onClick={closeModal}
                                disabled={loading}
                                className="rounded-lg p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700"
                                aria-label="Close"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                                Employee
                            </p>
                            <p className="mt-1 font-semibold text-gray-900">
                                {employeeName}
                            </p>
                        </div>

                        {message ? (
                            <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4">
                                <div className="flex items-start gap-2 text-green-700">
                                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                                    <div>
                                        <p className="text-sm font-semibold">{message}</p>
                                        <p className="mt-1 text-xs text-green-700">
                                            The new password is active immediately. No email was sent.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="mt-5">
                                    <label
                                        htmlFor="employee-new-password"
                                        className="mb-2 block text-sm font-semibold text-gray-700"
                                    >
                                        New Password
                                    </label>

                                    <div className="relative">
                                        <input
                                            id="employee-new-password"
                                            type={showPassword ? "text" : "password"}
                                            autoComplete="new-password"
                                            value={password}
                                            onChange={(event) => setPassword(event.target.value)}
                                            placeholder="Enter new password"
                                            disabled={loading}
                                            className="w-full rounded-xl border border-gray-300 px-4 py-3 pr-12 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                                        />

                                        <button
                                            type="button"
                                            onClick={() => setShowPassword((value) => !value)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                                            aria-label={showPassword ? "Hide password" : "Show password"}
                                        >
                                            {showPassword ? (
                                                <EyeOff className="h-5 w-5" />
                                            ) : (
                                                <Eye className="h-5 w-5" />
                                            )}
                                        </button>
                                    </div>
                                    <p className="mt-1.5 text-xs text-gray-500">
                                        Use at least 8 characters.
                                    </p>
                                </div>

                                <div className="mt-4">
                                    <label
                                        htmlFor="employee-confirm-password"
                                        className="mb-2 block text-sm font-semibold text-gray-700"
                                    >
                                        Confirm New Password
                                    </label>

                                    <input
                                        id="employee-confirm-password"
                                        type={showPassword ? "text" : "password"}
                                        autoComplete="new-password"
                                        value={confirmPassword}
                                        onChange={(event) => setConfirmPassword(event.target.value)}
                                        placeholder="Confirm new password"
                                        disabled={loading}
                                        className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:bg-gray-100"
                                    />
                                </div>

                                {error && (
                                    <div className="mt-4 flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                                        <p>{error}</p>
                                    </div>
                                )}

                                <div className="mt-6 flex gap-3">
                                    <button
                                        type="button"
                                        onClick={closeModal}
                                        disabled={loading}
                                        className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                                    >
                                        Cancel
                                    </button>

                                    <button
                                        type="button"
                                        onClick={handleReset}
                                        disabled={loading || !password || !confirmPassword}
                                        className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                                    >
                                        {loading ? (
                                            <>
                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                Updating...
                                            </>
                                        ) : (
                                            "Update Password"
                                        )}
                                    </button>
                                </div>
                            </>
                        )}

                        {message && (
                            <button
                                type="button"
                                onClick={closeModal}
                                className="mt-5 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
                            >
                                Done
                            </button>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
