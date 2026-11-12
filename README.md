# Gemas

Tracker de entrenamiento y gamificación de vida personal. React + Vite + TypeScript + Supabase, configurado como PWA instalable.

## Setup local

1. Instala dependencias:

   ```bash
   npm install
   ```

2. Crea `.env.local` a partir del ejemplo y completa con los datos de tu proyecto de Supabase (Project Settings → API):

   ```bash
   cp .env.local.example .env.local
   ```

   ```
   VITE_SUPABASE_URL=https://tu-proyecto.supabase.co
   VITE_SUPABASE_ANON_KEY=tu-anon-key
   ```

   La `anon key` es segura para exponer en el cliente siempre que tengas RLS activado en tus tablas (que ya es el caso).

3. Si vas a usar generación de guiones con IA (ver sección **API de Anthropic** abajo), agrega también en el mismo `.env.local`:

   ```
   ANTHROPIC_API_KEY=sk-ant-...
   ```

4. Corre el servidor de desarrollo:

   ```bash
   npm run dev
   ```

   Esto sirve el frontend (Vite), pero **no** ejecuta las funciones serverless de `/api`. Para probar esas rutas en local, ver la sección de abajo.

## Estructura

- `src/lib/supabase.ts` — cliente de Supabase.
- `src/context/AuthContext.tsx` — sesión y auth (login/registro/logout con email+password).
- `src/pages/` — las pestañas: Inicio, Entrenamiento, Logros, Áreas, Afirmaciones.
- `src/components/TabLayout.tsx` — shell con navegación inferior tipo app móvil.
- `api/` — funciones serverless de Vercel (código de servidor, nunca se manda al navegador).

## PWA

Configurada con `vite-plugin-pwa` (manifest + service worker con auto-update). Los íconos (`public/pwa-192x192.png`, `public/pwa-512x512.png`, `public/apple-touch-icon.png`, `public/favicon.png`) se generan desde el logo real (`scripts/gemas-logo-original.png`) con `node scripts/generate-icons.mjs` (usa `sharp`). Si el logo cambia, reemplaza ese archivo fuente y vuelve a correr el script.

Para probar la instalación en el celular, necesitas servir la build por HTTPS (Vercel lo da gratis) o usar `npm run build && npm run preview` en la misma red y acceder desde el celular a la IP local.

## API de Anthropic (generación de guiones con IA)

La API key de Anthropic es un secreto de servidor — **nunca** lleva el prefijo `VITE_` (esas sí se empaquetan en el JS que descarga el navegador). Vive solo en `process.env.ANTHROPIC_API_KEY`, leída exclusivamente desde funciones serverless en `api/` (ej. `api/generate-script.ts`). El frontend nunca la ve; solo hace `fetch('/api/generate-script', { method: 'POST', headers: { Authorization: 'Bearer <access_token>' }, body: ... })`.

**Seguridad del endpoint (`api/generate-script.ts`):**
- Exige una sesión válida de Supabase: lee `Authorization: Bearer <access_token>`, lo valida con `auth.getUser(token)` (cliente con la anon key, nunca `service_role`) y responde **401** si falta o es inválido. Esto ocurre antes de llamar a Anthropic. Si Supabase no responde, devuelve **503**.
- Valida la entrada antes de llamar a Anthropic: `goalText` y `dimensionLabel` deben ser texto, con tope de 200 y 50 caracteres (**400** si no cumplen). Se quitan saltos de línea y comillas antes de ponerlos en el prompt.
- **Cuota por usuario:** después de validar la sesión y la entrada, y antes de llamar a Anthropic, reserva un cupo con `rpc('reserve_ai_generation', { p_model, p_per_minute: 3, p_per_day: 20 })`. Si no hay cupo responde **429** con `reason` (`minute_limit` / `day_limit`) y un mensaje en español. Si la reserva falla, responde 500 y no llama a Anthropic (falla cerrada). Al terminar cierra la reserva con `rpc('finish_ai_generation', { p_id, p_status: 'ok' | 'error', p_input_tokens, p_output_tokens })`. Ambas funciones usan `auth.uid()`, así que se llaman con un cliente creado con la anon key y el token del usuario (nunca `service_role`). La tabla y las funciones viven en Supabase (`ai_generations`).
- Modelo `claude-sonnet-5-5`, `max_tokens` 1200, con `timeout` y `maxRetries` en el cliente de Anthropic.
- La función lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del entorno del servidor, así que deben estar habilitadas en los mismos entornos de Vercel donde uses `/api` (Production y Preview).

