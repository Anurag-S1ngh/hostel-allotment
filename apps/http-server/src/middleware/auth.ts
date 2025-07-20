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
