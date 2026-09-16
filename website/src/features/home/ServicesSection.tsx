import Link from "next/link";
import {
  ArrowRight,
  Headphones,
  MessageCircleMore,
  MoonStar,
  ScrollText,
  Sparkles,
  Stars,
} from "lucide-react";

type ServiceStatus = "available" | "coming-soon";

type ServiceItem = {
  title: string;
  description: string;
  icon: typeof MessageCircleMore;
  href?: string;
  status: ServiceStatus;
  badge?: string;
};

const services: ServiceItem[] = [
  {
    title: "Chat Consultation",
    description:
      "Connect privately with verified astrologers through secure one-to-one chat consultations.",
    icon: MessageCircleMore,
    href: "/astrologers",
    status: "available",
    badge: "Popular",
  },
  {
    title: "Audio Call",
    description:
      "Speak directly with verified astrologers for detailed and personalized Vedic guidance.",
    icon: Headphones,
    href: "/astrologers",
    status: "available",
    badge: "Live",
  },
  {
    title: "Free Kundli",
    description:
      "Generate your Vedic birth chart using your exact date, time and place of birth.",
    icon: ScrollText,
    href: "/kundli",
    status: "available",
    badge: "Free",
  },
  {
    title: "Daily Horoscope",
    description:
      "Receive personalized daily guidance and planetary insights based on your birth details.",
    icon: MoonStar,
    href: "/horoscope",
    status: "available",
  },
  {
    title: "Astrology Remedies",
    description:
      "Explore practical Vedic remedies for relationships, career, health and financial challenges.",
    icon: Sparkles,
    status: "coming-soon",
  },
  {
    title: "Numerology",
    description:
      "Understand your personality, strengths and life path through the power of numbers.",
    icon: Stars,
    status: "coming-soon",
  },
];

export function ServicesSection() {
  return (
    <section className="relative overflow-hidden bg-[#FBF8F1] py-24 sm:py-28">
      <div
        aria-hidden="true"
        className="absolute -left-48 top-12 h-[30rem] w-[30rem] rounded-full bg-[#D4AF37]/8 blur-[110px]"
      />

      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <span className="inline-flex rounded-full border border-[#D4AF37]/25 bg-[#D4AF37]/8 px-4 py-2 text-xs font-black uppercase tracking-[0.2em] text-[#A47B12]">
              Our Services
            </span>

            <h2 className="mt-5 text-3xl font-black leading-[1.08] tracking-[-0.045em] text-[#08142E] sm:text-4xl lg:text-5xl">
              Astrology guidance for every important stage of life.
            </h2>

            <p className="mt-5 max-w-2xl text-base font-medium leading-8 text-[#667085]">
              Explore live consultations, professional Kundli tools and
              personalized astrology experiences through one trusted platform.
            </p>
          </div>

          <Link
            href="/astrologers"
            className="group inline-flex w-fit items-center gap-2 rounded-2xl border border-[#CCD2DD] bg-white px-6 py-3.5 text-sm font-black text-[#0B1739] shadow-sm transition hover:-translate-y-0.5 hover:border-[#D4AF37] hover:shadow-lg"
          >
            Browse Astrologers
            <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
          </Link>
        </div>

        <div className="mt-14 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {services.map((service) => {
            const Icon = service.icon;
            const isAvailable =
              service.status === "available" && Boolean(service.href);

            const card = (
              <>
                <div className="flex items-start justify-between gap-4">
                  <div
                    className={`flex h-14 w-14 items-center justify-center rounded-2xl border transition duration-300 ${
                      isAvailable
                        ? "border-[#E9DDBB] bg-gradient-to-br from-[#FFF9E8] to-[#F5ECCF] text-[#A57A0E] group-hover:scale-105"
                        : "border-gray-200 bg-gray-50 text-gray-400"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>

                  <div className="flex gap-2">
                    {service.badge && (
                      <span className="rounded-full bg-[#0B1739] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-white">
                        {service.badge}
                      </span>
                    )}

                    {service.status === "coming-soon" && (
                      <span className="rounded-full bg-gray-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-gray-500">
                        Coming Soon
                      </span>
                    )}
                  </div>
                </div>

                <h3 className="mt-7 text-xl font-black tracking-[-0.025em] text-[#0B1739] sm:text-2xl">
                  {service.title}
                </h3>

                <p className="mt-3 flex-1 text-sm font-medium leading-7 text-[#6B7280] sm:text-[15px]">
                  {service.description}
                </p>

                <div className="mt-6 flex items-center justify-between border-t border-[#EEE9DF] pt-5">
                  <span
                    className={`text-sm font-black ${
                      isAvailable ? "text-[#9D7610]" : "text-gray-400"
                    }`}
                  >
                    {isAvailable ? "Explore Service" : "Available Soon"}
                  </span>

                  {isAvailable && (
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#F7F2E5] text-[#0B1739] transition group-hover:bg-[#0B1739] group-hover:text-white">
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  )}
                </div>
              </>
            );

            return isAvailable ? (
              <Link
                key={service.title}
                href={service.href!}
                className="group flex min-h-[300px] flex-col rounded-[1.65rem] border border-[#E8E1D3] bg-white p-7 shadow-[0_10px_35px_rgba(12,25,52,.055)] transition duration-300 hover:-translate-y-1.5 hover:border-[#D4AF37]/55 hover:shadow-[0_24px_60px_rgba(12,25,52,.11)]"
              >
                {card}
              </Link>
            ) : (
              <article
                key={service.title}
                className="flex min-h-[300px] flex-col rounded-[1.65rem] border border-[#ECE8E0] bg-white/75 p-7 shadow-sm"
              >
                {card}
              </article>
            );
          })}
        </div>

        <div className="relative mt-12 overflow-hidden rounded-[2rem] bg-gradient-to-r from-[#071329] via-[#0D1B3A] to-[#172750] p-7 text-white shadow-[0_25px_65px_rgba(7,19,41,.18)] sm:p-9 lg:flex lg:items-center lg:justify-between lg:gap-10">
          <div className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-[#D4AF37]/15 blur-3xl" />

          <div className="relative">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-[#E1C14B]">
              Need Personal Guidance?
            </p>

            <h3 className="mt-3 max-w-3xl text-2xl font-black tracking-[-0.03em] sm:text-3xl">
              Connect with a verified astrologer for personalized answers.
            </h3>

            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/65 sm:text-base">
              Choose an available astrologer and start securely through chat or
              audio consultation.
            </p>
          </div>

          <Link
            href="/astrologers"
            className="relative mt-7 inline-flex w-full shrink-0 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D7B23C] to-[#C99A1E] px-7 py-4 text-sm font-black text-[#071329] shadow-lg transition hover:-translate-y-0.5 sm:w-auto lg:mt-0"
          >
            Start Consultation
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
