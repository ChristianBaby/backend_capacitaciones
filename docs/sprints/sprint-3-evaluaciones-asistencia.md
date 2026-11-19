# Sprint 3 — Evaluaciones y asistencia QR

El instructor crea evaluaciones para sus cursos asignados; el estudiante inscrito rinde una evaluación dentro del plazo validado por el servidor. El administrador crea sesiones y genera códigos QR para registrar asistencia.

## Flujo de evaluación

1. El instructor asignado crea una evaluación con preguntas de opción única, múltiple o verdadero/falso, puntajes, ventana y duración.
2. El estudiante inscrito inicia el intento durante la ventana. Puede reabrirlo con el mismo plazo; las respuestas seleccionadas en el navegador no se guardan hasta el envío.
3. El servidor rechaza envíos vencidos, califica y registra las respuestas. El estudiante ve su nota e historial; el instructor o administrador ve resultados agregados.

Se permite un intento por estudiante y evaluación. Las respuestas correctas no se entregan al estudiante durante el intento. El porcentaje de aprobación se define en la evaluación. La edición posterior de evaluaciones y los múltiples intentos no están disponibles.

## Flujo de asistencia

1. El administrador crea una sesión y genera un código QR con vigencia configurable. Generar otro código invalida el anterior.
2. El estudiante inscrito escanea con la cámara del navegador o introduce el código.
3. El servidor valida vigencia, inscripción y duplicados. El instructor asignado y el administrador consultan asistencia y porcentajes, y exportan CSV.

El acceso a cámara requiere navegador compatible, HTTPS o localhost y permiso del usuario. Las sesiones programadas cuentan en el denominador del porcentaje.

## Verificación local

- `node node_modules/jest/bin/jest.js --runInBand`: 94 pruebas aprobadas (9 suites).
- Frontend: `npm run build`, `npm run lint`, `npm test`; consultar el resultado de la ejecución más reciente.
- Migraciones aplicadas desde cero a PostgreSQL 18 aislado, con `prisma migrate diff` sin diferencias.
- `node scripts/sprint3-smoke.cjs` tras compilar y configurar `DATABASE_URL` para una base local aislada cuyo nombre incluya `sprint2` y `smoke`/`test`: verificados códigos vencidos y rotados, duplicación concurrente, permisos, calificación, reanudación y rechazo de entrega tardía. La prueba crea y limpia sus propios datos.
- Falta verificación visual integrada y prueba de cámara en un teléfono; no se ha probado el envío real de correos ni se ha desplegado.
