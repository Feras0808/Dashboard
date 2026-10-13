
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock3,
  Loader2,
  MessageSquareText,
  RefreshCw,
  Ticket,
  XCircle,
  AlertCircle,
  Monitor,
  CalendarDays,
  Send,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type MyTicket = {
  id: string;
  ticket_number: string;
  issue_type: string;
  issue_other: string | null;
  priority: string;
  status: string;
  description: string;
  admin_response: string | null;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  updated_at: string | null;
};

const issueLabels: Record<string, string> = {
  adler_system: "Adler System",
  printers_scanners: "Printers & Scanners",
  networking: "Networking",
  cctv: "CCTV",
  email: "Email",
  others: "Other Issue",
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

function formatDate(date: string | null) {
  if (!date) return "Not available";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "Not available";

  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Qatar",
  });
}

function formatStatus(status: string) {
  if (status === "in_progress") return "In Progress";

  return status.charAt(0).toUpperCase() + status.slice(1);
}

function formatPriority(priority: string) {
  return priority.charAt(0).toUpperCase() + priority.slice(1);
}

function getIssueLabel(ticket: MyTicket) {
  if (ticket.issue_type === "others" && ticket.issue_other?.trim()) {
    return ticket.issue_other;
  }

  return issueLabels[ticket.issue_type] || ticket.issue_type;
}

