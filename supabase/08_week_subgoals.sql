-- =====================================================================
-- MIGRACIÓN — agrega la columna necesaria para "Metas Semanales" en Home
-- Corre esto en el SQL Editor de Supabase. No borra ni afecta ningún
-- dato existente, solo agrega una columna nueva (vacía) a subgoals.
-- =====================================================================

begin;

alter table public.subgoals
  add column if not exists week_start_date date;

create index if not exists idx_subgoals_week
  on public.subgoals (user_id, week_start_date);

commit;

-- Listo. week_start_date queda en NULL para todas tus submetas actuales
-- (viven bajo su meta grande, sin estar elegidas para ninguna semana
-- todavía) — nada se pierde ni se mueve solo.
