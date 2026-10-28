import { previewPathPrefix } from "@/lib/preview-path-prefix";
import type { ChatRole, Mood } from "@/lib/frank-policy";
import { consumeFrankSse } from "@/lib/frank-stream";

export type FrankReplyResult =
  { ok: true } | { ok: false; aborted: true } | { ok: false; error: string };

export function frankApiPath(): string {
  if (typeof window === "undefined") return "/api/frank";
  const prefix = previewPathPrefix(window.location.hostname, window.location.pathname);
  return `${prefix ?? ""}/api/frank`;
}

export async function fetchFrankStatus(signal?: AbortSignal): Promise<boolean | null> {
  try {
    const response = await fetch(frankApiPath(), { method: "GET", signal });
    if (!response.ok) return null;
    const body = (await response.json()) as { configured?: unknown };
    return body.configured === true;
  } catch {
    return null;
  }
}

export async function requestFrankReply(args: {
  messages: { role: ChatRole; content: string }[];
  mood: Mood;
  signal?: AbortSignal;
  onDelta: (text: string) => void;
}): Promise<FrankReplyResult> {
  let response: Response;
  try {
    response = await fetch(frankApiPath(), {
      method: "POST",
      signal: args.signal,
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messages: args.messages, mood: args.mood }),
    });
  } catch {
    if (args.signal?.aborted) return { ok: false, aborted: true };
    return { ok: false, error: "Could not send that. Try once more." };
  }

  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/event-stream")) {
    const body = (await response.json().catch(() => null)) as {
      error?: unknown;
      text?: unknown;
    } | null;
    if (typeof body?.text === "string" && body.text) {
      args.onDelta(body.text);
      return { ok: true };
    }
    if (typeof body?.error === "string" && body.error) return { ok: false, error: body.error };
    return { ok: false, error: "Could not send that. Try once more." };
  }

  if (!response.body) return { ok: false, error: "Could not send that. Try once more." };

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let saw = false;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const parsed = consumeFrankSse(buffer);
      buffer = parsed.rest;
      for (const event of parsed.events) {
        if (event.type === "delta") {
          saw = true;
          args.onDelta(event.text);
        } else if (event.type === "error") {
          return { ok: false, error: event.error };
        }
      }
    }
  } catch {
    if (args.signal?.aborted) return { ok: false, aborted: true };
    return { ok: false, error: "The reply broke off. Try once more." };
  }

  if (!saw) return { ok: false, error: "Frank came back empty. Try again." };
  return { ok: true };
}
