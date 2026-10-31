/**
 * Short clips stay on this device. Frank sees a few stills from the clip,
 * sent through the same photo path as a picture.
 */

export const MAX_CLIP_SECONDS = 10;
export const MAX_CLIP_BYTES = 20 * 1024 * 1024;
export const CLIP_FRAME_COUNT = 4;

export const CLIP_TYPE_ERROR = "Frank can take an mp4, webm, or mov.";
export const CLIP_LARGE_ERROR = "That clip is too large. Keep it under 20 MB.";
export const CLIP_LONG_ERROR = "That clip is too long. Keep it under 10 seconds.";
export const CLIP_READ_ERROR = "Could not read that clip.";
export const CLIP_FRAME_ERROR = "Could not take stills from that clip.";
export const CLIP_CAPTION = "These are frames from a short video.";

export type ClipKind = "mp4" | "webm" | "mov" | "other";

export function sniffClip(file: { type?: string; name?: string }): ClipKind {
  const type = (file.type ?? "").toLowerCase();
  switch (type) {
    case "video/mp4":
    case "video/x-m4v":
      return "mp4";
    case "video/webm":
      return "webm";
    case "video/quicktime":
      return "mov";
    default:
      break;
  }

  const name = (file.name ?? "").toLowerCase();
  if (name.endsWith(".mp4") || name.endsWith(".m4v")) return "mp4";
  if (name.endsWith(".webm")) return "webm";
  if (name.endsWith(".mov")) return "mov";
  return "other";
}

export function clipSizeError(bytes: number): "large" | "empty" | null {
  if (!Number.isFinite(bytes) || bytes <= 0) return "empty";
  if (bytes > MAX_CLIP_BYTES) return "large";
  return null;
}

/** `unread` covers NaN, zero, and an open-ended stream. */
export function clipDurationError(durationSeconds: number): "long" | "unread" | null {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) return "unread";
  if (durationSeconds > MAX_CLIP_SECONDS + 0.05) return "long";
  return null;
}

/**
 * Evenly spaced timestamps inside the clip, inset from the first and last
 * moments so a fade or a black frame is less likely.
 */
export function frameSampleTimes(durationSeconds: number, count: number): number[] {
  if (clipDurationError(durationSeconds) || count < 1) return [];
  const inset = Math.min(0.12, durationSeconds * 0.08);
  const start = Math.min(inset, Math.max(0, durationSeconds - 0.001));
  const end = Math.max(start, durationSeconds - inset);
  const span = end - start;
  const steps = Math.floor(count);
  const times: number[] = [];
  for (let index = 0; index < steps; index += 1) {
    const ratio = steps === 1 ? 0.5 : index / (steps - 1);
    const time = start + span * ratio;
    const last = times[times.length - 1];
    if (last !== undefined && time - last < 0.04) continue;
    times.push(Number(time.toFixed(3)));
  }
  return times;
}

/** Text the model should see when the stills came from one clip. */
export function clipCaptionForModel(content: string, hasClip: boolean): string {
  const text = content.trim();
  if (!hasClip) return text;
  if (!text || text === CLIP_CAPTION) return CLIP_CAPTION;
  return `${CLIP_CAPTION} ${text}`;
}
