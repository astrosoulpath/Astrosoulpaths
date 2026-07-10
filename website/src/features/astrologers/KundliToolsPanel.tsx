"use client";

export function KundliToolsPanel() {
  return (
    <section className="mt-10 rounded-2xl bg-white p-8 shadow">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[#0B1026]">
            Kundli & Reports
          </h2>

          <p className="mt-2 text-gray-500">
            Generate Kundli, manage reports and access saved birth charts.
          </p>
        </div>

        <button className="rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-white">
          Generate Kundli
        </button>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4">

        <div className="rounded-xl border p-5">
          <h3 className="font-semibold">Today's Reports</h3>
          <p className="mt-4 text-4xl font-bold">0</p>
        </div>

        <div className="rounded-xl border p-5">
          <h3 className="font-semibold">Saved Kundlis</h3>
          <p className="mt-4 text-4xl font-bold">0</p>
        </div>

        <div className="rounded-xl border p-5">
          <h3 className="font-semibold">Pending Requests</h3>
          <p className="mt-4 text-4xl font-bold">0</p>
        </div>

        <div className="rounded-xl border p-5">
          <h3 className="font-semibold">Downloads</h3>
          <p className="mt-4 text-4xl font-bold">0</p>
        </div>

      </div>

      <div className="mt-8 rounded-xl border p-6">

        <h3 className="text-xl font-semibold">
          Recent Kundli Requests
        </h3>

        <div className="mt-6 text-gray-500">
          No Kundli requests available.
        </div>

      </div>
    </section>
  );
}