# Sprint 2 — Cursos e inscripción

**Fecha:** 2026-11-19 · **Alcance:** RF-12 a RF-17 y confirmación de inscripción del RF-46. El despliegue y las verificaciones ejecutadas se registran en [estado del proyecto](../estado-del-proyecto.md).

El administrador prepara y publica la oferta de capacitación; el estudiante encuentra un curso y se inscribe; el instructor consulta sus cursos y sus inscritos. El sprint reutiliza la autenticación y los permisos del sprint 1.

## Entregables y aceptación

| RF | Entregable | Criterio de aceptación |
|---|---|---|
| RF-12 | Gestión de cursos | El administrador crea y edita título, descripción, tipo, categoría, sede, fechas y cupo; publica, despublica y archiva. Un estudiante no puede modificar cursos. |
| RF-13 | Asignación de instructores | Un curso acepta varios instructores activos; la selección se puede reemplazar y rechaza usuarios de otros roles. |
| RF-14 | Catálogo y detalle | El estudiante busca y filtra por categoría entre cursos publicados; los borradores y archivados no aparecen. |
| RF-15 | Inscripción y cancelación | Se respeta el cupo, la publicación y la fecha de inicio; no hay duplicados. Cancelar libera el cupo y permite reinscribir cuando se cumplen las condiciones. |
| RF-16 | Mis cursos | El estudiante consulta sus inscripciones y su estado. Inscrito, en curso y finalizado se presentan según inscripción y fechas. |
| RF-17 | Cursos del instructor | Cada instructor ve sus cursos asignados y la lista de inscritos activos; otro instructor no accede a esa lista. |
| RF-46, parcial | Confirmación por correo | Se intenta enviar la confirmación; si falla, se informa y la inscripción permanece registrada. |

## Decisiones de este sprint

- La sede y la categoría se registran como texto en cada curso. El CRUD de sedes del RF-11 queda pendiente.
- La inscripción cierra al comenzar el curso; la cancelación permanece disponible hasta su término. Las fechas y cupos se validan en el servidor.
- Despublicar o archivar conserva las inscripciones existentes. Un alumno inscrito mantiene acceso al detalle del curso.
- El archivo sustituye al borrado físico para conservar el historial.
- La aprobación y certificación de RF-16 dependen de los sprints 3 y 4; este sprint no inventa notas ni certificados.
- Los opcionales RF-18 (temario y materiales) y RF-19 (competencias) quedan pendientes para priorizar el flujo obligatorio.

## Verificación

La comprobación central es crear, publicar, asignar, inscribir y consultar el listado del instructor. Debe comprobarse además la cancelación y que tres solicitudes simultáneas por un único cupo produzcan una sola inscripción.

| Capa | Comando desde su repositorio | Alcance |
|---|---|---|
| Backend | `npm test -- --runInBand` | Pruebas de autenticación y reglas del dominio. |
| Backend | `npm run build` | Generación Prisma y compilación NestJS. |
| Integración | `npm run test:integration` | Compila y comprueba HTTP y PostgreSQL reales en una base local aislada; requiere migraciones aplicadas. |
| Frontend | `npm test` | Interacciones y controles de la interfaz. |
| Frontend | `npm run build` y `npm run lint` | Tipos, compilación y reglas del código. |

**Evidencia local del 2026-11-19:** se aplicaron las migraciones inicial y del sprint 2 en PostgreSQL 18 aislado. `node scripts/sprint2-smoke.cjs`, después del build, terminó con código 0 y **33 verificaciones satisfactorias**, incluidas tres solicitudes simultáneas por un único cupo, controles de rol, cuentas pendientes, cambio de contraseña obligatorio, datos inválidos y fallo del correo. El script limpió sus usuarios, cursos e inscripciones temporales.

El backend reportó **80 pruebas en 7 suites** y compilación correctas. El frontend reportó **28 pruebas en 7 archivos**, compilación y lint correctos. No se completó una revisión visual en navegador en este entorno; debe verificarse al desplegar. Consultar el estado de publicación en el estado del proyecto.

## Puesta en marcha

Aplicar la migración del sprint 2 antes de iniciar la versión nueva del backend. Después, publicar el frontend compatible y verificar el flujo con cuentas de administrador, instructor y estudiante. El contrato y los errores de la API están en [api-courses.md](../api-courses.md).
