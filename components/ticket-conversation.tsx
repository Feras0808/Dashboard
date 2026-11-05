
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
    Loader2,
    MessageSquareText,
    Send,
    RefreshCw,
    Paperclip,
    FileText,
    Image as ImageIcon,
    X,
    Download,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type MessageAttachment = {
    name: string;
    path: string;
    url: string;
    type: string;
    size: number;
};

type TicketMessage = {
    id: string;
    ticket_id: string;
    sender_id: string;
    sender_role: "admin" | "employee";
    message: string;
    attachments: MessageAttachment[] | null;
    created_at: string;
};

type Props = {
    ticketId: string;
    ticketStatus: string;
};

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
    "jpg",
    "jpeg",
    "png",
    "webp",
    "pdf",
    "doc",
    "docx",
    "xls",
    "xlsx",
];

function isAllowedFile(file: File) {
    const extension = file.name.split(".").pop()?.toLowerCase();
    return Boolean(extension && ALLOWED_EXTENSIONS.includes(extension));
}

function formatFileSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function normalizeAttachments(value: unknown): MessageAttachment[] {
    if (!Array.isArray(value)) return [];

    return value.filter(
        (item): item is MessageAttachment =>
            typeof item === "object" &&
            item !== null &&
            typeof (item as MessageAttachment).url === "string"
    );
}

