import { prisma } from "@workspace/database/client";
import "dotenv/config";
import { type IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

const userMap = new Map<string, WebSocket>();
const groupQueue = new Map<string, any>();

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  if (!req.url) {
    console.log("no url");
    ws.close(1008, "Authentication token required");
    return;
  }

  const token = req.url.split("token=")[1];
  if (!token) {
    console.log("no token");
    ws.close(1008, "Authentication token required");
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, decoded: any) => {
    if (err) {
      console.log("error", err);
      ws.close(1008, "Invalid or expired token");
      return;
    }

    const userId = decoded.userId;

    userMap.set(userId, ws);
    ws.send(
      JSON.stringify({
        type: "system",
        message: "Welcome!",
        username: userId,
      }),
    );
  });

  ws.on("message", async (data) => {
    const parseData = JSON.parse(data.toString());

    let userId: string | undefined;
    for (const [key, value] of userMap.entries()) {
      if (value === ws) {
        userId = key;
      }
    }

    if (!userId) {
      ws.send(
        JSON.stringify({
          type: "system",
          message: "You are not in the queue or not group admin",
        }),
      );
      return;
    }

    switch (parseData.type) {
      case "initialise":
        const admin = await prisma.admin.findFirst({
          where: {
            id: userId,
          },
        });
        if (!admin) {
          ws.send(
            JSON.stringify({
              type: "initialise",
              message: "User not found",
            }),
          );
          return;
        }

        // admin have to add hostelId and groups with it not hostelName
        groupQueue.set(parseData.hostel, parseData.groups);

        break;

      case "room-selected":
        //hostel
        //roomId
        //hostelId
        const hostelQueue = groupQueue.get(parseData.hostel);

        console.log(hostelQueue);
        console.log("flag 1");
        const isTurn = hostelQueue?.[0]?.members.find((e: any) => {
          if (e.studentId === userId && e.isGroupAdmin) {
            return true;
          }
        });

        console.log("isTurn: ", isTurn);
        if (!isTurn) {
          ws.send(
            JSON.stringify({
              type: "room-selected",
              message: "You are not in the queue or not group admin",
            }),
          );
          return;
        }

        const { roomId, hostelId } = parseData;

        const roomExists = await prisma.allottedRooms.findFirst({
          where: {
            roomId,
            hostelId,
          },
        });

        if (roomExists) {
          ws.send(
            JSON.stringify({
              type: "room-selected",
              message: "Room already allotted",
            }),
          );
          return;
        }

        for (const member of hostelQueue[0].members) {
          await prisma.allottedRooms.create({
            data: {
              hostelId,
              studentId: member.id,
              roomId,
            },
          });
        }

        ws.send(
          JSON.stringify({
            type: "room-selected",
            message: "Room selected",
            roomId,
            hostel: hostelId,
          }),
        );
        groupQueue.set(parseData.hostel, hostelQueue.slice(1));
        console.log(groupQueue.get("KBH"));
        break;

      default:
        break;
    }
  });

  ws.send("something");
  ws.on("error", console.error);
});
