import Link from "next/link";

type ServiceItem = {
  title: string;
  description: string;
  icon: string;
  href?: string;
  status?: "available" | "coming-soon";
};

const services: ServiceItem[] = [
  {
    title: "Chat Consultation",
    description:
      "Connect with verified astrologers through secure one-to-one chat.",
    icon: "💬",
    href: "/astrologers",
    status: "available",
  },
  {
    title: "Audio Call",
    description:
      "Talk directly with verified astrologers for personal Vedic guidance.",
    icon: "📞",
    href: "/astrologers",
    status: "available",
  },
  {
    title: "Free Kundli",
    description:
      "Generate your Vedic Kundli using date, time and place of birth.",
    icon: "🔮",
    href: "/kundli",
    status: "available",
  },
  {
    title: "Daily Horoscope",
    description:
      "Receive personalized daily Vedic guidance based on your birth details.",
    icon: "🌙",
    href: "/horoscope",
    status: "available",
  },
  {
    title: "Remedies",
    description:
      "Get practical remedies for relationships, career, health and finance.",
    icon: "🪔",
    status: "coming-soon",
  },
  {
    title: "Numerology",
    description:
      "Understand your numbers, personality and life path through numerology.",
    icon: "🔢",
    status: "coming-soon",
  },
];

export function ServicesSection() {
  return (
    <section className="bg-[#FAF7F0] py-20">
      <div className="mx-auto max-w-7xl px-6">
        <p className="font-semibold text-[#D4AF37]">
          Our Services
        </p>

        <h2 className="mt-3 max-w-2xl text-4xl font-bold leading-tight text-[#0B1026]">
          Everything you need for spiritual and Vedic guidance
        </h2>

        <p className="mt-4 max-w-3xl leading-7 text-gray-600">
          Explore consultations, Kundli generation and personalized
          astrology services designed to help you make confident
          decisions.
        </p>

        <div className="mt-12 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {services.map((service) => {
            const isAvailable =
              service.status === "available" && service.href;

            const cardContent = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div
                    className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#D4AF37]/15 text-3xl"
                    aria-hidden="true"
                  >
                    {service.icon}
                  </div>

                  {service.status === "coming-soon" && (
                    <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                      Coming Soon
                    </span>
                  )}
                </div>

                <h3 className="mt-6 text-xl font-bold text-[#0B1026]">
                  {service.title}
                </h3>

                <p className="mt-4 flex-1 leading-7 text-gray-600">
                  {service.description}
                </p>

                <div className="mt-6">
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-[#D4AF37]">
                      Explore Service
                      <span aria-hidden="true">→</span>
                    </span>
                  ) : (
                    <span className="font-semibold text-gray-400">
                      Available in an upcoming phase
                    </span>
                  )}
                </div>
              </>
            );

            if (isAvailable) {
              return (
                <Link
                  key={service.title}
                  href={service.href!}
                  className="flex min-h-[300px] flex-col rounded-3xl bg-white p-8 shadow-lg transition duration-300 hover:-translate-y-2 hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-[#D4AF37] focus:ring-offset-2"
                >
                  {cardContent}
                </Link>
              );
            }

            return (
              <article
                key={service.title}
                className="flex min-h-[300px] flex-col rounded-3xl bg-white p-8 shadow-lg"
              >
                {cardContent}
              </article>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <Link
            href="/astrologers"
            className="inline-flex rounded-xl bg-[#0B1026] px-8 py-4 font-semibold text-white transition hover:bg-[#171D3D] focus:outline-none focus:ring-2 focus:ring-[#0B1026] focus:ring-offset-2"
          >
            Browse Verified Astrologers
          </Link>
        </div>
      </div>
    </section>
  );
}