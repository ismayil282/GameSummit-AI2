"use client";
import { useEffect, useRef, useState } from "react";
import { Canvas, PencilBrush } from "fabric";
import { Check, RotateCcw } from "lucide-react";
export function DrawingPad({ onSave }: { onSave: (file: File) => Promise<void> }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const instance = useRef<Canvas | null>(null);
  const [color, setColor] = useState("#76516d");
  const [saving, setSaving] = useState(false);
  useEffect(() => { const canvas = new Canvas(ref.current!, { width: 540, height: 330, backgroundColor: "#fffdf7", isDrawingMode: true }); const brush = new PencilBrush(canvas); brush.width = 4; brush.color = "#76516d"; canvas.freeDrawingBrush = brush; instance.current = canvas; return () => { instance.current = null; void canvas.dispose(); }; }, []);
  return <><p className="muted">A doodle, a little heart, a masterpiece. Make it yours.</p><div className="drawing-surface"><canvas ref={ref} /></div><div className="drawing-tools">{["#76516d", "#ed997e", "#71a58e", "#dcb75c", "#557cad"].map(c => <button key={c} aria-label={`Pen color ${c}`} className={`color-swatch ${color === c ? "selected" : ""}`} style={{ background: c }} onClick={() => { setColor(c); if (instance.current?.freeDrawingBrush) instance.current.freeDrawingBrush.color = c; }} />)}<button className="btn" onClick={() => instance.current?.getObjects().forEach(o => instance.current?.remove(o))}><RotateCcw size={15} />Clear</button><button className="btn primary" disabled={saving} onClick={async () => { setSaving(true); try { const data = instance.current!.toDataURL({ format: "png", multiplier: 2 }); const blob = await (await fetch(data)).blob(); await onSave(new File([blob], "family-doodle.png", { type: "image/png" })); } finally { setSaving(false); } }}><Check size={16} />{saving ? "Saving…" : "Add to canvas"}</button></div></>;
}
