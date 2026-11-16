-- =====================================================================
-- MIGRACIÓN — registro y cuota de generaciones de IA
-- Tabla ai_generations + dos funciones:
--   reserve_ai_generation: cuenta las generaciones del usuario en el último
--     minuto y en las últimas 24 h; si hay cupo, reserva una fila y devuelve
--     su id; si no, devuelve ok=false. Es atómica (lock por usuario), así
--     que dos peticiones simultáneas no se saltan el límite.
--   finish_ai_generation: actualiza la fila con tokens reales y estado.
-- Los usuarios NO pueden insertar directo en la tabla: solo vía la función.
-- La función usa auth.uid(), así que el servidor debe llamarla con un
-- cliente Supabase autenticado con el token del usuario (anon key + header
-- Authorization). No se necesita service_role.
-- =====================================================================

begin;

create table if not exists public.ai_generations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  model text,
  input_tokens integer,
  output_tokens integer,
  status text not null default 'reserved'
    check (status in ('reserved', 'ok', 'error'))
);

create index if not exists ai_generations_user_created_idx
  on public.ai_generations (user_id, created_at desc);

alter table public.ai_generations enable row level security;

drop policy if exists "own ai generations read" on public.ai_generations;
create policy "own ai generations read"
  on public.ai_generations for select
  using (auth.uid() = user_id);

-- Sin políticas de insert/update/delete: solo las funciones de abajo escriben.

create or replace function public.reserve_ai_generation(
  p_model text,
  p_per_minute integer default 3,
  p_per_day integer default 20
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_minute integer;
  v_day integer;
  v_id uuid;
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'reason', 'no_session');
  end if;

  -- Serializa las reservas del mismo usuario (evita condiciones de carrera)
  perform pg_advisory_xact_lock(hashtext(v_uid::text));

  select count(*) into v_minute
    from public.ai_generations
   where user_id = v_uid and created_at > now() - interval '1 minute';

  select count(*) into v_day
    from public.ai_generations
   where user_id = v_uid and created_at > now() - interval '24 hours';

  if v_minute >= p_per_minute then
    return jsonb_build_object('ok', false, 'reason', 'minute_limit');
  end if;

  if v_day >= p_per_day then
    return jsonb_build_object('ok', false, 'reason', 'day_limit');
  end if;

  insert into public.ai_generations (user_id, model)
  values (v_uid, p_model)
  returning id into v_id;

  return jsonb_build_object(
    'ok', true,
    'id', v_id,
    'remaining_day', p_per_day - v_day - 1
  );
end;
$$;

create or replace function public.finish_ai_generation(
  p_id uuid,
  p_status text,
  p_input_tokens integer default null,
  p_output_tokens integer default null
)
returns void
language sql
security definer
set search_path = public
as $$
  update public.ai_generations
     set status = p_status,
         input_tokens = p_input_tokens,
         output_tokens = p_output_tokens
   where id = p_id
     and user_id = auth.uid()
     and p_status in ('ok', 'error');
$$;

revoke all on function public.reserve_ai_generation(text, integer, integer) from public;
revoke all on function public.finish_ai_generation(uuid, text, integer, integer) from public;
grant execute on function public.reserve_ai_generation(text, integer, integer) to authenticated;
grant execute on function public.finish_ai_generation(uuid, text, integer, integer) to authenticated;

commit;
