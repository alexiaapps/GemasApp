create table public.affirmation_scripts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  goal_id uuid not null references public.goals(id) on delete cascade,
  title text not null,
  script_text text not null,
  created_at timestamptz not null default now()
);

alter table public.affirmation_scripts enable row level security;

create policy "Users can view their own affirmation scripts"
  on public.affirmation_scripts for select
  using (auth.uid() = user_id);

create policy "Users can insert their own affirmation scripts"
  on public.affirmation_scripts for insert
  with check (auth.uid() = user_id);

create policy "Users can delete their own affirmation scripts"
  on public.affirmation_scripts for delete
  using (auth.uid() = user_id);
