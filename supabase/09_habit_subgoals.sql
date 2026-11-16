-- =====================================================================
-- MIGRACIÓN — soporte para 2 tipos de submeta:
--   'once'  = se marca una sola vez (comportamiento actual, sin cambios)
--   'habit' = hábito recurrente, se registra día a día hacia una meta 
--             semanal (ej. "Correr 5/7 días")
-- =====================================================================

begin;

alter table public.subgoals
  add column if not exists goal_kind text not null default 'once'
    check (goal_kind in ('once', 'habit')),
  add column if not exists target_days_per_week integer;  -- solo aplica si goal_kind='habit', ej. 5 o 7

-- Registro de cada día que se marcó un hábito (independiente de 
-- subgoals.completed, que para 'habit' representa "ya llegué a mi 
-- meta semanal de días", no un solo evento).
create table public.subgoal_checkins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subgoal_id uuid not null references public.subgoals(id) on delete cascade,
  log_date date not null,
  created_at timestamptz not null default now(),
  unique (subgoal_id, log_date)  -- no puedes marcar el mismo día dos veces
);

alter table public.subgoal_checkins enable row level security;

create policy "own subgoal checkins"
  on public.subgoal_checkins for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index idx_subgoal_checkins_subgoal
  on public.subgoal_checkins (subgoal_id, log_date desc);

-- Nueva fuente de gemas: una gema pequeña por cada día marcado de un 
-- hábito (además de 'subgoal', que se mantiene para el bono al llegar 
-- a la meta semanal completa, y para las submetas tipo 'once').
alter table public.gem_transactions
  drop constraint if exists gem_transactions_source_check;

alter table public.gem_transactions
  add constraint gem_transactions_source_check
  check (source in ('session','week_bonus','protein','steps','goal','subgoal','subgoal_checkin'));

commit;

-- Nada de esto afecta tus submetas existentes: todas quedan con 
-- goal_kind='once' por default, exactamente como funcionaban antes.
