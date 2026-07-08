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
    <div className="flex gap-2">
      <button onClick={onApprove} className="rounded-lg bg-green-600 px-3 py-2 text-sm text-white">
        Approve
      </button>
      <button onClick={onReject} className="rounded-lg bg-red-600 px-3 py-2 text-sm text-white">
        Reject
      </button>
      <button onClick={onSuspend} className="rounded-lg bg-gray-700 px-3 py-2 text-sm text-white">
        Suspend
      </button>
    </div>
  );
}