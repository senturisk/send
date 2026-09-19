import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faShareNodes,
  faChevronDown,
  faCopy,
  faQrcode,
  faCamera,
  faMobileScreenButton,
  faLaptop,
  faTabletScreenButton,
  faDesktop,
  faFolderOpen,
  faTableColumns,
  faUsers,
  faUserPlus,
  faUserMinus,
  faXmark,
  faCircleCheck,
  faTriangleExclamation,
  faShieldHalved,
  faCircleInfo,
  faDownload,
  faMagnifyingGlass,
  faMusic,
  faVideo,
  faFileLines,
  faLink,
  faCode,
  faFileZipper,
  faMicrochip,
  faFile,
  faArrowsRotate,
  faBolt,
  faImage,
  faPen,
  faTrashCan,
  faBoxArchive,
  faCloudArrowUp,
  faPaperclip,
  faPaperPlane,
  faCircleNodes,
  IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

interface IconProps {
  name: string;
  className?: string;
  size?: number | string;
  color?: string;
}

const iconMap: Record<string, IconDefinition> = {
  // Transmissions / P2P
  "transmission-bold-duotone": faShareNodes,
  "transmission": faShareNodes,
  "circle-nodes": faCircleNodes,
  "share-nodes": faShareNodes,

  // Navigation & Chevrons
  "alt-arrow-down-bold-duotone": faChevronDown,
  "chevron-down": faChevronDown,

  // Actions
  "copy-bold-duotone": faCopy,
  "copy": faCopy,
  "qr-code-bold-duotone": faQrcode,
  "qr-code": faQrcode,
  "camera-bold-duotone": faCamera,
  "camera": faCamera,
  "refresh-bold-duotone": faArrowsRotate,
  "refresh": faArrowsRotate,
  "bolt-bold-duotone": faBolt,
  "bolt": faBolt,
  "download-bold-duotone": faDownload,
  "download": faDownload,
  "magnifer-bold-duotone": faMagnifyingGlass,
  "search": faMagnifyingGlass,
  "pen-bold-duotone": faPen,
  "pen": faPen,
  "trash-bin-trash-bold-duotone": faTrashCan,
  "trash": faTrashCan,
  "paperclip-bold-duotone": faPaperclip,
  "paperclip": faPaperclip,
  "plain-bold-duotone": faPaperPlane,
  "send": faPaperPlane,
  "upload-track-2-bold-duotone": faCloudArrowUp,
  "upload": faCloudArrowUp,
  "link-bold-duotone": faLink,
  "link": faLink,

  // Devices
  "smartphone-bold-duotone": faMobileScreenButton,
  "smartphone": faMobileScreenButton,
  "mobile": faMobileScreenButton,
  "laptop-bold-duotone": faLaptop,
  "laptop": faLaptop,
  "tablet-bold-duotone": faTabletScreenButton,
  "tablet": faTabletScreenButton,
  "monitor-bold-duotone": faDesktop,
  "monitor": faDesktop,
  "desktop": faDesktop,

  // Folders & UI
  "folder-with-files-bold-duotone": faFolderOpen,
  "folder": faFolderOpen,
  "sidebar-minimalistic-bold-duotone": faTableColumns,
  "sidebar": faTableColumns,
  "box-minimalistic-bold-duotone": faBoxArchive,
  "box": faBoxArchive,

  // Users & Status
  "users-group-rounded-bold-duotone": faUsers,
  "users": faUsers,
  "user-plus-bold-duotone": faUserPlus,
  "user-plus": faUserPlus,
  "user-cross-bold-duotone": faUserMinus,
  "user-cross": faUserMinus,
  "close-circle-bold-duotone": faXmark,
  "close": faXmark,
  "check-circle-bold-duotone": faCircleCheck,
  "check": faCircleCheck,
  "danger-triangle-bold-duotone": faTriangleExclamation,
  "warning": faTriangleExclamation,
  "shield-warning-bold-duotone": faShieldHalved,
  "info-circle-bold-duotone": faCircleInfo,
  "info": faCircleInfo,

  // File Types
  "gallery-bold-duotone": faImage,
  "image": faImage,
  "music-note-bold-duotone": faMusic,
  "music": faMusic,
  "videocamera-record-bold-duotone": faVideo,
  "video": faVideo,
  "document-bold-duotone": faFileLines,
  "document": faFileLines,
  "clipboard-text-bold-duotone": faFileLines,
  "code-bold-duotone": faCode,
  "code": faCode,
  "archive-bold-duotone": faFileZipper,
  "archive": faFileZipper,
  "cpu-bold-duotone": faMicrochip,
  "cpu": faMicrochip,
  "file-bold-duotone": faFile,
  "file": faFile,
};

