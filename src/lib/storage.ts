/**
 * Persistent browser storage for Sen Send (Senturisk)
 * Uses IndexedDB for file blobs & chat history so files and rooms work offline.
 */

import { ChatMessage, FileMetadata } from "../types";

const DB_NAME = "SenSend_Senturisk_DB";
const DB_VERSION = 1;
const STORE_FILES = "files_vault";
const STORE_MESSAGES = "chat_history";

export interface StoredFile {
  id: string;
  name: string;
  size: number;
  type: string;
  extension: string;
  blob: Blob;
  senderName: string;
  savedAt: number;
  roomId: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (!window.indexedDB) {
      reject(new Error("IndexedDB is not supported"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_FILES)) {
        db.createObjectStore(STORE_FILES, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(STORE_MESSAGES)) {
        const msgStore = db.createObjectStore(STORE_MESSAGES, { keyPath: "id" });
        msgStore.createIndex("roomId", "roomId", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Save a transferred file into persistent IndexedDB storage
 */
export async function saveFileToVault(
  meta: FileMetadata,
  blob: Blob,
  roomId: string
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, "readwrite");
    const store = tx.objectStore(STORE_FILES);

    const storedFile: StoredFile = {
      id: meta.id,
      name: meta.name,
      size: meta.size,
      type: meta.type,
      extension: meta.extension,
      blob,
      senderName: meta.senderName,
      savedAt: Date.now(),
      roomId,
    };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(storedFile);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not save file to IndexedDB vault:", err);
  }
}

/**
 * Retrieve all saved files from the vault
 */
export async function getAllVaultFiles(): Promise<StoredFile[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, "readonly");
    const store = tx.objectStore(STORE_FILES);

    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result as StoredFile[]);
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not read from vault:", err);
    return [];
  }
}

/**
 * Delete a file from vault
 */
export async function deleteVaultFile(id: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, "readwrite");
    const store = tx.objectStore(STORE_FILES);

    await new Promise<void>((resolve, reject) => {
      const req = store.delete(id);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not delete from vault:", err);
  }
}

/**
 * Delete multiple files from vault and their chat messages
 */
export async function deleteMultipleVaultFiles(ids: string[]): Promise<void> {
  if (!ids || ids.length === 0) return;
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, "readwrite");
    const store = tx.objectStore(STORE_FILES);
    for (const id of ids) {
      store.delete(id);
    }
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });

    // Also delete associated room messages
    for (const id of ids) {
      await deleteRoomMessageByFileId(id);
    }
  } catch (err) {
    console.warn("Could not delete multiple files from vault:", err);
  }
}

/**
 * Clear all stored files from vault and associated file messages
 */
export async function clearAllVaultFiles(): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_FILES, "readwrite");
    const store = tx.objectStore(STORE_FILES);
    store.clear();
    await new Promise<void>((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  } catch (err) {
    console.warn("Could not clear all files from vault:", err);
  }
}

/**
 * Delete messages associated with a file from IndexedDB room history
 */
export async function deleteRoomMessageByFileId(fileId: string): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, "readwrite");
    const store = tx.objectStore(STORE_MESSAGES);

    const msgs = await new Promise<any[]>((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });

    for (const msg of msgs) {
      if (msg.id === fileId || msg.fileMeta?.id === fileId) {
        store.delete(msg.id);
      }
    }
  } catch (err) {
    console.warn("Could not delete room messages for file:", err);
  }
}

/**
 * Save chat messages for a room
 */
export async function saveRoomMessage(
  roomId: string,
  message: ChatMessage
): Promise<void> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, "readwrite");
    const store = tx.objectStore(STORE_MESSAGES);

    // Exclude heavy blob URLs from permanent message store to avoid storage bloat
    const cleanMsg = { ...message, roomId, fileBlobUrl: undefined };

    await new Promise<void>((resolve, reject) => {
      const req = store.put(cleanMsg);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not save room message:", err);
  }
}

/**
 * Load room message history from IndexedDB
 */
export async function loadRoomMessages(roomId: string): Promise<ChatMessage[]> {
  try {
    const db = await openDB();
    const tx = db.transaction(STORE_MESSAGES, "readonly");
    const store = tx.objectStore(STORE_MESSAGES);
    const index = store.index("roomId");

    return new Promise((resolve, reject) => {
      const req = index.getAll(IDBKeyRange.only(roomId));
      req.onsuccess = () => {
        const msgs = (req.result as any[]) || [];
        msgs.sort((a, b) => a.timestamp - b.timestamp);
        resolve(msgs);
      };
      req.onerror = () => reject(req.error);
    });
  } catch (err) {
    console.warn("Could not load room messages:", err);
    return [];
  }
}

/**
 * Generate a clean, random 6-8 digit alphanumeric ID / room code
 */
export function generateAlphanumericCode(minLen: number = 6, maxLen: number = 8): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ"; // High contrast, avoids confusing 0/O and 1/I
  const length = Math.floor(Math.random() * (maxLen - minLen + 1)) + minLen;
  let result = "";
  for (let i = 0; i < length; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

/**
 * Generate room code (6-8 digit alphanumeric ID)
 */
export function generateRoomCode(): string {
  return generateAlphanumericCode(6, 8);
}

/**
 * Device and user profile preferences
 */
export function getStoredUserConfig(): {
  peerId: string;
  peerName: string;
  deviceType: "desktop" | "mobile" | "tablet";
} {
  const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  );
  const isTablet = /(ipad|tablet|(android(?!.*mobile))|(windows(?!.*phone)(.*touch))|kindle|playbook|silk|(puffin(?!.*(IP|AP|WP))))/i.test(
    navigator.userAgent
  );

  let defaultDevice: "desktop" | "mobile" | "tablet" = "desktop";
  if (isTablet) defaultDevice = "tablet";
  else if (isMobile) defaultDevice = "mobile";

  const savedPeerId = localStorage.getItem("sensend_peer_id");
  const peerId = savedPeerId || "peer_" + Math.random().toString(36).substring(2, 10);
  if (!savedPeerId) {
    localStorage.setItem("sensend_peer_id", peerId);
  }

  const savedName = localStorage.getItem("sensend_peer_name");
  // Default to a clean 4-6 digit alphanumeric code if no name previously stored
  const defaultName = savedName || generateAlphanumericCode(4, 5);
  const peerName = defaultName;

  return { peerId, peerName, deviceType: defaultDevice };
}

export function saveUserName(name: string): void {
  localStorage.setItem("sensend_peer_name", name);
}
