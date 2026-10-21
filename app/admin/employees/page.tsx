
"use client";

import { FormEvent, useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Company = {
  id: string;
  name: string;
};

type Department = {
  id: string;
  name: string;
};

export default function ManageEmployeesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [password, setPassword] = useState("");

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [companyError, setCompanyError] = useState("");
  const [departmentError, setDepartmentError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  useEffect(() => {
    let active = true;

    async function loadCompanies() {
      setLoadingCompanies(true);
      setCompanyError("");

      const { data, error } = await supabase
        .from("companies")
        .select("id, name")
        .order("name");

      if (!active) return;

      if (error) {
        console.error("Companies query failed:", error);
        setCompanyError(error.message);
      } else {
        setCompanies((data ?? []) as Company[]);
      }

      setLoadingCompanies(false);
    }

    async function loadDepartments() {
      setLoadingDepartments(true);
      setDepartmentError("");

      const { data, error } = await supabase
        .from("departments")
        .select("id, name")
        .order("name");

      if (!active) return;

      if (error) {
        console.error("Departments query failed:", error);
        setDepartmentError(error.message);
      } else {
        setDepartments((data ?? []) as Department[]);
      }

      setLoadingDepartments(false);
    }

    void loadCompanies();
    void loadDepartments();

    return () => {
      active = false;
    };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setErrorMessage("");
    setSuccessMessage("");

    const cleanName = fullName.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanName || !cleanEmail || !companyId || !departmentId) {
      setErrorMessage("Please complete all required fields.");
      return;
    }

    if (password.length < 12 || password.length > 72) {
      setErrorMessage(
        "The temporary password must be between 12 and 72 characters."
      );
      return;
    }

    if (!companies.some((company) => company.id === companyId)) {
      setErrorMessage("Please select a valid company.");
      return;
    }

    if (!departments.some((department) => department.id === departmentId)) {
      setErrorMessage("Please select a valid department.");
      return;
    }

    setSubmitting(true);

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) throw sessionError;

      if (!session?.access_token) {
        throw new Error("Your session has expired. Please sign in again.");
      }

      const response = await fetch("/api/admin/employees", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          fullName: cleanName,
          email: cleanEmail,
          companyId,
          departmentId,
          password,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Unable to create the employee.");
      }

      setSuccessMessage(
        `Employee ${result.employee.fullName} (${result.employee.email}) was created successfully. Share the temporary password securely.`
      );

      setFullName("");
      setEmail("");
      setCompanyId("");
      setDepartmentId("");
      setPassword("");
    } catch (error) {
      console.error("Employee creation failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "An unexpected error occurred."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const fieldClass =
    "mt-1 w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 outline-none transition focus:border-blue-600 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-gray-100";

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/admin"
          className="text-sm font-medium text-blue-700 hover:underline"
        >
          ← Back to Admin Dashboard
        </Link>

        <div className="mt-5">
          <h1 className="text-2xl font-bold tracking-tight">
            Manage Employees
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            Create employee accounts, assign company and department, and set
            temporary passwords.
          </p>
        </div>

        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-semibold">Add New Employee</h2>
          <p className="mt-1 text-sm text-gray-500">
            Employees must change their temporary password before accessing the
            IT support dashboard.
          </p>

          {errorMessage && (
            <div
              role="alert"
              className="mt-5 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div
              role="status"
              className="mt-5 rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800"
            >
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block text-sm font-medium">
              Full name
              <input
                className={fieldClass}
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                maxLength={150}
                autoComplete="name"
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Company email
              <input
                className={fieldClass}
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                maxLength={254}
                autoComplete="off"
                required
              />
            </label>

            <label className="block text-sm font-medium">
              Company
              <select
                className={fieldClass}
                value={companyId}
                onChange={(event) => setCompanyId(event.target.value)}
                disabled={loadingCompanies || !!companyError}
                required
              >
                <option value="">
                  {loadingCompanies
                    ? "Loading companies..."
                    : companyError
                      ? "Could not load companies"
                      : companies.length
                        ? "Select company"
                        : "No companies found"}
                </option>

                {companies.map((company) => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>

              {companyError && (
                <span className="mt-1 block text-xs text-red-600">
                  {companyError}
                </span>
              )}
            </label>

            <label className="block text-sm font-medium">
              Department
              <select
                className={fieldClass}
                value={departmentId}
                onChange={(event) => setDepartmentId(event.target.value)}
                disabled={loadingDepartments || !!departmentError}
                required
              >
                <option value="">
                  {loadingDepartments
                    ? "Loading departments..."
                    : departmentError
                      ? "Could not load departments"
                      : departments.length
                        ? "Select department"
                        : "No departments found"}
                </option>

                {departments.map((department) => (
                  <option key={department.id} value={department.id}>
                    {department.name}
                  </option>
                ))}
              </select>

              {departmentError && (
                <span className="mt-1 block text-xs text-red-600">
                  {departmentError}
                </span>
              )}

              {!departmentError &&
                !loadingDepartments &&
                departments.length === 0 && (
                  <span className="mt-1 block text-xs text-gray-500">
                    No departments were returned by Supabase.
                  </span>
                )}
            </label>

            <label className="block text-sm font-medium sm:col-span-2">
              Temporary password
              <input
                className={fieldClass}
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                required
              />
              <span className="mt-1 block text-xs font-normal text-gray-500">
                Use 12–72 characters. Share the temporary password securely.
              </span>
            </label>

            <div className="rounded-lg bg-gray-50 p-3 text-sm text-gray-600 sm:col-span-2">
              Account role: <strong>Employee</strong>. The server assigns this
              automatically.
            </div>

            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={
                  submitting ||
                  loadingCompanies ||
                  loadingDepartments ||
                  !!companyError ||
                  !!departmentError ||
                  companies.length === 0 ||
                  departments.length === 0
                }
                className="rounded-lg bg-gray-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? "Creating employee..." : "Add Employee"}
              </button>
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
