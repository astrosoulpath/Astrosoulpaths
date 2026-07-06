export function BookingCard() {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-[#0B1026]">
        Book Consultation
      </h2>

      <div className="mt-6 space-y-4">
        <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F0] p-4">
          <span>Chat Consultation</span>
          <strong>₹25/min</strong>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F0] p-4">
          <span>Audio Call</span>
          <strong>₹40/min</strong>
        </div>

        <div className="flex items-center justify-between rounded-2xl bg-[#FAF7F0] p-4">
          <span>Video Call</span>
          <strong>₹60/min</strong>
        </div>
      </div>

      <button className="mt-8 w-full rounded-xl bg-[#D4AF37] py-4 font-semibold text-[#0B1026]">
        Start Consultation
      </button>

      <p className="mt-4 text-center text-sm text-[#374151]">
        Login and wallet balance required before consultation.
      </p>
    </div>
  );
}