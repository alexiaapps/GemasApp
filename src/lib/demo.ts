// Cuenta de demo pública. Este archivo lo importan el frontend (src/) y las funciones serverless (api/),
// así que no debe importar nada (ni el cliente de Supabase, que exige variables de entorno del navegador).
// La contraseña NO vive aquí: es la variable de servidor DEMO_PASSWORD, que solo lee api/demo-login.ts.

export const DEMO_EMAIL = 'demo@example.com'

/** ¿Este email es el de la cuenta de demo? (sin distinguir mayúsculas ni espacios) */
export function isDemoEmail(email: string | null | undefined): boolean {
  return typeof email === 'string' && email.trim().toLowerCase() === DEMO_EMAIL
}
