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
- Modelo `claude-sonnet-5-5`, `max_tokens` 1200, con `timeout` y `maxRetries` en el cliente de Anthropic.
- La función lee `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` del entorno del servidor, así que deben estar habilitadas en los mismos entornos de Vercel donde uses `/api` (Production y Preview).

**Variables de entorno de la función:** `ANTHROPIC_API_KEY`, `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY`

**En desarrollo:** agrégala a tu `.env.local` (sin prefijo `VITE_`, ver arriba). Como `npm run dev` (Vite) no ejecuta las funciones de `/api`, para probarlas en local necesitas la CLI de Vercel, que sí simula el entorno serverless completo:

```bash
npx vercel dev
```

La primera vez te pedirá loguearte (`vercel login`) y vincular el proyecto (`vercel link`) — ambos leen `.env.local` automáticamente para las funciones de `/api`.

**En Vercel (producción):** Project Settings → **Environment Variables** → agrega `ANTHROPIC_API_KEY` con tu key real, marcada para los entornos que quieras (Production / Preview / Development). Después de guardarla hay que volver a desplegar (redeploy) para que la función serverless la recoja.

## Deploy en Vercel

1. Sube el repo a GitHub.
2. En Vercel: **New Project** → importa el repo → framework preset "Vite" (autodetectado).
3. Agrega las variables de entorno `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` y `ANTHROPIC_API_KEY` en Project Settings → Environment Variables.
4. Deploy. `vercel.json` ya incluye el rewrite para que las rutas de React Router funcionen correctamente; las funciones en `api/` las detecta y despliega Vercel automáticamente, sin configuración extra.
