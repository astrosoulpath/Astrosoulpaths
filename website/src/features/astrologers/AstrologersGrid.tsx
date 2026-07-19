"use client";

import {
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import { AstrologerCard } from "./AstrologerCard";
import {
  getPublicAstrologers,
  PublicAstrologer,
} from "@/services/astrologerService";

type SortOption =
  | "recommended"
  | "rating-high"
  | "experience-high"
  | "price-low"
  | "price-high";

type AstrologerFilters = {
  search: string;
  language: string;
  expertise: string;
  onlineOnly: boolean;
};

const ITEMS_PER_PAGE = 6;

const DEFAULT_FILTERS: AstrologerFilters = {
  search: "",
  language: "",
  expertise: "",
  onlineOnly: false,
};

export function AstrologersGrid() {
  const [astrologers, setAstrologers] = useState<
    PublicAstrologer[]
  >([]);

  const [search, setSearch] = useState("");
  const [language, setLanguage] = useState("");
  const [expertise, setExpertise] = useState("");
  const [onlineOnly, setOnlineOnly] = useState(false);

  const [sortBy, setSortBy] =
    useState<SortOption>("recommended");

  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadAstrologers = useCallback(
    async (filters: AstrologerFilters) => {
      try {
        setLoading(true);
        setError("");

        const response = await getPublicAstrologers({
          search: filters.search,
          language: filters.language,
          expertise: filters.expertise,
          online: filters.onlineOnly ? true : undefined,
        });

        setAstrologers(response.data);
        setCurrentPage(1);
      } catch (err: unknown) {
        setAstrologers([]);

        setError(
          err instanceof Error
            ? err.message
            : "Failed to load astrologers.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadAstrologers(DEFAULT_FILTERS);
  }, [loadAstrologers]);

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

  const sortedAstrologers = useMemo(() => {
    const result = [...astrologers];

    switch (sortBy) {
      case "rating-high":
        return result.sort(
          (a, b) => b.rating - a.rating,
        );

      case "experience-high":
        return result.sort(
          (a, b) => b.experience - a.experience,
        );

      case "price-low":
        return result.sort(
          (a, b) => a.pricePerMin - b.pricePerMin,
        );

      case "price-high":
        return result.sort(
          (a, b) => b.pricePerMin - a.pricePerMin,
        );

      default:
        return result.sort((a, b) => {
          if (a.isOnline !== b.isOnline) {
            return (
              Number(b.isOnline) - Number(a.isOnline)
            );
          }

          return b.rating - a.rating;
        });
    }
  }, [astrologers, sortBy]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      sortedAstrologers.length / ITEMS_PER_PAGE,
    ),
  );

  const paginatedAstrologers = useMemo(() => {
    const startIndex =
      (currentPage - 1) * ITEMS_PER_PAGE;

    return sortedAstrologers.slice(
      startIndex,
      startIndex + ITEMS_PER_PAGE,
    );
  }, [sortedAstrologers, currentPage]);

  function getCurrentFilters(): AstrologerFilters {
    return {
      search,
      language,
      expertise,
      onlineOnly,
    };
  }

  function handleSearchSubmit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    void loadAstrologers(getCurrentFilters());
  }

  function handleReset() {
    setSearch("");
    setLanguage("");
    setExpertise("");
    setOnlineOnly(false);
    setSortBy("recommended");
    setCurrentPage(1);

    void loadAstrologers(DEFAULT_FILTERS);
  }

  function handleRefresh() {
    void loadAstrologers(getCurrentFilters());
  }

  function handlePageChange(page: number) {
    setCurrentPage(page);

    window.scrollTo({
      top: 250,
      behavior: "smooth",
    });
  }

  return (
    <section>
      <form
        onSubmit={handleSearchSubmit}
        className="mb-8 rounded-2xl bg-white p-6 shadow"
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <input
            type="search"
            value={search}
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Search astrologers"
            className="rounded-xl border border-gray-300 p-4 outline-none transition focus:border-[#D4AF37]"
          />

          <select
            value={language}
            onChange={(event) =>
              setLanguage(event.target.value)
            }
            className="rounded-xl border border-gray-300 p-4 outline-none transition focus:border-[#D4AF37]"
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
            className="rounded-xl border border-gray-300 p-4 outline-none transition focus:border-[#D4AF37]"
          >
            <option value="">All expertise</option>

            {availableExpertise.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(event) => {
              setSortBy(
                event.target.value as SortOption,
              );
              setCurrentPage(1);
            }}
            className="rounded-xl border border-gray-300 p-4 outline-none transition focus:border-[#D4AF37]"
          >
            <option value="recommended">
              Recommended
            </option>

            <option value="rating-high">
              Highest Rating
            </option>

            <option value="experience-high">
              Most Experienced
            </option>

            <option value="price-low">
              Price: Low to High
            </option>

            <option value="price-high">
              Price: High to Low
            </option>
          </select>

          <label className="flex items-center gap-3 rounded-xl border border-gray-300 p-4">
            <input
              type="checkbox"
              checked={onlineOnly}
              onChange={(event) =>
                setOnlineOnly(event.target.checked)
              }
              className="h-4 w-4 accent-[#D4AF37]"
            />

            <span>Online astrologers only</span>
          </label>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "Searching..."
              : "Apply Filters"}
          </button>

          <button
            type="button"
            onClick={handleReset}
            disabled={loading}
            className="rounded-xl border border-[#0B1026] px-6 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Reset
          </button>

          <button
            type="button"
            onClick={handleRefresh}
            disabled={loading}
            className="rounded-xl border border-[#0B1026] px-6 py-3 font-semibold disabled:cursor-not-allowed disabled:opacity-50"
          >
            Refresh
          </button>
        </div>
      </form>

      {!loading &&
        !error &&
        astrologers.length > 0 && (
          <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">
              Showing {paginatedAstrologers.length} of{" "}
              {sortedAstrologers.length} astrologers
            </p>

            <p className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </p>
          </div>
        )}

      {error && (
        <div className="mb-6 rounded-xl bg-red-50 p-5 text-red-700">
          <p className="font-semibold">
            Unable to load astrologers
          </p>

          <p className="mt-1 text-sm">{error}</p>
        </div>
      )}

      {loading && (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map(
            (_, index) => (
              <div
                key={index}
                className="animate-pulse rounded-3xl bg-white p-6 shadow-lg"
              >
                <div className="flex items-center gap-4">
                  <div className="h-16 w-16 rounded-full bg-gray-200" />

                  <div className="flex-1">
                    <div className="h-5 w-3/4 rounded bg-gray-200" />
                    <div className="mt-3 h-4 w-1/2 rounded bg-gray-200" />
                    <div className="mt-3 h-3 w-1/3 rounded bg-gray-200" />
                  </div>
                </div>

                <div className="mt-6 space-y-3">
                  <div className="h-4 rounded bg-gray-200" />
                  <div className="h-4 rounded bg-gray-200" />
                  <div className="h-4 rounded bg-gray-200" />
                </div>

                <div className="mt-6 h-12 rounded-xl bg-gray-200" />
                <div className="mt-3 h-12 rounded-xl bg-gray-200" />
              </div>
            ),
          )}
        </div>
      )}

      {!loading &&
        !error &&
        astrologers.length === 0 && (
          <div className="rounded-2xl border border-dashed bg-white p-10 text-center shadow-sm">
            <h3 className="text-xl font-bold text-[#0B1026]">
              No approved astrologers found
            </h3>

            <p className="mt-2 text-gray-600">
              Try changing your search or filters.
            </p>

            <button
              type="button"
              onClick={handleReset}
              className="mt-5 rounded-xl bg-[#D4AF37] px-6 py-3 font-semibold text-[#0B1026]"
            >
              Clear Filters
            </button>
          </div>
        )}

      {!loading &&
        !error &&
        paginatedAstrologers.length > 0 && (
          <>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {paginatedAstrologers.map(
                (astrologer) => (
                  <AstrologerCard
                    key={astrologer.id}
                    id={astrologer.id}
                    name={
                      astrologer.name?.trim() ||
                      "Astro Soul Path Astrologer"
                    }
                    avatarUrl={astrologer.avatarUrl}
                    isOnline={astrologer.isOnline}
                    specialty={
                      astrologer.expertise.length
                        ? astrologer.expertise.join(
                            ", ",
                          )
                        : "Vedic Astrology"
                    }
                    experience={`${astrologer.experience} Years`}
                    languages={
                      astrologer.languages.length
                        ? astrologer.languages.join(
                            ", ",
                          )
                        : "Not specified"
                    }
                    price={`₹${astrologer.pricePerMin}/min`}
                    rating={astrologer.rating}
                  />
                ),
              )}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() =>
                    handlePageChange(
                      currentPage - 1,
                    )
                  }
                  className="rounded-lg border px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Previous
                </button>

                {Array.from(
                  { length: totalPages },
                  (_, index) => index + 1,
                ).map((page) => (
                  <button
                    key={page}
                    type="button"
                    onClick={() =>
                      handlePageChange(page)
                    }
                    className={`h-10 w-10 rounded-lg font-semibold ${
                      currentPage === page
                        ? "bg-[#D4AF37] text-[#0B1026]"
                        : "border bg-white text-[#0B1026]"
                    }`}
                  >
                    {page}
                  </button>
                ))}

                <button
                  type="button"
                  disabled={
                    currentPage === totalPages
                  }
                  onClick={() =>
                    handlePageChange(
                      currentPage + 1,
                    )
                  }
                  className="rounded-lg border px-4 py-2 font-semibold disabled:cursor-not-allowed disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
    </section>
  );
}