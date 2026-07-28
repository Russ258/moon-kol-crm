# Moon Card KOL & Affiliate CRM

Internal tool for tracking KOL/affiliate prospects across Hong Kong, Taiwan, Vietnam, Thailand, and India, through outreach, signed contracts, and payouts. Built with Next.js, Supabase (database, auth, file storage), deployed on Vercel.

Build has already been verified to compile cleanly with real type checking. What's left is wiring it to your own Supabase project and deploying it, both steps only you can do since they're tied to your accounts.

## 1. Create the Supabase project

1. Go to [supabase.com](https://supabase.com), create a new project (free tier is enough to start).
2. Once it's provisioned, open **SQL Editor > New query**, paste in the full contents of `supabase/schema.sql`, and run it. This creates every table, the roles system, and row-level security policies in one pass.
3. Go to **Storage**, create a new bucket named `contracts`, and set it to **private** (not public). Then go back to the SQL editor and run the three commented-out lines at the bottom of `schema.sql` (the `storage.objects` policies) to let marketing/admin upload and finance/admin/marketing view contract files.
4. Go to **Authentication > Providers**, confirm **Email** is enabled. This app uses magic-link sign-in, no passwords to manage.
5. Go to **Authentication > URL Configuration**, set your Site URL to your eventual Vercel domain (you can update this after your first deploy), and add `<your-domain>/auth/callback` as a redirect URL.
6. Recommended: go to **Authentication > Settings** and turn off public sign-ups, then invite office members one at a time from **Authentication > Users > Invite user**. Anyone invited this way gets a `viewer` role automatically (via the trigger in the schema); promote people from the app's Team page afterward, see step 5 below.

## 2. Connect the code to your project

1. In Supabase, go to **Settings > API**. Copy the **Project URL** and the **anon public** key.
2. In this folder, copy `.env.local.example` to `.env.local` and paste in those two values.
3. Run `npm install` then `npm run dev` to try it locally at `localhost:3000`.

## 3. Deploy to Vercel

1. Push this folder to a GitHub (or GitLab) repo.
2. In Vercel, "Add New Project," import that repo.
3. In the Vercel project's **Settings > Environment Variables**, add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with the same values from your `.env.local`.
4. Deploy. Once you have your real `*.vercel.app` (or custom) domain, go back to Supabase's **Authentication > URL Configuration** and update the Site URL and redirect URL to match.

## 4. Make yourself an admin

Nobody starts as an admin, everyone who signs in gets `viewer` by default so a stray sign-up can't grant themselves access. After your first sign-in:

1. In Supabase, go to **Table Editor > profiles**.
2. Find your row, change `role` from `viewer` to `admin`, save.
3. Reload the app. You'll now see the Team page, where you can promote everyone else without touching the database directly.

## What's in here

- **KOL Pipeline** (`/kols`) — every prospect and affiliate, filterable by market, grouped by stage (prospect through active).
- **KOL detail page** — profile, contract, and payout history in one place. This is where a contract gets linked to a specific person: template version, signature provider, signed date, and a link to the actual signed document, so there's a clear record of exactly which terms each KOL agreed to (useful since the commission rate has already changed once, and will likely change again once John and legal formally sign off).
- **Contracts** (`/contracts`) — every contract across every KOL, one table.
- **Payouts** (`/payouts`) — a running ledger, with wallet address and status, since Tevau pays out in USDT/USDC only, no bank rails.
- **Team** (`/team`, admin only) — role management. Four roles: `admin` (everything), `marketing` (manage KOLs and contracts, view payouts), `finance` (manage payouts, view KOLs and contracts), `viewer` (KOL pipeline only, no contract or payout visibility).

## Known gaps, worth knowing before this goes into daily use

- **Referral code / attribution**: there's a field for it on each KOL, but it's not wired to anything yet, because the underlying referral-ID architecture problem (IDs assigned at Tevau account creation, before a card is picked) is still unresolved on Tevau's side. The field is there so this is ready to receive real data the moment that's fixed, without a schema change.
- **Performance data** (referred signups, activations, funded amount): the `performance_snapshots` table exists in the schema but there's no UI for it yet, it's built to accept either manual entry or an eventual automated feed from Tevau, whichever comes first. Worth adding a simple entry form once you know which.
- **E-signature**: contracts currently store a link to wherever the signed document lives (DocuSign, a file, whatever). It doesn't integrate with a signature provider directly, so there's no automatic verification that a linked document is actually what it claims to be. If contract volume grows, wiring in the DocuSign API directly would close that gap.
- **KYC / tax info per KOL**: not in the schema yet. Worth adding if payout volume or per-KOL amounts grow large enough for it to matter.