/**
 * FontAwesome Icon Component (with SolarIcon backward-compatible alias)
 * Renders crisp, reliable offline FontAwesome icons everywhere.
 */
export const SolarIcon: React.FC<IconProps> = ({
  name,
  className = "w-5 h-5",
  size,
  color,
}) => {
  const cleanName = name.replace(/^solar:/, "").toLowerCase();
  const iconDef = iconMap[cleanName] || iconMap[name] || faFile;

  return (
    <FontAwesomeIcon
      icon={iconDef}
      className={`inline-block shrink-0 transition-colors ${className}`}
      style={{
        ...(color ? { color } : {}),
        ...(size ? { fontSize: typeof size === "number" ? `${size}px` : size } : {}),
      }}
    />
  );
};

export const FAIcon = SolarIcon;

/**
 * Returns color-coded icon configuration based on file extension
 */
export function getFileIconConfig(extension: string, mimeType: string = ""): {
  icon: string;
  colorClass: string;
  badgeBg: string;
  category: string;
} {
  const ext = extension.toLowerCase().replace(".", "");

  // Images
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp", "ico", "tiff"].includes(ext) || mimeType.startsWith("image/")) {
    return {
      icon: "gallery-bold-duotone",
      colorClass: "text-emerald-600",
      badgeBg: "bg-emerald-50 text-emerald-700 border-emerald-200/80",
      category: "Image",
    };
  }

  // Audio
  if (["mp3", "wav", "ogg", "m4a", "flac", "aac", "wma"].includes(ext) || mimeType.startsWith("audio/")) {
    return {
      icon: "music-note-bold-duotone",
      colorClass: "text-amber-600",
      badgeBg: "bg-amber-50 text-amber-800 border-amber-200/80",
      category: "Audio",
    };
  }

  // Video
  if (["mp4", "webm", "mkv", "avi", "mov", "wmv", "flv"].includes(ext) || mimeType.startsWith("video/")) {
    return {
      icon: "videocamera-record-bold-duotone",
      colorClass: "text-purple-600",
      badgeBg: "bg-purple-50 text-purple-700 border-purple-200/80",
      category: "Video",
    };
  }

  // PDF
  if (ext === "pdf" || mimeType.includes("pdf")) {
    return {
      icon: "document-bold-duotone",
      colorClass: "text-rose-600",
      badgeBg: "bg-rose-50 text-rose-700 border-rose-200/80",
      category: "PDF Document",
    };
  }

  // Code / Web / Scripts
  if (["js", "ts", "jsx", "tsx", "html", "css", "json", "py", "sh", "sql", "cpp", "c", "java", "go", "rs", "php"].includes(ext)) {
    return {
      icon: "code-bold-duotone",
      colorClass: "text-teal-600",
      badgeBg: "bg-teal-50 text-teal-700 border-teal-200/80",
      category: "Source Code",
    };
  }

  // Documents / Office
  if (["doc", "docx", "txt", "rtf", "md", "csv", "xls", "xlsx", "ppt", "pptx", "odt", "ods"].includes(ext)) {
    return {
      icon: "clipboard-text-bold-duotone",
      colorClass: "text-blue-600",
      badgeBg: "bg-blue-50 text-blue-700 border-blue-200/80",
      category: "Document",
    };
  }

  // Archives
  if (["zip", "rar", "7z", "tar", "gz", "bz2", "xz", "iso"].includes(ext)) {
    return {
      icon: "archive-bold-duotone",
      colorClass: "text-amber-700",
      badgeBg: "bg-amber-50 text-amber-800 border-amber-200/80",
      category: "Archive",
    };
  }

  // Executables / Binaries / Packages
  if (["exe", "dmg", "apk", "deb", "rpm", "bin"].includes(ext)) {
    return {
      icon: "cpu-bold-duotone",
      colorClass: "text-indigo-600",
      badgeBg: "bg-indigo-50 text-indigo-700 border-indigo-200/80",
      category: "Binary Executable",
    };
  }

  // Unknown or generic
  return {
    icon: "file-bold-duotone",
    colorClass: "text-slate-600",
    badgeBg: "bg-slate-100 text-slate-700 border-slate-200",
    category: ext ? `.${ext.toUpperCase()}` : "Generic File",
  };
}

/**
 * Format bytes into human readable format
 */
export function formatBytes(bytes: number, decimals: number = 1): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
