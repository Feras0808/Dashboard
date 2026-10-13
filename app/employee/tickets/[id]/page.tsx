
"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Clock3,
  FileText,
  Loader2,
  MessageSquareText,
  Ticket as TicketIcon,
  XCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabase";
import EmployeeResolutionFeedback from "@/components/employee-resolution-feedback";

type RelatedName = { name: string } | { name: string }[] | null;

type Attachment = {
  name?: string;
  url?: string;
  path?: string;
  type?: string;
  size?: number;
};

type EmployeeTicket = {
  id: string;
  ticket_number: string;
  employee_name: string;
  issue_type: string;
  issue_other: string | null;
  description: string;
  priority: string;
  status: string;
  admin_response: string | null;
  attachments: Attachment[] | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
  company: RelatedName;
  department: RelatedName;
};

const issueLabels: Record<string, string> = {
  adler_system: "Adler System",
  printers_scanners: "Printers & Scanners",
  networking: "Networking",
  cctv: "CCTV",
  email: "Email",
  others: "Others",
};

const statusStyles: Record<string, string> = {
  new: "border-blue-200 bg-blue-50 text-blue-700",
  in_progress: "border-orange-200 bg-orange-50 text-orange-700",
  completed: "border-green-200 bg-green-50 text-green-700",
  cancelled: "border-gray-200 bg-gray-100 text-gray-600",
};

const priorityStyles: Record<string, string> = {
  urgent: "text-red-600",
  high: "text-orange-600",
  normal: "text-yellow-700",
  low: "text-green-600",
};

function relationName(value: RelatedName) {
  if (Array.isArray(value)) {
    return value[0]?.name ?? "Not available";
  }

  return value?.name ?? "Not available";
}

function formatLabel(value: string) {
  if (value === "in_progress") return "In Progress";

  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
}

function formatDate(value: string | null) {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return null;

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Qatar",
  });
}

function InfoCard({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <p className="text-sm text-gray-500">{label}</p>
      <p className="mt-2 break-words font-semibold text-gray-900">
        {value}
      </p>
    </div>
  );
}

