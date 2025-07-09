import { prisma } from "@workspace/database/client";
import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { Request, Response } from "express";
import { AuthMiddlware } from "./middleware/auth";
import {
  authSchema,
  groupCreateSchema,
  groupJoinSchema,
  groupRemoveSchema,
} from "./ZodSchema/schema";

interface AuthedRequest extends Request {
  userId: string;
}


const app = express();
app.use(express.json());
app.use(cors());

app.post("/signup", async (req: Request, res: Response) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors }) ;
    return;
    }

  const { email, password } = parsed.data;
  const hashPassword = await bcrypt.hash(password, 10);
  try {
    const user = await prisma.student.create({
      data: {
        username: Math.random().toString(),
        email,
        password: hashPassword,
        cgpa: 9,
      },
    });
    res.status(201).json({ message: "Signup successful", user });
  } catch (error) {
    console.error("signup error", error);
    res.status(500).json({ message: "Signup failed. Try again later." });
  }
});

app.post("/signin", async (req: Request, res: Response) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });
    return;
  }

  const { email, password } = parsed.data;
  try {
    const user = await prisma.student.findFirst({ where: { email } });
    if (!user)  res.status(404).json({ message: "User not found" });

    const isValid = await bcrypt.compare(password, user!.password);
    if (!isValid) res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign({ userId: user!.id }, process.env.JWT_SECRET!);
    res.status(200).json({ message: "Signin successful", token });
  } catch {
    
    res.status(500).json({ message: "Signin failed. Try again later." });
  }
});

app.post("/admin/signin", async (req: Request, res: Response) => {
  const parsed = authSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten().fieldErrors });
  return;
  }

  const { email, password } = parsed.data;
  try {
    const admin = await prisma.admin.findFirst({ where: { email } });
    if (!admin)  res.status(401).json({ message: "Unauthorized: Admin not found" });
    if (admin!.password !== password)  res.status(401).json({ message: "Incorrect password" });

    const token = jwt.sign({ userId: admin!.id }, process.env.JWT_SECRET!);
    res.status(200).json({ message: "Admin signin successful", token });
  } catch {
    res.status(500).json({ message: "Signin failed. Try again later." });
  }
});

app.post("/group/create", AuthMiddlware, async (req: Request, res: Response) => {
  const parsed = groupCreateSchema.safeParse(req.body);
  if (!parsed.success)  res.status(400).json({ message: "Invalid group name" });
  const data = parsed.data!;

  const userId = (req as any).userId;
  if (!userId)  res.status(401).json({ message: "Unauthorized" });

  try {
    const group = await prisma.group.create({
      data: {
        name: data.name,
        members: {
          create: {
            studentId: userId,
            isGroupAdmin: true,
          },
        },
      },
      include: { members: true },
    });
    res.status(201).json({ message: "Group created", group });
  } catch {
    res.status(500).json({ message: "Group creation failed" });
  }
});

app.post("/group/join", AuthMiddlware, async (req: Request, res: Response) => {
  const parsed = groupJoinSchema.safeParse(req.body);
  if (!parsed.success)  res.status(400).json({ message: "Invalid group name" });
  const data = parsed.data!;

  const userId = (req as any).userId;
  if (!userId)  res.status(401).json({ message: "Unauthorized" });

  try {
    const group = await prisma.group.findFirst({ where: { name: data.groupName } });
    if (!group)  res.status(404).json({ message: "Group not found" });

    const groupMember = await prisma.groupMember.create({
      data: { groupId: group!.id, studentId: userId },
    });

    res.status(200).json({ message: "Joined group successfully", groupMember });
  } catch {
    res.status(500).json({ message: "Group join failed" });
  }
});

app.delete("/group/:groupId/remove", AuthMiddlware, async (req: Request, res: Response) => {
  const parsed = groupRemoveSchema.safeParse(req.body);
  if (!parsed.success)  res.status(400).json({ message: "Invalid member ID" });
  const data = parsed.data!;

  const userId = (req as any).userId;
  if (!userId)  res.status(401).json({ message: "Unauthorized" });

  const groupId = req.params.groupId;
  const memberId = data.memberId;

  try {
    const admin = await prisma.groupMember.findFirst({
      where: { studentId: userId, groupId },
    });

    if (!admin)  res.status(404).json({ message: "You are not in this group" });
    if (!admin!.isGroupAdmin)  res.status(403).json({ message: "You are not the group admin" });

    await prisma.groupMember.delete({
      where: { studentId: memberId },
    });

    res.status(200).json({ message: "Member removed from group" });
  } catch {
    res.status(500).json({ message: "Remove failed. Try again." });
  }
});

app.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
