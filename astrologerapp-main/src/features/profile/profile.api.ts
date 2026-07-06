import { AstrologerProfileFormValues } from "@/src/features/profile/profile.schema";

const mockAstrologerProfile: AstrologerProfileFormValues = {
  bio: "Vedic astrologer with 6+ years of experience. I help people find clarity and guidance through the wisdom of the stars.",
  dateOfBirth: "15 March 1990",
  email: "sakshamastro@gmail.com",
  expertise: [
    "Vedic Astrology",
    "KP Astrology",
    "Prashna Kundli",
    "Career Guidance",
    "Relationship",
    "Marriage Matching",
  ],
  fullName: "Saksham Sharma",
  gender: "Male",
  location: "New Delhi, India",
  phoneNumber: "+91 98765 43210",
  username: "@sakshamastro",
};

export async function fetchAstrologerProfile() {
  // Replace this with your API client, for example:
  // return api.get<AstrologerProfileFormValues>("/astrologer/profile");
  await new Promise((resolve) => setTimeout(resolve, 250));
  return mockAstrologerProfile;
}

export async function updateAstrologerProfile(
  values: AstrologerProfileFormValues,
) {
  // Replace this with your API client, for example:
  // return api.put<AstrologerProfileFormValues>("/astrologer/profile", values);
  await new Promise((resolve) => setTimeout(resolve, 450));
  return values;
}
