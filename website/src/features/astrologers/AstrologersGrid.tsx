import { AstrologerCard } from "./AstrologerCard";

const astrologers = [
  {
    name: "Acharya Raj",
    specialty: "Vedic Astrology",
    experience: "12 Years",
    languages: "Hindi, English",
    price: "₹25/min",
    rating: 4.9,
  },
  {
    name: "Astro Meera",
    specialty: "Tarot & Numerology",
    experience: "9 Years",
    languages: "Hindi",
    price: "₹20/min",
    rating: 4.8,
  },
  {
    name: "Pandit Aman",
    specialty: "Kundli Expert",
    experience: "15 Years",
    languages: "Hindi, Gujarati",
    price: "₹30/min",
    rating: 4.9,
  },
];

export function AstrologersGrid() {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {astrologers.map((astro) => (
        <AstrologerCard key={astro.name} {...astro} />
      ))}
    </div>
  );
}