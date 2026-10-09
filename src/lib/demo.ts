import type { CanvasItem, Storybook } from "./types";
export const demoFamily = { id: "demo", name: "The Andersons", plan_type: "free" as const };
export const demoMembers = [
  { id: "emma", full_name: "Emma Anderson", email: "emma@example.com", family_id: "demo", role: "parent" as const },
  { id: "james", full_name: "James Anderson", email: "james@example.com", family_id: "demo", role: "parent" as const },
  { id: "olivia", full_name: "Olivia Anderson", email: "olivia@example.com", family_id: "demo", role: "child" as const },
  { id: "leo", full_name: "Leo Anderson", email: "leo@example.com", family_id: "demo", role: "child" as const },
];
const photo = (id: string) => `/demo/${id === "photo-1473496169904-658ba7c44d8a" ? "beach" : id === "photo-1511895426328-dc8714191300" ? "family" : "cookies"}.jpg`;
export const demoItems: CanvasItem[] = [
  { id: "1", family_id: "demo", user_id: "emma", type: "photo", content_url: photo("photo-1473496169904-658ba7c44d8a"), text_content: "A little sunshine, a lot of us. ☀️", position_x: 55, position_y: 60, created_at: "2026-10-09T09:00:00Z", author: "Emma" },
  { id: "2", family_id: "demo", user_id: "olivia", type: "note", content_url: null, text_content: "Today was the BEST day! Dad taught me how to ride my bike without training wheels! 🚲\n\nLove you, Dad ♡", position_x: 370, position_y: 48, created_at: "2026-10-09T10:15:00Z", color: "yellow", author: "Olivia" },
  { id: "3", family_id: "demo", user_id: "james", type: "photo", content_url: photo("photo-1511895426328-dc8714191300"), text_content: "My favorite people. My favorite place.", position_x: 680, position_y: 78, created_at: "2026-10-09T11:30:00Z", author: "James" },
  { id: "4", family_id: "demo", user_id: "leo", type: "note", content_url: null, text_content: "Things I’m grateful for:\n\n🍕 Friday pizza nights\n🐶 Charlie’s cuddles\n💛 Our little family", position_x: 52, position_y: 390, created_at: "2026-10-08T15:00:00Z", color: "pink", author: "Leo" },
  { id: "5", family_id: "demo", user_id: "emma", type: "photo", content_url: photo("photo-1499636136210-6f4ee915583e"), text_content: "Baking memories (and a little mess) 🍪", position_x: 365, position_y: 345, created_at: "2026-10-08T16:30:00Z", author: "Emma" },
  { id: "6", family_id: "demo", user_id: "james", type: "voice", content_url: null, text_content: "A little message for my favorite team", position_x: 685, position_y: 425, created_at: "2026-10-09T12:00:00Z", author: "James" },
  { id: "7", family_id: "demo", user_id: "olivia", type: "sticker", content_url: null, text_content: "little moments,\nbig memories", position_x: 730, position_y: 610, created_at: "2026-10-09T12:05:00Z", author: "Olivia" },
];
export function demoStory(items: CanvasItem[]): Storybook {
  return { id: crypto.randomUUID(), family_id: "demo", title: "The magic in our everyday", audio_url: null, created_at: new Date().toISOString(), story_json: { title: "The magic in our everyday", chapters: [
    { title: "A pocketful of sunshine", text: "Some memories arrive quietly: a warm afternoon, familiar laughter, and the wonderful feeling of being together. The Andersons made room for a little adventure and a whole lot of love.", item_ids: items.filter(i => i.type === "photo").map(i => i.id) },
    { title: "Small steps, big feelings", text: items.filter(i => i.type === "note").map(i => i.text_content).join("\n\n") || "Today’s little moments became tomorrow’s favorite memories.", item_ids: items.filter(i => i.type === "note").map(i => i.id) },
    { title: "Our kind of happy", text: "It wasn’t a perfect day. It was something better: our day. A little mess, a few new firsts, and reminders that home is the people who cheer you on.", item_ids: [] },
  ], emotional_summary: "Connection, gratitude, and the joy of growing together. A family finding magic in ordinary moments." } };
}
