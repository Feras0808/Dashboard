
"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  Download,
  FileSpreadsheet,
  FileText,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Ticket,
  XCircle,
} from "lucide-react";

import { supabase } from "@/lib/supabase";

type TicketRow = {
  id: string;
  ticket_number: string;
  employee_name: string;
  issue_type: string;
  issue_other: string | null;
  description: string;
  priority: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  company: { name: string } | null;
  department: { name: string } | null;
  completion_rejected: boolean;
  latest_feedback?: string | null;
  latest_feedback_message?: string | null;
};

type FeedbackRow = {
  ticket_id: string;
  decision: string;
  message: string | null;
  created_at: string;
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

function formatLabel(value: string | null | undefined) {
  if (!value) return "Not available";

  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) =>
    letter.toUpperCase()
  );
}

function formatDate(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Qatar",
  });
}

function getCompany(ticket: TicketRow) {
  return ticket.company?.name ?? "—";
}

function getDepartment(ticket: TicketRow) {
  return ticket.department?.name ?? "—";
}

function getIssue(ticket: TicketRow) {
  if (ticket.issue_type === "others" && ticket.issue_other?.trim()) {
    return ticket.issue_other.trim();
  }

  return issueLabels[ticket.issue_type] ?? formatLabel(ticket.issue_type);
}

function reportDateStamp() {
  return new Date().toLocaleDateString("en-CA", {
    timeZone: "Asia/Qatar",
  });
}

