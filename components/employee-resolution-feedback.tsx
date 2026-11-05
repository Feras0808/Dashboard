
"use client";

import { useRef, useState } from "react";
import {
  CheckCircle2,
  FileText,
  ImagePlus,
  Loader2,
  MessageSquareWarning,
  Paperclip,
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

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "jpg", "jpeg", "png", "webp",
  "pdf", "xls", "xlsx", "doc", "docx",
];

function isAllowedFile(file: File) {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ALLOWED_EXTENSIONS.includes(extension);
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / (1024 * 1024)).toFixed(2)} MB`;
}

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
    const valid: File[] = [];
    const rejected: string[] = [];

    for (const file of incoming) {
      if (!isAllowedFile(file)) {
        rejected.push(`${file.name}: unsupported file type`);
      } else if (file.size > MAX_FILE_SIZE) {
        rejected.push(`${file.name}: exceeds 10 MB`);
      } else {
        valid.push(file);
      }
    }

    setFiles((current) => {
      const combined = [...current, ...valid];

      if (combined.length > MAX_FILES) {
        setError(`You can attach a maximum of ${MAX_FILES} files.`);
        return combined.slice(0, MAX_FILES);
      }

      if (rejected.length) {
        setError(rejected.join(". "));
      } else {
        setError("");
      }

      return combined;
    });

    if (fileInputRef.current) fileInputRef.current.value = "";
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

    if (decision === "confirmed_solved" && files.length > 0) {
      setError("Attachments are only available when reporting an unresolved issue.");
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
        throw new Error("Your session has expired. Please sign in again.");
      }

      const { data: ticket, error: ticketError } = await supabase
        .from("tickets")
        .select("id, status, user_id")
        .eq("id", ticketId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (ticketError) throw ticketError;
      if (!ticket) throw new Error("This ticket could not be found in your account.");

      if (ticket.status !== "completed") {
        throw new Error("This ticket is no longer completed. Refresh and try again.");
      }

      const attachments: UploadedAttachment[] = [];

      if (decision === "still_not_solved") {
        for (const file of files) {
          const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
          const path = `${user.id}/${ticketId}/feedback/${crypto.randomUUID()}-${safeName}`;

          const { error: uploadError } = await supabase.storage
            .from("ticket-attachments")
            .upload(path, file, {
              contentType: file.type || "application/octet-stream",
              upsert: false,
            });

          if (uploadError) {
            throw new Error(`Could not upload ${file.name}: ${uploadError.message}`);
          }

          uploadedPaths.push(path);

          const { data: urlData } = supabase.storage
            .from("ticket-attachments")
            .getPublicUrl(path);

          attachments.push({
            name: file.name,
            path,
            url: urlData.publicUrl,
            type: file.type || "application/octet-stream",
            size: file.size,
          });
        }
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
        throw new Error(`Could not save your response: ${insertError.message}`);
      }

      setSuccess(
        decision === "confirmed_solved"
          ? "Thank you. Your confirmation has been recorded."
          : "Your feedback and attachments have been sent to the IT team. The ticket will be reopened for follow-up."
      );

      setDecision("");
      setMessage("");
      setFiles([]);
      onSubmitted?.();
    } catch (err) {
      console.error("Resolution feedback submission failed:", err);

      if (uploadedPaths.length > 0) {
        const { error: cleanupError } = await supabase.storage
          .from("ticket-attachments")
          .remove(uploadedPaths);

        if (cleanupError) {
          console.error("Could not clean up uploaded files:", cleanupError);
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
          <h2 className="font-bold text-gray-900">Is your issue resolved?</h2>
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
            setFiles([]);
            setError("");
            setSuccess("");
          }}
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${decision === "confirmed_solved"
              ? "border-green-500 bg-green-50 ring-1 ring-green-500"
              : "border-gray-200 hover:border-green-300 hover:bg-green-50/50"
            }`}
        >
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              Yes, it's solved
            </span>
            <span className="mt-1 block text-xs text-gray-500">
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
          className={`flex items-start gap-3 rounded-xl border p-4 text-left transition ${decision === "still_not_solved"
              ? "border-red-400 bg-red-50 ring-1 ring-red-400"
              : "border-gray-200 hover:border-red-300 hover:bg-red-50/50"
            }`}
        >
          <MessageSquareWarning className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <span>
            <span className="block text-sm font-semibold text-gray-900">
              No, it's still not solved
            </span>
            <span className="mt-1 block text-xs text-gray-500">
              Explain the remaining problem and attach supporting files.
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
            className="w-full resize-y rounded-xl border border-gray-200 bg-white p-4 text-sm outline-none focus:border-gray-400 focus:ring-2 focus:ring-gray-100"
          />

          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.webp,.pdf,.xls,.xlsx,.doc,.docx"
            multiple
            className="hidden"
            onChange={(event) => addFiles(event.target.files)}
          />

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-gray-400">
              Up to 5 files · 10 MB each · Images, PDF, Excel and Word
            </p>
            <span className="text-xs text-gray-400">{files.length}/5</span>
          </div>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={files.length >= MAX_FILES || saving}
            className="mt-3 inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4" />
            Attach Files
          </button>

          {files.length > 0 && (
            <div className="mt-4 space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-gray-200 p-3"
                >
                  {file.type.startsWith("image/") ? (
                    <ImagePlus className="h-5 w-5 shrink-0 text-blue-500" />
                  ) : (
                    <FileText className="h-5 w-5 shrink-0 text-gray-500" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-800">
                      {file.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <button
                    type="button"
                    aria-label={`Remove ${file.name}`}
                    onClick={() =>
                      setFiles((current) =>
                        current.filter((_, fileIndex) => fileIndex !== index)
                      )
                    }
                    className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {decision === "confirmed_solved" && (
        <div className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          You're confirming that the IT issue is resolved. Submit your
          confirmation below to record it.
        </div>
      )}

      {error && (
        <div role="alert" className="mt-5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div role="status" className="mt-5 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          {success}
        </div>
      )}

      <button
        type="button"
        onClick={() => void submitFeedback()}
        disabled={saving || !decision}
        className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
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
