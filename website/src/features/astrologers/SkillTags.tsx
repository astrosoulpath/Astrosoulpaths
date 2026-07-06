const skills = [
  "Vedic Astrology",
  "Kundli",
  "Marriage",
  "Career",
  "Finance",
  "Health",
  "Love",
  "Numerology",
];

export function SkillTags() {
  return (
    <div className="rounded-3xl bg-white p-8 shadow-lg">
      <h2 className="text-2xl font-bold text-[#0B1026]">
        Expertise
      </h2>

      <div className="mt-6 flex flex-wrap gap-3">
        {skills.map((skill) => (
          <span
            key={skill}
            className="rounded-full bg-[#D4AF37]/20 px-4 py-2 text-sm font-medium text-[#0B1026]"
          >
            {skill}
          </span>
        ))}
      </div>
    </div>
  );
}