import React, { useState, useEffect } from "react";
import { FileTransferProgress } from "../types";
import { formatBytes, getFileIconConfig, SolarIcon } from "../lib/icons";

interface ProgressBarProps {
  transfer: FileTransferProgress;
  onCancel?: (fileId: string) => void;
  onDownload?: (transfer: FileTransferProgress) => void;
  onDismiss?: (fileId: string) => void;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({
  transfer,
  onCancel,
  onDownload,
  onDismiss,
}) => {
  const [isFading, setIsFading] = useState(false);

  const percent =
    transfer.totalBytes > 0
      ? Math.min(100, Math.round((transfer.transferredBytes / transfer.totalBytes) * 100))
      : 0;

  const iconConfig = getFileIconConfig(transfer.extension, transfer.type);
  const isUpload = transfer.direction === "upload";
  const isCompleted = transfer.status === "completed";
  const isCancelled = transfer.status === "cancelled";
  const isError = transfer.status === "error";

  // When transfer completes, hold the completion state briefly so the user sees 100%,
  // then smoothly fade away and notify parent to remove the static notification
  useEffect(() => {
    if (isCompleted) {
      const fadeTimer = setTimeout(() => {
        setIsFading(true);
      }, 1000);

      const removeTimer = setTimeout(() => {
        onDismiss?.(transfer.fileId);
      }, 1500);

      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(removeTimer);
      };
    } else {
      setIsFading(false);
    }
  }, [isCompleted, transfer.fileId, onDismiss]);

  return (
    <div
      id={`transfer-progress-${transfer.fileId}`}
      className={`p-3 rounded-2xl bg-white border border-slate-200/80 shadow-sm text-xs transition-all duration-500 ease-in-out flex flex-col gap-2 ${
        isFading
          ? "opacity-0 -translate-y-2 scale-[0.98] pointer-events-none"
          : "opacity-100 scale-100 translate-y-0"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200/60 shrink-0">
            <SolarIcon
              name={iconConfig.icon}
              className={`w-4 h-4 ${iconConfig.colorClass}`}
            />
          </div>
          <div className="min-w-0">
            <h5 className="font-semibold text-slate-800 truncate text-xs">
              {transfer.name}
            </h5>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono">
              <span className="uppercase font-medium text-slate-600">{transfer.extension || "FILE"}</span>
              <span>•</span>
              <span>{formatBytes(transfer.totalBytes)}</span>
              {!isCompleted && !isCancelled && transfer.speedBps > 0 && (
                <>
                  <span>•</span>
                  <span className="text-[#0B57D0]">{formatBytes(transfer.speedBps)}/s</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Status Pill */}
        <div className="shrink-0 flex items-center gap-2">
          {isCompleted ? (
            <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/60 flex items-center gap-1">
              <SolarIcon name="check-circle-bold-duotone" className="w-3.5 h-3.5 text-emerald-600" />
              {isUpload ? "Uploaded" : "Complete"}
            </span>
          ) : isCancelled ? (
            <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-slate-100 text-slate-600">
              Cancelled
            </span>
          ) : isError ? (
            <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-rose-50 text-rose-700 border border-rose-200/60">
              Failed
            </span>
          ) : (
            <span className="px-2.5 py-0.5 text-[11px] font-medium rounded-full bg-blue-50 text-[#0B57D0] border border-blue-200/60 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#0B57D0] animate-pulse" />
              {isUpload ? "Sending" : "Receiving"} {percent}%
            </span>
          )}

          {!isCompleted && !isCancelled && onCancel && (
            <button
              onClick={() => onCancel(transfer.fileId)}
              className="p-1 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              title="Cancel transfer"
            >
              <SolarIcon name="close-circle-bold-duotone" className="w-4 h-4" />
            </button>
          )}

          {/* Dismiss button for completed/cancelled/failed */}
          {(isCompleted || isCancelled || isError) && onDismiss && (
            <button
              onClick={() => onDismiss(transfer.fileId)}
              className="p-1 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
              title="Dismiss notification"
            >
              <SolarIcon name="close-circle-bold-duotone" className="w-4 h-4" />
            </button>
          )}

          {isCompleted && transfer.blobUrl && onDownload && (
            <button
              onClick={() => onDownload(transfer)}
              className="px-2.5 py-1 rounded-full bg-[#0B57D0] hover:bg-[#084298] text-white text-[11px] font-medium flex items-center gap-1 transition-colors"
            >
              <SolarIcon name="download-bold-duotone" className="w-3.5 h-3.5" />
              Save
            </button>
          )}
        </div>
      </div>

      {/* Progress Track */}
      <div className="relative w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
        <div
          className={`h-full transition-all duration-200 rounded-full ${
            isCompleted
              ? "bg-emerald-500"
              : isCancelled || isError
              ? "bg-rose-500"
              : "bg-[#0B57D0]"
          }`}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
};
