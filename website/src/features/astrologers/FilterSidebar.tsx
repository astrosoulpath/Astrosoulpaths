const filters = {
  language: ["Hindi", "English", "Gujarati", "Tamil"],
  specialty: ["Vedic Astrology", "Kundli", "Tarot", "Numerology"],
  availability: ["Online", "Available Today"],
};

export function FilterSidebar() {
  return (
    <aside className="rounded-3xl bg-white p-6 shadow-lg">
      <h3 className="text-xl font-bold text-[#0B1026]">Filters</h3>

      <div className="mt-6 space-y-6">
        {Object.entries(filters).map(([title, options]) => (
          <div key={title}>
            <p className="mb-3 font-semibold capitalize text-[#0B1026]">
              {title}
            </p>

            <div className="space-y-2">
              {options.map((option) => (
                <label key={option} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" />
                  {option}
                </label>
              ))}
            </div>
          </div>
        ))}
      </div>
    </aside>
  );
}