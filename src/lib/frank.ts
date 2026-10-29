import { isDisplayImageDataUrl, MAX_IMAGES_PER_MESSAGE, type ChatImage } from "./frank-media.ts";
import { isMood, MAX_CHARS, type ChatRole, type Mood } from "./frank-policy.ts";

export type { ChatImage, ChatRole, Mood };
export { MAX_CHARS, MAX_THREAD, MOODS } from "./frank-policy.ts";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  at: string;
  images?: ChatImage[];
};

const THREAD_KEY = "frank.chat.v1";
const ADULT_KEY = "frank.adult.v1";
const MOOD_KEY = "frank.mood.v1";
const STORED_LIMIT = 80;
/** Stay under a typical 5 MB localStorage quota, including the age gate and tone keys. */
const STORAGE_CHAR_BUDGET = 4_000_000;

function parseStoredImages(value: unknown): ChatImage[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const images: ChatImage[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const image = item as Partial<ChatImage>;
    if (typeof image.id !== "string" || image.id.length === 0 || image.id.length > 80) continue;
    if (typeof image.dataUrl !== "string" || !isDisplayImageDataUrl(image.dataUrl)) continue;
    images.push({ id: image.id, dataUrl: image.dataUrl });
    if (images.length >= MAX_IMAGES_PER_MESSAGE) break;
  }
  return images.length > 0 ? images : undefined;
}

export function loadThread(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(THREAD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const message = item as Partial<ChatMessage>;
      if (message.role !== "user" && message.role !== "assistant") return [];
      if (typeof message.content !== "string") return [];
      if (typeof message.id !== "string") return [];
      const content = message.content.slice(0, MAX_CHARS);
      const images = message.role === "user" ? parseStoredImages(message.images) : undefined;
      if (!content.trim() && !images) return [];
      return [
        {
          id: message.id,
          role: message.role,
          content: content.trim() ? content : "",
          at: typeof message.at === "string" ? message.at : new Date().toISOString(),
          ...(images ? { images } : {}),
        },
      ];
    });
  } catch {
    return [];
  }
}

/** Drop the oldest photos first when the thread would overflow device storage. */
export function fitThreadForStorage(messages: ChatMessage[]): ChatMessage[] {
  const trimmed: ChatMessage[] = messages.slice(-STORED_LIMIT).map((message) => ({
    id: message.id,
    role: message.role,
    content: message.content,
    at: message.at,
    ...(message.images?.length
      ? { images: message.images.map((image) => ({ id: image.id, dataUrl: image.dataUrl })) }
      : {}),
  }));

  const size = () => JSON.stringify(trimmed).length;
  if (size() <= STORAGE_CHAR_BUDGET) return trimmed;

  for (const message of trimmed) {
    if (size() <= STORAGE_CHAR_BUDGET) break;
    if (!message.images?.length) continue;
    message.images = undefined;
    if (!message.content.trim()) message.content = "Photo";
  }
  return trimmed;
}

export function saveThread(messages: ChatMessage[]) {
  try {
    localStorage.setItem(THREAD_KEY, JSON.stringify(fitThreadForStorage(messages)));
  } catch {
    try {
      const textOnly = messages.slice(-STORED_LIMIT).map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content.trim() || "Photo",
        at: message.at,
      }));
      localStorage.setItem(THREAD_KEY, JSON.stringify(textOnly));
    } catch {
      /* Private mode or a full store. The open chat stays on screen. */
    }
  }
}

export function loadAdultOk(): boolean {
  try {
    return localStorage.getItem(ADULT_KEY) === "yes";
  } catch {
    return false;
  }
}

export function saveAdultOk() {
  localStorage.setItem(ADULT_KEY, "yes");
}

export function loadMood(): Mood {
  try {
    const value = localStorage.getItem(MOOD_KEY);
    if (isMood(value)) return value;
  } catch {
    /* Private mode can throw. Fall through to the default tone. */
  }
  return "playful";
}

export function saveMood(mood: Mood) {
  localStorage.setItem(MOOD_KEY, mood);
}

export function newMessage(
  role: ChatRole,
  content: string,
  id: string = crypto.randomUUID(),
  images?: ChatImage[],
): ChatMessage {
  return {
    id,
    role,
    content,
    at: new Date().toISOString(),
    ...(images && images.length > 0 ? { images } : {}),
  };
}
