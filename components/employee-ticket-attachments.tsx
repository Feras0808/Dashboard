
"use client";

import { useRef, useState } from "react";
import {
    FileText,
    ImagePlus,
    Loader2,
    Paperclip,
    Upload,
    X,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type Props = {
    ticketId: string;
    ticketStatus: string;
    onUploaded?: () => void;
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

export default function EmployeeTicketAttachments({
    ticketId,
    ticketStatus,
    onUploaded,
}: Props) {
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [files, setFiles] = useState<File[]>([]);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const canUpload = ["new", "in_progress"].includes(ticketStatus);

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

            setError(rejected.join(". "));
            return combined;
        });

        if (fileInputRef.current) fileInputRef.current.value = "";
    }

    async function uploadFiles() {
        if (!canUpload || uploading || files.length === 0) return;

        setUploading(true);
        setError("");
        setSuccess("");

        const uploadedPaths: string[] = [];

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error("Your session has expired. Please sign in again.");
            }

            // Recheck ownership and status directly against Supabase.
            const { data: ticket, error: ticketError } = await supabase
                .from("tickets")
                .select("id, user_id, status")
                .eq("id", ticketId)
                .eq("user_id", user.id)
                .maybeSingle();

            if (ticketError) throw ticketError;
            if (!ticket) throw new Error("This ticket could not be found in your account.");

            if (!["new", "in_progress"].includes(ticket.status)) {
                throw new Error("Attachments are only allowed while the ticket is New or In Progress.");
            }

            const attachments: UploadedAttachment[] = [];

            for (const file of files) {
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                const path = `${user.id}/${ticketId}/additional/${crypto.randomUUID()}-${safeName}`;

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

            const { error: saveError } = await supabase.rpc(
                "add_employee_ticket_attachments",
                {
                    p_ticket_id: ticketId,
                    p_attachments: attachments,
                }
            );

            if (saveError) throw saveError;

            setFiles([]);
            setSuccess("Your additional attachments have been sent to the IT team.");
            onUploaded?.();
        } catch (err) {
            console.error("Additional ticket attachment upload failed:", err);

            if (uploadedPaths.length > 0) {
                const { error: cleanupError } = await supabase.storage
                    .from("ticket-attachments")
                    .remove(uploadedPaths);

                if (cleanupError) {
                    console.error("Attachment cleanup failed:", cleanupError);
                }
            }

            setError(
                err instanceof Error
                    ? err.message
                    : "Could not upload attachments. Please try again."
            );
        } finally {
            setUploading(false);
        }
    }

    if (!canUpload) return null;

    return (
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm sm:p-8">
            <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <Paperclip className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="font-bold text-gray-900">Additional Attachments</h2>
                    <p className="mt-1 text-sm leading-6 text-gray-500">
                        Send more evidence or documents to the IT team for this ticket.
                    </p>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                accept=".jpg,.jpeg,.png,.webp,.pdf,.xls,.xlsx,.doc,.docx"
                multiple
                className="hidden"
                onChange={(event) => addFiles(event.target.files)}
            />

            <div className="mt-5 rounded-xl border border-dashed border-gray-300 bg-gray-50 p-5">
                <div className="text-center">
                    <Upload className="mx-auto h-7 w-7 text-gray-400" />
                    <p className="mt-2 text-sm font-semibold text-gray-800">
                        Attach supporting files
                    </p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">
                        JPG, PNG, WEBP, PDF, Excel and Word · 10 MB maximum per file
                    </p>

                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading || files.length >= MAX_FILES}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                    >
                        <ImagePlus className="h-4 w-4" />
                        Choose Files ({files.length}/{MAX_FILES})
                    </button>
                </div>
            </div>

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
                                disabled={uploading}
                                onClick={() =>
                                    setFiles((current) =>
                                        current.filter((_, fileIndex) => fileIndex !== index)
                                    )
                                }
                                className="rounded-lg p-2 text-gray-500 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {error && (
                <div role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div role="status" className="mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                    {success}
                </div>
            )}

            <button
                type="button"
                onClick={() => void uploadFiles()}
                disabled={uploading || files.length === 0}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
                {uploading ? (
                    <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Uploading...
                    </>
                ) : (
                    <>
                        <Upload className="h-4 w-4" />
                        Send Attachments
                    </>
                )}
            </button>
        </section>
    );
}
