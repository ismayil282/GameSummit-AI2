import { timingSafeEqual } from "node:crypto";
import { connection } from "next/server";
import { adminClient, apiError, HttpError } from "@/lib/supabase/server";
import { isNudgeDue, localClock } from "@/lib/notifications";
export const maxDuration = 300;
export async function GET(request: Request) {
  await connection();
  try {
    const secret = process.env.CRON_SECRET; const auth = request.headers.get("authorization") || ""; const expected = `Bearer ${secret}`;
    if (!secret || Buffer.byteLength(auth) !== Buffer.byteLength(expected) || !timingSafeEqual(Buffer.from(auth), Buffer.from(expected))) throw new HttpError(401, "Unauthorized cron request.");
    if (!process.env.RESEND_API_KEY || !process.env.NOTIFICATION_FROM || !process.env.NEXT_PUBLIC_APP_URL) throw new HttpError(503, "Email notifications are not configured.");
    const db = adminClient(); const now = new Date(); let sent = 0; let skipped = 0; let failed = 0;
    for (let offset = 0; ; offset += 100) {
      const { data: settings, error } = await db.from("notification_settings").select("user_id,timezone,preferred_time,users!inner(id,email,role,family_id,families!inner(plan_type))").eq("evening_nudge_enabled", true).range(offset, offset + 99);
      if (error) throw error;
      if (!settings?.length) break;
      for (const setting of settings) {
        const user = setting.users as unknown as { id: string; email: string; role: string; family_id: string; families: { plan_type: string } };
        if (user.role === "child" || user.families.plan_type !== "premium") { skipped++; continue; }
        const clock = isNudgeDue(now, setting.timezone, setting.preferred_time);
        if (!clock.due) { skipped++; continue; }
        const { data: activity, error: activityError } = await db.from("canvas_items").select("user_id,created_at").eq("family_id", user.family_id).gte("created_at", new Date(now.getTime() - 48 * 3600000).toISOString());
        if (activityError) { failed++; continue; }
        const today = (activity || []).filter(i => localClock(new Date(i.created_at), setting.timezone).date === clock.date);
        const inactive = !today.some(i => i.user_id === user.id);
        const newPosts = today.some(i => i.user_id !== user.id);
        if (!inactive && !newPosts) { skipped++; continue; }
        const { error: claimError } = await db.from("notification_deliveries").insert({ user_id: user.id, local_date: clock.date });
        if (claimError) { if (claimError.code === "23505") skipped++; else failed++; continue; }
        try {
          const response = await fetch("https://api.resend.com/emails", { method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `evening-${user.id}-${clock.date}` }, body: JSON.stringify({ from: process.env.NOTIFICATION_FROM, to: user.email, subject: "A little family love is waiting for you ♡", text: `After a long business day, check what your family shared today! Click to drop a quick photo or note.\n\n${process.env.NEXT_PUBLIC_APP_URL}/dashboard/canvas\n\nManage reminders: ${process.env.NEXT_PUBLIC_APP_URL}/dashboard/settings` }), signal: AbortSignal.timeout(15000) });
          if (!response.ok) throw new Error(`Email service returned ${response.status}`);
          const { error: markError } = await db.from("notification_deliveries").update({ sent_at: new Date().toISOString() }).eq("user_id", user.id).eq("local_date", clock.date); if (markError) throw markError;
          sent++;
        } catch { failed++; await db.from("notification_deliveries").delete().eq("user_id", user.id).eq("local_date", clock.date).is("sent_at", null); }
      }
      if (settings.length < 100) break;
    }
    return Response.json({ sent, skipped, failed }, { status: failed ? 500 : 200 });
  } catch (error) { return apiError(error); }
}
