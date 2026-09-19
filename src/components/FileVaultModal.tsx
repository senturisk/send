import React, { useEffect, useState } from "react";
import { getAllVaultFiles, deleteVaultFile, StoredFile } from "../lib/storage";
import { formatBytes, getFileIconConfig, SolarIcon } from "../lib/icons";

interface FileVaultModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNotify: (title: string, msg: string, type: any) => void;
  onDeleteFile?: (fileId: string, fileName: string) => void;
}

export const FileVaultModal: React.FC<FileVaultModalProps> = ({
  isOpen,
  onClose,
  onNotify,
  onDeleteFile,
}) => {
  const [files, setFiles] = useState<StoredFile[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const refreshVault = async () => {
    const list = await getAllVaultFiles();
    list.sort((a, b) => b.savedAt - a.savedAt);
    setFiles(list);
  };

  useEffect(() => {
    if (isOpen) {
      refreshVault();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const filteredFiles = files.filter((f) => {
    const matchesSearch = f.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "all") return true;
    const ext = f.extension.toLowerCase();
    if (filter === "images") return ["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext);
    if (filter === "docs") return ["pdf", "doc", "docx", "txt", "md"].includes(ext);
    if (filter === "media") return ["mp3", "wav", "mp4", "webm", "m4a"].includes(ext);
    return true;
  });

  const totalVaultBytes = files.reduce((acc, f) => acc + f.size, 0);

  const handleDownload = (file: StoredFile) => {
    const url = URL.createObjectURL(file.blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    onNotify("File Saved", `Downloaded ${file.name}`, "success");
  };

  const handleDelete = async (id: string, name: string) => {
    await deleteVaultFile(id);
    await refreshVault();
    onDeleteFile?.(id, name);
    onNotify("File Removed", `Removed ${name} from storage`, "info");
  };

  return (
    <div
      id="modal-file-vault"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-xl rounded-3xl bg-white border border-slate-200/80 shadow-2xl p-5 sm:p-6 relative overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-2xl bg-amber-50 text-amber-600 border border-amber-100">
              <SolarIcon name="folder-with-files-bold-duotone" className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800 text-base">
                Saved Files
              </h3>
              <p className="text-xs text-slate-500">
                {files.length} items • {formatBytes(totalVaultBytes)}
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

        {/* Filter bar */}
        <div className="py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100">
          <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-200/80 w-full sm:w-56">
            <SolarIcon name="magnifer-bold-duotone" className="w-4 h-4 text-slate-400 shrink-0" />
            <input
              type="text"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-transparent text-xs text-slate-800 placeholder-slate-400 focus:outline-none w-full"
            />
          </div>

          <div className="flex items-center gap-1">
            {["all", "images", "docs", "media"].map((cat) => (
              <button
                key={cat}
                onClick={() => setFilter(cat)}
                className={`px-3 py-1 rounded-full text-xs capitalize transition-colors ${
                  filter === cat
                    ? "bg-[#0B57D0] text-white font-medium"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* File list */}
        <div className="flex-1 overflow-y-auto py-2 space-y-1.5 pr-1">
          {filteredFiles.length === 0 ? (
            <div className="py-12 text-center text-slate-400 flex flex-col items-center gap-2">
              <SolarIcon name="box-minimalistic-bold-duotone" className="w-8 h-8 text-slate-300" />
              <p className="text-sm font-medium text-slate-600">No saved files</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Files transferred in chat will automatically appear here for offline access
              </p>
            </div>
          ) : (
            filteredFiles.map((file) => {
              const iconConfig = getFileIconConfig(file.extension, file.type);
              const dateStr = new Date(file.savedAt).toLocaleDateString();

              return (
                <div
                  key={file.id}
                  className="p-2.5 rounded-2xl bg-white hover:bg-slate-50 border border-slate-200/80 flex items-center justify-between gap-3 transition-colors shadow-2xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="p-2 rounded-xl bg-slate-100 shrink-0">
                      <SolarIcon
                        name={iconConfig.icon}
                        className={`w-4 h-4 ${iconConfig.colorClass}`}
                      />
                    </div>
                    <div className="min-w-0">
                      <h4 className="text-xs font-semibold text-slate-800 truncate">
                        {file.name}
                      </h4>
                      <div className="flex items-center gap-1.5 text-[11px] font-mono text-slate-500">
                        <span className="uppercase font-medium text-slate-600">.{file.extension}</span>
                        <span>•</span>
                        <span>{formatBytes(file.size)}</span>
                        <span>•</span>
                        <span>{dateStr}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      onClick={() => handleDownload(file)}
                      className="px-2.5 py-1 rounded-full bg-[#0B57D0] hover:bg-[#084298] text-white text-xs font-medium flex items-center gap-1 transition-colors shadow-2xs"
                    >
                      <SolarIcon name="download-bold-duotone" className="w-3.5 h-3.5 text-white" />
                      <span>Save</span>
                    </button>
                    <button
                      onClick={() => handleDelete(file.id, file.name)}
                      className="p-1.5 rounded-full text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      title="Delete"
                    >
                      <SolarIcon name="trash-bin-trash-bold-duotone" className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
