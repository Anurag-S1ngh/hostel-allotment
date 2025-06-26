import { prisma } from "@workspace/database/client";
import "dotenv/config";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import cors from "cors";
import express, { Request, Response } from "express";
import { AuthMiddlware } from "./middleware/auth";

const app = express();
app.use(express.json());
app.use(cors());

app.post("/signup", async (req: Request, res: Response) => {
  const { email, password } = req.body;
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
    res.json({
      msg: "sign up successful",
      user,
    });
  } catch (error) {
    console.log(error);
    res.json({
      msg: "try again later",
    });
  }
  return;
});

app.post("/signin", async (req: Request, res: Response) => {
  const { email, password } = req.body;
  try {
    const user = await prisma.student.findFirst({
      where: {
        email,
      },
    });
    if (!user) {
      res.json({
        msg: "user not found",
      });
      return;
    }
    const isValidPassword = await bcrypt.compare(password, user.password);
    if (!isValidPassword) {
      res.json({
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
    res.json({
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
      res.json({
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
    res.json({
      msg: "try again later",
    });
  }
});

app.post(
  "/group/create",
  AuthMiddlware,
  async (req: Request, res: Response) => {
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

app.post("/group/join", AuthMiddlware, async (req: Request, res: Response) => {
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
});

app.delete(
  "/group/:groupId/remove",
  AuthMiddlware,
  async (req: Request, res: Response) => {
    const userId = req.userId;
    if (!userId) {
      res.json({
        msg: "sign in first",
      });
      return;
    }

    const groupId = req.params.groupId;
    const { memberId } = req.body;

    try {
      const user = await prisma.groupMember.findFirst({
        where: {
          studentId: userId,
          groupId,
        },
      });

      if (!user) {
        res.json({
          msg: "user not found",
        });
        return;
      }

      if (!user.isGroupAdmin) {
        res.json({
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
      res.json({
        msg: "group member removed successfully",
        removedMember,
      });
    } catch (error) {
      res.json({
        msg: "try again later",
      });
    }
  },
);

app.listen(3001);
