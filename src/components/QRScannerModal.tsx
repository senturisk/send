import React, { useEffect, useRef, useState } from "react";
import { scanQRCodeFromFile, scanQRCodeFromImageData } from "../lib/qr";
import { SolarIcon } from "../lib/icons";

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanned: (result: string) => void;
  onErrorNotice: (title: string, msg: string) => void;
}

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanned,
  onErrorNotice,
}) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraFacing, setCameraFacing] = useState<"environment" | "user">("environment");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const scanIntervalRef = useRef<any>(null);

  useEffect(() => {
    if (!isOpen) {
      stopCamera();
      return;
    }

    startCamera(cameraFacing);

    return () => {
      stopCamera();
    };
  }, [isOpen, cameraFacing]);

  const startCamera = async (facing: "environment" | "user") => {
    stopCamera();
    setCameraError(null);

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Camera not supported");
      }

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });

      setStream(mediaStream);

      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
      }

      const track = mediaStream.getVideoTracks()[0];
      const capabilities: any = track.getCapabilities ? track.getCapabilities() : {};
      setHasTorch(Boolean(capabilities.torch));

      scanIntervalRef.current = setInterval(scanVideoFrame, 150);
    } catch (err: any) {
      const errMsg =
        err.name === "NotAllowedError"
          ? "Camera permission denied. Upload a QR screenshot instead."
          : "Camera unavailable. Use image upload mode.";
      setCameraError(errMsg);
      onErrorNotice("Camera Unavailable", errMsg);
    }
  };

  const stopCamera = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setTorchOn(false);
  };

  const toggleTorch = async () => {
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    try {
      await (track as any).applyConstraints({
        advanced: [{ torch: !torchOn }],
      });
      setTorchOn(!torchOn);
    } catch (e) {
      console.warn("Torch toggle failed:", e);
    }
  };

  const toggleFacing = () => {
    setCameraFacing((prev) => (prev === "environment" ? "user" : "environment"));
  };

  const scanVideoFrame = () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState !== video.HAVE_ENOUGH_DATA) return;

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const result = scanQRCodeFromImageData(imageData);

    if (result) {
      stopCamera();
      onScanned(result);
      onClose();
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await scanQRCodeFromFile(file);
      if (result) {
        stopCamera();
        onScanned(result);
        onClose();
      } else {
        onErrorNotice("No QR Detected", "No valid QR code found in the image.");
      }
    } catch {
      onErrorNotice("File Error", "Could not process image for QR code.");
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="modal-qr-scanner"
      className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-3xl bg-white border border-slate-200/80 shadow-2xl p-5 relative overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h3 className="font-semibold text-slate-800 text-sm sm:text-base">
              Scan QR Code
            </h3>
            <p className="text-xs text-slate-500">
              Point camera at peer screen
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <SolarIcon name="close-circle-bold-duotone" className="w-5 h-5" />
          </button>
        </div>

        {/* Viewfinder Area */}
        <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-slate-900 flex items-center justify-center border border-slate-200">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Targeting box */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-white/80 rounded-2xl relative shadow-lg">
              <div className="absolute -top-0.5 -left-0.5 w-5 h-5 border-t-4 border-l-4 border-[#0B57D0] rounded-tl-xl" />
              <div className="absolute -top-0.5 -right-0.5 w-5 h-5 border-t-4 border-r-4 border-[#0B57D0] rounded-tr-xl" />
              <div className="absolute -bottom-0.5 -left-0.5 w-5 h-5 border-b-4 border-l-4 border-[#0B57D0] rounded-bl-xl" />
              <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 border-b-4 border-r-4 border-[#0B57D0] rounded-br-xl" />
            </div>
          </div>

          {/* Camera controls overlay */}
          <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between px-3 py-1.5 rounded-full bg-black/50 backdrop-blur-md text-xs text-white">
            <button
              onClick={toggleFacing}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 hover:bg-white/30 transition-colors"
            >
              <SolarIcon name="refresh-bold-duotone" className="w-3.5 h-3.5" />
              <span>Flip</span>
            </button>

            {hasTorch && (
              <button
                onClick={toggleTorch}
                className={`flex items-center gap-1.5 px-3 py-1 rounded-full transition-colors ${
                  torchOn ? "bg-amber-400 text-slate-900 font-semibold" : "bg-white/20 hover:bg-white/30 text-white"
                }`}
              >
                <SolarIcon name="bolt-bold-duotone" className="w-3.5 h-3.5" />
                <span>Torch</span>
              </button>
            )}
          </div>

          {cameraError && (
            <div className="absolute inset-0 bg-slate-900/90 p-4 flex flex-col items-center justify-center text-center">
              <SolarIcon name="danger-triangle-bold-duotone" className="w-8 h-8 text-amber-400 mb-2" />
              <p className="text-xs text-white font-medium mb-1">Camera Inactive</p>
              <p className="text-[11px] text-slate-300 max-w-xs">{cameraError}</p>
            </div>
          )}
        </div>

        {/* Upload Fallback */}
        <div className="mt-3.5 pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">Scan from photo</span>

          <label
            htmlFor="qr-file-upload-input"
            className="cursor-pointer px-3.5 py-1.5 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors"
          >
            <SolarIcon name="gallery-bold-duotone" className="w-4 h-4 text-[#0B57D0]" />
            <span>Choose Image</span>
            <input
              id="qr-file-upload-input"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
        </div>
      </div>
    </div>
  );
};
