# Despliegue

Este documento no contiene secretos. Los valores reales se guardan solo en Dokploy y en el gestor de contraseñas del responsable.

## Arquitectura
Un solo dominio, `https://gestion.universoftsystems.com`, detrás de Traefik (Dokploy):

| Servicio | Ruta | Puerto | Origen |
|---|---|---|---|
| frontend | `/` | 80 | repo `frontend_capacitaciones`, `main`, Dockerfile (nginx) |
| backend | `/api` | 3001 | repo `backend_capacitaciones`, `main`, Dockerfile |
| postgres-capacitaciones | — | 5432 (solo red interna) | servicio de base de datos de Dokploy |

- Dokploy: `http://89.116.31.17:3000`, proyecto `gestion-capacitaciones`, entorno `production`.
- Los repos son públicos y se clonan por HTTPS (pestaña Git). "Strip Path" está desactivado en el backend porque la API ya usa el prefijo `/api`.
- La base de datos no se expone al exterior; las migraciones corren al arrancar el contenedor del backend (`prisma migrate deploy`, luego el seed y `node dist/main.js`).

## DNS (Namecheap, `universoftsystems.com`)
Registro A `gestion` → `89.116.31.17`. El dominio ya tiene los registros DKIM y de verificación de Brevo.

## Variables de entorno del backend
Se configuran en Dokploy → backend → Environment. Solo nombres:

`NODE_ENV`, `PORT` (3001), `FRONTEND_URL`, `DATABASE_URL` (URL interna de Dokploy), `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (`https://gestion.universoftsystems.com/api/auth/google/callback`), `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.

El frontend no usa variables de entorno. La plantilla de referencia es `backend_capacitaciones/.env.example`.

## Google OAuth
- Proyecto de Google Cloud: "My First Project", Google Auth Platform, app **en producción**, usuarios externos.
- Cliente web con orígenes `https://gestion.universoftsystems.com` y `http://localhost:5173`, y redirect URIs `https://gestion.universoftsystems.com/api/auth/google/callback` y `http://localhost:3001/api/auth/google/callback`.
- La marca enlaza a `/privacidad` y `/terminos` del propio sitio.
- **Nunca** subir a git el JSON de cliente descargado (`client_secret_*.json`).

## Cómo desplegar
1. Hacer merge a `main` y `git push`.
2. En Dokploy, abrir la aplicación → General → **Deploy** (el autodeploy por webhook aún no está configurado).
3. Revisar Deployments y la pestaña Logs del contenedor.
4. Probar `https://gestion.universoftsystems.com/api/health`.

## Desarrollo local
Backend en el puerto 3001 y frontend en el 5173 (Vite hace proxy de `/api`). Ver los README de cada repo.

## Problemas conocidos
- El primer build del backend tarda ~15 minutos en este VPS; mientras tanto el dominio responde 502.
- Rotar el secreto de Google o el de Brevo si alguna vez se expone.
