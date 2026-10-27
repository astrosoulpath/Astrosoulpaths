type ActionButtonsProps = {
  onApprove: () => void;
  onReject: () => void;
  onSuspend: () => void;
};

export function ActionButtons({
  onApprove,
  onReject,
  onSuspend,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onApprove}
        className="rounded-lg border border-emerald-400/30 bg-emerald-400/10 px-3 py-2 text-xs font-semibold text-emerald-700 transition duration-200 hover:border-emerald-400/60 hover:bg-emerald-400/20 hover:text-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400/30"
      >
        Approve
      </button>

      <button
        type="button"
        onClick={onReject}
        className="rounded-lg border border-rose-400/30 bg-rose-400/10 px-3 py-2 text-xs font-semibold text-red-700 transition duration-200 hover:border-rose-400/60 hover:bg-rose-400/20 hover:text-red-700 focus:outline-none focus:ring-2 focus:ring-rose-400/30"
      >
        Reject
      </button>

      <button
        type="button"
        onClick={onSuspend}
        className="rounded-lg border border-slate-500/50 bg-[#10233D] px-3 py-2 text-xs font-semibold text-white transition duration-200 hover:border-amber-400/40 hover:bg-amber-400/10 hover:text-white focus:outline-none focus:ring-2 focus:ring-amber-400/20"
      >
        Suspend
      </button>
    </div>
  );
}
