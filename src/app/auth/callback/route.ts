import { serverClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (code) { const db = await serverClient(); const { error } = await db.auth.exchangeCodeForSession(code); if (!error) return NextResponse.redirect(new URL("/dashboard/canvas", url.origin)); }
  return NextResponse.redirect(new URL("/?auth_error=1", url.origin));
}
