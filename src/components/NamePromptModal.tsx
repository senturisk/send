import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faDice,
  faArrowRight,
  faUser,
  faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";
import { generateAlphanumericCode, saveUserName } from "../lib/storage";

interface NamePromptModalProps {
  isOpen: boolean;
  roomId: string;
  currentName: string;
  onConfirm: (chosenName: string) => void;
  onClose?: () => void;
}

export const NamePromptModal: React.FC<NamePromptModalProps> = ({
  isOpen,
  roomId,
  currentName,
  onConfirm,
  onClose,
}) => {
  const [name, setName] = useState(currentName || "");
  const [quickOptions, setQuickOptions] = useState<string[]>([]);

  // Regenerate quick random suggestions whenever the modal opens
  useEffect(() => {
    if (isOpen) {
      const opt1 = generateAlphanumericCode(4, 5);
      const opt2 = generateAlphanumericCode(5, 6);
      const opt3 = generateAlphanumericCode(4, 6);
      setQuickOptions([opt1, opt2, opt3]);

      if (!name || name.startsWith("Peer-") || name.startsWith("Senturisk_")) {
        setName(opt1);
      }
    }
  }, [isOpen, roomId]);

  if (!isOpen) return null;

  const handleRandomize = () => {
    const newCode = generateAlphanumericCode(4, 6);
    setName(newCode);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const finalName = name.trim() || generateAlphanumericCode(4, 6);
    saveUserName(finalName);
    onConfirm(finalName);
  };

  return (
    <div
      id="modal-name-prompt-backdrop"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200"
    >
      <div
        id="modal-name-prompt-card"
        className="w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 shadow-2xl border border-slate-200/80 text-center animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Brand Logo & Room Tag */}
        <div className="flex flex-col items-center">
          <div className="relative mb-3">
            <img
              src="/logo.svg"
              alt="Sen Send Logo"
              className="w-16 h-16 rounded-2xl shadow-md object-contain border border-purple-100"
            />
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-white" />
          </div>

          <h2 className="text-xl font-bold text-slate-800 tracking-tight">
            Entering Room
          </h2>
          <div className="mt-1 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-blue-50 border border-blue-200/60 text-xs font-mono font-semibold text-[#0B57D0]">
            <span>{roomId}</span>
          </div>
        </div>

        <p className="mt-4 text-xs sm:text-sm text-slate-600 leading-relaxed max-w-xs mx-auto">
          Choose your display name or select a randomly generated 4–6 digit alphanumeric code for this room.
        </p>

        {/* Input Form */}
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div className="relative flex items-center">
            <div className="absolute left-3.5 text-slate-400">
              <FontAwesomeIcon icon={faUser} className="w-4 h-4" />
            </div>

            <input
              id="input-display-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 7K4Z or your name"
              maxLength={24}
              autoFocus
              className="w-full pl-10 pr-24 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#0B57D0]/30 focus:border-[#0B57D0] transition-all tracking-wide"
            />

            {/* Randomize button inside input */}
            <button
              id="btn-randomize-name"
              type="button"
              onClick={handleRandomize}
              className="absolute right-2 px-2.5 py-1.5 rounded-xl bg-slate-200/70 hover:bg-slate-300/80 text-slate-700 text-xs font-medium transition-colors flex items-center gap-1.5"
              title="Generate Random Code (4-6 chars)"
            >
              <FontAwesomeIcon icon={faDice} className="w-3.5 h-3.5 text-purple-600" />
              <span>Random</span>
            </button>
          </div>

          {/* Quick alphanumeric presets */}
          <div className="flex items-center justify-center gap-2 pt-1">
            <span className="text-[11px] text-slate-600 font-medium">Quick Codes:</span>
            {quickOptions.map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setName(opt)}
                className={`px-2.5 py-1 rounded-xl text-xs font-mono font-medium transition-all ${
                  name === opt
                    ? "bg-[#742E99] text-white shadow-xs"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200/60"
                }`}
              >
                {opt}
              </button>
            ))}
          </div>

          {/* Primary Action Button */}
          <div className="pt-2">
            <button
              id="btn-confirm-enter-room"
              type="submit"
              className="w-full py-3 px-4 rounded-2xl bg-[#0B57D0] hover:bg-blue-700 active:scale-[0.98] text-white text-sm font-semibold shadow-md shadow-blue-500/20 transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Enter Room</span>
              <FontAwesomeIcon icon={faArrowRight} className="w-3.5 h-3.5" />
            </button>
          </div>
        </form>

        <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
          <span>Sen Send • Senturisk</span>
          <span>You can change this anytime</span>
        </div>
      </div>
    </div>
  );
};
