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

    memory.set("frank.chat.v1", "not-json");
    assert.deepEqual(frank.loadThread(), []);
  });
});
