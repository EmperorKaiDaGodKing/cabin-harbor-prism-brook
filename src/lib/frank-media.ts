/**
 * Photo limits and data-URL checks shared by the browser and the chat route.
 * Image bytes stay in the device thread (localStorage). The server only
 * forwards them on the live reply and must not log them.
 *
 * xAI image input, checked 2026-10-29 against docs.x.ai, accepts jpeg and png.
 * Webp and gif are allowed in the composer; the browser re-encodes those to
 * jpeg before the request (a gif still plays in the thread).
 */

export const MAX_IMAGES_PER_MESSAGE = 4;
export const MAX_IMAGES_PER_REQUEST = 4;
/** ~1 MB of image bytes. Keeps a thread inside localStorage and under the host body limit. */
export const MAX_IMAGE_DATA_URL_CHARS = 1_400_000;
export const MAX_INPUT_BYTES = 15 * 1024 * 1024;
export const MAX_GIF_BYTES = 900_000;
export const SMALL_ORIGINAL_BYTES = 350_000;
export const MAX_IMAGE_EDGE = 1600;

export const MEDIA_TYPE_ERROR = "Frank can take a jpg, png, webp, or gif.";
export const MEDIA_LARGE_ERROR = "That photo is too large. Try a smaller one.";
export const MEDIA_GIF_ERROR = "That gif is too large. Try a shorter one, or send a still.";
export const MEDIA_READ_ERROR = "Could not read that photo.";
export const MEDIA_COUNT_ERROR = "You can attach up to 4 photos.";
export const MEDIA_PREPARE_ERROR = "Could not prepare that photo. Try once more.";

export type ChatImage = {
  id: string;
  dataUrl: string;
  /** Stills taken from one short clip, in time order. */
  clip?: true;
};

export type ImageKind = "jpeg" | "png" | "webp" | "gif" | "other";

const MODEL_URL = /^data:image\/(jpeg|png);base64,[A-Za-z0-9+/]+={0,2}$/;
const DISPLAY_URL = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

export function normalizeImageDataUrl(value: string): string {
  if (value.startsWith("data:image/jpg;") || value.startsWith("data:image/jpg,")) {
    return `data:image/jpeg${value.slice("data:image/jpg".length)}`;
  }
  return value;
}

function isImageDataUrl(value: string, pattern: RegExp): boolean {
  if (value.length < 40 || value.length > MAX_IMAGE_DATA_URL_CHARS) return false;
  return pattern.test(value);
}

/** Jpeg or png data URL small enough to forward to xAI. */
export function isModelImageDataUrl(value: string): boolean {
  return isImageDataUrl(value, MODEL_URL);
}

/** Data URL the thread may keep on this device, including an animated gif or a webp. */
export function isDisplayImageDataUrl(value: string): boolean {
  return isImageDataUrl(value, DISPLAY_URL);
}

export function sniffImageKind(file: { type?: string; name?: string }): ImageKind {
  const type = (file.type ?? "").toLowerCase();
  switch (type) {
    case "image/jpeg":
    case "image/jpg":
    case "image/pjpeg":
      return "jpeg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/gif":
      return "gif";
    default:
      break;
  }

  const name = (file.name ?? "").toLowerCase();
  if (name.endsWith(".jpg") || name.endsWith(".jpeg")) return "jpeg";
  if (name.endsWith(".png")) return "png";
  if (name.endsWith(".webp")) return "webp";
  if (name.endsWith(".gif")) return "gif";
  return "other";
}

/**
 * Validate photos on a chat turn.
 * Returns a user-facing error string, the accepted data URLs, or undefined when there are none.
 */
export function parseUserImages(role: string, value: unknown): string[] | undefined | string {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) return "Bad message.";
  if (value.length === 0) return undefined;
  if (role !== "user") return "Bad message.";
  if (value.length > MAX_IMAGES_PER_MESSAGE) return MEDIA_COUNT_ERROR;

  const images: string[] = [];
  for (const item of value) {
    if (typeof item !== "string") return "Bad message.";
    if (item.length > MAX_IMAGE_DATA_URL_CHARS) return MEDIA_LARGE_ERROR;
    const normalized = normalizeImageDataUrl(item);
    if (!isModelImageDataUrl(normalized)) return "Send that photo as a jpg or png.";
    images.push(normalized);
  }
  return images;
}
