# Fraydi 🟠

> **Flow routines across your day, intelligently.**

Fraydi is an AI-powered family coordination agent that keeps your household in sync — shared calendars, smart task coordination, watchlists, and shopping lists, all in one place.

---

## What is Fraydi?

Modern family life is fragmented across apps, group chats, and sticky notes. Fraydi brings it together:

- **Multi-Source Calendar** — Sync Google Calendar (and soon iCloud) for every family member. One view, no surprises.
- **Coordination Agent** — "Who's got this?" AI-powered task assignment and reminders ensure nothing falls through the cracks.
- **Smart Watchlists** — Track price drops and restock alerts for the things your family needs.
- **Shopping & To-Dos** — Shared lists that update in real time. Add by voice or text, auto-categorised by store.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | [Next.js 14](https://nextjs.org) (App Router) + TypeScript |
| Styling | [Tailwind CSS](https://tailwindcss.com) |
| Database & Auth | [Supabase](https://supabase.com) (PostgreSQL + Row Level Security) |
| Google Integration | [Google Calendar API](https://developers.google.com/calendar) via `googleapis` |
| AI | [OpenAI](https://platform.openai.com) (GPT-4o for coordination suggestions) |
| Email | [Resend](https://resend.com) (family notification emails) |
| OAuth | [NextAuth.js](https://next-auth.js.org) v4 (Google provider) |
| Deployment | [Vercel](https://vercel.com) |

---

## Project Structure

```
fraydi/
├── app/
│   ├── page.tsx              # Landing page
│   ├── dashboard/page.tsx    # Main app dashboard
│   ├── login/page.tsx        # Google OAuth login
│   ├── layout.tsx            # Root layout + metadata
│   └── globals.css           # Global styles + Tailwind directives
├── components/
│   ├── ui/
│   │   ├── Button.tsx        # Reusable button component
│   │   └── Card.tsx          # Card + sub-components
│   ├── Navbar.tsx            # Site navigation
│   ├── FamilyTimeline.tsx    # Daily schedule timeline
│   ├── CoordinationAlert.tsx # "Who's got this?" panel
│   └── ShoppingList.tsx      # Real-time shared shopping list
├── lib/
│   ├── supabase.ts           # Supabase client + type definitions
│   ├── googleCalendar.ts     # Google Calendar API helpers (stubs)
│   └── utils.ts              # Shared utility functions
├── public/                   # Static assets
├── .env.example              # Environment variable template
├── tailwind.config.ts
├── tsconfig.json
└── next.config.ts
```

---

## Getting Started

### 1. Clone the repo

```bash
git clone https://github.com/developersensforge-create/fraydi.git
cd fraydi
```

### 2. Install dependencies

```bash
npm install
# or
pnpm install
```

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Open `.env.local` and fill in:

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | [Supabase dashboard](https://app.supabase.com) → Project Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase dashboard → API |
| `GOOGLE_CLIENT_ID` | [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials |
| `GOOGLE_CLIENT_SECRET` | Google Cloud Console |
| `NEXTAUTH_SECRET` | Run `openssl rand -base64 32` |
| `OPENAI_API_KEY` | [OpenAI platform](https://platform.openai.com/api-keys) |
| `RESEND_API_KEY` | [Resend dashboard](https://resend.com) |

### 4. Set up Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or select an existing one)
3. Enable **Google Calendar API** and **Google People API**
4. Create OAuth 2.0 credentials → Web application
5. Add authorised redirect URI: `http://localhost:3000/api/auth/callback/google`

### 5. Set up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Copy the project URL and anon key to `.env.local`
3. Run the DB schema (coming soon in `supabase/migrations/`)

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Roadmap

- [ ] Supabase DB schema (families, profiles, tasks, shopping_items)
- [ ] Google Calendar real-time sync
- [ ] AI coordination suggestions (OpenAI GPT-4o)
- [ ] Email notifications via Resend
- [ ] Mobile-optimised PWA
- [ ] iCloud Calendar support
- [ ] Voice input for shopping lists

---

## Contributing

This is an internal SensForge project. Reach out to the team on Discord before opening a PR.

---

## License

Private — All rights reserved © SensForge 2026
