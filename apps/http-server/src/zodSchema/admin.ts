import { z } from "zod";

export const adminAuthSchema = z.object({
  email: z.string({ required_error: "Email is required" }),

  password: z
    .string({ required_error: "Password is required" })
    .min(6, "Password must be at least 8 characters long"),
});

export const roomAutoFillSchema = z.object({
  hostelId: z.string({ required_error: "Hostel id is required" }),
  forStudentYear: z.number({ required_error: "Year is required" }),
  institutionId: z.string({ required_error: "Institution is required" }),
});

export const roomAddManySchema = z.object({
  hostelId: z.string({ required_error: "Hostel id is required" }),
  rooms: z
    .array(
      z.object({
        roomName: z.string({ required_error: "Room name is required" }),
        capacity: z.number({ required_error: "Capacity is required" }),
      }),
    )
    .nonempty({ message: "No rooms provided" }),
});

export const roomRemoveSchema = z.object({
  roomId: z.string({ required_error: "Room id is required" }),
});

export const roomRemoveAllSchema = z.object({
  hostelId: z.string({ required_error: "Hostel id is required" }),
});

export const roomUpdateSchema = z.object({
  roomId: z.string({ required_error: "Room id is required" }),
  roomName: z.string({ required_error: "Room name is required" }),
  capacity: z.number({ required_error: "Capacity is required" }),
});

export const hostelCreateSchema = z.object({
  hostelName: z.string({ required_error: "Hostel name is required" }),
});

export const hostelRemoveSchema = z.object({
  hostelId: z.string({ required_error: "Hostel id is required" }),
});

export const adminGetAllGroupsSchema = z.object({
  studentYear: z.number({ required_error: "Year is required" }),
});
