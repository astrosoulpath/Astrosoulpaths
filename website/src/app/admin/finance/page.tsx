"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { adminFetch } from "@/features/admin/auth/admin-session";

type Row = {
  currency: string;
  status?: string;
  _sum: Record<string, string | number | null>;
  _count?: { id: number };
};
type Overview = {
  runtime?:{configuredPaymentMode:string;recordMode:string};
  totalScope?:string;walletBasis?:string;
  walletDiagnostics?:Array<{currency:string;walletCount:number;bucketDivergenceCount:number;bucketDifference:string;reservationAnomalyCount:number}>;
  collectionsByMode?:Array<{providerMode:string;currency:string;status:string;type:string;count:number;amount:string}>;
  wallets: Row[];
  earnings: Row[];
  payouts: Row[];
  collections: Row[];
  settlement: { status: string; reason: string };
  warning: string;
  audit: {
    status: string;
    rows: Array<{
      id: string;
      previousPercent: string | number;
      newPercent: string | number;
      effectiveAt: string;
    }>;
  };
};

export default function FinancePage() {
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    void adminFetch("/admin/finance/overview")
      .then(async (response) => {
        if (!response.ok) throw new Error("Unable to load financial records.");
        const result = await response.json();
        if (!result.success || !result.data)
          throw new Error("Financial records unavailable.");
        if (active) setData(result.data);
      })
      .catch(() => {
        if (active)
          setError(
            "Financial records unavailable. Please retry or sign in again.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  const groups: Array<[string, Row[], Array<[string, string]>]> = data
    ? [
        [
          "Customer wallet balances",
          data.wallets,
          [
            ["balance", "Recorded total balance"],
            ["lockedBalance", "Reserved within total"],
            ["paidBalance", "Recorded paid bucket"],
            ["freeBalance", "Recorded promotional bucket"],
          ],
        ],
        [
          "Recorded consultation earnings",
          data.earnings,
          [
            ["grossAmount", "Gross service charges"],
            ["platformFee", "Recorded platform commission"],
            ["netAmount", "Astrologer share"],
          ],
        ],
        ["Withdrawal requests", data.payouts, [["amount", "Requested amount"]]],
      ]
    : [];
  return (
    <main className="asp-admin-page px-4 py-8 sm:px-6">
      <div className="asp-admin-shell space-y-6">
        <Link href="/admin">Back to Dashboard</Link>
        <h1 className="text-3xl font-bold">Financial Overview</h1>
        <Link href="/admin/platform-settings">Global commission settings</Link>
        <p>New paid human consultations use a locked 70% astrologer / 30% platform allocation. Existing consultation snapshots and historical earnings retain their recorded policy. Global settings do not override the new consultation policy.</p>
        {error ? (
          <p role="alert">{error}</p>
        ) : !data ? (
          <p role="status">Loading financial records…</p>
        ) : (
          <>
            <p role="status" className="rounded-lg border border-amber-300 bg-amber-50 p-3 font-semibold">
              {data.runtime?.configuredPaymentMode==="TEST"?"TEST MODE credentials configured":data.runtime?.configuredPaymentMode==="LIVE"?"LIVE credentials configured":"Payment credential mode unverified"}.
              Recorded history is classified independently; unknown historical records are not assumed TEST.
            </p>
            <p>Global recorded totals across all pages. Payment-list cards cover only their loaded page and selected filters.</p>
            <p>{data.warning}</p>
            <p>
              Company bank settlement: <strong>{data.settlement.status}</strong>
              . {data.settlement.reason}
            </p>
            <section className="rounded-xl border bg-white p-4" aria-label="Collections by mode">
              <h2 className="text-xl font-semibold">Collections separated by record mode and currency</h2>
              {(data.collectionsByMode??[]).map(row=><p key={`${row.providerMode}:${row.currency}:${row.status}:${row.type}`}>
                {row.providerMode} · {row.currency} · {row.type} · {row.status} · {row.count} orders · {formatMoney(row.amount,row.currency)}
              </p>)}
            </section>
            <details className="rounded-xl border bg-white p-4"><summary>Accounting definitions and diagnostics</summary>
              <p>{data.walletBasis}</p>
              {(data.walletDiagnostics??[]).map(row=><p key={row.currency}>{row.currency}: {row.walletCount} wallets; {row.bucketDivergenceCount} bucket divergences; net bucket difference {formatMoney(row.bucketDifference,row.currency)}; {row.reservationAnomalyCount} reservation anomalies. No balance correction has been applied.</p>)}
            </details>
            <section aria-label="Commission audit">
              <h2 className="text-xl font-semibold">
                Commission change audit — {data.audit.status}
              </h2>
              {data.audit.rows.map((row) => (
                <p key={row.id}>
                  {row.effectiveAt}: {String(row.previousPercent)}% →{" "}
                  {String(row.newPercent)}% platform share
                </p>
              ))}
              {data.audit.status === "RECORDED" && !data.audit.rows.length && (
                <p>No recorded commission changes.</p>
              )}
            </section>
            <p>
              Withdrawal approval, refund adjustments and commission audit
              records require their separate approved workflows. This page does
              not infer them from payout or payment status.
            </p>
            {groups.map(([title, rows, columns]) => (
              <section
                key={title}
                className="rounded-xl border bg-white p-4 text-slate-900"
              >
                <h2 className="mb-3 text-xl font-semibold">{title}</h2>
                {!rows.length ? (
                  <p>No recorded entries.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                      <thead>
                        <tr>
                          <th className="p-2">Currency</th>
                          <th className="p-2">Status</th>
                          {columns.map(([key, label]) => (
                            <th className="p-2" key={key}>
                              {label}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((row) => (
                          <tr
                            key={`${row.currency}:${row.status ?? "balance"}`}
                          >
                            <td className="p-2">{row.currency}</td>
                            <td className="p-2">{row.status ?? "Balance"}</td>
                            {columns.map(([key]) => (
                              <td className="p-2" key={key}>
                                {row._sum[key] === null ||
                                row._sum[key] === undefined
                                  ? "Unavailable"
                                  : formatMoney(row._sum[key]!,row.currency)}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}

function formatMoney(value:string|number,currency:string) {
  const amount=Number(value);
  if(!Number.isFinite(amount)||!/^[A-Z]{3}$/.test(currency))return "Unavailable";
  try{return new Intl.NumberFormat("en-IN",{style:"currency",currency}).format(amount);}catch{return `${currency} ${amount.toFixed(2)}`;}
}
