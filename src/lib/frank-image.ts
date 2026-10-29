import type { ChatImage } from "./frank-media";
import {
  isDisplayImageDataUrl,
  isModelImageDataUrl,
  MAX_GIF_BYTES,
  MAX_IMAGE_DATA_URL_CHARS,
  MAX_IMAGE_EDGE,
  MAX_INPUT_BYTES,
  MEDIA_GIF_ERROR,
  MEDIA_LARGE_ERROR,
  MEDIA_READ_ERROR,
  MEDIA_TYPE_ERROR,
  normalizeImageDataUrl,
  SMALL_ORIGINAL_BYTES,
  sniffImageKind,
  type ImageKind,
} from "./frank-media";

export type PrepareImageResult = { ok: true; image: ChatImage } | { ok: false; error: string };

const JPEG_QUALITIES = [0.82, 0.68, 0.52];

/** Matches `--color-paper` so a transparent png does not flatten to black. */
const PAPER_FALLBACK = "#f4efe6";

function paperColor(): string {
  if (typeof document === "undefined") return PAPER_FALLBACK;
  const value = getComputedStyle(document.documentElement).getPropertyValue("--color-paper").trim();
  return value || PAPER_FALLBACK;
}

function readFileAsDataUrl(file: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") resolve(normalizeImageDataUrl(reader.result));
      else reject(new Error("read"));
    };
    reader.onerror = () => reject(new Error("read"));
    reader.readAsDataURL(file);
  });
}

function loadFileImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      if (!image.naturalWidth || !image.naturalHeight) reject(new Error("read"));
      else resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("read"));
    };
    image.src = url;
  });
}

function loadUrlImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      if (!image.naturalWidth || !image.naturalHeight) reject(new Error("read"));
      else resolve(image);
    };
    image.onerror = () => reject(new Error("read"));
    image.src = src;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", quality);
  });
}

async function renderJpeg(image: HTMLImageElement): Promise<string> {
  const sourceWidth = image.naturalWidth || image.width;
  const sourceHeight = image.naturalHeight || image.height;
  if (!sourceWidth || !sourceHeight) throw new Error("read");

  let edge = MAX_IMAGE_EDGE;
  for (let pass = 0; pass < 4; pass += 1) {
    const scale = Math.min(1, edge / Math.max(sourceWidth, sourceHeight));
    const width = Math.max(1, Math.round(sourceWidth * scale));
    const height = Math.max(1, Math.round(sourceHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("read");
    context.fillStyle = paperColor();
    context.fillRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    for (const quality of JPEG_QUALITIES) {
      const blob = await canvasToBlob(canvas, quality);
      if (!blob) continue;
      const url = await readFileAsDataUrl(blob);
      if (url.length <= MAX_IMAGE_DATA_URL_CHARS && isModelImageDataUrl(url)) return url;
    }

    edge = Math.round(edge * 0.65);
    if (edge < 320) break;
  }

  throw new Error("large");
}

function stillError(kind: ImageKind, error: unknown): PrepareImageResult {
  const reason = error instanceof Error ? error.message : "";
  if (reason === "large") return { ok: false, error: MEDIA_LARGE_ERROR };
  if (kind === "other") return { ok: false, error: MEDIA_TYPE_ERROR };
  return { ok: false, error: MEDIA_READ_ERROR };
}

async function prepareGif(file: File): Promise<PrepareImageResult> {
  if (file.size > MAX_GIF_BYTES) return { ok: false, error: MEDIA_GIF_ERROR };
  try {
    await loadFileImage(file);
    const dataUrl = normalizeImageDataUrl(await readFileAsDataUrl(file));
    if (!isDisplayImageDataUrl(dataUrl)) return { ok: false, error: MEDIA_LARGE_ERROR };
    return { ok: true, image: { id: crypto.randomUUID(), dataUrl } };
  } catch {
    return { ok: false, error: MEDIA_READ_ERROR };
  }
}

async function prepareStill(file: File, kind: ImageKind): Promise<PrepareImageResult> {
  try {
    const element = await loadFileImage(file);
    const longest = Math.max(element.naturalWidth, element.naturalHeight);
    if (
      (kind === "jpeg" || kind === "png") &&
      file.size <= SMALL_ORIGINAL_BYTES &&
      longest <= MAX_IMAGE_EDGE
    ) {
      const dataUrl = normalizeImageDataUrl(await readFileAsDataUrl(file));
      if (isModelImageDataUrl(dataUrl)) {
        return { ok: true, image: { id: crypto.randomUUID(), dataUrl } };
      }
    }
    const dataUrl = await renderJpeg(element);
    return { ok: true, image: { id: crypto.randomUUID(), dataUrl } };
  } catch (error) {
    return stillError(kind, error);
  }
}

/** Resize and compress a picked, dropped, or pasted photo. Gifs under the cap stay animated. */
export async function prepareChatImage(file: File): Promise<PrepareImageResult> {
  if (file.size > MAX_INPUT_BYTES) return { ok: false, error: MEDIA_LARGE_ERROR };
  const kind = sniffImageKind(file);
  switch (kind) {
    case "gif":
      return prepareGif(file);
    case "jpeg":
    case "png":
    case "webp":
      return prepareStill(file, kind);
    case "other": {
      const type = file.type.toLowerCase();
      if (type && !type.startsWith("image/")) return { ok: false, error: MEDIA_TYPE_ERROR };
      return prepareStill(file, "other");
    }
    default: {
      const exhaustive: never = kind;
      return exhaustive;
    }
  }
}

/**
 * Jpeg or png data URL for the model. Animated gifs and webps become a jpeg still
 * because the image API documents jpeg and png only.
 */
export async function toModelDataUrl(dataUrl: string): Promise<string> {
  const normalized = normalizeImageDataUrl(dataUrl);
  if (isModelImageDataUrl(normalized)) return normalized;
  if (!isDisplayImageDataUrl(normalized)) throw new Error("type");
  const image = await loadUrlImage(normalized);
  const rendered = await renderJpeg(image);
  if (!isModelImageDataUrl(rendered)) throw new Error("large");
  return rendered;
}
