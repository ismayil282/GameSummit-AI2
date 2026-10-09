"use client";
/* eslint-disable @next/next/no-img-element */
import { Heart, Mic, Play, Trash2 } from "lucide-react";
import { useRef, useState } from "react";
import type { CanvasItem } from "@/lib/types";

export function MemoryCard({ item, author, onMove, onDelete, onOpen }: { item: CanvasItem; author: string; onMove: (id: string, x: number, y: number) => void; onDelete: (id: string) => void; onOpen: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ x: number; y: number; px: number; py: number; scale: number; moved: boolean } | null>(null);
  const [liked, setLiked] = useState(false);
  const url = item.display_url || item.content_url;
  const rotation = Number(item.id.replace(/\D/g, "").slice(0, 2) || 4) % 2 ? -3 : 2;
  return <div ref={ref} className={`memory-card ${item.type} ${item.color || (item.type === "note" ? "yellow" : "")}`} style={{ left: item.position_x, top: item.position_y, transform: `rotate(${rotation}deg)` }}
    onPointerDown={e => {
      if ((e.target as HTMLElement).closest("button,audio")) return;
      const parent = e.currentTarget.parentElement!;
      drag.current = { x: e.clientX, y: e.clientY, px: item.position_x, py: item.position_y, scale: parent.getBoundingClientRect().width / parent.offsetWidth, moved: false };
      e.currentTarget.setPointerCapture(e.pointerId);
    }} onPointerMove={e => {
      const d = drag.current; if (!d || !ref.current) return;
      if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 5) d.moved = true;
      ref.current.style.left = `${Math.max(0, Math.min(740, d.px + (e.clientX - d.x) / d.scale))}px`;
      ref.current.style.top = `${Math.max(0, Math.min(680, d.py + (e.clientY - d.y) / d.scale))}px`;
      ref.current.style.zIndex = "30";
    }} onPointerUp={() => {
      const d = drag.current; if (!d || !ref.current) return;
      if (d.moved) onMove(item.id, parseFloat(ref.current.style.left), parseFloat(ref.current.style.top));
      else if (item.type === "photo") onOpen();
      ref.current.style.zIndex = ""; drag.current = null;
    }}>
    {item.type === "photo" && <><span className="tape" /><img className="memory-photo" src={url || ""} alt={item.text_content || "Family memory"} draggable={false} /><p className="photo-caption">{item.text_content}</p></>}
    {item.type === "note" && <><span className="note-pin" /><p className="note-text">{item.text_content}</p></>}
    {item.type === "voice" && <><div className="voice-heading"><span className="voice-icon"><Mic size={20} /></span><span>A little love, out loud<small>Voice note from {author}</small></span></div><div className="waveform"><Play size={17} fill="currentColor" />{Array.from({ length: 28 }, (_, i) => <i key={i} style={{ height: 8 + ((i * 17 + 11) % 28) }} />)}</div>{url ? <audio controls preload="none" src={url} className="voice-audio" /> : <button className="demo-play" onClick={() => { const speech = new SpeechSynthesisUtterance(item.text_content || "I love you, my favorite team. Can’t wait to see you all tonight!"); speechSynthesis.speak(speech); }}>Listen to demo message <Play size={12} /></button>}<p className="voice-caption">{item.text_content}</p></>}
    {item.type === "sticker" ? <div className="sticker-text"><Heart size={36} strokeWidth={1.4} /><p>{item.text_content}</p><span>✦</span></div> : <div className="card-meta"><span className={`mini-avatar avatar-${author.toLowerCase()[0]}`}>{author[0]}</span><span>{author}</span><span className="meta-time">{new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span><button aria-label={liked ? "Unlike memory" : "Like memory"} onClick={() => setLiked(v => !v)} className={liked ? "liked" : ""}><Heart size={14} fill={liked ? "currentColor" : "none"} /></button></div>}
    <button className="delete-memory" aria-label="Delete memory" onClick={() => onDelete(item.id)}><Trash2 size={13} /></button>
  </div>;
}
