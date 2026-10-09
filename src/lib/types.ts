export type ItemType = "photo" | "note" | "voice" | "sticker";
export type CanvasItem = { id: string; family_id: string; user_id: string; type: ItemType; content_url: string | null; text_content: string | null; position_x: number; position_y: number; created_at: string; color?: string; author?: string; display_url?: string };
export type Story = { title: string; chapters: { title: string; text: string; item_ids: string[] }[]; emotional_summary: string };
export type Storybook = { id: string; family_id: string; title: string; story_json: Story; audio_url: string | null; created_at: string; status?: string; display_audio?: string };
export type Profile = { id: string; email: string; full_name: string; family_id: string; role: "parent" | "child" | "member" };
export type Family = { id: string; name: string; plan_type: "free" | "premium" };
