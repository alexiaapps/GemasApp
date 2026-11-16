-- =====================================================================
-- FITTRACK / GEMAS — ESQUEMA COMPLETO PARA SUPABASE (Postgres)
-- Versión 2: normalizado — dimensiones (colores de gema) y catálogo
-- de ejercicios como fuentes de verdad únicas.
-- =====================================================================
-- Cómo usar este archivo:
--   1. Entra a tu proyecto en supabase.com -> SQL Editor -> New query
--   2. Pega TODO este archivo y dale "Run"
--   3. Ve a Authentication -> Providers y confirma que "Email" esté
--      habilitado (viene activado por default)
-- =====================================================================


begin;

-- ---------------------------------------------------------------------
-- 0. DIMENSIONS — catálogo de las 12 áreas de vida = 12 colores de gema
-- ---------------------------------------------------------------------
-- Única fuente de verdad para nombre/color/emoji de cada área. Todo lo
-- demás (metas, gemas, afirmaciones, ejercicios) apunta aquí por
-- llave foránea, así que agregar o recolorear un área se hace UNA vez.
create table public.dimensions (
  key text primary key,           -- 'fisico', 'emocional', ...
  label text not null,            -- 'Salud & Deportes'
  color_hex text not null,        -- '#4CAF7A'
  emoji text not null,
  sort_order integer not null default 0
);

-- Las 12 áreas reales (reemplazan las 7 genéricas del pitch de Gemas).
-- El key 'fisico' se conserva por compatibilidad con los defaults de
-- exercises/goals/gem_transactions, aunque su label ahora es
-- "Salud & Deportes".
insert into public.dimensions (key, label, color_hex, emoji, sort_order) values
  ('fisico',        'Salud & Deportes',        '#4CAF7A', '💪', 1),
  ('intelectual',   'Intelectual',             '#F0C93F', '🧠', 2),
  ('emocional',     'Emocional',               '#E8608F', '💗', 3),
  ('caracter',      'Carácter',                '#F0954A', '🦁', 4),
  ('espiritual',    'Espiritual',              '#4C8FE0', '✨', 5),
  ('relaciones',    'Relaciones',              '#E8524A', '💞', 6),
  ('paternidad',    'Paternidad y Maternidad', '#C9456B', '👶', 7),
  ('social',        'Social',                  '#3FBFA0', '🎉', 8),
  ('carrera',       'Carrera',                 '#8A5CE0', '🚀', 9),
  ('finanzas',      'Finanzas',                '#D9A226', '💰', 10),
  ('calidad_vida',  'Calidad de Vida',         '#B060D6', '🌿', 11),
  ('vision_vida',   'Visión de la Vida',       '#D6478F', '🔭', 12);


-- ---------------------------------------------------------------------
-- 1. PROFILES — un perfil real por cada usuario autenticado
-- ---------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Mi Perfil',
  avatar_emoji text default '💪',
  protein_goal_grams integer not null default 170,
  created_at timestamptz not null default now()
);

create function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', 'Mi Perfil'));

  -- crea automáticamente las 12 tarjetas de Afirmaciones (una por dimensión)
  insert into public.affirmation_areas (user_id, dimension_key)
  select new.id, key from public.dimensions;

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ---------------------------------------------------------------------
-- 2. EXERCISES — catálogo de ejercicios (fuente única del nombre/tipo)
-- ---------------------------------------------------------------------
create table public.exercises (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  default_type text not null default 'reps' check (default_type in ('reps','time')),
  dimension_key text not null default 'fisico' references public.dimensions(key),
  created_at timestamptz not null default now(),
  unique (user_id, name)
);


-- ---------------------------------------------------------------------
-- 3. PROGRAMS — bloques de entrenamiento (cada uno independiente)
-- ---------------------------------------------------------------------
create table public.programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  name text not null,
  goal text,
  weeks_total integer not null,
  days_per_week integer not null,
  start_date date,
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now()
);

-- 3a. PROGRAM_DAYS — resultado de "multiplicar" la semana plantilla
create table public.program_days (
  id uuid primary key default gen_random_uuid(),
  program_id uuid not null references public.programs(id) on delete cascade,
  week integer not null,
  day_number integer not null,
  label text not null default 'Día',
  completed boolean not null default false,
  completed_at timestamptz,
  unique (program_id, week, day_number)
);

