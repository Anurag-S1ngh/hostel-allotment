import { prisma } from "@workspace/database/client";
import { Response } from "express";
import { CustomExpressRequest } from "../type/type";

export async function adminAuthMiddleware(
  req: CustomExpressRequest,
  res: Response,
  next: Function,
) {
  const adminId = req.userId;
  if (!adminId) {
    res.status(400).json({ msg: "unauthorized", error: "Unauthorized" });
    return;
  }

  try {
    const admin = await prisma.admin.findUnique({ where: { id: adminId } });
    if (!admin) {
      res
        .status(403)
        .json({ msg: "Unauthorized", error: "You are not an admin" });
      return;
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ msg: "Internal Server Error" });
    return;
  }
  next();
}
