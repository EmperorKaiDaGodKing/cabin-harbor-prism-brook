import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CLIP_CAPTION,
  CLIP_FRAME_COUNT,
  clipCaptionForModel,
  clipDurationError,
  clipSizeError,
  frameSampleTimes,
  sniffClip,
} from "./frank-clip.ts";

describe("clips", () => {
  it("recognizes mp4, webm, and mov", () => {
    assert.equal(sniffClip({ type: "video/mp4" }), "mp4");
    assert.equal(sniffClip({ type: "video/webm", name: "take.webm" }), "webm");
    assert.equal(sniffClip({ name: "take.MOV" }), "mov");
    assert.equal(sniffClip({ type: "image/jpeg", name: "still.jpg" }), "other");
  });

  it("rejects an oversized or endless clip", () => {
    assert.equal(clipSizeError(0), "empty");
    assert.equal(clipSizeError(20 * 1024 * 1024 + 1), "large");
    assert.equal(clipSizeError(1000), null);
    assert.equal(clipDurationError(Number.NaN), "unread");
    assert.equal(clipDurationError(Number.POSITIVE_INFINITY), "unread");
    assert.equal(clipDurationError(10.2), "long");
    assert.equal(clipDurationError(9.9), null);
  });

  it("spaces stills inside the clip", () => {
    const times = frameSampleTimes(8, CLIP_FRAME_COUNT);
    assert.equal(times.length, 4);
    assert.ok(times[0]! > 0);
    assert.ok(times[3]! < 8);
    assert.ok(times[1]! > times[0]!);
    assert.deepEqual(frameSampleTimes(0, 4), []);
    assert.deepEqual(frameSampleTimes(12, 4), []);
  });

  it("tells the model the stills are one clip", () => {
    assert.equal(clipCaptionForModel("look", false), "look");
    assert.equal(clipCaptionForModel("", true), CLIP_CAPTION);
    assert.equal(clipCaptionForModel(CLIP_CAPTION, true), CLIP_CAPTION);
    assert.equal(clipCaptionForModel("closer", true), `${CLIP_CAPTION} closer`);
  });
});
