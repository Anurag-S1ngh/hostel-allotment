import { prisma } from "@workspace/database/client";
import "dotenv/config";
import express, { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { adminAuthMiddleware } from "../middleware/adminAuth";
import { CustomExpressRequest } from "../type/type";
import {
  adminGetAllGroupsSchema,
  hostelCreateSchema,
  hostelRemoveSchema,
  roomAddManySchema,
  roomAutoFillSchema,
  roomRemoveAllSchema,
  roomRemoveSchema,
  roomUpdateSchema,
} from "../zodSchema/admin";

export const adminRouter: Router = express.Router();

adminRouter.post("/signin", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.admin.findFirst({
      where: {
        email,
      },
    });
    if (!user) {
      res.status(400).json({
        msg: "unauthorized",
      });
      return;
    }
    const isValidPassword = user.password === password;
    if (!isValidPassword) {
      res.status(400).json({
        msg: "invalid password",
      });
      return;
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

    res.status(200).json({
      msg: "sign in successful",
      token,
    });
  } catch (error) {
    res.status(500).json({
      msg: "try again later",
    });
  }
});

adminRouter.post(
  "/rooms/add-many",
  adminAuthMiddleware,
  async (req: CustomExpressRequest, res: Response) => {
    const isValid = roomAddManySchema.safeParse(req.body);
    if (!isValid.success) {
      res.status(400).json({
        msg: "invalid data",
        errors: isValid.error.issues[0],
      });
      return;
    }

    const { hostelId, rooms } = req.body;

    try {
      const created = await prisma.room.createMany({
        data: rooms.map((room: { roomName: string; capacity: number }) => ({
          roomName: room.roomName,
          capacity: room.capacity,
          hostelId: hostelId,
        })),
        skipDuplicates: true,
      });

      res.status(201).json({
        message: `Created ${created.count} rooms successfully.`,
      });
      return;
    } catch (error: any) {
      console.error("Error creating rooms:", error);
      res.status(500).json({
        msg: "An unexpected error occurred.",
        error: "An unexpected error occurred.",
      });
      return;
    }
  },
);

adminRouter.put("/room/update", adminAuthMiddleware, async (req, res) => {
  const isValid = roomUpdateSchema.safeParse(req.body);
  if (!isValid.success) {
    res.status(400).json({
      msg: "invalid data",
      errors: isValid.error.issues[0]?.message,
    });
    return;
  }
  const { roomId, roomName, capacity } = req.body;
  try {
    await prisma.room.update({
      where: {
        id: roomId,
      },
      data: {
        roomName,
        capacity,
      },
    });
    res.status(200).json({
      msg: "room updated successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "try again later",
    });
  }
});

adminRouter.delete("/room/remove", adminAuthMiddleware, async (req, res) => {
  const isValid = roomRemoveSchema.safeParse(req.body);
  if (!isValid.success) {
    res.status(400).json({
      msg: "invalid data",
      errors: isValid.error.issues[0]?.message,
    });
    return;
  }

  const { roomId } = req.body;
  if (!roomId) {
    res.status(400).json({
      msg: "invalid input",
      errors: "Room ID is required",
    });
  }
  try {
    await prisma.room.delete({
      where: {
        id: roomId,
      },
    });
    res.status(200).json({
      msg: "room deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "try again later",
    });
  }
});

adminRouter.delete(
  "/room/remove/all",
  adminAuthMiddleware,
  async (req, res) => {
    const isValidInput = roomRemoveAllSchema.safeParse(req.body);
    if (!isValidInput.success) {
      res.status(400).json({
        msg: "invalid data",
        errors: isValidInput.error.issues[0]?.message,
      });
      return;
    }
    const { hostelId } = req.body;
    try {
      await prisma.room.deleteMany({
        where: {
          hostelId,
        },
      });
      res.status(200).json({
        msg: "rooms deleted successfully",
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        msg: "try again later",
      });
    }
  },
);

