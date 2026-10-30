"use client";
import { useEffect, useId, useRef, useState } from "react";
import { adminFetch } from "../auth/admin-session";
import {KycReview} from './KycReview';
export type ModerationAction =
  | "BLOCK"
  | "UNBLOCK"
  | "VERIFY"
  | "APPROVE"
  | "REJECT"
  | "SUSPEND"
  | "REQUEST_CHANGES";
type Snapshot = {
  available: boolean;
  state?: string;
  version?: number;
  active?: boolean;
  allowedActions?: ModerationAction[];
  history?: {
    requestId: string;
    action: string;
    reason: string;
    previousState: string;
    nextState: string;
    createdAt: string;
  }[];
};
export function ModerationDialog({
  kind,
  id,
  action: initialAction,
  onClose,
  onDone,
}: {
  kind: "customers" | "astrologers";
  id: string;
  action: ModerationAction;
  onClose: () => void;
  onDone: () => void;
}) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [action, setAction] = useState(initialAction),
    [reason, setReason] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true),
    [confirmed, setConfirmed] = useState(false),
    [submitted, setSubmitted] = useState(false);
  const command = useRef<{
      requestId: string;
      expectedVersion: number;
      action: ModerationAction;
      reason: string;
    } | null>(null),
    pending = useRef(false),
    heading = useRef<HTMLHeadingElement>(null);
  const title = useId();
  const [requestedFields,setRequestedFields]=useState<string[]>([]);
  const alive = useRef(true),
    mutation = useRef<AbortController | null>(null);
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      mutation.current?.abort();
    };
  }, []);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    heading.current?.focus();
    return () => previous?.focus();
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    void (async () => {
      try {
        const response = await adminFetch(
          "/admin/moderation/" + kind + "/" + encodeURIComponent(id),
          { signal: controller.signal },
        );
        if (!response.ok)
          throw Error(
            "Moderation review is unavailable. No change was submitted.",
          );
        const result = await response.json();
        if (!controller.signal.aborted) setSnapshot(result);
      } catch (e) {
        if (alive.current)
          setError(
            controller.signal.aborted
              ? "Review timed out. Close and reopen to retry."
              : e instanceof Error
                ? e.message
                : "Unable to load moderation review.",
          );
      } finally {
        clearTimeout(timer);
        if (alive.current) setLoading(false);
      }
    })();
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [kind, id]);
  async function confirm() {
    if (
      pending.current ||
      !confirmed ||
      !snapshot?.available ||
      snapshot.version === undefined ||
      !snapshot.allowedActions?.includes(action) ||
      reason.trim().length < 10
      || (action==='REQUEST_CHANGES' && requestedFields.length===0)
    )
      return;
    pending.current = true;
    setBusy(true);
    setError("");
    const controller = new AbortController();
    mutation.current = controller;
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      command.current ??= {
        requestId: crypto.randomUUID(),
        expectedVersion: snapshot.version,
        action,
        reason: reason.trim(),
        ...(action==='REQUEST_CHANGES'?{requestedFields}:{}),
      };
      setSubmitted(true);
      const response = await adminFetch(
        "/admin/moderation/" + kind + "/" + encodeURIComponent(id),
        {
          method: "PATCH",
          signal: controller.signal,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(command.current),
        },
      );
      const body = await response.json();
      if (!response.ok || !body.success)
        throw Error(
          typeof body.message === "string"
            ? body.message
            : "Change was not confirmed. Refresh before another command.",
        );
      if (alive.current && !controller.signal.aborted) onDone();
    } catch (e) {
      if (alive.current)
        setError(
          controller.signal.aborted
            ? "Result not confirmed. Retry the same command or close and refresh."
            : e instanceof Error
              ? e.message
              : "Change was not confirmed. Refresh before another command.",
        );
    } finally {
      clearTimeout(timer);
      pending.current = false;
      if (alive.current) setBusy(false);
    }
  }
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#0B1026]/50 p-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby={title}
        className="max-h-[90dvh] w-full max-w-xl overflow-y-auto rounded-2xl border border-[#D4AF37] bg-[#FFFCF5] p-6 text-[#10233F] shadow-xl"
        onKeyDown={(event) => {
          if (event.key === "Escape" && !busy) onClose();
          if (event.key === "Tab") {
            const items = event.currentTarget.querySelectorAll<HTMLElement>(
              "button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled)",
            );
            const first = items[0],
              last = items[items.length - 1];
            if (event.shiftKey && document.activeElement === first) {
              event.preventDefault();
              last?.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
              event.preventDefault();
              first?.focus();
            }
          }
        }}
      >
        <h2
          id={title}
          ref={heading}
          tabIndex={-1}
          className="text-2xl font-semibold"
        >
          Review account moderation
        </h2>
        <p className="my-3 text-sm">
          Only account access flags change. Roles, balances and historical
          records are preserved. Active or unsettled operations prevent changes.
        </p>
        {loading ? (
          <p role="status">Loading audit and state...</p>
        ) : !snapshot?.available ? (
          <p role="status">
            Audited moderation is not activated. Database review and separate
            activation approval are required. No change was submitted.
          </p>
        ) : (
          <>
            <p>
              Recorded state: {snapshot.state} / Version {snapshot.version}
            </p>
            <label className="my-4 block">
              Action
              <select
                aria-label="Moderation action"
                className="asp-admin-input mt-2 w-full"
                disabled={busy || submitted}
                value={action}
                onChange={(e) => setAction(e.target.value as ModerationAction)}
              >
                {!snapshot.allowedActions?.includes(action) && (
                  <option value={action} disabled>
                    {action} / unavailable in this state
                  </option>
                )}
                {snapshot.allowedActions?.map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>
            <p className="text-sm">
              VERIFY requires your explicit review of the existing
              verification/KYC evidence. Approval requires verification; it
              never verifies automatically.
            </p>
            {action==='REQUEST_CHANGES'&&<fieldset disabled={busy||submitted} className="my-4"><legend>Information the applicant must correct</legend>{['bio','languages','identityProof','certificates','experienceProofs'].map(field=><label key={field} className="my-2 flex gap-2"><input type="checkbox" checked={requestedFields.includes(field)} onChange={event=>setRequestedFields(current=>event.target.checked?[...current,field]:current.filter(value=>value!==field))}/>{field}</label>)}</fieldset>}
            <label className="my-4 block">
              Required reason (correction instructions are visible to the applicant)
              <textarea
                className="asp-admin-input mt-2 w-full"
                aria-label="Moderation reason"
                minLength={10}
                maxLength={1000}
                value={reason}
                disabled={busy || submitted}
                onChange={(e) => setReason(e.target.value)}
              />
            </label>
            <label className="my-4 flex gap-3">
              <input
                type="checkbox"
                required
                id={title + "-confirmation"}
                disabled={busy}
                checked={confirmed}
                onChange={(event) => setConfirmed(event.target.checked)}
              />
              I reviewed this account and confirm the selected action.
            </label>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (confirmed) void confirm();
              }}
            >
              <button
                type="submit"
                className="asp-admin-back-btn"
                disabled={
                  busy ||
                  !confirmed ||
                  !snapshot.allowedActions?.includes(action) ||
                  reason.trim().length < 10 ||
                  snapshot.active !== true
                  || (action==='REQUEST_CHANGES' && requestedFields.length===0)
                }
              >
                {busy
                  ? "Confirming..."
                  : submitted
                    ? "Retry same command"
                    : "Confirm moderation"}
              </button>
            </form>
            <details className="my-5">
              <summary>
                Durable audit history ({snapshot.history?.length ?? 0}, latest
                50)
              </summary>
              {snapshot.history?.map((entry) => (
                <article key={entry.requestId} className="my-3 border-t pt-3">
                  <p>
                    {entry.previousState} / {entry.nextState} / {entry.action}
                  </p>
                  <p className="whitespace-pre-wrap">{entry.reason}</p>
                  <time>{entry.createdAt}</time>
                </article>
              ))}
            </details>
          </>
        )}
        {kind==='astrologers'&&<KycReview key={id} id={id}/>}
        {error && (
          <p role="alert" className="my-4">
            {error}
          </p>
        )}
        <button
          type="button"
          className="asp-admin-back-btn mt-4"
          disabled={busy}
          onClick={onClose}
        >
          Close without another change
        </button>
      </section>
    </div>
  );
}
