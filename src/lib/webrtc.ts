/**
 * WebRTC P2P Data Channel & Transfer Manager for Sen Send (Senturisk)
 * Default PeerJS architecture with zero custom ID systems and direct WebRTC channels
 */

import { Peer, DataConnection } from "peerjs";
import { FileMetadata, FileTransferProgress } from "../types";

export interface TransferCallbacks {
  onMyPeerId?: (peerId: string) => void;
  onPeerConnected?: (peerId: string, peerName?: string, deviceType?: any) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onPeerUpdated?: (peerId: string, peerName: string) => void;
  onPeerUnavailable?: (peerId: string) => void;
  onChatMessage?: (message: any) => void;
  onFileStart?: (fileMeta: FileMetadata) => void;
  onFileProgress?: (progress: FileTransferProgress) => void;
  onFileReceived?: (fileMeta: FileMetadata, blob: Blob) => void;
  onTyping?: (peerId: string, peerName: string, isTyping: boolean) => void;
  onError?: (errorTitle: string, errorDetail: string) => void;
  onPingUpdate?: (peerId: string, ping: number) => void;
}

const CHUNK_SIZE = 32768; // 32 KB chunk size for fast, smooth WebRTC streaming
const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:global.stun.twilio.com:3478" },
];

interface IncomingFileAssembly {
  meta: FileMetadata;
  chunks: (ArrayBuffer | null)[];
  receivedCount: number;
  startTime: number;
  lastUpdateTime: number;
  bytesReceived: number;
}

export class P2PConnectionManager {
  private peerId: string;
  private peerName: string;
  private roomId: string;

  private peer: Peer | null = null;
  private connections = new Map<string, DataConnection>();
  private peerMeta = new Map<
    string,
    { peerName: string; deviceType: "desktop" | "mobile" | "tablet" }
  >();

  private broadcastChannel: BroadcastChannel | null = null;
  private incomingFiles = new Map<string, IncomingFileAssembly>();
  private callbacks: TransferCallbacks = {};
  private heartbeatInterval: any = null;
  private pingInterval: any = null;
  private activeTransfers = new Map<string, FileTransferProgress>();
  private cancelledFiles = new Set<string>();
  private destroyed = false;

  constructor(
    initialPeerId: string,
    peerName: string,
    roomId: string,
    callbacks: TransferCallbacks
  ) {
    this.peerId = initialPeerId;
    this.peerName = peerName;
    this.roomId = roomId;
    this.callbacks = callbacks;

    // Local multi-tab / offline BroadcastChannel fallback
    try {
      this.broadcastChannel = new BroadcastChannel(`sensend_room_${roomId}`);
      this.broadcastChannel.onmessage = (event) => {
        this.handleBroadcastMessage(event.data);
      };
    } catch (e) {
      console.warn("BroadcastChannel not available:", e);
    }
  }

  public getPeerId(): string {
    return this.peerId;
  }

