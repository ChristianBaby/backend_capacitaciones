# Sprint 1 — Fundaciones y autenticación

**Fecha:** 2026-11-19 · **Estado:** ✅ completado y desplegado

## Objetivo
Contar con inicio de sesión (correo y Google), control de acceso por rol y el flujo de alta de instructores por código de correo, en producción.

## Historias entregadas
| Historia | RF | Estado |
|---|---|---|
| Registro de estudiante con verificación por correo | RF-01 | ✅ |
| Inicio de sesión con Google OAuth | RF-02 | ✅ (probar en navegador) |
| Login, logout y refresco de sesión | RF-03 | ✅ |
| Control de acceso por rol (Admin/Instructor/Estudiante) | RF-04 | ✅ |
| Recuperar contraseña por código | RF-05 | ✅ |
| Admin crea instructor y se envía código por correo | RF-06 | ✅ |
| Instructor ingresa con código y define contraseña | RF-07 | ✅ |
| Código con expiración, un solo uso y reenvío | RF-08 | ✅ |
| Admin lista y activa/desactiva usuarios | RF-09 | 🟡 sin edición de datos |
| Correos transaccionales con Brevo (solo auth) | RF-46 | 🟡 parcial |

## Entregables
- **Backend:** NestJS 11, Prisma 7, migración `20261119000000_init`, seed del admin, Dockerfile. Contrato en `docs/api-auth.md`.
- **Frontend:** pantallas públicas y privadas por rol, gestión de instructores y usuarios, páginas legales, Dockerfile con nginx.
- **Infraestructura:** DNS `gestion.universoftsystems.com`, proyecto Dokploy con PostgreSQL, app backend y app frontend con HTTPS (Let's Encrypt), app OAuth de Google en producción.

## Verificación
- Backend: 5 suites y 45 tests pasan; build correcto.
- Frontend: 5 archivos y 20 tests pasan; build y lint correctos.
- Producción: `/api/health` 200; endpoints protegidos devuelven 401 sin sesión; login con credenciales falsas devuelve mensaje genérico; el redirect de Google usa el `redirect_uri` registrado.
- Corrección durante la integración: el frontend enviaba `VERIFY_EMAIL` y el backend espera `EMAIL_VERIFY`.

## Pendiente de validar manualmente
Login real del admin, alta de instructor con correo de Brevo, registro de estudiante y login con Google.

## Retrospectiva
- Funcionó: dividir backend y frontend con un contrato de API común.
- A mejorar: probar contra una base real antes de desplegar, y evitar builds largos con una imagen más ligera (`chown -R` tardó ~6 min).
