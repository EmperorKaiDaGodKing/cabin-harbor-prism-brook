import { useEffect, useRef, useState } from "react";
import { ImagePlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FrankMark } from "@/components/frank/mark";
import { ImageViewer } from "@/components/frank/image-viewer";
import { fetchFrankStatus, requestFrankReply } from "@/lib/frank-client";
import { HEADER_LINE, INTRO_BODY, INTRO_TITLE, OFFLINE_NOTE } from "@/lib/frank-copy";
import { prepareChatImage } from "@/lib/frank-image";
import {
  MAX_IMAGES_PER_MESSAGE,
  MEDIA_COUNT_ERROR,
  sniffImageKind,
  type ChatImage,
} from "@/lib/frank-media";
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

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif,.jpg,.jpeg,.png,.webp,.gif";

function dragHasFiles(data: DataTransfer): boolean {
  const types = data.types;
  for (let index = 0; index < types.length; index += 1) {
    if (types[index] === "Files") return true;
  }
  return false;
}

function clipboardFiles(data: DataTransfer): File[] {
  const files: File[] = [];
  for (const item of data.items) {
    if (item.kind !== "file") continue;
    const file = item.getAsFile();
    if (!file) continue;
    if (file.type.startsWith("image/") || sniffImageKind(file) !== "other") files.push(file);
  }
  if (files.length > 0) return files;
  return [...data.files].filter(
    (file) => file.type.startsWith("image/") || sniffImageKind(file) !== "other",
  );
}

function galleryPhotos(messages: ChatMessage[]): { id: string; src: string }[] {
  const photos: { id: string; src: string }[] = [];
  for (const message of messages) {
    if (message.role !== "user" || !message.images) continue;
    for (const image of message.images) photos.push({ id: image.id, src: image.dataUrl });
  }
  return photos;
}

