import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { FrankMark } from "@/components/frank/mark";
import { fetchFrankStatus, requestFrankReply } from "@/lib/frank-client";
import { HEADER_LINE, INTRO_BODY, INTRO_TITLE, OFFLINE_NOTE } from "@/lib/frank-copy";
import {
  loadMood,
  loadThread,
  MAX_CHARS,
  MAX_THREAD,
  newMessage,
  saveMood,
  saveThread,
  type ChatMessage,
} from "@/lib/frank";
import { MOODS, type Mood } from "@/lib/frank-policy";

const fieldClass =
  "w-full resize-none rounded-lg border border-line bg-paper px-3 py-3 text-base text-ink outline-none placeholder:text-muted focus-visible:border-sienna focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sienna";

const TONE_LABEL: Record<Mood, string> = {
  sweet: "Sweet",
  playful: "Playful",
  spicy: "Spicy",
};

const TONE_HINT: Record<Mood, string> = {
  sweet: "Tender and unhurried.",
  playful: "Teasing, then warm.",
  spicy: "Direct, when you ask for it.",
};

export function FrankChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mood, setMood] = useState<Mood>("playful");
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const stick = useRef(true);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(loadThread());
    setMood(loadMood());
    setReady(true);
    const abort = new AbortController();
    void fetchFrankStatus(abort.signal).then((value) => {
      if (!abort.signal.aborted) setConfigured(value);
    });
    return () => abort.abort();
  }, []);

  useEffect(() => {
    if (ready) box.current?.focus();
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const id = window.setTimeout(() => saveThread(messages), 300);
    return () => window.clearTimeout(id);
  }, [messages, ready]);

  useEffect(() => {
    if (!ready || pending) return;
    saveThread(messages);
  }, [messages, pending, ready]);

  useEffect(() => {
    if (!ready) return;
    saveMood(mood);
  }, [mood, ready]);

  useEffect(() => {
    const node = scroller.current;
    if (!node || !stick.current) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, pending, ready]);

  function onScroll() {
    const node = scroller.current;
    if (!node) return;
    stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80;
  }

  async function submit(thread: ChatMessage[]) {
    const requestId = requestRef.current + 1;
    requestRef.current = requestId;
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;
    setPending(true);
    setError("");
    setCanRetry(false);
    setConfirmClear(false);
    stick.current = true;

    const assistantId = crypto.randomUUID();
    let started = false;
    const result = await requestFrankReply({
      messages: thread.slice(-MAX_THREAD).map((message) => ({
        role: message.role,
        content: message.content,
      })),
      mood,
      signal: abort.signal,
      onDelta: (chunk) => {
        if (requestRef.current !== requestId) return;
        started = true;
        setMessages((current) => {
          const prior = current.filter((message) => message.id !== assistantId);
          const existing = current.find((message) => message.id === assistantId);
          const content = `${existing?.content ?? ""}${chunk}`;
          return [...prior, newMessage("assistant", content, assistantId)].slice(-80);
        });
      },
    });

    if (requestRef.current !== requestId) return;
    setPending(false);
    if (!result.ok) {
      if ("aborted" in result) return;
      if (started) {
        setMessages((current) => current.filter((message) => message.id !== assistantId));
      }
      setError(result.error);
      setCanRetry(true);
      return;
    }
    box.current?.focus();
  }

  async function send() {
    const text = draft.trim();
    if (!text || pending || configured === false) return;
    if (text.length > MAX_CHARS) {
      setError("Keep it under 2000 characters.");
      setCanRetry(false);
      return;
    }
    const next = [...messages, newMessage("user", text)].slice(-80);
    setMessages(next);
    setDraft("");
    await submit(next);
  }

  async function retry() {
    if (pending) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") return;
    await submit(messages);
  }

  function clearChat() {
    requestRef.current += 1;
    abortRef.current?.abort();
    setMessages([]);
    setDraft("");
    setError("");
    setCanRetry(false);
    setConfirmClear(false);
    setPending(false);
  }

  const showTyping = pending && messages[messages.length - 1]?.role !== "assistant";

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4">
      <header className="border-b border-line py-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="size-3 shrink-0 bg-sienna" aria-hidden="true" />
              <h1 className="font-display text-3xl leading-none text-ink">Frank</h1>
            </div>
            <p className="mt-2 text-sm text-muted">{HEADER_LINE}</p>
          </div>
          {confirmClear ? (
            <div className="flex shrink-0 gap-2">
              <Button intent="quiet" onClick={() => setConfirmClear(false)}>
                Keep
              </Button>
              <Button intent="danger" onClick={clearChat}>
                Clear it
              </Button>
            </div>
          ) : (
            <Button
              intent="quiet"
              onClick={() => setConfirmClear(true)}
              disabled={messages.length === 0}
            >
              Clear
            </Button>
          )}
        </div>
        <MoodPicker mood={mood} disabled={pending} onChange={setMood} />
      </header>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto py-4"
        role="log"
        aria-label="Conversation"
        aria-busy={pending}
        onScroll={onScroll}
      >
        {!ready ? (
          <p className="text-sm text-muted">Opening the chat…</p>
        ) : messages.length === 0 ? (
          <div className="my-auto">
            <Intro />
          </div>
        ) : (
          messages.map((message) => <Bubble key={message.id} message={message} />)
        )}
        {showTyping ? <Typing /> : null}
      </div>

      <form
        className="composer-pad border-t border-line pt-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {configured === false ? (
          <p
            className="mb-3 rounded-lg border border-line bg-sheet px-3 py-3 text-sm text-ink"
            role="status"
          >
            {OFFLINE_NOTE}
          </p>
        ) : null}
        {error ? (
          <div
            className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between"
            role="alert"
          >
            <p className="min-w-0 text-sm text-sienna">{error}</p>
            {canRetry ? (
              <Button
                className="w-full shrink-0 sm:w-auto"
                intent="quiet"
                onClick={() => void retry()}
                disabled={pending}
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
        <label className="block" htmlFor="frank-draft">
          <span className="sr-only">Message Frank</span>
          <textarea
            id="frank-draft"
            ref={box}
            className={fieldClass}
            rows={2}
            value={draft}
            placeholder="Say what you want."
            maxLength={MAX_CHARS}
            disabled={configured === false}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">
            <span className="sm:hidden">
              {draft.length} / {MAX_CHARS}
            </span>
            <span className="hidden sm:inline">
              Enter sends. Shift+Enter for a new line. {draft.length} / {MAX_CHARS}
            </span>
          </p>
          <Button
            type="submit"
            disabled={pending || configured === false || draft.trim().length === 0}
          >
            Send
          </Button>
        </div>
      </form>
    </main>
  );
}

function MoodPicker({
  mood,
  disabled,
  onChange,
}: {
  mood: Mood;
  disabled: boolean;
  onChange: (mood: Mood) => void;
}) {
  return (
    <fieldset className="mt-4 min-w-0 disabled:opacity-60" disabled={disabled}>
      <legend className="text-xs font-semibold tracking-widest text-muted uppercase">Tone</legend>
      <div className="mt-2 grid grid-cols-3 gap-2">
        {MOODS.map((value) => (
          <label key={value} className="block">
            <input
              className="peer sr-only"
              type="radio"
              name="frank-tone"
              value={value}
              checked={mood === value}
              onChange={() => onChange(value)}
            />
            <span className="flex h-11 items-center justify-center rounded-lg border border-line bg-sheet text-sm font-medium text-ink peer-checked:border-ink peer-checked:bg-ink peer-checked:text-on-sienna peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-sienna">
              {TONE_LABEL[value]}
            </span>
          </label>
        ))}
      </div>
      <p className="mt-2 text-sm text-muted" aria-live="polite">
        {TONE_HINT[mood]}
      </p>
    </fieldset>
  );
}

function Intro() {
  return (
    <div className="rounded-xl border border-line bg-sheet px-4 py-6">
      <p className="text-xs font-semibold tracking-widest text-muted uppercase">Companion</p>
      <p className="mt-2 font-display text-3xl leading-tight text-ink">{INTRO_TITLE}</p>
      <div className="mt-4">
        <FrankMark />
      </div>
      <p className="mt-4 text-base text-muted">{INTRO_BODY}</p>
    </div>
  );
}

function Typing() {
  return (
    <div className="flex justify-start" role="status" aria-live="polite">
      <p className="sr-only">Frank is writing.</p>
      <div
        className="flex h-11 items-center gap-1 rounded-xl border border-line bg-sheet px-3"
        aria-hidden="true"
      >
        <span className="frank-dot size-1.5 rounded-full bg-muted" />
        <span className="frank-dot size-1.5 rounded-full bg-muted" />
        <span className="frank-dot size-1.5 rounded-full bg-muted" />
      </div>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div className="max-w-[85%]">
        {mine ? null : <p className="mb-1 text-xs font-medium text-muted">Frank</p>}
        <p
          className={
            "whitespace-pre-wrap rounded-xl px-3 py-3 text-base " +
            (mine ? "bg-ink text-on-sienna" : "border border-line bg-sheet text-ink")
          }
        >
          <span className="sr-only">{mine ? "You said: " : "Frank said: "}</span>
          {message.content}
        </p>
      </div>
    </div>
  );
}
