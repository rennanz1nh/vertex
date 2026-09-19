"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";

export type SignaturePadHandle = {
  clear: () => void;
  isEmpty: () => boolean;
  toDataURL: () => string;
};

// Plain-canvas signature capture — mouse on desktop, touch on phones/tablets. No library:
// this is just drawing a line following the pointer, which canvas + pointer events handle
// natively across devices.
const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(function SignaturePad(
  { className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [isEmptyState, setIsEmptyState] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Sized once on mount for device-pixel sharpness. A resize (e.g. phone rotation)
    // clears the pad rather than trying to rescale the drawn strokes — simpler, and a
    // half-finished signature is easy to just redo.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx || rect.width === 0 || rect.height === 0) return;
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  function pointFromEvent(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.setPointerCapture(e.pointerId);
    drawingRef.current = true;
    lastPointRef.current = pointFromEvent(e);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawingRef.current) return;
    e.preventDefault();
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx || !lastPointRef.current) return;
    const point = pointFromEvent(e);
    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    lastPointRef.current = point;
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setIsEmptyState(false);
    }
  }

  function end(e: React.PointerEvent<HTMLCanvasElement>) {
    drawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(e.pointerId);
  }

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      hasDrawnRef.current = false;
      setIsEmptyState(true);
    },
    isEmpty() {
      return !hasDrawnRef.current;
    },
    toDataURL() {
      return canvasRef.current?.toDataURL("image/png") || "";
    },
  }));

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
        onPointerLeave={end}
        className="w-full h-40 bg-white border border-gray-300 rounded-sm touch-none cursor-crosshair"
      />
      {isEmptyState && (
        <p className="text-[11px] text-gray-400 mt-1">Sign above using your mouse or finger.</p>
      )}
    </div>
  );
});

export default SignaturePad;
