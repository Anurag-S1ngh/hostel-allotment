import "dotenv/config";
import { NextFunction, Response, Request } from "express";
import jwt, { JwtPayload } from "jsonwebtoken";

export function AuthMiddlware(req: Request, res: Response, next: NextFunction) {
  const token = req.headers.authorization;
  if (!token) {
    res.status(401).json({
      msg: "sign up first",
    });
    return;
  }
  const decodedData = jwt.verify(token, process.env.JWT_SECRET!) as JwtPayload;
  if (!decodedData.userId) {
    res.status(401).json({
      msg: "sign up first",
    });
    return;
  }
  (req as any).userId = decodedData.userId;
  next();
  return;
}

export interface AuthedRequest extends Request {
  userId: string;
}