import React, { useState, useEffect } from "react";
import { FileMetadata } from "../types";
import { formatBytes, getFileIconConfig, SolarIcon } from "../lib/icons";

interface FilePreviewProps {
  meta: FileMetadata;
  blobUrl?: string;
  blob?: Blob;
  onDownload: () => void;
}

export const FilePreview: React.FC<FilePreviewProps> = ({
  meta,
  blobUrl,
  blob,
  onDownload,
}) => {
  const [textSnippet, setTextSnippet] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const ext = meta.extension.toLowerCase();
  const iconConfig = getFileIconConfig(ext, meta.type);

  const isImage = ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
  const isAudio = ["mp3", "wav", "ogg", "m4a", "flac"].includes(ext);
  const isVideo = ["mp4", "webm", "mov"].includes(ext);
  const isPdf = ext === "pdf";
  const isCodeOrText = [
    "txt",
    "js",
    "ts",
    "jsx",
    "tsx",
    "json",
    "html",
    "css",
    "py",
    "md",
    "csv",
    "sql",
    "sh",
    "yml",
    "yaml",
    "env",
    "xml",
  ].includes(ext);

  useEffect(() => {
    if (isCodeOrText && (blob || blobUrl) && !textSnippet) {
      if (blob) {
        blob.text().then((txt) => {
          setTextSnippet(txt.slice(0, 500));
        });
      } else if (blobUrl) {
        fetch(blobUrl)
          .then((r) => r.text())
          .then((txt) => setTextSnippet(txt.slice(0, 500)))
          .catch(() => {});
      }
    }
  }, [isCodeOrText, blob, blobUrl, textSnippet]);

  return (
    <div className="rounded-2xl overflow-hidden bg-white border border-slate-200/80 shadow-xs">
      {/* Visual Embedded Previews */}
      {isImage && blobUrl && (
        <div className="relative group bg-slate-50 flex items-center justify-center p-2 border-b border-slate-100">
          <img
            src={blobUrl}
            alt={meta.name}
            className="max-h-64 sm:max-h-72 w-auto max-w-full rounded-xl object-contain cursor-pointer transition-transform hover:scale-[1.01]"
            onClick={() => setLightboxOpen(true)}
          />
          <button
            onClick={() => setLightboxOpen(true)}
            className="absolute bottom-3 right-3 px-2.5 py-1 rounded-full bg-black/60 hover:bg-black/80 text-white text-xs backdrop-blur-sm flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <SolarIcon name="magnifer-bold-duotone" className="w-3.5 h-3.5" />
            Expand
          </button>
        </div>
      )}

      {isVideo && blobUrl && (
        <div className="bg-slate-900 p-1 border-b border-slate-100 flex justify-center">
          <video
            src={blobUrl}
            controls
            className="max-h-64 sm:max-h-72 w-full rounded-xl"
          />
        </div>
      )}

      {isAudio && blobUrl && (
        <div className="p-3 bg-slate-50 border-b border-slate-100 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs text-amber-700 font-medium">
            <SolarIcon name="music-note-bold-duotone" className="w-4 h-4 text-amber-600" />
            <span>Audio Preview</span>
          </div>
          <audio src={blobUrl} controls className="w-full h-9 rounded-lg" />
        </div>
      )}

      {isPdf && blobUrl && (
        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-50 text-rose-600 border border-rose-200/60">
              <SolarIcon name="document-bold-duotone" className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-semibold text-slate-800">PDF Document</span>
              <p className="text-[11px] text-slate-500 font-mono">{formatBytes(meta.size)}</p>
            </div>
          </div>
          <a
            href={blobUrl}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 text-xs font-medium rounded-full bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 shadow-xs transition-colors flex items-center gap-1"
          >
            <SolarIcon name="link-bold-duotone" className="w-3.5 h-3.5 text-rose-600" />
            Open
          </a>
        </div>
      )}

      {isCodeOrText && textSnippet && (
        <div className="p-3 bg-slate-50 border-b border-slate-100 text-xs font-mono">
          <div className="flex items-center justify-between mb-1.5 text-slate-500">
            <span className="text-[10px] uppercase font-bold text-teal-700 flex items-center gap-1">
              <SolarIcon name="code-bold-duotone" className="w-3.5 h-3.5" />
              Preview
            </span>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="text-[11px] text-[#0B57D0] hover:underline"
            >
              {isExpanded ? "Collapse" : "Expand"}
            </button>
          </div>
          <pre
            className={`p-2.5 rounded-xl bg-white border border-slate-200 text-slate-700 overflow-x-auto whitespace-pre-wrap leading-relaxed ${
              isExpanded ? "max-h-80 overflow-y-auto" : "max-h-24 overflow-hidden"
            }`}
          >
            {textSnippet}
          </pre>
        </div>
      )}

      {/* Main File Information Card with Download Action */}
      <div className="p-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="p-2 rounded-xl bg-slate-100 border border-slate-200/60 shrink-0">
            <SolarIcon
              name={iconConfig.icon}
              className={`w-5 h-5 ${iconConfig.colorClass}`}
            />
          </div>

          <div className="min-w-0">
            <h4 className="text-xs sm:text-sm font-semibold text-slate-800 truncate">
              {meta.name}
            </h4>
            <div className="flex items-center gap-1.5 text-[11px] text-slate-500 font-mono mt-0.5">
              <span
                className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold uppercase tracking-wider border ${iconConfig.badgeBg}`}
              >
                .{meta.extension || "FILE"}
              </span>
              <span>•</span>
              <span>{formatBytes(meta.size)}</span>
            </div>
          </div>
        </div>

        {/* Download Action */}
        <button
          id={`btn-download-${meta.id}`}
          onClick={onDownload}
          aria-label={`Download ${meta.name}`}
          className="shrink-0 px-3.5 py-1.5 rounded-full bg-[#0B57D0] hover:bg-[#084298] text-white font-medium text-xs flex items-center gap-1.5 shadow-xs transition-colors"
        >
          <SolarIcon name="download-bold-duotone" className="w-3.5 h-3.5 text-white" />
          <span>Download</span>
        </button>
      </div>

      {/* Fullscreen Lightbox */}
      {lightboxOpen && blobUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative max-w-4xl max-h-[85vh] flex flex-col items-center">
            <img
              src={blobUrl}
              alt={meta.name}
              className="max-h-[80vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
            <div className="mt-3 flex items-center gap-3 bg-white/95 px-4 py-2 rounded-full border border-slate-200 shadow-lg">
              <span className="text-xs text-slate-700 font-medium truncate max-w-xs">
                {meta.name}
              </span>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDownload();
                }}
                className="px-3 py-1 rounded-full bg-[#0B57D0] text-white text-xs font-medium flex items-center gap-1"
              >
                <SolarIcon name="download-bold-duotone" className="w-3.5 h-3.5" />
                Download
              </button>
              <button
                onClick={() => setLightboxOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-slate-800"
              >
                <SolarIcon name="close-circle-bold-duotone" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
