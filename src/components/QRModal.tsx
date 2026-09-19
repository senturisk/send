import React, { useEffect, useState } from "react";
import { generateQRCode } from "../lib/qr";
import { SolarIcon } from "../lib/icons";

interface QRModalProps {
  isOpen: boolean;
  onClose: () => void;
  roomId: string;
  peerId: string;
  onCopyNotice: (msg: string) => void;
}

export const QRModal: React.FC<QRModalProps> = ({
  isOpen,
  onClose,
  roomId,
  peerId,
  onCopyNotice,
}) => {
  const [tab, setTab] = useState<"room" | "peer">("room");
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedPeerId, setCopiedPeerId] = useState(false);

  const roomUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;
  const peerUrl = `${window.location.origin}/?connect=${encodeURIComponent(peerId)}`;
  const activeUrl = tab === "room" ? roomUrl : peerUrl;

  useEffect(() => {
    if (isOpen && activeUrl) {
      generateQRCode(activeUrl, {
        width: 280,
        darkColor: tab === "room" ? "#0B57D0" : "#0F172A",
        lightColor: "#ffffff",
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [isOpen, activeUrl, tab]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(activeUrl);
    setCopiedLink(true);
    onCopyNotice(tab === "room" ? "Room invite link copied" : "Direct P2P connect link copied");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyPeerId = () => {
    navigator.clipboard.writeText(peerId);
    setCopiedPeerId(true);
    onCopyNotice("Peer ID copied");
    setTimeout(() => setCopiedPeerId(false), 2000);
  };

  return (
    <div
      id="modal-room-qr"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white border border-slate-200/80 shadow-2xl p-6 relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="btn-close-qr-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <SolarIcon name="close-circle-bold-duotone" className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-xl mb-2 flex items-center justify-center">
          <img src="/logo.svg" alt="Sen Send" className="w-9 h-9 object-contain" />
        </div>

        <h3 className="font-semibold text-slate-800 text-base mb-1">
          Scan to Connect
        </h3>
        <p className="text-xs text-slate-500 mb-3 text-center">
          Open your camera or Sen Send scanner to connect instantly
        </p>

        {/* Tab switch: Room vs Direct Peer */}
        <div className="flex bg-slate-100 p-1 rounded-full w-full mb-3.5">
          <button
            type="button"
            onClick={() => setTab("room")}
            className={`flex-1 py-1 text-xs font-medium rounded-full transition-all ${
              tab === "room"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Room ({roomId})
          </button>
          <button
            type="button"
            onClick={() => setTab("peer")}
            className={`flex-1 py-1 text-xs font-medium rounded-full transition-all ${
              tab === "peer"
                ? "bg-white text-slate-900 shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Direct Peer
          </button>
        </div>

        {/* QR Code Presentation Box */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-3 shadow-xs">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Connection QR Code"
              className="w-48 h-48 rounded-xl object-contain"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
              Generating QR Code...
            </div>
          )}
        </div>

        {/* Info detail */}
        {tab === "room" ? (
          <div className="flex items-center gap-2 mb-4">
            <span className="text-xs text-slate-500">Room Code:</span>
            <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full">
              {roomId}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 mb-4 max-w-full px-2">
            <span className="text-xs text-slate-500 shrink-0">Peer ID:</span>
            <span
              onClick={handleCopyPeerId}
              className="font-mono text-[11px] text-slate-700 bg-slate-100 px-2 py-0.5 rounded-full truncate cursor-pointer hover:bg-slate-200 transition-colors"
              title="Click to copy Peer ID"
            >
              {peerId || "Generating..."}
            </span>
            <button
              onClick={handleCopyPeerId}
              className="p-1 text-slate-400 hover:text-slate-700 rounded-full"
              title="Copy Peer ID"
            >
              <SolarIcon
                name={copiedPeerId ? "check-circle-bold-duotone" : "copy-bold-duotone"}
                className="w-3.5 h-3.5 text-[#0B57D0]"
              />
            </button>
          </div>
        )}

        {/* Action Button */}
        <button
          id="btn-copy-invite-link"
          onClick={handleCopyLink}
          className="w-full py-2.5 px-4 rounded-full bg-[#0B57D0] hover:bg-[#084298] text-white font-medium text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
        >
          <SolarIcon
            name={copiedLink ? "check-circle-bold-duotone" : "link-bold-duotone"}
            className="w-4 h-4 text-white"
          />
          <span>{copiedLink ? "Link Copied" : tab === "room" ? "Copy Room Link" : "Copy Direct P2P Link"}</span>
        </button>
      </div>
    </div>
  );
};
