import React, { useState } from "react";
import { Peer, DeviceType } from "../types";
import { SolarIcon } from "../lib/icons";

interface PeerListProps {
  peers: Peer[];
  currentPeerId: string;
  currentPeerName: string;
  currentDeviceType: DeviceType;
  currentRoomId?: string;
  serverPing: number;
  onUpdateName: (newName: string) => void;
  onOpenQR?: () => void;
}

export const PeerList: React.FC<PeerListProps> = ({
  peers,
  currentPeerId,
  currentPeerName,
  currentDeviceType,
  currentRoomId,
  serverPing: _serverPing,
  onUpdateName,
  onOpenQR,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(currentPeerName);
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedPeerId, setCopiedPeerId] = useState(false);

  const getDeviceIcon = (device: DeviceType): { icon: string; color: string } => {
    switch (device) {
      case "mobile":
        return { icon: "smartphone-bold-duotone", color: "text-purple-600" };
      case "tablet":
        return { icon: "tablet-bold-duotone", color: "text-teal-600" };
      default:
        return { icon: "laptop-bold-duotone", color: "text-[#0B57D0]" };
    }
  };

  const handleSaveName = (e: React.FormEvent) => {
    e.preventDefault();
    if (nameInput.trim()) {
      onUpdateName(nameInput.trim());
      setIsEditingName(false);
    }
  };

  const handleCopyRoom = () => {
    if (!currentRoomId) return;
    navigator.clipboard.writeText(currentRoomId);
    setCopiedRoom(true);
    setTimeout(() => setCopiedRoom(false), 2000);
  };

  const handleCopyPeerId = () => {
    if (!currentPeerId) return;
    navigator.clipboard.writeText(currentPeerId);
    setCopiedPeerId(true);
    setTimeout(() => setCopiedPeerId(false), 2000);
  };

  const selfIcon = getDeviceIcon(currentDeviceType);

  return (
    <div id="peer-list-container" className="flex flex-col h-full gap-3">
      {/* Active Room Badge Tile */}
      {currentRoomId && (
        <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100/90 shadow-2xs">
          <div className="flex items-center justify-between gap-1.5 mb-1">
            <span className="text-[11px] uppercase tracking-wider font-bold text-blue-700 flex items-center gap-1">
              <SolarIcon name="hashtag-bold-duotone" className="w-3 h-3" />
              <span>Active Room</span>
            </span>
            <div className="flex items-center gap-1">
              {onOpenQR && (
                <button
                  type="button"
                  onClick={onOpenQR}
                  className="p-1 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-100/70 transition-colors"
                  title="Show Room QR Code"
                >
                  <SolarIcon name="qr-code-bold-duotone" className="w-3.5 h-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={handleCopyRoom}
                className="p-1 rounded-lg text-blue-600 hover:text-blue-800 hover:bg-blue-100/70 transition-colors"
                title="Copy Room Code"
              >
                <SolarIcon
                  name={copiedRoom ? "check-circle-bold-duotone" : "copy-bold-duotone"}
                  className={`w-3.5 h-3.5 ${copiedRoom ? "text-emerald-600" : ""}`}
                />
              </button>
            </div>
          </div>
          <div className="flex items-baseline justify-between">
            <span className="font-mono text-base font-bold text-slate-900 tracking-wider">
              {currentRoomId}
            </span>
            <span className="text-[10px] text-blue-600 font-medium">
              {peers.length + 1} online
            </span>
          </div>
        </div>
      )}

      {/* Self Profile Tile */}
      <div className="p-3 rounded-2xl bg-white border border-slate-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-blue-50 border border-blue-100 text-[#0B57D0] shrink-0">
            <SolarIcon name={selfIcon.icon} className="w-5 h-5" />
          </div>

          <div className="flex-1 min-w-0">
            {isEditingName ? (
              <form onSubmit={handleSaveName} className="flex items-center gap-1">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  maxLength={24}
                  className="w-full text-xs font-semibold px-2 py-1 rounded-lg bg-slate-50 border border-blue-300 text-slate-800 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="submit"
                  className="p-1 rounded-lg bg-[#0B57D0] hover:bg-[#084298] text-white"
                >
                  <SolarIcon name="check-circle-bold-duotone" className="w-4 h-4" />
                </button>
              </form>
            ) : (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-xs font-semibold text-slate-800 truncate">
                    {currentPeerName}
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" title="Online" />
                </div>
                <button
                  onClick={() => setIsEditingName(true)}
                  className="p-1 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                  title="Change display name"
                >
                  <SolarIcon name="pen-bold-duotone" className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-slate-600 font-mono truncate">
                Peer ID: {currentPeerId ? currentPeerId.slice(0, 8) + "…" : "Generating…"}
              </span>
              {currentPeerId && (
                <button
                  type="button"
                  onClick={handleCopyPeerId}
                  className="text-[10px] text-slate-400 hover:text-slate-700 ml-1"
                  title="Copy full Peer ID"
                >
                  <SolarIcon
                    name={copiedPeerId ? "check-circle-bold-duotone" : "copy-bold-duotone"}
                    className="w-3 h-3 inline"
                  />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Participants Header */}
      <div className="flex items-center justify-between px-1">
        <span className="text-xs font-semibold text-slate-700">
          Peers in Room
        </span>
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
          {peers.length} other{peers.length === 1 ? "" : "s"}
        </span>
      </div>

      {/* Peers List */}
      <div className="flex-1 overflow-y-auto space-y-1.5 pr-0.5">
        {peers.length === 0 ? (
          <div className="p-4 rounded-2xl border border-dashed border-slate-200 bg-white/60 text-center text-xs text-slate-500 flex flex-col items-center gap-1.5 my-1">
            <SolarIcon name="users-group-rounded-bold-duotone" className="w-6 h-6 text-slate-400" />
            <span className="font-medium text-slate-600">Waiting for peers</span>
            <p className="text-[11px] text-slate-400 leading-relaxed max-w-[200px]">
              Share room code <strong className="font-mono text-slate-700">{currentRoomId}</strong> or scan QR to join
            </p>
          </div>
        ) : (
          peers.map((peer) => {
            const dev = getDeviceIcon(peer.deviceType);
            return (
              <div
                key={peer.peerId}
                id={`peer-item-${peer.peerId}`}
                className="p-2.5 rounded-2xl bg-white border border-slate-200/70 shadow-2xs hover:border-slate-300 transition-colors flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className="p-1.5 rounded-xl bg-slate-100 shrink-0">
                    <SolarIcon name={dev.icon} className={`w-4 h-4 ${dev.color}`} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1">
                      <span className="text-xs font-semibold text-slate-800 truncate">
                        {peer.peerName}
                      </span>
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      Peer ID: {peer.peerId.slice(0, 8)}…
                    </span>
                  </div>
                </div>

                {peer.ping > 0 && (
                  <span className="text-[10px] font-mono text-slate-400">
                    {peer.ping}ms
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
