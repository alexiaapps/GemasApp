# Gemas 💎

**Despierta tu diamante interior · Awaken your inner diamond**

A gamified life-goals app that turns your goals into weekly actions and rewards you for showing up.

**Live demo:** https://gemas-app.vercel.app (click "Probar demo", no sign-up needed)

> The app is in Spanish because I built it for myself and for Mexican users.

## The problem

We have systems to study, to work and to produce, but no system to grow as people. Most goal apps either track tasks or punish you with streaks, and people drop their goals within weeks.

## Validating it before writing code

I launched a landing page with a bilingual survey and got real answers about why people struggle with their goals:

- 43 people answered the survey and 23 signed up for the beta.
- Most people keep a goal for only 2 to 4 weeks before giving up.
- Besides lack of discipline, the most common barriers were not knowing where to start and getting lost in the process, which is the structure Gemas provides.
- Most people only sometimes or never have someone holding them accountable.

## How it works

- **12 life areas** (health, career, finances, relationships…), each with its own gem color.
- **Goals → sub-goals → gems.** Every big goal breaks into sub-goals, either one-time actions or weekly habits. Progress earns gems.
- **Growth wheel.** Shows where you're investing your energy (weekly, monthly or all-time). Completed goals become badges, with a history of the sub-goals that got you there.
- **Training and daily log.** Weekly programs with a rest timer, plus a daily check for protein and steps. All of it earns gems in the Health area.
- **AI affirmations.** For any goal, Claude writes a personal script in first person and present tense, as if you'd already achieved it. Read it as a teleprompter or record it in your own voice.

## Product decisions

- **No streaks or XP.** Gems reward effort without punishing a bad day.
- **A habit earns gems only when the whole week is completed**, not per check-in.
- **The prompt was iterated** so scripts feel personal and sensory, not generic.

## How I built it

Problem → requirements → hand sketches → prompts to Claude Code → shipped app.

I defined the problem and turned it into features and requirements, sketched every screen by hand, then turned those sketches into precise prompts for Claude Code, reviewing the code and security at every step.

## Tech stack

| Layer | Tools |
|---|---|
| Frontend | React, TypeScript, Vite (installable PWA) |
| Backend | Supabase (Postgres, auth, storage) |
| AI | Claude (Anthropic API), called from a serverless function |
| Hosting | Vercel |

## Security and cost

- **Row-level security (RLS):** each user can only read and write their own data.
- **API key server-side only:** the AI call runs in `api/generate-script.ts`, so the key never reaches the browser.
- **Authenticated endpoint** with input validation and per-user rate limits, enforced atomically in the database.
- **Spend cap** on the Anthropic account as a last line of defense.
- **Demo mode:** a separate account with sample data that resets on every visit. Its password lives only on the server, and its AI quota is shared and small to cap cost.

## What's next

- **Community:** squads where friends compete, stake their gems on their goals and verify each other's progress with photos, with AI pre-checking the evidence.
- Evals to measure script quality across prompt versions.
- Streaming responses to cut perceived latency (generation takes about 10 seconds today).
- English version and App Store launch.

## Run it locally

```bash
npm install
cp .env.example .env.local   # add your own Supabase and Anthropic keys
npm run dev
```

Environment variables:

| Variable | Where it runs | Required |
|---|---|---|
| `VITE_SUPABASE_URL` | Browser | Yes |
| `VITE_SUPABASE_ANON_KEY` | Browser (public by design, protected by RLS) | Yes |
| `ANTHROPIC_API_KEY` | Server only, never prefixed with `VITE_` | Yes, for AI scripts |
| `DEMO_PASSWORD` | Server only | Only for the demo button |

---

Designed and built by **Alexia Arteaga Mendoza** · alexiaarteaga2003@gmail.com