-- 3b. DAY_EXERCISES — qué ejercicios (del catálogo) toca cada día,
-- y con qué parámetros (series/reps/rir/descanso) para ESE día
create table public.day_exercises (
  id uuid primary key default gen_random_uuid(),
  program_day_id uuid not null references public.program_days(id) on delete cascade,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  sets integer not null default 3,
  target_reps text,          -- ej. "8-10" o "30" (segundos) según el tipo del ejercicio
  rir integer,                -- null si el ejercicio es por tiempo
  rest_seconds integer default 120,
  order_index integer not null default 0
);


-- ---------------------------------------------------------------------
-- 4. EXERCISE_LOGS — el historial real de cada set entrenado
-- ---------------------------------------------------------------------
create table public.exercise_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  program_id uuid references public.programs(id) on delete set null,
  program_day_id uuid references public.program_days(id) on delete set null,
  exercise_id uuid not null references public.exercises(id) on delete restrict,
  set_number integer not null,
  reps integer,
  duration_sec numeric,
  weight numeric,
  weight_unit text default 'kg' check (weight_unit in ('kg','lb')),
  assistance numeric,
  rir integer,
  notes text,
  log_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index idx_exercise_logs_user_exercise
  on public.exercise_logs (user_id, exercise_id, created_at desc);


-- ---------------------------------------------------------------------
-- 5. GOALS — metas 2026 (pendientes y logros), ligadas a una dimensión
-- ---------------------------------------------------------------------
create table public.goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  text text not null,
  category text default 'Otro',
  dimension_key text not null default 'fisico' references public.dimensions(key),
  completed boolean not null default false,
  completed_at timestamptz,
  gems_reward integer not null default 50,
  created_at timestamptz not null default now()
);

-- 5a. SUBGOALS — pasos pequeños hacia una meta grande ("supermeta").
-- Viven en el Home mientras estén pendientes; NO expiran ni se borran
-- solas al pasar la semana — se quedan hasta que se logran (o el
-- usuario las borra a mano). Heredan color/dimensión de su goal padre
-- vía el join con `goals`, así que no repiten esa columna aquí.
create table public.subgoals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  text text not null,
  gems_reward integer not null default 10,   -- más chico que el de la meta grande
  completed boolean not null default false,
  completed_at timestamptz,
  -- Lunes de la semana en la que esta submeta se eligió como una de las
  -- "Metas Semanales" del Home. NULL = existe bajo su meta grande, pero
  -- no está elegida para ninguna semana en particular todavía. Al pasar
  -- la semana, simplemente deja de coincidir con "la semana actual" y
  -- desaparece del Home solo (sin borrarse) — el usuario elige otras 5
  -- para la semana nueva. Se limita a máx. 5 por semana desde la app.
  week_start_date date,
  created_at timestamptz not null default now()
);

create index idx_subgoals_user_pending
  on public.subgoals (user_id, completed, created_at desc);

create index idx_subgoals_week
  on public.subgoals (user_id, week_start_date);

create index idx_subgoals_goal
  on public.subgoals (goal_id);


-- ---------------------------------------------------------------------
-- 6. NUTRITION_DAILY — Bitácora diaria (proteína, pasos, km, peso)
-- ---------------------------------------------------------------------
create table public.nutrition_daily (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  log_date date not null,
  protein_goal_met boolean not null default false,   -- check 170g proteína -> +5 💎
  steps_goal_met boolean not null default false,      -- check 10,000 pasos -> +2 💎
  km_run numeric,      -- input opcional, sin gemas, solo registro
  weight numeric,       -- input opcional, sin gemas, solo registro
  created_at timestamptz not null default now(),
  unique (user_id, log_date)
);


-- ---------------------------------------------------------------------
-- 7. GEM_TRANSACTIONS — historial de cada gema ganada, con su color
-- ---------------------------------------------------------------------
create table public.gem_transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  amount integer not null,
  dimension_key text not null default 'fisico' references public.dimensions(key),
  source text not null check (source in ('session','week_bonus','protein','steps','goal','subgoal')),
  source_id text,   -- ej. programId+week, para no duplicar el bono semanal
  created_at timestamptz not null default now()
);

create unique index uq_week_bonus_once
  on public.gem_transactions (user_id, source_id)
  where source = 'week_bonus';


