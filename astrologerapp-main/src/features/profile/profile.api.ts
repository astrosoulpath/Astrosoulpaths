import type {
  AstrologerProfileFormValues,
} from "@/src/features/profile/profile.schema";

/**
 * Temporary development profile.
 *

 * authenticated backend profile API connect karenge.
 */
const mockAstrologerProfile: AstrologerProfileFormValues = {
  bio:
    "Vedic astrologer helping people find clarity and guidance through the wisdom of astrology.",

  dateOfBirth: "",

  email: "astrosoulpath@gmail.com",

  expertise: [
    "Vedic Astrology",
    "KP Astrology",
    "Prashna Kundli",
    "Career Guidance",
    "Relationship",
    "Marriage Matching",
  ],

  fullName: "Harsh Raj",

  gender: "Male",

  location: "India",

  phoneNumber: "+91 8651540070",

  username: "@astrosoulpath",
};

function delay(
  milliseconds: number,
): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

export async function fetchAstrologerProfile(): Promise<AstrologerProfileFormValues> {
  await delay(250);

  return {
    ...mockAstrologerProfile,
    expertise: [
      ...mockAstrologerProfile.expertise,
    ],
  };
}

export async function updateAstrologerProfile(
  values: AstrologerProfileFormValues,
): Promise<AstrologerProfileFormValues> {
  await delay(450);

  return {
    ...values,
    expertise: [
      ...values.expertise,
    ],
  };
}