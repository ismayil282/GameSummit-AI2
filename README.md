# FamCanvas AI

A warm, private family scrapbook with a shared whiteboard, AI memory albums, voice notes, and family subscriptions. Built with Next.js 16 App Router, React 19, TypeScript, Tailwind 4, Lucide, Fabric.js, Supabase, OpenAI GPT-4o + TTS, and Stripe.

## Run the hackathon demo

Requires Node.js 22.18+ (Node 24 recommended).

```sh
npm install
npm run dev
```

Open http://localhost:3000. No service keys are needed for the demo. Sample photos are bundled in `public/demo`; uploaded demo memories and albums stay in this browser's localStorage.

Try this presentation flow:

1. Drag the photo cards; add a sticky note using the floating toolbar.
2. Open the pencil tool, draw a heart, and save it to the board.
3. Click **Create a storybook**, then open **Memory albums**.
4. In **Settings & preferences**, click **Preview Premium** to demo voice uploads/recording and PDF exports without charging anyone.
5. Visit **Family Premium** to switch between $6.99/month and $59/year.
6. Use **Reset demo memories** in settings to restart your presentation.

Demo storybooks use a deterministic sample story, clearly labeled in the reader. Demo narration uses browser speech synthesis. Live stories use GPT-4o and live Premium narration uses OpenAI TTS. Demo Premium only changes local demo state; it cannot grant a real subscription.

## Configure live services

Copy `.env.example` to `.env.local` and fill in the values. Never commit real secrets. Restart Next.js after changing environment variables.

### Supabase

1. Create a fresh Supabase project.
2. Apply `supabase/migrations/001_famcanvas.sql` in its SQL editor, or use Supabase CLI migrations.
3. Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and server-only `SUPABASE_SERVICE_ROLE_KEY`.
4. Enable email magic-link sign-in. Set the Auth Site URL to your app URL. Allow `http://localhost:3000/auth/callback` during development and your production `/auth/callback` URL in production.
5. Configure production SMTP for reliable Auth emails.
6. The migration creates the private `family-media` bucket and adds canvas items, storybooks, families, and users to the Realtime publication.

New authenticated accounts receive one private family board and the parent role via an Auth signup trigger. Parents create single-use, seven-day invitations for an adult member or child. A new, empty account can join using the code on **Our family**. Existing populated or billed families cannot be accidentally abandoned by joining another family.

Auth uses cookie-based Supabase SSR clients, a session-refresh `src/proxy.ts`, and server-side `getUser()` verification. Row-level security isolates families. Column grants prevent changing plans, roles, ownership, or timestamps through the client. Members can move shared memories; only the creator or a parent can delete them.

Photo and story quotas use a monthly UTC usage ledger and family-row locks. Deleting photos does not replenish upload allowances. Failed AI generation reservations are refunded; crashed reservations expire after ten minutes. Stories are limited to one concurrent generation and one start per minute per family.

### OpenAI

Set server-only `OPENAI_API_KEY`. The story endpoint retrieves all memories in the selected timeframe, includes every photo in GPT-4o vision input, validates structured story JSON, and stores the story in Supabase.

A story request accepts at most 100 memories; larger timeframes are rejected with an instruction to choose a shorter range rather than silently dropping memories. Text and visible activities are used for sentiment; no sensitive traits are inferred from photos. Audio notes contribute their captions, not transcripts.

Premium stories receive MP3 narration from `tts-1` with the Nova voice. Long narration is split into TTS-sized segments. Both photos and audio use expiring signed URLs; object paths are stored in the database. Narration is labeled as an AI-generated voice in the reader.

### Stripe

1. Create a **Family Premium** product with two recurring USD prices: **699 cents/month** and **5900 cents/year**.
2. Set `STRIPE_SECRET_KEY`, `STRIPE_PREMIUM_MONTHLY_PRICE_ID`, and `STRIPE_PREMIUM_YEARLY_PRICE_ID`.
3. Enable and configure the Stripe Customer Portal.
4. Add a webhook endpoint at `https://YOUR_APP/api/webhooks/stripe` with:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Set the endpoint signing secret as `STRIPE_WEBHOOK_SECRET`.

Use Stripe test mode before accepting payments. For local testing:

