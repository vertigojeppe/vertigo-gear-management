"use client";

import { useRef, useState } from "react";
import type { MarkupTool } from "../../../../config/app.config";

export type Shape = {
  id: string;
  type: "path" | "arrow" | "rect" | "text";
  /** Normalised 0..1 coordinates: x0,y0,x1,y1,... */
  points: number[];
  text?: string;
  color: string;
  authorId?: string;
  authorName?: string;
  createdAt?: string;
};

const newId = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36);

/**
 * SVG overlay drawn on top of an image or a rendered PDF page. Shapes are
 * stored in normalised coordinates so they follow the content at any size;
 * they are mapped to pixels here. Pointer events only when a tool is active,
 * so pinch-zoom and scrolling keep working on a phone.
 */
export function MarkupLayer({
  width,
  height,
  shapes,
  onChange,
  tool,
  color,
  readOnly,
  promptText,
}: {
  width: number;
  height: number;
  shapes: Shape[];
  onChange: (shapes: Shape[]) => void;
  tool: MarkupTool;
  color: string;
  readOnly?: boolean;
  promptText: string;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [draft, setDraft] = useState<Shape | null>(null);
  const active = !readOnly && tool !== "select";

  const toNorm = (e: React.PointerEvent) => {
    const r = svgRef.current!.getBoundingClientRect();
    return [Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height))];
  };

  const onDown = (e: React.PointerEvent) => {
    if (!active) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const [x, y] = toNorm(e);
    if (tool === "text") {
      const text = window.prompt(promptText)?.trim();
      if (text) onChange([...shapes, { id: newId(), type: "text", points: [x, y], text, color }]);
      return;
    }
    setDraft({ id: newId(), type: tool === "pen" ? "path" : tool, points: tool === "pen" ? [x, y] : [x, y, x, y], color });
  };
  const onMove = (e: React.PointerEvent) => {
    if (!draft) return;
    const [x, y] = toNorm(e);
    setDraft(draft.type === "path" ? { ...draft, points: [...draft.points, x, y] } : { ...draft, points: [draft.points[0], draft.points[1], x, y] });
  };
  const onUp = () => {
    if (!draft) return;
    const d = draft;
    setDraft(null);
    const moved = d.type === "path" ? d.points.length >= 6 : Math.abs(d.points[2] - d.points[0]) + Math.abs(d.points[3] - d.points[1]) > 0.005;
    if (moved) onChange([...shapes, d]);
  };

  const px = (v: number, axis: "x" | "y") => v * (axis === "x" ? width : height);

  return (
    <svg
      ref={svgRef}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="absolute inset-0"
      style={{ pointerEvents: active ? "auto" : "none", touchAction: active ? "none" : "auto", cursor: active ? "crosshair" : "default" }}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
      aria-label="markup"
    >
      <defs>
        {[...new Set([...shapes, ...(draft ? [draft] : [])].map((s) => s.color))].map((c) => (
          <marker key={c} id={`arrow-${c.slice(1)}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse">
            <path d="M 0 0 L 10 5 L 0 10 z" fill={c} />
          </marker>
        ))}
      </defs>
      {[...shapes, ...(draft ? [draft] : [])].map((s) => {
        const title = s.authorName ? `${s.authorName}${s.createdAt ? ` · ${new Date(s.createdAt).toLocaleString()}` : ""}` : undefined;
        if (s.type === "path") {
          const d = s.points.map((v, i) => `${i % 2 === 0 ? (i === 0 ? "M" : "L") : ""}${i % 2 === 0 ? px(v, "x") : px(v, "y")}`).join(" ");
          return (
            <path key={s.id} d={d} fill="none" stroke={s.color} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" data-shape={s.type}>
              {title && <title>{title}</title>}
            </path>
          );
        }
        if (s.type === "arrow") {
          return (
            <line key={s.id} x1={px(s.points[0], "x")} y1={px(s.points[1], "y")} x2={px(s.points[2], "x")} y2={px(s.points[3], "y")} stroke={s.color} strokeWidth={3} strokeLinecap="round" markerEnd={`url(#arrow-${s.color.slice(1)})`} data-shape={s.type}>
              {title && <title>{title}</title>}
            </line>
          );
        }
        if (s.type === "rect") {
          const x = Math.min(s.points[0], s.points[2]);
          const y = Math.min(s.points[1], s.points[3]);
          const w = Math.abs(s.points[2] - s.points[0]);
          const h = Math.abs(s.points[3] - s.points[1]);
          return (
            <rect key={s.id} x={px(x, "x")} y={px(y, "y")} width={px(w, "x")} height={px(h, "y")} fill="none" stroke={s.color} strokeWidth={3} data-shape={s.type}>
              {title && <title>{title}</title>}
            </rect>
          );
        }
        return (
          <g key={s.id} data-shape={s.type}>
            {title && <title>{title}</title>}
            <text x={px(s.points[0], "x")} y={px(s.points[1], "y")} fill={s.color} fontSize={16} fontWeight={600} stroke="#fff" strokeWidth={3} paintOrder="stroke" style={{ userSelect: "none" }}>
              {s.text}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
