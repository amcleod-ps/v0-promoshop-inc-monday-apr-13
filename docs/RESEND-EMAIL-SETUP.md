# Email Notifications Setup (Resend) — PromoShop Website

*A start-to-finish guide for the site owner. No technical experience needed.*
*Time required: Part 1 about 15 minutes; Part 2 about 20 minutes plus some
waiting.*

## What you're setting up

Visitors can request a quote in two places on your website: the **contact
form** on the homepage ("Contact Us" → "Send Message") and the **My Quote**
cart page. Every request is saved in your database (you can always see them in
Supabase → Table Editor → `quote_requests`) — but right now **nobody is told
when one arrives**. You'd have to remember to go look.

This guide connects the site to **Resend**, an email-delivery service, so that
every quote request also lands in your inbox the moment it's submitted. The
notification includes the customer's details and message, and you can hit
**Reply** to answer the customer directly.

Resend's free plan covers 3,000 emails per month (100 per day) — far more than
a quote form will ever use, so this costs nothing.

The setup has two parts:

- **Part 1** gets notifications working right away, with one limitation:
  emails can only be delivered to *your own* address and arrive from a generic
  `onboarding@resend.dev` sender.
- **Part 2** verifies your own domain so emails come from your business
  address (e.g. `quotes@promoshopstudio.com`) and can go to anyone on your
  team. Do Part 2 — Part 1 is just the quick way to see it working.

---

## Part 1 — Connect Resend (working today, test mode)

### Step 1: Create a Resend account

1. Go to **resend.com** and click **Sign up**.
2. **Sign up with your main business email address.** This matters: until you
   finish Part 2, notifications can *only* be delivered to this exact address.
3. The free plan is selected by default — no payment details needed.

### Step 2: Create an API key

An API key is the secret that lets your website send email through your Resend
account.

1. In the Resend dashboard, click **API Keys** (left sidebar) → **Create API
   Key**.
2. Name: `promoshop-website`. Permission: **Sending access**. Click **Create**.
3. **Copy the key now** (it starts with `re_`). Resend shows it only once.
   Store it in your password manager.

### Step 3: Add two settings in Vercel

Vercel is the service that runs your website. You'll give it the key plus the
address that should receive notifications.

1. Go to **vercel.com**, sign in, and open the website's project.
2. Click **Settings** (top menu) → **Environment Variables** (left sidebar).
3. Add these two entries. Type each **Key** *exactly* as shown (capitals and
   underscores matter), leave all environments ticked, and click **Save**:

   | Key (type exactly) | Value |
   | --- | --- |
   | `RESEND_API_KEY` | the `re_…` key from Step 2 |
   | `QUOTE_NOTIFICATION_EMAIL` | the email address that should receive quote notifications — **for now, the same address you signed up to Resend with** |

### Step 4: Redeploy the site

New settings only take effect after the site is re-published:

1. In Vercel, open the **Deployments** tab.
2. On the top (most recent) deployment, click the **⋯** menu → **Redeploy**
   → confirm.
3. Wait until the status says **Ready** (usually 1–3 minutes).

### Step 5: Send yourself a test

1. Open your website, scroll to the **Contact Us** form on the homepage.
2. Fill it in with your own details and a message like "This is a test", and
   click **Send Message**.
3. Within a minute or so you should receive an email titled **"New quote
   request from …"**. Check the spam folder too the first time.
4. The email arrives from `PromoShop Website <onboarding@resend.dev>` for now
   — Part 2 fixes that. Hitting **Reply** addresses the customer (in this
   test, you).

If nothing arrives, see **Troubleshooting** at the end.

---

## Part 2 — Send from your own domain (do this for real use)

Why: the test sender `onboarding@resend.dev` can only deliver to your own
Resend account address and looks unprofessional. Verifying your domain lets
notifications come **from your own address** (e.g.
`quotes@promoshopstudio.com`) and go **to anyone** — colleagues, a shared
inbox, several people at once.

### Step 1: Add your domain in Resend

1. In the Resend dashboard, click **Domains** (left sidebar) → **Add Domain**.
2. Type your website's domain (e.g. `promoshopstudio.com`) and confirm.
3. Resend now shows a short list of **DNS records** (rows with a Type like
   TXT or MX, a Name/Host, a Value, and for MX a Priority). Keep this page
   open — you'll copy these in the next step.

### Step 2: Add those DNS records where your domain is managed

DNS records live wherever your domain is managed — usually the company you
bought it from (GoDaddy, Namecheap, Cloudflare, …), or **Vercel** if the
domain is managed there (in Vercel: your team page → **Domains** → click the
domain → add records).

For **each** record Resend listed:

1. Add a new DNS record at your domain manager.
2. Copy the **Type**, **Name/Host**, **Value**, and (for MX records) the
   **Priority** exactly as Resend shows them.

Don't worry — these records are additions used only for sending. They don't
affect your website or any existing email accounts on the domain.

### Step 3: Verify

1. Back on the Resend **Domains** page, click **Verify DNS Records**.
2. DNS changes take time to spread. Usually it's verified within minutes to an
   hour; occasionally it takes longer (up to 48 h). Come back and refresh
   until the domain shows a green **Verified** status.

### Step 4: Update the settings in Vercel

In Vercel → your project → **Settings → Environment Variables**:

1. Add one new entry:

   | Key (type exactly) | Value |
   | --- | --- |
   | `QUOTE_NOTIFICATION_FROM` | `PromoShop Website <quotes@promoshopstudio.com>` |

   Use your real domain after the `@`. The part before the `@` can be
   anything you like (`quotes`, `website`, `hello`) — **this mailbox doesn't
   need to exist**; it's only the sender name on notifications. The format is:
   a display name, then the address in angle brackets.

2. Edit `QUOTE_NOTIFICATION_EMAIL` (⋯ menu → **Edit**) and set it to whoever
   should receive notifications. Multiple people: separate addresses with
   commas, e.g. `anna@promoshopstudio.com, sales@promoshopstudio.com`.

### Step 5: Redeploy and test again

Repeat Part 1, Steps 4–5. The notification should now arrive from your own
domain, to every address you listed.

**That's it — Resend is fully connected.**

---

## Troubleshooting

| Problem | What to check |
| --- | --- |
| No email arrives | 1) Check spam. 2) In Resend, open **Emails** in the sidebar — it logs every send attempt with the exact error if one failed. 3) In Vercel, confirm the variable names are typed *exactly* right. 4) Did you **redeploy** after changing settings? Changes do nothing until you do. |
| Resend's log says the send was rejected / "domain not verified" | Part 2 isn't complete: either the DNS records aren't verified yet, or `QUOTE_NOTIFICATION_FROM` uses a domain that isn't the one you verified. |
| Emails only work when sent to my own address | That's the Part 1 limitation — finish Part 2. |
| I think a quote got lost | It didn't: quotes are always saved in the database even if email fails. In Supabase, open **Table Editor → quote_requests** — every submission ever made is there. |

## Good to know

- The email is a **courtesy copy**; the database (`quote_requests`) is the
  permanent record. If Resend ever has an outage, visitors can still submit
  quotes without noticing anything — you'd just need to check the table.
- These three settings are secrets of differing degrees, but treat the API
  key like a password: if it ever leaks, delete it in Resend (**API Keys → ⋯
  → Delete**), create a new one, update `RESEND_API_KEY` in Vercel, redeploy.
- To stop notifications temporarily, remove `QUOTE_NOTIFICATION_EMAIL` in
  Vercel and redeploy — everything else keeps working.
