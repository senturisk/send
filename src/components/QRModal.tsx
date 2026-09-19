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
  onCopyNotice,
}) => {
  const [qrDataUrl, setQrDataUrl] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState(false);

  const inviteUrl = `${window.location.origin}/?room=${encodeURIComponent(roomId)}`;

  useEffect(() => {
    if (isOpen && roomId) {
      generateQRCode(inviteUrl, {
        width: 280,
        darkColor: "#0B57D0",
        lightColor: "#ffffff",
      })
        .then((url) => setQrDataUrl(url))
        .catch(() => {});
    }
  }, [isOpen, roomId, inviteUrl]);

  if (!isOpen) return null;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    onCopyNotice("Invite link copied");
    setTimeout(() => setCopiedLink(false), 2000);
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
        <p className="text-xs text-slate-500 mb-4 text-center">
          Open your camera or Sen Send scanner
        </p>

        {/* QR Code Presentation Box */}
        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100 mb-4 shadow-xs">
          {qrDataUrl ? (
            <img
              src={qrDataUrl}
              alt="Room QR Code"
              className="w-48 h-48 rounded-xl object-contain"
            />
          ) : (
            <div className="w-48 h-48 flex items-center justify-center text-slate-400 text-xs">
              Generating...
            </div>
          )}
        </div>

        {/* Room Code Badge */}
        <div className="flex items-center gap-2 mb-5">
          <span className="text-xs text-slate-500">Room</span>
          <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-full">
            {roomId}
          </span>
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
          <span>{copiedLink ? "Link Copied" : "Copy Invite Link"}</span>
        </button>
      </div>
    </div>
  );
};
