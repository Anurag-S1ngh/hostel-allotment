import { z } from "zod";

export const studentUpSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .regex(/^\d{2}[a-zA-Z]{3}\d{3}@nith\.ac\.in$/, "Incorrect email"),

  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters long"),

  rollNumber: z
    .string({ required_error: "Roll number is required" })
    .regex(/^\d{2}[a-zA-Z]{3}\d{3}$/, "Invalid institutional roll number"),
});

export const studentInSchema = z.object({
  email: z
    .string({ required_error: "Email is required" })
    .regex(
      /^\d{2}[a-zA-Z]{3}\d{3}@nith\.ac\.in$/,
      "Invalid institutional email",
    ),

  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 6 characters long"),
});

export const adminAuthSchema = z.object({
  email: z.string({ required_error: "Email is required" }),

  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 8 characters long"),
});

export const groupCreateSchema = z.object({
  name: z.string({ required_error: "Group name is required" }),
});

export const groupJoinSchema = z.object({
  name: z.string({ required_error: "Group name is required" }),
});

export const groupRemoveSchema = z.object({
  memberId: z.string({ required_error: "Member id is required" }),
});

export const roomAutoFillSchema = z.object({
  hostelId: z.string({ required_error: "Hostel id is required" }),
  forStudentYear: z.number({ required_error: "Year is required" }),
});
