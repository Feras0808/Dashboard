"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
  MessageSquareText,
  Paperclip,
  Save,
  Ticket,
  User,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Attachment = {
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
};

type ResolutionFeedback = {
  id: string;
  ticket_id: string;
  user_id: string;
  decision: "confirmed_solved" | "still_not_solved";
  message: string | null;
  attachments: unknown;
  created_at: string;
};

type TicketData = {
  id: string;
  ticket_number: string;
  employee_name: string;
  issue_type: string;
  issue_other: string | null;
  description: string;
  priority: string;
  status: string;
  admin_response: string | null;
  attachments: unknown;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string;
  company: { name: string } | null;
  department: { name: string } | null;
};

const issueLabels: Record<string, string> = {
  adler_system: "Adler System",
  printers_scanners: "Printers & Scanners",
  networking: "Networking",
  cctv: "CCTV",
  email: "Email",
  others: "Others",
};

const priorityStyles: Record<string, string> = {
  urgent: "bg-red-50 text-red-700 border-red-200",
  high: "bg-orange-50 text-orange-700 border-orange-200",
  normal: "bg-yellow-50 text-yellow-700 border-yellow-200",
  low: "bg-green-50 text-green-700 border-green-200",
};

const statusStyles: Record<string, string> = {
  new: "bg-blue-50 text-blue-700 border-blue-200",
  in_progress: "bg-orange-50 text-orange-700 border-orange-200",
  completed: "bg-green-50 text-green-700 border-green-200",
  cancelled: "bg-gray-100 text-gray-600 border-gray-200",
};

