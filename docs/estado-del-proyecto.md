# Estado del proyecto

**Proyecto:** Sistema Web y Móvil de Gestión de Capacitaciones (Ingeniería de Software I)
**Última actualización:** 2026-11-19 · **Responsable:** 1 desarrollador (sin equipo Scrum)

## Resumen
Autenticación y roles desplegados en `https://gestion.universoftsystems.com`. El sprint 2 (cursos e inscripciones, RF-12 a RF-17) está implementado y validado localmente en la rama `sprint-2-cursos-inscripcion` de ambos repositorios; todavía no se ha desplegado. Evaluaciones, asistencia, certificados y dashboard funcional quedan para los siguientes sprints.

## Repositorios
| Repo | Contenido | Rama |
|---|---|---|
| `backend_capacitaciones` | API NestJS + Prisma + PostgreSQL | `sprint-2-cursos-inscripcion` |
| `frontend_capacitaciones` | SPA React + TypeScript + Vite | `sprint-2-cursos-inscripcion` |
| `app_capacitaciones` (futuro) | App móvil Flutter, Fase 2 | — |

Ambos repos llevan la misma copia de `docs/requerimientos-funcionales.*`.

## Avance por módulo (ver RF en `requerimientos-funcionales.md`)
| Módulo | Estado |
|---|---|
| 1. Autenticación y usuarios (RF-01 a RF-09) | ✅ Sprint 1 (desplegado) |
| 1. Perfil de usuario y sedes (RF-10, RF-11) | ⏳ pendiente |
| 2. Cursos e inscripción (RF-12 a RF-17) | ✅ Implementado y probado localmente; pendiente de despliegue |
| 2. Materiales y competencias (RF-18, RF-19) | ⏳ Opcionales pendientes |
| 3. Asistencia por QR web (RF-20 a RF-24) | ⏳ Sprint 3 |
| 4. Evaluaciones automatizadas (RF-26 a RF-34) | ⏳ Sprint 3 |
| 5. Certificados con QR (RF-35 a RF-40) | ⏳ Sprint 4 |
| 6. Dashboard del admin (RF-42 a RF-44) | ⏳ Sprint 4 (solo esqueleto de tarjetas hoy) |
| 7. Correos (RF-46) | 🟡 Autenticación en producción; confirmación de inscripción implementada en sprint 2 |
| 8. App móvil, geolocalización, tiempo real (RF-25, 48-50) | 🔜 Fase 2 |

## Hoja de ruta
1. **Sprint 1 — Fundaciones y autenticación** ✅ (`docs/sprints/sprint-1-autenticacion.md`)
2. **Sprint 2 — Cursos e inscripción** ✅ implementación y pruebas; pendiente de despliegue (`docs/sprints/sprint-2-cursos-inscripcion.md`)
3. **Sprint 3 — Evaluaciones y asistencia QR**
4. **Sprint 4 — Certificados y dashboard**

## Decisiones técnicas
- NestJS + Prisma + PostgreSQL; React + Vite + TypeScript + Tailwind.
- Sesión con cookies httpOnly (JWT de acceso y refresco), sin tokens en JS.
- Google OAuth implementado a mano con `fetch` y cookie de `state`.
- Solo el estudiante puede registrarse solo; instructores los crea el admin y activan su cuenta con un código enviado por correo.
- Paleta tomada del logo UNSAAC: carmesí `#9B1C31`, dorado `#D4A72C`, azul `#3F5F9E`, crema `#FBF6E6`.
- Despliegue en Dokploy (VPS propio) con un único dominio: frontend en `/` y backend en `/api`.
- Las inscripciones, cancelaciones y ediciones de cursos bloquean la misma fila del curso en PostgreSQL para mantener los cupos ante solicitudes simultáneas.
- Las fechas se muestran e ingresan en hora de Perú; la API recibe ISO 8601 con zona horaria. La inscripción cierra al inicio y la cancelación al término del curso.
- En sprint 2, sede y categoría son texto. El CRUD de sedes y los opcionales de materiales/competencias quedan pendientes.

## Verificación del sprint 2 (2026-11-19)

| Comprobación | Resultado |
|---|---|
| Backend: generación Prisma y build NestJS | Correcto |
| Backend: Jest (`node node_modules/jest/bin/jest.js --runInBand`) | 7 suites, 80 pruebas aprobadas |
| Frontend: Vitest | 28 pruebas aprobadas |
| Frontend: build, typecheck y lint | Correctos |
| PostgreSQL 18 local aislado: migraciones inicial y de cursos | Aplicadas correctamente |
| Integración por HTTP (`node scripts/sprint2-smoke.cjs`) | 33 verificaciones aprobadas: permisos, publicación, inscripción, cancelación, reinscripción y concurrencia |
| Control del último cupo | Tres solicitudes simultáneas: una inscripción y dos conflictos |
| Formato de cambios (`git diff --check`) | Sin errores |

El correo se simuló en la prueba de integración; se comprobó que un fallo de envío conserva la inscripción. Falta comprobar el envío real con Brevo en el entorno de despliegue. No se completó la revisión visual en navegador porque el host de acceso del navegador no estaba disponible; las interacciones se validaron con Testing Library.

## Pendientes y deuda conocida
- Desplegar el sprint 2: aplicar la migración `20261119010000_courses_enrollments` y publicar backend y frontend compatibles. Ejecutar una comprobación visual y de correo en ese entorno.
- Sin ESLint/Prettier en el backend.
- Falta editar el propio perfil (RF-10) y editar usuarios desde el admin (RF-09 parcial).
- El correo de contacto de `/privacidad` y `/terminos` es un marcador y debe definirse.
- Autodeploy por webhook de GitHub sin configurar; los despliegues son manuales.
- El primer build en el VPS tarda unos 15 minutos.
- Dokploy muestra "Update Available" sin actualizar.
- **Seguridad:** el JSON de cliente de Google (`client_secret_*.json`) no debe subirse a git nunca. Ambos `.gitignore` lo excluyen, pero lo correcto es mantenerlo fuera de los repos y guardarlo en un gestor de contraseñas.
