import { useCallback, useEffect, useRef, useState, type MouseEvent } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export type ViewerPhoto = {
  id: string;
  src: string;
};

type Pan = { x: number; y: number };

const MIN_SCALE = 1;
const MAX_SCALE = 4;
const SWIPE_PX = 48;

function clampPan(pan: Pan, scale: number): Pan {
  if (scale <= MIN_SCALE) return { x: 0, y: 0 };
  const limitX = window.innerWidth * 0.6 * scale;
  const limitY = window.innerHeight * 0.6 * scale;
  return {
    x: Math.min(limitX, Math.max(-limitX, pan.x)),
    y: Math.min(limitY, Math.max(-limitY, pan.y)),
  };
}

function touchDistance(a: Touch, b: Touch): number {
  return Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
}

export function ImageViewer({
  images,
  index,
  onIndex,
  onClose,
}: {
  images: ViewerPhoto[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const photo = images[index];
  const stageRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState<Pan>({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const panRef = useRef<Pan>({ x: 0, y: 0 });
  const indexRef = useRef(index);
  const imagesRef = useRef(images);
  const onIndexRef = useRef(onIndex);
  const onCloseRef = useRef(onClose);
  const lastTapRef = useRef(0);
  const movedRef = useRef(false);
  const suppressClick = useRef(false);
  const mousePan = useRef<{ id: number; x: number; y: number; pan: Pan } | null>(null);

  indexRef.current = index;
  imagesRef.current = images;
  onIndexRef.current = onIndex;
  onCloseRef.current = onClose;

  const applyView = useCallback((nextScale: number, nextPan: Pan) => {
    const clamped = Math.min(MAX_SCALE, Math.max(MIN_SCALE, nextScale));
    const limited = clampPan(nextPan, clamped);
    scaleRef.current = clamped;
    panRef.current = limited;
    setScale(clamped);
    setPan(limited);
  }, []);

  useEffect(() => {
    applyView(1, { x: 0, y: 0 });
  }, [index, applyView]);

  useEffect(() => {
    const previous = document.activeElement;
    closeRef.current?.focus();
    return () => {
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onCloseRef.current();
        return;
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        if (indexRef.current > 0) onIndexRef.current(indexRef.current - 1);
        return;
      }
      if (event.key === "ArrowRight") {
        event.preventDefault();
        const last = imagesRef.current.length - 1;
        if (indexRef.current < last) onIndexRef.current(indexRef.current + 1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;

    type Gesture = {
      mode: "pinch" | "pan" | "swipe";
      startDist: number;
      startScale: number;
      startPan: Pan;
      startX: number;
      startY: number;
      lastX: number;
      lastY: number;
    };

    let gesture: Gesture | null = null;

    function onStart(event: TouchEvent) {
      if (event.touches.length === 2) {
        const first = event.touches[0];
        const second = event.touches[1];
        if (!first || !second) return;
        gesture = {
          mode: "pinch",
          startDist: Math.max(1, touchDistance(first, second)),
          startScale: scaleRef.current,
          startPan: panRef.current,
          startX: 0,
          startY: 0,
          lastX: 0,
          lastY: 0,
        };
        return;
      }
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      gesture = {
        mode: scaleRef.current > 1 ? "pan" : "swipe",
        startDist: 0,
        startScale: scaleRef.current,
        startPan: panRef.current,
        startX: touch.clientX,
        startY: touch.clientY,
        lastX: touch.clientX,
        lastY: touch.clientY,
      };
    }

    function onMove(event: TouchEvent) {
      if (!gesture) return;
      if (gesture.mode === "pinch" && event.touches.length === 2) {
        const first = event.touches[0];
        const second = event.touches[1];
        if (!first || !second) return;
        event.preventDefault();
        const dist = touchDistance(first, second);
        applyView(gesture.startScale * (dist / gesture.startDist), gesture.startPan);
        return;
      }
      if (event.touches.length !== 1) return;
      const touch = event.touches[0];
      if (!touch) return;
      gesture.lastX = touch.clientX;
      gesture.lastY = touch.clientY;
      if (gesture.mode === "pan") {
        event.preventDefault();
        applyView(scaleRef.current, {
          x: gesture.startPan.x + (touch.clientX - gesture.startX),
          y: gesture.startPan.y + (touch.clientY - gesture.startY),
        });
      }
    }

    function onEnd(event: TouchEvent) {
      if (!gesture || event.touches.length > 0) return;
      const dx = gesture.lastX - gesture.startX;
      const dy = gesture.lastY - gesture.startY;
      const tap = Math.abs(dx) < 12 && Math.abs(dy) < 12;
      if (gesture.mode === "pinch" || gesture.mode === "pan" || !tap) suppressClick.current = true;
      if (gesture.mode === "swipe" && scaleRef.current <= 1 && !tap) {
        if (Math.abs(dx) > SWIPE_PX && Math.abs(dx) > Math.abs(dy) * 1.2) {
          if (dx < 0 && indexRef.current < imagesRef.current.length - 1) {
            onIndexRef.current(indexRef.current + 1);
          } else if (dx > 0 && indexRef.current > 0) {
            onIndexRef.current(indexRef.current - 1);
          }
        }
      }
      if (tap && gesture.mode !== "pinch") {
        const now = Date.now();
        if (now - lastTapRef.current < 280) {
          applyView(scaleRef.current > 1 ? 1 : 2, { x: 0, y: 0 });
          lastTapRef.current = 0;
        } else {
          lastTapRef.current = now;
        }
      }
      gesture = null;
    }

    function onWheel(event: WheelEvent) {
      event.preventDefault();
      const next = scaleRef.current * (event.deltaY < 0 ? 1.08 : 0.92);
      applyView(next, panRef.current);
    }

    node.addEventListener("touchstart", onStart, { passive: true });
    node.addEventListener("touchmove", onMove, { passive: false });
    node.addEventListener("touchend", onEnd);
    node.addEventListener("touchcancel", onEnd);
    node.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      node.removeEventListener("touchstart", onStart);
      node.removeEventListener("touchmove", onMove);
      node.removeEventListener("touchend", onEnd);
      node.removeEventListener("touchcancel", onEnd);
      node.removeEventListener("wheel", onWheel);
    };
  }, [applyView]);

  if (!photo) return null;

  const many = images.length > 1;

  function step(delta: number) {
    const next = index + delta;
    if (next < 0 || next >= images.length) return;
    onIndex(next);
  }

  function onBackdropClick(event: MouseEvent<HTMLElement>) {
    if (suppressClick.current || movedRef.current) {
      suppressClick.current = false;
      movedRef.current = false;
      return;
    }
    if (event.target === event.currentTarget) onClose();
  }

  return (
    <div
      className="photo-frame fixed inset-0 z-50 flex flex-col bg-ink text-on-sienna"
      role="dialog"
      aria-modal="true"
      aria-label="Photo"
    >
      <div className="flex items-center justify-between gap-2 px-3 pt-3">
        <div className="flex items-center gap-2">
          {many ? (
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-lg border border-line bg-ink text-on-sienna disabled:opacity-40"
              aria-label="Previous photo"
              disabled={index === 0}
              onClick={() => step(-1)}
            >
              <ChevronLeft className="size-5" aria-hidden="true" />
            </button>
          ) : null}
          {many ? (
            <p className="text-sm" aria-live="polite">
              {index + 1} of {images.length}
            </p>
          ) : (
            <p className="sr-only">Photo</p>
          )}
          {many ? (
            <button
              type="button"
              className="flex size-11 items-center justify-center rounded-lg border border-line bg-ink text-on-sienna disabled:opacity-40"
              aria-label="Next photo"
              disabled={index === images.length - 1}
              onClick={() => step(1)}
            >
              <ChevronRight className="size-5" aria-hidden="true" />
            </button>
          ) : null}
        </div>
        <button
          ref={closeRef}
          type="button"
          className="flex size-11 items-center justify-center rounded-lg border border-line bg-ink text-on-sienna"
          aria-label="Close photo"
          onClick={onClose}
        >
          <X className="size-5" aria-hidden="true" />
        </button>
      </div>
      <div
        ref={stageRef}
        className="photo-stage relative min-h-0 flex-1"
        onClick={onBackdropClick}
        onDoubleClick={(event) => {
          event.stopPropagation();
          applyView(scale > 1 ? 1 : 2, { x: 0, y: 0 });
        }}
        onPointerDown={(event) => {
          if (event.pointerType !== "mouse" || scaleRef.current <= 1) return;
          movedRef.current = false;
          mousePan.current = {
            id: event.pointerId,
            x: event.clientX,
            y: event.clientY,
            pan: panRef.current,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const drag = mousePan.current;
          if (!drag || drag.id !== event.pointerId) return;
          const dx = event.clientX - drag.x;
          const dy = event.clientY - drag.y;
          if (Math.hypot(dx, dy) > 6) movedRef.current = true;
          applyView(scaleRef.current, { x: drag.pan.x + dx, y: drag.pan.y + dy });
        }}
        onPointerUp={(event) => {
          if (mousePan.current?.id === event.pointerId) mousePan.current = null;
        }}
      >
        <img
          src={photo.src}
          alt={many ? `Photo ${index + 1} of ${images.length}` : "Photo"}
          draggable={false}
          className="absolute inset-0 m-auto max-h-full max-w-full object-contain select-none"
          style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})` }}
          onClick={(event) => event.stopPropagation()}
        />
        <p className="sr-only">Pinch or double-tap to zoom. Esc closes.</p>
      </div>
    </div>
  );
}
