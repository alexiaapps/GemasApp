-- =====================================================================
-- MIGRACIÓN — agrega la política de UPDATE que faltaba en 
-- affirmation_scripts (por eso fallaba al guardar audio/portada sobre 
-- un guion ya existente: solo había políticas de select/insert/delete).
-- =====================================================================

begin;

create policy "Users can update their own affirmation scripts"
  on public.affirmation_scripts for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

commit;
