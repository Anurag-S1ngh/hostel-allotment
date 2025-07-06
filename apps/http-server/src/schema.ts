import { z } from "zod";

export const authSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const groupCreateSchema = z.object({
  name: z.string().min(1),
});

export const groupJoinSchema = z.object({
  groupName: z.string().min(1),
});

export const groupRemoveSchema = z.object({
  memberId: z.string().uuid(),
});
