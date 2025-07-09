import { prisma } from "@workspace/database/client";
import bcrypt from "bcryptjs";
import cors from "cors";
import "dotenv/config";
import express, { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { adminAuthMiddleware, AuthMiddlware } from "./middleware/auth";
import { getLatestCgpi } from "./scraper/scraper";
import { CustomExpressRequest } from "./type/type";
import {
  groupCreateSchema,
  groupJoinSchema,
  groupRemoveSchema,
  hostelCreateSchema,
  hostelRemoveSchema,
  roomAddManySchema,
  roomAutoFillSchema,
  roomRemoveAllSchema,
  roomRemoveSchema,
  roomUpdateSchema,
  studentInSchema,
  studentUpSchema,
} from "./zodSchema/schema";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/signup", async (req: Request, res: Response) => {
  const isValid = studentUpSchema.safeParse(req.body);
  if (!isValid.success) {
    res.status(400).json({
      msg: "invalid data",
      error: isValid.error.issues[0]?.message,
    });
    return;
  }
  const { email, password } = req.body;
  const hashPassword = await bcrypt.hash(password, 10);
  const rollNumber = req.body.rollNumber.toLowerCase();

  if (email.substring(0, 8) !== rollNumber) {
    res.status(400).json({
      msg: "invalid input",
      error: "invalid roll number or email",
    });
    return;
  }

  const year = new Date().getFullYear();
  const studentCurrentYear =
    parseInt(year.toString().slice(-2)) - parseInt(rollNumber.slice(0, 2));
  let cgpa;
  try {
    cgpa = await getLatestCgpi(
      rollNumber.toString().substring(0, 2),
      rollNumber,
    );
  } catch (error) {
    res.status(400).json({
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
    res.status(200).json({
      msg: "sign up successful",
      user,
    });
    return;
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "try again later",
    });
  }
  return;
});

app.post("/signin", async (req: Request, res: Response) => {
  const isValid = studentInSchema.safeParse(req.body);
  if (!isValid.success) {
    res.status(400).json({
      msg: "invalid data",
      errors: isValid.error.issues[0]?.message,
    });
    return;
  }
  const { email, password } = req.body;
  try {
    const user = await prisma.student.findFirst({
      where: {
        email,
      },
    });
    if (!user) {
      res.status(400).json({
        msg: "user not found",
      });
      return;
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.status(400).json({
        msg: "invalid password",
      });
      return;
    }
    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
    res.json({
      msg: "sign in successful",
      token,
    });
  } catch (error) {
    res.status(500).json({
      msg: "try again later",
    });
  }
});

app.post("/admin/signin", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.admin.findFirst({
      where: {
        email,
      },
    });
    if (!user) {
      res.json({
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

app.post(
  "/admin/rooms/add-many",
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

app.put("/admin/room/update", adminAuthMiddleware, async (req, res) => {
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

app.delete("/admin/room/remove", adminAuthMiddleware, async (req, res) => {
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

app.delete("/admin/room/remove/all", adminAuthMiddleware, async (req, res) => {
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
});

app.post("/admin/hostel/create", adminAuthMiddleware, async (req, res) => {
  const inputValidation = hostelCreateSchema.safeParse(req.body);
  if (!inputValidation.success) {
    res.status(400).json({
      msg: "invalid data",
      errors: inputValidation.error.issues[0]?.message,
    });
    return;
  }
  const { hostelName } = req.body;
  try {
    const hostel = await prisma.hostel.create({
      data: {
        name: hostelName,
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

app.delete("/admin/hostel/remove", adminAuthMiddleware, async (req, res) => {
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

app.get("/admin/hostel", adminAuthMiddleware, async (req, res) => {
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

app.post(
  "/admin/room/auto-fill",
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

app.post(
  "/group/create",
  AuthMiddlware,
  async (req: CustomExpressRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.status(400).json({
        msg: "sign in first",
      });
      return;
    }
    const isValid = groupCreateSchema.safeParse(req.body);
    if (!isValid.success) {
      res.status(400).json({
        msg: "invalid data",
        errors: isValid.error.issues[0]?.message,
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
      res.status(200).json({
        msg: "group created successfully",
        group,
      });
    } catch (error) {
      res.status(500).json({
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
      res.status(400).json({
        msg: "sign in first",
      });
      return;
    }

    const isValid = groupJoinSchema.safeParse(req.body);
    if (!isValid.success) {
      res.status(400).json({
        msg: "invalid data",
        errors: isValid.error.issues[0]?.message,
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
        res.status(400).json({
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
      res.status(200).json({
        msg: "group joined successfully",
        groupMember,
      });
    } catch (error) {
      res.status(500).json({
        msg: "try again later",
      });
    }
  },
);

app.delete(
  "/group/:groupId/remove",
  AuthMiddlware,
  async (req: CustomExpressRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.status(400).json({
        msg: "sign in first",
      });
      return;
    }

    const groupId = req.params.groupId;
    if (!groupId) {
      res.status(400).json({
        msg: "invalid input",
        errors: "Group ID is required",
      });
      return;
    }

    const isValid = groupRemoveSchema.safeParse(req.body);
    if (!isValid.success) {
      res.status(400).json({
        msg: "invalid data",
        errors: isValid.error.issues[0]?.message,
      });
      return;
    }

    const { memberId } = req.body;

    try {
      const user = await prisma.groupMember.findFirst({
        where: {
          studentId: userId,
          groupId,
        },
      });

      if (!user) {
        res.status(400).json({
          msg: "user not found",
        });
        return;
      }

      if (!user.isGroupAdmin) {
        res.status(400).json({
          msg: "you are not an admin",
        });
        return;
      }

      const removedMember = await prisma.groupMember.delete({
        where: {
          studentId: memberId,
          groupId,
        },
      });
      res.status(200).json({
        msg: "group member removed successfully",
        removedMember,
      });
    } catch (error) {
      res.status(500).json({
        msg: "try again later",
      });
    }
  },
);

app.get("/room", async (req: CustomExpressRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(400).json({
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
      res.status(400).json({
        msg: "no room found",
      });
      return;
    }
    res.status(200).json({
      msg: "room found",
      room,
    });
  } catch (error) {
    console.log(error);
    res.status(500).json({
      msg: "try again later",
    });
  }
});

app.listen(3001);
