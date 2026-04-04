# Fraydi — Backend Setup Guide

This guide walks you through setting up the Supabase backend for Fraydi from scratch.

---

## Prerequisites

- [Supabase account](https://supabase.com) (free tier is fine)
- [Supabase CLI](https://supabase.com/docs/guides/cli) (optional, for local dev)
- Node.js 18+
- A Google Cloud project (for Calendar OAuth)

---

## 1. Create a Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com) and sign in.
2. Click **New project**.
3. Fill in:
   - **Name:** `fraydi` (or your preferred name)
   - **Database password:** Generate a strong password and save it securely.
   - **Region:** Choose the closest region to your users.
4. Click **Create new project** and wait ~2 minutes for it to provision.

---

## 2. Run the Migrations

### Option A: Supabase Dashboard (quickest)

1. In your Supabase project, go to **SQL Editor** in the left sidebar.
2. Click **New query**.
3. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql` and click **Run**.
4. Repeat for `supabase/migrations/002_google_calendar_tokens.sql`.

### Option B: Supabase CLI (recommended for teams)

```bash
# Install the CLI
npm install -g supabase

# Login
supabase login

# Link to your project (find the project ref in Project Settings → General)
supabase link --project-ref YOUR_PROJECT_REF

# Push migrations
supabase db push
```

### Option C: Local development

```bash
# Start a local Supabase stack
supabase start

# Migrations are applied automatically on start.
# Seed with sample data:
supabase db reset   # applies migrations + seed.sql
```

---

## 3. Load Seed Data (development only)

The `supabase/seed.sql` file contains sample data for **The Smiths** family with:
- 2 profiles (Sarah and James Smith)
- 3 calendar events (soccer practice, school pickup, date night)
- 5 shopping items
- 3 todos

**Important:** Seed data uses fixed UUIDs for profiles that don't match real auth users. For local dev with the Supabase CLI, `supabase db reset` applies seeds automatically. For a remote project, run the SQL manually in the SQL Editor after replacing the profile UUIDs with real auth user IDs.

---

## 4. Set Up Google OAuth in Supabase

Fraydi uses Google OAuth for sign-in and Google Calendar integration.

### Step 1: Create a Google Cloud Project

1. Go to [console.cloud.google.com](https://console.cloud.google.com).
2. Create a new project (or select an existing one).
3. Go to **APIs & Services → Library** and enable:
   - **Google Calendar API**
   - **Google People API** (for profile info)

### Step 2: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**.
2. Choose **External** and click **Create**.
3. Fill in app name (`Fraydi`), support email, and developer contact.
4. Add scopes:
   - `openid`
   - `email`
   - `profile`
   - `https://www.googleapis.com/auth/calendar.readonly`
5. Add test users during development.

### Step 3: Create OAuth Credentials

1. Go to **APIs & Services → Credentials**.
2. Click **Create Credentials → OAuth 2.0 Client IDs**.
3. Application type: **Web application**.
4. Add authorized redirect URIs:
   ```
   https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback
   http://localhost:3000/auth/callback  (for local dev)
   ```
5. Save your **Client ID** and **Client Secret**.

### Step 4: Enable Google Auth in Supabase

1. In your Supabase project, go to **Authentication → Providers**.
2. Find **Google** and toggle it on.
3. Paste your **Client ID** and **Client Secret**.
4. Click **Save**.

---

## 5. Required Environment Variables

Copy `.env.example` to `.env.local` and fill in the values:

```bash
cp .env.example .env.local
```

| Variable | Where to find it |
|----------|-----------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Project Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Project Settings → API → `anon` `public` key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Project Settings → API → `service_role` key (**never expose to browser**) |
| `GOOGLE_CLIENT_ID` | Google Cloud Console → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console → Credentials |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` to generate |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` for dev, your domain in production |

---

## 6. Verify the Setup

After running migrations, confirm tables exist:

```sql
-- Run in Supabase SQL Editor
select table_name
from information_schema.tables
where table_schema = 'public'
order by table_name;
```

Expected tables:
- `calendar_events`
- `coordination_assignments`
- `families`
- `google_calendar_tokens`
- `profiles`
- `shopping_items`
- `todos`

---

## 7. Start the App

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Troubleshooting

**"relation does not exist" errors**
→ Migrations haven't been run. Follow step 2 above.

**Auth callback 400 errors**
→ Check that your redirect URI in Google Cloud Console exactly matches the Supabase callback URL.

**RLS blocking queries**
→ Make sure the user is authenticated. Anonymous requests will be blocked by Row Level Security policies.

**Google Calendar not syncing**
→ Ensure the Google Calendar API is enabled in your Cloud project and the OAuth scope includes `https://www.googleapis.com/auth/calendar.readonly`.

---

## Architecture Overview

```
Fraydi App (Next.js)
    │
    ├── Supabase Auth (Google OAuth)
    │       └── Profiles table (linked to auth.users)
    │
    ├── Supabase Database (PostgreSQL)
    │       ├── families
    │       ├── profiles
    │       ├── calendar_events
    │       ├── shopping_items
    │       ├── todos
    │       ├── coordination_assignments
    │       └── google_calendar_tokens
    │
    └── Google Calendar API
            └── Synced via server-side cron / webhook
```

---

*Last updated by Dylan (SensForge Backend) — Fraydi v0.1*
