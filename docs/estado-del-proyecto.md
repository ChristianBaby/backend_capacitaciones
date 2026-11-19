# Estado del proyecto

**Proyecto:** Sistema Web y Móvil de Gestión de Capacitaciones (Ingeniería de Software I)
**Última actualización:** 2026-11-19 · **Responsable:** 1 desarrollador (sin equipo Scrum)

## Resumen
MVP web en producción parcial: autenticación y roles desplegados en `https://gestion.universoftsystems.com`. Falta el núcleo funcional (cursos, evaluaciones, asistencia, certificados, dashboard).

## Repositorios
| Repo | Contenido | Rama |
|---|---|---|
| `backend_capacitaciones` | API NestJS + Prisma + PostgreSQL | `main` |
| `frontend_capacitaciones` | SPA React + TypeScript + Vite | `main` |
| `app_capacitaciones` (futuro) | App móvil Flutter, Fase 2 | — |

Ambos repos llevan la misma copia de `docs/requerimientos-funcionales.*`.

## Avance por módulo (ver RF en `requerimientos-funcionales.md`)
| Módulo | Estado |
|---|---|
| 1. Autenticación y usuarios (RF-01 a RF-09) | ✅ Sprint 1 (desplegado) |
| 1. Perfil de usuario y sedes (RF-10, RF-11) | ⏳ pendiente |
| 2. Cursos e inscripción (RF-12 a RF-19) | ⏳ Sprint 2 |
| 3. Asistencia por QR web (RF-20 a RF-24) | ⏳ Sprint 3 |
| 4. Evaluaciones automatizadas (RF-26 a RF-34) | ⏳ Sprint 3 |
| 5. Certificados con QR (RF-35 a RF-40) | ⏳ Sprint 4 |
| 6. Dashboard del admin (RF-42 a RF-44) | ⏳ Sprint 4 (solo esqueleto de tarjetas hoy) |
| 7. Correos (RF-46) | 🟡 solo códigos de auth |
| 8. App móvil, geolocalización, tiempo real (RF-25, 48-50) | 🔜 Fase 2 |

## Hoja de ruta
1. **Sprint 1 — Fundaciones y autenticación** ✅ (`docs/sprints/sprint-1-autenticacion.md`)
2. **Sprint 2 — Cursos e inscripción**
3. **Sprint 3 — Evaluaciones y asistencia QR**
4. **Sprint 4 — Certificados y dashboard**

## Decisiones técnicas
- NestJS + Prisma + PostgreSQL; React + Vite + TypeScript + Tailwind.
- Sesión con cookies httpOnly (JWT de acceso y refresco), sin tokens en JS.
- Google OAuth implementado a mano con `fetch` y cookie de `state`.
- Solo el estudiante puede registrarse solo; instructores los crea el admin y activan su cuenta con un código enviado por correo.
- Paleta tomada del logo UNSAAC: carmesí `#9B1C31`, dorado `#D4A72C`, azul `#3F5F9E`, crema `#FBF6E6`.
- Despliegue en Dokploy (VPS propio) con un único dominio: frontend en `/` y backend en `/api`.

## Pendientes y deuda conocida
- Las pruebas del backend usan un Prisma simulado en memoria; falta probar contra PostgreSQL real (la migración y el seed sí corrieron en producción).
- Sin ESLint/Prettier en el backend.
- Falta editar el propio perfil (RF-10) y editar usuarios desde el admin (RF-09 parcial).
- El correo de contacto de `/privacidad` y `/terminos` es un marcador y debe definirse.
- Autodeploy por webhook de GitHub sin configurar; los despliegues son manuales.
- El primer build en el VPS tarda unos 15 minutos.
- Dokploy muestra "Update Available" sin actualizar.
- **Seguridad:** el JSON de cliente de Google (`client_secret_*.json`) no debe subirse a git nunca. Ambos `.gitignore` lo excluyen, pero lo correcto es mantenerlo fuera de los repos y guardarlo en un gestor de contraseñas.
