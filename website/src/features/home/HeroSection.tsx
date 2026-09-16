import Link from "next/link";
import {
  ArrowRight,
  Check,
  Headphones,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
} from "lucide-react";

const heroHighlights = [
  "Verified astrologers",
  "Secure chat & audio calls",
  "Personalized Kundli insights",
];

const trustCards = [
  {
    icon: Headphones,
    title: "24/7",
    description: "Consultation access",
  },
  {
    icon: ShieldCheck,
    title: "Secure",
    description: "Private & protected",
  },
  {
    icon: Sparkles,
    title: "Personal",
    description: "Birth-chart guidance",
  },
];

export function HeroSection() {
  return (
    <section
      className="relative isolate overflow-hidden bg-[#FBF8F1]"
      aria-labelledby="hero-heading"
    >
      {/* premium background */}
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-10rem] top-[-8rem] h-[34rem] w-[34rem] rounded-full bg-[#D4AF37]/14 blur-[110px]" />
        <div className="absolute right-[-12rem] top-[4rem] h-[38rem] w-[38rem] rounded-full bg-[#0B1739]/10 blur-[120px]" />

        <div
          className="absolute inset-0 opacity-[0.32]"
          style={{
            backgroundImage:
              "radial-gradient(circle at 1px 1px, rgba(11,16,38,.12) 1px, transparent 0)",
            backgroundSize: "32px 32px",
          }}
        />

        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#D4AF37]/40 to-transparent" />
      </div>

      <div className="relative mx-auto grid w-full min-w-0 max-w-7xl items-center gap-12 px-4 py-14 sm:px-6 sm:py-16 lg:px-8 lg:py-20 xl:min-h-[760px] xl:grid-cols-[minmax(0,1.06fr)_minmax(0,.94fr)] xl:gap-14 xl:py-24 2xl:gap-20 2xl:py-28">
        {/* LEFT */}
        <div className="relative z-10 min-w-0">
          <div className="inline-flex max-w-full flex-wrap items-center gap-2 rounded-full border border-[#D4AF37]/30 bg-white/80 px-4 py-2 shadow-[0_8px_30px_rgba(11,16,38,.06)] backdrop-blur-xl">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#D4AF37]/15">
              <Sparkles className="h-3.5 w-3.5 text-[#B58D17]" />
            </span>

            <span className="text-xs font-extrabold uppercase tracking-[0.16em] text-[#17213D] sm:text-sm">
              Trusted Vedic Astrology Platform
            </span>
          </div>

          <h1
            id="hero-heading"
            className="mt-7 max-w-[780px] text-[clamp(2.35rem,5.2vw,4.7rem)] font-black leading-[1.02] tracking-[-0.055em] text-[#08142E]"
          >
            Find clarity for life&apos;s{" "}
            <span className="relative inline-block">
              <span className="relative z-10 bg-gradient-to-r from-[#B98913] via-[#D4AF37] to-[#9C7410] bg-clip-text text-transparent">
                important moments.
              </span>

              <span className="absolute bottom-1 left-0 -z-0 h-3 w-full rounded-full bg-[#D4AF37]/10" />
            </span>
          </h1>

          <p className="mt-7 max-w-2xl text-base font-medium leading-8 text-[#5B6476] sm:text-lg">
            Consult verified Vedic astrologers, generate professional Kundli
            insights and receive personalized guidance through secure chat and
            audio consultations.
          </p>

          <div className="mt-7 flex flex-wrap gap-3">
            {heroHighlights.map((highlight) => (
              <span
                key={highlight}
                className="inline-flex items-center gap-2 rounded-full border border-[#EAE3D3] bg-white/90 px-4 py-2.5 text-sm font-bold text-[#354159] shadow-[0_5px_20px_rgba(11,16,38,.05)]"
              >
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-50">
                  <Check className="h-3 w-3 stroke-[3] text-emerald-600" />
                </span>

                {highlight}
              </span>
            ))}
          </div>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/astrologers"
              prefetch
              className="group inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#D7B23C] to-[#C99A1E] px-7 py-4 text-sm font-black text-[#08142E] shadow-[0_15px_35px_rgba(190,142,21,.24)] transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_20px_45px_rgba(190,142,21,.32)]"
            >
              Talk to an Astrologer
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>

            <Link
              href="/kundli"
              prefetch
              className="group inline-flex min-h-[54px] items-center justify-center gap-2 rounded-2xl border border-[#C9CED9] bg-white/80 px-7 py-4 text-sm font-black text-[#0B1739] shadow-sm backdrop-blur transition duration-300 hover:-translate-y-0.5 hover:border-[#D4AF37] hover:bg-white"
            >
              Explore Professional Kundli
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
          </div>

          <div className="mt-10 grid max-w-2xl grid-cols-1 gap-3 sm:grid-cols-3">
            {trustCards.map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.title}
                  className="group rounded-[1.35rem] border border-white bg-white/75 p-4 shadow-[0_8px_30px_rgba(11,16,38,.06)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:shadow-[0_16px_40px_rgba(11,16,38,.09)]"
                >
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#F7EFCF] text-[#A57C12]">
                      <Icon className="h-[18px] w-[18px]" />
                    </div>

                    <div>
                      <p className="text-lg font-black text-[#0B1739]">
                        {item.title}
                      </p>

                      <p className="mt-0.5 text-xs font-medium text-[#71798A]">
                        {item.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT */}
        <div className="relative mx-auto min-w-0 w-full max-w-[560px] xl:mx-0 xl:ml-auto">
          <div className="absolute -inset-7 rounded-[3rem] bg-gradient-to-br from-[#D4AF37]/20 via-transparent to-[#14234B]/15 blur-2xl" />

          <div className="relative w-full min-w-0 rounded-[1.6rem] border border-white/90 bg-white/70 p-2 shadow-[0_40px_90px_rgba(10,22,52,.18)] backdrop-blur-xl sm:rounded-[2.25rem] sm:p-4">
            <div className="relative min-w-0 overflow-hidden rounded-[1.35rem] bg-gradient-to-br from-[#071329] via-[#0D1B3A] to-[#192957] p-4 text-white sm:rounded-[1.8rem] sm:p-6 lg:p-7 xl:p-8">
              <div
                aria-hidden="true"
                className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-[#D4AF37]/15 blur-3xl"
              />

              <div
                aria-hidden="true"
                className="absolute -bottom-32 -left-24 h-72 w-72 rounded-full bg-indigo-400/10 blur-3xl"
              />

              <div className="relative z-10 min-w-0">
                <div className="flex items-start justify-between gap-6">
                  <div>
                    <p className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#E5C54F]">
                      Today&apos;s Guidance
                    </p>

                    <p className="mt-2 text-sm font-medium text-white/55">
                      Personalized Vedic insight
                    </p>
                  </div>

                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-white/10 bg-white/10 shadow-inner">
                    <Star className="h-5 w-5 fill-[#D4AF37] text-[#D4AF37]" />

                    <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-[#101D3C] bg-emerald-400" />
                  </div>
                </div>

                <div className="mt-9">
                  <div className="mb-4 inline-flex rounded-full border border-[#D4AF37]/20 bg-[#D4AF37]/10 px-3 py-1.5 text-xs font-bold text-[#E7CA68]">
                    Your personalized astrology journey
                  </div>

                  <h2 className="max-w-md text-3xl font-black leading-[1.12] tracking-[-0.035em] sm:text-[2.5rem]">
                    Your birth chart can reveal a clearer path forward.
                  </h2>

                  <p className="mt-5 max-w-md text-sm font-medium leading-7 text-white/65 sm:text-base">
                    Understand strengths, relationships, timing and
                    opportunities through your birth date, time and place.
                  </p>
                </div>

                <div className="mt-8 grid gap-3">
                  <div className="group rounded-2xl border border-white/10 bg-white/[0.07] p-4 transition hover:bg-white/[0.11]">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#D4AF37]/15">
                        <Sparkles className="h-4 w-4 text-[#E1C252]" />
                      </div>

                      <div>
                        <p className="font-extrabold text-white">
                          Personalized Birth Chart
                        </p>

                        <p className="mt-1 text-sm leading-6 text-white/55">
                          Detailed insights designed around your unique birth
                          information.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="group rounded-2xl border border-white/10 bg-white/[0.07] p-4 transition hover:bg-white/[0.11]">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-400/10">
                        <Users className="h-4 w-4 text-emerald-300" />
                      </div>

                      <div>
                        <p className="font-extrabold text-white">
                          Live Consultation
                        </p>

                        <p className="mt-1 text-sm leading-6 text-white/55">
                          Connect with verified astrologers through chat or
                          audio.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <Link
                  href="/kundli"
                  prefetch
                  className="group mt-8 inline-flex items-center gap-2 text-sm font-extrabold text-[#E3C34E]"
                >
                  Explore your Kundli
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </div>
            </div>
          </div>

          <div className="absolute -bottom-7 left-3 hidden w-[min(245px,calc(100%-1.5rem))] rounded-2xl border border-white bg-white/95 p-4 shadow-[0_18px_50px_rgba(10,22,52,.16)] backdrop-blur-xl xl:block 2xl:-left-5">
            <div className="flex items-center gap-3">
              <div className="relative flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-50">
                <Headphones className="h-5 w-5 text-emerald-600" />

                <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-emerald-500" />
              </div>

              <div>
                <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#8A93A4]">
                  Live Support
                </p>

                <p className="mt-1 text-sm font-black text-[#0B1739]">
                  Astrologers Available Online
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="relative h-px bg-gradient-to-r from-transparent via-[#D4AF37]/25 to-transparent" />
    </section>
  );
}


