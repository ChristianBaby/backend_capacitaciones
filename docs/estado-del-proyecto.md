# Estado del proyecto

**Proyecto:** Sistema Web y Móvil de Gestión de Capacitaciones (Ingeniería de Software I)
**Última actualización:** 2026-11-20 · **Responsable:** 1 desarrollador (sin equipo Scrum)

## Resumen
Los sprints 1 a 4 están fusionados en `main` y **desplegados** en `https://gestion.universoftsystems.com` (backend el 2026-11-20 a las 00:53, frontend a las 00:59, hora local). Verificado en producción: `/api/health` 200, rutas protegidas responden 401 sin sesión, la verificación pública de certificados responde 404 para códigos inexistentes y las 5 migraciones constan como aplicadas. Pendiente de validar con uso real: login del admin, cámara en teléfono, PDF con plantilla real y correo con Brevo.

## Repositorios
| Repo | Contenido | Rama |
|---|---|---|
| `backend_capacitaciones` | API NestJS + Prisma + PostgreSQL | `main` (incluye sprints 1 a 4) |
| `frontend_capacitaciones` | SPA React + TypeScript + Vite | `main` (incluye sprints 1 a 4) |
| `app_capacitaciones` (futuro) | App móvil Flutter, Fase 2 | — |

Ambos repos llevan la misma copia de `docs/requerimientos-funcionales.*`.

## Avance por módulo (ver RF en `requerimientos-funcionales.md`)
| Módulo | Estado |
|---|---|
| 1. Autenticación y usuarios (RF-01 a RF-09) | ✅ Sprint 1 (desplegado) |
| 1. Perfil de usuario y sedes (RF-10, RF-11) | ⏳ pendiente |
| 2. Cursos e inscripción (RF-12 a RF-17) | ✅ Desplegado |
| 2. Materiales y competencias (RF-18, RF-19) | ⏳ Opcionales pendientes |
| 3. Asistencia por QR web (RF-20 a RF-23) | ✅ Desplegado; RF-24 opcional pendiente |
| 4. Evaluaciones automatizadas (RF-26 a RF-31, RF-33 y RF-34) | ✅ Desplegado; RF-32 parcial: nota mínima configurable, un intento fijo |
| 5. Certificados con QR (RF-35 a RF-39) | ✅ Desplegado; RF-40 parcial: revocación disponible, reemisión pendiente |
| 6. Dashboard del admin (RF-42) | ✅ Desplegado: indicadores; RF-43 y RF-44 opcionales pendientes |
| 7. Correos (RF-46) | 🟡 Autenticación en producción; inscripción y certificado desplegados; aviso de evaluación pendiente |
| 8. App móvil, geolocalización, tiempo real (RF-25, 48-50) | 🔜 Fase 2 |

## Hoja de ruta
1. **Sprint 1 — Fundaciones y autenticación** ✅ (`docs/sprints/sprint-1-autenticacion.md`)
2. **Sprint 2 — Cursos e inscripción** ✅ desplegado (`docs/sprints/sprint-2-cursos-inscripcion.md`)
3. **Sprint 3 — Evaluaciones y asistencia QR** ✅ desplegado (`docs/sprints/sprint-3-evaluaciones-asistencia.md`)
4. **Sprint 4 — Certificados y dashboard** ✅ desplegado (`docs/sprints/sprint-4-certificados-dashboard.md`)

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

## Verificación de sprints 3 y 4

- Las migraciones se aplicaron en PostgreSQL aislado y la comparación con el esquema Prisma no mostró diferencias.
- El smoke HTTP del sprint 3 comprobó permisos, asistencia con códigos vigentes y duplicados concurrentes, evaluaciones, reanudación y rechazo de entregas tardías.
- El smoke HTTP del sprint 4 comprobó políticas de asistencia y evaluación, emisión automática idempotente, PDF, verificación, permisos y dashboard; el correo se simuló.
- Están pendientes la prueba de cámara en teléfono, la revisión visual del PDF con plantilla real y el envío real por Brevo. Los sprints ya están desplegados desde el 2026-11-20.

## Pendientes y deuda conocida
- Verificar en producción, con uso real: login del admin, cámara en teléfono, PDF con plantilla real y correo con Brevo.
- Al desplegar el 2026-11-20, el log del backend indicó "No pending migrations to apply": las 5 migraciones ya constaban aplicadas en la base de producción antes de ese despliegue. Se desconoce quién las aplicó; conviene confirmarlo.
- El panel de Dokploy (puerto 3000) dejó de ser accesible desde fuera el 2026-11-20; se accede por túnel SSH (`ssh -L 3000:127.0.0.1:3000`). Falta darle dominio con HTTPS y revisar el firewall.
- Sin ESLint/Prettier en el backend.
- Falta editar el propio perfil (RF-10) y editar usuarios desde el admin (RF-09 parcial).
- El correo de contacto de `/privacidad` y `/terminos` es un marcador y debe definirse.
- Autodeploy por webhook de GitHub sin configurar; los despliegues son manuales.
- El primer build en el VPS tarda unos 15 minutos.
- Dokploy muestra "Update Available" sin actualizar.
- **Seguridad:** el JSON de cliente de Google (`client_secret_*.json`) no debe subirse a git nunca. Ambos `.gitignore` lo excluyen, pero lo correcto es mantenerlo fuera de los repos y guardarlo en un gestor de contraseñas.


