import express from "express";
import http from "http";
import path from "path";
import { WebSocketServer, WebSocket } from "ws";
import { createServer as createViteServer } from "vite";

interface PeerInfo {
  ws: WebSocket;
  peerId: string;
  peerName: string;
  deviceType: "desktop" | "mobile" | "tablet";
  roomId: string;
  joinedAt: number;
  ping: number;
}

const app = express();
const PORT = 3000;
const server = http.createServer(app);

app.use(express.json());

// In-memory room state
const rooms = new Map<string, Map<string, PeerInfo>>();

// API routes
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Sen Send",
    developer: "Senturisk",
    timestamp: Date.now(),
  });
});

app.get("/api/room/:roomId", (req, res) => {
  const { roomId } = req.params;
  const room = rooms.get(roomId);
  if (!room) {
    return res.json({ exists: false, peerCount: 0, peers: [] });
  }

  const peers = Array.from(room.values()).map((p) => ({
    peerId: p.peerId,
    peerName: p.peerName,
    deviceType: p.deviceType,
    joinedAt: p.joinedAt,
    ping: p.ping,
  }));

  return res.json({
    exists: true,
    peerCount: peers.length,
    peers,
  });
});

// WebSocket signaling server
const wss = new WebSocketServer({ server, path: "/ws" });

function broadcastToRoom(
  roomId: string,
  message: any,
  excludePeerId?: string
) {
  const room = rooms.get(roomId);
  if (!room) return;

  const payload = JSON.stringify(message);
  for (const [peerId, peer] of room.entries()) {
    if (peerId !== excludePeerId && peer.ws.readyState === WebSocket.OPEN) {
      peer.ws.send(payload);
    }
  }
}

