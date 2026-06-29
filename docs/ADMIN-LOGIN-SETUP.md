> **UPDATE (2026-06-10): the password gate is now built in.** To turn it
> on, set the environment variable `ADMIN_DASHBOARD_PASSWORD` in Vercel
> (Project → Settings → Environment Variables), then redeploy. The
> dashboard and all of its save actions will then require that password
> (any username). No code change is needed — statements below about
> needing a developer to add a login predate this.

# Admin Login Setup — PromoShop Website

*A step-by-step guide for the site owner. No technical experience needed.*
*Time required: about 15 minutes.*

## What you're setting up

Your website has a built-in **admin dashboard** where you can change images,
text, products, team members, and brand colours yourself. Changes appear on
the live site immediately — no developer needed.

One important thing to understand before you start: **this site uses a browser
password prompt for the admin dashboard when `ADMIN_DASHBOARD_PASSWORD` is set
in Vercel.** Access works on three things:

1. **A private web address.** The dashboard lives at a hidden page on your
   site. It isn't linked from anywhere and search engines are told to ignore
   it. Treat the address as private even when the password gate is on.
2. **One admin password stored in Vercel.** This turns on the browser password
   prompt in front of the dashboard and all save actions.
3. **Three keys stored in Vercel** (the service that runs your website).
   These let the website and its dashboard talk to your database — and one of
   them, the *service_role* key, is the master secret that makes editing
   possible. You'll set them up now, in your own accounts, so that you — not
   your developer — control admin access from here on.

## What you need before starting

- Your **Supabase** login (Supabase is where the site's content database
  lives — the project is called **promoshopstudio**)
- Your **Vercel** login (Vercel is where the website itself runs)
- A password manager, or somewhere safe to store secrets

---

## Step 1 — Copy your three keys from Supabase

1. Go to **supabase.com/dashboard** and sign in.
2. Open the **promoshopstudio** project.
3. In the left sidebar, click the gear icon → **Project Settings**, then open
   the **API** section (on newer projects it's called **API Keys**).
4. You need three values. Copy each one into your password manager:

   | What it's called in Supabase | What it looks like |
   | --- | --- |
   | **Project URL** | `https://….supabase.co` |
   | **anon** / **anon public** key | very long text starting with `eyJ` |
   | **service_role** key (click "Reveal" to see it) | also very long, starting with `eyJ` |

> ⚠️ **The service_role key is the most sensitive secret you have.** It can
> read and change *everything* in your database. Never email it, never paste
> it into a chat or document, never share it. It goes only two places: your
> password manager and Vercel (next step).

## Step 2 — Put the keys and admin password into Vercel

1. Go to **vercel.com**, sign in, and open the website's project.
2. Click **Settings** (top menu) → **Environment Variables** (left sidebar).
3. Add the four entries below. For each one: type the **Key** *exactly* as
   shown (capital letters and underscores matter), paste the matching value
   from Step 1, leave all environments ticked (Production, Preview,
   Development), and click **Save**.

   | Key (type exactly) | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL from Step 1 |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key from Step 1 |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key from Step 1 |
   | `ADMIN_DASHBOARD_PASSWORD` | a strong password you create and save in your password manager |

   If a variable with the same name already exists, click the **⋯** menu next
   to it and choose **Edit** instead of adding a duplicate.

> ⚠️ The first two names start with `NEXT_PUBLIC_` — that's required. The
> third one must **not** — adding `NEXT_PUBLIC_` to the service_role key would
> expose your master key to every visitor.

## Step 3 — Redeploy the site

Key changes only take effect after the site is re-published:

1. In Vercel, open the **Deployments** tab.
2. On the top (most recent) deployment, click the **⋯** menu → **Redeploy**
   → confirm.
3. Wait until the status says **Ready** (usually 1–3 minutes).

## Step 4 — Test your admin access

1. In your browser, go to your website address followed by
   `/admin-dashboard` — for example:
   `https://www.promoshopstudio.com/admin-dashboard`
2. If `ADMIN_DASHBOARD_PASSWORD` is set, your browser should ask for a
   username and password. The username can be anything; the password must be
   the value you saved in Vercel.
3. You should see a page titled **"Image & Content Dashboard"** with a line
   like *"Managing 120 images, 80 text fields…"* and tabs for Images, Text
   content, Products, Team, and Theme. Expand **"How to use this page"** at
   the top for a built-in mini-manual.
4. Try a harmless edit (change one word of text, click **Save**, check the
   live site, change it back).

**If you instead see "Server is not configured":** a key is missing or its
name was mistyped. Go back to Step 2, check the three names character by
character, then redeploy (Step 3).

## Step 5 — Protect your admin access from now on

Since both the address and the admin password protect the dashboard:

- **Bookmark it privately** and give the bookmark a discreet name.
- **Share it only with people who should be able to edit the entire site.**
  There are no per-person accounts — everyone with the address has full
  editing access.
- **Never** put the address in marketing material, social posts, public
  documents, or anywhere on the website itself.

## If the address or a key ever leaks (or a staff member leaves)

- If only the admin password leaks, change `ADMIN_DASHBOARD_PASSWORD` in Vercel
  and redeploy.
- If the dashboard address or a Supabase key leaks, rotate the Supabase keys
  too. The address is part of the site's code, but the dashboard only works
  because of the Vercel password and Supabase keys:
  1. In Supabase: **Project Settings → API** → rotate/regenerate the keys
     (the option may be called "Rotate JWT secret"; it renews **both** the
     anon and service_role keys at once).
  2. Update **both** `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
     `SUPABASE_SERVICE_ROLE_KEY` in Vercel with the new values (Step 2).
  3. Redeploy (Step 3). The old keys stop working immediately.
- If you're unsure, ask your developer to walk through rotation with you —
  it's a 10-minute job.

## Want per-person staff accounts later?

The current admin gate is one shared password. If several staff members need
individual access later, ask for *"per-person authentication and audit logging
on /admin-dashboard"*.
