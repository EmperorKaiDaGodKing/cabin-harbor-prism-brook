/**
 * Frank's speaking voice, remembered on this device.
 * Ids match the xAI text-to-speech roster (docs.x.ai, checked 2026-10-30).
 */

export const MAX_NOTE_MS = 20_000;
export const MAX_NOTE_BYTES = 4 * 1024 * 1024;

export const FRANK_VOICES = [
  { id: "rex", label: "Rex", hint: "Confident and clear" },
  { id: "sal", label: "Sal", hint: "Smooth and balanced" },
  { id: "leo", label: "Leo", hint: "Authoritative and strong" },
  { id: "ara", label: "Ara", hint: "Warm and friendly" },
  { id: "sirius", label: "Sirius", hint: "Playful and quick" },
  { id: "eve", label: "Eve", hint: "Energetic and upbeat" },
] as const;

export type FrankVoiceId = (typeof FRANK_VOICES)[number]["id"];

export const DEFAULT_VOICE: FrankVoiceId = "rex";

const VOICE_KEY = "frank.voice.v1";
const SPEAK_KEY = "frank.speak.v1";

export function isFrankVoice(value: unknown): value is FrankVoiceId {
  return FRANK_VOICES.some((voice) => voice.id === value);
}

export function loadVoice(): FrankVoiceId {
  try {
    const value = localStorage.getItem(VOICE_KEY);
    if (isFrankVoice(value)) return value;
  } catch {
    /* Private mode can throw. Fall through to the default voice. */
  }
  return DEFAULT_VOICE;
}

export function saveVoice(voice: FrankVoiceId) {
  localStorage.setItem(VOICE_KEY, voice);
}

export function loadSpeak(): boolean {
  try {
    return localStorage.getItem(SPEAK_KEY) === "yes";
  } catch {
    return false;
  }
}

export function saveSpeak(on: boolean) {
  localStorage.setItem(SPEAK_KEY, on ? "yes" : "no");
}
