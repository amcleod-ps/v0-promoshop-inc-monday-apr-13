# Admin Login Setup — PromoShop Website

*A step-by-step guide for the site owner. No technical experience needed.*
*Time required: about 15 minutes.*

## What you're setting up

Your website has a built-in **admin dashboard** where you can change images,
text, products, team members, and brand colours yourself. Changes appear on
the live site immediately — no developer needed.

One important thing to understand before you start: **this site does not use a
username-and-password screen for the admin dashboard.** Instead, access works
on two things:

1. **A private web address.** The dashboard lives at a hidden page on your
   site. It isn't linked from anywhere and search engines are told to ignore
   it — but *anyone who knows the address can edit the site*. The address IS
   your password. Treat it like one.
2. **Three keys stored in Vercel** (the service that runs your website).
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

## Step 2 — Put the keys into Vercel

1. Go to **vercel.com**, sign in, and open the website's project.
2. Click **Settings** (top menu) → **Environment Variables** (left sidebar).
3. Add the three entries below. For each one: type the **Key** *exactly* as
   shown (capital letters and underscores matter), paste the matching value
   from Step 1, leave all environments ticked (Production, Preview,
   Development), and click **Save**.

   | Key (type exactly) | Value (from Step 1) |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role key |

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
2. You should see a page titled **"Image & Content Dashboard"** with a line
   like *"Managing 120 images, 80 text fields…"* and tabs for Images, Text
   content, Products, Team, and Theme. Expand **"How to use this page"** at
   the top for a built-in mini-manual.
3. Try a harmless edit (change one word of text, click **Save**, check the
   live site, change it back).

**If you instead see "Server is not configured":** a key is missing or its
name was mistyped. Go back to Step 2, check the three names character by
character, then redeploy (Step 3).

## Step 5 — Protect your "login" from now on

Since the address is the password:

- **Bookmark it privately** and give the bookmark a discreet name.
- **Share it only with people who should be able to edit the entire site.**
  There are no per-person accounts — everyone with the address has full
  editing access.
- **Never** put the address in marketing material, social posts, public
  documents, or anywhere on the website itself.

## If the address or a key ever leaks (or a staff member leaves)

- The dashboard's **address can't be changed without a developer** (it's part
  of the site's code) — but the dashboard only works because of the keys, so
  cutting off the keys cuts off access:
  1. In Supabase: **Project Settings → API** → rotate/regenerate the keys
     (the option may be called "Rotate JWT secret"; it renews **both** the
     anon and service_role keys at once).
  2. Update **both** `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
     `SUPABASE_SERVICE_ROLE_KEY` in Vercel with the new values (Step 2).
  3. Redeploy (Step 3). The old keys stop working immediately.
- If you're unsure, ask your developer to walk through rotation with you —
  it's a 10-minute job.

## Want a real login screen later?

A password screen in front of the dashboard was deliberately left out (your
decision with the developer in June 2026) to keep the handoff simple. If you
later want one — for example, once several staff members need access — a
developer can add it with a small code change. Ask for *"authentication on
/admin-dashboard"*.
