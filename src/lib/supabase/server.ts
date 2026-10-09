import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Family, Profile } from "../types";
export class HttpError extends Error { constructor(public status: number, message: string) { super(message); } }
export async function serverClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) throw new HttpError(503, "Live services are not configured. Explore the demo instead.");
  const jar = await cookies();
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { cookies: { getAll: () => jar.getAll(), setAll: values => values.forEach(({ name, value, options }) => jar.set(name, value, options)) } });
}
export function adminClient() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(503, "Server storage is not configured.");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
}
export async function requireFamily(parent = false) {
  const db = await serverClient();
  const { data: { user }, error } = await db.auth.getUser();
  if (error || !user) throw new HttpError(401, "Sign in to continue.");
  const { data: profile } = await db.from("users").select("*").eq("id", user.id).single();
  if (!profile?.family_id) throw new HttpError(403, "Join a family first.");
  if (parent && profile.role !== "parent") throw new HttpError(403, "A parent must manage this setting.");
  const { data: family } = await db.from("families").select("*").eq("id", profile.family_id).single();
  if (!family) throw new HttpError(403, "Family not found.");
  return { db, user, profile: profile as Profile, family: family as Family & { stripe_customer_id: string | null; stripe_subscription_id: string | null } };
}
export function apiError(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error("API operation failed", error instanceof Error ? error.message : "Unknown error");
  return Response.json({ error: "We couldn’t complete that request. Please try again." }, { status: 500 });
}
export function checkOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  if (origin && origin !== expected) throw new HttpError(403, "Invalid request origin.");
}
export async function readJson(request: Request) {
  const body = await request.text();
  if (body.length > 32768) throw new HttpError(413, "Request is too large.");
  try { return JSON.parse(body); } catch { throw new HttpError(400, "Provide a valid JSON request."); }
}
