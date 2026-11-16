-- =====================================================================
-- MIGRACIÓN — agrega la política de UPDATE que faltaba en Storage 
-- (bucket 'affirmations'). Causa raíz real del error: al REGRABAR un 
-- audio o reemplazar una portada ya existente, Supabase hace un 
-- upsert (INSERT ... ON CONFLICT DO UPDATE), y esa ruta evalúa la 
-- política de UPDATE de storage.objects — que nunca se creó. Por eso 
-- solo fallaba al regrabar/reemplazar, no en la primera subida.
-- =====================================================================

begin;

create policy "own affirmation files update"
  on storage.objects for update
  using (bucket_id = 'affirmations' and (storage.foldername(name))[1] = auth.uid()::text)
  with check (bucket_id = 'affirmations' and (storage.foldername(name))[1] = auth.uid()::text);

commit;
