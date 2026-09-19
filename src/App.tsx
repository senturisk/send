/**
 * Sen Send - Universal P2P File Sharing System
 * Developer: Senturisk
 */

import React, { useState, useEffect, useRef } from "react";
import {
  ChatMessage,
  ConnectionState,
  DeviceType,
  FileMetadata,
  FileTransferProgress,
  Peer,
  TorchNotificationItem,
  TypingUser,
} from "./types";
import { P2PConnectionManager } from "./lib/webrtc";
import {
  deleteRoomMessageByFileId,
  generateRoomCode,
  getStoredUserConfig,
  loadRoomMessages,
  saveFileToVault,
  saveRoomMessage,
  saveUserName,
} from "./lib/storage";
import { SolarIcon } from "./lib/icons";
import { TorchNotificationContainer } from "./components/TorchNotification";
import { ChatView } from "./components/ChatView";
import { PeerList } from "./components/PeerList";
import { QRModal } from "./components/QRModal";
import { QRScannerModal } from "./components/QRScannerModal";
import { PhoneBridgeModal } from "./components/PhoneBridgeModal";
import { FileVaultModal } from "./components/FileVaultModal";
import { NamePromptModal } from "./components/NamePromptModal";

export default function App() {
  // User & device identity
  const userConfig = useRef(getStoredUserConfig()).current;
  const [peerName, setPeerName] = useState(userConfig.peerName);
  const [peerId] = useState(userConfig.peerId);
  const [deviceType] = useState<DeviceType>(userConfig.deviceType);

  // Room state & query parameters (?room=...)
  const [roomId, setRoomId] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    const queryRoom = params.get("room") || params.get("join");
    if (queryRoom) {
      const trimmed = queryRoom.trim().toUpperCase();
      return trimmed.startsWith("SEN-") ? "S-" + trimmed.slice(4) : trimmed;
    }
    const saved = localStorage.getItem("sensend_active_room");
    if (saved) {
      return saved.startsWith("SEN-") ? "S-" + saved.slice(4) : saved;
    }
    return generateRoomCode();
  });

  const [inputNewRoom, setInputNewRoom] = useState("");
  const [connectionState, setConnectionState] = useState<ConnectionState>("connecting");
  const [serverPing, setServerPing] = useState(0);
  const [peers, setPeers] = useState<Peer[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<TypingUser[]>([]);
  const [activeTransfers, setActiveTransfers] = useState<FileTransferProgress[]>([]);
  const [notifications, setNotifications] = useState<TorchNotificationItem[]>([]);

  // Modals & Sheets
  const [showNamePrompt, setShowNamePrompt] = useState(true);
  const [showQRModal, setShowQRModal] = useState(false);
  const [showScannerModal, setShowScannerModal] = useState(false);
  const [showBridgeModal, setShowBridgeModal] = useState(false);
  const [showVaultModal, setShowVaultModal] = useState(false);
  const [showMobilePeersDrawer, setShowMobilePeersDrawer] = useState(false);
  const [showRoomSwitchPopover, setShowRoomSwitchPopover] = useState(false);
  const [showSidebar, setShowSidebar] = useState(true);

  // Active P2P manager ref
  const p2pRef = useRef<P2PConnectionManager | null>(null);

  // Helper to push Torch notifications
  const notify = (
    title: string,
    message: string,
    type: TorchNotificationItem["type"] = "info",
    duration: number = 4000
  ) => {
    const id = "torch_" + Math.random().toString(36).substring(2, 9);
    const newNotif: TorchNotificationItem = { id, title, message, type, timestamp: Date.now(), duration };
    setNotifications((prev) => [newNotif, ...prev.slice(0, 4)]);

    if (duration > 0) {
      setTimeout(() => {
        setNotifications((prev) => prev.filter((n) => n.id !== id));
      }, duration);
    }
  };

  const dismissNotification = (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  };

  // Sync URL query parameter when room changes
  useEffect(() => {
    localStorage.setItem("sensend_active_room", roomId);
    const newUrl = `${window.location.pathname}?room=${encodeURIComponent(roomId)}`;
    window.history.replaceState({ roomId }, "", newUrl);
  }, [roomId]);

  // Network online/offline listeners
  useEffect(() => {
    const handleOnline = () => {
      setConnectionState("connected");
      notify("Connected", "Network connection active", "success");
      p2pRef.current?.connectSignaling();
    };

    const handleOffline = () => {
      setConnectionState("offline");
      notify("Offline", "Offline mode active. Saved files are accessible.", "warning");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Initialize and join room with P2P Connection Manager
  useEffect(() => {
    if (p2pRef.current) {
      p2pRef.current.destroy();
    }

    setConnectionState("connecting");
    setPeers([]);

    // Load room message history from IndexedDB
    loadRoomMessages(roomId).then((savedMsgs) => {
      if (savedMsgs.length > 0) {
        setMessages(savedMsgs);
      } else {
        const welcomeStatus: ChatMessage = {
          id: "status_init_" + Date.now(),
          senderId: "system",
          senderName: "Sen Send",
          timestamp: Date.now(),
          type: "status",
          statusText: `Room ${roomId} • Ready to share`,
          isSelf: false,
        };
        setMessages([welcomeStatus]);
      }
    });

    const manager = new P2PConnectionManager(peerId, peerName, roomId, {
      onPeerConnected: (connectedPeerId, connectedPeerName, peerDevType) => {
        const dName = connectedPeerName || `Peer-${connectedPeerId.slice(0, 4)}`;
        setPeers((prev) => {
          if (prev.some((p) => p.peerId === connectedPeerId)) {
            return prev.map((p) =>
              p.peerId === connectedPeerId
                ? { ...p, peerName: dName, deviceType: peerDevType || p.deviceType }
                : p
            );
          }
          const newPeer: Peer = {
            peerId: connectedPeerId,
            peerName: dName,
            deviceType: peerDevType || "desktop",
            joinedAt: Date.now(),
            ping: 0,
          };
          return [...prev, newPeer];
        });

        notify(
          "Device Connected",
          `${dName} joined Room ${roomId}`,
          "peer-join"
        );

        const joinMsg: ChatMessage = {
          id: "join_" + Math.random().toString(36).substring(2, 9),
          senderId: connectedPeerId,
          senderName: dName,
          timestamp: Date.now(),
          type: "status",
          statusText: `${dName} joined the room`,
          isSelf: false,
        };
        setMessages((prev) => [...prev, joinMsg]);
        saveRoomMessage(roomId, joinMsg);
      },

      onPeerUpdated: (updatedPeerId, newName) => {
        setPeers((prev) =>
          prev.map((p) => (p.peerId === updatedPeerId ? { ...p, peerName: newName } : p))
        );
      },

      onPeerDisconnected: (disconnectedPeerId) => {
        setPeers((prev) => prev.filter((p) => p.peerId !== disconnectedPeerId));

        notify(
          "Device Left",
          `A peer left the room`,
          "peer-leave"
        );

        const leaveMsg: ChatMessage = {
          id: "leave_" + Math.random().toString(36).substring(2, 9),
          senderId: disconnectedPeerId,
          senderName: `Peer-${disconnectedPeerId.slice(0, 4)}`,
          timestamp: Date.now(),
          type: "status",
          statusText: `Device disconnected`,
          isSelf: false,
        };
        setMessages((prev) => [...prev, leaveMsg]);
        saveRoomMessage(roomId, leaveMsg);
      },

      onChatMessage: (incomingMsg) => {
        const isSelf = incomingMsg.senderId === peerId;
        const msg: ChatMessage = {
          ...incomingMsg,
          isSelf,
        };
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        saveRoomMessage(roomId, msg);
      },

      onTyping: (tPeerId, tPeerName, isTyping) => {
        setTypingUsers((prev) => {
          const filtered = prev.filter((u) => u.peerId !== tPeerId);
          if (isTyping) {
            return [...filtered, { peerId: tPeerId, peerName: tPeerName, timestamp: Date.now() }];
          }
          return filtered;
        });
      },

      onFileProgress: (progress) => {
        setActiveTransfers((prev) => {
          const index = prev.findIndex((t) => t.fileId === progress.fileId);
          if (index >= 0) {
            const copy = [...prev];
            copy[index] = progress;
            return copy;
          }
          return [...prev, progress];
        });

        // Fallback cleanup once a file completes uploading/transferring
        if (progress.status === "completed") {
          setTimeout(() => {
            setActiveTransfers((prev) => prev.filter((t) => t.fileId !== progress.fileId));
          }, 2000);
        }
      },

      onFileReceived: async (fileMeta, blob) => {
        const blobUrl = URL.createObjectURL(blob);

        await saveFileToVault(fileMeta, blob, roomId);

        const fileMsg: ChatMessage = {
          id: fileMeta.id,
          senderId: fileMeta.senderId,
          senderName: fileMeta.senderName,
          timestamp: Date.now(),
          type: "file",
          fileMeta,
          fileBlobUrl: blobUrl,
          isSelf: fileMeta.senderId === peerId,
        };

        setMessages((prev) => {
          if (prev.some((m) => m.id === fileMsg.id)) return prev;
          return [...prev, fileMsg];
        });
        saveRoomMessage(roomId, fileMsg);

        setTimeout(() => {
          setActiveTransfers((prev) => prev.filter((t) => t.fileId !== fileMeta.id));
        }, 1600);
      },

      onPingUpdate: (target, pingMs) => {
        if (target === "server") {
          setServerPing(pingMs);
          setConnectionState("connected");
        } else {
          setPeers((prev) =>
            prev.map((p) => (p.peerId === target ? { ...p, ping: pingMs } : p))
          );
        }
      },

      onError: (title, detail) => {
        notify(title, detail, "error");
      },
    });

    p2pRef.current = manager;
    manager.connectSignaling();

    return () => {
      manager.destroy();
    };
  }, [roomId, peerId, peerName]);

  // Clean stale typing indicators
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setTypingUsers((prev) => prev.filter((u) => now - u.timestamp < 3000));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleSendMessage = (text: string) => {
    const newMsg: ChatMessage = {
      id: "msg_" + Math.random().toString(36).substring(2, 9) + "_" + Date.now(),
      senderId: peerId,
      senderName: peerName,
      deviceType,
      text,
      timestamp: Date.now(),
      type: "text",
      isSelf: true,
    };

    setMessages((prev) => [...prev, newMsg]);
    saveRoomMessage(roomId, newMsg);
    p2pRef.current?.sendChatMessage(newMsg);
  };

  const handleSendFile = async (file: File) => {
    if (!p2pRef.current) return;

    try {
      const ext = file.name.includes(".") ? file.name.split(".").pop() || "" : "";
      const fileId = await p2pRef.current.sendFile(file);

      const localBlobUrl = URL.createObjectURL(file);
      const meta: FileMetadata = {
        id: fileId,
        name: file.name,
        size: file.size,
        type: file.type,
        extension: ext.toLowerCase(),
        totalChunks: Math.ceil(file.size / 16384) || 1,
        chunkSize: 16384,
        senderId: peerId,
        senderName: peerName,
        timestamp: Date.now(),
      };

      const chatFileMsg: ChatMessage = {
        id: fileId,
        senderId: peerId,
        senderName: peerName,
        timestamp: Date.now(),
        type: "file",
        fileMeta: meta,
        fileBlobUrl: localBlobUrl,
        isSelf: true,
      };

      setMessages((prev) => [...prev, chatFileMsg]);
      saveRoomMessage(roomId, chatFileMsg);

      await saveFileToVault(meta, file, roomId);
    } catch (err: any) {
      notify("Transfer Failed", err?.message || "Could not send file.", "error");
    }
  };

  const handleDownloadMessageFile = (msg: ChatMessage) => {
    if (!msg.fileMeta || !msg.fileBlobUrl) return;
    const a = document.createElement("a");
    a.href = msg.fileBlobUrl;
    a.download = msg.fileMeta.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDismissTransfer = (fileId: string) => {
    setActiveTransfers((prev) => prev.filter((t) => t.fileId !== fileId));
  };

  const handleDeleteVaultFile = async (fileId: string) => {
    // 1. Remove from in-line chat messages state immediately
    setMessages((prev) =>
      prev.filter((msg) => msg.id !== fileId && msg.fileMeta?.id !== fileId)
    );
    // 2. Remove any active progress notification if present
    setActiveTransfers((prev) => prev.filter((t) => t.fileId !== fileId));
    // 3. Remove from persistent IndexedDB chat history
    await deleteRoomMessageByFileId(fileId);
  };

  const handleRoomSwitch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputNewRoom.trim()) {
      let target = inputNewRoom.trim().toUpperCase();
      if (!target.startsWith("S-") && !target.startsWith("SEN-")) {
        target = "S-" + target;
      } else if (target.startsWith("SEN-")) {
        target = "S-" + target.slice(4);
      }
      setRoomId(target);
      setInputNewRoom("");
      setShowRoomSwitchPopover(false);
      setShowMobilePeersDrawer(false);
      setShowNamePrompt(true);
      notify("Switched Room", `Connected to ${target}`, "info");
    }
  };

  const handleNameConfirmed = (chosenName: string) => {
    setPeerName(chosenName);
    saveUserName(chosenName);
    p2pRef.current?.updatePeerName(chosenName);
    setShowNamePrompt(false);
    notify("Display Name Set", `Joined room ${roomId} as "${chosenName}"`, "success");
  };

  const handleUpdateName = (newName: string) => {
    setPeerName(newName);
    saveUserName(newName);
    p2pRef.current?.updatePeerName(newName);
    notify("Updated", `Name updated to "${newName}"`, "success");
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#F8F9FC] text-[#1E293B] font-sans selection:bg-[#0B57D0] selection:text-white">
      {/* Floating Torch Notifications */}
      <TorchNotificationContainer
        notifications={notifications}
        onDismiss={dismissNotification}
      />

      {/* Material You 3 & Apple-Grade Minimal Top Header */}
      <header className="h-14 sm:h-16 px-4 sm:px-6 bg-white/80 backdrop-blur-md border-b border-slate-200/80 flex items-center justify-between z-30 shrink-0 select-none">
        {/* Brand & Developer identity */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2.5">
            <img
              src="/logo.svg"
              alt="Sen Send Logo"
              className="w-8 h-8 rounded-xl object-contain shadow-xs border border-purple-100"
            />
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-base font-bold tracking-tight text-slate-800">
                  Sen Send
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  by Senturisk
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Center: Material You Dynamic Room Pill */}
        <div className="relative">
          <button
            id="btn-room-badge"
            onClick={() => setShowRoomSwitchPopover(!showRoomSwitchPopover)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200/80 border border-slate-200/60 text-xs transition-colors"
          >
            <span
              className={`w-2 h-2 rounded-full ${
                connectionState === "connected"
                  ? "bg-emerald-500"
                  : connectionState === "offline"
                  ? "bg-amber-500"
                  : "bg-blue-500 animate-pulse"
              }`}
            />
            <span className="font-semibold text-slate-700">{roomId}</span>
            <SolarIcon name="alt-arrow-down-bold-duotone" className="w-3 h-3 text-slate-400" />
          </button>

          {/* Quick Room Switcher Popover */}
          {showRoomSwitchPopover && (
            <div
              className="absolute top-full mt-2 left-1/2 -translate-x-1/2 w-64 p-3 rounded-2xl bg-white border border-slate-200 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-150"
              onClick={(e) => e.stopPropagation()}
            >
              <form onSubmit={handleRoomSwitch} className="space-y-2">
                <div className="text-xs font-semibold text-slate-700">Switch Room</div>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    placeholder="e.g. ALPHA"
                    value={inputNewRoom}
                    onChange={(e) => setInputNewRoom(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-slate-800 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                    autoFocus
                  />
                  <button
                    type="submit"
                    className="px-3 py-1.5 rounded-xl bg-[#0B57D0] text-white text-xs font-medium"
                  >
                    Go
                  </button>
                </div>
              </form>

              <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
                <span className="text-slate-400 font-mono">Invite Link</span>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(
                      `${window.location.origin}/?room=${encodeURIComponent(roomId)}`
                    );
                    setShowRoomSwitchPopover(false);
                    notify("Link Copied", "Share with nearby peers", "info");
                  }}
                  className="text-[#0B57D0] font-medium hover:underline flex items-center gap-1"
                >
                  <SolarIcon name="copy-bold-duotone" className="w-3 h-3" />
                  Copy
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Minimal Action Controls (Apple-Grade Quiet Icons) */}
        <div className="flex items-center gap-1 sm:gap-1.5">
          {/* Room QR Code */}
          <button
            id="btn-nav-qr-code"
            onClick={() => setShowQRModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-full text-slate-600 hover:text-[#0B57D0] hover:bg-slate-100 text-xs font-medium transition-colors flex items-center gap-1.5"
            title="Share Room QR"
          >
            <SolarIcon name="qr-code-bold-duotone" className="w-4 h-4 text-[#0B57D0]" />
            <span className="hidden sm:inline">QR</span>
          </button>

          {/* Camera Scanner */}
          <button
            id="btn-nav-scan-qr"
            onClick={() => setShowScannerModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-full text-slate-600 hover:text-[#0B57D0] hover:bg-slate-100 text-xs font-medium transition-colors flex items-center gap-1.5"
            title="Scan QR Code"
          >
            <SolarIcon name="camera-bold-duotone" className="w-4 h-4 text-slate-600" />
            <span className="hidden sm:inline">Scan</span>
          </button>

          {/* Phone Bridge */}
          <button
            id="btn-nav-phone-bridge"
            onClick={() => setShowBridgeModal(true)}
            className="p-2 sm:px-3 sm:py-1.5 rounded-full text-slate-600 hover:text-purple-600 hover:bg-purple-50 text-xs font-medium transition-colors flex items-center gap-1.5"
            title="Phone Bridge"
          >
            <SolarIcon name="smartphone-bold-duotone" className="w-4 h-4 text-purple-600" />
            <span className="hidden md:inline">Bridge</span>
          </button>

          {/* Persistent Vault */}
          <button
            id="btn-nav-file-vault"
            onClick={() => setShowVaultModal(true)}
            className="p-2 rounded-full text-slate-600 hover:text-amber-600 hover:bg-amber-50 transition-colors"
            title="Saved Files"
          >
            <SolarIcon name="folder-with-files-bold-duotone" className="w-4 h-4 text-amber-600" />
          </button>

          {/* Sidebar Toggle */}
          <button
            id="btn-toggle-sidebar"
            onClick={() => setShowSidebar(!showSidebar)}
            className="hidden md:flex p-2 rounded-full text-slate-600 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Toggle Peers List"
          >
            <SolarIcon name="sidebar-minimalistic-bold-duotone" className="w-4 h-4" />
          </button>

          {/* Mobile Drawer Trigger */}
          <button
            id="btn-mobile-peers-toggle"
            onClick={() => setShowMobilePeersDrawer(true)}
            className="md:hidden p-2 rounded-full text-slate-600 hover:bg-slate-100 relative"
          >
            <SolarIcon name="users-group-rounded-bold-duotone" className="w-4 h-4 text-slate-700" />
            {peers.length > 0 && (
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex overflow-hidden">
        {/* Desktop Sidebar (Minimal, Clean) */}
        {showSidebar && (
          <aside className="hidden md:flex w-72 lg:w-80 flex-col bg-white border-r border-slate-200/80 p-4 shrink-0 overflow-y-auto">
            <div className="flex-1">
              <PeerList
                peers={peers}
                currentPeerId={peerId}
                currentPeerName={peerName}
                currentDeviceType={deviceType}
                serverPing={serverPing}
                onUpdateName={handleUpdateName}
              />
            </div>

            <div className="pt-3 border-t border-slate-100 text-center">
              <span className="text-[11px] text-slate-400 font-mono">
                Sen Send • Senturisk
              </span>
            </div>
          </aside>
        )}

        {/* Center / Chatroom & File Stream */}
        <main className="flex-1 flex flex-col overflow-hidden relative">
          <ChatView
            messages={messages}
            typingUsers={typingUsers}
            activeTransfers={activeTransfers}
            currentPeerId={peerId}
            onSendMessage={handleSendMessage}
            onSendFile={handleSendFile}
            onTyping={(isTyping) => p2pRef.current?.sendTyping(isTyping)}
            onCancelTransfer={(fId) => p2pRef.current?.cancelTransfer(fId)}
            onDismissTransfer={handleDismissTransfer}
            onDownloadFile={handleDownloadMessageFile}
            onOpenQR={() => setShowQRModal(true)}
            onOpenScan={() => setShowScannerModal(true)}
            onOpenBridge={() => setShowBridgeModal(true)}
          />
        </main>
      </div>

      {/* Mobile Peers Drawer */}
      {showMobilePeersDrawer && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs md:hidden flex justify-end"
          onClick={() => setShowMobilePeersDrawer(false)}
        >
          <div
            className="w-80 max-w-[85vw] h-full bg-white border-l border-slate-200 shadow-2xl p-5 flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
              <h3 className="text-sm font-semibold text-slate-800">Room Participants</h3>
              <button
                onClick={() => setShowMobilePeersDrawer(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-700"
              >
                <SolarIcon name="close-circle-bold-duotone" className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto">
              <PeerList
                peers={peers}
                currentPeerId={peerId}
                currentPeerName={peerName}
                currentDeviceType={deviceType}
                serverPing={serverPing}
                onUpdateName={handleUpdateName}
              />
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      <QRModal
        isOpen={showQRModal}
        onClose={() => setShowQRModal(false)}
        roomId={roomId}
        peerId={peerId}
        onCopyNotice={(msg) => notify("Link Copied", msg, "info")}
      />

      <QRScannerModal
        isOpen={showScannerModal}
        onClose={() => setShowScannerModal(false)}
        onScanned={(scannedText) => {
          let target = scannedText.trim().toUpperCase();
          try {
            const url = new URL(scannedText);
            const r = url.searchParams.get("room") || url.searchParams.get("join");
            if (r) {
              target = r.trim().toUpperCase();
            }
          } catch {}
          if (target.startsWith("SEN-")) target = "S-" + target.slice(4);
          else if (!target.startsWith("S-")) target = "S-" + target;
          setRoomId(target);
          setShowScannerModal(false);
          setShowNamePrompt(true);
          notify("Connected", `Joined room ${target}`, "success");
        }}
        onErrorNotice={(title, msg) => notify(title, msg, "error")}
      />

      <PhoneBridgeModal
        isOpen={showBridgeModal}
        onClose={() => setShowBridgeModal(false)}
        currentPeerId={peerId}
        currentRoomId={roomId}
        isMobileDevice={deviceType === "mobile"}
        onBridgePair={(d1, d2) => {
          p2pRef.current?.pairPhoneBridge(d1, d2, roomId);
        }}
        onJoinRoom={(newR) => {
          let target = newR.trim().toUpperCase();
          if (target.startsWith("SEN-")) target = "S-" + target.slice(4);
          else if (!target.startsWith("S-")) target = "S-" + target;
          setRoomId(target);
          setShowNamePrompt(true);
        }}
        onNotify={notify}
      />

      <FileVaultModal
        isOpen={showVaultModal}
        onClose={() => setShowVaultModal(false)}
        onDeleteFile={handleDeleteVaultFile}
        onNotify={notify}
      />

      {/* Display Name Prompt Modal upon entering room */}
      <NamePromptModal
        isOpen={showNamePrompt}
        roomId={roomId}
        currentName={peerName}
        onConfirm={handleNameConfirmed}
      />
    </div>
  );
}