function formatLabel(value: string) {
  return value
    .replaceAll("_", " ")
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatDate(date: string | null) {
  if (!date) return "—";

  return new Date(date).toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatFileSize(bytes: number) {
  if (!bytes || Number.isNaN(bytes)) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;

  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Normalizes attachment metadata saved as an array, JSON string,
 * object containing attachments/files/items/data, or a single object.
 */
function normalizeAttachments(value: unknown): Attachment[] {
  let parsed: unknown = value;

  if (typeof parsed === "string") {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return [];
    }
  }

  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    const object = parsed as Record<string, unknown>;

    if (
      "attachments" in object ||
      "files" in object ||
      "items" in object ||
      "data" in object
    ) {
      parsed =
        object.attachments ??
        object.files ??
        object.items ??
        object.data ??
        [];
    } else if (
      "path" in object ||
      "url" in object ||
      "name" in object ||
      "fileName" in object
    ) {
      parsed = [object];
    } else {
      return [];
    }
  }

  if (!Array.isArray(parsed)) return [];

  return parsed
    .filter(
      (item): item is Record<string, unknown> =>
        item !== null && typeof item === "object" && !Array.isArray(item)
    )
    .map((item) => {
      const path = String(
        item.path ??
          item.filePath ??
          item.storage_path ??
          item.fullPath ??
          item.file_path ??
          ""
      );

      const url = String(
        item.url ??
          item.publicUrl ??
          item.public_url ??
          item.downloadURL ??
          item.downloadUrl ??
          ""
      );

      const name = String(
        item.name ??
          item.fileName ??
          item.filename ??
          item.originalName ??
          (path ? path.split("/").pop() : "") ??
          "Attachment"
      );

      return {
        name,
        path,
        url,
        type: String(
          item.type ??
            item.mimeType ??
            item.mimetype ??
            item.contentType ??
            ""
        ),
        size: Number(item.size ?? item.fileSize ?? 0) || 0,
      };
    });
}

/**
 * Resolves attachment URLs from saved URLs or paths in the
 * ticket-attachments Supabase Storage bucket.
 */
function getAttachmentUrl(attachment: Attachment) {
  const savedUrl = attachment.url.trim();
  const path = attachment.path.trim();

  if (savedUrl && /^https?:\/\//i.test(savedUrl)) {
    return savedUrl;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!path) return savedUrl;

  const objectPath = path
    .replace(/^\/+/, "")
    .replace(/^ticket-attachments\//, "");

  const { data } = supabase.storage
    .from("ticket-attachments")
    .getPublicUrl(objectPath);

  return data.publicUrl || savedUrl;
}

function isImageAttachment(attachment: Attachment) {
  return (
    attachment.type.toLowerCase().startsWith("image/") ||
    /\.(png|jpe?g|gif|webp|bmp|svg|avif|heic)$/i.test(
      `${attachment.name} ${attachment.path}`
    )
  );
}

export default function TicketDetailsClient({
  ticketId,
}: {
  ticketId: string;
}) {
  const router = useRouter();

  const [ticket, setTicket] = useState<TicketData | null>(null);
  const [feedback, setFeedback] = useState<ResolutionFeedback[]>([]);
  const [status, setStatus] = useState("");
  const [priority, setPriority] = useState("");
  const [adminResponse, setAdminResponse] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pageError, setPageError] = useState("");
  const [imageErrors, setImageErrors] = useState<string[]>([]);

  const loadTicket = useCallback(async () => {
    setLoading(true);
    setPageError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profileError || profile?.role !== "admin") {
        router.replace("/login");
        return;
      }

      const { data, error } = await supabase
        .from("tickets")
        .select(`
          id,
          ticket_number,
          employee_name,
          issue_type,
          issue_other,
          description,
          priority,
          status,
          admin_response,
          attachments,
          created_at,
          started_at,
          completed_at,
          updated_at,
          company:companies(name),
          department:departments(name)
        `)
        .eq("id", ticketId)
        .single();

      if (error) throw error;

      const ticketData = data as unknown as TicketData;

      setTicket(ticketData);
      setStatus(ticketData.status);
      setPriority(ticketData.priority);
      setAdminResponse(ticketData.admin_response || "");
      setImageErrors([]);

      // Load employee resolution feedback for this ticket.
      const {
        data: feedbackData,
        error: feedbackError,
      } = await supabase
        .from("ticket_resolution_feedback")
        .select(
          "id, ticket_id, user_id, decision, message, attachments, created_at"
        )
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });

      if (feedbackError) {
        console.error("Could not load resolution feedback:", feedbackError);
        setFeedback([]);
      } else {
        setFeedback((feedbackData || []) as ResolutionFeedback[]);
      }
    } catch (error) {
      console.error("Error loading ticket:", error);

      setPageError(
        error instanceof Error
          ? error.message
          : "Could not load this ticket."
      );

      setTicket(null);
    } finally {
      setLoading(false);
    }
  }, [ticketId, router]);

  useEffect(() => {
    if (ticketId) void loadTicket();
  }, [ticketId, loadTicket]);

  async function saveChanges() {
    if (!ticket) return;

    setSaving(true);
    setPageError("");

    try {
      const now = new Date().toISOString();

      const updates: {
        status: string;
        priority: string;
        admin_response: string | null;
        started_at?: string;
        completed_at?: string | null;
      } = {
        status,
        priority,
        admin_response: adminResponse.trim() || null,
      };

      if (
        status === "in_progress" &&
        ticket.status !== "in_progress" &&
        !ticket.started_at
      ) {
        updates.started_at = now;
      }

      if (status === "completed" && ticket.status !== "completed") {
        updates.completed_at = now;

        if (!ticket.started_at) {
          updates.started_at = now;
        }
      } else if (status !== "completed" && ticket.status === "completed") {
        updates.completed_at = null;
      }

      const { data, error } = await supabase
        .from("tickets")
        .update(updates)
        .eq("id", ticket.id)
        .select(`
          id,
          ticket_number,
          employee_name,
          issue_type,
          issue_other,
          description,
          priority,
          status,
          admin_response,
          attachments,
          created_at,
          started_at,
          completed_at,
          updated_at,
          company:companies(name),
          department:departments(name)
        `)
        .single();

      if (error) throw error;

      const updatedTicket = data as unknown as TicketData;

      setTicket(updatedTicket);
      setStatus(updatedTicket.status);
      setPriority(updatedTicket.priority);
      setAdminResponse(updatedTicket.admin_response || "");

      // Refresh feedback as well, so the rejection indicator stays current.
      const { data: feedbackData, error: feedbackError } = await supabase
        .from("ticket_resolution_feedback")
        .select(
          "id, ticket_id, user_id, decision, message, attachments, created_at"
        )
        .eq("ticket_id", ticket.id)
        .order("created_at", { ascending: false });

      if (feedbackError) {
        console.error("Could not refresh resolution feedback:", feedbackError);
      } else {
        setFeedback((feedbackData || []) as ResolutionFeedback[]);
      }

      alert("Ticket updated successfully.");
    } catch (error) {
      console.error("Error updating ticket:", error);

      setPageError(
        error instanceof Error
          ? error.message
          : "Could not update the ticket."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="flex items-center gap-3 text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading ticket...
        </div>
      </main>
    );
  }

  if (!ticket) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa] px-6">
        <div className="max-w-lg text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-gray-400" />

          <h1 className="mt-5 text-xl font-bold text-gray-900">
            Unable to load ticket
          </h1>

          <p className="mt-2 break-words text-sm text-gray-500">
            {pageError || "This ticket could not be found."}
          </p>

          <button
            onClick={() => router.push("/admin")}
            className="mt-6 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            Back to Dashboard
          </button>
        </div>
      </main>
    );
  }

  const attachments = normalizeAttachments(ticket.attachments);

  // The feedback query is ordered newest first.
  // Use the latest decision so an old rejection doesn't stay active forever.
  const latestFeedback = feedback[0];
  const completionRejected =
    latestFeedback?.decision === "still_not_solved";

  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <header className="border-b bg-white">
        <div className="mx-auto flex h-20 max-w-6xl items-center px-6">
          <button
            onClick={() => router.push("/admin")}
            className="flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Tickets
          </button>

          <div className="ml-6 border-l pl-6">
            <p className="text-xs text-gray-500">Ticket</p>
            <h1 className="font-bold text-gray-900">
              {ticket.ticket_number}
            </h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-6 py-8">
        {pageError && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p>{pageError}</p>
          </div>
        )}

        {/* COMPLETION REJECTED WARNING */}
        {completionRejected && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-5"
          >
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />

            <div>
              <h3 className="font-bold text-red-800">
                Employee Rejected Completion
              </h3>

              <p className="mt-1 text-sm leading-6 text-red-700">
                The employee reported that this issue is still unresolved.
                Review their feedback and any attached evidence below before
                marking this ticket as completed again.
              </p>

              {latestFeedback?.created_at && (
                <p className="mt-2 text-xs text-red-600">
                  Rejection submitted: {formatDate(latestFeedback.created_at)}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-3xl font-bold text-gray-900">
                {ticket.ticket_number}
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  priorityStyles[ticket.priority] ||
                  "border-gray-200 bg-gray-100 text-gray-600"
                }`}
              >
                {formatLabel(ticket.priority)}
              </span>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusStyles[ticket.status] ||
                  "border-gray-200 bg-gray-100 text-gray-600"
                }`}
              >
                {formatLabel(ticket.status)}
              </span>

              {completionRejected && (
                <span className="inline-flex items-center gap-1.5 rounded-full border border-red-300 bg-red-100 px-3 py-1 text-xs font-bold text-red-800">
                  <XCircle className="h-3.5 w-3.5" />
                  Completion Rejected
                </span>
              )}
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Submitted {formatDate(ticket.created_at)}
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <InfoCard
            icon={<User className="h-5 w-5" />}
            title="Employee"
            value={ticket.employee_name}
          />

          <InfoCard
            icon={<Building2 className="h-5 w-5" />}
            title="Company"
            value={ticket.company?.name || "—"}
          />

          <InfoCard
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            title="Department"
            value={ticket.department?.name || "—"}
          />
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Issue
              </p>

              <h3 className="mt-2 text-xl font-bold text-gray-900">
                {issueLabels[ticket.issue_type] ||
                  formatLabel(ticket.issue_type)}
              </h3>

              {ticket.issue_type === "others" && ticket.issue_other && (
                <div className="mt-3 rounded-xl bg-gray-50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Employee Specification
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">
                    {ticket.issue_other}
                  </p>
                </div>
              )}

              <div className="mt-6 border-t pt-6">
                <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                  Description
                </p>
                <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-gray-700">
                  {ticket.description}
                </p>
              </div>
            </div>

            {/* ORIGINAL TICKET ATTACHMENTS */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
                  <Paperclip className="h-5 w-5" />
                </div>

                <div>
                  <h3 className="font-semibold text-gray-900">
                    Attachments
                  </h3>
                  <p className="text-sm text-gray-500">
                    Files submitted with this ticket
                  </p>
                </div>

                <span className="ml-auto rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {attachments.length}
                </span>
              </div>

              {attachments.length === 0 ? (
                <div className="mt-5 rounded-xl bg-gray-50 p-5 text-center">
                  <p className="text-sm font-medium text-gray-700">
                    No attachments detected
                  </p>
                  <p className="mt-2 text-xs text-gray-500">
                    The ticket has no readable attachment objects in its
                    saved metadata.
                  </p>
                  <details className="mt-3 text-left">
                    <summary className="cursor-pointer text-xs text-gray-500">
                      Show saved attachment data
                    </summary>
                    <pre className="mt-3 overflow-auto rounded-lg bg-gray-100 p-3 text-xs text-gray-700">
                      {JSON.stringify(ticket.attachments, null, 2)}
                    </pre>
                  </details>
                </div>
              ) : (
                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  {attachments.map((attachment, index) => {
                    const url = getAttachmentUrl(attachment);
                    const key =
                      attachment.path ||
                      attachment.url ||
                      `${attachment.name}-${index}`;
                    const image = isImageAttachment(attachment);
                    const failed = imageErrors.includes(key);

                    return (
                      <div
                        key={key}
                        className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                      >
                        {image && url && !failed && (
                          <a
                            href={url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block bg-gray-50"
                            title="Open image in a new tab"
                          >
                            <img
                              src={url}
                              alt={attachment.name}
                              className="h-56 w-full object-contain"
                              onError={() => {
                                setImageErrors((previous) =>
                                  previous.includes(key)
                                    ? previous
                                    : [...previous, key]
                                );
                              }}
                            />
                          </a>
                        )}

                        {image && failed && (
                          <div className="flex min-h-28 flex-col items-center justify-center gap-2 bg-red-50 p-4 text-center text-sm text-red-700">
                            <AlertCircle className="h-6 w-6" />
                            Image could not load.
                            <span className="break-all text-xs text-gray-600">
                              Check the file path and bucket access.
                            </span>
                          </div>
                        )}

                        {!image && (
                          <div className="flex h-20 items-center justify-center bg-gray-50">
                            <FileText className="h-8 w-8 text-gray-400" />
                          </div>
                        )}

                        <div className="flex items-center gap-3 p-4">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-600">
                            {image ? (
                              <ImageIcon className="h-5 w-5" />
                            ) : (
                              <FileText className="h-5 w-5" />
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-gray-900">
                              {attachment.name || "Attachment"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                              {attachment.type || "File"}
                              {attachment.size
                                ? ` · ${formatFileSize(attachment.size)}`
                                : ""}
                            </p>
                          </div>

                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex shrink-0 items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                            >
                              {image ? (
                                <ExternalLink className="h-4 w-4" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              Open
                            </a>
                          ) : (
                            <span className="text-xs text-red-600">
                              Missing path
                            </span>
                          )}
                        </div>

                        <details className="border-t border-gray-100 px-4 py-3">
                          <summary className="cursor-pointer text-xs text-gray-500">
                            Debug file path
                          </summary>
                          <p className="mt-2 break-all text-xs text-gray-600">
                            Path: {attachment.path || "(empty)"}
                          </p>
                          <p className="mt-2 break-all text-xs text-gray-600">
                            URL: {url || "(empty)"}
                          </p>
                        </details>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* EMPLOYEE RESOLUTION FEEDBACK */}
            <div
              className={`rounded-2xl border p-6 shadow-sm ${
                completionRejected
                  ? "border-red-200 bg-red-50/50"
                  : "border-gray-200 bg-white"
              }`}
            >
              <div className="flex items-start gap-3">
                <div
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                    completionRejected
                      ? "bg-red-100 text-red-700"
                      : "bg-gray-100 text-gray-700"
                  }`}
                >
                  {completionRejected ? (
                    <XCircle className="h-5 w-5" />
                  ) : (
                    <MessageSquareText className="h-5 w-5" />
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-gray-900">
                    Employee Resolution Feedback
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    Review the employee&apos;s response after the ticket was
                    marked as completed.
                  </p>
                </div>

                <span className="shrink-0 rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-600">
                  {feedback.length}
                </span>
              </div>

              {feedback.length === 0 ? (
                <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-white p-5 text-center">
                  <MessageSquareText className="mx-auto h-6 w-6 text-gray-400" />
                  <p className="mt-2 text-sm font-medium text-gray-700">
                    No employee feedback yet
                  </p>
                  <p className="mt-1 text-xs leading-5 text-gray-500">
                    Feedback will appear here after the employee responds to
                    the completion confirmation.
                  </p>
                </div>
              ) : (
                <div className="mt-5 space-y-4">
                  {feedback.map((item) => {
                    const rejected = item.decision === "still_not_solved";
                    const feedbackAttachments = normalizeAttachments(
                      item.attachments
                    );

                    return (
                      <article
                        key={item.id}
                        className={`rounded-xl border p-5 ${
                          rejected
                            ? "border-red-200 bg-white"
                            : "border-green-200 bg-white"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <span
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-bold ${
                              rejected
                                ? "border-red-200 bg-red-50 text-red-800"
                                : "border-green-200 bg-green-50 text-green-800"
                            }`}
                          >
                            {rejected ? (
                              <XCircle className="h-4 w-4" />
                            ) : (
                              <CheckCircle2 className="h-4 w-4" />
                            )}
                            {rejected
                              ? "Completion Rejected"
                              : "Issue Confirmed Solved"}
                          </span>

                          <span className="text-xs text-gray-500">
                            {formatDate(item.created_at)}
                          </span>
                        </div>

                        {item.message ? (
                          <div className="mt-4">
                            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Employee&apos;s Message
                            </p>
                            <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
                              {item.message}
                            </p>
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-gray-500">
                            No additional message provided.
                          </p>
                        )}

                        {feedbackAttachments.length > 0 && (
                          <div className="mt-5 border-t border-gray-100 pt-4">
                            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                              Employee Evidence ({feedbackAttachments.length})
                            </p>

                            <div className="grid gap-3 sm:grid-cols-2">
                              {feedbackAttachments.map((attachment, index) => {
                                const url = getAttachmentUrl(attachment);
                                const image = isImageAttachment(attachment);
                                const key =
                                  attachment.path ||
                                  attachment.url ||
                                  `${item.id}-${attachment.name}-${index}`;

                                return (
                                  <div
                                    key={key}
                                    className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                                  >
                                    {image && url ? (
                                      <a
                                        href={url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="block bg-gray-50"
                                      >
                                        <img
                                          src={url}
                                          alt={attachment.name || "Employee evidence"}
                                          className="h-48 w-full object-contain"
                                        />
                                      </a>
                                    ) : (
                                      <div className="flex h-20 items-center justify-center bg-gray-50">
                                        <FileText className="h-8 w-8 text-gray-400" />
                                      </div>
                                    )}

                                    <div className="flex items-center gap-3 p-3">
                                      <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm font-medium text-gray-800">
                                          {attachment.name || "Attachment"}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                          {attachment.type || "File"}
                                          {attachment.size
                                            ? ` · ${formatFileSize(attachment.size)}`
                                            : ""}
                                        </p>
                                      </div>

                                      {url && (
                                        <a
                                          href={url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                                        >
                                          <ExternalLink className="h-3.5 w-3.5" />
                                          Open
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* ADMIN RESPONSE */}
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Resolution / Admin Response
              </p>

              <textarea
                value={adminResponse}
                onChange={(event) => setAdminResponse(event.target.value)}
                rows={8}
                placeholder="Write what you did to resolve the issue, or add an update..."
                className="mt-4 w-full resize-none rounded-xl border border-gray-300 px-4 py-3 text-sm leading-6 outline-none transition focus:border-gray-900 focus:ring-1 focus:ring-gray-900"
              />
            </div>
          </div>

          {/* RIGHT SIDEBAR */}
          <div className="space-y-6">
            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900">Ticket Controls</h3>

              <div className="mt-5">
                <label
                  htmlFor="ticket-status"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Status
                </label>
                <select
                  id="ticket-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-gray-900"
                >
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              {completionRejected && (
                <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3">
                  <p className="flex items-center gap-2 text-sm font-semibold text-red-800">
                    <XCircle className="h-4 w-4 shrink-0" />
                    Completion was rejected
                  </p>
                  <p className="mt-1 text-xs leading-5 text-red-700">
                    Review the employee&apos;s feedback before completing
                    this ticket again.
                  </p>
                </div>
              )}

              <div className="mt-5">
                <label
                  htmlFor="ticket-priority"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Priority
                </label>
                <select
                  id="ticket-priority"
                  value={priority}
                  onChange={(event) => setPriority(event.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm outline-none focus:border-gray-900"
                >
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>

              <button
                onClick={saveChanges}
                disabled={saving}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3.5 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    Save Changes
                  </>
                )}
              </button>
            </div>

            <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h3 className="font-semibold text-gray-900">Timeline</h3>

              <div className="mt-6 space-y-5">
                <TimelineItem
                  icon={<Ticket className="h-4 w-4" />}
                  title="Ticket Submitted"
                  date={ticket.created_at}
                />

                {ticket.started_at && (
                  <TimelineItem
                    icon={<Clock3 className="h-4 w-4" />}
                    title="Work Started"
                    date={ticket.started_at}
                  />
                )}

                {ticket.completed_at && (
                  <TimelineItem
                    icon={<CheckCircle2 className="h-4 w-4" />}
                    title="Ticket Completed"
                    date={ticket.completed_at}
                  />
                )}

                {completionRejected && latestFeedback?.created_at && (
                  <TimelineItem
                    icon={<XCircle className="h-4 w-4 text-red-600" />}
                    title="Employee Rejected Completion"
                    date={latestFeedback.created_at}
                  />
                )}

                <TimelineItem
                  icon={<Clock3 className="h-4 w-4" />}
                  title="Last Updated"
                  date={ticket.updated_at}
                />
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function InfoCard({
  icon,
  title,
  value,
}: {
  icon: React.ReactNode;
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
          {icon}
        </div>

        <div className="min-w-0">
          <p className="text-xs text-gray-400">{title}</p>
          <p className="mt-1 truncate text-sm font-semibold text-gray-900">
            {value}
          </p>
        </div>
      </div>
    </div>
  );
}

function TimelineItem({
  icon,
  title,
  date,
}: {
  icon: React.ReactNode;
  title: string;
  date: string | null;
}) {
  return (
    <div className="flex gap-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600">
        {icon}
      </div>

      <div>
        <p className="text-sm font-medium text-gray-900">{title}</p>
        <p className="mt-1 text-xs text-gray-500">{formatDate(date)}</p>
      </div>
    </div>
  );
}