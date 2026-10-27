"use client";
import { useEffect, useRef, useState } from "react";
import { supportRequest } from "./support-request";
function invalidateAsyncFence(ref: { current: number }) {
  ref.current++;
}
export function FeedbackOperationsPanel({
  feedbackId,
}: {
  feedbackId: string;
}) {
  const generation = useRef(0);
  const [enabled, setEnabled] = useState(false),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState("");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<
    { id: string; action: string; createdAt: string }[]
  >([]);
  useEffect(() => {
    const current = ++generation.current;
    supportRequest(
      `/admin/feedback/${encodeURIComponent(feedbackId)}/audit?page=${page}`,
    )
      .then((data) => {
        if (generation.current === current) {
          setEnabled(data.enabled === true);
          setItems(Array.isArray(data.items) ? data.items : []);
        }
      })
      .catch(() => {
        if (generation.current === current)
          setMessage("Feedback audit is unavailable.");
      });
    return () => invalidateAsyncFence(generation);
  }, [feedbackId, page]);
  async function escalate() {
    const current = generation.current;
    setBusy(true);
    try {
      const data = await supportRequest(
        `/admin/feedback/${encodeURIComponent(feedbackId)}/escalate`,
        { method: "POST" },
      );
      if (current === generation.current)
        setMessage(
          `Support ticket linked: ${data.ticketId}. Open Support to manage it.`,
        );
    } catch {
      if (current === generation.current)
        setMessage("Escalation was not confirmed. Refresh before retrying.");
    } finally {
      if (current === generation.current) setBusy(false);
    }
  }
  return (
    <section className="mt-6 rounded-xl border border-amber-200 p-4">
      <h3 className="font-semibold">Moderation audit & support escalation</h3>
      {message && <p role="status">{message}</p>}
      {enabled ? (
        <>
          <button
            disabled={busy}
            onClick={() => void escalate()}
            className="asp-admin-gold-btn px-4 py-2"
          >
            Escalate to support
          </button>
          <ul>
            {items.map((item) => (
              <li key={item.id}>
                {item.action.replaceAll("_", " ")} ·{" "}
                {new Date(item.createdAt).toLocaleString()}
              </li>
            ))}
          </ul>
          <div className="flex gap-4">
            <button disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              Previous audit
            </button>
            <button
              disabled={items.length < 25}
              onClick={() => setPage((p) => p + 1)}
            >
              Older audit
            </button>
          </div>
        </>
      ) : (
        <p className="text-sm text-slate-600">
          Extended operations await schema and release approval.
        </p>
      )}
    </section>
  );
}
