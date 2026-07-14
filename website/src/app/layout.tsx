import type { Metadata, Viewport } from "next";
import {
  Geist,
  Geist_Mono,
} from "next/font/google";

import Footer from "@/components/layouts/Footer";
import Navbar from "@/components/layouts/Navbar";

import "./globals.css";
import { AppProviders } from "./providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(
    "https://astrosoulpath.com",
  ),

  title: {
    default:
      "Astro Soul Path",

    template:
      "%s | Astro Soul Path",
  },

  description:
    "Consult verified astrologers online for Kundli, Horoscope, Tarot, Numerology, Marriage Matching, Chat and Audio Consultation.",

  applicationName:
    "Astro Soul Path",

  keywords: [
    "Astrology",
    "Online Astrology",
    "Kundli",
    "Horoscope",
    "Vedic Astrology",
    "Tarot",
    "Numerology",
    "Marriage Matching",
    "Palm Reading",
    "Astro Soul Path",
  ],

  authors: [
    {
      name:
        "Astro Soul Path",
    },
  ],

  creator:
    "Astro Soul Path",

  publisher:
    "Astro Soul Path",

  alternates: {
    canonical: "/",
  },

  robots: {
    index: true,
    follow: true,

    googleBot: {
      index: true,
      follow: true,
      "max-image-preview":
        "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },

  openGraph: {
    type: "website",

    locale: "en_IN",

    siteName:
      "Astro Soul Path",

    title:
      "Astro Soul Path",

    description:
      "Connect with verified astrologers for live astrology consultation.",

    url:
      "https://astrosoulpath.com",

    images: [
      {
        url: "/logo.png",
        width: 512,
        height: 512,
        alt: "Astro Soul Path",
      },
    ],
  },

  twitter: {
    card:
      "summary_large_image",

    title:
      "Astro Soul Path",

    description:
      "Professional astrology consultation platform.",

    images: [
      "/logo.png",
    ],
  },

  icons: {
    icon: "/favicon.ico",

    shortcut:
      "/favicon.ico",

    apple:
      "/apple-touch-icon.png",
  },

  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  width: "device-width",

  initialScale: 1,

  themeColor:
    "#0B1026",
};

type RootLayoutProps =
  Readonly<{
    children: React.ReactNode;
  }>;

export default function RootLayout({
  children,
}: RootLayoutProps) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="flex min-h-full flex-col bg-white text-[#0B1026]">
        <AppProviders>
          <Navbar />

          <main className="flex-1">
            {children}
          </main>

          <Footer />
        </AppProviders>
      </body>
    </html>
  );
}