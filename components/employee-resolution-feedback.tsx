"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  ImagePlus,
  Loader2,
  MessageSquareWarning,
  X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
  ticketId: string;
  ticketStatus: string;
  onSubmitted?: () => void;
};

type UploadedAttachment = {
  name: string;
  path: string;
  url: string;
  type: string;
  size: number;
};

export default function EmployeeResolutionFeedback({
  ticketId,
  ticketStatus,
  onSubmitted,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [decision, setDecision] = useState<
    "confirmed_solved" | "still_not_solved" | ""
  >("");
  const [message, setMessage] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  if (ticketStatus !== "completed") return null;

  function addFiles(selected: FileList | null) {
    if (!selected) return;

    const incoming = Array.from(selected);
    const allowed = incoming.filter(
      (file) =>
        file.type.startsWith("image/") &&
        file.size <= 5 * 1024 * 1024
    );

    if (allowed.length !== incoming.length) {
      setError(
        "Please select images only. Each image must be 5 MB or smaller."
      );
    } else {
      setError("");
    }

    setFiles((current) => {
      const combined = [...current, ...allowed];
      if (combined.length > 5) {
        setError("You can attach a maximum of 5 images.");
      }
      return combined.slice(0, 5);
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  async function submitFeedback() {
    setError("");
    setSuccess("");

    if (!decision) {
      setError("Please select whether the issue has been solved.");
      return;
    }

    if (decision === "still_not_solved" && !message.trim()) {
      setError("Please describe what is still wrong.");
      return;
    }

    setSaving(true);
    const uploadedPaths: string[] = [];

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

      // Confirm this ticket belongs to the signed-in employee and is completed.
      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("id, status, user_id")
        .eq("id", ticketId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (ticketError) throw ticketError;

      if (!ticket) {
        throw new Error("This ticket could not be found in your account.");
      }

      if (ticket.status !== "completed") {
        throw new Error(
          "This ticket is no longer marked as completed. Refresh the page and try again."
        );
      }

      const attachments: UploadedAttachment[] = [];

      for (const file of files) {
        const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
        const path = `${user.id}/${ticketId}/feedback/${crypto.randomUUID()}-${safeName}`;

        const { error: uploadError } = await supabase.storage
          .from("ticket-attachments")
          .upload(path, file, {
            contentType: file.type,
            upsert: false,
          });

        if (uploadError) {
          throw new Error(
            `Could not upload ${file.name}: ${uploadError.message}`
          );
        }

        uploadedPaths.push(path);

        const { data: publicUrlData } = supabase.storage
          .from("ticket-attachments")
          .getPublicUrl(path);

        attachments.push({
          name: file.name,
          path,
          url: publicUrlData.publicUrl,
          type: file.type,
          size: file.size,
        });
      }

      const { error: insertError } = await supabase
        .from("ticket_resolution_feedback")
        .insert({
          ticket_id: ticketId,
          user_id: user.id,
          decision,
          message: message.trim() || null,
          attachments,
        });

      if (insertError) {
        throw new Error(
          `Could not save your response: ${insertError.message}`
        );
      }

      setSuccess(
        decision === "confirmed_solved"
          ? "Thank you. Your confirmation has been recorded."
          : "Your feedback has been sent to the IT team. The ticket will be reopened for follow-up."
      );

      setDecision("");
      setMessage("");
      setFiles([]);

      // Refresh the ticket details so the new status is reflected.
      onSubmitted?.();
    } catch (err) {
      console.error("Resolution feedback submission failed:", err);

      // Clean up newly uploaded files if saving the feedback failed.
      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from("ticket-attachments")
          .remove(uploadedPaths);

        if (cleanupError) {
          console.error(
            "Could not clean up uploaded files:",
            cleanupError
          );
        }
      }

      setError(
        err instanceof Error
          ? err.message
          : "Could not submit your feedback. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <MessageSquareWarning className="h-5 w-5" />
        </div>

        <div>
          <h2 className="font-bold text-gray-900">
            Is your issue resolved?
          </h2>
          <p className="mt-1 text-sm leading-6 text-gray-500">
            Please check the issue and let the IT team know if it is fixed.
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => {
            setDecision("confirmed_solved");
            setError("");
            setSuccess("");
          }}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
            decision === "confirmed_solved"
              ? "border-green-500 bg-green-50 ring-1 ring-green-500"
              : "border-gray-200 hover:border-green-300 hover:bg-green-50/50"
          }`}
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              Yes, it&apos;s solved
            </span>
            <span className="mt-1 block text-xs leading-5 text-gray-500">
              Confirm that everything is working.
            </span>
          </span>
        </button>

        <button
          type="button"
          onClick={() => {
            setDecision("still_not_solved");
            setError("");
            setSuccess("");
          }}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${
            decision === "still_not_solved"
              ? "border-red-400 bg-red-50 ring-1 ring-red-400"
              : "border-gray-200 hover:border-red-300 hover:bg-red-50/50"
          }`}
        >
          <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              No, it&apos;s still not solved
            </span>
            <span className="mt-1 block text-xs leading-5 text-gray-500">
              Explain the remaining problem and attach images.
            </span>
          </span>
        </button>
      </div>

      {decision === "still_not_solved" && (
        <div className="mt-5">
          <label
            htmlFor="resolution-message"
            className="mb-2 block text-sm font-semibold text-gray-800"
          >
            What is still wrong? <span className="text-red-500">*</span>
          </label>

          <textarea
            id="resolution-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            rows={4}
            maxLength={3000}
            placeholder="Describe what happened after the IT team checked the issue..."
            className="w-full resize-y rounded-xl border border-gray-200 bg-white p-4 text-sm outline-none transition placeholder:text-gray-400 focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />

          <div className="mt-2 flex items-center justify-between gap-3">
            <p className="text-xs text-gray-400">
              Up to 5 images, maximum 5 MB each.
            </p>
            <span className="shrink-0 text-xs text-gray-400">
              {message.length}/3000
            </span>
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => addFiles(event.target.files)}
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= 5 || saving}
            className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <ImagePlus className="h-4 w-4" />
            Attach Images ({files.length}/5)
          </button>

          {files.length > 0 && (
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="relative overflow-hidden rounded-xl border border-gray-200 bg-gray-50"
                >
                  <img
                    src={URL.createObjectURL(file)}
                    alt={file.name}
                    className="h-28 w-full object-cover"
                  />
                  <p className="truncate px-2 py-2 text-xs text-gray-600">
                    {file.name}
                  </p>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index)
                      )
                    }
                    className="absolute right-2 top-2 rounded-full bg-white p-1.5 text-gray-700 shadow hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {decision === "confirmed_solved" && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm leading-6 text-green-800">
          You&apos;re confirming that the IT issue is resolved. Submit your
          confirmation below to record it.
        </div>
      )}

      {error && (
        <div
          role="alert"
          className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </div>
      )}

      {success && (
        <div
          role="status"
          className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
        >
          {success}
        </div>
      )}

      <button
        type="button"
        onClick={() => void submitFeedback()}
        disabled={saving || !decision}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {saving ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Sending...
          </>
        ) : (
          "Submit Response"
        )}
      </button>
    </section>
  );
}