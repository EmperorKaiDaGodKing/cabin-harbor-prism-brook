export type ChatRole = "user" | "assistant";

export type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  at: string;
};

const KEY = "frank.chat.v1";
export const MAX_THREAD = 16;
export const MAX_CHARS = 2000;

export function loadThread(): ChatMessage[] {
  try {
    const raw = localStorage.getItem(KEY);
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
  localStorage.setItem(KEY, JSON.stringify(messages.slice(-80)));
}

export function newMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: crypto.randomUUID(),
    role,
    content,
    at: new Date().toISOString(),
  };
}
