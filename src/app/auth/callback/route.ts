import { serverClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  try {
    if (code && !url.searchParams.has("error")) {
      const db = await serverClient();
      const { error } = await db.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL("/dashboard/canvas", url.origin));
    }
  } catch { /* Configuration failures return to a recoverable sign-in screen. */ }
  return NextResponse.redirect(new URL("/login?auth_error=1", url.origin));
}
