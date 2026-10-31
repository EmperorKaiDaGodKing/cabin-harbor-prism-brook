import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  handleFrankSpeak,
  handleFrankTranscribe,
  parseSpeakBody,
  reviewSpeakText,
  transcriptFromStt,
} from "./frank-speech.ts";

describe("frank speech", () => {
  it("reads a transcript from the speech-to-text body", () => {
    assert.equal(transcriptFromStt({ text: "  come here  " }), "come here");
    assert.equal(transcriptFromStt({ transcript: "hey" }), "hey");
    assert.equal(transcriptFromStt({}), "");
    assert.equal(transcriptFromStt(null), "");
  });

  it("accepts a known voice and a short line", () => {
    assert.deepEqual(parseSpeakBody({ text: "  hello  " }), { text: "hello", voiceId: "rex" });
    assert.deepEqual(parseSpeakBody({ text: "hello", voiceId: "eve" }), {
      text: "hello",
      voiceId: "eve",
    });
    assert.deepEqual(parseSpeakBody({ text: "" }), { error: "Say what to speak." });
    assert.deepEqual(parseSpeakBody({ text: "hello", voiceId: "narrator" }), {
      error: "Pick one of Frank's voices.",
    });
    assert.equal(reviewSpeakText("come here"), null);
    assert.equal(reviewSpeakText("she's 16"), "Frank won't say that.");
  });

  it("refuses a voice note when the model key is missing", async () => {
    const previous = process.env.XAI_API_KEY;
    delete process.env.XAI_API_KEY;
    try {
      const form = new FormData();
      form.set("audio", new File([new Uint8Array(8)], "note.webm", { type: "audio/webm" }));
      const response = await handleFrankTranscribe(
        new Request("http://local/api/frank/transcribe", { method: "POST", body: form }),
      );
      assert.equal(response.status, 503);
    } finally {
      if (previous === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previous;
    }
  });

  it("rejects a speak request that crosses a boundary before calling the model", async () => {
    const previous = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "test-key";
    try {
      const response = await handleFrankSpeak(
        new Request("http://local/api/frank/speak", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ text: "she's 16", voiceId: "rex" }),
        }),
      );
      assert.equal(response.status, 400);
      const body = (await response.json()) as { error?: string };
      assert.equal(body.error, "Frank won't say that.");
    } finally {
      if (previous === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previous;
    }
  });

  it("rejects an empty voice note", async () => {
    const previous = process.env.XAI_API_KEY;
    process.env.XAI_API_KEY = "test-key";
    try {
      const form = new FormData();
      const response = await handleFrankTranscribe(
        new Request("http://local/api/frank/transcribe", { method: "POST", body: form }),
      );
      assert.equal(response.status, 400);
    } finally {
      if (previous === undefined) delete process.env.XAI_API_KEY;
      else process.env.XAI_API_KEY = previous;
    }
  });
});
