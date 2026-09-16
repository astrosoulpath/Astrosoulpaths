export default function AstrologerPendingPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-[#FAF7F0] px-6">
      <div className="max-w-md rounded-3xl bg-white p-8 text-center shadow-lg">

        <div className="text-5xl">
          ⏳
        </div>

        <h1 className="mt-5 text-3xl font-bold text-[#0B1026]">
          Profile Under Review
        </h1>

        <p className="mt-4 text-gray-600">
          Your astrologer profile has been submitted successfully.
          Our team will verify your details and approve your profile.
        </p>

        <div className="mt-6 rounded-xl bg-yellow-50 p-4 text-sm text-yellow-700">
          Waiting for admin approval
        </div>

      </div>
    </main>
  );
}