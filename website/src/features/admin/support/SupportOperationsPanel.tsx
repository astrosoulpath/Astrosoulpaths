"use client";
import { useEffect, useRef, useState } from "react";
import { supportRequest } from "./support-request";
type Note = { id: string; content: string; createdAt: string };
type Audit = { id: string; action: string; createdAt: string };
function invalidateAsyncFence(ref: { current: number }) {
  ref.current++;
}
export function SupportOperationsPanel({ ticketId }: { ticketId: string }) {
  const [assignee, setAssignee] = useState("");
  async function assign(unassign = false) {
    const current = version.current;
    setBusy(true);
    try {
      await supportRequest(
        `/admin/support/tickets/${encodeURIComponent(ticketId)}/${unassign ? "unassign" : "assign"}`,
        {
          method: "PATCH",
          body: JSON.stringify(
            unassign ? {} : { adminUserId: assignee.trim() },
          ),
        },
      );
      if (current === version.current)
        setError("Assignment updated. Refresh the ticket header.");
    } catch {
      if (current === version.current)
        setError(
          "Assignment was not confirmed. Target must be an existing active unblocked Admin.",
        );
    } finally {
      if (current === version.current) setBusy(false);
    }
  }
  const version = useRef(0);
  const [data, setData] = useState<{
    enabled: boolean;
    notes: Note[];
    audit: Audit[];
  } | null>(null);
  const [note, setNote] = useState("");
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(1);
  useEffect(() => {
    const current = ++version.current;
    setData(null);
    setError("");
    supportRequest(
      `/admin/support/tickets/${encodeURIComponent(ticketId)}/operations?page=${page}`,
    )
      .then((value) => {
        if (version.current === current) setData(value);
      })
      .catch(() => {
        if (version.current === current)
          setError("Extended support operations are unavailable.");
      });
    return () => invalidateAsyncFence(version);
  }, [ticketId, page]);
  async function save() {
    const current = version.current;
    setBusy(true);
    setError("");
    try {
      await supportRequest(
        `/admin/support/tickets/${encodeURIComponent(ticketId)}/notes`,
        { method: "POST", body: JSON.stringify({ content: note.trim() }) },
      );
      if (current !== version.current) return;
      setNote("");
      const value = await supportRequest(
        `/admin/support/tickets/${encodeURIComponent(ticketId)}/operations?page=${page}`,
      );
      if (current === version.current) setData(value);
    } catch {
      if (current === version.current)
        setError("Private note could not be saved. Refresh before retrying.");
    } finally {
      if (current === version.current) setBusy(false);
    }
  }
  async function resolve() {
    const current = version.current;
    setBusy(true);
    try {
      await supportRequest(
        `/admin/support/tickets/${encodeURIComponent(ticketId)}/status`,
        {
          method: "PATCH",
          body: JSON.stringify({
            status: "RESOLVED",
            resolutionNote: resolution.trim(),
          }),
        },
      );
      if (current === version.current) {
        setResolution("");
        setError(
          "Ticket resolved. Refresh the conversation to view the customer-visible note.",
        );
      }
    } catch {
      if (current === version.current)
        setError("Resolution was not confirmed. Refresh before retrying.");
    } finally {
      if (current === version.current) setBusy(false);
    }
  }
  return (
    <section className="rounded-2xl border border-amber-200 bg-white p-4">
      <h3 className="font-semibold text-slate-900">
        Private Admin notes & audit
      </h3>
      {error && <p role="alert">{error}</p>}
      {data && !data.enabled && (
        <p className="text-sm text-slate-600">
          Pending schema and release approval.
        </p>
      )}
      {data?.enabled && (
        <>
          <fieldset className="mb-4 border-b pb-4">
            <label className="block font-medium">
              Existing Admin user ID
              <input
                value={assignee}
                maxLength={120}
                onChange={(e) => setAssignee(e.target.value)}
                className="mt-2 w-full rounded-xl border p-3"
              />
            </label>
            <div className="mt-2 flex flex-wrap gap-3">
              <button
                disabled={busy || !assignee.trim()}
                onClick={() => void assign()}
                className="asp-admin-gold-btn px-4 py-2"
              >
                Assign / reassign
              </button>
              <button disabled={busy} onClick={() => void assign(true)}>
                Unassign
              </button>
            </div>
          </fieldset>
          <fieldset className="mb-4 border-b pb-4">
            <label className="block font-medium">
              Customer-visible resolution note
              <textarea
                aria-label="Customer-visible resolution note"
                maxLength={3000}
                value={resolution}
                onChange={(e) => setResolution(e.target.value)}
                className="mt-2 w-full rounded-xl border p-3"
              />
            </label>
            <button
              disabled={busy || !resolution.trim()}
              onClick={() => void resolve()}
              className="asp-admin-gold-btn px-4 py-2"
            >
              Resolve with note
            </button>
          </fieldset>
          <p className="text-sm text-slate-600">
            Internal notes are never shown in customer conversations.
          </p>
          <textarea
            aria-label="Private Admin note"
            maxLength={5000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="mt-3 w-full rounded-xl border p-3"
          />
          <button
            className="asp-admin-gold-btn px-4 py-2"
            disabled={busy || !note.trim()}
            onClick={() => void save()}
          >
            Save private note
          </button>
          {data.notes.map((n) => (
            <p key={n.id} className="mt-2 whitespace-pre-wrap">
              {n.content}
            </p>
          ))}
          <ul aria-label="Ticket audit history">
            {data.audit.map((a) => (
              <li key={a.id}>
                {a.action.replaceAll("_", " ")} ·{" "}
                {new Date(a.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
          <div className="mt-3 flex gap-3">
            <button disabled={page === 1} onClick={() => setPage((p) => p - 1)}>
              Previous history
            </button>
            <button
              disabled={data.audit.length < 25 && data.notes.length < 25}
              onClick={() => setPage((p) => p + 1)}
            >
              Older history
            </button>
          </div>
        </>
      )}
    </section>
  );
}
