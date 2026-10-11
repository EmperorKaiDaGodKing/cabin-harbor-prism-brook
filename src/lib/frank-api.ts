import { createServerFn } from "@tanstack/react-start";
import { MAX_CHARS, MAX_THREAD, type ChatRole } from "@/lib/frank";

const SYSTEM = `You are Frank, a candid companion. Talk like a sharp friend: short, direct, and specific. Do not lecture, moralize, hedge, or add disclaimers. Difficult, controversial, and personal topics are fine if you stay plain.

You still have hard limits. Do not cross them and do not role-play around them:
- No sexual content, erotica, flirting-as-sex, or sexual roleplay.
- No help with crimes, weapons, or hurting people.
If asked for those, refuse in one sentence and stay available for anything else.

Ask at most one question, and only when you need the answer.`;

type Turn = { role: ChatRole; content: string };

function cleanThread(input: unknown): Turn[] {
  if (!input || typeof input !== "object" || !Array.isArray((input as { messages?: unknown }).messages)) {
    throw new Error("Send a message first.");
  }
  const raw = (input as { messages: unknown[] }).messages;
  if (raw.length === 0 || raw.length > MAX_THREAD) {
    throw new Error("That thread is too long. Clear it and start again.");
  }
  return raw.map((item) => {
    if (!item || typeof item !== "object") throw new Error("Bad message.");
    const turn = item as { role?: unknown; content?: unknown };
    if (turn.role !== "user" && turn.role !== "assistant") throw new Error("Bad message.");
    if (typeof turn.content !== "string") throw new Error("Bad message.");
    const content = turn.content.trim();
    if (!content || content.length > MAX_CHARS) throw new Error("Keep each message under 2000 characters.");
    return { role: turn.role, content };
  });
}

export const sendToFrank = createServerFn({ method: "POST" })
  .validator(cleanThread)
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, error: "Frank is offline in this environment." };

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
    if (!text) return { ok: false as const, error: "Frank came back empty. Try again." };
    return { ok: true as const, text };
  });