export function FrankChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [mood, setMood] = useState<Mood>("playful");
  const [ready, setReady] = useState(false);
  const [draft, setDraft] = useState("");
  const [attachments, setAttachments] = useState<ChatImage[]>([]);
  const [preparing, setPreparing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [canRetry, setCanRetry] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [configured, setConfigured] = useState<boolean | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const stick = useRef(true);
  const requestRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const dragDepth = useRef(0);
  const attachmentsRef = useRef<ChatImage[]>([]);
  const ingestGen = useRef(0);

  attachmentsRef.current = attachments;

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
        ...(message.images?.length ? { images: message.images.map((image) => image.dataUrl) } : {}),
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
    if (pending || preparing || configured === false) return;
    if (!text && attachments.length === 0) return;
    if (text.length > MAX_CHARS) {
      setError("Keep it under 2000 characters.");
      setCanRetry(false);
      return;
    }
    const next = [...messages, newMessage("user", text, crypto.randomUUID(), attachments)].slice(
      -80,
    );
    setMessages(next);
    setDraft("");
    setAttachments([]);
    await submit(next);
  }

  async function retry() {
    if (pending || preparing) return;
    const last = messages[messages.length - 1];
    if (!last || last.role !== "user") return;
    await submit(messages);
  }

  function clearChat() {
    ingestGen.current += 1;
    requestRef.current += 1;
    abortRef.current?.abort();
    setMessages([]);
    setDraft("");
    setAttachments([]);
    setOpenId(null);
    setError("");
    setCanRetry(false);
    setConfirmClear(false);
    setPending(false);
    setPreparing(false);
  }

  async function addFiles(list: File[]) {
    if (configured === false || pending) return;
    const incoming = list.filter((file) => file.size > 0);
    if (incoming.length === 0) return;
    const gen = ingestGen.current + 1;
    ingestGen.current = gen;
    setPreparing(true);
    setError("");
    setCanRetry(false);
    let message = "";
    const next = [...attachmentsRef.current];
    for (const file of incoming) {
      if (ingestGen.current !== gen) return;
      if (next.length >= MAX_IMAGES_PER_MESSAGE) {
        message = MEDIA_COUNT_ERROR;
        break;
      }
      const result = await prepareChatImage(file);
      if (ingestGen.current !== gen) return;
      if (!result.ok) {
        message = result.error;
        continue;
      }
      next.push(result.image);
      attachmentsRef.current = next;
      setAttachments([...next]);
    }
    if (ingestGen.current !== gen) return;
    if (message) setError(message);
    setPreparing(false);
  }

  function removeAttachment(id: string) {
    setAttachments((current) => current.filter((image) => image.id !== id));
  }

  function openPicker() {
    if (configured === false || pending || preparing) return;
    if (attachments.length >= MAX_IMAGES_PER_MESSAGE) {
      setError(MEDIA_COUNT_ERROR);
      setCanRetry(false);
      return;
    }
    fileInput.current?.click();
  }

  const showTyping = pending && messages[messages.length - 1]?.role !== "assistant";
  const photos = galleryPhotos(messages);
  const openIndex = photos.findIndex((photo) => photo.id === openId);
  const canSend =
    !pending &&
    !preparing &&
    configured !== false &&
    (draft.trim().length > 0 || attachments.length > 0);

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
              disabled={messages.length === 0 && attachments.length === 0}
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
          messages.map((message) => (
            <Bubble key={message.id} message={message} onOpen={setOpenId} />
          ))
        )}
        {showTyping ? <Typing /> : null}
      </div>

      <form
        className={
          "composer-pad border-t border-line pt-3" +
          (dragging ? " rounded-lg border border-dashed border-sienna" : "")
        }
        onSubmit={(event) => {
          event.preventDefault();
          void send();
        }}
        onDragEnter={(event) => {
          if (!dragHasFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepth.current += 1;
          setDragging(true);
        }}
        onDragOver={(event) => {
          if (!dragHasFiles(event.dataTransfer)) return;
          event.preventDefault();
        }}
        onDragLeave={(event) => {
          if (!dragHasFiles(event.dataTransfer)) return;
          event.preventDefault();
          dragDepth.current -= 1;
          if (dragDepth.current <= 0) {
            dragDepth.current = 0;
            setDragging(false);
          }
        }}
        onDrop={(event) => {
          event.preventDefault();
          dragDepth.current = 0;
          setDragging(false);
          void addFiles([...event.dataTransfer.files]);
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
        {dragging ? (
          <p
            className="mb-3 rounded-lg border border-dashed border-sienna bg-sheet px-3 py-3 text-sm text-ink"
            role="status"
          >
            Drop the photo
          </p>
        ) : null}
        {preparing ? (
          <p className="mb-3 text-sm text-muted" role="status">
            Preparing the photo…
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
                disabled={pending || preparing}
              >
                Retry
              </Button>
            ) : null}
          </div>
        ) : null}
        {attachments.length > 0 ? (
          <ul className="mb-3 flex gap-3 overflow-x-auto pt-3 pr-3" aria-label="Photos to send">
            {attachments.map((image, index) => (
              <li key={image.id} className="relative shrink-0">
                <img
                  src={image.dataUrl}
                  alt={`Photo ${index + 1} to send`}
                  className="size-20 rounded-lg object-cover"
                />
                <button
                  type="button"
                  className="absolute -top-2 -right-2 flex size-11 items-center justify-center"
                  aria-label={`Remove photo ${index + 1}`}
                  onClick={() => removeAttachment(image.id)}
                >
                  <span className="flex size-6 items-center justify-center rounded-full bg-ink text-on-sienna">
                    <X className="size-4" aria-hidden="true" />
                  </span>
                </button>
              </li>
            ))}
          </ul>
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
            onPaste={(event) => {
              const files = clipboardFiles(event.clipboardData);
              if (files.length === 0) return;
              event.preventDefault();
              void addFiles(files);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                void send();
              }
            }}
          />
        </label>
        <div className="mt-2 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <Button
              className="w-11 shrink-0 px-0"
              aria-label="Add a photo"
              onClick={openPicker}
              disabled={configured === false || pending || preparing}
            >
              <ImagePlus className="size-5" aria-hidden="true" />
            </Button>
            <input
              ref={fileInput}
              className="sr-only"
              type="file"
              accept={ACCEPT}
              multiple
              aria-hidden="true"
              tabIndex={-1}
              onChange={(event) => {
                const files = event.target.files ? [...event.target.files] : [];
                event.target.value = "";
                void addFiles(files);
              }}
            />
            <p className="min-w-0 text-xs text-muted">
              <span className="sm:hidden">
                {draft.length} / {MAX_CHARS}
              </span>
              <span className="hidden sm:inline">
                Paste a photo. Enter sends. Shift+Enter for a new line. {draft.length} / {MAX_CHARS}
              </span>
            </p>
          </div>
          <Button type="submit" className="shrink-0" disabled={!canSend}>
            Send
          </Button>
        </div>
      </form>
      {openIndex >= 0 ? (
        <ImageViewer
          images={photos}
          index={openIndex}
          onIndex={(next) => {
            const photo = photos[next];
            if (photo) setOpenId(photo.id);
          }}
          onClose={() => setOpenId(null)}
        />
      ) : null}
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

function Bubble({ message, onOpen }: { message: ChatMessage; onOpen: (id: string) => void }) {
  const mine = message.role === "user";
  const images = message.images ?? [];
  return (
    <div className={mine ? "flex justify-end" : "flex justify-start"}>
      <div className="max-w-[85%]">
        {mine ? null : <p className="mb-1 text-xs font-medium text-muted">Frank</p>}
        <div
          className={
            "rounded-xl px-3 py-3 text-base " +
            (mine ? "bg-ink text-on-sienna" : "border border-line bg-sheet text-ink")
          }
        >
          <span className="sr-only">{mine ? "You said: " : "Frank said: "}</span>
          {images.length > 0 ? (
            <div className={images.length > 1 ? "grid grid-cols-2 gap-2" : ""}>
              {images.map((image, index) => (
                <button
                  key={image.id}
                  type="button"
                  className="block w-full overflow-hidden rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sienna"
                  onClick={() => onOpen(image.id)}
                >
                  <img
                    src={image.dataUrl}
                    alt={images.length > 1 ? `Photo ${index + 1} you sent` : "Photo you sent"}
                    className="max-h-64 w-full rounded-lg object-contain"
                  />
                </button>
              ))}
            </div>
          ) : null}
          {message.content ? (
            <p className={"whitespace-pre-wrap" + (images.length > 0 ? " mt-2" : "")}>
              {message.content}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
