import React, { useState, useEffect } from "react";
import { generateAlphanumericCode, saveUserName } from "../lib/storage";
import { SolarIcon } from "../lib/icons";

interface NamePromptModalProps {
  isOpen: boolean;
  roomId: string;
  currentName: string;
  onConfirm: (chosenName: string, confirmedRoomId: string) => void;
  onClose?: () => void;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({
  isOpen,
  roomId,
  currentName,
  onConfirm,
  onClose,
}) => {
  const [roomCode, setRoomCode] = useState(roomId || "");
  const [name, setName] = useState(currentName || "");
  const [quickOptions, setQuickOptions] = useState<string[]>([]);

  // Regenerate 4-digit alphanumeric presets whenever modal opens or room changes
  useEffect(() => {
    if (isOpen) {
      setRoomCode(roomId || "");
      const opt1 = generateAlphanumericCode(4, 4);
      const opt2 = generateAlphanumericCode(4, 4);
      const opt3 = generateAlphanumericCode(4, 4);
      const opt4 = generateAlphanumericCode(4, 4);
      setQuickOptions([opt1, opt2, opt3, opt4]);

      if (!name || name.startsWith("Peer-") || name.startsWith("Senturisk_")) {
        setName(opt1);
      }
    }
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const handleRandomizeName = () => {
    const newCode = generateAlphanumericCode(4, 4);
    setName(newCode);
  };

  const handleGenerateNewRoom = () => {
    const newRoom = generateAlphanumericCode(6, 8);
    setRoomCode(newRoom);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || generateAlphanumericCode(4, 4);
    const finalRoom = roomCode.trim() || roomId || generateAlphanumericCode(6, 8);
    saveUserName(finalName);
    onConfirm(finalName, finalRoom);
  };

  return (
    <div
      id="modal-name-prompt-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="modal-name-prompt-card"
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-200/90 text-left animate-in zoom-in-95 duration-200 relative"
        onClick={(e) => e.stopPropagation()}
      >
        {onClose && (
          <button
            onClick={onClose}
            className="absolute top-5 right-5 p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <SolarIcon name="close-circle-bold-duotone" className="w-5 h-5" />
          </button>
        )}

        {/* Brand & Title */}
        <div className="flex items-center gap-3.5 pb-4 border-b border-slate-100">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center text-white shadow-md shadow-blue-500/20 shrink-0">
            <SolarIcon name="transfer-horizontal-bold-duotone" className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Join P2P Room
            </h2>
            <p className="text-xs text-slate-500">
              Direct device-to-device sharing • Sen Send
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          {/* Room Code Field (pre-populated from URL query param) */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-room-code"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <SolarIcon name="hashtag-bold-duotone" className="w-3.5 h-3.5 text-blue-600" />
                <span>Room Code</span>
              </label>
              <button
                type="button"
                onClick={handleGenerateNewRoom}
                className="text-[11px] text-[#0B57D0] hover:underline font-medium flex items-center gap-1"
              >
                <SolarIcon name="refresh-bold-duotone" className="w-3 h-3" />
                <span>Generate New</span>
              </button>
            </div>
            <div className="relative flex items-center">
              <input
                id="input-room-code"
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. 7K4B9X"
                maxLength={16}
                required
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-mono font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/30 focus:border-[#0B57D0] transition-all tracking-wider uppercase"
              />
            </div>
            <p className="text-[11px] text-slate-600 mt-1">
              Auto-populated from URL or your active session code.
            </p>
          </div>

          {/* Display Name Field */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="input-display-name"
                className="text-xs font-semibold text-slate-700 flex items-center gap-1.5"
              >
                <SolarIcon name="user-bold-duotone" className="w-3.5 h-3.5 text-purple-600" />
                <span>Display Name / 4-Digit Code</span>
              </label>
              <button
                id="btn-randomize-name"
                type="button"
                onClick={handleRandomizeName}
                className="text-[11px] text-purple-600 hover:text-purple-800 font-medium flex items-center gap-1"
                title="Generate Random 4-digit code"
              >
                <SolarIcon name="magic-stick-3-bold-duotone" className="w-3 h-3" />
                <span>Random 4-Digit</span>
              </button>
            </div>

            <div className="relative flex items-center">
              <input
                id="input-display-name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. 7K4B or your name"
                maxLength={24}
                required
                autoFocus
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/30 focus:border-[#0B57D0] transition-all"
              />
            </div>

            {/* Quick 4-Digit Alphanumeric Code Presets */}
            <div className="mt-2.5">
              <div className="text-[11px] text-slate-600 font-medium mb-1.5">
                Pick a random 4-digit alphanumeric code:
              </div>
              <div className="flex items-center gap-1.5 flex-wrap">
                {quickOptions.map((opt) => (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setName(opt)}
                    className={`px-3 py-1 rounded-xl text-xs font-mono font-bold transition-all ${
                      name === opt
                        ? "bg-[#0B57D0] text-white shadow-xs"
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/70"
                    }`}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Confirm Button */}
          <div className="pt-2">
            <button
              id="btn-confirm-enter-room"
              type="submit"
              className="w-full py-3 px-4 rounded-2xl bg-[#0B57D0] hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Join Room</span>
              <SolarIcon name="arrow-right-bold-duotone" className="w-4 h-4 text-white" />
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
          <span>Sen Send • Senturisk</span>
          <span>PeerJS Default P2P Mesh</span>
        </div>
      </div>
    </div>
  );
};
