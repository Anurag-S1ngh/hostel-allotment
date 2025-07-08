import { prisma } from "@workspace/database/client";
import "dotenv/config";
import { type IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";

const wss = new WebSocketServer({ port: 8080 });

const userMap = new Map<string, WebSocket>();
const groupQueue = new Map<string, any>();
const viewersMap = new Map<string, Set<WebSocket>>();

wss.on("connection", (ws: WebSocket, req: IncomingMessage) => {
  if (!req.url) {
    console.log("no url");
    ws.close();
    return;
  }

  const token = req.url.split("token=")[1];
  if (!token) {
    console.log("no token");
    ws.close();
    return;
  }

  jwt.verify(token, process.env.JWT_SECRET!, (err: any, decoded: any) => {
    if (err) {
      console.log("error", err);
      ws.close();
      return;
    }

    if (!decoded?.userId) {
      ws.close();
      return;
    }

    const userId = decoded.userId;

    userMap.set(userId, ws);

    ws.on("message", async (data) => {
      let parseData;
      try {
        parseData = JSON.parse(data.toString());
      } catch (error) {
        console.log(error);
        ws.send(
          JSON.stringify({
            type: "system",
            message: "Invalid data",
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
          groupQueue.set(
            parseData.hostelId,
            parseData.groups.map((e: any, index: number) => {
              return {
                startTime: index == 0 ? Date.now() : null,
                members: e.members,
              };
            }),
          );

          break;

        case "room-selected":
          const hostelQueue = groupQueue.get(parseData.hostelId);

          if (!hostelQueue || !hostelQueue[0]) {
            ws.send(
              JSON.stringify({
                type: "room-selected",
                message: "Queue not found",
              }),
            );
            return;
          }

          console.log(hostelQueue);

          const currentGroup = hostelQueue[0];
          const elapsedTime = Date.now() - currentGroup.startTime;

          console.log("elapsedTime: ", elapsedTime);

          let canSelect = false;

          if (elapsedTime <= 2 * 60 * 1000) {
            canSelect = currentGroup.members.some(
              (e: any) => e.studentId === userId && e.isGroupAdmin,
            );
          } else if (elapsedTime <= 4 * 60 * 1000) {
            canSelect = currentGroup.members.some(
              (e: any) => e.studentId === userId,
            );
          } else {
            const newQueue = hostelQueue.slice(1);
            if (newQueue[0]) {
              newQueue[0].startTime = Date.now();
            }
            groupQueue.set(parseData.hostelId, newQueue);
            ws.send(
              JSON.stringify({
                type: "room-selected",
                message:
                  "Time expired: Your group has been removed from the queue",
              }),
            );
            return;
          }

          console.log("isTurn: ", canSelect);
          if (!canSelect) {
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

          const watchers = viewersMap.get(hostelId);
          if (watchers) {
            const payload = JSON.stringify({
              type: "update",
              message: "Room selected",
              roomId,
              hostelId,
              group: hostelQueue[0].members.map((m: any) => m.studentId),
            });

            for (const viewer of watchers) {
              if (viewer.readyState === WebSocket.OPEN) {
                viewer.send(payload);
              }
            }
          }

          const newQueue = hostelQueue.slice(1);
          if (newQueue[0]) {
            newQueue[0].startTime = Date.now();
          }
          groupQueue.set(parseData.hostelId, newQueue);
          break;

        case "subscribe":
          const { hostelId: subHostelId } = parseData;
          if (!subHostelId) {
            ws.send(
              JSON.stringify({
                type: "subscribe",
                message: "Hostel ID is required to subscribe",
              }),
            );
            return;
          }

          if (!viewersMap.has(subHostelId)) {
            viewersMap.set(subHostelId, new Set());
          }
          viewersMap.get(subHostelId)!.add(ws);

          ws.send(
            JSON.stringify({
              type: "subscribe",
              message: `Subscribed to hostel ${subHostelId}`,
            }),
          );
          break;
        default:
          ws.send(
            JSON.stringify({
              type: "error",
              message: "Unknown message type",
            }),
          );
          break;
      }
    });

    ws.on("close", () => {
      userMap.delete(userId);

      for (const viewers of viewersMap.values()) {
        viewers.delete(ws);
      }
    });
  });

  ws.on("error", console.error);
});
