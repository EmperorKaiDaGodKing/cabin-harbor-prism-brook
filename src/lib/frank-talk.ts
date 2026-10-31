import { frankApiPath } from "./frank-client.ts";
import { framesFromClip } from "./frank-frames.ts";
import { MAX_CHARS } from "./frank-policy.ts";
import { MAX_NOTE_MS, type FrankVoiceId } from "./frank-voice.ts";

export { framesFromClip };

const WONT_SAY = "Frank won't say that.";

type RecognitionResult = { results: ArrayLike<ArrayLike<{ transcript: string }>> };

type Recognition = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  onresult: ((event: RecognitionResult) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
};

type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const host = window as Window & {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return host.SpeechRecognition ?? host.webkitSpeechRecognition ?? null;
}

export function canRecord(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof MediaRecorder !== "undefined" &&
    typeof navigator.mediaDevices?.getUserMedia === "function"
  );
}

export function canRecognize(): boolean {
  return recognitionCtor() !== null;
}

export function canSpeakLocally(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

function recorderMime(): string {
  const types = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return "";
}

export type ListenSession = { stop: () => void };

export function startRecording(handlers: {
  onBlob: (blob: Blob) => void;
  onError: (message: string) => void;
}): ListenSession | { error: string } {
  if (!canRecord()) return { error: "This browser can't take a voice note. Type it instead." };

  let recorder: MediaRecorder | null = null;
  let timer = 0;
  let stopped = false;
  const chunks: Blob[] = [];

  const finish = () => {
    if (stopped) return;
    stopped = true;
    window.clearTimeout(timer);
    if (recorder && recorder.state !== "inactive") recorder.stop();
  };

  void navigator.mediaDevices
    .getUserMedia({ audio: true })
    .then((stream) => {
      if (stopped) {
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      const mime = recorderMime();
      recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunks.push(event.data);
      };
      recorder.onerror = () => {
        for (const track of stream.getTracks()) track.stop();
        handlers.onError("Could not use the microphone. Type it instead.");
      };
      recorder.onstop = () => {
        for (const track of stream.getTracks()) track.stop();
        const blob = new Blob(chunks, { type: recorder?.mimeType || "audio/webm" });
        if (blob.size > 0) handlers.onBlob(blob);
        else handlers.onError("I didn't catch that. Try once more.");
      };
      recorder.start();
      timer = window.setTimeout(finish, MAX_NOTE_MS);
    })
    .catch((error: unknown) => {
      const name = error instanceof DOMException ? error.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        handlers.onError("The microphone is blocked. Allow it, or type instead.");
        return;
      }
      handlers.onError("Could not use the microphone. Type it instead.");
    });

  return { stop: finish };
}

export function startRecognition(handlers: {
  onText: (text: string) => void;
  onError: (message: string) => void;
}): ListenSession | { error: string } {
  const Ctor = recognitionCtor();
  if (!Ctor) return { error: "This browser can't take a voice note. Type it instead." };

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.continuous = false;
  let heard = "";
  let settled = false;
  let cancel = false;
  recognition.onresult = (event) => {
    const parts: string[] = [];
    for (let index = 0; index < event.results.length; index += 1) {
      const piece = event.results[index]?.[0]?.transcript ?? "";
      if (piece.trim()) parts.push(piece.trim());
    }
    heard = parts.join(" ");
  };
  recognition.onerror = (event) => {
    if (event.error === "aborted" || event.error === "no-speech") return;
    if (settled) return;
    settled = true;
    if (event.error === "not-allowed" || event.error === "service-not-allowed") {
      handlers.onError("The microphone is blocked. Allow it, or type instead.");
      return;
    }
    handlers.onError("I didn't catch that. Try once more.");
  };
  recognition.onend = () => {
    if (settled) return;
    settled = true;
    if (cancel && !heard.trim()) return;
    if (heard.trim()) handlers.onText(heard.trim());
    else handlers.onError("I didn't catch that. Try once more.");
  };
  try {
    recognition.start();
  } catch {
    return { error: "Could not use the microphone. Type it instead." };
  }
  return {
    stop: () => {
      cancel = true;
      recognition.stop();
    },
  };
}

