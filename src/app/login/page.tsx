import { Suspense } from "react";
import { LoginForm } from "@/components/login-form";

type LoginProps = { searchParams: Promise<{ auth_error?: string }> };

async function LoginContent({ searchParams }: LoginProps) {
  const { auth_error } = await searchParams;
  return <LoginForm callbackError={Boolean(auth_error)} />;
}

export default function LoginPage(props: LoginProps) {
  return <Suspense fallback={<main className="auth-page"><p role="status" style={{ padding: 40 }}>Opening your family space…</p></main>}><LoginContent {...props} /></Suspense>;
}
