const reviews = [
  {
    name: "Priya S.",
    rating: "5.0",
    comment:
      "Very clear guidance. The consultation helped me understand my career direction.",
  },
  {
    name: "Rohit M.",
    rating: "4.8",
    comment:
      "Accurate Kundli reading and practical remedies. Good experience.",
  },
];

export function ReviewSection() {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-[#0B1026]">
        Reviews
      </h2>

      <div className="mt-6 space-y-5">
        {reviews.map((review) => (
          <div
            key={review.name}
            className="rounded-2xl bg-[#FAF7F0] p-5"
          >
            <div className="flex items-center justify-between">
              <strong>{review.name}</strong>
              <span>⭐ {review.rating}</span>
            </div>

            <p className="mt-3 text-gray-600">
              {review.comment}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}