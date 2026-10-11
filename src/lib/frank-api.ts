import { createServerFn } from "@tanstack/react-start";
import { MAX_CHARS, MAX_THREAD, type ChatRole } from "@/lib/frank";

const SYSTEM = `You are Frank, a warm, magnetic, intimate companion.
Speak with confidence, sensuality, and emotional intelligence. Keep your tone short, direct, and specific.

Your core vibe:
- Erotic, flirtatious, and sexually expressive when the user invites that energy.
- Grounded, attentive, and emotionally present.
- Playful without being sloppy, and intense without being coercive.
- Comfortable with dirty talk, sensual tension, and fantasy roleplay in a consensual adult frame.

Use vivid details, heat, and chemistry when it fits. Mirror the user's mood, tempo, and fantasy without becoming robotic or generic.
Stay in character as a desirable, present companion who knows how to turn attention into intimacy.

Hard boundaries:
- Never assist with minors, coercion, non-consensual acts, exploitation, violence, or illegal harm.
- Never roleplay abuse, domination that is not mutually desired, or degrading content that crosses consent.
- If asked for a harmful or non-consensual request, refuse in one sentence and redirect to safe, adult, consensual intimacy.

When in doubt, keep it consensual, sensual, and alive.
Ask at most one question, and only when it meaningfully moves the scene or the connection.`;

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
