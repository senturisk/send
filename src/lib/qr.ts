import QRCode from "qrcode";
import jsQR from "jsqr";

/**
 * Generate a QR Code as Data URL with high contrast IBM styling
 */
export async function generateQRCode(
  text: string,
  options?: {
    darkColor?: string;
    lightColor?: string;
    width?: number;
  }
): Promise<string> {
  const dark = options?.darkColor || "#0f62fe";
  const light = options?.lightColor || "#ffffff";
  const width = options?.width || 320;

  try {
    const dataUrl = await QRCode.toDataURL(text, {
      width,
      margin: 2,
      color: {
        dark,
        light,
      },
      errorCorrectionLevel: "M",
    });
    return dataUrl;
  } catch (err) {
    console.error("QR Code generation error:", err);
    throw err;
  }
}

/**
 * Scan QR Code from an image element or canvas
 */
export function scanQRCodeFromImageData(
  imageData: ImageData
): string | null {
  const code = jsQR(imageData.data, imageData.width, imageData.height, {
    inversionAttempts: "attemptBoth",
  });
  return code ? code.data : null;
}

/**
 * Scan QR Code from an uploaded file (Blob / File)
 */
export async function scanQRCodeFromFile(file: File): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);
        const imageData = ctx.getImageData(0, 0, img.width, img.height);
        const result = scanQRCodeFromImageData(imageData);
        resolve(result);
      };
      img.onerror = () => resolve(null);
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error("Failed to read image file"));
    reader.readAsDataURL(file);
  });
}
