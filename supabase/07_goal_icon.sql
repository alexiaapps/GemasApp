-- =====================================================================
-- MIGRACIÓN — ícono/emoji personalizado por meta grande (elegido al 
-- crearla, en vez de usar siempre el emoji genérico de su dimensión)
-- =====================================================================

begin;

alter table public.goals
  add column if not exists icon_emoji text;

commit;

-- icon_emoji queda NULL para tus metas ya existentes — en la interfaz, 
-- si es NULL, se puede mostrar el emoji de su dimensión como fallback.