  public setCallbacks(callbacks: TransferCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  /**
   * Initialize default PeerJS (NO custom ID parameters - relies on PeerJS broker)
   */
  public connectSignaling(_wsUrl?: string) {
    if (this.destroyed || this.peer) return;

    try {
      // Default PeerJS initialization without custom ID parameter
      this.peer = new Peer({
        debug: 0,
        config: {
          iceServers: ICE_SERVERS,
        },
      });

      this.peer.on("open", (assignedId: string) => {
        this.peerId = assignedId;
        this.callbacks.onMyPeerId?.(assignedId);

        // If room code was specified and is another peer's ID, connect directly!
        if (this.roomId && this.roomId !== assignedId) {
          this.connectToPeer(this.roomId);
        }

        this.joinRoomPresence();
        this.startPresenceHeartbeat();
        this.startPingLoop();

        // Broadcast presence locally via BroadcastChannel
        this.broadcastLocal({
          type: "local_presence_join",
          peerId: this.peerId,
          peerName: this.peerName,
          deviceType: this.detectDeviceType(),
        });
      });

      // Handle incoming connections from any peer
      this.peer.on("connection", (conn: DataConnection) => {
        this.setupDataConnection(conn, conn.peer);
      });

      this.peer.on("error", (err: any) => {
        const errType = err?.type;
        const msg = String(err?.message || err || "");
        if (
          errType === "peer-unavailable" ||
          errType === "invalid-id" ||
          msg.includes("Could not connect to peer")
        ) {
          // Normal when a peer is offline or disconnected
          const target = (err as any)?.peer || this.roomId;
          this.callbacks.onPeerUnavailable?.(target);
          return;
        }
        console.warn("PeerJS notice:", errType || msg);
      });

      this.peer.on("disconnected", () => {
        if (!this.destroyed && this.peer) {
          try {
            this.peer.reconnect();
          } catch (e) {
            // silent reconnect attempt
          }
        }
      });
    } catch (err: any) {
      console.warn("PeerJS initialization error:", err);
    }
  }

  private detectDeviceType(): "desktop" | "mobile" | "tablet" {
    const isMobile = /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
    const isTablet = /(ipad|tablet|(android(?!.*mobile)))/i.test(navigator.userAgent);
    if (isTablet) return "tablet";
    if (isMobile) return "mobile";
    return "desktop";
  }

  /**
   * Connect to another peer directly using their default PeerJS ID
   */
  public connectToPeer(
    remotePeerId: string,
    remotePeerName?: string,
    remoteDeviceType?: any
  ) {
    if (!remotePeerId || remotePeerId === this.peerId || this.connections.has(remotePeerId)) {
      return;
    }
    if (!this.peer || this.peer.destroyed) {
      return;
    }

    try {
      // Default PeerJS connect with reliable data transfer
      const conn = this.peer.connect(remotePeerId, {
        reliable: true,
      });

      if (remotePeerName) {
        this.peerMeta.set(remotePeerId, {
          peerName: remotePeerName,
          deviceType: remoteDeviceType || "desktop",
        });
      }

      this.setupDataConnection(conn, remotePeerId, remotePeerName, remoteDeviceType);
    } catch (err) {
      console.warn("Error connecting to peer " + remotePeerId, err);
    }
  }

  /**
   * Attach lifecycle and data listeners to PeerJS DataConnection
   */
  private setupDataConnection(
    conn: DataConnection,
    remotePeerId?: string,
    expectedName?: string,
    expectedDevice?: any
  ) {
    let resolvedPeerId = remotePeerId || conn.peer;

    const onOpen = () => {
      // Send immediate handshake with our credentials
      conn.send({
        type: "handshake",
        peerId: this.peerId,
        peerName: this.peerName,
        deviceType: this.detectDeviceType(),
        roomId: this.roomId,
      });

      if (resolvedPeerId) {
        this.connections.set(resolvedPeerId, conn);
        const meta = this.peerMeta.get(resolvedPeerId);
        const name = meta?.peerName || expectedName || `Peer-${resolvedPeerId.slice(0, 4)}`;
        const dev = meta?.deviceType || expectedDevice || "desktop";
        this.callbacks.onPeerConnected?.(resolvedPeerId, name, dev);
      }
    };

    if (conn.open) {
      onOpen();
    } else {
      conn.on("open", onOpen);
    }

    conn.on("data", (data: any) => {
      this.handleIncomingData(data, conn, (id) => {
        resolvedPeerId = id;
      });
    });

    conn.on("close", () => {
      if (resolvedPeerId) {
        this.connections.delete(resolvedPeerId);
        this.peerMeta.delete(resolvedPeerId);
        this.callbacks.onPeerDisconnected?.(resolvedPeerId);
      }
    });

    conn.on("error", (err) => {
      console.warn("DataConnection error with " + resolvedPeerId, err);
      if (resolvedPeerId) {
        this.connections.delete(resolvedPeerId);
      }
    });
  }

  /**
   * Process all incoming data channel payloads
   */
  private handleIncomingData(
    data: any,
    conn: DataConnection,
    setResolvedPeerId: (id: string) => void
  ) {
    if (!data || typeof data !== "object") return;
    const type = data.type;

    if (type === "handshake") {
      const { peerId, peerName, deviceType } = data;
      if (!peerId || peerId === this.peerId) return;

      setResolvedPeerId(peerId);
      this.connections.set(peerId, conn);
      this.peerMeta.set(peerId, {
        peerName: peerName || `Peer-${peerId.slice(0, 4)}`,
        deviceType: deviceType || "desktop",
      });

      this.callbacks.onPeerConnected?.(
        peerId,
        peerName || `Peer-${peerId.slice(0, 4)}`,
        deviceType || "desktop"
      );

      // Share existing peers with newly connected peer for mesh connectivity
      const otherPeers = Array.from(this.peerMeta.entries())
        .filter(([id]) => id !== peerId && id !== this.peerId)
        .map(([id, m]) => ({ peerId: id, peerName: m.peerName, deviceType: m.deviceType }));
      if (otherPeers.length > 0) {
        try {
          conn.send({ type: "mesh_peer_list", peers: otherPeers });
        } catch (e) {}
      }
    } else if (type === "mesh_peer_list") {
      if (Array.isArray(data.peers)) {
        for (const p of data.peers) {
          if (p.peerId && p.peerId !== this.peerId && !this.connections.has(p.peerId)) {
            this.connectToPeer(p.peerId, p.peerName, p.deviceType);
          }
        }
      }
    } else if (type === "chat_message") {
      this.callbacks.onChatMessage?.(data.message);
    } else if (type === "typing") {
      this.callbacks.onTyping?.(data.peerId, data.peerName, data.isTyping);
    } else if (type === "peer_update") {
      if (this.peerMeta.has(data.peerId)) {
        const meta = this.peerMeta.get(data.peerId)!;
        meta.peerName = data.peerName;
      }
      this.callbacks.onPeerUpdated?.(data.peerId, data.peerName);
    } else if (type === "file_start") {
      this.handleIncomingFileStart(data.meta);
    } else if (type === "file_chunk") {
      this.handleIncomingChunk(
        data.fileId,
        data.chunkIndex,
        data.totalChunks,
        data.chunkData
      );
    } else if (type === "file_cancel") {
      this.cancelledFiles.add(data.fileId);
      this.incomingFiles.delete(data.fileId);
      const active = this.activeTransfers.get(data.fileId);
      if (active) {
        active.status = "cancelled";
        this.callbacks.onFileProgress?.({ ...active });
      }
    } else if (type === "ping") {
      conn.send({
        type: "pong",
        clientTimestamp: data.clientTimestamp,
      });
    } else if (type === "pong") {
      const rtt = Date.now() - (data.clientTimestamp || Date.now());
      for (const [pId, c] of this.connections.entries()) {
        if (c === conn) {
          this.callbacks.onPingUpdate?.(pId, Math.max(1, rtt));
          break;
        }
      }
    }
  }

  /**
   * HTTP Room Presence - Join room to exchange PeerJS IDs
   */
  private async joinRoomPresence() {
    if (!this.peerId) return;

    try {
      const res = await fetch(`/api/room/${encodeURIComponent(this.roomId)}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          peerId: this.peerId,
          peerName: this.peerName,
          deviceType: this.detectDeviceType(),
        }),
      });

      if (!res.ok) return;
      const data = await res.json();
      if (data.peers && Array.isArray(data.peers)) {
        for (const p of data.peers) {
          if (p.peerId !== this.peerId && !this.connections.has(p.peerId)) {
            this.connectToPeer(p.peerId, p.peerName, p.deviceType);
          }
        }
      }
    } catch (err) {
      console.warn("Room presence join notice:", err);
    }
  }

  /**
   * HTTP Room Presence - Periodic heartbeat & peer discovery
   */
  private startPresenceHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);

    this.heartbeatInterval = setInterval(async () => {
      if (this.destroyed || !this.peerId) return;
      try {
        const res = await fetch(
          `/api/room/${encodeURIComponent(this.roomId)}/heartbeat`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              peerId: this.peerId,
              peerName: this.peerName,
              deviceType: this.detectDeviceType(),
            }),
          }
        );

        if (!res.ok) return;
        const data = await res.json();
        if (data.peers && Array.isArray(data.peers)) {
          for (const p of data.peers) {
            if (p.peerId !== this.peerId && !this.connections.has(p.peerId)) {
              this.connectToPeer(p.peerId, p.peerName, p.deviceType);
            }
          }
        }
      } catch (err) {
        // silent heartbeat error
      }
    }, 4000);
  }

  /**
   * Ping loop for latency measurements
   */
  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);

    this.pingInterval = setInterval(() => {
      if (this.destroyed) return;
      const now = Date.now();
      for (const conn of this.connections.values()) {
        if (conn.open) {
          try {
            conn.send({ type: "ping", clientTimestamp: now });
          } catch (e) {
            // ignore
          }
        }
      }
    }, 5000);
  }

  /**
   * Local multi-tab message broadcast
   */
  private broadcastLocal(msg: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(msg);
      } catch (err) {
        console.warn("BroadcastChannel error:", err);
      }
    }
  }

  private handleBroadcastMessage(data: any) {
    if (!data || typeof data !== "object") return;
    const type = data.type;

    if (type === "local_presence_join") {
      if (data.peerId !== this.peerId && !this.connections.has(data.peerId)) {
        this.connectToPeer(data.peerId, data.peerName, data.deviceType);
      }
    } else if (type === "chat_message") {
      this.callbacks.onChatMessage?.(data.message);
    } else if (type === "typing") {
      this.callbacks.onTyping?.(data.peerId, data.peerName, data.isTyping);
    } else if (type === "file_start") {
      this.handleIncomingFileStart(data.meta);
    } else if (type === "file_chunk") {
      this.handleIncomingChunk(
        data.fileId,
        data.chunkIndex,
        data.totalChunks,
        data.chunkData
      );
    }
  }

  /**
   * File reception start
   */
  private handleIncomingFileStart(meta: FileMetadata) {
    if (this.cancelledFiles.has(meta.id)) return;

    this.incomingFiles.set(meta.id, {
      meta,
      chunks: new Array(meta.totalChunks).fill(null),
      receivedCount: 0,
      startTime: Date.now(),
      lastUpdateTime: Date.now(),
      bytesReceived: 0,
    });

    const progress: FileTransferProgress = {
      fileId: meta.id,
      name: meta.name,
      size: meta.size,
      extension: meta.extension,
      type: meta.type,
      direction: "download",
      status: "transferring",
      transferredBytes: 0,
      totalBytes: meta.size,
      chunksReceived: 0,
      totalChunks: meta.totalChunks,
      speedBps: 0,
      etaSeconds: 0,
      senderName: meta.senderName,
    };

    this.activeTransfers.set(meta.id, progress);
    this.callbacks.onFileStart?.(meta);
    this.callbacks.onFileProgress?.(progress);
  }

  /**
   * File chunk reception & reconstruction
   */
  private handleIncomingChunk(
    fileId: string,
    chunkIndex: number,
    totalChunks: number,
    chunkData: ArrayBuffer | string
  ) {
    if (this.cancelledFiles.has(fileId)) return;
    const assembly = this.incomingFiles.get(fileId);
    if (!assembly) return;

    let buffer: ArrayBuffer;
    if (typeof chunkData === "string") {
      const binaryString = atob(chunkData);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      buffer = bytes.buffer;
    } else {
      buffer = chunkData;
    }

    if (!assembly.chunks[chunkIndex]) {
      assembly.chunks[chunkIndex] = buffer;
      assembly.receivedCount++;
      assembly.bytesReceived += buffer.byteLength;
    }

    const now = Date.now();
    const elapsedSec = (now - assembly.startTime) / 1000;
    const speed = elapsedSec > 0 ? assembly.bytesReceived / elapsedSec : 0;
    const remainingBytes = assembly.meta.size - assembly.bytesReceived;
    const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

    const isDone = assembly.receivedCount >= totalChunks;

    const progress: FileTransferProgress = {
      fileId,
      name: assembly.meta.name,
      size: assembly.meta.size,
      extension: assembly.meta.extension,
      type: assembly.meta.type,
      direction: "download",
      status: isDone ? "completed" : "transferring",
      transferredBytes: assembly.bytesReceived,
      totalBytes: assembly.meta.size,
      chunksReceived: assembly.receivedCount,
      totalChunks,
      speedBps: speed,
      etaSeconds: eta,
      senderName: assembly.meta.senderName,
    };

    this.activeTransfers.set(fileId, progress);
    this.callbacks.onFileProgress?.({ ...progress });

    if (isDone) {
      const validChunks = assembly.chunks.filter(Boolean) as ArrayBuffer[];
      const blob = new Blob(validChunks, {
        type: assembly.meta.type || "application/octet-stream",
      });
      const blobUrl = URL.createObjectURL(blob);
      progress.blobUrl = blobUrl;
      this.callbacks.onFileReceived?.(assembly.meta, blob);
      this.incomingFiles.delete(fileId);
    }
  }

  /**
   * Broadcast a chat message
   */
  public sendChatMessage(message: any) {
    const payload = { type: "chat_message", message };
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          // ignore
        }
      }
    }
    this.broadcastLocal(payload);
  }

  /**
   * Broadcast typing state
   */
  public sendTyping(isTyping: boolean) {
    const payload = {
      type: "typing",
      roomId: this.roomId,
      peerId: this.peerId,
      peerName: this.peerName,
      isTyping,
    };
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          // ignore
        }
      }
    }
    this.broadcastLocal(payload);
  }

  /**
   * Send a file to all connected peers
   */
  public async sendFile(file: File): Promise<string> {
    const fileId =
      "file_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
    const ext = file.name.includes(".") ? file.name.split(".").pop() || "" : "";
    const totalChunks = Math.ceil(file.size / CHUNK_SIZE) || 1;

    const fileMeta: FileMetadata = {
      id: fileId,
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      extension: ext.toLowerCase(),
      totalChunks,
      chunkSize: CHUNK_SIZE,
      senderId: this.peerId,
      senderName: this.peerName,
      timestamp: Date.now(),
    };

    const progress: FileTransferProgress = {
      fileId,
      name: file.name,
      size: file.size,
      extension: ext.toLowerCase(),
      type: file.type || "application/octet-stream",
      direction: "upload",
      status: "transferring",
      transferredBytes: 0,
      totalBytes: file.size,
      chunksReceived: 0,
      totalChunks,
      speedBps: 0,
      etaSeconds: 0,
      senderName: this.peerName,
    };

    this.activeTransfers.set(fileId, progress);
    this.callbacks.onFileStart?.(fileMeta);
    this.callbacks.onFileProgress?.(progress);

    // Send file start header to all peers
    const startPayload = { type: "file_start", meta: fileMeta };
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(startPayload);
        } catch (e) {
          // ignore
        }
      }
    }
    this.broadcastLocal(startPayload);

    // Stream file chunks asynchronously
    (async () => {
      const startTime = Date.now();
      let bytesSent = 0;

      for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
        if (this.cancelledFiles.has(fileId)) {
          progress.status = "cancelled";
          this.callbacks.onFileProgress?.({ ...progress });
          return;
        }

        const start = chunkIndex * CHUNK_SIZE;
        const end = Math.min(file.size, start + CHUNK_SIZE);
        const slice = file.slice(start, end);
        const arrayBuffer = await slice.arrayBuffer();

        const chunkPayload = {
          type: "file_chunk",
          fileId,
          chunkIndex,
          totalChunks,
          chunkData: arrayBuffer,
        };

        for (const conn of this.connections.values()) {
          if (conn.open) {
            try {
              conn.send(chunkPayload);
            } catch (e) {
              // ignore
            }
          }
        }
        this.broadcastLocal(chunkPayload);

        bytesSent += arrayBuffer.byteLength;
        const elapsedSec = (Date.now() - startTime) / 1000;
        const speed = elapsedSec > 0 ? bytesSent / elapsedSec : 0;
        const remaining = file.size - bytesSent;
        const eta = speed > 0 ? Math.ceil(remaining / speed) : 0;

        progress.transferredBytes = bytesSent;
        progress.chunksReceived = chunkIndex + 1;
        progress.speedBps = speed;
        progress.etaSeconds = eta;
        progress.status = chunkIndex + 1 >= totalChunks ? "completed" : "transferring";

        this.callbacks.onFileProgress?.({ ...progress });

        // Yield slightly for high-framerate UI responsiveness
        if (chunkIndex % 8 === 0) {
          await new Promise((resolve) => setTimeout(resolve, 8));
        }
      }
    })();

    return fileId;
  }

  /**
   * Cancel an ongoing transfer
   */
  public cancelTransfer(fileId: string) {
    this.cancelledFiles.add(fileId);
    this.incomingFiles.delete(fileId);
    const p = this.activeTransfers.get(fileId);
    if (p) {
      p.status = "cancelled";
      this.callbacks.onFileProgress?.({ ...p });
    }
    const cancelPayload = { type: "file_cancel", fileId };
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(cancelPayload);
        } catch (e) {
          // ignore
        }
      }
    }
    this.broadcastLocal(cancelPayload);
  }

  /**
   * Update local peer name
   */
  public updatePeerName(newName: string) {
    this.peerName = newName;
    const payload = {
      type: "peer_update",
      peerId: this.peerId,
      peerName: newName,
    };
    for (const conn of this.connections.values()) {
      if (conn.open) {
        try {
          conn.send(payload);
        } catch (e) {
          // ignore
        }
      }
    }
    this.broadcastLocal(payload);

    fetch(`/api/room/${encodeURIComponent(this.roomId)}/update_name`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ peerId: this.peerId, peerName: newName }),
    }).catch(() => {});
  }

  /**
   * Pair phone bridge
   */
  public pairPhoneBridge(desktop1PeerId: string, desktop2PeerId: string, _targetRoomId: string) {
    const d1Conn = this.connections.get(desktop1PeerId);
    const d2Conn = this.connections.get(desktop2PeerId);

    if (d1Conn?.open) {
      d1Conn.send({
        type: "phone_bridge_connect",
        targetPeerId: desktop2PeerId,
        initiator: true,
      });
    }
    if (d2Conn?.open) {
      d2Conn.send({
        type: "phone_bridge_connect",
        targetPeerId: desktop1PeerId,
        initiator: false,
      });
    }
  }

  /**
   * Clean up all network resources
   */
  public destroy() {
    this.destroyed = true;

    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.pingInterval) clearInterval(this.pingInterval);

    // Notify room server of departure
    if (this.peerId) {
      fetch(`/api/room/${encodeURIComponent(this.roomId)}/leave`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ peerId: this.peerId }),
      }).catch(() => {});
    }

    // Close all PeerJS connections
    for (const conn of this.connections.values()) {
      try {
        conn.close();
      } catch (e) {
        // ignore
      }
    }
    this.connections.clear();

    if (this.peer) {
      try {
        this.peer.destroy();
      } catch (e) {
        // ignore
      }
      this.peer = null;
    }

    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (e) {
        // ignore
      }
      this.broadcastChannel = null;
    }
  }
}
