const DEFAULT_MODEL = "grok-4.5";
const DEFAULT_TEMPERATURE = 0.7;

/**
 * Chat models documented to accept image input (docs.x.ai, checked 2026-10-29).
 * grok-4.7: text and image in, text out.
 * grok-4.6, grok-4.5, grok-4.3: text, image → text.
 * grok-4: chat-completions image examples. grok-2-vision-1212 is the legacy vision id.
 * Imagine and voice models are not in this set.
 */
const VISION_MODEL_IDS = new Set([
  "grok-4",
  "grok-4.3",
  "grok-4.3-latest",
  "grok-4.5",
  "grok-4.5-latest",
  "grok-4.6",
  "grok-4.7",
  "grok-2-vision",
  "grok-2-vision-1212",
  "grok-vision-beta",
]);

/** Used when the chat model cannot take images and XAI_VISION_MODEL is unset. grok-4.7 can. */
const DEFAULT_VISION_MODEL = "grok-4.7";

const MODEL_PATTERN = /^[A-Za-z0-9._-]{1,64}$/;

export const FRANK_MAX_TOKENS = 450;

export function frankModel(env: NodeJS.ProcessEnv = process.env): string {
  const raw = env.XAI_MODEL?.trim();
  if (!raw || !MODEL_PATTERN.test(raw)) return DEFAULT_MODEL;
  return raw;
}

export function frankTemperature(env: NodeJS.ProcessEnv = process.env): number {
  const raw = env.XAI_TEMPERATURE?.trim();
  if (!raw) return DEFAULT_TEMPERATURE;
  const value = Number(raw);
  if (!Number.isFinite(value)) return DEFAULT_TEMPERATURE;
  return Math.min(2, Math.max(0, value));
}

export function modelAcceptsImages(model: string): boolean {
  if (VISION_MODEL_IDS.has(model)) return true;
  return model.includes("vision");
}

/**
 * Model for a turn that includes a photo.
 * An explicit XAI_VISION_MODEL wins. Otherwise the chat model is used when it
 * can see images (grok-4.7 can). Anything else falls back to grok-4.7.
 */
export function frankModelForImages(env: NodeJS.ProcessEnv = process.env): string {
  const requested = env.XAI_VISION_MODEL?.trim();
  if (requested && MODEL_PATTERN.test(requested)) return requested;
  const chat = frankModel(env);
  if (modelAcceptsImages(chat)) return chat;
  return DEFAULT_VISION_MODEL;
}
