
"use client";

import { useCallback, useEffect, useState } from "react";
import { Image as ImageIcon, Loader2, MessageSquareWarning } from "lucide-react";
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

  const loadFeedback = useCallback(async () => {
    setLoading(true);
    setError("");

    const { data, error: queryError } = await supabase
      .from("ticket_resolution_feedback")
      .select("id, decision, message, attachments, created_at")
      .eq("ticket_id", ticketId)
      .order("created_at", { ascending: false });

    if (queryError) {
      console.error("Could not load employee resolution feedback:", queryError);
      setError("Unable to load employee feedback. Check the table permissions.");
      setLoading(false);
      return;
    }

    setFeedback((data ?? []) as Feedback[]);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    void loadFeedback();
  }, [loadFeedback]);

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <MessageSquareWarning className="h-5 w-5" />
        </div>
        <div>
          <h2 className="font-bold text-gray-900">
            Employee Resolution Feedback
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Review whether the employee confirms the issue is fixed.
          </p>
        </div>
      </div>

      {loading ? (
        <div className="mt-6 flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading employee feedback...
        </div>
      ) : error ? (
        <div className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          <p>{error}</p>
          <button
            onClick={() => void loadFeedback()}
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
                className={`rounded-xl border p-5 ${
                  unresolved
                    ? "border-red-200 bg-red-50/50"
                    : "border-green-200 bg-green-50/50"
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      unresolved
                        ? "bg-red-100 text-red-700"
                        : "bg-green-100 text-green-700"
                    }`}
                  >
                    {unresolved
                      ? "Issue Still Not Solved"
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

                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Employee's Message
                  </p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-gray-800">
                    {item.message?.trim() || "No additional message provided."}
                  </p>
                </div>

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
                                className="h-36 w-full object-cover"
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
              </article>
            );
          })}

          <button
            onClick={() => void loadFeedback()}
            className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Refresh Feedback
          </button>
        </div>
      )}
    </section>
  );
}
