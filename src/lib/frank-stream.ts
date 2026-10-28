export type FrankSseEvent =
  { type: "delta"; text: string } | { type: "error"; error: string } | { type: "done" };

export function formatFrankEvent(event: FrankSseEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

export function deltaText(content: unknown): string {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .map((part) => {
      if (typeof part === "string") return part;
      if (part && typeof part === "object" && "text" in part && typeof part.text === "string") {
        return part.text;
      }
      return "";
    })
    .join("");
}

export type UpstreamParse = {
  deltas: string[];
  rest: string;
  done: boolean;
  failed: boolean;
};

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return null;
  return value as Record<string, unknown>;
}

/** Pull content deltas out of an OpenAI-style server-sent stream. Incomplete trailing line stays in `rest`. */
export function consumeUpstreamSse(buffer: string): UpstreamParse {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = normalized.split("\n");
  const rest = lines.pop() ?? "";
  const deltas: string[] = [];
  let done = false;
  let failed = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed.startsWith("data:")) continue;
    const data = trimmed.slice(5).trim();
    if (!data) continue;
    if (data === "[DONE]") {
      done = true;
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }

    const record = asRecord(parsed);
    if (!record) continue;
    if (record.error) {
      failed = true;
      continue;
    }

    const choices = record.choices;
    const first = Array.isArray(choices) ? asRecord(choices[0]) : null;
    const delta = first ? asRecord(first.delta) : null;
    const text = deltaText(delta?.content);
    if (text) deltas.push(text);
  }

  return { deltas, rest, done, failed };
}

export function consumeFrankSse(buffer: string): { events: FrankSseEvent[]; rest: string } {
  const normalized = buffer.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const chunks = normalized.split("\n\n");
  const rest = chunks.pop() ?? "";
  const events: FrankSseEvent[] = [];

  for (const chunk of chunks) {
    const line = chunk
      .split("\n")
      .map((entry) => entry.trim())
      .find((entry) => entry.startsWith("data:"));
    if (!line) continue;
    const data = line.slice(5).trim();
    let parsed: unknown;
    try {
      parsed = JSON.parse(data);
    } catch {
      continue;
    }
    const record = asRecord(parsed);
    if (!record) continue;
    if (record.type === "delta" && typeof record.text === "string" && record.text) {
      events.push({ type: "delta", text: record.text });
    } else if (record.type === "error" && typeof record.error === "string") {
      events.push({ type: "error", error: record.error });
    } else if (record.type === "done") {
      events.push({ type: "done" });
    }
  }

  return { events, rest };
}
