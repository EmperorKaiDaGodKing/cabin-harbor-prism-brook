import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { consumeFrankSse, consumeUpstreamSse, formatFrankEvent } from "./frank-stream.ts";

describe("upstream SSE", () => {
  it("joins deltas that arrive split across chunks", () => {
    const first = 'data: {"choices":[{"delta":{"content":"Hel';
    const mid = consumeUpstreamSse(first);
    assert.deepEqual(mid.deltas, []);
    const second = consumeUpstreamSse(`${mid.rest}lo"}}]}\n\ndata: [DONE]\n`);
    assert.deepEqual(second.deltas, ["Hello"]);
    assert.equal(second.done, true);
    assert.equal(second.failed, false);
  });

  it("reads array content parts and flags an error payload", () => {
    const parts = consumeUpstreamSse(
      'data: {"choices":[{"delta":{"content":[{"type":"text","text":"Hi"}]}}]}\n',
    );
    assert.deepEqual(parts.deltas, ["Hi"]);

    const failed = consumeUpstreamSse('data: {"error":{"message":"no"}}\n');
    assert.equal(failed.failed, true);
    assert.deepEqual(failed.deltas, []);
  });
});

describe("frank SSE", () => {
  it("round-trips delta, error, and done events", () => {
    const raw = [
      formatFrankEvent({ type: "delta", text: "Hey" }),
      formatFrankEvent({ type: "error", error: "Frank could not answer." }),
      formatFrankEvent({ type: "done" }),
    ].join("");
    const parsed = consumeFrankSse(raw);
    assert.deepEqual(parsed.events, [
      { type: "delta", text: "Hey" },
      { type: "error", error: "Frank could not answer." },
      { type: "done" },
    ]);
    assert.equal(parsed.rest, "");
  });
});
