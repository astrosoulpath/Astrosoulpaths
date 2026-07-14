import Image from "next/image";
import Link from "next/link";

type AstrologerCardProps = {
  id: string;
  name: string;
  specialty: string;
  experience: string;
  languages: string;
  price: string;
  rating: number;
  isOnline: boolean;
  avatarUrl?: string | null;
  isVerified?: boolean;
};

export function AstrologerCard({
  id,
  name,
  specialty,
  experience,
  languages,
  price,
  rating,
  isOnline,
  avatarUrl,
  isVerified = true,
}: AstrologerCardProps) {
  const safeId = id.trim();

  const safeName =
    name.trim() ||
    "Astro Soul Path Astrologer";

  const safeSpecialty =
    specialty.trim() ||
    "Vedic Astrology";

  const safeExperience =
    experience.trim() ||
    "Experience not specified";

  const safeLanguages =
    languages.trim() ||
    "Languages not specified";

  const safePrice =
    price.trim() ||
    "Price not available";

  const safeRating =
    Number.isFinite(rating)
      ? Math.max(0, Math.min(5, rating))
      : 0;

  const profileHref = safeId
    ? `/astrologers/${encodeURIComponent(
        safeId,
      )}`
    : "/astrologers";

  const chatHref = safeId
    ? `/astrologers/${encodeURIComponent(
        safeId,
      )}?consultation=chat`
    : "/astrologers";

  const formattedRating =
    safeRating > 0
      ? safeRating.toFixed(1)
      : "New";

  const avatarInitial =
    safeName.charAt(0).toUpperCase();

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-lg transition duration-300 hover:-translate-y-1 hover:border-[#D4AF37]/40 hover:shadow-2xl">
      <div className="h-2 bg-gradient-to-r from-[#0B1026] via-[#D4AF37] to-[#0B1026]" />

      <div className="flex h-full flex-col p-6">
        <div className="flex items-start gap-4">
          <div className="relative shrink-0">
            <Link
              href={profileHref}
              aria-label={`View ${safeName} profile`}
              className="block rounded-full focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/25"
            >
              {avatarUrl ? (
                <Image
                  src={avatarUrl}
                  alt={`${safeName} profile`}
                  width={80}
                  height={80}
                  className="h-20 w-20 rounded-full object-cover ring-4 ring-[#FAF7F0]"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#D4AF37]/20 text-2xl font-bold text-[#0B1026] ring-4 ring-[#FAF7F0]">
                  {avatarInitial}
                </div>
              )}
            </Link>

            <span
              className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white ${
                isOnline
                  ? "bg-green-500"
                  : "bg-gray-400"
              }`}
              aria-label={
                isOnline
                  ? "Online"
                  : "Offline"
              }
            />
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start gap-2">
              <Link
                href={profileHref}
                className="min-w-0 focus:outline-none"
              >
                <h3 className="line-clamp-2 text-xl font-bold text-[#0B1026] transition group-hover:text-[#B18D19]">
                  {safeName}
                </h3>
              </Link>

              {isVerified && (
                <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-1 text-[11px] font-bold text-blue-700">
                  ✓ Verified
                </span>
              )}
            </div>

            <p className="mt-1 line-clamp-2 text-sm leading-5 text-gray-600">
              {safeSpecialty}
            </p>

            <div className="mt-3 flex items-center gap-2">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  isOnline
                    ? "animate-pulse bg-green-500"
                    : "bg-gray-400"
                }`}
                aria-hidden="true"
              />

              <span
                className={`text-xs font-semibold ${
                  isOnline
                    ? "text-green-700"
                    : "text-gray-500"
                }`}
              >
                {isOnline
                  ? "Available Now"
                  : "Currently Offline"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 grid flex-1 gap-3 text-sm">
          <div className="flex items-center justify-between gap-4 rounded-xl bg-[#FAF7F0] px-4 py-3">
            <div className="flex items-center gap-2 text-gray-600">
              <span aria-hidden="true">
                ⭐
              </span>

              <span>Rating</span>
            </div>

            <span className="font-bold text-[#0B1026]">
              {formattedRating ===
              "New"
                ? "New astrologer"
                : `${formattedRating} / 5`}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-[#FAF7F0] px-4 py-3">
            <div className="flex items-center gap-2 text-gray-600">
              <span aria-hidden="true">
                🕒
              </span>

              <span>Experience</span>
            </div>

            <span className="text-right font-semibold text-[#0B1026]">
              {safeExperience}
            </span>
          </div>

          <div className="flex items-start justify-between gap-4 rounded-xl bg-[#FAF7F0] px-4 py-3">
            <div className="flex shrink-0 items-center gap-2 text-gray-600">
              <span aria-hidden="true">
                🌐
              </span>

              <span>Languages</span>
            </div>

            <span className="line-clamp-2 text-right font-semibold text-[#0B1026]">
              {safeLanguages}
            </span>
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl bg-[#0B1026] px-4 py-3 text-white">
            <div className="flex items-center gap-2 text-white/70">
              <span aria-hidden="true">
                ₹
              </span>

              <span>Consultation</span>
            </div>

            <span className="font-bold text-[#D4AF37]">
              {safePrice.replace(
                /^₹/,
                "₹",
              )}
            </span>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Link
            href={profileHref}
            className="inline-flex w-full items-center justify-center rounded-xl border border-[#D4AF37] px-4 py-3 text-center font-semibold text-[#0B1026] transition hover:bg-[#D4AF37]/10 focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/20"
          >
            View Profile
          </Link>

          {isOnline && safeId ? (
            <Link
              href={chatHref}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#D4AF37] px-4 py-3 text-center font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/20"
            >
              Chat Now
            </Link>
          ) : (
            <button
              type="button"
              disabled
              className="w-full cursor-not-allowed rounded-xl bg-gray-200 px-4 py-3 font-semibold text-gray-500"
            >
              Offline
            </button>
          )}
        </div>
      </div>
    </article>
  );
}