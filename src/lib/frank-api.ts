import { FRANK_MAX_TOKENS, frankModel, frankTemperature } from "./frank-config.ts";
import { assessFrankRequest, systemPrompt, type Mood, type Turn } from "./frank-policy.ts";
import { consumeUpstreamSse, formatFrankEvent, type FrankSseEvent } from "./frank-stream.ts";

if (typeof window !== "undefined") {
  throw new Error("frank-api is server-only.");
}

const XAI_URL = "https://api.x.ai/v1/chat/completions";

const OFFLINE = "Frank can't reply in this environment yet.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function handleFrankStatus(): Response {
  return json({ ok: true, configured: Boolean(process.env.XAI_API_KEY) });
}

export async function handleFrankChat(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Send a message first." }, 400);
  }

  const assessment = assessFrankRequest(payload);
  switch (assessment.kind) {
    case "invalid":
      return json({ ok: false, error: assessment.error }, 400);
    case "refusal":
      return json({ ok: true, text: assessment.text, refused: true });
    case "ready":
      return streamReply(assessment.messages, assessment.mood);
    default: {
      const exhaustive: never = assessment;
      return exhaustive;
    }
  }
}

async function streamReply(messages: Turn[], mood: Mood): Promise<Response> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return json({ ok: false, error: OFFLINE }, 503);

  const abort = new AbortController();
  let upstream: Response;
  try {
    upstream = await fetch(XAI_URL, {
      method: "POST",
      signal: abort.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: frankModel(),
        temperature: frankTemperature(),
        max_tokens: FRANK_MAX_TOKENS,
        stream: true,
        messages: [{ role: "system", content: systemPrompt(mood) }, ...messages],
      }),
    });
  } catch {
    return json({ ok: false, error: "Could not reach Frank. Try once more." }, 502);
  }

  if (!upstream.ok || !upstream.body) {
    return json({ ok: false, error: `Frank could not answer (${upstream.status}).` }, 502);
  }

  const encoder = new TextEncoder();
  const reader = upstream.body.getReader();
  const decoder = new TextDecoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let buffer = "";
      let wrote = false;
      const send = (event: FrankSseEvent) => {
        controller.enqueue(encoder.encode(formatFrankEvent(event)));
      };
      const take = (chunk: string, final: boolean) => {
        const parsed = consumeUpstreamSse(final ? `${chunk}\n` : chunk);
        if (!final) buffer = parsed.rest;
        if (parsed.failed) return "failed" as const;
        for (const delta of parsed.deltas) {
          wrote = true;
          send({ type: "delta", text: delta });
        }
        return parsed.done ? ("done" as const) : ("open" as const);
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const state = take(buffer, false);
          if (state === "failed") {
            send({ type: "error", error: "Frank could not answer. Try once more." });
            controller.close();
            return;
          }
          if (state === "done") break;
        }

        if (buffer.trim()) {
          const state = take(buffer, true);
          if (state === "failed") {
            send({ type: "error", error: "Frank could not answer. Try once more." });
            controller.close();
            return;
          }
        }

        if (!wrote) send({ type: "error", error: "Frank came back empty. Try again." });
        else send({ type: "done" });
        controller.close();
      } catch {
        try {
          send({ type: "error", error: "The reply broke off. Try once more." });
          controller.close();
        } catch {
          /* The client already went away. */
        }
      }
    },
    cancel() {
      abort.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      "x-accel-buffering": "no",
    },
  });
}
