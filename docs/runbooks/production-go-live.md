# Production go-live — Vercel + Supabase checklist

> Replaces the archived Azure runbook (`archived/azure-production-go-live.md`,
> which described a stack that was never used). This is the real,
> stack-accurate launch checklist. A plain-language, step-by-step version
> for the client lives with the developer (the "Manual Action Guide");
> this file is the engineer-facing summary.

## 1. Code

- [ ] `main` contains the launch-fix PR; `pnpm build` and `pnpm lint` pass.
- [ ] Vercel production deployment for the latest `main` commit is **Ready**.

## 2. Database (Supabase project `promoshopstudio`, ref `rfvnjxrhainbldxtzdfb`)

- [x] Migrations **0001 → 0007 applied** (confirmed 2026-06-10).
- [x] **0008 applied** (`supabase/migrations/0008_quote_insert_hardening_and_copy_fix.sql`,
      owner-confirmed 2026-06-10).
- [ ] Never re-run 0003 against production; it is for fresh databases only.

## 2b. Security (pre-launch, long-standing open items)

- [ ] **Rotate the Supabase API keys** (Supabase → Settings → API → regenerate
      anon + service_role), then update the Vercel env vars and redeploy.
      Precautionary hygiene tracked since Issue #16 / `docs/hardening-status.md`
      — git history is confirmed clean, but the keys have travelled through
      several hands during development.
- [ ] **Run Supabase → Advisors (Security)** on the production project and
      review every finding (not reachable from dev tooling; needs the
      client's account).

## 3. Vercel environment variables (Production scope; redeploy after changes)

| Variable | Required | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | yes | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | yes (admin writes) | server-only; never `NEXT_PUBLIC_` |
| `ADMIN_DASHBOARD_PASSWORD` | strongly recommended | enables the Basic-auth gate |
| `NEXT_PUBLIC_SITE_URL` | yes once domain confirmed | e.g. `https://www.promoshopinc.com` — drives OG/canonical/sitemap |
| `RESEND_API_KEY` | for quote emails | see `docs/RESEND-EMAIL-SETUP.md` |
| `QUOTE_NOTIFICATION_EMAIL` | for quote emails | comma-separated recipients |
| `QUOTE_NOTIFICATION_FROM` | after Resend domain verify | sender identity |

## 4. Domain & Vercel project

- [ ] **Confirm which Vercel project/team is production and consolidate.**
      Deploys have run under three teams over the repo's life
      (`vnesteanu-5735s-projects` incl. a `promoshop-inc-demo-access`
      project, `promoshopinc`, `nest-digital-solutions-inc`). All env vars
      above must live on the production project; disconnect the strays.
- [ ] Add the confirmed domain in Vercel → Settings → Domains; set DNS at the
      registrar per Vercel's instructions; wait for **Valid Configuration**.
- [ ] Set `NEXT_PUBLIC_SITE_URL` to the final `https://` address; redeploy.
- [ ] Verify the domain in Resend (DNS records) before setting
      `QUOTE_NOTIFICATION_FROM`.

## 5. Content (via /admin-dashboard)

- [ ] Replace the 4 hero slides (currently brand logos), the About hero
      (currently the Rhone logo), and the 4 team photos (currently stock).
- [ ] Re-host the dead product images for JAK 005/006 and TOP 010–015
      (all `drivingi.com` URLs 404).
- [ ] Correct the About-page entity name/cities once the client confirms.

## 6. Smoke test (on the live domain)

- [ ] Add-to-quote as a brand-new visitor → selections survive the sign-up
      pass-through → submit → row in `quote_requests` **and** notification
      email received.
- [ ] Homepage contact form → same two checks.
- [ ] `/admin-dashboard` challenges for the password; wrong password refused.
- [ ] Unknown URL (e.g. `/brands/nope`) renders the branded 404.
- [ ] Quick pass on a phone.

## 7. Post-launch

- [ ] Watch `quote_requests` row counts (anon INSERT is rate-limited in-app
      but unbounded via direct PostgREST — accepted risk, monitor).
- [ ] Rotate any key that ever leaks (Supabase → regenerate; Resend → revoke;
      update Vercel; redeploy).
