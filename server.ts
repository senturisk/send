import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

interface PeerInfo {
  peerId: string;
  peerName: string;
  deviceType: "desktop" | "mobile" | "tablet";
  roomId: string;
  joinedAt: number;
  lastSeen: number;
  ping: number;
}

const app = express();
const PORT = 3000;

app.use(express.json());

// Enable CORS for peer discovery across dev/preview domains
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

// In-memory room state for PeerJS peer discovery
const rooms = new Map<string, Map<string, PeerInfo>>();

// Periodic cleanup of stale peers (inactive for > 25 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [roomId, room] of rooms.entries()) {
    for (const [peerId, peer] of room.entries()) {
      if (now - peer.lastSeen > 25000) {
        room.delete(peerId);
      }
    }
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
}, 8000);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    service: "Sen Send",
    developer: "Senturisk",
    engine: "PeerJS",
    timestamp: Date.now(),
  });
});

// Get room details and active peers
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

// Join room via HTTP (peers exchange standard PeerJS IDs)
app.post("/api/room/:roomId/join", (req, res) => {
  const { roomId } = req.params;
  const { peerId, peerName, deviceType } = req.body;
  if (!roomId || !peerId) {
    return res.status(400).json({ error: "Missing roomId or peerId" });
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  const room = rooms.get(roomId)!;

  const now = Date.now();
  const peerInfo: PeerInfo = {
    peerId,
    peerName: peerName || `Peer-${peerId.slice(0, 4)}`,
    deviceType: deviceType || "desktop",
    roomId,
    joinedAt: now,
    lastSeen: now,
    ping: 0,
  };
  room.set(peerId, peerInfo);

  // Return all other active peers in this room
  const otherPeers = Array.from(room.values())
    .filter((p) => p.peerId !== peerId)
    .map((p) => ({
      peerId: p.peerId,
      peerName: p.peerName,
      deviceType: p.deviceType,
      joinedAt: p.joinedAt,
      ping: p.ping,
    }));

  return res.json({
    success: true,
    roomId,
    peerId,
    peers: otherPeers,
  });
});

// Room heartbeat to maintain presence and discover newly joined peers
app.post("/api/room/:roomId/heartbeat", (req, res) => {
  const { roomId } = req.params;
  const { peerId, peerName, deviceType, ping } = req.body;
  if (!roomId || !peerId) {
    return res.status(400).json({ error: "Missing roomId or peerId" });
  }

  if (!rooms.has(roomId)) {
    rooms.set(roomId, new Map());
  }
  const room = rooms.get(roomId)!;

  const now = Date.now();
  let existing = room.get(peerId);
  if (existing) {
    existing.lastSeen = now;
    if (peerName) existing.peerName = peerName;
    if (deviceType) existing.deviceType = deviceType;
    if (typeof ping === "number") existing.ping = ping;
  } else {
    existing = {
      peerId,
      peerName: peerName || `Peer-${peerId.slice(0, 4)}`,
      deviceType: deviceType || "desktop",
      roomId,
      joinedAt: now,
      lastSeen: now,
      ping: ping || 0,
    };
    room.set(peerId, existing);
  }

  const otherPeers = Array.from(room.values())
    .filter((p) => p.peerId !== peerId)
    .map((p) => ({
      peerId: p.peerId,
      peerName: p.peerName,
      deviceType: p.deviceType,
      joinedAt: p.joinedAt,
      ping: p.ping,
    }));

  return res.json({
    success: true,
    peers: otherPeers,
  });
});

// Leave room
app.post("/api/room/:roomId/leave", (req, res) => {
  const { roomId } = req.params;
  const { peerId } = req.body;
  if (roomId && peerId && rooms.has(roomId)) {
    const room = rooms.get(roomId)!;
    room.delete(peerId);
    if (room.size === 0) {
      rooms.delete(roomId);
    }
  }
  return res.json({ success: true });
});

// Update peer name
app.post("/api/room/:roomId/update_name", (req, res) => {
  const { roomId } = req.params;
  const { peerId, peerName } = req.body;
  if (roomId && peerId && rooms.has(roomId)) {
    const room = rooms.get(roomId)!;
    const peer = room.get(peerId);
    if (peer) {
      peer.peerName = peerName;
      peer.lastSeen = Date.now();
    }
  }
  return res.json({ success: true });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Sen Send HTTP server running at http://0.0.0.0:${PORT}`);
  });
}

start();
