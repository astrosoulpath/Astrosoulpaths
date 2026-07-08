type StatusBadgeProps = {
  status: "PENDING" | "APPROVED" | "REJECTED" | "SUSPENDED";
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const styles = {
    PENDING: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    SUSPENDED: "bg-gray-200 text-gray-800",
  };

  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${styles[status]}`}>
      {status}
    </span>
  );
}