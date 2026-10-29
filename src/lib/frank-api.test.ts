import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { REFUSAL } from "./frank-policy.ts";
import { handleFrankChat, handleFrankStatus } from "./frank-api.ts";

function post(body: unknown): Request {
  return new Request("http://frank.test/api/frank", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

describe("frank http", { concurrency: 1 }, () => {
  it("rejects a bad body and an obvious violation before any model call", async () => {
    let called = false;
    const original = globalThis.fetch;
    globalThis.fetch = () => {
      called = true;
      throw new Error("the model should not be called");
    };
    try {
      const bad = await handleFrankChat(post("{"));
      assert.equal(bad.status, 400);

      const refused = await handleFrankChat(
        post({ messages: [{ role: "user", content: "she's 16" }], mood: "spicy" }),
      );
      assert.equal(refused.status, 200);
      const body = (await refused.json()) as { text?: string; refused?: boolean };
      assert.equal(body.refused, true);
      assert.equal(body.text, REFUSAL);
      assert.equal(called, false);
    } finally {
      globalThis.fetch = original;
    }
  });

  it("reports whether a model key is configured without calling xAI", async () => {
    const previous = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      const status = await handleFrankStatus().json();
      assert.deepEqual(status, { ok: true, configured: false });

      const response = await handleFrankChat(
        post({ messages: [{ role: "user", content: "come here" }] }),
      );
      assert.equal(response.status, 503);
      const body = (await response.json()) as { error?: string };
      assert.match(body.error ?? "", /can't reply/i);
    } finally {
      if (previous === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previous;
    }
  });

  it("forwards a photo as an image part and does not log it", async () => {
    const previousKey = process.env.XAI_API_KEY;
    const previousModel = process.env.XAI_MODEL;
    const previousVision = process.env.XAI_VISION_MODEL;
    process.env.XAI_API_KEY = "test-key";
    process.env.XAI_MODEL = "grok-imagine-video";
    delete process.env.XAI_VISION_MODEL;

    const logs: unknown[][] = [];
    const methods = ["log", "info", "warn", "error", "debug"] as const;
    const originals = new Map<string, (...args: unknown[]) => void>();
    for (const method of methods) {
      originals.set(method, console[method].bind(console));
      console[method] = (...args: unknown[]) => {
        logs.push(args);
      };
    }

    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    let model = "";
    let sawImage = false;
    const original = globalThis.fetch;
    globalThis.fetch = async (_url, init) => {
      const body = JSON.parse(String(init?.body)) as {
        model?: string;
        messages?: { role?: string; content?: unknown }[];
      };
      model = body.model ?? "";
      const last = body.messages?.[body.messages.length - 1];
      sawImage =
        Array.isArray(last?.content) &&
        last.content.some(
          (part) =>
            !!part &&
            typeof part === "object" &&
            "type" in part &&
            part.type === "image_url" &&
            "image_url" in part &&
            !!part.image_url &&
            typeof part.image_url === "object" &&
            "url" in part.image_url &&
            part.image_url.url === png,
        );
      const encoder = new TextEncoder();
      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(
            encoder.encode('data: {"choices":[{"delta":{"content":"That red square."}}]}\n\n'),
          );
          controller.enqueue(encoder.encode("data: [DONE]\n\n"));
          controller.close();
        },
      });
      return new Response(stream, {
        status: 200,
        headers: { "content-type": "text/event-stream" },
      });
    };

    try {
      const response = await handleFrankChat(
        post({
          mood: "playful",
          messages: [{ role: "user", content: "what do you think", images: [png] }],
        }),
      );
      assert.equal(response.status, 200);
      const text = await response.text();
      assert.match(text, /That red square/);
      assert.equal(model, "grok-4.7");
      assert.equal(sawImage, true);
      assert.equal(JSON.stringify(logs).includes(png), false);
      assert.equal(JSON.stringify(logs).includes("base64"), false);
    } finally {
      globalThis.fetch = original;
      for (const method of methods) {
        const restore = originals.get(method);
        if (restore) console[method] = restore as (typeof console)[typeof method];
      }
      if (previousKey === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previousKey;
      if (previousModel === undefined) delete process.env.XAI_MODEL;
      else process.env.XAI_MODEL = previousModel;
      if (previousVision === undefined) delete process.env.XAI_VISION_MODEL;
      else process.env.XAI_VISION_MODEL = previousVision;
    }
  });
});
