export function AvailabilityCard() {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-[#0B1026]">
        Availability
      </h2>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between">
          <span>Status</span>
          <span className="rounded-full bg-green-100 px-3 py-1 text-sm font-semibold text-green-700">
            Online
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span>Response Time</span>
          <strong>Under 2 mins</strong>
        </div>

        <div className="flex items-center justify-between">
          <span>Today</span>
          <strong>10:00 AM - 8:00 PM</strong>
        </div>
      </div>
    </div>
  );
}