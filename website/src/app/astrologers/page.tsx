import { AstrologersGrid } from "@/features/astrologers/AstrologersGrid";

export default function AstrologersPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="font-semibold text-[#D4AF37]">
          Astrologers
        </p>

        <h1 className="mt-3 text-4xl font-bold text-[#0B1026] sm:text-5xl">
          Talk to Verified Astrologers
        </h1>

        <p className="mt-4 max-w-2xl text-gray-600">
          Browse approved astrologers by expertise, language,
          experience, rating, consultation fee and availability.
        </p>

        <div className="mt-10">
          <AstrologersGrid />
        </div>
      </div>
    </main>
  );
}