-- ---------------------------------------------------------------------
-- 8. AFFIRMATIONS — lotería de las 12 áreas + su galería multimedia
-- ---------------------------------------------------------------------
-- Una fila por usuario y dimensión (se crea sola al registrarte, ver
-- el trigger handle_new_user de arriba).
create table public.affirmation_areas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  dimension_key text not null references public.dimensions(key),
  cover_image_path text,        -- ruta dentro del bucket 'affirmations'
  created_at timestamptz not null default now(),
  unique (user_id, dimension_key)
);

create table public.affirmation_media (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  area_id uuid not null references public.affirmation_areas(id) on delete cascade,
  media_type text not null check (media_type in ('photo','audio','video_link')),
  storage_path text,   -- para photo/audio (bucket 'affirmations')
  external_url text,   -- para video_link (YouTube no listado, etc.)
  duration_sec numeric,
  caption text,
  created_at timestamptz not null default now()
);


-- =====================================================================
-- ROW LEVEL SECURITY — cada usuario solo ve y edita lo suyo
-- =====================================================================
alter table public.profiles            enable row level security;
alter table public.exercises           enable row level security;
alter table public.programs            enable row level security;
alter table public.program_days        enable row level security;
alter table public.day_exercises       enable row level security;
alter table public.exercise_logs       enable row level security;
alter table public.goals               enable row level security;
alter table public.subgoals            enable row level security;
alter table public.subgoals            enable row level security;
alter table public.nutrition_daily     enable row level security;
alter table public.gem_transactions    enable row level security;
alter table public.affirmation_areas   enable row level security;
alter table public.affirmation_media   enable row level security;
-- dimensions NO lleva RLS: es un catálogo público de solo lectura
-- para todos los usuarios (colores/emojis, sin datos personales).
alter table public.dimensions          enable row level security;
create policy "dimensions are readable by everyone"
  on public.dimensions for select using (true);

create policy "own profile" on public.profiles
  for all using (auth.uid() = id) with check (auth.uid() = id);

create policy "own exercises" on public.exercises
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own programs" on public.programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own program_days" on public.program_days
  for all using (
    exists (select 1 from public.programs p
            where p.id = program_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.programs p
            where p.id = program_id and p.user_id = auth.uid())
  );

create policy "own day_exercises" on public.day_exercises
  for all using (
    exists (select 1 from public.program_days pd
            join public.programs p on p.id = pd.program_id
            where pd.id = program_day_id and p.user_id = auth.uid())
  ) with check (
    exists (select 1 from public.program_days pd
            join public.programs p on p.id = pd.program_id
            where pd.id = program_day_id and p.user_id = auth.uid())
  );

create policy "own exercise_logs" on public.exercise_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own goals" on public.goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own subgoals" on public.subgoals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own nutrition" on public.nutrition_daily
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own gems" on public.gem_transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own affirmation_areas" on public.affirmation_areas
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own affirmation_media" on public.affirmation_media
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);


-- =====================================================================
-- STORAGE BUCKETS — fotos y audios (privados por usuario)
-- =====================================================================
insert into storage.buckets (id, name, public)
values ('affirmations', 'affirmations', false)
on conflict (id) do nothing;

-- Convención de carpeta: la primera parte del path = user_id, ej.
-- "3f2a.../fisico/foto1.jpg" — así cada quien solo toca la suya.
create policy "own affirmation files read"
  on storage.objects for select
  using (bucket_id = 'affirmations' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own affirmation files write"
  on storage.objects for insert
  with check (bucket_id = 'affirmations' and (storage.foldername(name))[1] = auth.uid()::text);

create policy "own affirmation files delete"
  on storage.objects for delete
  using (bucket_id = 'affirmations' and (storage.foldername(name))[1] = auth.uid()::text);


-- =====================================================================
-- LISTO. Cambios clave en esta versión:
--  - `dimensions` es la única fuente de color/emoji por área — cambiar
--    un color o agregar una dimensión nueva se hace en UNA fila.
--  - `exercises` es el catálogo: day_exercises y exercise_logs
--    apuntan por exercise_id, nunca repiten el nombre como texto suelto.
--  - Videos = external_url (link de YouTube no listado, etc.), nunca
--    se sube el archivo de video en sí.
-- =====================================================================

commit;
