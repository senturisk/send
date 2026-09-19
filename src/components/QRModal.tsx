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
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);

  // Room code is the peer ID
  const activeCode = roomId || peerId;
  const roomUrl = `${window.location.origin}/?room=${encodeURIComponent(activeCode)}`;

  useEffect(() => {
    if (isOpen && activeCode) {
      generateQRCode(roomUrl, {
        width: 280,
        darkColor: "#0B57D0",
        lightColor: "#ffffff",
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [isOpen, activeCode, roomUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    onCopyNotice("Room invite link copied to clipboard");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(activeCode);
    setCopiedCode(true);
    onCopyNotice("Peer ID room code copied");
    setTimeout(() => setCopiedCode(false), 2000);
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
          Scan to Join Room
        </h3>
        <p className="text-xs text-slate-500 mb-4 text-center">
          Open your camera or Sen Send scanner to connect to this peer instantly
        </p>

        {/* QR Code Presentation Box */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-4 shadow-xs">
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

        {/* Room Code = Peer ID */}
        <div className="w-full bg-slate-50 border border-slate-100 rounded-2xl p-3 mb-4 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-semibold tracking-wider text-slate-400">
              Room Code (Peer ID)
            </div>
            <div
              onClick={handleCopyCode}
              className="font-mono text-xs font-semibold text-slate-800 truncate cursor-pointer hover:text-[#0B57D0] transition-colors"
              title="Click to copy"
            >
              {activeCode || "Generating..."}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="p-1.5 rounded-xl bg-white border border-slate-200 text-slate-600 hover:text-[#0B57D0] hover:bg-slate-100 transition-colors shrink-0 shadow-xs"
            title="Copy Peer ID Room Code"
          >
            <SolarIcon
              name={copiedCode ? "check-circle-bold-duotone" : "copy-bold-duotone"}
              className={`w-4 h-4 ${copiedCode ? "text-emerald-600" : ""}`}
            />
          </button>
        </div>

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
          <span>{copiedLink ? "Link Copied!" : "Copy Room Link"}</span>
        </button>
      </div>
    </div>
  );
};
