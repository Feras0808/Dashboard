
"use client";

import { useEffect, useState } from "react";
import type { ChangeEvent, FormEvent } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  File,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Upload,
  X,
} from "lucide-react";

type Company = {
  id: string;
  name: string;
};

type Department = {
  id: string;
  name: string;
};

type SelectedFile = {
  file: File;
  id: string;
};

type UploadedAttachment = {
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
};

const issueTypes = [
  { value: "adler_system", label: "Adler System" },
  { value: "printers_scanners", label: "Printers & Scanners" },
  { value: "networking", label: "Networking" },
  { value: "cctv", label: "CCTV" },
  { value: "email", label: "Email" },
  { value: "others", label: "Others" },
];

const priorities = [
  {
    value: "urgent",
    label: "Urgent",
    description: "System or business is critically affected",
  },
  {
    value: "high",
    label: "High",
    description: "Important issue requiring quick attention",
  },
  {
    value: "normal",
    label: "Normal",
    description: "Regular IT issue",
  },
  {
    value: "low",
    label: "Low",
    description: "Minor issue or request",
  },
];

const BUCKET = "ticket-attachments";
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/pdf",
];

export default function SubmitTicketPage() {
  const router = useRouter();

  const [companies, setCompanies] = useState<Company[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [employeeName, setEmployeeName] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [departmentId, setDepartmentId] = useState("");
  const [issueType, setIssueType] = useState("");
  const [issueOther, setIssueOther] = useState("");
  const [priority, setPriority] = useState("normal");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState("");
  const [success, setSuccess] = useState(false);
  const [ticketNumber, setTicketNumber] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    void loadFormData();
  }, []);

  async function loadFormData() {
    setLoading(true);
    setError("");

    try {
      const [companiesResult, departmentsResult] = await Promise.all([
        supabase.from("companies").select("id, name").order("name"),
        supabase.from("departments").select("id, name").order("name"),
      ]);

      if (companiesResult.error) throw companiesResult.error;
      if (departmentsResult.error) throw departmentsResult.error;

      setCompanies(companiesResult.data || []);
      setDepartments(departmentsResult.data || []);
    } catch (err) {
      console.error("Failed to load form data:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Could not load companies and departments."
      );
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    setError("");

    const selectedFiles = Array.from(event.target.files || []);
    const validFiles: SelectedFile[] = [];
    const errors: string[] = [];

    for (const file of selectedFiles) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        errors.push(
          `${file.name} is not supported. Use PNG, JPG, WEBP or PDF.`
        );
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        errors.push(`${file.name} is larger than 10 MB.`);
        continue;
      }

      validFiles.push({
        file,
        id: crypto.randomUUID(),
      });
    }

    setFiles((current) => [...current, ...validFiles]);

    if (errors.length > 0) {
      setError(errors.join(" "));
    }

    event.target.value = "";
  }

  function removeFile(id: string) {
    setFiles((current) => current.filter((item) => item.id !== id));
  }

  function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;

    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function getFileIcon(file: File) {
    if (file.type.startsWith("image/")) {
      return <ImageIcon size={18} />;
    }

    if (file.type === "application/pdf") {
      return <FileText size={18} />;
    }

    return <File size={18} />;
  }

  async function uploadAttachments(
    storageFolder: string
  ): Promise<UploadedAttachment[]> {
    const uploadedFiles: UploadedAttachment[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i].file;

      setUploadProgress(
        `Uploading attachment ${i + 1} of ${files.length}...`
      );

      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${storageFolder}/${crypto.randomUUID()}-${safeFileName}`;

      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type || "application/octet-stream",
        });

      if (uploadError) {
        throw new Error(
          `Failed to upload "${file.name}": ${uploadError.message}`
        );
      }

      const { data: publicUrlData } = supabase.storage
        .from(BUCKET)
        .getPublicUrl(filePath);

      uploadedFiles.push({
        name: file.name,
        path: filePath,
        url: publicUrlData.publicUrl,
        type: file.type,
        size: file.size,
      });
    }

    return uploadedFiles;
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSuccess(false);

    if (!employeeName.trim()) {
      setError("Please enter your name.");
      return;
    }

    if (!companyId) {
      setError("Please select your company.");
      return;
    }

    if (!departmentId) {
      setError("Please select your department.");
      return;
    }

    if (!issueType) {
      setError("Please select an issue type.");
      return;
    }

    if (issueType === "others" && !issueOther.trim()) {
      setError("Please specify the issue.");
      return;
    }

    if (!description.trim()) {
      setError("Please describe the issue.");
      return;
    }

    setSubmitting(true);
    setUploadProgress("");

    const uploadedPaths: string[] = [];
    let createdTicketId: string | null = null;

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(
          "Your session has expired. Please sign in again."
        );
      }

      let uploadedAttachments: UploadedAttachment[] = [];

      // Upload attachments before inserting the ticket.
      if (files.length > 0) {
        const storageFolder = `${user.id}/${crypto.randomUUID()}`;

        uploadedAttachments = await uploadAttachments(storageFolder);

        uploadedPaths.push(
          ...uploadedAttachments.map((attachment) => attachment.path)
        );
      }

      setUploadProgress("Saving ticket...");

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .insert({
          user_id: user.id,
          employee_name: employeeName.trim(),
          company_id: companyId,
          department_id: departmentId,
          issue_type: issueType,
          issue_other:
            issueType === "others" ? issueOther.trim() : null,
          priority,
          description: description.trim(),
          attachments: uploadedAttachments,
          status: "new",
        })
        .select("id, ticket_number, attachments")
        .single();

      if (ticketError) {
        throw new Error(
          `Ticket could not be saved: ${ticketError.message}`
        );
      }

      if (!ticket) {
        throw new Error(
          "The ticket was submitted, but Supabase returned no ticket record."
        );
      }

      createdTicketId = ticket.id;

      const savedAttachments = Array.isArray(ticket.attachments)
        ? ticket.attachments
        : [];

      if (
        uploadedAttachments.length > 0 &&
        savedAttachments.length !== uploadedAttachments.length
      ) {
        console.error("Attachment metadata mismatch:", {
          uploadedAttachments,
          savedAttachments: ticket.attachments,
        });

        throw new Error(
          "The ticket was created, but the saved attachment metadata did not match the uploaded files. Check the tickets table and its attachments column."
        );
      }

      setTicketNumber(ticket.ticket_number);
      setSuccess(true);

      setEmployeeName("");
      setCompanyId("");
      setDepartmentId("");
      setIssueType("");
      setIssueOther("");
      setPriority("normal");
      setDescription("");
      setFiles([]);
      setUploadProgress("");
    } catch (err) {
      console.error("Ticket submission error:", err);

      // Only remove uploaded files if the ticket was not created.
      if (uploadedPaths.length > 0 && !createdTicketId) {
        const { error: cleanupError } = await supabase.storage
          .from(BUCKET)
          .remove(uploadedPaths);

        if (cleanupError) {
          console.error("Attachment cleanup failed:", cleanupError);
        }
      }

      setError(
        err instanceof Error
          ? err.message
          : "Something went wrong while submitting the ticket."
      );
    } finally {
      setSubmitting(false);
      setUploadProgress("");
    }
  }

  // Header matches the My Tickets page dimensions and layout.
  const header = (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
        <div className="flex min-w-0 items-center">
          <button
            type="button"
            onClick={() => router.push("/employee")}
            className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-950"
          >
            <ArrowLeft size={16} />
            Back
          </button>

          <div className="ml-5 border-l border-gray-200 pl-5 sm:ml-6 sm:pl-6">
            <p className="text-xs text-gray-500">Employee Portal</p>
            <h1 className="font-bold text-gray-900">
              Submit IT Ticket
            </h1>
          </div>
        </div>
      </div>
    </header>
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#f5f7fa]">
        {header}

        <div className="flex min-h-[60vh] items-center justify-center">
          <div className="text-sm text-gray-500">
            Loading ticket form...
          </div>
        </div>
      </main>
    );
  }

  // Success screen
  if (success) {
    return (
      <main className="min-h-screen bg-[#f5f7fa]">
        {header}

        <div className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-6xl items-center justify-center px-4 py-12 sm:px-6">
          <div className="w-full max-w-xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm sm:p-10">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50 text-green-600">
              <CheckCircle2 size={42} />
            </div>

            <h2 className="mt-6 text-3xl font-bold text-gray-950">
              Ticket Submitted
            </h2>

            <p className="mt-3 text-sm leading-6 text-gray-500">
              Your IT support request has been successfully submitted.
              You can track its progress from My Tickets.
            </p>

            <div className="mt-8 rounded-xl border border-gray-200 bg-gray-50 p-6">
              <p className="text-sm text-gray-500">
                Your Ticket Number
              </p>

              <p className="mt-2 text-3xl font-bold tracking-wide text-gray-950">
                {ticketNumber}
              </p>
            </div>

            <div className="mt-6 rounded-xl border border-blue-100 bg-blue-50 p-4 text-left text-sm leading-6 text-blue-800">
              <strong>Status: New</strong>
              <p className="mt-1">
                Your request has been received and is waiting for IT review.
              </p>
            </div>

            <button
              type="button"
              onClick={() => router.push("/employee/tickets")}
              className="mt-6 w-full rounded-xl bg-gray-950 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              View My Tickets
            </button>

            <button
              type="button"
              onClick={() => {
                setSuccess(false);
                setTicketNumber("");
              }}
              className="mt-3 w-full rounded-xl border border-gray-200 bg-white px-5 py-3.5 text-sm font-medium text-gray-800 transition hover:bg-gray-50"
            >
              Submit Another Ticket
            </button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      {header}

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
            <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
            IT Service Desk
          </div>

          <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
            Submit an IT Ticket
          </h2>

          <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
            Tell us what is happening and provide the details our IT team
            needs to resolve your issue.
          </p>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle
              size={18}
              className="mt-0.5 shrink-0"
            />

            <div className="flex-1 leading-6">{error}</div>

            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
              className="rounded-md p-1 transition hover:bg-red-100"
            >
              <X size={18} />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Employee information */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h3 className="font-bold text-gray-900">
                Employee Information
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Enter your details so the IT team can identify your request.
              </p>
            </div>

            <div className="grid gap-5 md:grid-cols-3">
              <div>
                <label
                  htmlFor="employeeName"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Your Name <span className="text-red-500">*</span>
                </label>

                <input
                  id="employeeName"
                  value={employeeName}
                  onChange={(event) => setEmployeeName(event.target.value)}
                  placeholder="Enter your name"
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-gray-950 focus:ring-2 focus:ring-gray-950/5"
                />
              </div>

              <div>
                <label
                  htmlFor="company"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Company <span className="text-red-500">*</span>
                </label>

                <select
                  id="company"
                  value={companyId}
                  onChange={(event) => setCompanyId(event.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/5"
                >
                  <option value="">Select company</option>

                  {companies.map((company) => (
                    <option key={company.id} value={company.id}>
                      {company.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label
                  htmlFor="department"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Department <span className="text-red-500">*</span>
                </label>

                <select
                  id="department"
                  value={departmentId}
                  onChange={(event) => setDepartmentId(event.target.value)}
                  required
                  className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none transition focus:border-gray-950 focus:ring-2 focus:ring-gray-950/5"
                >
                  <option value="">Select department</option>

                  {departments.map((department) => (
                    <option key={department.id} value={department.id}>
                      {department.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </section>

          {/* IT issue */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h3 className="font-bold text-gray-900">IT Issue</h3>

              <p className="mt-1 text-sm text-gray-500">
                Choose the category that best describes your problem.
              </p>
            </div>

            <label className="mb-3 block text-sm font-medium text-gray-700">
              Issue Type <span className="text-red-500">*</span>
            </label>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {issueTypes.map((issue) => (
                <button
                  key={issue.value}
                  type="button"
                  aria-pressed={issueType === issue.value}
                  onClick={() => setIssueType(issue.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    issueType === issue.value
                      ? "border-gray-950 bg-gray-950 text-white shadow-sm"
                      : "border-gray-200 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <span className="text-sm font-semibold">
                    {issue.label}
                  </span>
                </button>
              ))}
            </div>

            {issueType === "others" && (
              <div className="mt-5">
                <label
                  htmlFor="issueOther"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Please specify <span className="text-red-500">*</span>
                </label>

                <input
                  id="issueOther"
                  value={issueOther}
                  onChange={(event) => setIssueOther(event.target.value)}
                  placeholder="Describe the type of issue"
                  required
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-950 focus:ring-2 focus:ring-gray-950/5"
                />
              </div>
            )}
          </section>

          {/* Priority */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h3 className="font-bold text-gray-900">Priority</h3>

              <p className="mt-1 text-sm text-gray-500">
                Select the urgency level of your request.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {priorities.map((item) => (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={priority === item.value}
                  onClick={() => setPriority(item.value)}
                  className={`rounded-xl border p-4 text-left transition ${
                    priority === item.value
                      ? "border-gray-950 bg-gray-950 text-white"
                      : "border-gray-200 bg-white text-gray-800 hover:border-gray-400 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-sm font-semibold">
                    {item.label}
                  </div>

                  <div
                    className={`mt-2 text-xs leading-5 ${
                      priority === item.value
                        ? "text-gray-300"
                        : "text-gray-500"
                    }`}
                  >
                    {item.description}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Description */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="mb-5">
              <h3 className="font-bold text-gray-900">
                Issue Description
              </h3>

              <p className="mt-1 text-sm text-gray-500">
                Include error messages and any steps needed to reproduce
                the issue.
              </p>
            </div>

            <label
              htmlFor="description"
              className="mb-2 block text-sm font-medium text-gray-700"
            >
              Description <span className="text-red-500">*</span>
            </label>

            <textarea
              id="description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={6}
              required
              placeholder="Explain the problem in as much detail as possible..."
              className="w-full resize-y rounded-xl border border-gray-200 px-4 py-3 text-sm leading-6 outline-none transition placeholder:text-gray-400 focus:border-gray-950 focus:ring-2 focus:ring-gray-950/5"
            />
          </section>

          {/* Attachments */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                <Paperclip size={20} />
              </div>

              <div>
                <h3 className="font-bold text-gray-900">Attachments</h3>

                <p className="mt-1 text-sm text-gray-500">
                  Add screenshots, photos or PDF documents.
                </p>
              </div>
            </div>

            <label className="mt-5 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-gray-200 bg-gray-50/50 px-6 py-10 text-center transition hover:border-gray-400 hover:bg-gray-50">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white text-gray-600 shadow-sm">
                <Upload size={25} />
              </div>

              <p className="mt-4 text-sm font-semibold text-gray-800">
                Click to upload files
              </p>

              <p className="mt-2 text-xs text-gray-500">
                PNG, JPG, WEBP or PDF · Maximum 10 MB per file
              </p>

              <input
                type="file"
                multiple
                accept=".png,.jpg,.jpeg,.webp,.pdf"
                onChange={handleFileSelect}
                className="hidden"
              />
            </label>

            {files.length > 0 && (
              <div className="mt-5 space-y-3">
                <p className="text-sm font-semibold text-gray-700">
                  Selected files ({files.length})
                </p>

                {files.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center gap-3 rounded-xl border border-gray-200 bg-white p-3"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                      {getFileIcon(item.file)}
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-800">
                        {item.file.name}
                      </p>

                      <p className="mt-1 text-xs text-gray-500">
                        {formatFileSize(item.file.size)}
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeFile(item.id)}
                      aria-label={`Remove ${item.file.name}`}
                      className="rounded-lg p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-600"
                    >
                      <X size={18} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Submit */}
          <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            {uploadProgress && (
              <div
                role="status"
                className="mb-5 rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800"
              >
                {uploadProgress}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-7 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                  Submitting...
                </>
              ) : (
                <>
                  <Upload size={17} />
                  Submit IT Ticket
                </>
              )}
            </button>
          </section>
        </form>

        <p className="mt-6 text-center text-xs text-gray-400">
          Employee Portal · IT Support
        </p>
      </section>
    </main>
  );
}
