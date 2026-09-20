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

  const roomUrl = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(roomId)}`;

  useEffect(() => {
    if (isOpen && roomId) {
      generateQRCode(roomUrl, {
        width: 280,
        darkColor: "#0B57D0",
        lightColor: "#ffffff",
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [isOpen, roomId, roomUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(roomUrl);
    setCopiedLink(true);
    onCopyNotice("Room invite link copied to clipboard");
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(roomId);
    setCopiedCode(true);
    onCopyNotice("Room code copied to clipboard");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  return (
    <div
      id="modal-room-qr"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-6 relative flex flex-col items-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          id="btn-close-qr-modal"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
        >
          <SolarIcon name="close-circle-bold-duotone" className="w-5 h-5" />
        </button>

        <div className="w-11 h-11 rounded-2xl bg-blue-50 text-[#0B57D0] mb-2 flex items-center justify-center border border-blue-100/80">
          <SolarIcon name="qr-code-bold-duotone" className="w-6 h-6" />
        </div>

        <h3 className="font-bold text-slate-900 text-base mb-1">
          Scan to Join Room
        </h3>
        <p className="text-xs text-slate-500 mb-4 text-center max-w-xs">
          Scan with your phone or share the link to join room <strong className="font-mono text-slate-800">{roomId}</strong> directly.
        </p>

        {/* QR Code Presentation Box */}
        <div className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 mb-4 shadow-xs">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt={`QR Code for Room ${roomId}`}
              className="w-48 h-48 rounded-xl object-contain"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
              Generating QR Code...
            </div>
          )}
        </div>

        {/* Room Code Badge */}
        <div className="w-full bg-slate-50 border border-slate-200/80 rounded-2xl p-3 mb-3 flex items-center justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 flex items-center gap-1">
              <SolarIcon name="hashtag-bold-duotone" className="w-3 h-3 text-blue-600" />
              <span>Room Code</span>
            </div>
            <div
              onClick={handleCopyCode}
              className="font-mono text-sm font-bold text-slate-900 tracking-wider truncate cursor-pointer hover:text-[#0B57D0] transition-colors"
              title="Click to copy room code"
            >
              {roomId || "Generating..."}
            </div>
          </div>
          <button
            type="button"
            onClick={handleCopyCode}
            className="px-2.5 py-1.5 rounded-xl bg-white border border-slate-200 text-slate-700 hover:text-[#0B57D0] hover:bg-slate-100 transition-colors shrink-0 shadow-2xs text-xs font-medium flex items-center gap-1"
            title="Copy Room Code"
          >
            <SolarIcon
              name={copiedCode ? "check-circle-bold-duotone" : "copy-bold-duotone"}
              className={`w-3.5 h-3.5 ${copiedCode ? "text-emerald-600" : ""}`}
            />
            <span>{copiedCode ? "Copied" : "Copy Code"}</span>
          </button>
        </div>

        {/* Action Button: Copy Room Link */}
        <button
          id="btn-copy-invite-link"
          onClick={handleCopyLink}
          className="w-full py-2.5 px-4 rounded-xl bg-[#0B57D0] hover:bg-[#084298] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm shadow-blue-500/20 transition-all cursor-pointer"
        >
          <SolarIcon
            name={copiedLink ? "check-circle-bold-duotone" : "link-bold-duotone"}
            className="w-4 h-4 text-white"
          />
          <span>{copiedLink ? "Link Copied to Clipboard!" : "Copy Full Invite Link"}</span>
        </button>

        {peerId && (
          <div className="mt-3 text-[10px] text-slate-600 font-mono truncate max-w-full">
            Your Peer ID: {peerId.slice(0, 16)}…
          </div>
        )}
      </div>
    </div>
  );
};
