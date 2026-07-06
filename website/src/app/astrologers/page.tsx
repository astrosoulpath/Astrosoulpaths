import { SearchBar } from "@/features/astrologers/SearchBar";
import { FilterSidebar } from "@/features/astrologers/FilterSidebar";
import { SortDropdown } from "@/features/astrologers/SortDropdown";
import { AstrologersGrid } from "@/features/astrologers/AstrologersGrid";
import { Pagination } from "@/features/astrologers/Pagination";

export default function AstrologersPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-7xl px-6">
        {/* Heading */}
        <p className="font-semibold text-[#D4AF37]">
          Astrologers
        </p>

        <h1 className="mt-3 text-5xl font-bold text-[#0B1026]">
          Talk to Verified Astrologers
        </h1>

        <p className="mt-4 max-w-2xl text-gray-600">
          Browse astrologers by expertise, language, experience,
          rating and availability.
        </p>

        {/* Search */}
        <div className="mt-10">
          <SearchBar />
        </div>

        {/* Sort */}
        <div className="mt-8 flex items-center justify-between">
          <h2 className="text-2xl font-bold text-[#0B1026]">
            Available Astrologers
          </h2>

          <SortDropdown />
        </div>

        {/* Filters + Grid */}
        <div className="mt-10 grid gap-8 lg:grid-cols-[280px_1fr]">
          <FilterSidebar />

          <div>
            <AstrologersGrid />

            <Pagination />
          </div>
        </div>
      </div>
    </main>
  );
}