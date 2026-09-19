import React, { useRef, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ChatMessage, FileTransferProgress, TypingUser } from "../types";
import { FilePreview } from "./FilePreview";
import { ProgressBar } from "./ProgressBar";
import { SolarIcon } from "../lib/icons";

interface ChatViewProps {
  messages: ChatMessage[];
  typingUsers: TypingUser[];
  activeTransfers: FileTransferProgress[];
  currentPeerId: string;
  onSendMessage: (text: string) => void;
  onSendFile: (file: File) => void;
  onTyping: (isTyping: boolean) => void;
  onCancelTransfer?: (fileId: string) => void;
  onDismissTransfer?: (fileId: string) => void;
  onDownloadFile: (message: ChatMessage) => void;
  onOpenQR: () => void;
  onOpenScan: () => void;
  onOpenBridge: () => void;
}

export const ChatView: React.FC<ChatViewProps> = ({
  messages,
  typingUsers,
  activeTransfers,
  currentPeerId,
  onSendMessage,
  onSendFile,
  onTyping,
  onCancelTransfer,
  onDismissTransfer,
  onDownloadFile,
  onOpenQR,
  onOpenScan,
}) => {
  const [inputText, setInputText] = useState("");
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const typingTimeoutRef = useRef<any>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, typingUsers, activeTransfers]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputText(e.target.value);
    onTyping(true);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      onTyping(false);
    }, 1500);
  };

  const handleSend = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim()) return;

    onSendMessage(inputText.trim());
    setInputText("");
    onTyping(false);
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      for (let i = 0; i < files.length; i++) {
        onSendFile(files[i]);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      for (let i = 0; i < e.dataTransfer.files.length; i++) {
        onSendFile(e.dataTransfer.files[i]);
      }
    }
  };

  const otherTypingUsers = typingUsers.filter((u) => u.peerId !== currentPeerId);

  return (
    <div
      id="chat-view-container"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="relative flex flex-col h-full bg-[#F8F9FC] overflow-hidden"
    >
      {/* Apple / M3 Minimalist Drag & Drop Visual Overlay */}
      {isDraggingOver && (
        <div className="absolute inset-0 z-40 bg-blue-50/90 backdrop-blur-xs border-2 border-dashed border-[#0B57D0] m-4 rounded-3xl flex flex-col items-center justify-center pointer-events-none transition-all">
          <div className="p-4 rounded-full bg-blue-100 text-[#0B57D0] mb-2 shadow-sm animate-bounce">
            <SolarIcon name="upload-track-2-bold-duotone" className="w-8 h-8" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">
            Drop files to send
          </h3>
          <p className="text-xs text-slate-500">
            Direct peer-to-peer transfer
          </p>
        </div>
      )}

      {/* Active Transfer Progress In-Line Notification Banner */}
      <AnimatePresence>
        {activeTransfers.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="p-3 border-b border-slate-200/80 bg-white/90 backdrop-blur-md space-y-2 z-10 shrink-0 overflow-hidden"
          >
            <AnimatePresence mode="popLayout">
              {activeTransfers.map((t) => (
                <motion.div
                  key={t.fileId}
                  initial={{ opacity: 0, y: -6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{
                    opacity: 0,
                    scale: 0.95,
                    y: -10,
                    height: 0,
                    marginBottom: 0,
                    transition: { duration: 0.35, ease: "easeInOut" },
                  }}
                  layout
                >
                  <ProgressBar
                    transfer={t}
                    onCancel={onCancelTransfer}
                    onDismiss={onDismissTransfer}
                  />
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 m3-surface-bg">
        {messages.length === 0 ? (
          <div className="h-full min-h-[300px] flex flex-col items-center justify-center text-center p-6">
            <img
              src="/logo.svg"
              alt="Sen Send"
              className="w-16 h-16 rounded-2xl object-contain mb-3 shadow-sm border border-purple-100"
            />
            <h3 className="text-base font-semibold text-slate-800 mb-1">
              Ready to Share
            </h3>
            <p className="text-xs text-slate-500 max-w-xs mb-5 leading-relaxed">
              Drop any file anywhere or type a message. Direct, secure peer-to-peer transfer.
            </p>

            <div className="flex items-center gap-2">
              <button
                onClick={onOpenQR}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <SolarIcon name="qr-code-bold-duotone" className="w-4 h-4 text-[#0B57D0]" />
                <span>Share QR</span>
              </button>
              <button
                onClick={onOpenScan}
                className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium border border-slate-200 shadow-xs flex items-center gap-1.5 transition-colors"
              >
                <SolarIcon name="camera-bold-duotone" className="w-4 h-4 text-[#0B57D0]" />
                <span>Scan Device</span>
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg) => {
            if (msg.type === "status") {
              return (
                <div
                  key={msg.id}
                  className="flex items-center justify-center my-2"
                >
                  <span className="px-3 py-1 rounded-full bg-slate-200/70 text-slate-600 text-[11px] font-medium flex items-center gap-1.5 shadow-2xs">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    <span>{msg.statusText || msg.text}</span>
                  </span>
                </div>
              );
            }

            const isSelf = msg.isSelf;

            return (
              <div
                key={msg.id}
                id={`chat-msg-${msg.id}`}
                className={`flex flex-col ${isSelf ? "items-end" : "items-start"}`}
              >
                {!isSelf && (
                  <span className="text-[11px] text-slate-500 mb-1 ml-2 font-medium">
                    {msg.senderName}
                  </span>
                )}

                {msg.type === "file" && msg.fileMeta ? (
                  <div className="max-w-md w-full">
                    <FilePreview
                      meta={msg.fileMeta}
                      blobUrl={msg.fileBlobUrl}
                      onDownload={() => onDownloadFile(msg)}
                    />
                  </div>
                ) : (
                  <div
                    className={`max-w-[85%] sm:max-w-md px-4 py-2.5 rounded-2xl shadow-xs text-sm leading-relaxed ${
                      isSelf
                        ? "bg-[#0B57D0] text-white rounded-br-xs"
                        : "bg-white text-slate-800 rounded-bl-xs border border-slate-200/80"
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                    <div
                      className={`text-[10px] mt-1 text-right font-mono ${
                        isSelf ? "text-blue-100/80" : "text-slate-400"
                      }`}
                    >
                      {new Date(msg.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </div>
                  </div>
                )}
              </div>
            );
          })
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Typing Indicator Bar */}
      {otherTypingUsers.length > 0 && (
        <div className="px-5 py-1.5 text-xs text-slate-500 flex items-center gap-2">
          <div className="flex gap-1">
            <span className="w-1.5 h-1.5 bg-[#0B57D0] rounded-full animate-bounce" />
            <span className="w-1.5 h-1.5 bg-[#0B57D0] rounded-full animate-bounce [animation-delay:0.2s]" />
            <span className="w-1.5 h-1.5 bg-[#0B57D0] rounded-full animate-bounce [animation-delay:0.4s]" />
          </div>
          <span>
            {otherTypingUsers.map((u) => u.peerName).join(", ")} typing...
          </span>
        </div>
      )}

      {/* Message & File Composer - Floating Pill (Material 3 & Apple Inspired) */}
      <div className="p-3 sm:p-4 bg-gradient-to-t from-[#F8F9FC] via-[#F8F9FC]/95 to-transparent shrink-0">
        <form
          onSubmit={handleSend}
          className="max-w-4xl mx-auto bg-white border border-slate-200/90 shadow-md shadow-slate-200/50 rounded-full p-1.5 flex items-center gap-1.5 transition-all focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100"
        >
          {/* File Attachment Button */}
          <button
            id="btn-attach-file"
            type="button"
            onClick={() => fileInputRef.current?.click()}
            title="Attach file"
            className="p-2 rounded-full text-slate-500 hover:text-[#0B57D0] hover:bg-blue-50 transition-colors shrink-0"
          >
            <SolarIcon name="paperclip-bold-duotone" className="w-5 h-5" />
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />

          {/* Text Input */}
          <input
            id="input-chat-message"
            type="text"
            placeholder="Type a message or drop files..."
            value={inputText}
            onChange={handleInputChange}
            className="flex-1 bg-transparent text-slate-800 placeholder-slate-400 text-sm px-2 py-1.5 focus:outline-none"
          />

          {/* Send Button */}
          <button
            id="btn-send-message"
            type="submit"
            disabled={!inputText.trim()}
            className={`p-2 rounded-full text-white transition-all shrink-0 ${
              inputText.trim()
                ? "bg-[#0B57D0] hover:bg-[#084298] shadow-xs cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed"
            }`}
            title="Send"
          >
            <SolarIcon name="plain-bold-duotone" className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};
