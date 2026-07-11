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
}: AstrologerCardProps) {
  const safeId = id.trim();
  const safeName = name.trim() || "Astro Soul Path Astrologer";
  const safeSpecialty = specialty.trim() || "Vedic Astrology";
  const safeExperience = experience.trim() || "Experience not specified";
  const safeLanguages = languages.trim() || "Languages not specified";
  const safePrice = price.trim() || "Price not available";

  const profileHref = safeId
    ? `/astrologers/${encodeURIComponent(safeId)}`
    : "/astrologers";

  const chatHref = safeId
    ? `/astrologers/${encodeURIComponent(safeId)}?consultation=chat`
    : "/astrologers";

  const formattedRating =
    Number.isFinite(rating) && rating > 0
      ? rating.toFixed(1)
      : "New";

  return (
    <article className="flex h-full flex-col rounded-3xl bg-white p-6 shadow-lg transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-start gap-4">
        <div className="relative shrink-0">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={safeName}
              width={72}
              height={72}
              className="h-[72px] w-[72px] rounded-full object-cover"
            />
          ) : (
            <div className="flex h-[72px] w-[72px] items-center justify-center rounded-full bg-[#D4AF37]/20 text-2xl font-bold text-[#0B1026]">
              {safeName.charAt(0).toUpperCase()}
            </div>
          )}

          <span
            className={`absolute bottom-1 right-1 h-4 w-4 rounded-full border-2 border-white ${
              isOnline ? "bg-green-500" : "bg-gray-400"
            }`}
            aria-label={isOnline ? "Online" : "Offline"}
          />
        </div>

        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-xl font-bold text-[#0B1026]">
            {safeName}
          </h3>

          <p className="mt-1 line-clamp-2 text-sm text-gray-600">
            {safeSpecialty}
          </p>

          <div className="mt-2 flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isOnline ? "bg-green-500" : "bg-gray-400"
              }`}
            />

            <span
              className={`text-xs font-semibold ${
                isOnline ? "text-green-700" : "text-gray-500"
              }`}
            >
              {isOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      <div className="mt-6 flex-1 space-y-3 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <span aria-hidden="true">⭐</span>

          <span>
            {formattedRating === "New"
              ? "New astrologer"
              : `${formattedRating} / 5`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span aria-hidden="true">🕒</span>
          <span>{safeExperience}</span>
        </div>

        <div className="flex items-start gap-2">
          <span aria-hidden="true">🌐</span>
          <span className="line-clamp-2">{safeLanguages}</span>
        </div>

        <div className="flex items-center gap-2 font-semibold text-[#D4AF37]">
          <span aria-hidden="true">₹</span>
          <span>{safePrice.replace(/^₹/, "")}</span>
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <Link
          href={profileHref}
          className="w-full rounded-xl border border-[#D4AF37] py-3 text-center font-semibold text-[#0B1026] transition hover:bg-[#D4AF37]/10 focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
        >
          View Profile
        </Link>

        {isOnline && safeId ? (
          <Link
            href={chatHref}
            className="w-full rounded-xl bg-[#D4AF37] py-3 text-center font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] focus:outline-none focus:ring-2 focus:ring-[#D4AF37]"
          >
            Chat Now
          </Link>
        ) : (
          <button
            type="button"
            disabled
            className="w-full cursor-not-allowed rounded-xl bg-gray-200 py-3 font-semibold text-gray-500"
          >
            Currently Offline
          </button>
        )}
      </div>
    </article>
  );
}