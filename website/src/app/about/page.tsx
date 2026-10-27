import type { Metadata } from "next";
import AboutPage from "@/features/about/AboutPage";
export const metadata: Metadata = {
  title: "About Us | Astro Soul Path",
  description: "Discover the mission and vision of Astro Soul Path.",
  alternates: { canonical: "/about" },
};
export default AboutPage;
