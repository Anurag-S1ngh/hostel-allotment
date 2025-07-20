import { prisma } from "@workspace/database/client";
import bcrypt from "bcryptjs";
import "dotenv/config";
import express, { Request, Response, Router } from "express";
import jwt from "jsonwebtoken";
import { getLatestCgpi } from "../scraper/scraper";
import { studentInSchema, studentSignUpSchema } from "../zodSchema/schema";

import { AuthMiddlware } from "../middleware/auth";
import { CustomExpressRequest } from "../type/type";
import {
  groupCreateSchema,
  groupJoinSchema,
  groupRemoveSchema,
  studentGetRoomSchema,
} from "../zodSchema/schema";

export const studentRouter: Router = express.Router();

studentRouter.post("/signup", async (req: Request, res: Response) => {
  const isValid = studentSignUpSchema.safeParse(req.body);
  if (!isValid.success) {
    res.status(400).json({
      msg: "invalid data",
      error: isValid.error.issues[0]?.message,
    });
    return;
  }

  const { email, password, institutionId } = req.body;
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

  const hashPassword = await bcrypt.hash(password, 10);

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
        username: rollNumber.trim(),
        email: email.trim(),
        password: hashPassword,
        cgpa,
        currentYear: studentCurrentYear,
        institutionId,
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

studentRouter.post("/signin", async (req: Request, res: Response) => {
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

studentRouter.post(
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
      const student = await prisma.student.findFirst({
        where: {
          id: userId,
        },
        select: {
          currentYear: true,
          institutionId: true,
        },
      });

      if (!student) {
        res.status(400).json({
          msg: "student not found",
        });
        return;
      }

      const group = await prisma.group.create({
        data: {
          name: name.trim(),
          institutionId: student.institutionId,
          studentYear: student.currentYear,
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
      console.log(error);
      res.status(500).json({
        msg: "try again later",
      });
    }
    return;
  },
);

studentRouter.post(
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
      const student = await prisma.student.findFirst({
        where: {
          id: userId,
        },
        select: {
          currentYear: true,
        },
      });

      if (!student) {
        res.status(400).json({
          msg: "student not found",
        });
        return;
      }

      const group = await prisma.group.findFirst({
        where: {
          name: groupName,
        },
        include: {
          members: true,
        },
      });

      if (!group) {
        res.status(400).json({
          msg: "group not found",
        });
        return;
      }

      if (student.currentYear !== group.studentYear) {
        res.status(400).json({
          msg: "student is not in the group",
        });
        return;
      }

      if (group.members.some((m) => m.studentId === userId)) {
        res.status(400).json({
          msg: "user is already a member of the group",
        });
        return;
      }

      if (group.members.length >= 4) {
        res.status(400).json({
          msg: "group is full",
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

studentRouter.delete(
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

    const groupId = req.params.groupId?.trim();
    if (!groupId || groupId === "") {
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
      const groupAdmin = await prisma.groupMember.findFirst({
        where: {
          studentId: userId,
          groupId,
        },
      });

      if (!groupAdmin) {
        res.status(400).json({
          msg: "user not found",
        });
        return;
      }

      if (!groupAdmin.isGroupAdmin) {
        res.status(400).json({
          msg: "you are not an admin",
        });
        return;
      }

      const member = await prisma.groupMember.findFirst({
        where: {
          studentId: memberId,
          groupId,
        },
      });

      if (!member) {
        res.status(400).json({
          msg: "member not found",
        });
        return;
      }

      if (member.studentId === groupAdmin.studentId) {
        res.status(400).json({
          msg: "Cannot remove yourself",
        });
        return;
      }

      if (groupAdmin.groupId !== member.groupId) {
        res.status(400).json({
          msg: "You are not a member of this group",
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

studentRouter.delete(
  "/group/:groupId/leave",
  AuthMiddlware,
  async (req: CustomExpressRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.status(401).json({
        msg: "sign in first",
      });
      return;
    }
    const groupId = req.params.groupId?.trim();
    if (!groupId || groupId === "") {
      res.status(400).json({
        msg: "invalid input",
        errors: "Group ID is required",
      });
      return;
    }
    try {
      await prisma.groupMember.delete({
        where: {
          studentId: userId,
          groupId,
        },
      });
      res.status(200).json({
        msg: "group member removed successfully",
      });
    } catch (error) {
      console.log(error);
      res.status(500).json({
        msg: "try again later",
      });
    }
    return;
  },
);

studentRouter.get(
  "/room",
  AuthMiddlware,
  async (req: CustomExpressRequest, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.status(400).json({
        msg: "sign in first",
      });
      return;
    }
    const isValidInput = studentGetRoomSchema.safeParse(req.body);
    if (!isValidInput.success) {
      res.status(400).json({
        msg: "invalid data",
        errors: isValidInput.error.issues[0]?.message,
      });
      return;
    }
    const { institutionId } = req.body;
    try {
      const room = await prisma.allottedRooms.findFirst({
        where: {
          studentId: userId,
          institutionId: institutionId,
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
  },
);
