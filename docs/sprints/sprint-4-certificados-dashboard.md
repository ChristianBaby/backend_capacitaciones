# Sprint 4 — Certificados verificables y dashboard

El administrador configura una plantilla PNG o JPEG, emite certificados manualmente o establece condiciones automáticas por curso, y consulta indicadores del sistema. Los estudiantes descargan su PDF; el QR enlaza con una verificación pública.

## Flujo y reglas

1. Crear una plantilla con la ubicación del nombre, curso, fecha, código y QR. La imagen y los PDF emitidos se guardan en PostgreSQL.
2. Emitir manualmente a un estudiante con inscripción activa o configurar una política con evaluación aprobada y/o porcentaje mínimo de asistencia.
3. El proceso automático revisa cada minuto los cursos finalizados y emite a los estudiantes que cumplan la política. Una restricción única impide duplicar certificados por curso y estudiante.
4. El PDF incluye un QR que abre la página pública de verificación. El administrador puede revocar el certificado y la página refleja su estado.
5. Se intenta enviar el PDF adjunto por correo. Si el envío falla, la emisión se conserva y el estudiante puede descargarlo.

Las tasas del dashboard consideran inscripciones activas, asistencias y evaluaciones enviadas; las fórmulas y el contrato se describen en [API de certificados](../api-certificates.md). La actualización de la política requiere una plantilla existente; el proceso automático funciona mientras la API está activa.

## Verificación

- Backend: `npm run build`, `node node_modules/jest/bin/jest.js --runInBand`.
- Frontend: `npm run build`, `npm run lint`, `npm test`.
- En PostgreSQL local aislado, aplicar migraciones y ejecutar `node scripts/sprint4-smoke.cjs`. La prueba simula el correo, comprueba permisos, PDF, verificación, dashboard, elegibilidad y emisión automática idempotente.
- Pendiente: revisión visual del PDF con una plantilla real, envío real mediante Brevo y despliegue.