function ProgressTimeline({ ticket }: { ticket: MyTicket }) {
  const isCancelled = ticket.status === "cancelled";

  const steps = [
    {
      title: "Ticket Submitted",
      description: "Your IT request has been received.",
      date: ticket.created_at,
      complete: true,
    },
    {
      title: "In Progress",
      description: "The IT team is working on your request.",
      date: ticket.started_at,
      complete:
        ticket.status === "in_progress" ||
        ticket.status === "completed",
    },
    {
      title: "Completed",
      description: "Your request has been marked as completed.",
      date: ticket.completed_at,
      complete: ticket.status === "completed",
    },
  ];

  return (
    <div className="mt-5">
      <div className="mb-5 flex items-center justify-between">
        <h4 className="font-semibold text-gray-900">Ticket Progress</h4>
        {isCancelled && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-gray-500">
            <XCircle size={15} />
            Request cancelled
          </span>
        )}
      </div>

      {isCancelled ? (
        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
            <div>
              <p className="font-semibold text-gray-800">
                This ticket has been cancelled
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-600">
                Contact the IT team if you need clarification or would like
                to submit a new request.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-0">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const isCurrent =
              (index === 0 && ticket.status === "new") ||
              (index === 1 && ticket.status === "in_progress") ||
              (index === 2 && ticket.status === "completed");

            return (
              <div key={step.title} className="flex gap-3">
                <div className="flex w-6 shrink-0 flex-col items-center">
                  <div
                    className={`flex h-6 w-6 items-center justify-center rounded-full ${
                      step.complete
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-400"
                    }`}
                  >
                    {step.complete ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Circle size={16} />
                    )}
                  </div>

                  {!isLast && (
                    <div
                      className={`my-1 min-h-9 w-0.5 flex-1 ${
                        step.complete && steps[index + 1].complete
                          ? "bg-green-300"
                          : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>

                <div className={`${isLast ? "pb-0" : "pb-6"} min-w-0 flex-1`}>
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className={`text-sm font-semibold ${
                        step.complete ? "text-gray-900" : "text-gray-400"
                      }`}
                    >
                      {step.title}
                    </p>

                    {isCurrent && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-700">
                        Current
                      </span>
                    )}
                  </div>

                  <p className="mt-1 text-sm leading-6 text-gray-500">
                    {step.description}
                  </p>

                  {step.date && (
                    <p className="mt-1.5 text-xs text-gray-400">
                      {formatDate(step.date)}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function AdminResponse({ response }: { response: string | null }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
          <MessageSquareText size={20} />
        </div>

        <div>
          <h4 className="font-bold text-gray-900">IT Team Response</h4>
          <p className="mt-1 text-xs text-gray-500">
            Updates and comments from your administrator
          </p>
        </div>
      </div>

      {response?.trim() ? (
        <div className="mt-5 rounded-xl border border-orange-100 bg-orange-50/60 p-4">
          <p className="whitespace-pre-wrap break-words text-sm leading-7 text-gray-700">
            {response}
          </p>
        </div>
      ) : (
        <div className="mt-5 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5">
          <div className="flex items-start gap-3">
            <Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-gray-400" />
            <div>
              <p className="text-sm font-semibold text-gray-700">
                Waiting for IT response
              </p>
              <p className="mt-1 text-sm leading-6 text-gray-500">
                Your request is recorded. The IT team has not added a response
                yet. This section will update when a response is saved.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function MyTicketsPage() {
  const router = useRouter();

  const [tickets, setTickets] = useState<MyTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);

  const loadTickets = useCallback(async (manual = false) => {
    if (manual) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    setError("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.replace("/login");
        return;
      }

      const { data, error: ticketsError } = await supabase
        .from("tickets")
        .select(`
          id,
          ticket_number,
          issue_type,
          issue_other,
          priority,
          status,
          description,
          admin_response,
          created_at,
          started_at,
          completed_at,
          updated_at
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (ticketsError) {
        console.error("Error loading tickets:", ticketsError);
        setError("Could not load your tickets. Please try again.");
        return;
      }

      setTickets((data || []) as MyTicket[]);
      setLastUpdated(new Date().toISOString());
    } catch (loadError) {
      console.error("Unexpected ticket loading error:", loadError);
      setError("Something went wrong while loading your tickets.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    void loadTickets();

    // Refresh status and admin responses automatically every 15 seconds.
    const interval = window.setInterval(() => {
      void loadTickets(true);
    }, 15000);

    // Refresh immediately when the employee returns to this browser tab.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadTickets(true);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [loadTickets]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f5f7fa]">
        <div className="flex items-center gap-3 text-sm text-gray-500">
          <Loader2 size={19} className="animate-spin" />
          Loading your tickets...
        </div>
      </main>
    );
  }

  const activeCount = tickets.filter(
    (ticket) =>
      ticket.status === "new" || ticket.status === "in_progress"
  ).length;

  const completedCount = tickets.filter(
    (ticket) => ticket.status === "completed"
  ).length;

  const responseCount = tickets.filter(
    (ticket) => Boolean(ticket.admin_response?.trim())
  ).length;

  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex h-20 max-w-6xl items-center justify-between px-4 sm:px-6">
          <div className="flex min-w-0 items-center">
            <button
              onClick={() => router.push("/employee")}
              className="flex shrink-0 items-center gap-2 text-sm font-medium text-gray-600 transition hover:text-gray-950"
            >
              <ArrowLeft size={16} />
              Back
            </button>

            <div className="ml-5 border-l border-gray-200 pl-5 sm:ml-6 sm:pl-6">
              <p className="text-xs text-gray-500">Employee Portal</p>
              <h1 className="font-bold text-gray-900">My Tickets</h1>
            </div>
          </div>

          <button
            onClick={() => void loadTickets(true)}
            disabled={refreshing}
            aria-label="Refresh tickets"
            className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60 sm:px-4"
          >
            <RefreshCw
              size={15}
              className={refreshing ? "animate-spin" : ""}
            />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
          <div>
            <div className="flex items-center gap-2 text-sm font-medium text-orange-600">
              <Monitor size={16} />
              IT Service Desk
            </div>

            <h2 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Track your IT requests
            </h2>

            <p className="mt-2 max-w-2xl text-sm leading-6 text-gray-500">
              Follow ticket progress, check the latest IT team response, and
              see when your request is completed.
            </p>
          </div>

          <button
            onClick={() => router.push("/employee/submit")}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
          >
            <Send size={16} />
            Submit New Ticket
          </button>
        </div>

        {error && (
          <div className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            <AlertCircle size={18} className="mt-0.5 shrink-0" />
            <div className="flex-1">{error}</div>
            <button
              onClick={() => void loadTickets(true)}
              className="shrink-0 font-semibold underline"
            >
              Retry
            </button>
          </div>
        )}

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Total Tickets</p>
              <Ticket size={19} className="text-gray-400" />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {tickets.length}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Active Requests</p>
              <Clock3 size={19} className="text-orange-500" />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {activeCount}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">Completed</p>
              <CheckCircle2 size={19} className="text-green-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {completedCount}
            </p>
          </div>

          <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <p className="text-sm text-gray-500">IT Responses</p>
              <MessageSquareText size={19} className="text-blue-600" />
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900">
              {responseCount}
            </p>
          </div>
        </div>

        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Your Requests</h3>
            <p className="mt-1 text-sm text-gray-500">
              Select a ticket to view its full details.
            </p>
          </div>

          <p className="flex items-center gap-1.5 text-xs text-gray-400">
            <span className="h-2 w-2 rounded-full bg-green-500" />
            Auto-refresh every 15 seconds
          </p>
        </div>

        {!error && tickets.length === 0 && (
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-14 text-center shadow-sm">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100">
              <Ticket size={28} className="text-gray-500" />
            </div>

            <h3 className="mt-5 text-lg font-semibold text-gray-900">
              No tickets yet
            </h3>

            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-gray-500">
              When you submit an IT support request, you can track its progress
              and read replies from the IT team here.
            </p>

            <button
              onClick={() => router.push("/employee/submit")}
              className="mt-6 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
            >
              Submit a Ticket
            </button>
          </div>
        )}

        <div className="space-y-5">
          {tickets.map((ticket) => (
            <article
              key={ticket.id}
              className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:shadow-md"
            >
              <div className="p-5 sm:p-6">
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-base font-bold text-gray-900">
                        {ticket.ticket_number}
                      </h3>

                      <span
                        className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                          statusStyles[ticket.status] ||
                          "border-gray-200 bg-gray-100 text-gray-600"
                        }`}
                      >
                        {formatStatus(ticket.status)}
                      </span>

                      {ticket.admin_response?.trim() && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 text-xs font-medium text-purple-700">
                          <MessageSquareText size={12} />
                          Admin replied
                        </span>
                      )}
                    </div>

                    <p className="mt-3 text-sm font-semibold text-gray-800">
                      {getIssueLabel(ticket)}
                    </p>

                    <p className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm leading-6 text-gray-500">
                      {ticket.description}
                    </p>
                  </div>

                  <div className="shrink-0 sm:text-right">
                    <p
                      className={`text-sm font-semibold ${
                        priorityStyles[ticket.priority] || "text-gray-600"
                      }`}
                    >
                      {formatPriority(ticket.priority)} Priority
                    </p>

                    <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-400 sm:justify-end">
                      <CalendarDays size={13} />
                      {formatDate(ticket.created_at)}
                    </p>
                  </div>
                </div>

                <div className="mt-5 border-t border-gray-100 pt-5">
                  <ProgressTimeline ticket={ticket} />
                </div>

                <div className="mt-5">
                  <AdminResponse response={ticket.admin_response} />
                </div>

                <div className="mt-5 flex flex-col gap-3 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-xs text-gray-400">
                    {ticket.updated_at
                      ? `Last updated ${formatDate(ticket.updated_at)}`
                      : `Submitted ${formatDate(ticket.created_at)}`}
                  </p>

                  <button
                    onClick={() =>
                      router.push(`/employee/tickets/${ticket.id}`)
                    }
                    className="inline-flex items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:border-gray-300 hover:bg-gray-50"
                  >
                    View Ticket Details
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>

        {lastUpdated && (
          <p className="mt-6 text-center text-xs text-gray-400">
            Last refreshed at {formatDate(lastUpdated)}
          </p>
        )}
      </section>
    </main>
  );
}
