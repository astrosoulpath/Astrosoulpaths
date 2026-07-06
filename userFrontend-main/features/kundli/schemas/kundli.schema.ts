import { z } from "zod";

export const kundliSchema = z.object({
  fullName: z.string().trim().min(2, "Name must be at least 2 characters"),
  gender: z.enum(["male", "female", "other"]),
  dateOfBirth: z.string().trim().min(4, "Date of birth is required"),
  timeOfBirth: z.string().trim().min(3, "Time of birth is required"),
  birthPlace: z.string().trim().min(2, "Birth place is required"),
  city: z.string().trim().optional(),
  latitude: z.number().optional(),
  longitude: z.number().optional(),
  timezone: z.number().optional(),
  timezoneName: z.string().trim().optional(),
  state: z.string().trim().optional(),
  country: z.string().trim().optional(),
  countryCode: z.string().trim().optional(),
  selectedGeo: z
    .object({
      city: z.string(),
      fullname: z.string().optional(),
      state: z.string(),
      country: z.string(),
      countryCode: z.string(),
      latitude: z.number(),
      longitude: z.number(),
      timezone: z.number(),
      timezoneName: z.string(),
    })
    .optional(),
  notes: z
    .string()
    .trim()
    .max(400, "Keep notes under 400 characters")
    .optional(),
  saveMode: z.enum(["local", "cloud"]),
});

export type KundliSchemaValues = z.infer<typeof kundliSchema>;
