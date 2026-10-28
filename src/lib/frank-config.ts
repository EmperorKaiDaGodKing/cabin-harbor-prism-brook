const DEFAULT_MODEL = "grok-4.5";
const DEFAULT_TEMPERATURE = 0.7;

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
