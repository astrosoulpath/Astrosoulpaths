export function SearchBar() {
  return (
    <div className="rounded-2xl bg-white p-4 shadow">
      <input
        type="text"
        placeholder="Search astrologers by name, language or speciality..."
        className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:border-[#D4AF37]"
      />
    </div>
  );
}