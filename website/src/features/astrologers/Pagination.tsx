export function Pagination() {
  return (
    <div className="mt-10 flex items-center justify-center gap-3">
      <button className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold">
        Previous
      </button>

      <button className="rounded-xl bg-[#D4AF37] px-4 py-2 text-sm font-semibold text-[#0B1026]">
        1
      </button>

      <button className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold">
        2
      </button>

      <button className="rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold">
        Next
      </button>
    </div>
  );
}