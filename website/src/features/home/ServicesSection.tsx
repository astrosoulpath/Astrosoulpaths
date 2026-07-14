import Link from "next/link";

type ServiceStatus =
  | "available"
  | "coming-soon";

type ServiceItem = {
  title: string;
  description: string;
  icon: string;
  href?: string;
  status: ServiceStatus;
  badge?: string;
};

const services: ServiceItem[] = [
  {
    title: "Chat Consultation",
    description:
      "Connect privately with verified astrologers through secure one-to-one chat consultations.",
    icon: "💬",
    href: "/astrologers",
    status: "available",
    badge: "Popular",
  },
  {
    title: "Audio Call",
    description:
      "Speak directly with verified astrologers for detailed and personalized Vedic guidance.",
    icon: "📞",
    href: "/astrologers",
    status: "available",
    badge: "Live",
  },
  {
    title: "Free Kundli",
    description:
      "Generate your Vedic birth chart using your exact date, time and place of birth.",
    icon: "🔮",
    href: "/kundli",
    status: "available",
    badge: "Free",
  },
  {
    title: "Daily Horoscope",
    description:
      "Receive personalized daily guidance and planetary insights based on your birth details.",
    icon: "🌙",
    href: "/horoscope",
    status: "available",
  },
  {
    title: "Astrology Remedies",
    description:
      "Explore practical Vedic remedies for relationships, career, health and financial challenges.",
    icon: "🪔",
    status: "coming-soon",
  },
  {
    title: "Numerology",
    description:
      "Understand your personality, strengths and life path through the power of numbers.",
    icon: "🔢",
    status: "coming-soon",
  },
];

export function ServicesSection() {
  return (
    <section className="bg-[#FAF7F0] py-16 sm:py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <p className="font-semibold uppercase tracking-[0.18em] text-[#D4AF37]">
              Our Services
            </p>

            <h2 className="mt-4 text-3xl font-bold leading-tight text-[#0B1026] sm:text-4xl lg:text-5xl">
              Complete astrology guidance in one trusted platform
            </h2>

            <p className="mt-5 max-w-2xl text-base leading-7 text-gray-600 sm:text-lg">
              Explore live consultations, Kundli generation and
              personalized astrology services designed to help you
              make clearer and more confident decisions.
            </p>
          </div>

          <Link
            href="/astrologers"
            className="inline-flex w-fit items-center justify-center rounded-xl border border-[#0B1026] px-6 py-3 font-semibold text-[#0B1026] transition hover:bg-[#0B1026] hover:text-white focus:outline-none focus:ring-4 focus:ring-[#0B1026]/15"
          >
            Browse Astrologers
          </Link>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const isAvailable =
              service.status === "available" &&
              Boolean(service.href);

            const cardContent = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl text-3xl transition ${
                      isAvailable
                        ? "bg-[#D4AF37]/15 group-hover:bg-[#D4AF37]"
                        : "bg-gray-100"
                    }`}
                    aria-hidden="true"
                  >
                    {service.icon}
                  </div>

                  <div className="flex flex-wrap justify-end gap-2">
                    {service.badge && (
                      <span className="rounded-full bg-[#0B1026] px-3 py-1 text-xs font-bold text-white">
                        {service.badge}
                      </span>
                    )}

                    {service.status ===
                      "coming-soon" && (
                      <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-semibold text-gray-500">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="mt-6 text-2xl font-bold text-[#0B1026]">
                  {service.title}
                </h3>

                <p className="mt-4 flex-1 leading-7 text-gray-600">
                  {service.description}
                </p>

                <div className="mt-7 border-t border-gray-100 pt-5">
                  {isAvailable ? (
                    <span className="inline-flex items-center gap-2 font-semibold text-[#B18D19]">
                      Explore Service
                      <span
                        aria-hidden="true"
                        className="transition group-hover:translate-x-1"
                      >
                        →
                      </span>
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
                  className="group flex min-h-[320px] flex-col rounded-3xl border border-gray-100 bg-white p-7 shadow-lg transition duration-300 hover:-translate-y-2 hover:border-[#D4AF37]/40 hover:shadow-2xl focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/20 sm:p-8"
                >
                  {cardContent}
                </Link>
              );
            }

            return (
              <article
                key={service.title}
                className="flex min-h-[320px] flex-col rounded-3xl border border-gray-100 bg-white p-7 shadow-lg opacity-90 sm:p-8"
              >
                {cardContent}
              </article>
            );
          })}
        </div>

        <div className="mt-12 rounded-3xl bg-[#0B1026] p-6 text-white shadow-xl sm:p-8 lg:flex lg:items-center lg:justify-between lg:gap-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-[#D4AF37]">
              Need Personal Guidance?
            </p>

            <h3 className="mt-3 text-2xl font-bold sm:text-3xl">
              Connect with an astrologer and get answers for your
              current situation.
            </h3>

            <p className="mt-3 max-w-3xl leading-7 text-white/70">
              Select an online astrologer, choose your consultation
              duration and start securely through chat or audio call.
            </p>
          </div>

          <Link
            href="/astrologers"
            className="mt-6 inline-flex w-full shrink-0 items-center justify-center rounded-xl bg-[#D4AF37] px-7 py-4 font-semibold text-[#0B1026] transition hover:bg-[#C9A52F] focus:outline-none focus:ring-4 focus:ring-[#D4AF37]/30 sm:w-auto lg:mt-0"
          >
            Start Consultation
          </Link>
        </div>
      </div>
    </section>
  );
}