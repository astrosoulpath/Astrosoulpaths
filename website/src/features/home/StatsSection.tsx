const stats = [
  { label: "Trusted Astrologers", value: "500+" },
  { label: "Happy Customers", value: "50K+" },
  { label: "Consultations", value: "1L+" },
  { label: "User Rating", value: "4.8★" },
];

export function StatsSection() {
  return (
    <section className="bg-[#0B1026] py-12">
      <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-6 md:grid-cols-4">
        {stats.map((item) => (
          <div key={item.label} className="text-center">
            <h3 className="text-3xl font-bold text-[#D4AF37] md:text-4xl">
              {item.value}
            </h3>
            <p className="mt-2 text-sm text-gray-300">{item.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}