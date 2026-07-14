import type { Metadata } from "next";

import { AstrologerProfile } from "@/features/astrologers/AstrologerProfile";
import { getPublicAstrologerById } from "@/services/astrologerService";

type AstrologerProfilePageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({
  params,
}: AstrologerProfilePageProps): Promise<Metadata> {
  const { id } = await params;

  try {
    const response =
      await getPublicAstrologerById(id);

    const astrologer =
      response.data;

    const title = astrologer?.name
      ? `${astrologer.name} | Astro Soul Path`
      : "Astrologer Profile | Astro Soul Path";

    const description =
      astrologer?.bio ||
      `${astrologer?.name ?? "Astrologer"} provides professional astrology consultation on Astro Soul Path.`;

    return {
      title,

      description,

      keywords: [
        "Astrologer",
        "Vedic Astrology",
        "Kundli",
        "Horoscope",
        "Astro Soul Path",
      ],

      openGraph: {
        title,
        description,
        type: "website",
        images: astrologer?.avatarUrl
          ? [
              {
                url: astrologer.avatarUrl,
              },
            ]
          : [],
      },

      twitter: {
        card: "summary_large_image",
        title,
        description,
      },
    };
  } catch {
    return {
      title:
        "Astrologer Profile | Astro Soul Path",

      description:
        "Professional astrology consultation on Astro Soul Path.",
    };
  }
}

export default async function AstrologerProfilePage({
  params,
}: AstrologerProfilePageProps) {
  const { id } = await params;

  return (
    <main className="min-h-screen bg-[#FAF7F0] py-12">
      <div className="mx-auto max-w-6xl px-6">
        <AstrologerProfile astrologerId={id} />
      </div>
    </main>
  );
}