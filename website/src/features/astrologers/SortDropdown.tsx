export function SortDropdown() {
  return (
    <select className="rounded-xl border border-gray-200 bg-white px-4 py-3 outline-none focus:border-[#D4AF37]">
      <option>Sort by Recommended</option>
      <option>Highest Rating</option>
      <option>Experience</option>
      <option>Price: Low to High</option>
      <option>Price: High to Low</option>
    </select>
  );
}