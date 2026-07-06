import { z } from "zod";

export const sendOtpFormSchema = z.object({
  callingCode: z
    .string()
    .trim()
    .min(1, "Select a country code")
    .max(4, "Select a valid country code")
    .regex(/^\d+$/, "Country code must be numeric"),
  nationalNumber: z
    .string()
    .trim()
    .min(8, "Enter a valid mobile number")
    .max(15, "Enter a valid mobile number")
    .regex(/^\d+$/, "Only digits are allowed"),
});

export const e164PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+[1-9]\d{7,14}$/, "Enter a valid number with country code");

export const verifyOtpFormSchema = z.object({
  token: z
    .string()
    .trim()
    .length(6, "OTP must be 6 digits")
    .regex(/^\d+$/, "OTP must be numeric"),
});

export type SendOtpFormValues = z.infer<typeof sendOtpFormSchema>;
export type VerifyOtpFormValues = z.infer<typeof verifyOtpFormSchema>;
