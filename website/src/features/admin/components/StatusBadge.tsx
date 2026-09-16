type StatusBadgeProps = {
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    PENDING: "border-amber-400/30 bg-amber-400/10 text-amber-300",
    APPROVED: "border-emerald-400/30 bg-emerald-400/10 text-emerald-300",
    REJECTED: "border-rose-400/30 bg-rose-400/10 text-rose-300",
    SUSPENDED: "border-slate-500/50 bg-slate-700/40 text-slate-300",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-black uppercase tracking-[0.08em] ${styles[status]}`}
    >
      <span
        aria-hidden="true"
        className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current"
      />

      {status}
    </span>
  );
}
