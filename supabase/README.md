# Supabase database

SQL to build the FitTrack database from scratch: the base schema followed by its migrations, numbered in execution order.

## Files

| File | What it does |
| --- | --- |
| `01_schema.sql` | Base schema: `dimensions` catalog (12 life areas), `profiles` + new-user trigger, exercises, programs, logs, goals, subgoals, nutrition, gem transactions, affirmation areas/media, RLS policies and the private `affirmations` storage bucket. |
| `02_affirmation_scripts.sql` | `affirmation_scripts` table (affirmation scripts per goal) with RLS select/insert/delete policies. |
| `03_script_audio.sql` | Adds voice-recording columns to `affirmation_scripts`. |
| `04_script_cover.sql` | Adds a cover image path to `affirmation_scripts`. |
| `05_scripts_update_policy.sql` | Adds the missing RLS update policy on `affirmation_scripts`. |
| `06_storage_update_policy.sql` | Adds the missing update policy on the `affirmations` bucket (needed to re-upload audio/covers). |
| `07_goal_icon.sql` | Adds a custom emoji icon per goal. |
| `08_week_subgoals.sql` | Weekly subgoals column and index (no-op on a fresh database: `01` already includes them). |
| `09_habit_subgoals.sql` | Habit-type subgoals and the `subgoal_checkins` table. |
| `10_gems_by_dimension.sql` | `gems_by_dimension()` RPC: gems per area for the achievements wheel. |
| `11_ai_generations.sql` | `ai_generations` table plus `reserve_ai_generation()` / `finish_ai_generation()` for the per-user AI quota. |
| `12_demo_seed.sql` | `reset_demo_data()`: resets the demo account's sample data. Only the demo user can run it. |

## Setting up a new Supabase project

1. Create a project at [supabase.com](https://supabase.com) and make sure the **Email** provider is enabled (Authentication → Providers).
2. Open **SQL Editor** and run each file, one at a time, in order: `01` → `12`. There is no `00`; `02` must run before `03`.
3. Before running `12_demo_seed.sql`, create the demo user in **Authentication → Users → Add user** with the email `demo@example.com` and **Auto Confirm User** checked. Use a password of your own and set the same value as the `DEMO_PASSWORD` environment variable on the server (see `.env.example`).
4. Copy the project URL and anon key into `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.

The demo data is reloaded every time someone signs in with **Probar demo** (the app calls `reset_demo_data()`), so no manual seeding step is needed.