export default function AdminDashboard() {
  const router = useRouter();

  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [reporting, setReporting] = useState<"pdf" | "excel" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [reportMessage, setReportMessage] = useState("");

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [priorityFilter, setPriorityFilter] = useState("all");

  const loadTickets = useCallback(
    async (showRefresh = false) => {
      if (showRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      setErrorMessage("");

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
          .maybeSingle();

        if (profileError) {
          throw new Error(
            `Could not verify your profile: ${profileError.message}`
          );
        }

        if (profile?.role !== "admin") {
          router.replace("/employee");
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
            created_at,
            started_at,
            completed_at,
            company:companies(name),
            department:departments(name)
          `)
          .order("created_at", { ascending: false });

        if (error) {
          throw new Error(`Could not load tickets: ${error.message}`);
        }

        const ticketRows = (data ?? []) as unknown as Omit<
          TicketRow,
          "completion_rejected" | "latest_feedback" | "latest_feedback_message"
        >[];

        const { data: feedbackData, error: feedbackError } = await supabase
          .from("ticket_resolution_feedback")
          .select("ticket_id, decision, message, created_at")
          .order("created_at", { ascending: false });

        if (feedbackError) {
          console.error("Could not load resolution feedback:", feedbackError);

          setTickets(
            ticketRows.map((ticket) => ({
              ...ticket,
              completion_rejected: false,
              latest_feedback: null,
              latest_feedback_message: null,
            }))
          );

          setErrorMessage(
            "Tickets loaded, but completion rejection information could not be loaded. Check feedback table permissions."
          );

          return;
        }

        const latestFeedbackByTicket = new Map<string, FeedbackRow>();

        for (const feedback of (feedbackData ?? []) as FeedbackRow[]) {
          if (!latestFeedbackByTicket.has(feedback.ticket_id)) {
            latestFeedbackByTicket.set(feedback.ticket_id, feedback);
          }
        }

        setTickets(
          ticketRows.map((ticket) => {
            const feedback = latestFeedbackByTicket.get(ticket.id);

            return {
              ...ticket,
              completion_rejected:
                feedback?.decision === "still_not_solved",
              latest_feedback: feedback?.decision ?? null,
              latest_feedback_message: feedback?.message ?? null,
            };
          })
        );
      } catch (error) {
        console.error("Admin dashboard loading error:", error);

        setErrorMessage(
          error instanceof Error
            ? error.message
            : "An unexpected error occurred while loading tickets."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [router]
  );

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  async function handleSignOut() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      setErrorMessage(`Could not sign out: ${error.message}`);
      return;
    }

    router.replace("/login");
  }

  /*
   * Reports deliberately fetch ALL tickets again from Supabase.
   * They do not use the dashboard's search or filters.
   */
  async function fetchAllReportData() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      router.replace("/login");
      throw new Error("Your session has expired. Please sign in again.");
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError || profile?.role !== "admin") {
      throw new Error("Only administrators can generate reports.");
    }

    const { data: ticketData, error: ticketError } = await supabase
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
        created_at,
        started_at,
        completed_at,
        company:companies(name),
        department:departments(name)
      `)
      .order("created_at", { ascending: false });

    if (ticketError) {
      throw new Error(`Unable to fetch report tickets: ${ticketError.message}`);
    }

    const { data: feedbackData, error: feedbackError } = await supabase
      .from("ticket_resolution_feedback")
      .select("ticket_id, decision, message, created_at")
      .order("created_at", { ascending: false });

    if (feedbackError) {
      throw new Error(
        `Unable to fetch completion feedback: ${feedbackError.message}`
      );
    }

    const latestFeedbackByTicket = new Map<string, FeedbackRow>();

    for (const feedback of (feedbackData ?? []) as FeedbackRow[]) {
      if (!latestFeedbackByTicket.has(feedback.ticket_id)) {
        latestFeedbackByTicket.set(feedback.ticket_id, feedback);
      }
    }

    const reportTickets: TicketRow[] = (
      (ticketData ?? []) as unknown as Omit<
        TicketRow,
        "completion_rejected" | "latest_feedback" | "latest_feedback_message"
      >[]
    ).map((ticket) => {
      const feedback = latestFeedbackByTicket.get(ticket.id);

      return {
        ...ticket,
        completion_rejected: feedback?.decision === "still_not_solved",
        latest_feedback: feedback?.decision ?? null,
        latest_feedback_message: feedback?.message ?? null,
      };
    });

    return reportTickets;
  }

  function buildSummaryRows(reportTickets: TicketRow[]) {
    const rejected = reportTickets.filter(
      (ticket) => ticket.completion_rejected
    );

    return [
      ["Report Generated", formatDate(new Date().toISOString())],
      ["Total Tickets", reportTickets.length],
      ["New Tickets", reportTickets.filter((t) => t.status === "new").length],
      [
        "In Progress",
        reportTickets.filter((t) => t.status === "in_progress").length,
      ],
      [
        "Completed",
        reportTickets.filter((t) => t.status === "completed").length,
      ],
      [
        "Cancelled",
        reportTickets.filter((t) => t.status === "cancelled").length,
      ],
      [
        "Urgent Priority",
        reportTickets.filter((t) => t.priority === "urgent").length,
      ],
      ["High Priority", reportTickets.filter((t) => t.priority === "high").length],
      ["Completion Rejections", rejected.length],
    ];
  }

  function getTicketReportRows(reportTickets: TicketRow[]) {
    return reportTickets.map((ticket) => ({
      "Ticket Number": ticket.ticket_number,
      Employee: ticket.employee_name,
      Company: getCompany(ticket),
      Department: getDepartment(ticket),
      Issue: getIssue(ticket),
      Description: ticket.description,
      Priority: formatLabel(ticket.priority),
      Status: formatLabel(ticket.status),
      "Completion Rejected": ticket.completion_rejected ? "Yes" : "No",
      "Latest Employee Feedback": formatLabel(ticket.latest_feedback),
      "Feedback Message": ticket.latest_feedback_message ?? "",
      "Admin Response": ticket.admin_response ?? "",
      "Created At": formatDate(ticket.created_at),
      "Started At": formatDate(ticket.started_at),
      "Completed At": formatDate(ticket.completed_at),
    }));
  }

  function getRejectionRows(reportTickets: TicketRow[]) {
    return reportTickets
      .filter((ticket) => ticket.completion_rejected)
      .map((ticket) => ({
        "Ticket Number": ticket.ticket_number,
        Employee: ticket.employee_name,
        Company: getCompany(ticket),
        Department: getDepartment(ticket),
        Issue: getIssue(ticket),
        Priority: formatLabel(ticket.priority),
        "Current Ticket Status": formatLabel(ticket.status),
        "Employee Feedback": ticket.latest_feedback_message ?? "",
        "Ticket Created": formatDate(ticket.created_at),
      }));
  }

  async function generateExcelReport() {
    setReporting("excel");
    setReportMessage("");
    setErrorMessage("");

    try {
      const reportTickets = await fetchAllReportData();

      const XLSX = await import("xlsx");
      const workbook = XLSX.utils.book_new();

      // Worksheet 1: Summary.
      const summarySheet = XLSX.utils.aoa_to_sheet([
        ["IT SUPPORT MANAGEMENT REPORT"],
        ["All tickets — not affected by dashboard filters"],
        [],
        ["Metric", "Value"],
        ...buildSummaryRows(reportTickets),
      ]);

      summarySheet["!cols"] = [{ wch: 28 }, { wch: 35 }];

      XLSX.utils.book_append_sheet(workbook, summarySheet, "Summary");

      // Worksheet 2: Every ticket.
      const ticketRows = getTicketReportRows(reportTickets);
      const ticketsSheet = XLSX.utils.json_to_sheet(ticketRows);

      ticketsSheet["!cols"] = [
        { wch: 18 },
        { wch: 24 },
        { wch: 24 },
        { wch: 22 },
        { wch: 26 },
        { wch: 48 },
        { wch: 14 },
        { wch: 16 },
        { wch: 20 },
        { wch: 25 },
        { wch: 42 },
        { wch: 42 },
        { wch: 22 },
        { wch: 22 },
        { wch: 22 },
      ];

      XLSX.utils.book_append_sheet(workbook, ticketsSheet, "All Tickets");

      // Worksheet 3: Rejected completions only.
      const rejectionRows = getRejectionRows(reportTickets);

      const rejectionSheet = XLSX.utils.json_to_sheet(
        rejectionRows.length
          ? rejectionRows
          : [{ Message: "No completion rejections found." }]
      );

      rejectionSheet["!cols"] = [
        { wch: 18 },
        { wch: 24 },
        { wch: 24 },
        { wch: 22 },
        { wch: 26 },
        { wch: 14 },
        { wch: 22 },
        { wch: 48 },
        { wch: 22 },
      ];

      XLSX.utils.book_append_sheet(
        workbook,
        rejectionSheet,
        "Completion Rejections"
      );

      XLSX.writeFile(
        workbook,
        `IT-Support-Report-${reportDateStamp()}.xlsx`
      );

      setReportMessage(
        `Excel report generated successfully with ${reportTickets.length} tickets and ${rejectionRows.length} completion rejections.`
      );
    } catch (error) {
      console.error("Excel report generation failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not generate the Excel report."
      );
    } finally {
      setReporting(null);
    }
  }

  async function generatePdfReport() {
    setReporting("pdf");
    setReportMessage("");
    setErrorMessage("");

    try {
      const reportTickets = await fetchAllReportData();

      const { default: jsPDF } = await import("jspdf");
      const { default: autoTable } = await import("jspdf-autotable");

      const doc = new jsPDF({
        orientation: "landscape",
        unit: "mm",
        format: "a4",
      });

      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(20);
      doc.text("IT Support Management Report", 14, 17);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text("All tickets | Complete database report", 14, 24);
      doc.text(
        `Generated: ${formatDate(new Date().toISOString())}`,
        pageWidth - 14,
        24,
        { align: "right" }
      );

      const summaryRows = buildSummaryRows(reportTickets);

      autoTable(doc, {
        startY: 30,
        head: [["Metric", "Value"]],
        body: summaryRows,
        theme: "grid",
        margin: { left: 14, right: 14 },
        tableWidth: 100,
        styles: {
          font: "helvetica",
          fontSize: 8,
          cellPadding: 2,
          overflow: "linebreak",
        },
        headStyles: {
          fillColor: [31, 41, 55],
          textColor: 255,
          fontStyle: "bold",
        },
        columnStyles: {
          0: { cellWidth: 56 },
          1: { cellWidth: 44 },
        },
      });

      const afterSummary =
        ((doc as unknown as { lastAutoTable?: { finalY: number } })
          .lastAutoTable?.finalY ?? 75) + 10;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.text("All Tickets", 14, afterSummary);

      const ticketRows = reportTickets.map((ticket) => [
        ticket.ticket_number,
        ticket.employee_name,
        getCompany(ticket),
        getDepartment(ticket),
        getIssue(ticket),
        formatLabel(ticket.priority),
        formatLabel(ticket.status),
        ticket.completion_rejected ? "YES" : "No",
        formatDate(ticket.created_at),
      ]);

      autoTable(doc, {
        startY: afterSummary + 4,
        head: [[
          "Ticket",
          "Employee",
          "Company",
          "Department",
          "Issue",
          "Priority",
          "Status",
          "Rejected",
          "Created",
        ]],
        body: ticketRows.length
          ? ticketRows
          : [["No tickets found", "", "", "", "", "", "", "", ""]],
        theme: "striped",
        margin: { left: 10, right: 10 },
        styles: {
          font: "helvetica",
          fontSize: 7,
          cellPadding: 2,
          overflow: "linebreak",
          valign: "middle",
        },
        headStyles: {
          fillColor: [31, 41, 55],
          textColor: 255,
          fontStyle: "bold",
        },
        didParseCell(data) {
          if (data.section === "body" && data.column.index === 7) {
            if (String(data.cell.raw) === "YES") {
              data.cell.styles.textColor = [185, 28, 28];
              data.cell.styles.fontStyle = "bold";
            }
          }
        },
        didDrawPage(data) {
          const pageCount = doc.getNumberOfPages();

          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(
            `IT Support Report | Page ${data.pageNumber} of ${pageCount}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 7,
            { align: "center" }
          );
        },
      });

      // Dedicated section for the latest unresolved completion feedback.
      doc.addPage("a4", "landscape");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(17);
      doc.text("Completion Rejections", 14, 17);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.text(
        "Tickets whose latest employee feedback says the issue is still unresolved.",
        14,
        24
      );

      const rejectionRows = getRejectionRows(reportTickets);

      autoTable(doc, {
        startY: 30,
        head: [[
          "Ticket",
          "Employee",
          "Company",
          "Department",
          "Issue",
          "Priority",
          "Status",
          "Employee Feedback",
          "Created",
        ]],
        body: rejectionRows.map((row) => [
          row["Ticket Number"],
          row.Employee,
          row.Company,
          row.Department,
          row.Issue,
          row.Priority,
          row["Current Ticket Status"],
          row["Employee Feedback"] || "No message provided",
          row["Ticket Created"],
        ]),
        ...(rejectionRows.length === 0
          ? { body: [["—", "—", "—", "—", "—", "—", "—", "No completion rejections found.", "—"]] }
          : {}),
        theme: "grid",
        margin: { left: 10, right: 10, bottom: 14 },
        styles: {
          font: "helvetica",
          fontSize: 7,
          cellPadding: 2,
          overflow: "linebreak",
          valign: "top",
        },
        headStyles: {
          fillColor: [153, 27, 27],
          textColor: 255,
          fontStyle: "bold",
        },
        didDrawPage(data) {
          doc.setFontSize(8);
          doc.setFont("helvetica", "normal");
          doc.text(
            `IT Support Report | Page ${data.pageNumber} of ${doc.getNumberOfPages()}`,
            pageWidth / 2,
            doc.internal.pageSize.getHeight() - 7,
            { align: "center" }
          );
        },
      });

      doc.save(`IT-Support-Report-${reportDateStamp()}.pdf`);

      setReportMessage(
        `PDF report generated successfully with ${reportTickets.length} tickets and ${rejectionRows.length} completion rejections.`
      );
    } catch (error) {
      console.error("PDF report generation failed:", error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Could not generate the PDF report."
      );
    } finally {
      setReporting(null);
    }
  }

  const statistics = useMemo(
    () => ({
      total: tickets.length,
      new: tickets.filter((ticket) => ticket.status === "new").length,
      inProgress: tickets.filter(
        (ticket) => ticket.status === "in_progress"
      ).length,
      completed: tickets.filter(
        (ticket) => ticket.status === "completed"
      ).length,
      urgent: tickets.filter((ticket) => ticket.priority === "urgent").length,
    }),
    [tickets]
  );

  const filteredTickets = useMemo(() => {
    const searchValue = search.toLowerCase().trim();

    return tickets.filter((ticket) => {
      const matchesSearch =
        !searchValue ||
        ticket.ticket_number.toLowerCase().includes(searchValue) ||
        ticket.employee_name.toLowerCase().includes(searchValue) ||
        getCompany(ticket).toLowerCase().includes(searchValue) ||
        getDepartment(ticket).toLowerCase().includes(searchValue) ||
        getIssue(ticket).toLowerCase().includes(searchValue);

      const matchesStatus =
        statusFilter === "all" || ticket.status === statusFilter;

      const matchesPriority =
        priorityFilter === "all" || ticket.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tickets, search, statusFilter, priorityFilter]);

  return (
    <main className="min-h-screen bg-[#f5f7fa]">
      <header className="border-b bg-white">
        <div className="mx-auto flex min-h-20 max-w-[1500px] flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              IT Support Dashboard
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Manage and resolve employee IT requests
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => void generatePdfReport()}
              disabled={loading || refreshing || reporting !== null}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reporting === "pdf" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileText className="h-4 w-4" />
              )}
              {reporting === "pdf" ? "Generating PDF..." : "Generate PDF"}
            </button>

            <button
              onClick={() => void generateExcelReport()}
              disabled={loading || refreshing || reporting !== null}
              className="flex items-center gap-2 rounded-xl border border-green-200 bg-green-50 px-4 py-2.5 text-sm font-medium text-green-800 shadow-sm transition hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {reporting === "excel" ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="h-4 w-4" />
              )}
              {reporting === "excel"
                ? "Generating Excel..."
                : "Generate Excel"}
            </button>

            <button
              onClick={() => void loadTickets(true)}
              disabled={refreshing || loading || reporting !== null}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>

            <button
              onClick={handleSignOut}
              className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-[1500px] px-6 py-8">
        {errorMessage && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"
          >
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">Dashboard notice</p>
              <p className="mt-1 break-words">{errorMessage}</p>
              <button
                onClick={() => void loadTickets(true)}
                className="mt-3 font-semibold underline"
              >
                Refresh dashboard
              </button>
            </div>
          </div>
        )}

        {reportMessage && (
          <div
            role="status"
            className="mb-6 flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          >
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <p>{reportMessage}</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <StatCard
            title="Total Tickets"
            value={statistics.total}
            icon={<Ticket className="h-5 w-5" />}
          />
          <StatCard
            title="New"
            value={statistics.new}
            icon={<AlertCircle className="h-5 w-5" />}
          />
          <StatCard
            title="In Progress"
            value={statistics.inProgress}
            icon={<Clock3 className="h-5 w-5" />}
          />
          <StatCard
            title="Completed"
            value={statistics.completed}
            icon={<CheckCircle2 className="h-5 w-5" />}
          />
          <StatCard
            title="Urgent"
            value={statistics.urgent}
            icon={<AlertCircle className="h-5 w-5" />}
          />
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="border-b p-5">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
              <div>
                <h2 className="font-semibold text-gray-900">
                  Support Tickets
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  {filteredTickets.length} ticket
                  {filteredTickets.length !== 1 ? "s" : ""} shown
                </p>
              </div>

              <div className="flex flex-col gap-3 md:flex-row">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search tickets..."
                    className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-4 text-sm outline-none transition focus:border-gray-900 md:w-72"
                  />
                </div>

                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-900"
                  aria-label="Filter by status"
                >
                  <option value="all">All Statuses</option>
                  <option value="new">New</option>
                  <option value="in_progress">In Progress</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>

                <select
                  value={priorityFilter}
                  onChange={(event) => setPriorityFilter(event.target.value)}
                  className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm outline-none focus:border-gray-900"
                  aria-label="Filter by priority"
                >
                  <option value="all">All Priorities</option>
                  <option value="urgent">Urgent</option>
                  <option value="high">High</option>
                  <option value="normal">Normal</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-72 items-center justify-center">
              <div className="flex items-center gap-3 text-gray-500">
                <Loader2 className="h-5 w-5 animate-spin" />
                Loading tickets...
              </div>
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex min-h-72 flex-col items-center justify-center px-6 text-center">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-100">
                <Ticket className="h-7 w-7 text-gray-400" />
              </div>
              <h3 className="mt-4 font-semibold text-gray-900">
                No tickets found
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                Try changing your search or filters.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[1150px]">
                <thead>
                  <tr className="border-b bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                    <th className="px-5 py-4 font-medium">Ticket</th>
                    <th className="px-5 py-4 font-medium">Employee</th>
                    <th className="px-5 py-4 font-medium">Company</th>
                    <th className="px-5 py-4 font-medium">Department</th>
                    <th className="px-5 py-4 font-medium">Issue</th>
                    <th className="px-5 py-4 font-medium">Priority</th>
                    <th className="px-5 py-4 font-medium">Status</th>
                    <th className="px-5 py-4 font-medium">Created</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-100">
                  {filteredTickets.map((ticket) => (
                    <tr
                      key={ticket.id}
                      onClick={() => router.push(`/admin/tickets/${ticket.id}`)}
                      className={`cursor-pointer transition hover:bg-gray-50 ${
                        ticket.completion_rejected ? "bg-red-50/40" : ""
                      }`}
                    >
                      <td className="px-5 py-4">
                        <span className="font-semibold text-gray-900">
                          {ticket.ticket_number}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-900">
                          {ticket.employee_name}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {getCompany(ticket)}
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-600">
                        {getDepartment(ticket)}
                      </td>

                      <td className="px-5 py-4">
                        <div className="font-medium text-gray-800">
                          {getIssue(ticket)}
                        </div>
                      </td>

                      <td className="px-5 py-4">
                        <span
                          className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold capitalize ${
                            priorityStyles[ticket.priority] ??
                            "border-gray-200 bg-gray-50 text-gray-700"
                          }`}
                        >
                          {formatLabel(ticket.priority)}
                        </span>
                      </td>

                      <td className="px-5 py-4">
                        <div className="flex flex-col items-start gap-2">
                          <span
                            className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${
                              statusStyles[ticket.status] ??
                              "border-gray-200 bg-gray-50 text-gray-700"
                            }`}
                          >
                            {formatLabel(ticket.status)}
                          </span>

                          {ticket.completion_rejected && (
                            <span
                              title={
                                ticket.latest_feedback_message ??
                                "The employee reported that the issue is unresolved."
                              }
                              className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-red-200 bg-red-50 px-2.5 py-1 text-xs font-bold text-red-700"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                              Completion Rejected
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 text-sm text-gray-500">
                        {formatDate(ticket.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gray-100 text-gray-700">
          {icon}
        </div>
        <span className="text-3xl font-bold text-gray-900">{value}</span>
      </div>
      <p className="mt-4 text-sm font-medium text-gray-500">{title}</p>
    </div>
  );
}