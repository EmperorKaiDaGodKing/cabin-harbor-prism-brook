import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { frankModel, frankTemperature } from "./frank-config.ts";

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
});
