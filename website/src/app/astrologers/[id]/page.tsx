import { AstrologerProfile } from "@/features/astrologers/AstrologerProfile";
import { BookingCard } from "@/features/astrologers/BookingCard";
import { AvailabilityCard } from "@/features/astrologers/AvailabilityCard";
import { SkillTags } from "@/features/astrologers/SkillTags";
import { ReviewSection } from "@/features/astrologers/ReviewSection";

export default function AstrologerDetailsPage() {
  return (
    <main className="min-h-screen bg-[#FAF7F0] py-20">
      <div className="mx-auto grid max-w-7xl gap-8 px-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-8">
          <AstrologerProfile />
          <SkillTags />
          <ReviewSection />
        </div>

        <div className="space-y-8">
          <BookingCard />
          <AvailabilityCard />
        </div>
      </div>
    </main>
  );
}