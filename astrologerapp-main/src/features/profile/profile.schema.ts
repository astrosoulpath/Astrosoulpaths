import { z } from "zod";

export const expertiseOptions = [
  "Vedic Astrology",
  "KP Astrology",
  "Prashna Kundli",
  "Career Guidance",
  "Relationship",
  "Marriage Matching",
  "Gemstone Guidance",
  "Numerology",
] as const;

export const astrologerProfileSchema = z.object({
  bio: z
    .string()
    .min(20, "Bio should be at least 20 characters")
    .max(200, "Bio must stay under 200 characters"),
  dateOfBirth: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Enter a valid email"),
  expertise: z
    .array(z.string())
    .min(1, "Select at least one expertise")
    .max(8, "You can add up to 8 expertise tags"),
  fullName: z.string().min(2, "Full name is required"),
  gender: z.string().min(1, "Gender is required"),
  location: z.string().min(2, "Location is required"),
  phoneNumber: z.string().min(8, "Phone number is required"),
  username: z.string().min(3, "Username is required"),
});

export type AstrologerProfileFormValues = z.infer<
  typeof astrologerProfileSchema
>;
