/**
 * WebRTC P2P Data Channel & Transfer Manager for Sen Send (Senturisk)
 * Handles STUN negotiation, RTCDataChannel chunk streaming, fallback relay, and BroadcastChannel
 */

import { FileMetadata, FileTransferProgress } from "../types";

export interface TransferCallbacks {
  onPeerConnected?: (peerId: string, peerName?: string, deviceType?: any) => void;
  onPeerDisconnected?: (peerId: string) => void;
  onPeerUpdated?: (peerId: string, peerName: string) => void;
  onChatMessage?: (message: any) => void;
  onFileStart?: (fileMeta: FileMetadata) => void;
  onFileProgress?: (progress: FileTransferProgress) => void;
  onFileReceived?: (fileMeta: FileMetadata, blob: Blob) => void;
  onTyping?: (peerId: string, peerName: string, isTyping: boolean) => void;
  onError?: (errorTitle: string, errorDetail: string) => void;
  onPingUpdate?: (peerId: string, ping: number) => void;
}

const CHUNK_SIZE = 16384; // 16 KB chunk size for smooth WebRTC data channel transfer
const ICE_SERVERS: RTCConfiguration = {
  iceServers: [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
  ],
};

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
  private ws: WebSocket | null = null;
  private peerConnections = new Map<string, RTCPeerConnection>();
  private dataChannels = new Map<string, RTCDataChannel>();
  private broadcastChannel: BroadcastChannel | null = null;
  private incomingFiles = new Map<string, IncomingFileAssembly>();
  private callbacks: TransferCallbacks = {};
  private pingInterval: any = null;
  private activeTransfers = new Map<string, FileTransferProgress>();

  constructor(
    peerId: string,
    peerName: string,
    roomId: string,
    callbacks: TransferCallbacks
  ) {
    this.peerId = peerId;
    this.peerName = peerName;
    this.roomId = roomId;
    this.callbacks = callbacks;

    // Local multi-tab / offline BroadcastChannel
    try {
      this.broadcastChannel = new BroadcastChannel(`sensend_room_${roomId}`);
      this.broadcastChannel.onmessage = (event) => {
        this.handleBroadcastMessage(event.data);
      };
    } catch (e) {
      console.warn("BroadcastChannel not available:", e);
    }
  }

  public setCallbacks(callbacks: TransferCallbacks) {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public connectSignaling(wsUrl?: string) {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const url = wsUrl || `${protocol}//${window.location.host}/ws`;

    try {
      this.ws = new WebSocket(url);

      this.ws.onopen = () => {
        // Send join room message
        this.sendSignal({
          type: "join",
          roomId: this.roomId,
          peerId: this.peerId,
          peerName: this.peerName,
          deviceType: this.detectDeviceType(),
        });

        // Start ping loop
        this.startPingLoop();
      };

      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          this.handleSignalMessage(data);
        } catch (err) {
          console.error("Signal parse error:", err);
        }
      };

      this.ws.onerror = (err) => {
        console.warn("WebSocket signaling error:", err);
        this.callbacks.onError?.(
          "Signaling Connection Issue",
          "WebSocket signaling encountered a temporary error. Running in resilient mode."
        );
      };

      this.ws.onclose = () => {
        // Broadcast local presence for offline / LAN
        this.broadcastLocal({
          type: "user_left",
          peerId: this.peerId,
          peerName: this.peerName,
        });
      };
    } catch (err: any) {
      console.warn("WebSocket initiation failed, falling back to local BroadcastChannel:", err);
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

  private sendSignal(msg: any) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  private broadcastLocal(msg: any) {
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage({ ...msg, senderPeerId: this.peerId });
      } catch (e) {
        // Ignore broadcast errors
      }
    }
  }

  private handleBroadcastMessage(data: any) {
    if (!data || data.senderPeerId === this.peerId) return;

    if (data.type === "chat_message") {
      this.callbacks.onChatMessage?.(data.message);
    } else if (data.type === "typing") {
      this.callbacks.onTyping?.(data.peerId, data.peerName, data.isTyping);
    } else if (data.type === "file_meta") {
      this.handleIncomingFileMeta(data.fileMeta);
    } else if (data.type === "file_chunk_relay") {
      this.handleIncomingChunk(
        data.fileId,
        data.chunkIndex,
        data.totalChunks,
        data.chunkData
      );
    }
  }

  private handleSignalMessage(data: any) {
    const type = data.type;

    if (type === "room_joined") {
      // Connect to existing peers
      const existingPeers: Array<{ peerId: string; peerName: string; deviceType?: any }> = data.peers || [];
      existingPeers.forEach((peer) => {
        this.initiatePeerConnection(peer.peerId, true);
        this.callbacks.onPeerConnected?.(peer.peerId, peer.peerName, peer.deviceType);
      });
    } else if (type === "user_joined") {
      const { peerId, peerName, deviceType } = data;
      this.initiatePeerConnection(peerId, false);
      this.callbacks.onPeerConnected?.(peerId, peerName, deviceType);
    } else if (type === "peer_updated") {
      const { peerId, peerName } = data;
      this.callbacks.onPeerUpdated?.(peerId, peerName);
    } else if (type === "user_left") {
      const { peerId } = data;
      this.cleanupPeer(peerId);
      this.callbacks.onPeerDisconnected?.(peerId);
    } else if (type === "signal") {
      const { senderPeerId, signalData } = data;
      this.handleIncomingSignal(senderPeerId, signalData);
    } else if (type === "chat_message") {
      this.callbacks.onChatMessage?.(data.message);
    } else if (type === "typing") {
      this.callbacks.onTyping?.(data.peerId, data.peerName, data.isTyping);
    } else if (type === "file_meta") {
      this.handleIncomingFileMeta(data.fileMeta);
    } else if (type === "file_chunk_relay") {
      this.handleIncomingChunk(
        data.fileId,
        data.chunkIndex,
        data.totalChunks,
        data.chunkData
      );
    } else if (type === "pong") {
      const rtt = Date.now() - data.clientTimestamp;
      this.callbacks.onPingUpdate?.("server", Math.max(1, rtt));
      this.sendSignal({ type: "update_ping", ping: rtt });
    } else if (type === "peer_ping_update") {
      this.callbacks.onPingUpdate?.(data.peerId, data.ping);
    }
  }

  private initiatePeerConnection(targetPeerId: string, isInitiator: boolean) {
    if (this.peerConnections.has(targetPeerId)) {
      return;
    }

    try {
      const pc = new RTCPeerConnection(ICE_SERVERS);
      this.peerConnections.set(targetPeerId, pc);

      pc.onicecandidate = (event) => {
        if (event.candidate) {
          this.sendSignal({
            type: "signal",
            targetPeerId,
            signalData: { candidate: event.candidate },
          });
        }
      };

      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          this.callbacks.onPeerConnected?.(targetPeerId);
        } else if (
          pc.connectionState === "disconnected" ||
          pc.connectionState === "failed" ||
          pc.connectionState === "closed"
        ) {
          this.callbacks.onPeerDisconnected?.(targetPeerId);
        }
      };

      if (isInitiator) {
        // Create Data Channel
        const dc = pc.createDataChannel("sensend_transfer", {
          ordered: true,
        });
        this.setupDataChannel(targetPeerId, dc);

        pc.createOffer()
          .then((offer) => pc.setLocalDescription(offer))
          .then(() => {
            this.sendSignal({
              type: "signal",
              targetPeerId,
              signalData: { sdp: pc.localDescription },
            });
          })
          .catch((err) => {
            console.warn("Error creating WebRTC offer:", err);
          });
      } else {
        pc.ondatachannel = (event) => {
          this.setupDataChannel(targetPeerId, event.channel);
        };
      }
    } catch (err) {
      console.warn("RTCPeerConnection creation failed:", err);
    }
  }

  private handleIncomingSignal(senderPeerId: string, signalData: any) {
    let pc = this.peerConnections.get(senderPeerId);
    if (!pc) {
      this.initiatePeerConnection(senderPeerId, false);
      pc = this.peerConnections.get(senderPeerId);
    }
    if (!pc) return;

    if (signalData.sdp) {
      pc.setRemoteDescription(new RTCSessionDescription(signalData.sdp))
        .then(() => {
          if (signalData.sdp.type === "offer") {
            return pc!.createAnswer().then((answer) => {
              return pc!.setLocalDescription(answer).then(() => {
                this.sendSignal({
                  type: "signal",
                  targetPeerId: senderPeerId,
                  signalData: { sdp: pc!.localDescription },
                });
              });
            });
          }
        })
        .catch((err) => {
          console.warn("Error setting remote SDP description:", err);
        });
    } else if (signalData.candidate) {
      pc.addIceCandidate(new RTCIceCandidate(signalData.candidate)).catch((err) => {
        console.warn("Error adding ICE candidate:", err);
      });
    }
  }

  private setupDataChannel(peerId: string, dc: RTCDataChannel) {
    dc.binaryType = "arraybuffer";
    this.dataChannels.set(peerId, dc);

    dc.onopen = () => {
      this.callbacks.onPeerConnected?.(peerId);
    };

    dc.onclose = () => {
      this.dataChannels.delete(peerId);
    };

    dc.onerror = (err) => {
      console.warn(`DataChannel error with peer ${peerId}:`, err);
    };

    dc.onmessage = (event) => {
      if (typeof event.data === "string") {
        try {
          const parsed = JSON.parse(event.data);
          if (parsed.type === "chat_message") {
            this.callbacks.onChatMessage?.(parsed.message);
          } else if (parsed.type === "file_meta") {
            this.handleIncomingFileMeta(parsed.fileMeta);
          } else if (parsed.type === "typing") {
            this.callbacks.onTyping?.(parsed.peerId, parsed.peerName, parsed.isTyping);
          } else if (parsed.type === "ping") {
            dc.send(JSON.stringify({ type: "pong", ts: parsed.ts }));
          } else if (parsed.type === "pong") {
            const rtt = Date.now() - parsed.ts;
            this.callbacks.onPingUpdate?.(peerId, Math.max(1, rtt));
          }
        } catch (e) {
          console.error("DC message JSON parse error:", e);
        }
      } else if (event.data instanceof ArrayBuffer) {
        // Binary chunk with header:
        // First 36 bytes: File ID (fixed length string padded/utf8)
        // Next 4 bytes: Chunk index (Uint32)
        // Next 4 bytes: Total chunks (Uint32)
        // Remainder: Payload
        this.parseBinaryChunk(event.data);
      }
    };
  }

  private parseBinaryChunk(buffer: ArrayBuffer) {
    if (buffer.byteLength < 44) return;
    const view = new DataView(buffer);
    const decoder = new TextDecoder();

    const fileId = decoder.decode(new Uint8Array(buffer, 0, 36)).trim();
    const chunkIndex = view.getUint32(36, false);
    const totalChunks = view.getUint32(40, false);
    const chunkData = buffer.slice(44);

    this.handleIncomingChunk(fileId, chunkIndex, totalChunks, chunkData);
  }

  private handleIncomingFileMeta(meta: FileMetadata) {
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

  private handleIncomingChunk(
    fileId: string,
    chunkIndex: number,
    totalChunks: number,
    chunkData: ArrayBuffer | string
  ) {
    let assembly = this.incomingFiles.get(fileId);
    if (!assembly) return;

    let buffer: ArrayBuffer;
    if (typeof chunkData === "string") {
      // base64 decoded if relayed via json
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

    const progress: FileTransferProgress = {
      fileId,
      name: assembly.meta.name,
      size: assembly.meta.size,
      extension: assembly.meta.extension,
      type: assembly.meta.type,
      direction: "download",
      status: assembly.receivedCount >= totalChunks ? "completed" : "transferring",
      transferredBytes: assembly.bytesReceived,
      totalBytes: assembly.meta.size,
      chunksReceived: assembly.receivedCount,
      totalChunks,
      speedBps: speed,
      etaSeconds: eta,
      senderName: assembly.meta.senderName,
    };

    this.activeTransfers.set(fileId, progress);
    this.callbacks.onFileProgress?.(progress);

    if (assembly.receivedCount >= totalChunks) {
      // Assemble full Blob
      const validChunks = assembly.chunks.filter(Boolean) as ArrayBuffer[];
      const blob = new Blob(validChunks, { type: assembly.meta.type || "application/octet-stream" });
      const blobUrl = URL.createObjectURL(blob);
      progress.blobUrl = blobUrl;
      this.callbacks.onFileReceived?.(assembly.meta, blob);
      this.incomingFiles.delete(fileId);
    }
  }

  /**
   * Broadcast a chat message to all connected peers
   */
  public sendChatMessage(message: any) {
    const payload = JSON.stringify({ type: "chat_message", message });

    // Send via WebRTC data channels
    let sentP2P = false;
    for (const dc of this.dataChannels.values()) {
      if (dc.readyState === "open") {
        dc.send(payload);
        sentP2P = true;
      }
    }

    // Also send via WebSocket signaling for full room broadcast
    this.sendSignal({ type: "chat_message", message });

    // Broadcast channel for local tabs
    this.broadcastLocal({ type: "chat_message", message });
  }

  /**
   * Send typing indicator
   */
  public sendTyping(isTyping: boolean) {
    const payload = {
      type: "typing",
      roomId: this.roomId,
      peerId: this.peerId,
      peerName: this.peerName,
      isTyping,
    };
    this.sendSignal(payload);
    this.broadcastLocal(payload);
  }

  /**
   * Send a file to peers in the room
   */
  public async sendFile(file: File): Promise<string> {
    const fileId = "file_" + Math.random().toString(36).substring(2, 10) + "_" + Date.now();
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

    // Track upload progress locally
    const progress: FileTransferProgress = {
      fileId,
      name: file.name,
      size: file.size,
      extension: ext,
      type: file.type,
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

    // Announce file metadata to room
    const metaPayload = JSON.stringify({ type: "file_meta", fileMeta });
    for (const dc of this.dataChannels.values()) {
      if (dc.readyState === "open") {
        dc.send(metaPayload);
      }
    }
    this.sendSignal({ type: "file_meta", fileMeta });
    this.broadcastLocal({ type: "file_meta", fileMeta });

    // Stream file chunks asynchronously
    this.streamFileChunks(file, fileMeta);

    return fileId;
  }

  private async streamFileChunks(file: File, meta: FileMetadata) {
    const startTime = Date.now();
    let transferred = 0;
    const encoder = new TextEncoder();
    const paddedFileId = meta.id.padEnd(36, " ").slice(0, 36);
    const fileIdBytes = encoder.encode(paddedFileId);

    const hasOpenDataChannel = Array.from(this.dataChannels.values()).some(
      (dc) => dc.readyState === "open"
    );

    for (let chunkIndex = 0; chunkIndex < meta.totalChunks; chunkIndex++) {
      const start = chunkIndex * CHUNK_SIZE;
      const end = Math.min(start + CHUNK_SIZE, file.size);
      const blobSlice = file.slice(start, end);
      const arrayBuffer = await blobSlice.arrayBuffer();

      // Check if transfer was cancelled
      const current = this.activeTransfers.get(meta.id);
      if (!current || current.status === "cancelled") {
        break;
      }

      if (hasOpenDataChannel) {
        // Build binary frame: [36 bytes FileID] + [4 bytes chunkIndex] + [4 bytes totalChunks] + [Payload]
        const frameBuffer = new ArrayBuffer(44 + arrayBuffer.byteLength);
        const view = new DataView(frameBuffer);
        new Uint8Array(frameBuffer).set(fileIdBytes, 0);
        view.setUint32(36, chunkIndex, false);
        view.setUint32(40, meta.totalChunks, false);
        new Uint8Array(frameBuffer).set(new Uint8Array(arrayBuffer), 44);

        for (const dc of this.dataChannels.values()) {
          if (dc.readyState === "open") {
            // Respect bufferedAmount to prevent congestion
            if (dc.bufferedAmount > 2 * 1024 * 1024) {
              await new Promise((r) => setTimeout(r, 20));
            }
            try {
              dc.send(frameBuffer);
            } catch (e) {
              console.warn("DC send error:", e);
            }
          }
        }
      } else {
        // Fallback relay via WebSocket using base64 chunking
        const binary = String.fromCharCode.apply(null, Array.from(new Uint8Array(arrayBuffer)));
        const base64Chunk = btoa(binary);

        this.sendSignal({
          type: "file_chunk_relay",
          fileId: meta.id,
          chunkIndex,
          totalChunks: meta.totalChunks,
          chunkData: base64Chunk,
        });

        this.broadcastLocal({
          type: "file_chunk_relay",
          fileId: meta.id,
          chunkIndex,
          totalChunks: meta.totalChunks,
          chunkData: base64Chunk,
        });

        // Small pacing interval for relay
        await new Promise((r) => setTimeout(r, 5));
      }

      transferred += arrayBuffer.byteLength;
      const elapsedSec = (Date.now() - startTime) / 1000;
      const speed = elapsedSec > 0 ? transferred / elapsedSec : 0;
      const remainingBytes = file.size - transferred;
      const eta = speed > 0 ? Math.ceil(remainingBytes / speed) : 0;

      const updatedProgress: FileTransferProgress = {
        fileId: meta.id,
        name: file.name,
        size: file.size,
        extension: meta.extension,
        type: file.type,
        direction: "upload",
        status: transferred >= file.size ? "completed" : "transferring",
        transferredBytes: transferred,
        totalBytes: file.size,
        chunksReceived: chunkIndex + 1,
        totalChunks: meta.totalChunks,
        speedBps: speed,
        etaSeconds: eta,
        senderName: this.peerName,
      };

      this.activeTransfers.set(meta.id, updatedProgress);
      this.callbacks.onFileProgress?.(updatedProgress);
    }
  }

  public cancelTransfer(fileId: string) {
    const transfer = this.activeTransfers.get(fileId);
    if (transfer) {
      transfer.status = "cancelled";
      this.activeTransfers.set(fileId, transfer);
      this.callbacks.onFileProgress?.(transfer);
    }
  }

  private startPingLoop() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    this.pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(
          JSON.stringify({
            type: "ping",
            clientTimestamp: Date.now(),
          })
        );
      }

      // Also ping over data channels
      for (const [peerId, dc] of this.dataChannels.entries()) {
        if (dc.readyState === "open") {
          dc.send(JSON.stringify({ type: "ping", ts: Date.now() }));
        }
      }
    }, 4000);
  }

  public pairPhoneBridge(desktop1PeerId: string, desktop2PeerId: string, targetRoomId?: string) {
    this.sendSignal({
      type: "phone_bridge_pair",
      desktop1PeerId,
      desktop2PeerId,
      targetRoomId: targetRoomId || this.roomId,
    });
  }

  public updatePeerName(newName: string) {
    this.peerName = newName;
    this.sendSignal({
      type: "update_name",
      roomId: this.roomId,
      peerId: this.peerId,
      peerName: newName,
    });
  }

  private cleanupPeer(peerId: string) {
    const dc = this.dataChannels.get(peerId);
    if (dc) {
      try {
        dc.close();
      } catch (e) {}
      this.dataChannels.delete(peerId);
    }

    const pc = this.peerConnections.get(peerId);
    if (pc) {
      try {
        pc.close();
      } catch (e) {}
      this.peerConnections.delete(peerId);
    }
  }

  public destroy() {
    if (this.pingInterval) clearInterval(this.pingInterval);
    for (const peerId of this.peerConnections.keys()) {
      this.cleanupPeer(peerId);
    }
    if (this.broadcastChannel) {
      try {
        this.broadcastChannel.close();
      } catch (e) {}
    }
    if (this.ws) {
      try {
        this.ws.close();
      } catch (e) {}
    }
  }
}
