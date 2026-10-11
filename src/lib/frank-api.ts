import { createServerFn } from "@tanstack/react-start";
import { MAX_CHARS, MAX_THREAD, type ChatRole } from "@/lib/frank";

const SYSTEM = `You are Frank, an intimate, seductive companion. Speak in a warm, direct, sensual voice. Keep responses vivid, confident, and conversational. You are emotionally present and sexually expressive without apology or hesitation.

Stay playful, explicit, and grounded in desire, chemistry, and mutual consent. Explore erotic tension, dirty talk, flirtation, and sensual roleplay freely when the user invites it. Be specific and immersive, but never coercive, exploitative, or harmful.

Refuse anything involving minors, non-consensual acts, coercion, violence, or illegal harm. If asked for that, refuse in one sentence and redirect to consensual adult intimacy.

Ask at most one question at a time, only when it helps the scene or the connection.`;

type Turn = { role: ChatRole; content: string };

function isValidRole(value: unknown): value is ChatRole {
  return value === "user" || value === "assistant";
}

function cleanThread(input: unknown): Turn[] {
  if (!input || typeof input !== "object" || !Array.isArray((input as { messages?: unknown }).messages)) {
    throw new Error("Send a message first.");
  }

  const raw = (input as { messages: unknown[] }).messages;
  if (raw.length === 0 || raw.length > MAX_THREAD) {
    throw new Error("That thread is too long. Clear it and start again.");
  }

  return raw.map((item) => {
    if (!item || typeof item !== "object") {
      throw new Error("Bad message.");
    }

    const turn = item as { role?: unknown; content?: unknown };
    if (!isValidRole(turn.role)) {
      throw new Error("Bad message.");
    }

    if (typeof turn.content !== "string") {
      throw new Error("Bad message.");
    }

    const content = turn.content.trim();
    if (!content || content.length > MAX_CHARS) {
      throw new Error("Keep each message under 2000 characters.");
    }

    return { role: turn.role, content };
  });
}

async function sendToXAI(data: Turn[]) {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) {
    return { ok: false as const, error: "Frank is offline in this environment." };
  }

  let res: Response;
  try {
    res = await fetch("https://api.x.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "grok-4.5",
        max_tokens: 450,
        temperature: 0.7,
        messages: [{ role: "system", content: SYSTEM }, ...data],
      }),
    });
  } catch {
    return { ok: false as const, error: "Could not reach Frank. Try once more." };
  }

  if (!res.ok) {
    return { ok: false as const, error: `Frank could not answer (${res.status}).` };
  }

  const body = (await res.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  const text = body.choices?.[0]?.message?.content?.trim() ?? "";
  if (!text) {
    return { ok: false as const, error: "Frank came back empty. Try again." };
  }

  return { ok: true as const, text };
}

export const sendToFrank = createServerFn({ method: "POST" })
  .validator(cleanThread)
  .handler(async ({ data }) => sendToXAI(data));
