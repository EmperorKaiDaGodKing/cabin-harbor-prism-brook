import { isMood, MAX_CHARS, type ChatRole, type Mood } from "./frank-policy.ts";

export type { ChatRole, Mood };
export { MAX_CHARS, MAX_THREAD, MOODS } from "./frank-policy.ts";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  at: string;
};

const THREAD_KEY = "frank.chat.v1";
const ADULT_KEY = "frank.adult.v1";
const MOOD_KEY = "frank.mood.v1";
const STORED_LIMIT = 80;

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
      if (typeof message.content !== "string" || !message.content.trim()) return [];
      if (typeof message.id !== "string") return [];
      return [
        {
          id: message.id,
          role: message.role,
          content: message.content.slice(0, MAX_CHARS),
          at: typeof message.at === "string" ? message.at : new Date().toISOString(),
        },
      ];
    });
  } catch {
    return [];
  }
}

export function saveThread(messages: ChatMessage[]) {
  localStorage.setItem(THREAD_KEY, JSON.stringify(messages.slice(-STORED_LIMIT)));
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

export function newMessage(role: ChatRole, content: string, id = crypto.randomUUID()): ChatMessage {
  return {
    id,
    role,
    content,
    at: new Date().toISOString(),
  };
}
