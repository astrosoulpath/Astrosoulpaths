type AstrologerCardProps = {
  name: string;
  specialty: string;
  experience: string;
  languages: string;
  price: string;
  rating: number;
};

export function AstrologerCard({
  name,
  specialty,
  experience,
  languages,
  price,
  rating,
}: AstrologerCardProps) {
  return (
    <div className="rounded-3xl bg-white p-6 shadow-lg transition hover:-translate-y-1">
      <div className="flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[#D4AF37]/20 text-2xl font-bold text-[#0B1026]">
          {name.charAt(0)}
        </div>

        <div>
          <h3 className="text-xl font-bold text-[#0B1026]">{name}</h3>

          <p className="text-gray-600">{specialty}</p>
        </div>
      </div>

      <div className="mt-6 space-y-2 text-sm text-gray-600">
        <p>⭐ {rating}</p>
        <p>🕒 {experience}</p>
        <p>🌐 {languages}</p>
        <p className="font-semibold text-[#D4AF37]">{price}</p>
      </div>

      <button className="mt-6 w-full rounded-xl bg-[#D4AF37] py-3 font-semibold">
        Chat Now
      </button>
    </div>
  );
}