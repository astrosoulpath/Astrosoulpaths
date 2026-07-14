"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getAvailability,
  type AvailabilityResponse,
} from "@/services/availabilityService";

type AvailabilityCardProps = {
  astrologerId: string;
  totalConsultations?: number;
};

type AvailabilityData =
  AvailabilityResponse["data"];

function formatLastUpdated(
  value: string,
): string {
  const date = new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "";
  }

  return date.toLocaleString(
    "en-IN",
    {
      dateStyle: "medium",
      timeStyle: "short",
    },
  );
}

export function AvailabilityCard({
  astrologerId,
  totalConsultations = 0,
}: AvailabilityCardProps) {
  const [
    availability,
    setAvailability,
  ] =
    useState<AvailabilityData | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] = useState("");

  const loadAvailability =
    useCallback(async () => {
      const normalizedAstrologerId =
        astrologerId.trim();

      if (!normalizedAstrologerId) {
        setAvailability(null);
        setError(
          "Astrologer ID is missing.",
        );
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const response =
          await getAvailability(
            normalizedAstrologerId,
          );

        setAvailability(
          response.data,
        );
      } catch (err: unknown) {
        setAvailability(null);

        setError(
          err instanceof Error
            ? err.message
            : "Unable to load availability.",
        );
      } finally {
        setLoading(false);
      }
    }, [astrologerId]);

  useEffect(() => {
    void loadAvailability();
  }, [loadAvailability]);

  const todayTiming =
    useMemo(() => {
      if (
        !availability
          ?.todaySchedule
      ) {
        return "Schedule not available";
      }

      return `${availability.todaySchedule.start} - ${availability.todaySchedule.end}`;
    }, [availability]);

  const availableDays =
    useMemo(() => {
      return (
        availability
          ?.weeklyAvailability
          ?.filter(
            (item) =>
              item.available,
          )
          .map(
            (item) =>
              item.day,
          ) ?? []
      );
    }, [availability]);

  if (loading) {
    return (
      <section className="rounded-3xl bg-white p-8 shadow-xl">
        <div
          className="animate-pulse"
          aria-busy="true"
          aria-label="Loading astrologer availability"
        >
          <div className="flex items-center justify-between border-b border-gray-100 pb-5">
            <div>
              <div className="h-4 w-28 rounded bg-gray-200" />

              <div className="mt-3 h-9 w-48 rounded bg-gray-200" />
            </div>

            <div className="h-9 w-24 rounded-full bg-gray-200" />
          </div>

          <div className="mt-8 space-y-5">
            {[1, 2, 3, 4].map(
              (item) => (
                <div
                  key={item}
                  className="h-24 rounded-2xl bg-gray-100"
                />
              ),
            )}
          </div>
        </div>
      </section>
    );
  }

  if (
    error ||
    !availability
  ) {
    return (
      <section className="rounded-3xl bg-white p-8 shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 pb-5">
          <div>
            <p className="font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Consultation
            </p>

            <h2 className="mt-2 text-3xl font-bold text-[#0B1026]">
              Availability
            </h2>
          </div>

          <span className="rounded-full bg-gray-200 px-4 py-2 text-sm font-bold text-gray-600">
            ⚪ Unavailable
          </span>
        </div>

        <div
          role="alert"
          className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-6"
        >
          <h3 className="font-bold text-amber-800">
            Availability information is not available
          </h3>

          <p className="mt-2 leading-6 text-amber-700">
            {error ||
              "The astrologer availability could not be loaded."}
          </p>

          <button
            type="button"
            onClick={() =>
              void loadAvailability()
            }
            className="mt-5 rounded-xl border border-amber-300 px-5 py-2.5 font-semibold text-amber-800 transition hover:bg-amber-100"
          >
            Try Again
          </button>
        </div>
      </section>
    );
  }

  const isOnline =
    availability.isOnline;

  return (
    <section className="rounded-3xl bg-white p-8 shadow-xl">
      <div className="flex flex-col gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
            Consultation
          </p>

          <h2 className="mt-2 text-3xl font-bold text-[#0B1026]">
            Availability
          </h2>
        </div>

        <span
          className={`w-fit rounded-full px-4 py-2 text-sm font-bold ${
            isOnline
              ? "bg-green-100 text-green-700"
              : "bg-gray-200 text-gray-600"
          }`}
        >
          {isOnline
            ? "🟢 Online"
            : "⚪ Offline"}
        </span>
      </div>

      <div className="mt-8 space-y-5">
        <div className="flex items-center justify-between gap-5 rounded-2xl bg-[#FAF7F0] p-5">
          <div>
            <p className="text-sm text-gray-500">
              Current Status
            </p>

            <p className="mt-1 font-bold text-[#0B1026]">
              {
                availability.availabilityText
              }
            </p>
          </div>

          <div
            className="text-3xl"
            aria-hidden="true"
          >
            {isOnline
              ? "🟢"
              : "⚪"}
          </div>
        </div>

        <div className="flex items-center justify-between gap-5 rounded-2xl bg-[#FAF7F0] p-5">
          <div>
            <p className="text-sm text-gray-500">
              Response Time
            </p>

            <p className="mt-1 font-bold text-[#0B1026]">
              {availability.responseTime ??
                "Response time not available"}
            </p>
          </div>

          <span
            className="text-2xl"
            aria-hidden="true"
          >
            ⚡
          </span>
        </div>

        <div className="flex items-center justify-between gap-5 rounded-2xl bg-[#FAF7F0] p-5">
          <div>
            <p className="text-sm text-gray-500">
              Today&apos;s Schedule
            </p>

            <p className="mt-1 font-bold text-[#0B1026]">
              {todayTiming}
            </p>

            <p className="mt-1 text-xs text-gray-500">
              {
                availability
                  .todaySchedule
                  .timezone
              }
            </p>
          </div>

          <span
            className="text-2xl"
            aria-hidden="true"
          >
            🕒
          </span>
        </div>

        <div className="rounded-2xl bg-[#FAF7F0] p-5">
          <p className="text-sm text-gray-500">
            Available Days
          </p>

          {availableDays.length >
          0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {availableDays.map(
                (day) => (
                  <span
                    key={day}
                    className="rounded-full bg-white px-3 py-1.5 text-sm font-semibold text-[#0B1026]"
                  >
                    {day}
                  </span>
                ),
              )}
            </div>
          ) : (
            <p className="mt-2 font-semibold text-gray-600">
              Weekly schedule not available
            </p>
          )}
        </div>

        <div className="flex items-center justify-between gap-5 rounded-2xl bg-[#0B1026] p-5 text-white">
          <div>
            <p className="text-sm text-white/70">
              Total Consultations
            </p>

            <p className="mt-1 text-2xl font-bold text-[#D4AF37]">
              {Math.max(
                0,
                totalConsultations,
              ).toLocaleString(
                "en-IN",
              )}
            </p>
          </div>

          <span
            className="text-3xl"
            aria-hidden="true"
          >
            💬
          </span>
        </div>
      </div>

      <div className="mt-8 rounded-2xl border border-[#D4AF37]/30 bg-[#D4AF37]/10 p-5">
        <h3 className="font-semibold text-[#0B1026]">
          Consultation Information
        </h3>

        <ul className="mt-4 space-y-2 text-sm leading-6 text-gray-700">
          <li>
            ✓ Live online status updates
          </li>

          <li>
            ✓ Wallet balance checked before consultation
          </li>

          <li>
            ✓ Secure chat and audio consultation
          </li>

          <li>
            ✓ Consultation charged according to the selected duration
          </li>
        </ul>

        {availability.lastUpdated && (
          <p className="mt-4 text-xs text-gray-500">
            Last updated:{" "}
            {formatLastUpdated(
              availability.lastUpdated,
            )}
          </p>
        )}
      </div>
    </section>
  );
}