**Variables de entorno de la función:** `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

**En desarrollo:** agrégala a tu `.env.local` (sin prefijo `VITE_`, ver arriba). Como `npm run dev` (Vite) no ejecuta las funciones de `/api`, para probarlas en local necesitas la CLI de Vercel, que sí simula el entorno serverless completo:

```bash
npx vercel dev
```

La primera vez te pedirá loguearte (`vercel login`) y vincular el proyecto (`vercel link`) — ambos leen `.env.local` automáticamente para las funciones de `/api`.

**En Vercel (producción):** Project Settings → **Environment Variables** → agrega `ANTHROPIC_API_KEY` con tu key real, marcada para los entornos que quieras (Production / Preview / Development). Después de guardarla hay que volver a desplegar (redeploy) para que la función serverless la recoja.

## Demo pública ("Probar demo")

El login tiene un botón **Probar demo** que entra a una cuenta de ejemplo sin registrarse. Piezas:

- **`src/lib/demo.ts`**: constante `DEMO_EMAIL = 'demo@example.com'` y `isDemoEmail()`. Es un archivo compartido que importan el frontend y las funciones de `api/`, por eso no importa nada más. Las funciones de `api/` lo importan **con extensión `.js`** (`'../src/lib/demo.js'`): sin ella, el JS compilado por Vercel falla en producción con `ERR_MODULE_NOT_FOUND`.
- **Variable de entorno `DEMO_PASSWORD`** (solo servidor, **sin prefijo `VITE_`**; en Vercel, Production y Preview): la contraseña de la cuenta demo. Nunca llega al navegador: solo la lee `api/demo-login.ts`, que no la devuelve ni la registra. Si no está definida, el endpoint responde 503 y el botón no aparece.
- **`api/demo-login.ts`**: `GET` dice si la demo está disponible (200/503, sin tocar la contraseña); `POST` inicia sesión con la anon key (nunca `service_role`) y devuelve solo `{ access_token, refresh_token }`. **Límite contra abuso:** 10 llamadas por minuto por IP, en memoria de la instancia (ventana fija; Vercel sobrescribe `x-forwarded-for`, así que la IP no se puede falsear). En serverless cada instancia tiene su propia memoria, así que es un límite de mejor esfuerzo; si hiciera falta uno global, se puede añadir una regla de rate limiting en Vercel (Firewall).
- **Flujo del botón:** `/api/demo-login` → `supabase.auth.setSession` → `rpc('reset_demo_data')` → entrar. Mientras dura, la app sigue mostrando el login ("Preparando la demo..."): no se entra a medias. Si algo falla, se cierra la sesión y se muestra un mensaje.
- **Cierre de sesión local:** la cuenta demo es compartida, así que `Salir` y los fallos de la demo usan `signOut({ scope: 'local' })`; el cierre global (el predeterminado) revocaría la sesión de los demás visitantes.
- **Banner:** con la sesión demo se muestra "Modo demo: los cambios se reinician en cada entrada."
- **IA en la demo:** `api/generate-script.ts` limita la cuenta demo a **1 generación por minuto y 3 por día, compartidas entre todos los visitantes**, y responde 429 con "La demo llegó a su límite de generaciones de hoy. Crea tu cuenta o vuelve mañana." Los demás usuarios siguen con 3 por minuto y 20 por día.

El usuario demo y la función `reset_demo_data` viven en Supabase (la función solo funciona si la llama ese usuario).

## Deploy en Vercel

1. Sube el repo a GitHub.
2. En Vercel: **New Project** → importa el repo → framework preset "Vite" (autodetectado).
3. Agrega las variables de entorno `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `ANTHROPIC_API_KEY` en Project Settings → Environment Variables.
4. Deploy. `vercel.json` ya incluye el rewrite para que las rutas de React Router funcionen correctamente; las funciones en `api/` las detecta y despliega Vercel automáticamente, sin configuración extra.
