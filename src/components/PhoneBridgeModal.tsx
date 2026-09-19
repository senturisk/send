import React, { useState } from "react";
import { SolarIcon } from "../lib/icons";
import { QRScannerModal } from "./QRScannerModal";
import { QRModal } from "./QRModal";

interface PhoneBridgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentPeerId: string;
  currentRoomId: string;
  isMobileDevice: boolean;
  onBridgePair: (desktop1Peer: string, desktop2Peer: string) => void;
  onJoinRoom: (roomId: string) => void;
  onNotify: (title: string, msg: string, type: any) => void;
}

export const PhoneBridgeModal: React.FC<PhoneBridgeModalProps> = ({
  isOpen,
  onClose,
  currentPeerId,
  currentRoomId,
  isMobileDevice,
  onBridgePair,
  onJoinRoom,
  onNotify,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [desktop1Code, setDesktop1Code] = useState<string>("");
  const [desktop2Code, setDesktop2Code] = useState<string>("");
  const [isScanningFor, setIsScanningFor] = useState<"d1" | "d2" | null>(null);
  const [showDesktopQR, setShowDesktopQR] = useState(false);

  if (!isOpen) return null;

  const extractRoomOrPeer = (scannedText: string): { roomId?: string; peerId?: string } => {
    try {
      const url = new URL(scannedText);
      const target =
        url.searchParams.get("room") ||
        url.searchParams.get("connect") ||
        url.searchParams.get("peer") ||
        url.searchParams.get("join");
      return { roomId: target || undefined, peerId: target || undefined };
    } catch {
      return { roomId: scannedText.trim(), peerId: scannedText.trim() };
    }
  };

  const handleScannedCode = (scannedText: string) => {
    const extracted = extractRoomOrPeer(scannedText);
    const code = extracted.roomId || scannedText;

    if (isScanningFor === "d1") {
      setDesktop1Code(code);
      setIsScanningFor(null);
      setStep(2);
      onNotify("Desktop 1 Captured", `Registered ${code}`, "success");
    } else if (isScanningFor === "d2") {
      setDesktop2Code(code);
      setIsScanningFor(null);
      setStep(3);
      onNotify("Desktop 2 Captured", `Registered ${code}`, "success");
    }
  };

  const executeBridgeConnection = () => {
    if (!desktop1Code || !desktop2Code) {
      onNotify("Missing Desktop", "Scan both screens first", "warning");
      return;
    }

    onBridgePair(desktop1Code, desktop2Code);
    onJoinRoom(desktop1Code);

    onNotify(
      "Bridge Connected",
      `Paired Desktop 1 & 2 directly.`,
      "success"
    );
    onClose();
  };

  return (
    <div
      id="modal-phone-bridge"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white border border-slate-200/80 shadow-2xl p-6 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-purple-50 text-purple-600 border border-purple-100">
              <SolarIcon name="smartphone-bold-duotone" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base">
                Phone Bridge
              </h3>
              <p className="text-xs text-slate-500">
                Bridge two desktop screens using your phone
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <SolarIcon name="close-circle-bold-duotone" className="w-5 h-5" />
          </button>
        </div>

        {/* Minimal Diagram */}
        <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 mb-4 flex items-center justify-around text-center text-xs">
          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-[#0B57D0]">
              <SolarIcon name="laptop-bold-duotone" className="w-4 h-4" />
            </div>
            <span className="text-[11px] text-slate-600 font-medium">Desktop 1</span>
          </div>

          <SolarIcon name="link-bold-duotone" className="w-4 h-4 text-purple-500" />

          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 shadow-2xs">
              <SolarIcon name="smartphone-bold-duotone" className="w-4 h-4" />
            </div>
            <span className="text-[11px] text-purple-700 font-semibold">Phone</span>
          </div>

          <SolarIcon name="link-bold-duotone" className="w-4 h-4 text-purple-500" />

          <div className="flex flex-col items-center gap-1">
            <div className="p-2 rounded-xl bg-white border border-slate-200 shadow-2xs text-indigo-600">
              <SolarIcon name="monitor-bold-duotone" className="w-4 h-4" />
            </div>
            <span className="text-[11px] text-slate-600 font-medium">Desktop 2</span>
          </div>
        </div>

        {/* Step List */}
        <div className="space-y-2.5">
          {/* Step 1 */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h4 className="text-xs font-semibold text-slate-800">
                1. Scan Desktop 1
              </h4>
              <p className="text-[11px] text-slate-500 truncate">
                {desktop1Code ? `Ready (${desktop1Code})` : "Point at first screen"}
              </p>
            </div>
            <button
              onClick={() => setIsScanningFor("d1")}
              className="shrink-0 px-3 py-1.5 rounded-full bg-white hover:bg-slate-100 text-[#0B57D0] border border-slate-200 text-xs font-medium shadow-2xs transition-colors flex items-center gap-1"
            >
              <SolarIcon name="camera-bold-duotone" className="w-3.5 h-3.5" />
              <span>{desktop1Code ? "Rescan" : "Scan"}</span>
            </button>
          </div>

          {/* Step 2 */}
          <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-between">
            <div className="min-w-0 pr-2">
              <h4 className="text-xs font-semibold text-slate-800">
                2. Scan Desktop 2
              </h4>
              <p className="text-[11px] text-slate-500 truncate">
                {desktop2Code ? `Ready (${desktop2Code})` : "Point at second screen"}
              </p>
            </div>
            <button
              disabled={!desktop1Code}
              onClick={() => setIsScanningFor("d2")}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                desktop1Code
                  ? "bg-white hover:bg-slate-100 text-purple-700 border border-slate-200 shadow-2xs cursor-pointer"
                  : "bg-slate-100 text-slate-400 border border-transparent cursor-not-allowed"
              }`}
            >
              <SolarIcon name="camera-bold-duotone" className="w-3.5 h-3.5" />
              <span>{desktop2Code ? "Rescan" : "Scan"}</span>
            </button>
          </div>

          {/* Connect Button */}
          <button
            id="btn-bridge-desktops-pair"
            disabled={!desktop1Code || !desktop2Code}
            onClick={executeBridgeConnection}
            className={`w-full mt-2 py-2.5 rounded-full font-medium text-xs flex items-center justify-center gap-1.5 transition-all ${
              desktop1Code && desktop2Code
                ? "bg-[#0B57D0] hover:bg-[#084298] text-white shadow-xs cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
          >
            <SolarIcon name="link-bold-duotone" className="w-4 h-4" />
            <span>Connect Desktops</span>
          </button>
        </div>

        {!isMobileDevice && (
          <div className="mt-4 pt-3 border-t border-slate-100 text-center">
            <button
              onClick={() => setShowDesktopQR(true)}
              className="text-xs text-[#0B57D0] hover:underline inline-flex items-center gap-1"
            >
              <SolarIcon name="qr-code-bold-duotone" className="w-3.5 h-3.5" />
              <span>Show QR for phone to scan</span>
            </button>
          </div>
        )}
      </div>

      {isScanningFor && (
        <QRScannerModal
          isOpen={true}
          onClose={() => setIsScanningFor(null)}
          onScanned={handleScannedCode}
          onErrorNotice={(t, m) => onNotify(t, m, "error")}
        />
      )}

      {showDesktopQR && (
        <QRModal
          isOpen={true}
          onClose={() => setShowDesktopQR(false)}
          roomId={currentRoomId}
          peerId={currentPeerId}
          onCopyNotice={(m) => onNotify("Copied", m, "info")}
        />
      )}
    </div>
  );
};
