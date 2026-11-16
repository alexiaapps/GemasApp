-- =====================================================================
-- MIGRACIÓN — cuenta DEMO: función que reinicia sus datos de ejemplo
-- reset_demo_data():
--   * SOLO funciona si quien la llama es el usuario demo@example.com
--     (cualquier otro usuario recibe un error y no se toca nada).
--   * Borra metas, submetas, gemas, bitácora, programas y ejercicios de
--     ese usuario y vuelve a insertar los datos de ejemplo.
--   * Los guiones (affirmation_scripts) cuelgan de una meta con
--     ON DELETE CASCADE, así que se borran con las metas y se vuelven a
--     crear aquí: 2 guiones con portada incluida en la app (/demo/*.svg).
-- Las fechas se calculan relativas a "hoy", así que "Esta semana" y
-- "Este mes" siempre tienen datos.
-- =====================================================================

begin;

-- ---------- helpers internos (no se exponen a usuarios) ----------
create or replace function public._demo_goal(
  p_uid uuid, p_dim text, p_text text, p_emoji text, p_done timestamptz
) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.goals
    (user_id, text, dimension_key, completed, completed_at, gems_reward, icon_emoji, created_at)
  values
    (p_uid, p_text, p_dim, p_done is not null, p_done, 50, p_emoji,
     coalesce(p_done, now()) - interval '45 days')
  returning id into v_id;

  if p_done is not null then
    insert into public.gem_transactions (user_id, amount, dimension_key, source, source_id, created_at)
    values (p_uid, 50, p_dim, 'goal', v_id::text, p_done);
  end if;
  return v_id;
end $$;

create or replace function public._demo_sub(
  p_uid uuid, p_goal uuid, p_dim text, p_text text,
  p_kind text, p_days integer, p_done timestamptz, p_week date
) returns void
language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  insert into public.subgoals
    (user_id, goal_id, text, gems_reward, completed, completed_at,
     goal_kind, target_days_per_week, week_start_date, created_at)
  values
    (p_uid, p_goal, p_text, 10, p_done is not null, p_done,
     p_kind, p_days, p_week, coalesce(p_done, now()) - interval '10 days')
  returning id into v_id;

  if p_done is not null then
    insert into public.gem_transactions (user_id, amount, dimension_key, source, source_id, created_at)
    values (p_uid, 10, p_dim, 'subgoal', v_id::text, p_done);
  end if;
end $$;

-- Supabase da EXECUTE por defecto a anon y authenticated, así que no basta con revocar a public.
revoke all on function public._demo_goal(uuid, text, text, text, timestamptz) from public, anon, authenticated;
revoke all on function public._demo_sub(uuid, uuid, text, text, text, integer, timestamptz, date) from public, anon, authenticated;

-- ---------- función principal ----------
create or replace function public.reset_demo_data()
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_demo uuid;
  v_week date := (date_trunc('week', now() at time zone 'America/Mexico_City'))::date;
  v_wk timestamptz := now() - interval '3 hours';   -- "esta semana"
  g uuid;
  i integer;
begin
  select id into v_demo from auth.users where email = 'demo@example.com';
  if v_uid is null or v_demo is null or v_uid <> v_demo then
    raise exception 'reset_demo_data solo puede usarla la cuenta demo';
  end if;

  -- 1) limpiar todo lo del usuario demo
  delete from public.gem_transactions where user_id = v_uid;
  delete from public.exercise_logs    where user_id = v_uid;
  delete from public.programs         where user_id = v_uid;
  delete from public.exercises        where user_id = v_uid;
  delete from public.goals            where user_id = v_uid;   -- borra submetas en cascada
  delete from public.nutrition_daily  where user_id = v_uid;

  -- 2) metas COMPLETADAS (alimentan badges e historial)
  g := _demo_goal(v_uid, 'carrera', 'Lanzar mi portafolio profesional', '🚀', now() - interval '20 days');
  perform _demo_sub(v_uid, g, 'carrera', 'Elegir los proyectos a mostrar', 'once', null, now() - interval '34 days', null);
  perform _demo_sub(v_uid, g, 'carrera', 'Escribir el texto de cada proyecto', 'once', null, now() - interval '28 days', null);
  perform _demo_sub(v_uid, g, 'carrera', 'Publicar el sitio', 'once', null, now() - interval '21 days', null);

  g := _demo_goal(v_uid, 'fisico', 'Correr mis primeros 10 km', '🏃', now() - interval '9 days');
  perform _demo_sub(v_uid, g, 'fisico', 'Correr 3 km sin parar', 'once', null, now() - interval '30 days', null);
  perform _demo_sub(v_uid, g, 'fisico', 'Correr 5 km', 'once', null, now() - interval '17 days', null);

  g := _demo_goal(v_uid, 'finanzas', 'Armar mi fondo de emergencia', '💰', now() - interval '40 days');
  perform _demo_sub(v_uid, g, 'finanzas', 'Abrir una cuenta de ahorro', 'once', null, now() - interval '52 days', null);
  perform _demo_sub(v_uid, g, 'finanzas', 'Automatizar la transferencia mensual', 'once', null, now() - interval '46 days', null);

  g := _demo_goal(v_uid, 'emocional', 'Crear el hábito de escribir mi diario', '📓', now() - interval '3 days');
  perform _demo_sub(v_uid, g, 'emocional', 'Escribir 7 días seguidos', 'once', null, now() - interval '24 days', null);
  perform _demo_sub(v_uid, g, 'emocional', 'Escribir 21 días en total', 'once', null, now() - interval '8 days', null);

  -- 3) metas EN CURSO (alimentan Inicio, Áreas y las gemas por área)
  g := _demo_goal(v_uid, 'intelectual', 'Leer 12 libros este año', '📚', null);
  perform _demo_sub(v_uid, g, 'intelectual', 'Elegir mi lista de 12 libros', 'once', null, now() - interval '25 days', null);
  perform _demo_sub(v_uid, g, 'intelectual', 'Terminar el primer libro', 'once', null, now() - interval '12 days', null);
  perform _demo_sub(v_uid, g, 'intelectual', 'Terminar el segundo libro', 'once', null, now() - interval '4 days', null);
  perform _demo_sub(v_uid, g, 'intelectual', 'Leer 50 páginas del libro', 'once', null, null, v_week);
  perform _demo_sub(v_uid, g, 'intelectual', 'Leer 20 minutos al día', 'habit', 5, null, null);

  insert into public.affirmation_scripts (user_id, goal_id, title, script_text, cover_image_path)
  values (v_uid, g, 'Soy una lectora constante', $t$Respira profundo y deja que tu cuerpo se suavice.

Hoy elijo darle a mi mente el espacio que merece. Soy una persona que lee, que aprende y que disfruta crecer con cada página.

Siento la calma de abrir un libro y dejar el ruido afuera. Mi atención es un regalo que me doy, y me gusta cómo se siente: tranquila, curiosa, presente.

Ya leí mis primeros libros de este año, y eso me recuerda que sí puedo sostener lo que empiezo. No necesito hacerlo perfecto. Me basta con volver cada día, aunque sean veinte minutos.

Cada página me hace más sabia. Cada idea nueva abre una puerta dentro de mí. Me emociona imaginar todo lo que voy a entender, a conectar y a crear gracias a lo que leo.

Cuando algo me distrae, me lo perdono y regreso con suavidad. Mi constancia no se mide en días perfectos, sino en las veces que vuelvo a mí.

Me veo a final de año con mis doce libros terminados, sintiéndome orgullosa, ligera y llena de ideas. Disfruto el camino tanto como la meta.

Soy una lectora constante. Mi mente es curiosa, mi tiempo es valioso y mi crecimiento es real. Hoy leo, y con cada página me acerco a la persona que quiero ser.

Respiro, sonrío y sigo.$t$, '/demo/cover-intelectual.svg');

  g := _demo_goal(v_uid, 'espiritual', 'Crear mi rutina de meditación', '🧘', null);
  perform _demo_sub(v_uid, g, 'espiritual', 'Probar 3 apps de meditación', 'once', null, now() - interval '15 days', null);
  perform _demo_sub(v_uid, g, 'espiritual', 'Meditar 7 días seguidos', 'once', null, now() - interval '6 days', null);
  perform _demo_sub(v_uid, g, 'espiritual', 'Meditar 20 minutos', 'habit', 4, null, v_week);

  insert into public.affirmation_scripts (user_id, goal_id, title, script_text, cover_image_path)
  values (v_uid, g, 'Mi calma es mi centro', $t$Cierra los ojos y suelta los hombros.

Estoy aquí, en este momento, y es suficiente. No tengo que resolver nada ahora. Solo respiro.

Siento cómo el aire entra y cómo sale. Con cada respiración mi cuerpo se afloja y mi mente se vuelve más clara. Dentro de mí hay un lugar tranquilo que siempre está disponible.

Me siento orgullosa de haber probado distintas formas de meditar hasta encontrar la mía. Esa constancia me muestra que puedo cuidarme con paciencia y cariño.

Cuando llegan los pensamientos, no los peleo. Los dejo pasar como nubes y regreso a mi respiración. Así de simple, así de amable.

Mi calma no depende de que todo salga bien. Nace de saber que puedo detenerme, escucharme y volver a mi centro las veces que haga falta.

Veinte minutos para mí son un acto de amor. Me los doy con gusto, porque merezco paz, y porque desde la paz tomo mejores decisiones y me relaciono mejor con las personas que quiero.

Siento gratitud por mi cuerpo, por mi mente y por este día. Siento confianza en el camino que estoy construyendo.

Mi calma es mi centro. Respiro hondo, me suelto y me quedo aquí, en paz, el tiempo que necesite.$t$, '/demo/cover-espiritual.svg');

  g := _demo_goal(v_uid, 'relaciones', 'Cuidar mis amistades', '💞', null);
  perform _demo_sub(v_uid, g, 'relaciones', 'Reservar una cita con mi mejor amiga', 'once', null, now() - interval '10 days', null);
  perform _demo_sub(v_uid, g, 'relaciones', 'Escribirle a 3 amigas que extraño', 'once', null, now() - interval '3 days', null);
  perform _demo_sub(v_uid, g, 'relaciones', 'Llamar a alguien querido', 'habit', 1, null, null);
  -- esta semana, YA COMPLETADA (roja)
  perform _demo_sub(v_uid, g, 'relaciones', 'Escribirle a mi mejor amiga', 'once', null, v_wk, v_week);

  g := _demo_goal(v_uid, 'social', 'Organizar una cena con amigos', '🎉', null);
  perform _demo_sub(v_uid, g, 'social', 'Hacer la lista de invitados', 'once', null, now() - interval '8 days', null);
  perform _demo_sub(v_uid, g, 'social', 'Elegir fecha y lugar', 'once', null, null, null);

  g := _demo_goal(v_uid, 'caracter', 'Ser más constante', '🦁', null);
  perform _demo_sub(v_uid, g, 'caracter', 'Levantarme a las 6:30 una semana', 'once', null, now() - interval '20 days', null);
  perform _demo_sub(v_uid, g, 'caracter', 'Planear mi semana cada domingo', 'once', null, now() - interval '13 days', null);
  perform _demo_sub(v_uid, g, 'caracter', 'Terminar una tarea pendiente al día', 'once', null, now() - interval '2 days', null);
  -- esta semana, YA COMPLETADA (naranja)
  perform _demo_sub(v_uid, g, 'caracter', 'Preparar mi plan de la semana', 'once', null, v_wk, v_week);

  -- meta nueva para tener una submeta ROSA esta semana
  g := _demo_goal(v_uid, 'emocional', 'Cuidar mi bienestar emocional', '🌸', null);
  perform _demo_sub(v_uid, g, 'emocional', 'Probar una técnica de respiración', 'once', null, now() - interval '14 days', null);
  perform _demo_sub(v_uid, g, 'emocional', 'Hacer journaling antes de dormir', 'habit', 5, null, v_week);

  g := _demo_goal(v_uid, 'calidad_vida', 'Tener un hogar tranquilo', '🌿', null);
  perform _demo_sub(v_uid, g, 'calidad_vida', 'Ordenar mi escritorio', 'once', null, now() - interval '9 days', null);
  perform _demo_sub(v_uid, g, 'calidad_vida', 'Comprar plantas', 'once', null, now() - interval '5 days', null);
  perform _demo_sub(v_uid, g, 'calidad_vida', 'Reorganizar mi clóset', 'once', null, null, null);

  g := _demo_goal(v_uid, 'paternidad', 'Crear rituales familiares', '👶', null);
  perform _demo_sub(v_uid, g, 'paternidad', 'Planear una tarde de juegos', 'once', null, now() - interval '7 days', null);
  perform _demo_sub(v_uid, g, 'paternidad', 'Hacer un álbum de fotos', 'once', null, null, null);

  g := _demo_goal(v_uid, 'vision_vida', 'Definir mi visión a 5 años', '🔭', null);
  perform _demo_sub(v_uid, g, 'vision_vida', 'Escribir mi visión', 'once', null, now() - interval '18 days', null);
  perform _demo_sub(v_uid, g, 'vision_vida', 'Hacer mi tablero de visión', 'once', null, now() - interval '11 days', null);
  perform _demo_sub(v_uid, g, 'vision_vida', 'Revisar mi visión cada mes', 'once', null, null, null);

  g := _demo_goal(v_uid, 'carrera', 'Conseguir mi próximo gran proyecto', '💼', null);
  perform _demo_sub(v_uid, g, 'carrera', 'Actualizar mi portafolio', 'once', null, now() - interval '6 days', null);
  perform _demo_sub(v_uid, g, 'carrera', 'Contactar a 5 personas del sector', 'once', null, null, null);

  -- 4) gemas de entrenamiento y bitácora repartidas en el tiempo
  for i in 0..7 loop
    insert into public.gem_transactions (user_id, amount, dimension_key, source, source_id, created_at)
    values (v_uid, 5, 'fisico', 'session', 'demo-session-' || i,
            case when i < 2 then v_wk - (i || ' hours')::interval
                 else now() - ((i * 4) || ' days')::interval end);
  end loop;

  insert into public.gem_transactions (user_id, amount, dimension_key, source, source_id, created_at) values
    (v_uid, 10, 'fisico', 'week_bonus', 'demo-w1', now() - interval '9 days'),
    (v_uid, 10, 'fisico', 'week_bonus', 'demo-w2', now() - interval '16 days');

  for i in 0..5 loop
    insert into public.gem_transactions (user_id, amount, dimension_key, source, source_id, created_at)
    values (v_uid, 5, 'fisico', 'protein', 'demo-protein-' || i,
            case when i = 0 then v_wk else now() - ((i * 3) || ' days')::interval end);
  end loop;

  for i in 0..3 loop
    insert into public.gem_transactions (user_id, amount, dimension_key, source, source_id, created_at)
    values (v_uid, 2, 'fisico', 'steps', 'demo-steps-' || i,
            case when i = 0 then v_wk else now() - ((i * 5) || ' days')::interval end);
  end loop;

  insert into public.nutrition_daily (user_id, log_date, protein_goal_met, steps_goal_met, km_run, weight)
  select v_uid, (current_date - d), (d % 2 = 0), (d % 3 = 0),
         case when d % 3 = 0 then 5 else null end,
         round((62.0 - d * 0.1)::numeric, 1)
  from generate_series(0, 6) as d;
end $$;

revoke all on function public.reset_demo_data() from public, anon;
grant execute on function public.reset_demo_data() to authenticated;

commit;