export async function transcribeNote(
  blob: Blob,
): Promise<{ ok: true; text: string } | { ok: false; error: string; offline?: boolean }> {
  const form = new FormData();
  const name = blob.type.includes("mp4") ? "note.mp4" : "note.webm";
  form.append("audio", blob, name);
  let response: Response;
  try {
    response = await fetch(`${frankApiPath()}/transcribe`, { method: "POST", body: form });
  } catch {
    return { ok: false, error: "Could not transcribe that. Try once more." };
  }
  const body = (await response.json().catch(() => null)) as {
    text?: unknown;
    error?: unknown;
  } | null;
  if (response.status === 503) {
    return {
      ok: false,
      offline: true,
      error:
        typeof body?.error === "string" ? body.error : "Could not transcribe that. Try once more.",
    };
  }
  if (typeof body?.text === "string" && body.text.trim())
    return { ok: true, text: body.text.trim() };
  if (typeof body?.error === "string" && body.error) return { ok: false, error: body.error };
  return { ok: false, error: "Could not transcribe that. Try once more." };
}

let audioCtx: AudioContext | null = null;
let currentSource: AudioBufferSourceNode | null = null;

export function unlockTalkAudio() {
  if (typeof window === "undefined") return;
  const Ctx = window.AudioContext;
  if (!Ctx) return;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === "suspended") void audioCtx.resume();
}

export function stopPlayback() {
  if (currentSource) {
    try {
      currentSource.stop();
    } catch {
      /* Already ended. */
    }
    currentSource.disconnect();
    currentSource = null;
  }
  if (typeof window !== "undefined" && window.speechSynthesis) window.speechSynthesis.cancel();
}

function speakLocally(text: string): boolean {
  if (!canSpeakLocally()) return false;
  const line = text.trim().slice(0, MAX_CHARS);
  if (!line) return false;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(line);
  utterance.lang = "en-US";
  const voices = window.speechSynthesis.getVoices();
  const match = voices.find(
    (voice) =>
      voice.lang.toLowerCase().startsWith("en") &&
      /male|david|daniel|alex|fred|aaron|rishi/i.test(voice.name),
  );
  if (match) utterance.voice = match;
  window.speechSynthesis.speak(utterance);
  return true;
}

async function playBuffer(bytes: ArrayBuffer) {
  unlockTalkAudio();
  if (!audioCtx) throw new Error("audio");
  if (audioCtx.state === "suspended") await audioCtx.resume();
  const buffer = await audioCtx.decodeAudioData(bytes.slice(0));
  stopPlayback();
  const source = audioCtx.createBufferSource();
  source.buffer = buffer;
  source.connect(audioCtx.destination);
  currentSource = source;
  source.onended = () => {
    if (currentSource === source) currentSource = null;
  };
  source.start();
}

export type SpeakResult = "played" | "local" | "blocked" | "failed";

export async function playReply(text: string, voiceId: FrankVoiceId): Promise<SpeakResult> {
  const line = text.trim().slice(0, MAX_CHARS);
  if (!line) return "failed";
  stopPlayback();
  try {
    const response = await fetch(`${frankApiPath()}/speak`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: line, voiceId }),
    });
    if (response.status === 400) {
      const body = (await response.json().catch(() => null)) as { error?: unknown } | null;
      if (body?.error === WONT_SAY) return "blocked";
    }
    const type = response.headers.get("content-type") ?? "";
    if (response.ok && type.includes("audio")) {
      await playBuffer(await response.arrayBuffer());
      return "played";
    }
  } catch {
    /* The browser voice is the fallback when the spoken reply cannot be fetched. */
  }
  if (speakLocally(line)) return "local";
  return "failed";
}
