"use client";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { PromotionArt } from "@/features/customer-dashboard/PromotionArt";
import { formatStoredMoney } from "@/lib/currency-display";
import {
  consultationDestination,
  ownedRequests,
  professionalOwner,
  professionalRequest,
  ProfessionalAccessError,
  record,
  verifiedProfessional,
  type Row,
} from "./dashboard-api";
import { ProfessionalSettings } from "./ProfessionalSettings";
import c from "@/features/customer-dashboard/dashboard.module.css";
import typography from "@/features/customer-dashboard/dashboard-typography.module.css";
import s from "./professional.module.css";
export type ProfessionalSnapshot = {
  dashboard: Row;
  requests: Row[] | null;
  history: Row[] | null;
  profile: Row | null;
  availability: Row | null;
  earnings: Row | null;
  notifications?: Row | null;
};
export type ProfessionalActions = {
  refresh: () => void;
  status: () => void;
  accept: (call: Row) => void;
  reject: (call: Row) => void;
  dirty: (value: boolean) => void;
  save: (kind: "profile" | "availability", body: object) => Promise<void>;
};
const count = (value: unknown) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value)
    : "Unavailable";
function Amounts({
  value,
  empty = "No earnings recorded",
}: {
  value: unknown;
  empty?: string;
}) {
  return (
    <span className={s.statLines}>
      {!Array.isArray(value)
        ? "Unavailable"
        : value.length === 0
          ? empty
          : value.map((v, i) => {
              const row = record(v);
              return (
                <span key={String(row.currency) + i}>
                  {formatStoredMoney(row.amount, row.currency)}
                </span>
              );
            })}
    </span>
  );
}
export function AstrologerDashboardView({
  snapshot,
  loading,
  busy,
  uncertain,
  error,
  message,
  queueError,
  actions,
}: {
  snapshot: ProfessionalSnapshot | null;
  loading: boolean;
  busy: boolean;
  uncertain: boolean;
  error: string;
  message: string;
  queueError: string;
  actions: ProfessionalActions;
}) {
  const d = snapshot?.dashboard,
    online = d?.isOnline === true,
    approved = d?.isApproved === true && d?.isVerified === true,
    requests = snapshot?.requests ?? null;
  const stats = [
    {
      label: "Today's recorded earnings",
      value: <Amounts value={d?.todayEarningsByCurrency} />,
      detail:
        d?.reportingTimezone === "UTC"
          ? "UTC reporting day · " + String(d.reportingDate)
          : "Reporting window unavailable",
    },
    {
      label: "Active consultations",
      value: count(d?.activeConsultations),
      detail: "Live, unended sessions",
    },
    {
      label: "Completed consultations",
      value: count(d?.completedConsultations),
      detail: "Completed / ended history",
    },
    {
      label: "Pending requests",
      value: count(d?.pendingConsultations),
      detail: "Unexpired incoming requests",
    },
  ];
  const shortcuts = [
    ["Chat consultations", "#requests", "Chat and audio requests"],
    ["Audio calls", "#requests", "Use supported session controls"],
    ["Schedule", "#schedule", "Your weekly availability"],
    ["Earnings", "#earnings", "Currency-separated ledger"],
    [
      "Reviews",
      d?.astrologerId
        ? "/astrologers/" + encodeURIComponent(String(d.astrologerId))
        : "#professional-profile",
      "Published profile and feedback",
    ],
    ["Profile", "#professional-profile", "Your professional details"],
    ["Settings", "#settings", "Description, rate and availability"],
  ];
  return (
    <main className={c.page + " " + s.professional + " " + typography.type}>
      <div className={c.container}>
        <div className={c.topline}>
          <span>YOUR PROFESSIONAL SPACE</span>
          <Link className={c.wallet} href="/astrologer/pending">
            Application status
          </Link>
        </div>
        <section className={c.hero}>
          <div>
            <p className={c.eyebrow}>ASTRO SOUL PATH · PROFESSIONAL</p>
            <h1>
              {snapshot
                ? `${String(d?.name || "Welcome")}, share your perspective.`
                : "Your professional dashboard."}
            </h1>
            <p>
              Manage your availability, conversations and recorded earnings in
              one place.
            </p>
            <div className={s.heroStatus}>
              <span className={s.status}>
                {approved
                  ? "Admin approved · Verified"
                  : "Approval not verified"}
              </span>
              <span className={s.status}>
                <span
                  aria-hidden="true"
                  className={s.dot + (online ? " " + s.online : "")}
                />
                {snapshot
                  ? online
                    ? "Online"
                    : "Offline"
                  : "Availability unverified"}
              </span>
              <button
                type="button"
                disabled={!approved || loading || busy || uncertain}
                onClick={actions.status}
              >
                {busy ? "Updating…" : online ? "Go offline" : "Go online"}
              </button>
            </div>
            <div className={c.links}>
              <Link href="#professional-profile">Professional profile ↗</Link>
              <Link href="#history">Session history</Link>
            </div>
          </div>
          <div className={c.heroArt}>
            <PromotionArt kind="career" />
          </div>
        </section>
        {error && (
          <div role="alert" className={c.notice + " " + s.error}>
            {error}
            <div className={s.row}>
              <button disabled={loading || busy} onClick={actions.refresh}>
                Verify & reload
              </button>
              <Link href="/astrologer/login">Astrologer sign-in</Link>
            </div>
          </div>
        )}
        {message && (
          <p role="status" className={c.notice}>
            {message}
          </p>
        )}
        {uncertain && (
          <p role="alert" className={c.notice}>
            The previous change has an unconfirmed outcome. Reload server
            records before any further change; automatic retries are disabled.
          </p>
        )}
        <section
          aria-label="Professional account statistics"
          className={c.stats}
        >
          {stats.map((stat) => (
            <article key={stat.label}>
              <p>{stat.label}</p>
              <strong>
                {loading ? (
                  <span className={c.skeleton} aria-label="Loading" />
                ) : (
                  stat.value
                )}
              </strong>
              <small>{stat.detail}</small>
            </article>
          ))}
        </section>
        <div className={c.columns}>
          <div className={c.primary}>
            <section className={c.section}>
              <div className={c.sectionHeading}>
                <div>
                  <p className={c.eyebrow}>YOUR DAILY WORKSPACE</p>
                  <h2>Quick Access</h2>
                </div>
                <button onClick={actions.refresh} disabled={loading || busy}>
                  Refresh dashboard
                </button>
              </div>
              <div className={c.services}>
                {shortcuts.map(([label, href, detail]) => (
                  <Link href={href} key={label}>
                    <span aria-hidden="true">✧</span>
                    <strong>{label}</strong>
                    <small>{detail}</small>
                  </Link>
                ))}
                <div className={s.inactive}>
                  <span aria-hidden="true">◇</span>
                  <strong>Video calls</strong>
                  <small>
                    New video consultations are not offered by this website
                    flow.
                  </small>
                </div>
              </div>
            </section>
            <section className={c.section} id="history">
              <div className={c.sectionHeading}>
                <h2>Consultation Overview</h2>
                <span className={s.note}>Latest 10 owned sessions</span>
              </div>
              {loading ? (
                <p role="status">Loading your sessions…</p>
              ) : !snapshot ? (
                <p>Verify your professional account to load private records.</p>
              ) : snapshot.history === null ? (
                <p>
                  Session history could not be loaded. Use Refresh dashboard.
                </p>
              ) : snapshot.history.length === 0 ? (
                <p>No consultation records returned.</p>
              ) : (
                <div className={c.history}>
                  {snapshot.history.map((call) => {
                    const href = consultationDestination(call);
                    return (
                      <article key={String(call.id)}>
                        <div>
                          <strong>
                            {String(
                              record(record(call.user).userProfile).fullName ||
                                "Customer",
                            )}
                          </strong>
                          <p>
                            {String(call.mode)} · {String(call.status)}
                          </p>
                        </div>
                        {href ? (
                          <Link href={href}>Open session ↗</Link>
                        ) : (
                          <span className={s.note}>
                            Session controls unavailable for this mode
                          </span>
                        )}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>
            <section id="earnings" className={c.section}>
              <h2>Recorded earnings</h2>
              <p className={s.note}>
                Original ledger currencies stay separate. These amounts do not
                confirm a bank transfer.
              </p>
              <dl className={s.definition}>
                <dt>Total recorded share</dt>
                <dd>
                  <Amounts value={d?.earningsByCurrency} />
                </dd>
                <dt>Available earnings</dt>
                <dd>
                  <Amounts
                    value={snapshot?.earnings?.availableBalanceByCurrency}
                  />
                </dd>
                <dt>Pending earnings</dt>
                <dd>
                  <Amounts
                    value={snapshot?.earnings?.pendingBalanceByCurrency}
                  />
                </dd>
                <dt>Recorded paid amount</dt>
                <dd>
                  <Amounts value={snapshot?.earnings?.paidAmountByCurrency} />
                </dd>
              </dl>
              <p className={s.note}>
                Payout execution is not enabled by this dashboard.
              </p>
            </section>
            <section id="professional-profile" className={c.section}>
              <h2>Professional profile</h2>
              {!snapshot?.profile ? (
                <p>
                  Profile details are unavailable until loaded from your
                  account.
                </p>
              ) : (
                <>
                  <p>
                    {String(
                      snapshot.profile.bio ||
                        "No professional description returned.",
                    )}
                  </p>
                  <dl className={s.definition}>
                    <dt>Languages</dt>
                    <dd>
                      {Array.isArray(d?.languages)
                        ? d.languages.join(", ")
                        : "Unavailable"}
                    </dd>
                    <dt>Expertise</dt>
                    <dd>
                      {Array.isArray(d?.expertise)
                        ? d.expertise.join(", ")
                        : "Unavailable"}
                    </dd>
                    <dt>Rate per minute</dt>
                    <dd>
                      {typeof d?.pricePerMin === "number" && d.pricePerMin > 0
                        ? formatStoredMoney(d.pricePerMin, d.pricingCurrency)
                        : "Rate awaiting confirmation"}
                    </dd>
                    <dt>Experience</dt>
                    <dd>
                      {typeof d?.experience === "number"
                        ? d.experience + " years"
                        : "Unavailable"}
                    </dd>
                    <dt>Aggregate rating</dt>
                    <dd>
                      {typeof d?.rating === "number"
                        ? d.rating + " / 5"
                        : "Unavailable"}
                    </dd>
                  </dl>
                  <p className={s.note}>
                    Profile completion: {count(d?.profileCompletion)}
                    {typeof d?.profileCompletion === "number" ? "%" : ""}
                  </p>
                </>
              )}
            </section>
            <section id="settings" className={c.section}>
              <h2>Professional settings</h2>
              <p className={s.note}>
                Account identity and KYC decisions remain managed through their
                existing verified workflows.
              </p>
              {snapshot && (
                <ProfessionalSettings
                  profile={snapshot.profile}
                  availability={snapshot.availability}
                  blocked={busy || uncertain || !approved}
                  onDirty={actions.dirty}
                  onSave={actions.save}
                />
              )}
            </section>
          </div>
          <aside className={c.guidance} id="requests">
            <p className={c.eyebrow}>REAL CONNECTIONS</p>
            <h2>Incoming consultations</h2>
            <p>Your approved availability and current backend requests.</p>
            {queueError && (
              <p role="alert" className={c.notice}>
                {queueError}
              </p>
            )}
            {loading ? (
              <p role="status">Checking requests…</p>
            ) : !snapshot ? (
              <p>Sign in as an approved Astrologer to load requests.</p>
            ) : requests === null ? (
              <p>Request status unavailable. Reload to verify.</p>
            ) : requests.length === 0 ? (
              <p>No active or pending requests returned.</p>
            ) : (
              <div className={s.requests}>
                {requests.map((call) => {
                  const pending =
                      String(call.status).toUpperCase() === "PENDING",
                    href = consultationDestination(call);
                  return (
                    <article key={String(call.id)} className={s.request}>
                      <h3>{String(call.mode || "Consultation")} request</h3>
                      <p>{String(call.status)}</p>
                      <p>
                        {String(
                          record(record(call.user).userProfile).fullName ||
                            "Customer",
                        )}
                      </p>
                      <div className={s.row}>
                        {pending && href ? (
                          <>
                            <button
                              disabled={busy || uncertain || !approved}
                              onClick={() => actions.accept(call)}
                            >
                              Accept
                            </button>
                            <button
                              disabled={busy || uncertain || !approved}
                              onClick={() => actions.reject(call)}
                            >
                              Reject
                            </button>
                          </>
                        ) : href ? (
                          <Link href={href}>
                            Open {String(call.mode)} session
                          </Link>
                        ) : (
                          <span>
                            Use the supported mobile workflow for this mode.
                          </span>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
            <section id="schedule">
              <h2>Weekly availability</h2>
              {!snapshot?.availability ? (
                <p>Availability could not be loaded.</p>
              ) : (
                <>
                  <p>
                    Timezone:{" "}
                    {String(snapshot.availability.timezone || "Unavailable")}
                  </p>
                  {Array.isArray(snapshot.availability.days) &&
                  snapshot.availability.days.length ? (
                    snapshot.availability.days.map((v, i) => {
                      const day = record(v);
                      return (
                        <p key={i}>
                          {
                            [
                              "Sunday",
                              "Monday",
                              "Tuesday",
                              "Wednesday",
                              "Thursday",
                              "Friday",
                              "Saturday",
                            ][Number(day.dayOfWeek)]
                          }
                          :{" "}
                          {day.isEnabled
                            ? String(day.startTime) + "–" + String(day.endTime)
                            : "Disabled"}
                        </p>
                      );
                    })
                  ) : (
                    <p>No weekly availability configured.</p>
                  )}
                  <Link href="#schedule-settings" className={c.allGuides}>
                    Edit availability ↗
                  </Link>
                </>
              )}
              <p className={c.fine}>
                A scheduled-booking calendar is not available here. Incoming
                requests are shown above.{" "}
              </p>
            </section>
            <section id="professional-notifications">
              <h2>Recent notifications</h2>
              {!Array.isArray(snapshot?.notifications?.items) ? (
                <p>Notifications could not be loaded.</p>
              ) : (
                <>
                  <p className={s.note}>
                    Unread: {count(snapshot.notifications.unreadCount)} ·
                    Showing up to five latest records. Reading here does not
                    mark them read or send push.
                  </p>
                  {snapshot.notifications.items.length === 0 ? (
                    <p>No notifications returned.</p>
                  ) : (
                    snapshot.notifications.items.slice(0, 5).map((v, i) => {
                      const notification = record(v);
                      return (
                        <article
                          key={String(notification.id ?? i)}
                          className={s.request}
                        >
                          <h3>
                            {typeof notification.title === "string"
                              ? notification.title
                              : "Notification"}
                          </h3>
                          <p>
                            {typeof notification.body === "string"
                              ? notification.body
                              : ""}
                          </p>
                        </article>
                      );
                    })
                  )}
                </>
              )}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
export function AstrologerDashboard() {
  const router = useRouter(),
    [snapshot, setSnapshot] = useState<ProfessionalSnapshot | null>(null),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [uncertain, setUncertain] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [queueError, setQueueError] = useState(""),
    [revision, setRevision] = useState(0);
  const generation = useRef(0),
    controller = useRef<AbortController | null>(null),
    lock = useRef(false),
    reading = useRef(false),
    editing = useRef(false),
    active = useRef(false),
    snapshotRef = useRef<ProfessionalSnapshot | null>(null);
  const load = useCallback(
    async (changed = false) => {
      if (!changed && (lock.current || reading.current || editing.current))
        return;
      const version = ++generation.current;
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      reading.current = true;
      setLoading(true);
      setError("");
      setQueueError("");
      setSnapshot(null);
      snapshotRef.current = null;
      try {
        const session = await verifiedProfessional(abort.signal);
        if (abort.signal.aborted || version !== generation.current) return;
        if (session.redirect) {
          router.replace(session.redirect);
          return;
        }
        const owner = professionalOwner();
        const body = await professionalRequest("/astrologer/dashboard", {
            signal: abort.signal,
          }),
          dashboard = record(body.data);
        if (
          dashboard.userId !== session.id ||
          dashboard.isApproved !== true ||
          dashboard.isVerified !== true
        )
          throw new ProfessionalAccessError(
            403,
            "Admin approval must be verified.",
          );
        const paths = [
          "/consultations/astrologer/current",
          "/consultations/astrologer/history?page=1&limit=10",
          "/astrologer/profile",
          "/astrologer/availability",
          "/astrologer/earnings/summary",
          "/notifications",
        ];
        const results = await Promise.allSettled(
          paths.map((path) =>
            professionalRequest(path, { signal: abort.signal }),
          ),
        );
        if (
          abort.signal.aborted ||
          version !== generation.current ||
          professionalOwner().snapshot !== owner.snapshot
        )
          return;
        for (const result of results)
          if (
            result.status === "rejected" &&
            result.reason instanceof ProfessionalAccessError
          )
            throw result.reason;
        const value = (i: number) =>
          results[i].status === "fulfilled"
            ? record((results[i] as PromiseFulfilledResult<Row>).value).data
            : null;
        const data = {
          dashboard,
          requests:
            value(0) === null ? null : ownedRequests(value(0), session.id),
          history:
            value(1) === null ? null : ownedRequests(value(1), session.id),
          profile: value(2) === null ? null : record(value(2)),
          availability: value(3) === null ? null : record(value(3)),
          earnings: value(4) === null ? null : record(value(4)),
          notifications: value(5) === null ? null : record(value(5)),
        };
        snapshotRef.current = data;
        setSnapshot(data);
        setUncertain(false);
        setRevision((n) => n + 1);
        if (results.some((r) => r.status === "rejected"))
          setError(
            "Some professional records are unavailable. Use Verify & reload.",
          );
      } catch (e) {
        if (!abort.signal.aborted && version === generation.current) {
          setSnapshot(null);
          snapshotRef.current = null;
          if (e instanceof ProfessionalAccessError && e.status === 403)
            router.replace("/astrologer/pending");
          setError(
            e instanceof ProfessionalAccessError
              ? e.message
              : "Your professional dashboard could not be verified. Check your connection and reload.",
          );
        }
      } finally {
        if (version === generation.current) {
          reading.current = false;
          setLoading(false);
        }
      }
    },
    [router],
  );
  const poll = useCallback(async () => {
    if (
      reading.current ||
      lock.current ||
      !snapshotRef.current ||
      document.visibilityState !== "visible"
    )
      return;
    reading.current = true;
    const version = generation.current;
    try {
      const result = await professionalRequest(
        "/consultations/astrologer/current",
        { signal: controller.current?.signal },
      );
      if (version !== generation.current) return;
      const requests = ownedRequests(
        result.data,
        String(snapshotRef.current?.dashboard.userId),
      );
      setSnapshot((current) => (current ? { ...current, requests } : null));
      setQueueError("");
    } catch (e) {
      if (version === generation.current) {
        setSnapshot((current) =>
          current ? { ...current, requests: null } : null,
        );
        setQueueError(
          "Incoming requests could not be verified. Reload before taking action.",
        );
        if (e instanceof ProfessionalAccessError) {
          snapshotRef.current = null;
          setSnapshot(null);
        }
      }
    } finally {
      if (version === generation.current) reading.current = false;
    }
  }, []);
  const stop = useCallback(() => {
    active.current = false;
    generation.current++;
    reading.current = false;
    controller.current?.abort();
  }, []);
  useEffect(() => {
    active.current = true;
    void load();
    const changed = () => {
      editing.current = false;
      lock.current = false;
      setBusy(false);
      setUncertain(false);
      setMessage("");
      void load(true);
    };
    const focus = () => {
      void load();
    };
    window.addEventListener("asp-auth-changed", changed);
    window.addEventListener("storage", changed);
    window.addEventListener("focus", focus);
    const timer = window.setInterval(() => void poll(), 15000);
    return () => {
      stop();
      window.clearInterval(timer);
      window.removeEventListener("asp-auth-changed", changed);
      window.removeEventListener("storage", changed);
      window.removeEventListener("focus", focus);
    };
  }, [load, poll, stop]);
  async function mutate(
    path: string,
    body?: object,
    kind?: "profile" | "availability",
  ) {
    if (lock.current || uncertain || !snapshotRef.current)
      throw Error("Reload professional records before another change.");
    lock.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    const version = generation.current;
    try {
      const result = await professionalRequest(path, {
        method: "PATCH",
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (!active.current || version !== generation.current) return;
      if (
        path === "/astrologer/status" &&
        typeof record(result.data).isOnline !== "boolean"
      )
        throw Error("Status response was not confirmed.");
      if (path.endsWith("/accept")) {
        const call = record(record(result.data).call);
        if (
          call.id !== decodeURIComponent(path.split("/")[2]) ||
          call.astrologerId !== snapshotRef.current.dashboard.userId
        )
          throw Error("Consultation ownership could not be verified.");
        const destination = consultationDestination(call);
        if (!destination)
          throw Error("This consultation mode is not supported here.");
        router.push(destination);
      } else {
        if (kind) await professionalRequest("/astrologer/" + kind);
        if (version !== generation.current) return;
        setMessage("Change confirmed by the backend.");
        editing.current = false;
        lock.current = false;
        setBusy(false);
        await load(true);
      }
    } catch (e) {
      if (active.current && version === generation.current) {
        setUncertain(true);
        setError(
          e instanceof ProfessionalAccessError
            ? e.message
            : "Change not confirmed. Reload server records before another attempt.",
        );
      }
      throw Error(
        "Change not confirmed. Reload server records before another attempt.",
      );
    } finally {
      if (version === generation.current) {
        lock.current = false;
        setBusy(false);
      }
    }
  }
  const actions: ProfessionalActions = {
    refresh: () => {
      if (uncertain) editing.current = false;
      if (editing.current) {
        setError(
          "Save your edits before reloading, or leave and reopen this page to discard them.",
        );
        return;
      }
      void load();
    },
    status: () => {
      void mutate("/astrologer/status", {
        isOnline: snapshotRef.current?.dashboard.isOnline !== true,
      }).catch(() => {});
    },
    accept: (call) => {
      void mutate(
        "/consultations/" + encodeURIComponent(String(call.id)) + "/accept",
      ).catch(() => {});
    },
    reject: (call) => {
      void mutate(
        "/consultations/" + encodeURIComponent(String(call.id)) + "/reject",
      ).catch(() => {});
    },
    dirty: (value) => {
      editing.current = value;
    },
    save: (kind, body) => mutate("/astrologer/" + kind, body, kind),
  };
  return (
    <AstrologerDashboardView
      key={revision}
      snapshot={snapshot}
      loading={loading}
      busy={busy}
      uncertain={uncertain}
      error={error}
      message={message}
      queueError={queueError}
      actions={actions}
    />
  );
}
