-- =====================================================================
-- MIGRACIÓN — función para la rueda de Logros: gemas por área
-- Suma gem_transactions agrupado por dimensión, en la base de datos
-- (así no se traen todas las filas al navegador y no choca con el
-- límite de 1000 filas de Supabase).
--
-- p_from: inicio del periodo (el navegador lo calcula en la zona
--         horaria del usuario: lunes de esta semana, día 1 del mes...).
--         NULL = todo el historial.
-- Devuelve UNA fila por cada una de las 12 dimensiones, incluso las
-- que tienen 0 gemas, para que la rueda siempre tenga 12 gajos.
-- =====================================================================

begin;

create or replace function public.gems_by_dimension(p_from timestamptz default null)
returns table (
  dimension_key text,
  label text,
  color_hex text,
  emoji text,
  sort_order integer,
  total bigint
)
language sql
stable
as $$
  select
    d.key,
    d.label,
    d.color_hex,
    d.emoji,
    d.sort_order,
    coalesce(sum(gt.amount), 0)::bigint as total
  from public.dimensions d
  left join public.gem_transactions gt
    on gt.dimension_key = d.key
   and gt.user_id = auth.uid()
   and (p_from is null or gt.created_at >= p_from)
  group by d.key, d.label, d.color_hex, d.emoji, d.sort_order
  order by d.sort_order;
$$;

grant execute on function public.gems_by_dimension(timestamptz) to authenticated;

commit;