export default function TicketConversation({
    ticketId,
    ticketStatus,
}: Props) {
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [userId, setUserId] = useState("");
    const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
    const [message, setMessage] = useState("");
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const fileInputRef = useRef<HTMLInputElement>(null);

    const isReadOnly =
        ticketStatus === "closed" || ticketStatus === "cancelled";

    const loadMessages = useCallback(async () => {
        setError("");

        try {
            const {
                data: { user },
                error: authError,
            } = await supabase.auth.getUser();

            if (authError || !user) {
                throw new Error("Your session has expired. Please sign in again.");
            }

            setUserId(user.id);

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();

            if (profileError) throw profileError;

            if (profile.role !== "admin" && profile.role !== "employee") {
                throw new Error("Your account does not have permission to view messages.");
            }

            setUserRole(profile.role);

            const { data, error: messagesError } = await supabase
                .from("ticket_messages")
                .select(
                    "id, ticket_id, sender_id, sender_role, message, attachments, created_at"
                )
                .eq("ticket_id", ticketId)
                .order("created_at", { ascending: true });

            if (messagesError) throw messagesError;

            setMessages(
                (data || []).map((item) => ({
                    ...item,
                    attachments: normalizeAttachments(item.attachments),
                })) as TicketMessage[]
            );
        } catch (err) {
            console.error("Conversation loading failed:", err);
            setError(
                err instanceof Error ? err.message : "Could not load messages."
            );
        } finally {
            setLoading(false);
        }
    }, [ticketId]);

    useEffect(() => {
        void loadMessages();
    }, [loadMessages]);

    function handleFileSelection(fileList: FileList | null) {
        if (!fileList) return;

        setError("");
        setSuccess("");

        const incoming = Array.from(fileList);

        if (incoming.length + selectedFiles.length > MAX_FILES) {
            setError(`You can attach a maximum of ${MAX_FILES} files per message.`);
            return;
        }

        for (const file of incoming) {
            if (!isAllowedFile(file)) {
                setError(
                    `${file.name} is not supported. Use JPG, PNG, WEBP, PDF, DOC, DOCX, XLS, or XLSX.`
                );
                return;
            }

            if (file.size > MAX_FILE_SIZE) {
                setError(`${file.name} exceeds the 10 MB file size limit.`);
                return;
            }
        }

        setSelectedFiles((current) => [...current, ...incoming]);

        if (fileInputRef.current) {
            fileInputRef.current.value = "";
        }
    }

    function removeSelectedFile(index: number) {
        setSelectedFiles((current) =>
            current.filter((_, fileIndex) => fileIndex !== index)
        );
    }

    async function sendMessage() {
        const cleanMessage = message.trim();

        if (
            (!cleanMessage && selectedFiles.length === 0) ||
            sending ||
            isReadOnly
        ) {
            return;
        }

        if (selectedFiles.length > 0 && userRole !== "admin") {
            setError("Only IT administrators can attach files to conversation messages.");
            return;
        }

        setSending(true);
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

            const { data: profile, error: profileError } = await supabase
                .from("profiles")
                .select("role")
                .eq("id", user.id)
                .single();

            if (profileError) throw profileError;

            if (profile.role !== "admin" && profile.role !== "employee") {
                throw new Error("You are not authorized to send messages.");
            }

            if (selectedFiles.length > 0 && profile.role !== "admin") {
                throw new Error("Only IT administrators can attach files.");
            }

            const { data: ticket, error: ticketError } = await supabase
                .from("tickets")
                .select("id, status, user_id")
                .eq("id", ticketId)
                .single();

            if (ticketError) throw ticketError;

            if (ticket.status === "closed" || ticket.status === "cancelled") {
                throw new Error("This ticket is closed and no longer accepts replies.");
            }

            if (profile.role === "employee" && ticket.user_id !== user.id) {
                throw new Error("You can only reply to your own tickets.");
            }

            const attachments: MessageAttachment[] = [];

            for (const file of selectedFiles) {
                const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
                const path = `${user.id}/${ticketId}/messages/${crypto.randomUUID()}-${safeName}`;

                const { error: uploadError } = await supabase.storage
                    .from("ticket-attachments")
                    .upload(path, file, {
                        cacheControl: "3600",
                        upsert: false,
                        contentType: file.type || "application/octet-stream",
                    });

                if (uploadError) throw uploadError;

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
                .from("ticket_messages")
                .insert({
                    ticket_id: ticketId,
                    sender_id: user.id,
                    sender_role: profile.role,
                    message: cleanMessage,
                    attachments,
                });

            if (insertError) throw insertError;

            setMessage("");
            setSelectedFiles([]);
            setSuccess("Your message has been sent.");

            await loadMessages();
        } catch (err) {
            console.error("Message submission failed:", err);

            if (uploadedPaths.length > 0) {
                const { error: cleanupError } = await supabase.storage
                    .from("ticket-attachments")
                    .remove(uploadedPaths);

                if (cleanupError) {
                    console.error("Could not clean up uploaded files:", cleanupError);
                }
            }

            setError(
                err instanceof Error ? err.message : "Could not send your message."
            );
        } finally {
            setSending(false);
        }
    }

    function formatMessageDate(value: string) {
        return new Date(value).toLocaleString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    }

    return (
        <section className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <MessageSquareText className="h-5 w-5" />
                    </div>

                    <div>
                        <h2 className="font-bold text-gray-900">Ticket Conversation</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Messages between the employee and IT team
                        </p>
                    </div>
                </div>

                <button
                    type="button"
                    onClick={() => void loadMessages()}
                    disabled={loading}
                    title="Refresh conversation"
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                >
                    <RefreshCw
                        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                </button>
            </div>

            <div className="max-h-[480px] min-h-[180px] space-y-4 overflow-y-auto bg-gray-50/70 p-5">
                {loading ? (
                    <div className="flex items-center justify-center gap-2 py-12 text-sm text-gray-500">
                        <Loader2 className="h-5 w-5 animate-spin" />
                        Loading conversation...
                    </div>
                ) : messages.length === 0 ? (
                    <div className="py-12 text-center">
                        <MessageSquareText className="mx-auto h-8 w-8 text-gray-300" />
                        <p className="mt-3 text-sm font-semibold text-gray-700">
                            No messages yet
                        </p>
                        <p className="mt-1 text-sm text-gray-500">
                            Start the conversation by sending a message.
                        </p>
                    </div>
                ) : (
                    messages.map((item) => {
                        const isMine = item.sender_id === userId;
                        const itemAttachments = normalizeAttachments(item.attachments);

                        return (
                            <div
                                key={item.id}
                                className={`flex ${isMine ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[90%] rounded-2xl px-4 py-3 shadow-sm ${isMine
                                            ? "rounded-br-sm bg-gray-950 text-white"
                                            : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                                        }`}
                                >
                                    <div className="mb-2 flex items-center gap-2">
                                        <span
                                            className={`text-xs font-bold ${isMine ? "text-blue-200" : "text-orange-600"
                                                }`}
                                        >
                                            {item.sender_role === "admin"
                                                ? "IT Support Team"
                                                : "Employee"}
                                        </span>
                                    </div>

                                    {item.message && (
                                        <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                            {item.message}
                                        </p>
                                    )}

                                    {itemAttachments.length > 0 && (
                                        <div className="mt-3 space-y-2">
                                            {itemAttachments.map((attachment, index) => {
                                                const isImage =
                                                    attachment.type?.startsWith("image/") ||
                                                    /\.(jpg|jpeg|png|webp)$/i.test(attachment.name);

                                                return (
                                                    <div
                                                        key={`${attachment.path}-${index}`}
                                                        className={`flex items-center gap-3 rounded-xl border p-3 ${isMine
                                                                ? "border-gray-700 bg-gray-800"
                                                                : "border-gray-200 bg-gray-50"
                                                            }`}
                                                    >
                                                        {isImage ? (
                                                            <ImageIcon className="h-5 w-5 shrink-0" />
                                                        ) : (
                                                            <FileText className="h-5 w-5 shrink-0" />
                                                        )}

                                                        <div className="min-w-0 flex-1">
                                                            <p className="break-words text-xs font-semibold">
                                                                {attachment.name}
                                                            </p>
                                                            <p
                                                                className={`mt-1 text-[10px] ${isMine ? "text-gray-400" : "text-gray-500"
                                                                    }`}
                                                            >
                                                                {formatFileSize(attachment.size || 0)}
                                                            </p>
                                                        </div>

                                                        <a
                                                            href={attachment.url}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            title="Open attachment"
                                                            className={`shrink-0 rounded-lg p-2 ${isMine
                                                                    ? "text-blue-200 hover:bg-gray-700"
                                                                    : "text-blue-600 hover:bg-blue-50"
                                                                }`}
                                                        >
                                                            <Download className="h-4 w-4" />
                                                        </a>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <p className="mt-2 text-right text-[10px] text-gray-400">
                                        {formatMessageDate(item.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {error && (
                <div className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                    {error}
                </div>
            )}

            {success && (
                <div className="mx-5 mt-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700">
                    {success}
                </div>
            )}

            {isReadOnly ? (
                <div className="border-t border-gray-100 bg-gray-50 p-5 text-center">
                    <p className="text-sm font-semibold text-gray-600">
                        This ticket is {ticketStatus}. The conversation is read-only.
                    </p>
                </div>
            ) : (
                <div className="border-t border-gray-100 p-5">
                    <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={(event) => {
                            if (
                                event.key === "Enter" &&
                                !event.shiftKey &&
                                !sending
                            ) {
                                event.preventDefault();
                                void sendMessage();
                            }
                        }}
                        rows={3}
                        maxLength={3000}
                        placeholder="Write your message..."
                        className="w-full resize-y rounded-xl border border-gray-200 bg-white p-4 text-sm outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100"
                    />

                    {userRole === "admin" && (
                        <div className="mt-3">
                            <input
                                ref={fileInputRef}
                                type="file"
                                multiple
                                accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xls,.xlsx"
                                className="hidden"
                                onChange={(event) =>
                                    handleFileSelection(event.target.files)
                                }
                            />

                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={sending || selectedFiles.length >= MAX_FILES}
                                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 disabled:opacity-50"
                            >
                                <Paperclip className="h-4 w-4" />
                                Attach files
                            </button>

                            <p className="mt-2 text-xs text-gray-400">
                                Up to {MAX_FILES} files, 10 MB each. Images, PDF, Word and Excel.
                            </p>

                            {selectedFiles.length > 0 && (
                                <div className="mt-3 space-y-2">
                                    {selectedFiles.map((file, index) => (
                                        <div
                                            key={`${file.name}-${index}`}
                                            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3"
                                        >
                                            <FileText className="h-4 w-4 shrink-0 text-gray-500" />

                                            <div className="min-w-0 flex-1">
                                                <p className="break-words text-sm font-medium text-gray-700">
                                                    {file.name}
                                                </p>
                                                <p className="text-xs text-gray-400">
                                                    {formatFileSize(file.size)}
                                                </p>
                                            </div>

                                            <button
                                                type="button"
                                                onClick={() => removeSelectedFile(index)}
                                                disabled={sending}
                                                className="rounded-lg p-2 text-gray-400 hover:bg-red-50 hover:text-red-600"
                                                title="Remove file"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-gray-400">
                            Press Enter to send, Shift + Enter for a new line.{" "}
                            {message.length}/3000
                        </p>

                        <button
                            type="button"
                            onClick={() => void sendMessage()}
                            disabled={
                                sending ||
                                (!message.trim() && selectedFiles.length === 0) ||
                                !userRole
                            }
                            className="inline-flex items-center justify-center gap-2 rounded-xl bg-gray-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            {sending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4" />
                            )}
                            Send Message
                        </button>
                    </div>
                </div>
            )}
        </section>
    );
}
