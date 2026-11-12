
"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  Loader2,
  RefreshCw,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import AdminResetEmployeePassword from "@/components/admin-reset-employee-password";

type Company = {
  id: string;
  name: string;
};

type Department = {
  id: string;
  name: string;
};

type Employee = {
  id: string;
  full_name: string | null;
  email: string;
  company_id: string | null;
  department_id: string | null;
};

export default function ManageEmployeesPage() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [password, setPassword] = useState("");

  const [loadingCompanies, setLoadingCompanies] = useState(true);
  const [loadingDepartments, setLoadingDepartments] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(true);
  const [refreshingEmployees, setRefreshingEmployees] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [companyError, setCompanyError] = useState("");
  const [departmentError, setDepartmentError] = useState("");
  const [employeeError, setEmployeeError] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  // Load existing employees from the secure server API.
  const loadEmployees = useCallback(async (refresh = false) => {
    if (refresh) {
      setRefreshingEmployees(true);
    } else {
      setLoadingEmployees(true);
    }

    setEmployeeError("");

    try {
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError || !session?.access_token) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      const response = await fetch("/api/admin/employees", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        cache: "no-store",
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.error || "Could not load employees."
        );
      }

      setEmployees(result.employees ?? []);
    } catch (error) {
      console.error("Employee loading failed:", error);

      setEmployeeError(
        error instanceof Error
          ? error.message
          : "Could not load employees."
      );
    } finally {
      setLoadingEmployees(false);
      setRefreshingEmployees(false);
    }
  }, []);

  // Load companies, departments and employees.
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
    void loadEmployees();

    return () => {
      active = false;
    };
  }, [loadEmployees]);

  // Create a new employee.
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

    if (password.length < 6 || password.length > 72) {
      setErrorMessage(
        "The temporary password must be between 6 and 72 characters."
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
        throw new Error(
          "Your session has expired. Please sign in again."
        );
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
        throw new Error(
          result.error || "Unable to create the employee."
        );
      }

      setSuccessMessage(
        `Employee ${result.employee.fullName} (${result.employee.email}) was created successfully. Share the temporary password securely.`
      );

      setFullName("");
      setEmail("");
      setCompanyId("");
      setDepartmentId("");
      setPassword("");

      await loadEmployees(true);
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

  function getCompanyName(id: string | null) {
    return companies.find((company) => company.id === id)?.name ?? "—";
  }

  function getDepartmentName(id: string | null) {
    return (
      departments.find((department) => department.id === id)?.name ?? "—"
    );
  }

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 sm:px-6">
      <div className="mx-auto max-w-5xl">
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
            Create employee accounts, assign company and department, manage
            existing employees, and reset passwords.
          </p>
        </div>

        {/* ADD NEW EMPLOYEE */}
        <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-7">
          <h2 className="text-lg font-semibold">Add New Employee</h2>

          <p className="mt-1 text-sm text-gray-500">
            Employees must change their temporary password before accessing
            the IT support dashboard.
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

          <form
            onSubmit={handleSubmit}
            className="mt-6 grid gap-5 sm:grid-cols-2"
          >
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
                minLength={6}
                maxLength={72}
                autoComplete="new-password"
                required
              />
              <span className="mt-1 block text-xs font-normal text-gray-500">
                Use 6–72 characters. Share the temporary password securely.
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

        {/* EXISTING EMPLOYEES */}
        <section className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 p-5 sm:p-6">
            <div>
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-700" />
                <h2 className="text-lg font-semibold">
                  Existing Employees
                </h2>
              </div>

              <p className="mt-1 text-sm text-gray-500">
                {employees.length} employee
                {employees.length !== 1 ? "s" : ""} registered
              </p>
            </div>

            <button
              type="button"
              onClick={() => void loadEmployees(true)}
              disabled={refreshingEmployees || loadingEmployees}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshingEmployees ? "animate-spin" : ""
                  }`}
              />
              Refresh
            </button>
          </div>

          {employeeError && (
            <div className="m-5 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <p className="font-semibold">
                  Could not load employees
                </p>
                <p className="mt-1">{employeeError}</p>
              </div>
            </div>
          )}

          {loadingEmployees ? (
            <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-gray-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              Loading employees...
            </div>
          ) : employees.length === 0 && !employeeError ? (
            <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
              <Users className="h-8 w-8 text-gray-300" />
              <p className="mt-3 font-semibold text-gray-800">
                No employees found
              </p>
              <p className="mt-1 text-sm text-gray-500">
                Employees you create will appear here.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[850px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-4 font-medium">Employee</th>
                    <th className="px-5 py-4 font-medium">Company</th>
                    <th className="px-5 py-4 font-medium">Department</th>
                    <th className="px-5 py-4 text-right font-medium">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {employees.map((employee) => (
                    <tr
                      key={employee.id}
                      className="transition hover:bg-gray-50"
                    >
                      <td className="px-5 py-4">
                        <p className="font-semibold text-gray-900">
                          {employee.full_name || "Unnamed employee"}
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                          {employee.email || "Email unavailable"}
                        </p>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {getCompanyName(employee.company_id)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {getDepartmentName(employee.department_id)}
                      </td>

                      <td className="px-5 py-4 text-right">
                        <AdminResetEmployeePassword
                          employeeId={employee.id}
                          employeeName={
                            employee.full_name || employee.email || "Employee"
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
