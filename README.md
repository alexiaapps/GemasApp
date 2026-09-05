# FitTrack

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

3. Corre el servidor de desarrollo:

   ```bash
   npm run dev
   ```

## Estructura

- `src/lib/supabase.ts` — cliente de Supabase.
- `src/context/AuthContext.tsx` — sesión y auth (login/registro/logout con email+password).
- `src/pages/` — las 5 pestañas: Inicio, Entrenamiento, Bitácora, Logros, Áreas.
- `src/components/TabLayout.tsx` — shell con navegación inferior tipo app móvil.

## PWA

Configurada con `vite-plugin-pwa` (manifest + service worker con auto-update). Los íconos en `public/pwa-*.png` son placeholders generados por `scripts/make_icons.py` — reemplázalos por el branding final antes de publicar.

Para probar la instalación en el celular, necesitas servir la build por HTTPS (Vercel lo da gratis) o usar `npm run build && npm run preview` en la misma red y acceder desde el celular a la IP local.

## Deploy en Vercel

1. Sube el repo a GitHub.
2. En Vercel: **New Project** → importa el repo → framework preset "Vite" (autodetectado).
3. Agrega las variables de entorno `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` en Project Settings → Environment Variables.
4. Deploy. `vercel.json` ya incluye el rewrite para que las rutas de React Router funcionen correctamente.
