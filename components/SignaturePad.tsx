"use client";

import { useEffect, useRef, useState } from "react";

interface SignaturePadProps {
  label: string;
  value: string;
  onChange: (dataUrl: string) => void;
}

export function SignaturePad({ label, value, onChange }: SignaturePadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const [hasStroke, setHasStroke] = useState(Boolean(value));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const ratio = window.devicePixelRatio || 1;
    const width = canvas.offsetWidth;
    const height = canvas.offsetHeight;
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#1a2e24";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);

    if (value) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, width, height);
      img.src = value;
      setHasStroke(true);
    }
  }, [value]);

  function getPoint(event: React.MouseEvent | React.TouchEvent) {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ("touches" in event) {
      const touch = event.touches[0];
      return { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
    }
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    };
  }

  function startDraw(event: React.MouseEvent | React.TouchEvent) {
    event.preventDefault();
    drawingRef.current = true;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const point = getPoint(event);
    ctx.beginPath();
    ctx.moveTo(point.x, point.y);
  }

  function draw(event: React.MouseEvent | React.TouchEvent) {
    if (!drawingRef.current) return;
    event.preventDefault();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const point = getPoint(event);
    ctx.lineTo(point.x, point.y);
    ctx.stroke();
    setHasStroke(true);
  }

  function endDraw() {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    const canvas = canvasRef.current;
    if (canvas) onChange(canvas.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.offsetWidth, canvas.offsetHeight);
    setHasStroke(false);
    onChange("");
  }

  return (
    <div className="block text-sm">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-medium tracking-[0.16em] text-forest/70 uppercase">
          {label}
        </span>
        <button
          type="button"
          onClick={clear}
          className="text-[11px] tracking-wide text-forest/55 uppercase hover:text-forest"
        >
          Clear
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-forest/15 bg-white">
        <canvas
          ref={canvasRef}
          className="h-32 w-full touch-none cursor-crosshair"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      {!hasStroke && (
        <p className="mt-1 text-xs text-forest/45">Sign above using mouse or touch</p>
      )}
    </div>
  );
}
