type KundliResultProps = {
  result: {
    id: string;
    name?: string | null;
    dob: string;
    tob: string;
    lat: number;
    lon: number;
    timezone: number;
    lang: string;
    hash: string;
    createdAt: string;
  };
};

export function KundliResult({ result }: KundliResultProps) {
  return (
    <div className="mt-8 rounded-2xl border p-6">
      <h2 className="text-2xl font-bold text-[#0B1026]">
        Kundli Generated Successfully
      </h2>

      <div className="mt-5 grid gap-4 md:grid-cols-2">
        <p><b>Name:</b> {result.name || "-"}</p>
        <p><b>Date of Birth:</b> {result.dob}</p>
        <p><b>Time of Birth:</b> {result.tob}</p>
        <p><b>Latitude:</b> {result.lat}</p>
        <p><b>Longitude:</b> {result.lon}</p>
        <p><b>Timezone:</b> {result.timezone}</p>
        <p className="md:col-span-2"><b>Kundli ID:</b> {result.id}</p>
      </div>

      <div className="mt-8 grid gap-5 md:grid-cols-2">
        <div className="rounded-xl border bg-[#FAF7F0] p-5">
          <h3 className="font-bold">Birth Chart (D1)</h3>
          <p className="mt-3 text-sm text-gray-600">
            Chart calculation will appear here after Vedic astrology engine integration.
          </p>
        </div>

        <div className="rounded-xl border bg-[#FAF7F0] p-5">
          <h3 className="font-bold">Navamsa Chart (D9)</h3>
          <p className="mt-3 text-sm text-gray-600">
            D9 divisional chart will appear here in Phase 1 Kundli report.
          </p>
        </div>

        <div className="rounded-xl border bg-[#FAF7F0] p-5">
          <h3 className="font-bold">Planetary Positions</h3>
          <p className="mt-3 text-sm text-gray-600">
            Planetary positions, moon sign and ascendant will display here.
          </p>
        </div>

        <div className="rounded-xl border bg-[#FAF7F0] p-5">
          <h3 className="font-bold">Dasha Analysis</h3>
          <p className="mt-3 text-sm text-gray-600">
            Vimshottari Dasha and major periods will display here.
          </p>
        </div>

        <div className="rounded-xl border bg-[#FAF7F0] p-5">
          <h3 className="font-bold">Dosha Analysis</h3>
          <p className="mt-3 text-sm text-gray-600">
            Manglik, Kaal Sarp and other dosha checks will appear here.
          </p>
        </div>

        <div className="rounded-xl border bg-[#FAF7F0] p-5">
          <h3 className="font-bold">PDF Report</h3>
          <button className="mt-4 rounded-xl bg-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026]">
            Download PDF Report
          </button>
        </div>
      </div>
    </div>
  );
}