import { Link } from "@tanstack/react-router";

export function NotFound() {
  return (
    <main className="mx-auto flex h-dvh w-full max-w-md flex-col items-center justify-center px-4 py-8 text-center">
      <div className="w-full rounded-2xl border border-line bg-sheet p-8 shadow-sm">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full border border-line bg-paper text-sienna">
          <span className="font-display text-2xl font-semibold">404</span>
        </div>
        <div className="mt-4 flex items-center justify-center gap-2">
          <span className="size-2 bg-sienna" aria-hidden="true" />
          <span className="font-sans text-xs font-semibold tracking-widest uppercase text-muted">
            Frank
          </span>
        </div>
        <h1 className="mt-2 font-display text-3xl leading-tight text-ink">
          Lost your way?
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          There’s nothing here. Frank is waiting back in the room.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex h-11 w-full items-center justify-center rounded-lg bg-sienna px-5 text-sm font-medium text-on-sienna transition-colors hover:bg-ink"
          >
            Return to Frank
          </Link>
        </div>
      </div>
    </main>
  );
}