wss.on("connection", (ws: WebSocket) => {
  let currentPeerId = "";
  let currentRoomId = "";

  ws.on("message", (rawData: string) => {
    try {
      const data = JSON.parse(rawData.toString());
      const type = data.type;

      if (type === "join") {
        const { roomId, peerId, peerName, deviceType } = data;
        if (!roomId || !peerId) return;

        currentPeerId = peerId;
        currentRoomId = roomId;

        if (!rooms.has(roomId)) {
          rooms.set(roomId, new Map());
        }
        const room = rooms.get(roomId)!;

        // Store peer info
        const peerInfo: PeerInfo = {
          ws,
          peerId,
          peerName: peerName || `Peer-${peerId.slice(0, 4)}`,
          deviceType: deviceType || "desktop",
          roomId,
          joinedAt: Date.now(),
          ping: 0,
        };
        room.set(peerId, peerInfo);

        // Send back list of existing peers in the room
        const existingPeers = Array.from(room.values())
          .filter((p) => p.peerId !== peerId)
          .map((p) => ({
            peerId: p.peerId,
            peerName: p.peerName,
            deviceType: p.deviceType,
            joinedAt: p.joinedAt,
            ping: p.ping,
          }));

        ws.send(
          JSON.stringify({
            type: "room_joined",
            roomId,
            yourPeerId: peerId,
            peers: existingPeers,
          })
        );

        // Notify others in room
        broadcastToRoom(
          roomId,
          {
            type: "user_joined",
            peerId,
            peerName: peerInfo.peerName,
            deviceType: peerInfo.deviceType,
            joinedAt: peerInfo.joinedAt,
          },
          peerId
        );
      } else if (type === "signal") {
        // Direct WebRTC SDP/ICE signaling
        const { targetPeerId, signalData } = data;
        const room = rooms.get(currentRoomId);
        if (room && room.has(targetPeerId)) {
          const target = room.get(targetPeerId)!;
          if (target.ws.readyState === WebSocket.OPEN) {
            target.ws.send(
              JSON.stringify({
                type: "signal",
                senderPeerId: currentPeerId,
                signalData,
              })
            );
          }
        }
      } else if (type === "chat_message") {
        const { message } = data;
        broadcastToRoom(currentRoomId, {
          type: "chat_message",
          message,
        });
      } else if (type === "typing") {
        const { isTyping, peerName } = data;
        broadcastToRoom(
          currentRoomId,
          {
            type: "typing",
            peerId: currentPeerId,
            peerName: peerName || "Someone",
            isTyping,
          },
          currentPeerId
        );
      } else if (type === "update_name") {
        const { peerName } = data;
        const room = rooms.get(currentRoomId);
        if (room && room.has(currentPeerId)) {
          const p = room.get(currentPeerId)!;
          p.peerName = peerName || p.peerName;
          broadcastToRoom(currentRoomId, {
            type: "peer_updated",
            peerId: currentPeerId,
            peerName: p.peerName,
          });
        }
      } else if (type === "file_meta") {
        // File announcement for transfer
        const { fileMeta } = data;
        broadcastToRoom(
          currentRoomId,
          {
            type: "file_meta",
            fileMeta,
            senderPeerId: currentPeerId,
          },
          currentPeerId
        );
      } else if (type === "file_chunk_relay") {
        // Fallback relay if WebRTC direct channel is unavailable
        const { targetPeerId, fileId, chunkIndex, totalChunks, chunkData } = data;
        const room = rooms.get(currentRoomId);
        if (room) {
          if (targetPeerId) {
            const target = room.get(targetPeerId);
            if (target && target.ws.readyState === WebSocket.OPEN) {
              target.ws.send(
                JSON.stringify({
                  type: "file_chunk_relay",
                  senderPeerId: currentPeerId,
                  fileId,
                  chunkIndex,
                  totalChunks,
                  chunkData,
                })
              );
            }
          } else {
            // Broadcast chunk to room (excluding sender)
            broadcastToRoom(
              currentRoomId,
              {
                type: "file_chunk_relay",
                senderPeerId: currentPeerId,
                fileId,
                chunkIndex,
                totalChunks,
                chunkData,
              },
              currentPeerId
            );
          }
        }
      } else if (type === "file_progress_update") {
        const { fileId, progress, speed, transferredBytes, status } = data;
        broadcastToRoom(
          currentRoomId,
          {
            type: "file_progress_update",
            fileId,
            progress,
            speed,
            transferredBytes,
            status,
            senderPeerId: currentPeerId,
          },
          currentPeerId
        );
      } else if (type === "ping") {
        // Heartbeat / ping measurement
        const clientTimestamp = data.clientTimestamp || Date.now();
        ws.send(
          JSON.stringify({
            type: "pong",
            clientTimestamp,
            serverTimestamp: Date.now(),
          })
        );
      } else if (type === "update_ping") {
        // Peer reports their measured RTT
        const room = rooms.get(currentRoomId);
        if (room && room.has(currentPeerId)) {
          const peer = room.get(currentPeerId)!;
          peer.ping = data.ping || 0;
          broadcastToRoom(
            currentRoomId,
            {
              type: "peer_ping_update",
              peerId: currentPeerId,
              ping: peer.ping,
            },
            currentPeerId
          );
        }
      } else if (type === "phone_bridge_pair") {
        // Phone acts as bridge between Desktop 1 and Desktop 2
        const { desktop1PeerId, desktop2PeerId, targetRoomId } = data;
        const room = rooms.get(currentRoomId);
        if (room) {
          const d1 = room.get(desktop1PeerId);
          const d2 = room.get(desktop2PeerId);
          if (d1 && d1.ws.readyState === WebSocket.OPEN) {
            d1.ws.send(
              JSON.stringify({
                type: "phone_bridge_connect",
                targetPeerId: desktop2PeerId,
                bridgeRoomId: targetRoomId || currentRoomId,
                initiator: true,
              })
            );
          }
          if (d2 && d2.ws.readyState === WebSocket.OPEN) {
            d2.ws.send(
              JSON.stringify({
                type: "phone_bridge_connect",
                targetPeerId: desktop1PeerId,
                bridgeRoomId: targetRoomId || currentRoomId,
                initiator: false,
              })
            );
          }
        }
      }
    } catch (err) {
      console.error("WS message error:", err);
    }
  });

  ws.on("close", () => {
    if (currentRoomId && currentPeerId) {
      const room = rooms.get(currentRoomId);
      if (room && room.has(currentPeerId)) {
        const peer = room.get(currentPeerId)!;
        room.delete(currentPeerId);

        broadcastToRoom(currentRoomId, {
          type: "user_left",
          peerId: currentPeerId,
          peerName: peer.peerName,
        });

        if (room.size === 0) {
          rooms.delete(currentRoomId);
        }
      }
    }
  });
});

// Vite middleware configuration
async function start() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Sen Send server running at http://0.0.0.0:${PORT}`);
  });
}

start();