adminRouter.post("/hostel/create", adminAuthMiddleware, async (req, res) => {
  const inputValidation = hostelCreateSchema.safeParse(req.body);
  if (!inputValidation.success) {
    res.status(400).json({
      msg: "invalid data",
      errors: inputValidation.error.issues[0]?.message,
    });
    return;
  }
  const { hostelName, institutionId } = req.body;
  try {
    const hostel = await prisma.hostel.create({
      data: {
        name: hostelName.trim(),
        institutionId,
      },
    });
    res.status(200).json({
      msg: "hostel created successfully",
      hostel,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "try again later",
    });
  }
});

adminRouter.delete("/hostel/remove", adminAuthMiddleware, async (req, res) => {
  const inputValidation = hostelRemoveSchema.safeParse(req.body);
  if (!inputValidation.success) {
    res.status(400).json({
      msg: "invalid data",
      errors: inputValidation.error.issues[0]?.message,
    });
    return;
  }
  const { hostelId } = req.body;
  try {
    await prisma.hostel.delete({
      where: {
        id: hostelId,
      },
    });
    res.status(200).json({
      msg: "hostel deleted successfully",
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "try again later",
    });
  }
});

adminRouter.get("/hostel", adminAuthMiddleware, async (req, res) => {
  try {
    const hostels = await prisma.hostel.findMany();
    res.status(200).json({
      msg: "hostels found",
      hostels,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "try again later",
    });
  }
});

adminRouter.get("/group/all", adminAuthMiddleware, async (req, res) => {
  const isValidInput = adminGetAllGroupsSchema.safeParse(req.body);
  if (!isValidInput.success) {
    res.status(400).json({
      msg: "invalid data",
      errors: isValidInput.error.issues[0]?.message,
    });
    return;
  }
  const { studentYear } = req.body;
  try {
    const groups = await prisma.group.findMany({
      where: {
        studentYear,
      },
      include: {
        members: true,
      },
    });
    res.status(200).json({
      msg: "groups found",
      groups,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "try again later",
    });
  }
});

adminRouter.post(
  "/room/auto-fill",
  async (req: CustomExpressRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.status(400).json({
        msg: "sign in first",
      });
      return;
    }

    const isValid = roomAutoFillSchema.safeParse(req.body);
    if (!isValid.success) {
      res.status(400).json({
        msg: "invalid data",
        errors: isValid.error.issues[0]?.message,
      });
      return;
    }

    const { hostelId, forStudentYear, institutionId } = req.body;
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

      const emptyRooms = rooms.filter((r) => r.AllottedRooms.length === 0);
      const partiallyFilledRooms = rooms.filter(
        (r) =>
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
          .map((m) => m.student)
          .filter((s) => !assignedStudentIds.has(s.id));

        const neededCapacity = groupStudents.length;
        const room = emptyRooms.find((r) => r.capacity >= neededCapacity);
        if (!room) continue;

        for (const s of groupStudents) {
          await prisma.allottedRooms.create({
            data: {
              institutionId,
              hostelId,
              roomId: room.id,
              studentId: s.id,
            },
          });
          assignedStudentIds.add(s.id);
        }

        processedGroupIds.add(group.id);

        const roomIndex = emptyRooms.findIndex((r) => r.id === room.id);
        if (roomIndex !== -1) emptyRooms.splice(roomIndex, 1);
      }

      const remainingStudents = studentsWithoutRoom.filter(
        (s) => !assignedStudentIds.has(s.id),
      );

      for (const room of partiallyFilledRooms) {
        const currentCount = room.AllottedRooms.length;
        const slotsLeft = room.capacity - currentCount;

        const fillers = remainingStudents
          .filter((s) => !assignedStudentIds.has(s.id))
          .slice(0, slotsLeft);

        for (const student of fillers) {
          await prisma.allottedRooms.create({
            data: {
              institutionId,
              hostelId,
              roomId: room.id,
              studentId: student.id,
            },
          });
          assignedStudentIds.add(student.id);
        }
      }

      const stillRemainingStudents = remainingStudents.filter(
        (s) => !assignedStudentIds.has(s.id),
      );

      for (const room of emptyRooms) {
        const slotsLeft = room.capacity;

        const fillers = stillRemainingStudents
          .filter((s) => !assignedStudentIds.has(s.id))
          .slice(0, slotsLeft);

        for (const student of fillers) {
          await prisma.allottedRooms.create({
            data: {
              hostelId,
              institutionId,
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
