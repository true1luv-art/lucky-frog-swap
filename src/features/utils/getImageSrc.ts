export type ImageImport =
  | string
  | { src: string; width?: number; height?: number }
  | { default: string | { src: string } }
  | null
  | undefined;

export function getImageSrc(image: ImageImport): string {
  if (!image) return "";

  if (typeof image === "string") return image;

  if (typeof image === "object" && "src" in (image as object)) {
    const src = (image as { src: string | { src: string } }).src;
    if (typeof src === "object" && src && "src" in src) {
      return src.src;
    }
    return typeof src === "string" ? src : "";
  }

  if (typeof image === "object" && "default" in image) {
    const defaultExport = image.default;
    if (typeof defaultExport === "string") return defaultExport;
    if (
      typeof defaultExport === "object" &&
      defaultExport &&
      "src" in defaultExport
    ) {
      return defaultExport.src;
    }
  }

  return String(image);
}

export const img = getImageSrc;

export function isValidImageSrc(image: unknown): image is ImageImport {
  if (!image) return false;
  if (typeof image === "string") return true;
  if (typeof image === "object" && "src" in (image as object)) return true;
  if (typeof image === "object" && "default" in (image as object)) return true;
  return false;
}
