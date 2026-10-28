import { Button } from "@/components/ui/button";
import { FrankMark } from "@/components/frank/mark";
import { AGE_BODY, AGE_NOTE } from "@/lib/frank-copy";

export function Opening() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col items-center justify-center px-4">
      <p className="font-display text-3xl text-ink">Frank</p>
      <p className="sr-only">Opening the chat.</p>
    </main>
  );
}

export function AgeGate({ onConfirm, onLeave }: { onConfirm: () => void; onLeave: () => void }) {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col justify-center overflow-y-auto px-4 py-8">
      <div className="rounded-xl border border-line bg-sheet px-5 py-6">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">Adults only</p>
        <h1 className="mt-3 font-display text-4xl leading-none text-ink">Frank</h1>
        <div className="mt-4">
          <FrankMark />
        </div>
        <p className="mt-4 text-base text-ink">{AGE_BODY}</p>
        <p className="mt-3 text-sm text-muted">{AGE_NOTE}</p>
        <div className="mt-6 flex flex-col gap-3">
          <Button type="button" onClick={onConfirm}>
            I am 18 or older
          </Button>
          <Button type="button" intent="quiet" onClick={onLeave}>
            I'm under 18
          </Button>
        </div>
      </div>
    </main>
  );
}

export function AgeDeclined({ onBack }: { onBack: () => void }) {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col justify-center overflow-y-auto px-4 py-8">
      <div className="rounded-xl border border-line bg-sheet px-5 py-6">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">Adults only</p>
        <h1 className="mt-3 font-display text-4xl leading-tight text-ink">
          This room is for adults.
        </h1>
        <p className="mt-4 text-base text-muted">
          Frank only continues with people who are 18 or older.
        </p>
        <div className="mt-6">
          <Button type="button" intent="quiet" onClick={onBack}>
            Back
          </Button>
        </div>
      </div>
    </main>
  );
}
