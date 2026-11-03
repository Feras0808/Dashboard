
"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Image as ImageIcon,
  Loader2,
  MessageSquareWarning,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type FeedbackAttachment = {
  name?: string;
  path?: string;
  url?: string;
  type?: string;
  size?: number;
};

type Feedback = {
  id: string;
  decision: "confirmed_solved" | "still_not_solved";
  message: string | null;
  attachments: FeedbackAttachment[] | null;
  created_at: string;
};

export default function AdminResolutionFeedback({
  ticketId,
}: {
  ticketId: string;
}) {
  const [feedback, setFeedback] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const loadFeedback = useCallback(async (manual = false) => {
    if (manual) setRefreshing(true);
    else setLoading(true);

    setError("");

    try {
      const { data, error: queryError } = await supabase
        .from("ticket_resolution_feedback")
        .select("id, decision, message, attachments, created_at")
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: false });

      if (queryError) throw queryError;

      setFeedback((data ?? []) as Feedback[]);
    } catch (err) {
      console.error("Could not load employee resolution feedback:", err);
      setError(
        "Unable to load employee feedback. Check your Supabase table permissions."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [ticketId]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  // Automatically refresh when a new feedback record is inserted.
  useEffect(() => {
    const channel = supabase
      .channel(`resolution-feedback-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "ticket_resolution_feedback",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          void loadFeedback(true);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [ticketId, loadFeedback]);

  const rejectedCount = feedback.filter(
    (item) => item.decision === "still_not_solved"
  ).length;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
            <MessageSquareWarning className="h-5 w-5" />
          </div>

          <div>
            <h2 className="font-bold text-gray-900">
              Employee Resolution Feedback
            </h2>

            <p className="mt-1 text-sm text-gray-500">
              Review employee confirmations and rejected completions.
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadFeedback(true)}
          disabled={refreshing || loading}
          className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw
            className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* Summary */}
      {!loading && !error && feedback.length > 0 && (
        <div className="mt-6 grid grid-cols-2 gap-3">
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-xs font-medium text-gray-500">
              Total Responses
            </p>
            <p className="mt-1 text-2xl font-bold text-gray-900">
              {feedback.length}
            </p>
          </div>

          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-xs font-medium text-red-600">
              Rejected Completions
            </p>
            <p className="mt-1 text-2xl font-bold text-red-700">
              {rejectedCount}
            </p>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading employee feedback...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>

          <button
            type="button"
            onClick={() => void loadFeedback(true)}
            className="mt-2 font-semibold underline"
          >
            Try again
          </button>
        </div>
      ) : feedback.length === 0 ? (
        <div className="mt-6 rounded-xl border border-dashed border-gray-200 bg-gray-50 p-5 text-sm text-gray-500">
          No employee resolution feedback has been submitted for this ticket.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {feedback.map((item) => {
            const unresolved = item.decision === "still_not_solved";

            const attachments = Array.isArray(item.attachments)
              ? item.attachments
              : [];

            return (
              <article
                key={item.id}
                className={`rounded-xl border p-5 ${unresolved
                    ? "border-red-200 bg-red-50/50"
                    : "border-green-200 bg-green-50/50"
                  }`}
              >
                {/* Feedback status and date */}
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold ${unresolved
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                      }`}
                  >
                    {unresolved ? (
                      <AlertCircle className="h-3.5 w-3.5" />
                    ) : (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    )}

                    {unresolved
                      ? "Completion Rejected"
                      : "Employee Confirmed Solved"}
                  </span>

                  <span className="text-xs text-gray-500">
                    {new Date(item.created_at).toLocaleString("en-GB", {
                      timeZone: "Asia/Qatar",
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </span>
                </div>

                {/* Employee message */}
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {unresolved
                      ? "Reason for rejecting completion"
                      : "Employee confirmation"}
                  </p>

                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">
                    {item.message?.trim() ||
                      "No additional message provided."}
                  </p>
                </div>

                {/* Attachments */}
                {attachments.length > 0 && (
                  <div className="mt-5 border-t border-gray-200/80 pt-4">
                    <p className="flex items-center gap-2 text-sm font-semibold text-gray-700">
                      <ImageIcon className="h-4 w-4" />
                      Attached Images ({attachments.length})
                    </p>

                    <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {attachments.map((file, index) => (
                        <div
                          key={`${file.path ?? file.name ?? "image"}-${index}`}
                          className="overflow-hidden rounded-xl border border-gray-200 bg-white"
                        >
                          {file.url ? (
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="block"
                            >
                              <img
                                src={file.url}
                                alt={file.name ?? "Employee attachment"}
                                className="h-36 w-full object-cover transition hover:opacity-90"
                              />
                            </a>
                          ) : (
                            <div className="flex h-36 items-center justify-center text-xs text-gray-400">
                              Image URL unavailable
                            </div>
                          )}

                          <p className="break-words px-3 py-2 text-xs text-gray-600">
                            {file.name ?? `Image ${index + 1}`}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {unresolved && (
                  <div className="mt-4 rounded-lg border border-red-200 bg-white/70 p-3 text-xs leading-5 text-red-700">
                    The employee has rejected the completion. Review the
                    issue, continue troubleshooting in the same ticket,
                    and mark it Completed again once resolved.
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
