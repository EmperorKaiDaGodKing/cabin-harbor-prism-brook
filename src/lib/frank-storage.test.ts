import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("frank storage", () => {
  it("remembers the age gate, tone, and thread on this device", async () => {
    const memory = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: {
        getItem: (key: string) => memory.get(key) ?? null,
        setItem: (key: string, value: string) => {
          memory.set(key, value);
        },
        removeItem: (key: string) => {
          memory.delete(key);
        },
      },
    });

    const frank = await import("./frank.ts");
    assert.equal(frank.loadAdultOk(), false);
    frank.saveAdultOk();
    assert.equal(frank.loadAdultOk(), true);

    assert.equal(frank.loadMood(), "playful");
    frank.saveMood("spicy");
    assert.equal(frank.loadMood(), "spicy");

    const message = frank.newMessage("user", "come here");
    frank.saveThread([message]);
    assert.equal(frank.loadThread()[0]?.content, "come here");

    const png =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    const gif = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    const photo = frank.newMessage("user", "", crypto.randomUUID(), [
      { id: "pic-1", dataUrl: png },
      { id: "gif-1", dataUrl: gif },
    ]);
    frank.saveThread([photo]);
    const stored = frank.loadThread()[0];
    assert.equal(stored?.content, "");
    assert.equal(stored?.images?.length, 2);
    assert.equal(stored?.images?.[0]?.dataUrl, png);

    const clip = frank.newMessage(
      "user",
      "These are frames from a short video.",
      crypto.randomUUID(),
      [{ id: "frame-1", dataUrl: png, clip: true }],
    );
    frank.saveThread([clip]);
    assert.equal(frank.loadThread()[0]?.images?.[0]?.clip, true);

    const huge = `data:image/jpeg;base64,${"A".repeat(1_500_000)}`;
    memory.set(
      "frank.chat.v1",
      JSON.stringify([
        {
          id: "m1",
          role: "user",
          content: "hello",
          at: "2026-01-01T00:00:00.000Z",
          images: [
            { id: "bad", dataUrl: huge },
            { id: "nope", dataUrl: "javascript:alert(1)" },
          ],
        },
      ]),
    );
    const kept = frank.loadThread()[0];
    assert.equal(kept?.content, "hello");
    assert.equal(kept?.images, undefined);

    const bulky = frank.newMessage("user", "", "big", [
      { id: "big", dataUrl: `data:image/jpeg;base64,${"A".repeat(4_100_000)}` },
    ]);
    const fitted = frank.fitThreadForStorage([bulky]);
    assert.equal(fitted[0]?.images, undefined);
    assert.equal(fitted[0]?.content, "Photo");

    memory.set("frank.chat.v1", "not-json");
    assert.deepEqual(frank.loadThread(), []);
  });
});
