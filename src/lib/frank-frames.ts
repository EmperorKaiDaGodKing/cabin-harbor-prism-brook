import {
  CLIP_FRAME_ERROR,
  CLIP_LARGE_ERROR,
  CLIP_LONG_ERROR,
  CLIP_READ_ERROR,
  CLIP_TYPE_ERROR,
  clipDurationError,
  clipSizeError,
  frameSampleTimes,
  sniffClip,
} from "./frank-clip.ts";

export type FrameResult = { ok: true; blobs: Blob[] } | { ok: false; error: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("read")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error("read"));
      },
    );
  });
}

function once(target: HTMLVideoElement, event: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ok = () => {
      cleanup();
      resolve();
    };
    const bad = () => {
      cleanup();
      reject(new Error("read"));
    };
    const cleanup = () => {
      target.removeEventListener(event, ok);
      target.removeEventListener("error", bad);
    };
    target.addEventListener(event, ok, { once: true });
    target.addEventListener("error", bad, { once: true });
  });
}

async function seekTo(video: HTMLVideoElement, time: number) {
  if (video.readyState >= 2 && Math.abs(video.currentTime - time) < 0.03) return;
  const pending = withTimeout(once(video, "seeked"), 4000);
  video.currentTime = time;
  await pending;
}

/**
 * Some webm files report an endless duration until the playhead is moved to the end.
 * The time we land on is the clip length.
 */
async function measuredDuration(video: HTMLVideoElement): Promise<number> {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration;
  try {
    await seekTo(video, 1e10);
  } catch {
    return Number.NaN;
  }
  const end = video.currentTime;
  if (!Number.isFinite(end) || end <= 0) return Number.NaN;
  try {
    await seekTo(video, 0);
  } catch {
    /* The first still can still be taken from the frame we landed on. */
  }
  return end;
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((blob) => resolve(blob), "image/jpeg", 0.82);
  });
}

/** Pull a few jpeg stills from a short clip. The clip itself is not stored. */
export async function framesFromClip(file: File, count: number): Promise<FrameResult> {
  const size = clipSizeError(file.size);
  if (size === "large") return { ok: false, error: CLIP_LARGE_ERROR };
  if (size === "empty" || sniffClip(file) === "other") return { ok: false, error: CLIP_TYPE_ERROR };
  if (typeof document === "undefined") return { ok: false, error: CLIP_READ_ERROR };

  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  const url = URL.createObjectURL(file);
  try {
    const ready = withTimeout(once(video, "loadedmetadata"), 8000);
    video.src = url;
    video.load();
    await ready;
    const duration = await measuredDuration(video);
    const problem = clipDurationError(duration);
    if (problem === "long") return { ok: false, error: CLIP_LONG_ERROR };
    if (problem === "unread") return { ok: false, error: CLIP_READ_ERROR };

    const times = frameSampleTimes(duration, count);
    if (times.length === 0) return { ok: false, error: CLIP_READ_ERROR };

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) return { ok: false, error: CLIP_FRAME_ERROR };

    const blobs: Blob[] = [];
    for (const time of times) {
      await seekTo(video, time);
      const width = video.videoWidth;
      const height = video.videoHeight;
      if (!width || !height) return { ok: false, error: CLIP_FRAME_ERROR };
      const edge = Math.max(width, height);
      const scale = edge > 1600 ? 1600 / edge : 1;
      canvas.width = Math.max(1, Math.round(width * scale));
      canvas.height = Math.max(1, Math.round(height * scale));
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      const blob = await canvasToBlob(canvas);
      if (!blob) return { ok: false, error: CLIP_FRAME_ERROR };
      blobs.push(blob);
    }
    return { ok: true, blobs };
  } catch {
    return { ok: false, error: CLIP_READ_ERROR };
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(url);
  }
}
