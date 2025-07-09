import { prisma } from "@workspace/database/client";
import "dotenv/config";
import { NextFunction, Response } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";
import { CustomExpressRequest } from "../type/type";

export function AuthMiddlware(
  req: CustomExpressRequest,
  res: Response,
  next: NextFunction,
) {
  const token = req.headers.authorization;
  if (!token) {
    res.status(400).json({
      msg: "sign in first",
    });
    return;
  }
  const decodedData = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  if (!decodedData.userId) {
    res.status(400).json({
      msg: "sign in first",
    });
    return;
  }
  req.userId = decodedData.userId;
  next();
  return;
}

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
