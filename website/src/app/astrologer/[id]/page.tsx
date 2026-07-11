import { AstrologerProfile } from "@/features/astrologers/AstrologerProfile";

type AstrologerProfilePageProps = {
  params: Promise<{
    id: string;
  }>;
};

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