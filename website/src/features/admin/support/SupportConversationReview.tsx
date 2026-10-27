"use client";
import { useEffect, useRef, useState } from "react";
import { supportRequest } from "./support-request";
type Summary = { id: string; status: string; supportTicketId: string | null };
type Detail = Summary & {
  messages: { id: string; senderType: string; content: string }[];
};
export function SupportConversationReview() {
  const [open, setOpen] = useState(false),
    [page, setPage] = useState(1),
    [rows, setRows] = useState<Summary[]>([]),
    [detail, setDetail] = useState<Detail | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const fence = useRef(0);
  useEffect(() => {
    const clear = () => {
      fence.current++;
      setRows([]);
      setDetail(null);
      setOpen(false);
    };
    window.addEventListener("storage", clear);
    return () => {
      window.removeEventListener("storage", clear);
      fence.current++;
    };
  }, []);
  useEffect(() => {
    if (!open) return;
    const current = ++fence.current;
    setBusy(true);
    setRows([]);
    setDetail(null);
    setError("");
    supportRequest(`/admin/support/assistant/conversations?page=${page}`)
      .then((value) => {
        if (current === fence.current) setRows(value.conversations);
      })
      .catch(() => {
        if (current === fence.current)
          setError("Conversation review unavailable or unauthorized.");
      })
      .finally(() => {
        if (current === fence.current) setBusy(false);
      });
    return () => {
      fence.current++;
    };
  }, [open, page]);
  async function view(id: string) {
    if (busy) return;
    const current = ++fence.current;
    setBusy(true);
    setDetail(null);
    try {
      const value = await supportRequest(
        `/admin/support/assistant/conversations/${encodeURIComponent(id)}`,
      );
      if (current === fence.current) setDetail(value);
    } catch {
      if (current === fence.current)
        setError("Conversation could not be loaded.");
    } finally {
      if (current === fence.current) setBusy(false);
    }
  }
  return (
    <section className="mt-4 rounded-xl border border-[#E4D3AF] bg-white p-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="font-semibold"
      >
        {open ? "Hide" : "Review"} authorized AI support conversations
      </button>
      {open && (
        <>
          <p className="my-2 text-sm">
            Read only. Original messages are retained under existing policy. No
            provider or financial actions.
          </p>
          {error && <p role="alert">{error}</p>}
          {busy && <p role="status">Loading…</p>}
          {!busy && rows.length === 0 && <p>No conversations on this page.</p>}
          <div className="flex flex-wrap gap-2">
            {rows.map((row) => (
              <button
                disabled={busy}
                type="button"
                key={row.id}
                onClick={() => void view(row.id)}
                className="rounded-lg border px-3 py-2"
              >
                {row.id.slice(-8)} · {row.status}
              </button>
            ))}
          </div>
          <div className="my-3 flex gap-4">
            <button
              disabled={busy || page === 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </button>
            <span>Page {page}</span>
            <button
              disabled={busy || rows.length < 20}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </button>
          </div>
          {detail && (
            <div
              className="max-h-80 overflow-y-auto rounded-xl border p-3"
              aria-label="Support transcript"
            >
              {detail.messages.map((m) => (
                <div key={m.id} className="mb-3">
                  <strong>{m.senderType}</strong>
                  <p className="whitespace-pre-wrap break-words">{m.content}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}
