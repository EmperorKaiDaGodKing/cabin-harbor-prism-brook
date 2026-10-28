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
});
