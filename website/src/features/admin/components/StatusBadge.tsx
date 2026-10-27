type StatusBadgeProps = {
  status: "REVIEW_REQUIRED" | "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    REVIEW_REQUIRED: "border-slate-200 bg-slate-50 text-slate-700",
    PENDING: "border-amber-200 bg-amber-50 text-amber-800",
    APPROVED: "border-emerald-200 bg-emerald-50 text-emerald-800",
    REJECTED: "border-rose-200 bg-rose-50 text-rose-800",
    SUSPENDED: "border-slate-200 bg-slate-100 text-slate-700",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[13px] font-semibold uppercase tracking-[0.08em] ${styles[status]}`}
    >
      <span
        aria-hidden="true"
        className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"
      />

      {status === "REVIEW_REQUIRED" ? "Review required" : status}
    </span>
  );
}