```sh
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Only parents can start Checkout or open the billing portal. The verified webhook retrieves the current subscription state, checks the customer, family metadata, and configured price IDs, then updates the family plan. An event timestamp watermark guards against older deliveries. Active and trialing subscriptions receive Premium; other statuses receive Free. Cancellation at period end retains Premium until Stripe reports cancellation.

### Evening emails

Email delivery uses Resend. Set `RESEND_API_KEY`, a verified sender in `NOTIFICATION_FROM`, a strong `CRON_SECRET`, and your canonical `NEXT_PUBLIC_APP_URL` without a trailing slash.

Users opt into reminders in settings and choose an IANA timezone. The default preference is 19:30 local time. The cron checks every 15 minutes and sends at the first quarter-hour after the chosen time, with a per-user/local-date delivery ledger and Resend idempotency key to prevent duplicate emails. It checks whether the member has posted today or whether other family members have shared something. Child accounts and Free families are excluded.

`vercel.json` contains the schedule. This interval requires [Vercel Pro or Enterprise](https://vercel.com/docs/cron-jobs/usage-and-pricing). On another host, call `GET /api/cron/evening-reminder` every 15 minutes with `Authorization: Bearer YOUR_CRON_SECRET`. Hobby Vercel deployment requires removing the frequent cron and using an external scheduler.

The MVP delivers email notifications; `push_token` is reserved for a future Web Push implementation. In-app notifications show the reminder preview.

## Routes

| Route | Purpose |
| --- | --- |
| `/`, `/dashboard/canvas` | Shared canvas and immediate demo |
| `/dashboard/albums` | Saved AI storybooks |
| `/dashboard/family` | Members, invitations, and joining |
| `/dashboard/settings` | Reminder preferences and billing portal |
| `/pricing` | Free and Premium plans |
| `POST /api/generate-story` | Authenticated timeframe-to-story generation |
| `POST /api/stripe/checkout` | Parent-only subscription Checkout |
| `POST /api/stripe/portal` | Parent-only Customer Portal |
| `POST /api/webhooks/stripe` | Signed billing updates |
| `GET /api/cron/evening-reminder` | Protected, timezone-aware email reminders |
| `GET /auth/callback` | Magic-link session exchange |

Story requests use JSON `{ "start": "2026-10-01T00:00:00Z", "end": "2026-10-31T23:59:59Z" }`. Checkout requests use `{ "interval": "month" }` or `{ "interval": "year" }`. Family IDs are always derived from the authenticated profile.

## Architecture

```text
src/
  app/                 App Router pages, Auth callback, API routes
  components/          Family workspace, draggable memory cards, Fabric drawing pad
  lib/
    supabase/          Browser/server clients, authorization, HTTP guards
    openai/            GPT-4o structured vision stories and TTS
    stripe/            Server-only Stripe client
    demo.ts            Offline presentation fixtures
    notifications.ts   Local clock and reminder-window logic
    types.ts           Shared domain types
  proxy.ts             Supabase session refresh
supabase/migrations/   Schema, RLS, private storage, atomic quotas and invites
tests/                 Browser workflows, database rules and timezone tests
```

The board uses accessible DOM cards for photos, notes, stickers, and audio, with pointer-based dragging and persisted coordinates. Fabric.js provides the drawing surface; finished drawings become shared high-resolution image memories. Supabase Realtime refreshes family-scoped state, including deletion events. Media signatures are renewed every 30 minutes. The canvas has a zoom toolbar, filters, uploads, lightboxes, and responsive layout.

PDF exports include vector text and available photo originals. Microphone recording requires HTTPS (or localhost) and explicit browser permission. Files are limited to 10 MB, and the recording UI limits voice notes to two minutes.

## Verification

```sh
npm run typecheck
npm run lint
npm run build
npm run test:db
npm run test:notifications
npx playwright install chromium
npm run test:e2e
```

Database tests use isolated PGlite PostgreSQL with a small Auth/Storage host shim. They execute the application migration, RLS, grants, triggers, and RPCs unchanged; the host-managed pgcrypto extension and Realtime publication are omitted. Tests cover family isolation, private storage, protected roles/plans, monthly photo/story quotas, failed-generation refunds, timezone validation, invitation reuse, and child permissions.

Browser tests cover note creation, dragging, local persistence, albums, Fabric drawing export, responsive layout, pricing, voice uploads, PDF downloads, and API guards. They do not charge Stripe, call OpenAI, send email, or replace a live Supabase integration test.

Before production launch, verify two signed-in family members syncing against your Supabase project, Stripe test-mode subscription/cancellation/replay flows, a real GPT-4o + TTS story, and reminder delivery from your verified email domain. Live services were not tested without credentials. Schedule database/storage backups and cleanup for media orphaned by deleted cards; review rate limits and reminder retries for your expected scale.

`npm audit --omit=dev` reported no production vulnerabilities. The current Next.js ESLint dependency chain reports five development-only advisories involving `braces`; the suggested forced fix downgrades Next's ESLint configuration, so it was not applied.

## References and demo photography

- [Supabase SSR Auth](https://supabase.com/docs/guides/auth/server-side/creating-a-client)
- [Supabase Realtime Postgres changes](https://supabase.com/docs/guides/realtime/postgres-changes)
- [Official OpenAI vision documentation](https://developers.openai.com/api/docs/guides/images-vision)
- [Official OpenAI TTS documentation](https://developers.openai.com/api/docs/guides/text-to-speech)
- [Stripe webhook verification](https://docs.stripe.com/webhooks)
- Demo images: [beach](https://unsplash.com/photos/1473496169904-658ba7c44d8a), [family sunset](https://unsplash.com/photos/1511895426328-dc8714191300), [cookies](https://unsplash.com/photos/1499636136210-6f4ee915583e). Bundled demo photos were retrieved from Unsplash's image CDN; do not present the fictional demo family as the people pictured.