function ProgressTimeline({ ticket }: { ticket: EmployeeTicket }) {
  const cancelled = ticket.status === "cancelled";

  const steps = [
    {
      title: "Ticket Submitted",
      description: "Your IT request has been received.",
      date: ticket.created_at,
      complete: true,
      current: ticket.status === "new",
    },
    {
      title: "In Progress",
      description: "The IT team is working on your request.",
      date: ticket.started_at,
      complete:
        ticket.status === "in_progress" ||
        ticket.status === "completed",
      current: ticket.status === "in_progress",
    },
    {
      title: "Completed",
      description: "Your request has been marked as completed.",
      date: ticket.completed_at,
      complete: ticket.status === "completed",
      current: ticket.status === "completed",
    },
  ];

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50 text-green-600">
          <CheckCircle2 className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-bold text-gray-900">Ticket Progress</h2>
          <p className="mt-1 text-sm text-gray-500">
            Follow the progress of your IT request.
          </p>
        </div>
      </div>

      {cancelled ? (
        <div className="mt-6 flex gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
          <div>
            <p className="font-semibold text-gray-800">
              This ticket has been cancelled
            </p>
            <p className="mt-1 text-sm leading-6 text-gray-600">
              Contact the IT team if you need clarification or wish to
              submit a new request.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-7">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="relative flex gap-4 pb-7 last:pb-0"
            >
              {index !== steps.length - 1 && (
                <div
                  className={`absolute left-[10px] top-6 h-full w-px ${
                    step.complete ? "bg-green-300" : "bg-gray-200"
                  }`}
                />
              )}

              <div
                className={`relative z-[1] flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border ${
                  step.complete
                    ? "border-green-200 bg-green-50 text-green-600"
                    : "border-gray-300 bg-white text-gray-400"
                }`}
              >
                {step.complete ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-current" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <h3
                    className={`text-sm font-semibold ${
                      step.complete ? "text-gray-900" : "text-gray-400"
                    }`}
                  >
                    {step.title}
                  </h3>

                  {step.current && (
                    <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-600">
                      Current
                    </span>
                  )}
                </div>

                <p
                  className={`mt-1 text-sm leading-6 ${
                    step.complete ? "text-gray-600" : "text-gray-400"
                  }`}
                >
                  {step.description}
                </p>

                {step.date && (
                  <p className="mt-1.5 text-xs text-gray-400">
                    {formatDate(step.date)}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

/**
 * This component uses useParams(), so it must be rendered
 * underneath the Suspense boundary in the default export below.
 */
function EmployeeTicketDetailsContent() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const ticketId = params.id;

  const [ticket, setTicket] = useState<EmployeeTicket | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTicket = useCallback(async () => {
    if (!ticketId) {
      setLoading(false);
      setError("Ticket ID is missing from the URL.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: queryError } = await supabase
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
        .eq("user_id", user.id)
        .maybeSingle();

      if (queryError) {
        console.error("Could not load employee ticket:", queryError);
        setError("We couldn't load this ticket. Please try again.");
        return;
      }

      if (!data) {
        setError(
          "This ticket could not be found in your account. The link may be incorrect."
        );
        return;
      }

      setTicket(data as unknown as EmployeeTicket);
    } catch (err) {
      console.error("Unexpected ticket details error:", err);
      setError("Something went wrong while loading this ticket.");
    } finally {
      setLoading(false);
    }
  }, [ticketId, router]);

  useEffect(() => {
    void loadTicket();
  }, [loadTicket]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-transparent px-6">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading ticket details...
        </div>
      </main>
    );
  }

  if (error || !ticket) {
    return (
      <main className="min-h-screen bg-transparent px-5 py-12">
        <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 text-red-600">
            <AlertCircle className="h-6 w-6" />
          </div>

          <h1 className="mt-4 text-xl font-bold text-gray-900">
            Unable to open ticket
          </h1>

          <p className="mt-2 text-sm leading-6 text-gray-500">
            {error || "This ticket could not be found."}
          </p>

          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={() => router.push("/employee/tickets")}
              className="rounded-xl border border-gray-200 px-5 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
            >
              Back to My Tickets
            </button>

            <button
              onClick={() => void loadTicket()}
              className="rounded-xl bg-gray-950 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Try Again
            </button>
          </div>
        </div>
      </main>
    );
  }

  const issue =
    ticket.issue_type === "others" && ticket.issue_other?.trim()
      ? ticket.issue_other
      : issueLabels[ticket.issue_type] ?? formatLabel(ticket.issue_type);

  const attachments = Array.isArray(ticket.attachments)
    ? ticket.attachments
    : [];

  return (
    <main className="min-h-screen bg-transparent">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex min-h-20 max-w-6xl items-center gap-4 px-5 py-4 sm:px-6">
          <button
            onClick={() => router.push("/employee/tickets")}
            className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-950"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to My Tickets
          </button>

          <div className="min-w-0 border-l border-gray-200 pl-4 sm:pl-6">
            <p className="text-xs text-gray-500">Employee Portal</p>
            <h1 className="truncate font-bold text-gray-900">
              Ticket Details
            </h1>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-6">
        <div className="mb-7 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 sm:text-3xl">
                {ticket.ticket_number}
              </h2>

              <span
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                  statusStyles[ticket.status] ??
                  "border-gray-200 bg-gray-100 text-gray-600"
                }`}
              >
                {formatLabel(ticket.status)}
              </span>
            </div>

            <p className="mt-2 text-sm text-gray-500">
              Submitted {formatDate(ticket.created_at) ?? "date unavailable"}
            </p>
          </div>

          <div
            className={`text-sm font-semibold ${
              priorityStyles[ticket.priority] ?? "text-gray-600"
            }`}
          >
            {formatLabel(ticket.priority)} Priority
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <InfoCard label="Employee" value={ticket.employee_name} />
          <InfoCard label="Company" value={relationName(ticket.company)} />
          <InfoCard
            label="Department"
            value={relationName(ticket.department)}
          />
        </div>

        <div className="mt-6 grid items-start gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-6">
            {/* Request information */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                  <TicketIcon className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-bold text-gray-900">
                    Request Information
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Details submitted with your ticket
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Issue Type
                </p>
                <p className="mt-2 font-semibold text-gray-900">{issue}</p>
              </div>

              <div className="mt-6">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                  Description
                </p>
                <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
                  {ticket.description || "No description provided."}
                </p>
              </div>

              {attachments.length > 0 && (
                <div className="mt-6 border-t border-gray-100 pt-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                    Attachments
                  </p>

                  <div className="mt-3 space-y-2">
                    {attachments.map((attachment, index) => (
                      <div
                        key={`${attachment.path ?? attachment.name ?? "file"}-${index}`}
                        className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
                      >
                        <FileText className="h-5 w-5 shrink-0 text-gray-400" />

                        <span className="min-w-0 flex-1 break-words text-sm text-gray-700">
                          {attachment.name || `Attachment ${index + 1}`}
                        </span>

                        {attachment.url && (
                          <a
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="shrink-0 text-sm font-semibold text-blue-600 hover:text-blue-800"
                          >
                            Open
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

            {/* IT team response */}
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                  <MessageSquareText className="h-5 w-5" />
                </div>

                <div>
                  <h2 className="font-bold text-gray-900">
                    IT Team Response
                  </h2>
                  <p className="mt-1 text-sm text-gray-500">
                    Updates and comments from your administrator
                  </p>
                </div>
              </div>

              {ticket.admin_response?.trim() ? (
                <div className="mt-6 rounded-xl border border-orange-100 bg-orange-50/60 p-5">
                  <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
                    {ticket.admin_response}
                  </p>

                  {ticket.updated_at && (
                    <p className="mt-3 text-xs text-gray-500">
                      Last updated {formatDate(ticket.updated_at)}
                    </p>
                  )}
                </div>
              ) : (
                <div className="mt-6 flex items-start gap-3 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5">
                  <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />

                  <div>
                    <p className="text-sm font-semibold text-gray-700">
                      Waiting for IT response
                    </p>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                      Your request is recorded. The IT team has not added a
                      response yet.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* Employee completion confirmation or rejection */}
            <EmployeeResolutionFeedback
              ticketId={ticket.id}
              ticketStatus={ticket.status}
              onSubmitted={() => void loadTicket()}
            />
          </div>

          <div className="space-y-6">
            <ProgressTimeline ticket={ticket} />

            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-gray-900">
                Need to submit another request?
              </p>

              <p className="mt-1 text-sm leading-6 text-gray-500">
                Return to the employee portal to create a new IT support
                ticket.
              </p>

              <button
                onClick={() => router.push("/employee/submit")}
                className="mt-4 w-full rounded-xl bg-gray-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Submit a New Ticket
              </button>
            </div>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-between border-t border-gray-200 pt-5 text-xs text-gray-400">
          <span>
            Last updated{" "}
            {formatDate(ticket.updated_at ?? ticket.created_at) ?? "N/A"}
          </span>

          <button
            onClick={() => router.push("/employee/tickets")}
            className="font-semibold text-gray-600 transition hover:text-gray-950"
          >
            Back to My Tickets
          </button>
        </div>
      </section>
    </main>
  );
}

export default function EmployeeTicketDetailsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-transparent px-6">
          <div className="flex items-center gap-3 text-sm text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading ticket details...
          </div>
        </main>
      }
    >
      <EmployeeTicketDetailsContent />
    </Suspense>
  );
}
