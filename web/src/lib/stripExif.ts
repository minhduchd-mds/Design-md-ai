/**
 * stripExif — Remove EXIF / metadata from image files before upload.
 *
 * Uses Canvas re-encoding: draws the image onto a fresh canvas, then exports
 * a clean data URL with no embedded metadata (GPS coords, camera info, etc.).
 *
 * Only processes image/* MIME types. Non-image files pass through unchanged.
 */

/**
 * Strip EXIF and other metadata from an image data URL by re-encoding via Canvas.
 *
 * @param dataUrl  - The original data URL (e.g. from FileReader.readAsDataURL)
 * @param mimeType - The file's MIME type (e.g. "image/jpeg", "image/png")
 * @returns A clean data URL with metadata stripped. Non-image types return unchanged.
 */
export function stripExif(dataUrl: string, mimeType: string): Promise<string> {
  // Only strip metadata from images
  if (!mimeType.startsWith("image/")) return Promise.resolve(dataUrl);

  // SVGs are text-based, can't be re-encoded via Canvas meaningfully
  if (mimeType === "image/svg+xml") return Promise.resolve(dataUrl);

  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(dataUrl); // Fallback: return original if canvas unavailable
          return;
        }
        ctx.drawImage(img, 0, 0);
        // JPEG: slight quality loss is acceptable for metadata stripping
        // PNG/WebP: lossless re-encode
        const quality = mimeType === "image/jpeg" ? 0.92 : undefined;
        resolve(canvas.toDataURL(mimeType, quality));
      } catch {
        resolve(dataUrl); // Fallback on any canvas error
      }
    };
    img.onerror = () => resolve(dataUrl); // Fallback: don't break upload on decode failure
    img.src = dataUrl;
  });
}
