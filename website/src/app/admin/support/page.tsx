"use client";

import { supportRequest as requestJson } from "@/features/admin/support/support-request";
import { SupportOperationsPanel } from "@/features/admin/support/SupportOperationsPanel";
import { SupportCataloguePanel } from "@/features/admin/support/SupportCataloguePanel";
import { SupportConversationReview } from "@/features/admin/support/SupportConversationReview";

import Link from "next/link";
import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type TicketStatus =
  | "OPEN"
  | "IN_PROGRESS"
  | "WAITING_FOR_CUSTOMER"
  | "RESOLVED"
  | "CLOSED";

type TicketPriority = "LOW" | "NORMAL" | "HIGH" | "URGENT";

type SupportMessage = {
  id: string;
  content: string;
  senderType: "CUSTOMER" | "ADMIN" | "SYSTEM";
  createdAt?: string;
};

type SupportAttachment = {
  id: string;
  originalFileName: string;
  contentType: string;
  sizeBytes: number;
  url: string;
};

type SupportTicket = {
  id: string;
  ticketNumber: string;
  subject: string;
  description?: string | null;
  category?: string;
  priority: TicketPriority;
  status: TicketStatus;
  createdAt?: string;
  customer?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
  assignedAdmin?: {
    id?: string;
    name?: string | null;
    email?: string | null;
  } | null;
  messages?: SupportMessage[];
  attachments?: SupportAttachment[];
  _count?: {
    messages?: number;
  };
};

type Stats = {
  open: number;
  inProgress: number;
  waitingForCustomer: number;
  resolved: number;
  closed: number;
  urgent: number;
  unassigned: number;
  active: number;
};

function statusLabel(status: string) {
  return status.replaceAll("_", " ");
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleString();
}

function formatFileSize(value?: number | null) {
  const bytes = Number(value ?? 0);

  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "Unknown size";
  }

  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return `${(bytes / 1024).toFixed(1)} KB`;
}

function safeAttachmentUrl(value?: string | null) {
  if (!value) return "";

  try {
    const url = new URL(value);

    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }

    return url.toString();
  } catch {
    return "";
  }
}

