import React, { useEffect, useState, useMemo } from "react";
import {
  getAllVaultFiles,
  deleteVaultFile,
  deleteMultipleVaultFiles,
  clearAllVaultFiles,
  StoredFile,
} from "../lib/storage";
import { formatBytes, getFileIconConfig, SolarIcon } from "../lib/icons";

interface FileVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (title: string, msg: string, type: any) => void;
  onDeleteFile?: (fileId: string, fileName: string) => void;
  onDeleteMultipleFiles?: (fileIds: string[]) => void;
  onClearAllFiles?: () => void;
}

export const FileVaultModal: React.FC<FileVaultModalProps> = ({
  isOpen,
  onClose,
  onNotify,
  onDeleteFile,
  onDeleteMultipleFiles,
  onClearAllFiles,
}) => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [showClearConfirm, setShowClearConfirm] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "size" | "name">("newest");

  const refreshVault = async () => {
    const list = await getAllVaultFiles();
    setFiles(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshVault();
      setSelectedIds(new Set());
      setShowClearConfirm(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Filtered & Sorted files list
  const processedFiles = files
    .filter((f) => {
      const q = search.toLowerCase().trim();
      const matchesSearch =
        !q ||
        f.name.toLowerCase().includes(q) ||
        (f.roomId && f.roomId.toLowerCase().includes(q)) ||
        (f.senderName && f.senderName.toLowerCase().includes(q));
      if (!matchesSearch) return false;

      if (filter === "all") return true;
      const ext = f.extension.toLowerCase();
      if (filter === "images") return ["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext);
      if (filter === "docs") return ["pdf", "doc", "docx", "txt", "md", "csv", "xlsx", "pptx"].includes(ext);
      if (filter === "media") return ["mp3", "wav", "mp4", "webm", "m4a", "ogg", "mov", "mkv"].includes(ext);
      return true;
    })
    .sort((a, b) => {
      if (sortBy === "newest") return b.savedAt - a.savedAt;
      if (sortBy === "oldest") return a.savedAt - b.savedAt;
      if (sortBy === "size") return b.size - a.size;
      if (sortBy === "name") return a.name.localeCompare(b.name);
      return 0;
    });

  const totalVaultBytes = files.reduce((acc, f) => acc + f.size, 0);

  const selectedFiles = files.filter((f) => selectedIds.has(f.id));
  const selectedBytes = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const isAllSelected =
    processedFiles.length > 0 &&
    processedFiles.every((f) => selectedIds.has(f.id));

  const handleToggleSelectAll = () => {
    if (isAllSelected) {
      // Deselect all
      setSelectedIds(new Set());
    } else {
      // Select all currently visible filtered files
      const newSet = new Set(selectedIds);
      processedFiles.forEach((f) => newSet.add(f.id));
      setSelectedIds(newSet);
    }
  };

  const handleToggleSelectFile = (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleDownload = (file: StoredFile) => {
    try {
      const url = URL.createObjectURL(file.blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      onNotify("File Downloaded", `Saved ${file.name}`, "success");
    } catch (err: any) {
      onNotify("Download Failed", err?.message || "Could not download file", "error");
    }
  };

  const handleDownloadSelected = () => {
    if (selectedFiles.length === 0) return;
    selectedFiles.forEach((file, idx) => {
      setTimeout(() => {
        const url = URL.createObjectURL(file.blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = file.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
      }, idx * 250);
    });
    onNotify("Downloading", `Downloading ${selectedFiles.length} files...`, "info");
  };

  const handleDeleteSingle = async (id: string, name: string) => {
    await deleteVaultFile(id);
    await refreshVault();
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
    onDeleteFile?.(id, name);
    onNotify("File Removed", `Removed ${name} from persistent vault`, "info");
  };

  const handleDeleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;

    await deleteMultipleVaultFiles(ids);
    await refreshVault();
    setSelectedIds(new Set());
    onDeleteMultipleFiles?.(ids);
    onNotify("Files Removed", `Removed ${ids.length} files from persistent vault`, "info");
  };

  const handleClearAll = async () => {
    await clearAllVaultFiles();
    await refreshVault();
    setSelectedIds(new Set());
    setShowClearConfirm(false);
    onClearAllFiles?.();
    onNotify("Storage Cleared", "Cleared all persistent storage files", "info");
  };

  const formatTimestamp = (timestamp: number) => {
    if (!timestamp) return "Unknown date";
    const date = new Date(timestamp);
    const dateStr = date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    const timeStr = date.toLocaleTimeString(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
    return `${dateStr} • ${timeStr}`;
  };

  return (
    <div
      id="modal-file-vault"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl rounded-3xl bg-white border border-slate-200/90 shadow-2xl p-5 sm:p-6 relative overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3.5 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100/80">
              <SolarIcon name="folder-with-files-bold-duotone" className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-slate-900 text-base">
                  Persistent Storage History
                </h3>
                <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-[11px] font-medium">
                  {files.length} {files.length === 1 ? "file" : "files"}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                All files saved in browser storage • Total {formatBytes(totalVaultBytes)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            {files.length > 0 && !showClearConfirm && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="px-2.5 py-1 text-xs font-medium text-rose-600 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors flex items-center gap-1 border border-rose-100"
                title="Clear all stored files"
              >
                <SolarIcon name="trash-bin-trash-bold-duotone" className="w-3.5 h-3.5" />
                <span>Clear All</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <SolarIcon name="close-circle-bold-duotone" className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Clear All Confirmation Banner */}
        {showClearConfirm && (
          <div className="mt-3 p-3 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 text-rose-800">
              <SolarIcon name="danger-triangle-bold-duotone" className="w-4 h-4 text-rose-600 shrink-0" />
              <span>Are you sure you want to permanently clear all {files.length} stored files?</span>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-2.5 py-1 rounded-lg bg-white text-slate-700 hover:bg-slate-100 font-medium border border-slate-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearAll}
                className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-medium transition-colors shadow-2xs"
              >
                Yes, Clear All
              </button>
            </div>
          </div>
        )}

        {/* Search, Filter & Sort Controls */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200/80 w-full sm:max-w-xs">
              <SolarIcon name="magnifer-bold-duotone" className="w-4 h-4 text-slate-400 shrink-0" />
              <input
                type="text"
                placeholder="Search file name, room, sender..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  className="text-slate-400 hover:text-slate-600"
                >
                  <SolarIcon name="close-circle-bold-duotone" className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {/* Filter Pills */}
            <div className="flex items-center gap-1 bg-slate-100/70 p-0.5 rounded-full">
              {["all", "images", "docs", "media"].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilter(cat)}
                  className={`px-2.5 py-1 rounded-full text-xs capitalize transition-colors ${
                    filter === cat
                      ? "bg-white text-slate-800 font-medium shadow-2xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <select
              value={sortBy}
              onChange={(e: any) => setSortBy(e.target.value)}
              className="bg-slate-50 border border-slate-200 text-slate-700 text-xs rounded-xl px-2.5 py-1 focus:outline-none focus:ring-1 focus:ring-[#0B57D0]"
            >
              <option value="newest">Newest First</option>
              <option value="oldest">Oldest First</option>
              <option value="size">Largest Size</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>

        {/* Multi-Select Action Toolbar */}
        {files.length > 0 && (
          <div className="py-2 px-1 flex items-center justify-between gap-2 border-b border-slate-100 text-xs">
            <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium hover:text-slate-900">
              <input
                type="checkbox"
                checked={isAllSelected}
                onChange={handleToggleSelectAll}
                className="w-4 h-4 rounded text-[#0B57D0] focus:ring-[#0B57D0] border-slate-300 accent-[#0B57D0] cursor-pointer"
              />
              <span>
                {selectedIds.size > 0
                  ? `Selected ${selectedIds.size} of ${processedFiles.length}`
                  : `Select All (${processedFiles.length})`}
              </span>
            </label>

            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-mono text-[11px] hidden sm:inline">
                  {formatBytes(selectedBytes)}
                </span>
                <button
                  onClick={handleDownloadSelected}
                  className="px-2.5 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium flex items-center gap-1 transition-colors"
                >
                  <SolarIcon name="download-bold-duotone" className="w-3.5 h-3.5" />
                  <span>Download</span>
                </button>
                <button
                  onClick={handleDeleteSelected}
                  className="px-2.5 py-1 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-medium flex items-center gap-1 transition-colors shadow-2xs"
                >
                  <SolarIcon name="trash-bin-trash-bold-duotone" className="w-3.5 h-3.5 text-white" />
                  <span>Delete ({selectedIds.size})</span>
                </button>
              </div>
            )}
          </div>
        )}

        {/* File list */}
        <div className="flex-1 overflow-y-auto py-2.5 space-y-2 pr-1">
          {processedFiles.length === 0 ? (
            <div className="py-14 text-center text-slate-400 flex flex-col items-center gap-2.5">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 flex items-center justify-center border border-slate-100 text-slate-400">
                <SolarIcon name="box-minimalistic-bold-duotone" className="w-6 h-6" />
              </div>
              <p className="text-sm font-medium text-slate-700">No stored files found</p>
              <p className="text-xs text-slate-400 max-w-sm">
                Files sent or received in any room are automatically cached in browser persistent storage for full offline access.
              </p>
            </div>
          ) : (
            processedFiles.map((file) => {
              const iconConfig = getFileIconConfig(file.extension, file.type);
              const isSelected = selectedIds.has(file.id);

              return (
                <div
                  key={file.id}
                  onClick={() => handleToggleSelectFile(file.id)}
                  className={`p-3 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? "bg-blue-50/50 border-blue-200 shadow-xs"
                      : "bg-white hover:bg-slate-50/80 border-slate-200/80 shadow-2xs"
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0 flex-1">
                    {/* Checkbox */}
                    <div
                      className="shrink-0 flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleSelectFile(file.id)}
                        className="w-4 h-4 rounded text-[#0B57D0] focus:ring-[#0B57D0] border-slate-300 accent-[#0B57D0] cursor-pointer"
                      />
                    </div>

                    {/* File Icon */}
                    <div className="p-2.5 rounded-xl bg-slate-100 shrink-0">
                      <SolarIcon
                        name={iconConfig.icon}
                        className={`w-5 h-5 ${iconConfig.colorClass}`}
                      />
                    </div>

                    {/* File Details */}
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-xs sm:text-sm font-semibold text-slate-900 truncate">
                          {file.name}
                        </h4>
                      </div>

                      {/* Meta badges: Room Code, Timestamp, Size, Sender */}
                      <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-slate-500 font-mono">
                        <span className="uppercase font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.2 rounded text-[10px]">
                          .{file.extension}
                        </span>
                        <span>•</span>
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>

                        {/* Room Code Badge */}
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200/60 text-[10px] font-medium font-sans">
                          <SolarIcon name="hashtag-bold-duotone" className="w-3 h-3 text-blue-500" />
                          Room {file.roomId || "Direct"}
                        </span>

                        <span>•</span>

                        {/* Timestamp */}
                        <span
                          className="text-slate-600 font-sans"
                          title={new Date(file.savedAt).toString()}
                        >
                          {formatTimestamp(file.savedAt)}
                        </span>

                        {file.senderName && (
                          <>
                            <span>•</span>
                            <span className="text-slate-500 font-sans">
                              From: {file.senderName}
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      onClick={() => handleDownload(file)}
                      className="px-2.5 py-1 rounded-full bg-[#0B57D0] hover:bg-[#084298] text-white text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs"
                      title="Download file to device"
                    >
                      <SolarIcon name="download-bold-duotone" className="w-3.5 h-3.5 text-white" />
                      <span className="hidden sm:inline">Save</span>
                    </button>
                    <button
                      onClick={() => handleDeleteSingle(file.id, file.name)}
                      className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete from storage"
                    >
                      <SolarIcon name="trash-bin-trash-bold-duotone" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>IndexedDB Persistent Storage</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
