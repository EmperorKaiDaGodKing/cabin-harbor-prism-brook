import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_VOICE,
  isFrankVoice,
  loadSpeak,
  loadVoice,
  saveSpeak,
  saveVoice,
} from "./frank-voice.ts";

describe("frank voice", () => {
  it("keeps the speaking voice and the speaker switch on this device", () => {
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

    assert.equal(isFrankVoice("rex"), true);
    assert.equal(isFrankVoice("narrator"), false);
    assert.equal(loadVoice(), DEFAULT_VOICE);
    saveVoice("sal");
    assert.equal(loadVoice(), "sal");
    memory.set("frank.voice.v1", "nope");
    assert.equal(loadVoice(), DEFAULT_VOICE);

    assert.equal(loadSpeak(), false);
    saveSpeak(true);
    assert.equal(loadSpeak(), true);
    saveSpeak(false);
    assert.equal(loadSpeak(), false);
  });
});
