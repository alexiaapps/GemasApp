-- =====================================================================
-- MIGRACIÓN — permite guardar una grabación de voz por guion de afirmación
-- =====================================================================

begin;

alter table public.affirmation_scripts
  add column if not exists audio_storage_path text,
  add column if not exists audio_duration_sec numeric;

commit;

-- audio_storage_path vive en el mismo bucket privado 'affirmations' que
-- ya usamos para fotos/audio de Áreas, con la misma convención de
-- carpeta por user_id, así reutilizamos las mismas políticas de Storage.
