-- =====================================================================
-- MIGRACIÓN — portada de imagen por afirmación (reemplaza al guion 
-- escrito como lo que se ve principal en la tarjeta)
-- =====================================================================

begin;

alter table public.affirmation_scripts
  add column if not exists cover_image_path text;

commit;

-- cover_image_path vive en el mismo bucket privado 'affirmations',
-- misma convención de carpeta por user_id que ya usamos en todo lo demás.
