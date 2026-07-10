"use client";

import { useEffect, useMemo, useState } from "react";

import { AstrologerCard } from "./AstrologerCard";
import {
  getPublicAstrologers,
  PublicAstrologer,
} from "@/services/astrologerService";

export function AstrologersGrid() {
  const [astrologers, setAstrologers] = useState<
    PublicAstrologer[]
  >([]);

  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [expertise, setExpertise] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadAstrologers() {
    try {
      setLoading(true);
      setError("");

      const response = await getPublicAstrologers({
        search,
        language,
        expertise,
        online: onlineOnly ? true : undefined,
      });

      setAstrologers(response.data);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Failed to load astrologers.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAstrologers();
  }, []);

  const availableLanguages = useMemo(() => {
    return Array.from(
      new Set(
        astrologers.flatMap(
          (astrologer) => astrologer.languages ?? [],
        ),
      ),
    ).sort();
  }, [astrologers]);

  const availableExpertise = useMemo(() => {
    return Array.from(
      new Set(
        astrologers.flatMap(
          (astrologer) => astrologer.expertise ?? [],
        ),
      ),
    ).sort();
  }, [astrologers]);

  function handleSearchSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    void loadAstrologers();
  }

  function handleReset() {
    setSearch("");
    setLanguage("");
    setExpertise("");
    setOnlineOnly(false);

    setTimeout(() => {
      void getPublicAstrologers()
        .then((response) => {
          setAstrologers(response.data);
          setError("");
        })
        .catch((err: unknown) => {
          setError(
            err instanceof Error
              ? err.message
              : "Failed to load astrologers.",
          );
        });
    }, 0);
  }

  return (
    <section>
      <form
        onSubmit={handleSearchSubmit}
        className="mb-8 rounded-2xl bg-white p-6 shadow"
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search astrologers"
            className="rounded-xl border p-4"
          />

          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value)
            }
            className="rounded-xl border p-4"
          >
            <option value="">All languages</option>

            {availableLanguages.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={expertise}
            onChange={(event) =>
              setExpertise(event.target.value)
            }
            className="rounded-xl border p-4"
          >
            <option value="">All expertise</option>

            {availableExpertise.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <label className="flex items-center gap-3 rounded-xl border p-4">
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(event) =>
                setOnlineOnly(event.target.checked)
              }
            />

            <span>Online astrologers only</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] disabled:opacity-50"
          >
            {loading ? "Searching..." : "Apply Filters"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="rounded-xl border px-6 py-3 font-semibold disabled:opacity-50"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={() => void loadAstrologers()}
            disabled={loading}
            className="rounded-xl border px-6 py-3 font-semibold disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </form>

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-4 text-red-700">
          <p className="font-semibold">
            Unable to load astrologers
          </p>

          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl bg-white p-8 text-center shadow">
          Loading astrologers...
        </div>
      )}

      {!loading && !error && astrologers.length === 0 && (
        <div className="rounded-2xl border border-dashed bg-white p-10 text-center shadow-sm">
          <h3 className="text-xl font-bold text-[#0B1026]">
            No approved astrologers available
          </h3>

          <p className="mt-2 text-gray-600">
            Approved and verified astrologers will appear here.
          </p>
        </div>
      )}

      {!loading && astrologers.length > 0 && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {astrologers.map((astrologer) => (
            <AstrologerCard
              key={astrologer.id}
              name="Astrologer"
              specialty={
                astrologer.expertise.length
                  ? astrologer.expertise.join(", ")
                  : "Vedic Astrology"
              }
              experience={`${astrologer.experience} Years`}
              languages={
                astrologer.languages.length
                  ? astrologer.languages.join(", ")
                  : "Not specified"
              }
              price={`₹${astrologer.pricePerMin}/min`}
              rating={astrologer.rating}
            />
          ))}
        </div>
      )}
    </section>
  );
}