export default function AdminSupportPage() {
  const requests = useRef({ list: 0, detail: 0 });
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);

  const [selected, setSelected] = useState<SupportTicket | null>(null);

  const selectedRef = useRef<SupportTicket | null>(null);
  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);
  const replyKey = useRef<{ ticket: string; text: string; key: string } | null>(
    null,
  );
  const [stats, setStats] = useState<Stats | null>(null);

  const [statusFilter, setStatusFilter] = useState("");

  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);

  const [detailLoading, setDetailLoading] = useState(false);

  const [actionLoading, setActionLoading] = useState(false);

  const [reply, setReply] = useState("");

  const [error, setError] = useState("");

  const loadStats = useCallback(async () => {
    const data = await requestJson("/admin/support/stats");

    setStats(data?.stats ?? null);
  }, []);

  const loadTickets = useCallback(async () => {
    const current = ++requests.current.list;
    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      params.set("page", String(page));
      params.set("limit", "25");

      if (statusFilter) {
        params.set("status", statusFilter);
      }

      if (search.trim()) {
        params.set("search", search.trim());
      }

      const data = await requestJson(
        `/admin/support/tickets?${params.toString()}`,
      );

      if (current !== requests.current.list) return;
      setPages(data?.pagination?.pages ?? 0);
      setTickets(Array.isArray(data?.tickets) ? data.tickets : []);
    } catch (err) {
      if (current !== requests.current.list) return;
      setError(
        err instanceof Error ? err.message : "Unable to load support tickets.",
      );
    } finally {
      if (current === requests.current.list) setLoading(false);
    }
  }, [search, statusFilter, page]);

  const openTicket = useCallback(
    async (ticketId: string) => {
      const current = ++requests.current.detail;
      setDetailLoading(true);
      setError("");

      try {
        const data = await requestJson(`/admin/support/tickets/${ticketId}`);

        if (current !== requests.current.detail) return;
        setSelected(data?.ticket ?? null);

        await requestJson(`/admin/support/tickets/${ticketId}/read`, {
          method: "PATCH",
        });

        await loadStats();
      } catch (err) {
        if (current !== requests.current.detail) return;
        setError(err instanceof Error ? err.message : "Unable to open ticket.");
      } finally {
        if (current === requests.current.detail) setDetailLoading(false);
      }
    },
    [loadStats],
  );

  useEffect(() => {
    void Promise.all([loadStats(), loadTickets()]).catch(() => {
      setStats(null);
      setError("Support statistics could not be loaded. Refresh to retry.");
    });
  }, [loadStats, loadTickets]);

  async function refreshSelected() {
    const current = selectedRef.current;
    if (!current?.id) return;
    await openTicket(current.id);
  }

  async function assignToMe() {
    if (!selected) return;

    setActionLoading(true);

    try {
      await requestJson(`/admin/support/tickets/${selected.id}/assign`, {
        method: "PATCH",
        body: JSON.stringify({}),
      });

      await Promise.all([refreshSelected(), loadTickets(), loadStats()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Support update was not confirmed. Refresh before retrying.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function updateStatus(status: TicketStatus) {
    if (!selected) return;

    setActionLoading(true);

    try {
      await requestJson(`/admin/support/tickets/${selected.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
        }),
      });

      await Promise.all([refreshSelected(), loadTickets(), loadStats()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Support update was not confirmed. Refresh before retrying.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function updatePriority(priority: TicketPriority) {
    if (!selected) return;

    setActionLoading(true);

    try {
      await requestJson(`/admin/support/tickets/${selected.id}/priority`, {
        method: "PATCH",
        body: JSON.stringify({
          priority,
        }),
      });

      await Promise.all([refreshSelected(), loadTickets(), loadStats()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Support update was not confirmed. Refresh before retrying.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  async function sendReply(event: FormEvent) {
    event.preventDefault();

    if (!selected || !reply.trim()) {
      return;
    }

    if (
      !replyKey.current ||
      replyKey.current.ticket !== selected.id ||
      replyKey.current.text !== reply.trim()
    )
      replyKey.current = {
        ticket: selected.id,
        text: reply.trim(),
        key: crypto.randomUUID(),
      };
    setActionLoading(true);

    try {
      await requestJson(`/admin/support/tickets/${selected.id}/messages`, {
        method: "POST",
        body: JSON.stringify({
          content: reply.trim(),
          clientMessageId: replyKey.current!.key,
        }),
      });

      replyKey.current = null;
      if (selectedRef.current?.id === selected.id) setReply("");

      await Promise.all([refreshSelected(), loadTickets(), loadStats()]);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Support update was not confirmed. Refresh before retrying.",
      );
    } finally {
      setActionLoading(false);
    }
  }

  const statCards = useMemo(
    () => [
      ["Active", stats?.active ?? "Unavailable"],
      ["Open", stats?.open ?? "Unavailable"],
      ["In Progress", stats?.inProgress ?? "Unavailable"],
      ["Waiting", stats?.waitingForCustomer ?? "Unavailable"],
      ["Urgent", stats?.urgent ?? "Unavailable"],
      ["Unassigned", stats?.unassigned ?? "Unavailable"],
      ["Resolved", stats?.resolved ?? "Unavailable"],
    ],
    [stats],
  );

  useEffect(
    () => () => {
      requests.current.list++;
      requests.current.detail++;
    },
    [],
  );

  return (
    <main className="asp-admin-page px-5 py-8 text-[#10233F]">
      <nav
        aria-label="Support ticket pages"
        className="mb-4 flex items-center gap-4"
      >
        <button
          disabled={page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous
        </button>
        <span>
          Page {page} / {Math.max(1, pages)}
        </span>
        <button
          disabled={page >= pages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next
        </button>
      </nav>
      <div className="asp-admin-shell">
        <div className="asp-admin-top-back">
          <a href="/admin" className="asp-admin-back-btn">
            Back to Dashboard
          </a>
        </div>
        <Link href="/admin" className="text-sm font-bold text-[#8A6818]">
          Back to Admin Dashboard
        </Link>

        <p className="mt-5 text-xs font-bold uppercase tracking-[0.22em] text-[#8A6818]">
          24x7 Customer Support
        </p>

        <h1 className="mt-2 text-4xl font-semibold">Support Tickets</h1>
        <SupportCataloguePanel />
        <SupportConversationReview />

        <section className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          {statCards.map(([label, value]) => (
            <div key={String(label)} className="asp-admin-stat-card">
              <p className="text-xs text-[#66758A]">{label}</p>

              <p className="mt-2 text-3xl font-semibold">{value}</p>
            </div>
          ))}
        </section>

        {error ? (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-700">
            {error}
          </div>
        ) : null}

        <section className="mt-7 grid gap-6 xl:grid-cols-[0.9fr_1.35fr]">
          <div className="rounded-2xl border border-[#DDE3EC] bg-white p-5">
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search ticket..."
                className="min-w-0 flex-1 asp-admin-input px-4 py-3"
              />

              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="rounded-xl bg-[#F8FAFC] px-4"
              >
                <option value="">All</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="WAITING_FOR_CUSTOMER">Waiting</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>

              <button
                onClick={() => void loadTickets()}
                className="asp-admin-gold-btn px-5 font-bold text-slate-950"
              >
                Search
              </button>
            </div>

            <div className="mt-5 space-y-3">
              {loading ? (
                <p>Loading tickets...</p>
              ) : tickets.length === 0 ? (
                <p>No tickets found.</p>
              ) : (
                tickets.map((ticket) => (
                  <button
                    key={ticket.id}
                    type="button"
                    onClick={() => void openTicket(ticket.id)}
                    className="w-full rounded-xl border border-[#CBD5E1] bg-white p-4 text-left"
                  >
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-bold">{ticket.subject}</p>

                        <p className="text-xs text-[#8A6818]">
                          {ticket.ticketNumber}
                        </p>
                      </div>

                      <span className="text-xs">
                        {statusLabel(ticket.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-[#66758A]">
                      {ticket.category} - {ticket.priority} -{" "}
                      {ticket._count?.messages ?? 0} messages
                    </p>
                  </button>
                ))
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[#DDE3EC] bg-white p-5">
            {detailLoading ? (
              <p>Loading ticket...</p>
            ) : !selected ? (
              <p>Select a ticket.</p>
            ) : (
              <>
                <p className="text-xs text-[#8A6818]">
                  {selected.ticketNumber}
                </p>

                <h2 className="mt-2 text-2xl font-semibold">
                  {selected.subject}
                </h2>

                <p className="mt-2 text-[#66758A]">{selected.description}</p>

                <div className="mt-4 text-sm text-[#66758A]">
                  <p>Customer: {selected.customer?.name ?? "-"}</p>
                  <p>Phone: {selected.customer?.phone ?? "-"}</p>
                  <p>Created: {formatDate(selected.createdAt)}</p>
                  <p>
                    Assigned: {selected.assignedAdmin?.name ?? "Unassigned"}
                  </p>
                </div>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => void assignToMe()}
                  className="mt-4 rounded-xl border border-amber-400 px-4 py-2 text-[#987116]"
                >
                  Assign to me
                </button>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <select
                    value={selected.status}
                    onChange={(event) =>
                      void updateStatus(event.target.value as TicketStatus)
                    }
                    className="asp-admin-input px-3 py-3"
                  >
                    <option value="OPEN">Open</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="WAITING_FOR_CUSTOMER">
                      Waiting for Customer
                    </option>
                    <option value="RESOLVED">Resolved</option>
                    <option value="CLOSED">Closed</option>
                  </select>

                  <select
                    value={selected.priority}
                    onChange={(event) =>
                      void updatePriority(event.target.value as TicketPriority)
                    }
                    className="asp-admin-input px-3 py-3"
                  >
                    <option value="LOW">Low</option>
                    <option value="NORMAL">Normal</option>
                    <option value="HIGH">High</option>
                    <option value="URGENT">Urgent</option>
                  </select>
                </div>

                <div className="asp-admin-message-area mt-6 max-h-[420px] space-y-3 overflow-y-auto p-4">
                  {(selected.messages ?? []).map((message) => (
                    <div
                      key={message.id}
                      className={
                        message.senderType === "CUSTOMER"
                          ? "flex justify-start"
                          : "flex justify-end"
                      }
                    >
                      <div
                        className={
                          message.senderType === "CUSTOMER"
                            ? "asp-admin-customer-message max-w-[80%] rounded-2xl px-4 py-3"
                            : "asp-admin-agent-message max-w-[80%] rounded-2xl px-4 py-3"
                        }
                      >
                        <p>{message.content}</p>

                        <p className="mt-1 text-[13px] opacity-70">
                          {formatDate(message.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {selected.attachments?.length ? (
                  <section className="mt-5 rounded-2xl border border-[#DDE3EC] bg-[#F8FAFC] p-4">
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <div>
                        <h3 className="font-semibold text-[#14243D]">
                          {selected.attachments.length === 1
                            ? "Attachment"
                            : `Attachments (${selected.attachments.length})`}
                        </h3>

                        <p className="mt-1 text-xs text-[#66758A]">
                          Customer files attached to this support request.
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {selected.attachments.map((attachment) => {
                        const attachmentUrl = safeAttachmentUrl(attachment.url);

                        return (
                          <div
                            key={attachment.id}
                            className="flex items-center gap-3 rounded-xl border border-[#DDE3EC] bg-white px-4 py-3"
                          >
                            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#EEF2F7] text-lg">
                              {attachment.contentType?.startsWith("image/")
                                ? "🖼️"
                                : attachment.contentType === "application/pdf"
                                  ? "📄"
                                  : "📎"}
                            </div>

                            <div className="min-w-0 flex-1">
                              <p
                                className="truncate text-sm font-bold text-[#14243D]"
                                title={attachment.originalFileName}
                              >
                                {attachment.originalFileName || "Attachment"}
                              </p>

                              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#66758A]">
                                <span>
                                  {formatFileSize(attachment.sizeBytes)}
                                </span>

                                {attachment.contentType ? (
                                  <span>{attachment.contentType}</span>
                                ) : null}
                              </div>
                            </div>

                            {attachmentUrl ? (
                              <a
                                href={attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="asp-admin-gold-btn shrink-0 px-3 py-2 text-xs font-semibold text-slate-950 transition hover:bg-amber-300"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="shrink-0 text-xs font-bold text-red-700">
                                Link unavailable
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </section>
                ) : null}

                {selected.status !== "CLOSED" ? (
                  <form onSubmit={sendReply} className="mt-5 flex gap-3">
                    <textarea
                      value={reply}
                      onChange={(event) => setReply(event.target.value)}
                      placeholder="Reply to customer..."
                      className="min-w-0 flex-1 asp-admin-input px-4 py-3"
                    />

                    <button
                      type="submit"
                      disabled={actionLoading || !reply.trim()}
                      className="asp-admin-gold-btn px-5 font-semibold text-slate-950"
                    >
                      Send Reply
                    </button>
                  </form>
                ) : null}
              </>
            )}
          </div>
        </section>
      </div>
      {selected && (
        <SupportOperationsPanel key={selected.id} ticketId={selected.id} />
      )}
    </main>
  );
}
