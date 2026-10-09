"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { ArrowRight, CheckCircle2, Heart, LockKeyhole, Mail, ShieldCheck, Sparkles, AlertCircle, Loader2 } from "lucide-react";
import { browserClient, configured } from "@/lib/supabase/client";

export function LoginForm({ callbackError }: { callbackError: boolean }) {
  const router = useRouter();
  const [signup, setSignup] = useState(false);
  const [magic, setMagic] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(callbackError ? "That sign-in link has expired or could not be verified. Please request a new one." : "");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!configured) return;
    let active = true;
    void browserClient().auth.getUser().then(({ data }) => {
      if (active && data.user) router.replace("/dashboard/canvas");
    }).catch(() => { /* The form remains available when session verification fails. */ });
    return () => { active = false; };
  }, [router]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError(""); setSuccess("");
    try {
      if (!configured) throw new Error("Sign-in is not available in this demo yet. You can still explore the family canvas below.");
      const db = browserClient();
      const emailRedirectTo = `${window.location.origin}/auth/callback`;
      if (magic) {
        const { error } = await db.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo, shouldCreateUser: signup } });
        if (error) throw error;
        setSuccess("Check your inbox for a secure sign-in link. Open it in this browser to continue.");
      } else {
        const result = signup
          ? await db.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo } })
          : await db.auth.signInWithPassword({ email: email.trim(), password });
        if (result.error) throw result.error;
        if (result.data.session) { router.replace("/dashboard/canvas"); router.refresh(); }
        else setSuccess("Check your inbox to confirm your email and open your family canvas.");
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "We couldn’t sign you in. Please try again.");
    } finally { setBusy(false); }
  }

  return <main className="auth-page">
    <header className="auth-header">
      <Link href="/" className="brand"><Heart fill="currentColor" aria-hidden="true" /><span>FamCanvas<span className="brand-ai">AI</span></span></Link>
      <nav aria-label="Main navigation"><Link href="/dashboard/canvas">Canvas</Link><Link href="/dashboard/albums">Memory Albums</Link><Link href="/pricing">Pricing</Link><Link href="/login" aria-current="page">Log In</Link></nav>
    </header>
    <div className="auth-layout">
      <section className="auth-story"><span className="pill"><Sparkles size={16} />YOUR FAMILY. YOUR LITTLE WORLD.</span><h1>Little moments.<br /><em>A lifetime together.</em></h1><p>A cozy place for everyday photos, little notes, and the stories you’ll tell for years.</p><div className="auth-keepsake"><Heart size={32} /><blockquote>“The ordinary days are the ones we’ll want to remember.”</blockquote><span>Make a little room for what matters.</span></div><p className="auth-privacy"><ShieldCheck size={20} />A private space for your favorite people.</p></section>
      <section className="auth-card" aria-labelledby="auth-title">
        <div className="auth-toggle" aria-label="Account action">{[false, true].map(value => <button key={String(value)} type="button" aria-pressed={signup === value} disabled={busy} className={signup === value ? "selected" : ""} onClick={() => { setSignup(value); setError(""); setSuccess(""); setPassword(""); }}>{value ? "Create Family Account" : "Log In"}</button>)}</div>
        <h2 id="auth-title">{signup ? "Your story starts here." : "Welcome home."}</h2><p>{signup ? "Start your own private family board, together." : "Your favorite people and memories are waiting."}</p>
        <div className="auth-method" aria-label="Sign-in method"><button type="button" disabled={busy} aria-pressed={!magic} onClick={() => { setMagic(false); setError(""); setSuccess(""); }}>Email & password</button><button type="button" disabled={busy} aria-pressed={magic} onClick={() => { setMagic(true); setError(""); setSuccess(""); }}>Magic link</button></div>
        <form onSubmit={submit} aria-busy={busy}>
          <label className="form-label" htmlFor="auth-email">Email address</label><div className="auth-input"><Mail size={19} aria-hidden="true" /><input id="auth-email" type="email" autoComplete="email" required placeholder="you@example.com" value={email} disabled={busy} onChange={e => setEmail(e.target.value)} /></div>
          {!magic && <><label className="form-label" htmlFor="auth-password">Password</label><div className="auth-input"><LockKeyhole size={19} aria-hidden="true" /><input id="auth-password" type="password" autoComplete={signup ? "new-password" : "current-password"} required minLength={signup ? 8 : undefined} aria-describedby={signup ? "password-hint" : undefined} value={password} disabled={busy} onChange={e => setPassword(e.target.value)} /></div>{signup && <small id="password-hint">Use at least 8 characters.</small>}</>}
          {magic && <p className="auth-hint">We’ll email you a secure link. No password needed.</p>}
          {error && <div className="auth-alert error" role="alert"><AlertCircle size={20} /><span>{error}</span></div>}
          {success && <div className="auth-alert success" role="status"><CheckCircle2 size={20} /><span>{success}</span></div>}
          <button className="btn primary full-width auth-submit" disabled={busy} type="submit">{busy ? <><Loader2 className="spin" size={18} />Please wait…</> : <>{magic ? "Send me a magic link" : signup ? "Create Family Account" : "Log In"}<ArrowRight size={18} /></>}</button>
        </form>
        <p className="auth-demo">Just looking around? <Link href="/dashboard/canvas">Explore the demo <ArrowRight size={14} /></Link></p>
      </section>
    </div>
  </main>;
}
