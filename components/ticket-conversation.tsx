
"use client";

import { useCallback, useEffect, useState } from "react";
import {
    Loader2,
    MessageSquareText,
    Send,
    RefreshCw,
    Lock,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

type TicketMessage = {
    id: string;
    ticket_id: string;
    sender_id: string;
    sender_role: "admin" | "employee";
    message: string;
    created_at: string;
};

type Props = {
    ticketId: string;
    ticketStatus: string;
};

export default function TicketConversation({
    ticketId,
    ticketStatus,
}: Props) {
    const [messages, setMessages] = useState<TicketMessage[]>([]);
    const [userId, setUserId] = useState("");
    const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
    const [message, setMessage] = useState("");
    const [currentStatus, setCurrentStatus] = useState(ticketStatus);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");

    const isReadOnly =
        currentStatus === "closed" || currentStatus === "cancelled";

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

            // Always retrieve the latest ticket status.
            const { data: ticket, error: ticketError } = await supabase
                .from("tickets")
                .select("id, status, user_id")
                .eq("id", ticketId)
                .single();

            if (ticketError) throw ticketError;

            if (profile.role === "employee" && ticket.user_id !== user.id) {
                throw new Error("You can only access your own ticket conversations.");
            }

            setCurrentStatus(ticket.status);

            const { data, error: messagesError } = await supabase
                .from("ticket_messages")
                .select(
                    "id, ticket_id, sender_id, sender_role, message, created_at"
                )
                .eq("ticket_id", ticketId)
                .order("created_at", { ascending: true });

            if (messagesError) throw messagesError;

            setMessages((data || []) as TicketMessage[]);
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
        setCurrentStatus(ticketStatus);
        void loadMessages();
    }, [ticketStatus, loadMessages]);

    async function sendMessage() {
        const cleanMessage = message.trim();

        if (!cleanMessage || sending || isReadOnly) return;

        setSending(true);
        setError("");

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

            // Check the actual database status immediately before sending.
            const { data: ticket, error: ticketError } = await supabase
                .from("tickets")
                .select("id, status, user_id")
                .eq("id", ticketId)
                .single();

            if (ticketError) throw ticketError;

            setCurrentStatus(ticket.status);

            if (ticket.status === "closed" || ticket.status === "cancelled") {
                setMessage("");
                throw new Error(
                    "This ticket is permanently closed or cancelled. Replies are disabled."
                );
            }

            if (profile.role === "employee" && ticket.user_id !== user.id) {
                throw new Error("You can only reply to your own tickets.");
            }

            const { error: insertError } = await supabase
                .from("ticket_messages")
                .insert({
                    ticket_id: ticketId,
                    sender_id: user.id,
                    sender_role: profile.role,
                    message: cleanMessage,
                    attachments: [],
                });

            if (insertError) throw insertError;

            setMessage("");
            await loadMessages();
        } catch (err) {
            console.error("Message submission failed:", err);

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
            {/* Header */}
            <div className="flex items-center justify-between border-b border-gray-100 p-6">
                <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                        <MessageSquareText className="h-5 w-5" />
                    </div>

                    <div>
                        <h2 className="font-bold text-gray-900">
                            Ticket Conversation
                        </h2>
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
                    className="rounded-lg border border-gray-200 p-2 text-gray-500 transition hover:bg-gray-50 disabled:opacity-50"
                >
                    <RefreshCw
                        className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
                    />
                </button>
            </div>

            {/* Messages */}
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

                        return (
                            <div
                                key={item.id}
                                className={`flex ${isMine ? "justify-end" : "justify-start"
                                    }`}
                            >
                                <div
                                    className={`max-w-[85%] rounded-2xl px-4 py-3 shadow-sm ${isMine
                                            ? "rounded-br-sm bg-gray-950 text-white"
                                            : "rounded-bl-sm border border-gray-200 bg-white text-gray-800"
                                        }`}
                                >
                                    <div className="mb-2">
                                        <span
                                            className={`text-xs font-bold ${isMine ? "text-blue-200" : "text-orange-600"
                                                }`}
                                        >
                                            {item.sender_role === "admin"
                                                ? "IT Support Team"
                                                : "Employee"}
                                        </span>
                                    </div>

                                    <p className="whitespace-pre-wrap break-words text-sm leading-6">
                                        {item.message}
                                    </p>

                                    <p className="mt-2 text-right text-[10px] text-gray-400">
                                        {formatMessageDate(item.created_at)}
                                    </p>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Error */}
            {error && (
                <div
                    role="alert"
                    className="mx-5 mt-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                    {error}
                </div>
            )}

            {/* Closed state */}
            {isReadOnly ? (
                <div className="border-t border-gray-100 bg-gray-50 p-6 text-center">
                    <Lock className="mx-auto h-6 w-6 text-gray-400" />

                    <p className="mt-2 text-sm font-semibold text-gray-700">
                        {currentStatus === "closed"
                            ? "This ticket has been permanently closed."
                            : "This ticket has been cancelled."}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                        The conversation remains available for viewing, but no further
                        replies can be sent.
                    </p>
                </div>
            ) : (
                <div className="border-t border-gray-100 p-5">
                    <textarea
                        value={message}
                        onChange={(event) => setMessage(event.target.value)}
                        onKeyDown={(event) => {
                            if (event.key === "Enter" && !event.shiftKey) {
                                event.preventDefault();
                                void sendMessage();
                            }
                        }}
                        rows={3}
                        maxLength={3000}
                        placeholder="Write your message..."
                        disabled={sending || loading}
                        className="w-full resize-y rounded-xl border border-gray-200 bg-white p-4 text-sm outline-none transition focus:border-gray-500 focus:ring-2 focus:ring-gray-100 disabled:bg-gray-100"
                    />

                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                        <p className="text-xs text-gray-400">
                            Press Enter to send, Shift + Enter for a new line.
                            {" "}{message.length}/3000
                        </p>

                        <button
                            type="button"
                            onClick={() => void sendMessage()}
                            disabled={sending || loading || !message.trim() || !userRole}
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
