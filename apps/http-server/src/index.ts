import { prisma } from "@workspace/database/client";
import bcrypt from "bcryptjs";
import cors from "cors";
import "dotenv/config";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
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

import { getLatestCgpi } from "./scraper/scraper";
import { CustomExpressRequest } from "./type/type";

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
  const rollNumber = req.body.rollNumber.toLowerCase();
  console.log(rollNumber);
  const year = new Date().getFullYear();
  //  24bcs023
  const studentCurrentYear =
    parseInt(year.toString().slice(-2)) - parseInt(rollNumber.slice(0, 2));
  let cgpa;
  try {
    cgpa = await getLatestCgpi(rollNumber);
  } catch (error) {
    res.json({
      msg: "invalid roll number",
    });
    return;
  }
  if (!cgpa) {
    res.json({
      msg: "invalid roll number",
    });
    return;
  }
  try {
    const user = await prisma.student.create({
      data: {
        username: rollNumber,
        email,
        password: hashPassword,
        cgpa,
        currentYear: studentCurrentYear,
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

app.post(
  "/group/create",
  AuthMiddlware,
  async (req: CustomExpressRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.json({
        msg: "sign in first",
      });
      return;
    }
    const { name } = req.body;
    try {
      const group = await prisma.group.create({
        data: {
          name,
          members: {
            create: {
              studentId: userId,
              isGroupAdmin: true,
            },
          },
        },
        include: {
          members: true,
        },
      });
      res.json({
        msg: "group created successfully",
        group,
      });
    } catch (error) {
      res.json({
        msg: "try again later",
      });
    }
    return;
  },
);

app.post(
  "/group/join",
  AuthMiddlware,
  async (req: CustomExpressRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.json({
        msg: "sign in first",
      });
      return;
    }

    const { groupName } = req.body;

    try {
      const group = await prisma.group.findFirst({
        where: {
          name: groupName,
        },
      });

      if (!group) {
        res.json({
          msg: "group not found",
        });
        return;
      }
      const groupMember = await prisma.groupMember.create({
        data: {
          groupId: group.id,
          studentId: userId,
        },
      });
      res.json({
        msg: "group joined successfully",
        groupMember,
      });
    } catch (error) {
      res.json({
        msg: "try again later",
      });
    }
  },
);


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
app.get("/room", async (req: CustomExpressRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.json({
      msg: "sign in first",
    });
    return;
  }
  try {
    const room = await prisma.allottedRooms.findFirst({
      where: {
        studentId: userId,
      },
      select: {
        room: {
          select: {
            roomName: true,
            capacity: true,
          },
        },
        allottedAt: true,
      },
    });
    if (!room) {
      res.json({
        msg: "no room found",
      });
      return;
    }
    res.json({
      msg: "room found",
      room,
    });
  } catch (error) {
    console.log(error);
    res.json({
      msg: "try again later",
    });
  }
});

app.post(
  "/room/auto-fill",
  async (req: CustomExpressRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.json({
        msg: "sign in first",
      });
      return;
    }
    const { hostelId, forStudentYear } = req.body;
    try {
      const admin = await prisma.admin.findFirst({
        where: {
          id: userId,
        },
      });
      if (!admin) {
        res.status(401).json({ error: "unauthorized" });
        return;
      }

      const rooms = await prisma.room.findMany({
        where: {
          hostelId,
        },
        include: {
          AllottedRooms: true,
        },
      });

      const emptyRooms = rooms.filter((r: any) => r.AllottedRooms.length === 0);
      const partiallyFilledRooms = rooms.filter(
        (r: any) =>
          r.AllottedRooms.length > 0 && r.AllottedRooms.length < r.capacity,
      );

      const studentsWithoutRoom = await prisma.student.findMany({
        where: {
          allottedRoom: null,
          currentYear: forStudentYear - 1,
        },
        include: {
          groupMember: {
            include: {
              group: {
                include: {
                  members: {
                    include: {
                      student: true,
                    },
                  },
                },
              },
            },
          },
        },
      });

      const assignedStudentIds = new Set<string>();

      const processedGroupIds = new Set<string>();

      for (const student of studentsWithoutRoom) {
        const group = student.groupMember?.group;
        if (!group) continue;
        if (processedGroupIds.has(group.id)) continue;

        const groupStudents = group.members
          .map((m: any) => m.student)
          .filter((s: any) => !assignedStudentIds.has(s.id));

        const neededCapacity = groupStudents.length;
        const room = emptyRooms.find((r: any) => r.capacity >= neededCapacity);
        if (!room) continue;

        for (const s of groupStudents) {
          await prisma.allottedRooms.create({
            data: {
              hostelId,
              roomId: room.id,
              studentId: s.id,
            },
          });
          assignedStudentIds.add(s.id);
        }

        processedGroupIds.add(group.id);

        const roomIndex = emptyRooms.findIndex((r: any) => r.id === room.id);
        if (roomIndex !== -1) emptyRooms.splice(roomIndex, 1);
      }

      const remainingStudents = studentsWithoutRoom.filter(
        (s: any) => !assignedStudentIds.has(s.id),
      );

      for (const room of partiallyFilledRooms) {
        const currentCount = room.AllottedRooms.length;
        const slotsLeft = room.capacity - currentCount;

        const fillers = remainingStudents
          .filter((s: any) => !assignedStudentIds.has(s.id))
          .slice(0, slotsLeft);

        for (const student of fillers) {
          await prisma.allottedRooms.create({
            data: {
              hostelId,
              roomId: room.id,
              studentId: student.id,
            },
          });
          assignedStudentIds.add(student.id);
        }
      }

      const stillRemainingStudents = remainingStudents.filter(
        (s: any) => !assignedStudentIds.has(s.id),
      );

      for (const room of emptyRooms) {
        const slotsLeft = room.capacity;

        const fillers = stillRemainingStudents
          .filter((s: any) => !assignedStudentIds.has(s.id))
          .slice(0, slotsLeft);

        for (const student of fillers) {
          await prisma.allottedRooms.create({
            data: {
              hostelId,
              roomId: room.id,
              studentId: student.id,
            },
          });
          assignedStudentIds.add(student.id);
        }
      }

      res
        .status(200)
        .json({ message: "Room allocation completed successfully." });
    } catch (error) {
      console.log(error);
      res.status(500).json({ error: "internal server error" });
    }
  },
);

app.listen(3001);
