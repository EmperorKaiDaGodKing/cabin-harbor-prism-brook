import { MAX_CHARS, boundaryViolation } from "./frank-policy.ts";
import { DEFAULT_VOICE, MAX_NOTE_BYTES, isFrankVoice, type FrankVoiceId } from "./frank-voice.ts";

/**
 * Server-only voice notes and spoken replies.
 * Audio bytes are forwarded to xAI and are not stored or logged.
 */
if (typeof window !== "undefined") {
  throw new Error("frank-speech is server-only.");
}

const STT_URL = "https://api.x.ai/v1/stt";
const TTS_URL = "https://api.x.ai/v1/tts";
const OFFLINE = "Frank can't reply in this environment yet.";
const WONT_SAY = "Frank won't say that.";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

export function transcriptFromStt(body: unknown): string {
  if (!body || typeof body !== "object") return "";
  const record = body as { text?: unknown; transcript?: unknown };
  if (typeof record.text === "string") return record.text.trim();
  if (typeof record.transcript === "string") return record.transcript.trim();
  return "";
}

export function parseSpeakBody(
  value: unknown,
): { text: string; voiceId: FrankVoiceId } | { error: string } {
  if (!value || typeof value !== "object") return { error: "Say what to speak." };
  const body = value as { text?: unknown; voiceId?: unknown };
  if (typeof body.text !== "string" || !body.text.trim()) return { error: "Say what to speak." };
  const text = body.text.trim();
  if (text.length > MAX_CHARS) return { error: "That line is too long to speak." };
  const voiceId = body.voiceId === undefined ? DEFAULT_VOICE : body.voiceId;
  if (!isFrankVoice(voiceId)) return { error: "Pick one of Frank's voices." };
  return { text, voiceId };
}

/** Same hard boundaries as chat. A refusal here is not spoken. */
export function reviewSpeakText(text: string): string | null {
  return boundaryViolation(text) ? WONT_SAY : null;
}

function audioName(type: string): string {
  if (type.includes("mp4") || type.includes("m4a") || type.includes("aac")) return "note.mp4";
  if (type.includes("mpeg") || type.includes("mp3")) return "note.mp3";
  if (type.includes("wav")) return "note.wav";
  if (type.includes("ogg")) return "note.ogg";
  return "note.webm";
}

export async function handleFrankTranscribe(request: Request): Promise<Response> {
  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return json({ ok: false, error: OFFLINE }, 503);

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return json({ ok: false, error: "Send a voice note first." }, 400);
  }

  const audio = form.get("audio");
  if (!(audio instanceof File) || audio.size <= 0) {
    return json({ ok: false, error: "Send a voice note first." }, 400);
  }
  if (audio.size > MAX_NOTE_BYTES) {
    return json({ ok: false, error: "That voice note is too long." }, 413);
  }
  const type = audio.type.toLowerCase();
  if (type && !type.startsWith("audio/")) {
    return json({ ok: false, error: "Send that as audio." }, 400);
  }

  const upstreamForm = new FormData();
  upstreamForm.append("language", "en");
  upstreamForm.append("file", audio, audioName(type));

  let upstream: Response;
  try {
    upstream = await fetch(STT_URL, {
      method: "POST",
      headers: { authorization: `Bearer ${apiKey}` },
      body: upstreamForm,
    });
  } catch {
    return json({ ok: false, error: "Could not transcribe that. Try once more." }, 502);
  }

  const raw = await upstream.text();
  let parsed: unknown = null;
  try {
    parsed = JSON.parse(raw) as unknown;
  } catch {
    parsed = null;
  }
  if (!upstream.ok) {
    return json({ ok: false, error: "Could not transcribe that. Try once more." }, 502);
  }
  const text = transcriptFromStt(parsed);
  if (!text) return json({ ok: false, error: "I didn't catch any words." }, 422);
  return json({ ok: true, text });
}

export async function handleFrankSpeak(request: Request): Promise<Response> {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return json({ ok: false, error: "Say what to speak." }, 400);
  }

  const parsed = parseSpeakBody(payload);
  if ("error" in parsed) return json({ ok: false, error: parsed.error }, 400);
  const blocked = reviewSpeakText(parsed.text);
  if (blocked) return json({ ok: false, error: blocked }, 400);

  const apiKey = process.env.XAI_API_KEY;
  if (!apiKey) return json({ ok: false, error: OFFLINE }, 503);

  let upstream: Response;
  try {
    upstream = await fetch(TTS_URL, {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        text: parsed.text,
        voice_id: parsed.voiceId,
        language: "en",
      }),
    });
  } catch {
    return json({ ok: false, error: "Could not speak that. Try once more." }, 502);
  }

  if (!upstream.ok) {
    return json({ ok: false, error: "Could not speak that. Try once more." }, 502);
  }
  const type = upstream.headers.get("content-type") ?? "";
  if (!type.includes("audio")) {
    return json({ ok: false, error: "Could not speak that. Try once more." }, 502);
  }
  const bytes = await upstream.arrayBuffer();
  return new Response(bytes, {
    status: 200,
    headers: {
      "content-type": type.split(";")[0] || "audio/mpeg",
      "cache-control": "no-store",
    },
  });
}
