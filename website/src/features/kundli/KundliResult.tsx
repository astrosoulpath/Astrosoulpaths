import type {
  KundliChartData,
  KundliGeneratedData,
} from "@/services/kundliService";

type KundliResultProps = {
  result: KundliGeneratedData;
};

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function ChartCard({
  title,
  chart,
}: {
  title: string;
  chart?: KundliChartData;
}) {
  if (!chart) {
    return (
      <div className="rounded-2xl border bg-[#FAF7F0] p-6">
        <h3 className="text-xl font-bold text-[#0B1026]">
          {title}
        </h3>

        <p className="mt-3 text-sm leading-6 text-gray-600">
          This chart is not available in the current backend
          response. It will appear when the astrology API returns
          chart data.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border bg-[#FAF7F0] p-6">
      <h3 className="text-xl font-bold text-[#0B1026]">
        {title}
      </h3>

      {chart.imageUrl ? (
        <img
          src={chart.imageUrl}
          alt={title}
          className="mt-5 w-full rounded-xl bg-white object-contain"
        />
      ) : chart.svg ? (
        <div
          className="mt-5 overflow-hidden rounded-xl bg-white p-4"
          dangerouslySetInnerHTML={{ __html: chart.svg }}
        />
      ) : chart.houses?.length ? (
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          {chart.houses.map((house) => (
            <div
              key={house.house}
              className="rounded-xl bg-white p-4"
            >
              <p className="font-bold text-[#0B1026]">
                House {house.house}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Sign: {house.sign || "—"}
              </p>

              <p className="mt-1 text-sm text-gray-600">
                Planets:{" "}
                {house.planets?.length
                  ? house.planets.join(", ")
                  : "None"}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-gray-600">
          Chart details are currently unavailable.
        </p>
      )}
    </div>
  );
}

export function KundliResult({
  result,
}: KundliResultProps) {
  const summaryItems = [
    ["Ascendant", result.ascendant],
    ["Moon Sign", result.moonSign],
    ["Sun Sign", result.sunSign],
    ["Nakshatra", result.nakshatra],
  ].filter((item) => Boolean(item[1]));

  function handlePrint() {
    window.print();
  }

  return (
    <section className="mt-8 rounded-3xl bg-white p-6 shadow-lg sm:p-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="font-semibold text-[#D4AF37]">
            Kundli Generated
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#0B1026]">
            {result.name
              ? `${result.name}'s Vedic Kundli`
              : "Your Vedic Kundli"}
          </h2>

          <p className="mt-2 text-gray-600">
            Generated on {formatDate(result.createdAt)}
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          {result.pdfUrl ? (
            <a
              href={result.pdfUrl}
              target="_blank"
              rel="noreferrer"
              className="rounded-xl bg-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026]"
            >
              Download PDF
            </a>
          ) : (
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl border border-[#D4AF37] px-5 py-3 font-semibold text-[#0B1026]"
            >
              Print / Save PDF
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-2xl bg-[#FAF7F0] p-5">
          <p className="text-sm text-gray-500">
            Date of Birth
          </p>
          <p className="mt-1 font-bold text-[#0B1026]">
            {result.dob}
          </p>
        </div>

        <div className="rounded-2xl bg-[#FAF7F0] p-5">
          <p className="text-sm text-gray-500">
            Time of Birth
          </p>
          <p className="mt-1 font-bold text-[#0B1026]">
            {result.tob}
          </p>
        </div>

        <div className="rounded-2xl bg-[#FAF7F0] p-5">
          <p className="text-sm text-gray-500">
            Birth Place
          </p>
          <p className="mt-1 font-bold text-[#0B1026]">
            {result.birthPlace || "Not provided"}
          </p>
        </div>

        <div className="rounded-2xl bg-[#FAF7F0] p-5">
          <p className="text-sm text-gray-500">
            Coordinates
          </p>
          <p className="mt-1 font-bold text-[#0B1026]">
            {result.lat}, {result.lon}
          </p>
        </div>
      </div>

      {summaryItems.length > 0 && (
        <div className="mt-8">
          <h3 className="text-2xl font-bold text-[#0B1026]">
            Vedic Summary
          </h3>

          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {summaryItems.map(([label, value]) => (
              <div
                key={label}
                className="rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5"
              >
                <p className="text-sm text-gray-600">
                  {label}
                </p>

                <p className="mt-1 text-lg font-bold text-[#0B1026]">
                  {value}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <ChartCard
          title="Birth Chart (D1)"
          chart={result.charts?.d1}
        />

        <ChartCard
          title="Navamsa Chart (D9)"
          chart={result.charts?.d9}
        />
      </div>

      <div className="mt-8 rounded-2xl border p-6">
        <h3 className="text-2xl font-bold text-[#0B1026]">
          Planetary Positions
        </h3>

        {result.planets?.length ? (
          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[700px] text-left">
              <thead>
                <tr className="border-b text-sm text-gray-500">
                  <th className="px-3 py-3">Planet</th>
                  <th className="px-3 py-3">Sign</th>
                  <th className="px-3 py-3">House</th>
                  <th className="px-3 py-3">Degree</th>
                  <th className="px-3 py-3">Nakshatra</th>
                  <th className="px-3 py-3">Motion</th>
                </tr>
              </thead>

              <tbody>
                {result.planets.map((planet) => (
                  <tr
                    key={`${planet.name}-${planet.house ?? ""}`}
                    className="border-b last:border-0"
                  >
                    <td className="px-3 py-4 font-semibold">
                      {planet.name}
                    </td>
                    <td className="px-3 py-4">
                      {planet.sign || "—"}
                    </td>
                    <td className="px-3 py-4">
                      {planet.house ?? "—"}
                    </td>
                    <td className="px-3 py-4">
                      {typeof planet.degree === "number"
                        ? planet.degree.toFixed(2)
                        : "—"}
                    </td>
                    <td className="px-3 py-4">
                      {planet.nakshatra || "—"}
                    </td>
                    <td className="px-3 py-4">
                      {planet.retrograde
                        ? "Retrograde"
                        : "Direct"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="mt-4 text-gray-600">
            Planetary data is not available in the current API
            response.
          </p>
        )}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border p-6">
          <h3 className="text-2xl font-bold text-[#0B1026]">
            Dasha Analysis
          </h3>

          {result.dashas?.length ? (
            <div className="mt-5 space-y-4">
              {result.dashas.map((period, index) => (
                <div
                  key={`${period.planet}-${index}`}
                  className="rounded-xl bg-[#FAF7F0] p-4"
                >
                  <p className="font-bold text-[#0B1026]">
                    {period.planet}
                  </p>

                  <p className="mt-1 text-sm text-gray-600">
                    {period.startDate || "—"} to{" "}
                    {period.endDate || "—"}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-gray-600">
              Dasha details are not available in the current API
              response.
            </p>
          )}
        </div>

        <div className="rounded-2xl border p-6">
          <h3 className="text-2xl font-bold text-[#0B1026]">
            Dosha Analysis
          </h3>

          {result.doshas?.length ? (
            <div className="mt-5 space-y-4">
              {result.doshas.map((dosha) => (
                <div
                  key={dosha.name}
                  className="rounded-xl bg-[#FAF7F0] p-4"
                >
                  <div className="flex items-center justify-between gap-4">
                    <p className="font-bold text-[#0B1026]">
                      {dosha.name}
                    </p>

                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        dosha.present
                          ? "bg-red-100 text-red-700"
                          : "bg-green-100 text-green-700"
                      }`}
                    >
                      {dosha.present
                        ? "Present"
                        : "Not Present"}
                    </span>
                  </div>

                  {dosha.description && (
                    <p className="mt-3 text-sm leading-6 text-gray-600">
                      {dosha.description}
                    </p>
                  )}

                  {dosha.remedies?.length ? (
                    <ul className="mt-3 list-disc space-y-1 pl-5 text-sm text-gray-600">
                      {dosha.remedies.map((remedy) => (
                        <li key={remedy}>{remedy}</li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-gray-600">
              Dosha details are not available in the current API
              response.
            </p>
          )}
        </div>
      </div>

      <div className="mt-8 rounded-xl bg-[#FAF7F0] p-4 text-xs text-gray-500">
        Kundli ID: {result.id}
      </div>
    </section>
  );
}