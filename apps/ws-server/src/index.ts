import { prisma } from "@workspace/database/client";
import "dotenv/config";
import { type IncomingMessage } from "http";
import jwt from "jsonwebtoken";
import { WebSocket, WebSocketServer } from "ws";
import { Group } from "./types/types";

const wss = new WebSocketServer({ port: 8080 });

const GROUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 min

const groupQueue = new Map<string, Group[]>();
const viewersMap = new Map<string, Set<WebSocket>>();
let timer: NodeJS.Timeout | null;

function startTimer() {
  if (timer) {
    return;
  }

  timer = setInterval(() => {
    const now = Date.now();
    for (const [hostelId, queue] of groupQueue) {
      const currentGroup = queue[0];
      if (currentGroup) {
        if (!currentGroup.startTime) {
          currentGroup.startTime = now;
        }
        const elapsedTime = now - currentGroup.startTime;
        if (elapsedTime > GROUP_TIMEOUT_MS) {
          const newQueue = queue.slice(1);
          if (newQueue[0]) {
            newQueue[0].startTime = now;
          }
          groupQueue.set(hostelId, newQueue);
        }
      }
    }
    if ([...groupQueue.values()].every((e) => e.length === 0) && timer) {
      clearInterval(timer);
      timer = null;
    }
  }, 1000);
}

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

          ws.send(
            JSON.stringify({
              type: "initialise",
              message: "Queue initialised",
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

          if (!hostelQueue[0].startTime) {
            hostelQueue[0].startTime = Date.now();
          }

          const elapsedTime = Date.now() - hostelQueue[0].startTime;

          if (elapsedTime > GROUP_TIMEOUT_MS) {
            ws.send(
              JSON.stringify({
                type: "room-selected",
                message:
                  "Time expired: Your group has been removed from the queue",
              }),
            );
            return;
          }

          const { roomId, hostelId } = parseData;

          const roomAlloted = await prisma.allottedRooms.findFirst({
            where: {
              roomId,
              hostelId,
            },
          });

          if (roomAlloted) {
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
                institutionId: member.institutionId,
              },
            });
          }

          ws.send(
            JSON.stringify({
              type: "room-selected",
              message: "Room selected",
            }),
          );

          const newQueue = hostelQueue.slice(1);

          if (newQueue.length === 0) {
            groupQueue.delete(parseData.hostelId);
          } else if (newQueue[0]) {
            newQueue[0].startTime = Date.now();
            groupQueue.set(parseData.hostelId, newQueue);
          }

          const watchers = viewersMap.get(hostelId);
          if (watchers) {
            const payload = JSON.stringify({
              type: "update",
              message: "Room selected",
              // group: newQueue[0].members.map((m: any) => m.studentId),
            });

            for (const viewer of watchers) {
              viewer.send(payload);
            }
          }

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
              message: `Subscribed to hostel`,
            }),
          );
          break;

        case "unsubscribe":
          const { hostelId: unsubHostelId } = parseData;
          if (!unsubHostelId) {
            ws.send(
              JSON.stringify({
                type: "unsubscribe",
                message: "Hostel ID is required to unsubscribe",
              }),
            );
            return;
          }

          const viewers = viewersMap.get(unsubHostelId);
          if (viewers) {
            viewers.delete(ws);
            if (viewers.size === 0) {
              viewersMap.delete(unsubHostelId);
            }
          }

          ws.send(
            JSON.stringify({
              type: "unsubscribe",
              message: `Unsubscribed from hostel`,
            }),
          );
          break;

        case "start":
          startTimer();

          ws.send(
            JSON.stringify({
              type: "start",
              message: "Timer started",
            }),
          );

          break;

        case "stop":
          try {
            const admin = await prisma.admin.findFirst({
              where: {
                id: userId,
              },
            });

            if (!admin) {
              ws.send(
                JSON.stringify({
                  type: "stop",
                  message: "User not found",
                }),
              );
              return;
            }

            const hostel = await prisma.hostel.findFirst({
              where: {
                id: hostelId,
              },
            });

            if (!hostel) {
              ws.send(
                JSON.stringify({
                  type: "stop",
                  message: "Hostel not found",
                }),
              );
              return;
            }

            if (admin.institutionId !== hostel.institutionId) {
              ws.send(
                JSON.stringify({
                  type: "stop",
                  message: "You are not admin of this hostel",
                }),
              );
              return;
            }

            const queue = groupQueue.get(hostelId);
            if (!queue) {
              ws.send(
                JSON.stringify({
                  type: "stop",
                  message: "Queue not found",
                }),
              );
              return;
            }

            groupQueue.delete(hostelId);

            ws.send(
              JSON.stringify({
                type: "stop",
                message: "Allotment stopped",
              }),
            );
          } catch (error) {
            console.log(error);
          }

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
      for (const [key, viewers] of viewersMap.entries()) {
        viewers.delete(ws);
        if (viewers.size === 0) {
          viewersMap.delete(key);
        }
      }
    });
  });

  ws.on("error", console.error);
});
