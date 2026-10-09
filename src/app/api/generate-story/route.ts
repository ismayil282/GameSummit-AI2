import { z } from "zod";
import { adminClient, apiError, checkOrigin, HttpError, readJson, requireFamily } from "@/lib/supabase/server";
import { tellStory, narrate } from "@/lib/openai/storyteller";
import type { CanvasItem } from "@/lib/types";
export const maxDuration = 300;
const input = z.object({ start: z.iso.datetime(), end: z.iso.datetime() }).refine(v => v.start < v.end, "Choose a valid timeframe.");
export async function POST(request: Request) {
  let reservation: string | null = null;
  let mediaPath: string | null = null;
  try {
    checkOrigin(request);
    const parsed = input.safeParse(await readJson(request));
    if (!parsed.success) throw new HttpError(400, "Provide a valid start and end timestamp.");
    const { db, family } = await requireFamily();
    if (!process.env.OPENAI_API_KEY) throw new HttpError(503, "The AI storyteller is not configured yet.");
    const { data, error } = await db.from("canvas_items").select("*").eq("family_id", family.id).gte("created_at", parsed.data.start).lte("created_at", parsed.data.end).order("created_at").limit(101);
    if (error) throw error;
    if (!data?.length) throw new HttpError(400, "Add some memories in this timeframe first.");
    if (data.length > 100) throw new HttpError(400, "This timeframe has more than 100 memories. Choose a shorter timeframe so every memory can be included.");
    const { data: reserved, error: reserveError } = await db.rpc("reserve_storybook");
    if (reserveError) throw new HttpError(429, reserveError.message);
    reservation = reserved;
    const signedItems = await Promise.all((data as CanvasItem[]).map(async item => { if (item.type !== "photo" || !item.content_url) return item; const { data: signed, error } = await db.storage.from("family-media").createSignedUrl(item.content_url, 600); if (error) throw error; return { ...item, display_url: signed!.signedUrl }; }));
    const story = await tellStory(signedItems);
    const admin = adminClient();
    let displayAudio: string | undefined;
    if (family.plan_type === "premium") {
      const audio = await narrate(`${story.title}. ${story.chapters.map(c => `${c.title}. ${c.text}`).join(" ")}`);
      mediaPath = `${family.id}/stories/${reservation}.mp3`;
      const { error: uploadError } = await admin.storage.from("family-media").upload(mediaPath, audio, { contentType: "audio/mpeg", upsert: false });
      if (uploadError) throw uploadError;
      const { data: signed } = await admin.storage.from("family-media").createSignedUrl(mediaPath, 3600); displayAudio = signed?.signedUrl;
    }
    const { data: saved, error: saveError } = await admin.from("storybooks").update({ title: story.title, story_json: story, audio_url: mediaPath, status: "complete" }).eq("id", reservation).eq("family_id", family.id).select().single();
    if (saveError) throw saveError;
    return Response.json({ storybook: { ...saved, display_audio: displayAudio }, memories_used: data.length, photos_analyzed: signedItems.filter(i => i.type === "photo").length });
  } catch (error) {
    if (reservation) { try { const admin = adminClient(); await admin.from("storybooks").delete().eq("id", reservation).eq("status", "generating"); if (mediaPath) await admin.storage.from("family-media").remove([mediaPath]); } catch { /* Stale reservations are reclaimed by the next request. */ } }
    return apiError(error);
  }
}
