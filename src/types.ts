/**
 * Types for Sen Send - Universal P2P File Sharing System
 * Developer: Senturisk
 */

export type DeviceType = "desktop" | "mobile" | "tablet";

export type ConnectionState =
  | "disconnected"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "offline";

export interface Peer {
  peerId: string;
  peerName: string;
  deviceType: DeviceType;
  joinedAt: number;
  ping: number; // latency in ms
  connectionType?: "webrtc" | "relay" | "broadcast";
}

export interface FileMetadata {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  totalChunks: number;
  chunkSize: number;
  senderId: string;
  senderName: string;
  timestamp: number;
}

export interface FileTransferProgress {
  fileId: string;
  name: string;
  size: number;
  extension: string;
  type: string;
  direction: "upload" | "download";
  status: "pending" | "transferring" | "completed" | "error" | "cancelled";
  transferredBytes: number;
  totalBytes: number;
  chunksReceived: number;
  totalChunks: number;
  speedBps: number; // bytes per second
  etaSeconds: number;
  errorMessage?: string;
  blobUrl?: string;
  senderName: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  deviceType?: DeviceType;
  text?: string;
  timestamp: number;
  type: "text" | "file" | "status";
  fileMeta?: FileMetadata;
  fileBlobUrl?: string;
  isSelf: boolean;
  statusText?: string;
}

export interface TorchNotificationItem {
  id: string;
  type: "info" | "success" | "warning" | "error" | "peer-join" | "peer-leave";
  title: string;
  message: string;
  timestamp: number;
  duration?: number;
}

export interface TypingUser {
  peerId: string;
  peerName: string;
  timestamp: number;
}
