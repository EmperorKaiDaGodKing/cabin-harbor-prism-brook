import { useEffect, useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { Button } from "@/components/ui/button";
import { loadThread, MAX_CHARS, MAX_THREAD, newMessage, saveThread, type ChatMessage } from "@/lib/frank";
import { sendToFrank as askFrank } from "@/lib/frank-api";

export const Route = createFileRoute("/")({ component: Home });

const fieldClass =
  "w-full resize-none rounded-lg border border-line bg-paper px-3 py-3 text-base text-ink outline-none placeholder:text-muted focus:border-sienna";

function Home() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [confirmClear, setConfirmClear] = useState(false);
  const sendToFrank = useServerFn(askFrank);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    setMessages(loadThread());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    saveThread(messages);
  }, [messages, ready]);

  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [messages, pending, ready]);

  async function send() {
    const text = draft.trim();
    if (!text || pending) return;
    if (text.length > MAX_CHARS) {
      setError("Keep it under 2000 characters.");
      return;
    }
    const next = [...messages, newMessage("user", text)].slice(-MAX_THREAD);
    setMessages(next);
    setDraft("");
    setError("");
    setConfirmClear(false);
    setPending(true);
    try {
      const result = await sendToFrank({
        data: {
          messages: next.map((message) => ({ role: message.role, content: message.content })),
        },
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessages((current) => [...current, newMessage("assistant", result.text)].slice(-80));
    } catch {
      setError("Could not send that. Try once more.");
    } finally {
      setPending(false);
      box.current?.focus();
    }
  }

  function clearChat() {
    setMessages([]);
    setError("");
    setConfirmClear(false);
  }

  return (
    <main className="mx-auto flex h-dvh w-full max-w-2xl flex-col px-4">
      <header className="flex items-start justify-between gap-3 border-b border-line py-4">
        <div>
          <div className="flex items-center gap-3">
            <span className="size-3 bg-sienna" aria-hidden="true" />
            <h1 className="font-display text-3xl leading-none text-ink">Frank</h1>
          </div>
          <p className="mt-2 text-sm text-muted">Plain talk. Not a sex chat, and not a how-to for hurting anyone.</p>
        </div>
        {confirmClear ? (
          <Button intent="danger" onClick={clearChat}>
            Clear it
          </Button>
        ) : (
          <Button intent="quiet" onClick={() => setConfirmClear(true)} disabled={messages.length === 0}>
            Clear
          </Button>
        )}
      </header>

      <div ref={scroller} className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {!ready ? (
          <p className="text-sm text-muted">Opening the chat…</p>
        ) : messages.length === 0 ? (
          <Intro />
        ) : (
          messages.map((message) => <Bubble key={message.id} message={message} />)
        )}
        {pending ? <p className="text-sm text-muted">Frank is thinking.</p> : null}
      </div>

      <form
        className="border-t border-line py-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
      >
        {error ? (
          <p className="mb-2 text-sm text-sienna" role="status">
            {error}
          </p>
        ) : null}
        <label className="block">
          <span className="sr-only">Message Frank</span>
          <textarea
            ref={box}
            className={fieldClass}
            rows={2}
            value={draft}
            placeholder="Say it plain."
            maxLength={MAX_CHARS}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <div className="mt-2 flex items-center justify-between gap-3">
          <p className="text-xs text-muted">Enter sends. Shift+Enter starts a new line.</p>
          <Button type="submit" disabled={pending || draft.trim().length === 0}>
            Send
          </Button>
        </div>
      </form>
    </main>
  );
}

function Intro() {
  return (
    <div className="rounded-xl border border-line bg-sheet px-4 py-6">
      <p className="text-xs font-semibold uppercase tracking-widest text-muted">Companion</p>
      <p className="mt-2 font-display text-3xl leading-tight text-ink">Talk straight.</p>
      <p className="mt-3 text-base text-muted">
        Frank answers like a friend: short, direct, no lecture. Sex and harm stay off the table. The chat
        stays on this device.
      </p>
    </div>
  );
}

function Bubble({ message }: { message: ChatMessage }) {
  const mine = message.role === "user";
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <p
        className={
          "max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-3 text-base " +
          (mine ? "bg-ink text-on-sienna" : "border border-line bg-sheet text-ink")
        }
      >
        {message.content}
      </p>
    </div>
  );
}
