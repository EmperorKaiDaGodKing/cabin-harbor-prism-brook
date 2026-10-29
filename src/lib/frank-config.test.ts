import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  frankModel,
  frankModelForImages,
  frankTemperature,
  modelAcceptsImages,
} from "./frank-config.ts";

describe("frank config", () => {
  it("defaults the model and temperature", () => {
    assert.equal(frankModel({} as NodeJS.ProcessEnv), "grok-4.5");
    assert.equal(frankTemperature({} as NodeJS.ProcessEnv), 0.7);
  });

  it("accepts a safe model id and clamps temperature", () => {
    assert.equal(frankModel({ XAI_MODEL: " grok-4 " } as NodeJS.ProcessEnv), "grok-4");
    assert.equal(frankModel({ XAI_MODEL: "grok 4" } as NodeJS.ProcessEnv), "grok-4.5");
    assert.equal(frankModel({ XAI_MODEL: "../etc" } as NodeJS.ProcessEnv), "grok-4.5");
    assert.equal(frankTemperature({ XAI_TEMPERATURE: "1.2" } as NodeJS.ProcessEnv), 1.2);
    assert.equal(frankTemperature({ XAI_TEMPERATURE: "9" } as NodeJS.ProcessEnv), 2);
    assert.equal(frankTemperature({ XAI_TEMPERATURE: "-1" } as NodeJS.ProcessEnv), 0);
    assert.equal(frankTemperature({ XAI_TEMPERATURE: "hot" } as NodeJS.ProcessEnv), 0.7);
  });

  it("keeps image turns on a vision model, including grok-4.7", () => {
    assert.equal(modelAcceptsImages("grok-4.7"), true);
    assert.equal(modelAcceptsImages("grok-4.6"), true);
    assert.equal(modelAcceptsImages("grok-4.5"), true);
    assert.equal(modelAcceptsImages("grok-4.5-latest"), true);
    assert.equal(modelAcceptsImages("grok-4.3"), true);
    assert.equal(modelAcceptsImages("grok-4"), true);
    assert.equal(modelAcceptsImages("grok-2-vision-1212"), true);
    assert.equal(modelAcceptsImages("grok-imagine-video"), false);
    assert.equal(modelAcceptsImages("grok-imagine-image"), false);
    assert.equal(modelAcceptsImages("grok-build-0.1"), false);

    assert.equal(frankModelForImages({} as NodeJS.ProcessEnv), "grok-4.5");
    assert.equal(frankModelForImages({ XAI_MODEL: "grok-4.7" } as NodeJS.ProcessEnv), "grok-4.7");
    assert.equal(
      frankModelForImages({ XAI_MODEL: "grok-imagine-video" } as NodeJS.ProcessEnv),
      "grok-4.7",
    );
    assert.equal(
      frankModelForImages({
        XAI_MODEL: "grok-4.7",
        XAI_VISION_MODEL: "grok-2-vision-1212",
      } as NodeJS.ProcessEnv),
      "grok-2-vision-1212",
    );
    assert.equal(
      frankModelForImages({
        XAI_MODEL: "grok-4.7",
        XAI_VISION_MODEL: "../etc",
      } as NodeJS.ProcessEnv),
      "grok-4.7",
    );
  });
});
