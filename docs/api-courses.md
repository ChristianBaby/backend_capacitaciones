# API de cursos e inscripción — Sprint 2

La API permite publicar cursos, asignar instructores y gestionar la inscripción del estudiante. Todas las rutas usan el prefijo `/api` y las cookies de sesión del sprint 1. Las fechas se reciben y devuelven como ISO 8601 con zona horaria.

## Flujo principal

1. El administrador crea un curso con `POST /courses` y asigna `instructorIds`.
2. Publica con `PATCH /courses/:id`, enviando `{ "status": "PUBLISHED" }`.
3. El estudiante consulta `GET /courses` y se inscribe con `POST /courses/:id/enrollments`.
4. El instructor asignado consulta `GET /courses/:id/enrollments`.

## Endpoints

| Método y ruta | Acceso | Respuesta |
|---|---|---|
| `GET /courses` | Los tres roles; visibilidad según rol | Página de cursos |
| `GET /courses/:id` | Según visibilidad del curso | Curso |
| `POST /courses` | ADMIN | Curso creado, HTTP 201 |
| `PATCH /courses/:id` | ADMIN | Curso actualizado |
| `POST /courses/:id/enrollments` | STUDENT | `{ enrollment, emailSent }`, HTTP 201 |
| `DELETE /courses/:id/enrollments/me` | STUDENT | `{ message }` |
| `GET /enrollments/me` | STUDENT | Página de inscripciones propias con `course` |
| `GET /courses/:id/enrollments` | ADMIN o INSTRUCTOR asignado | Página de inscripciones activas con `student` |

Las páginas devuelven `{ items, total, page, limit }` y aceptan `page` (predeterminado 1) y `limit` (predeterminado 20, máximo 100). El listado de cursos acepta además `q`, `category` y `status`; el filtro no amplía los permisos del rol. La categoría coincide por texto completo sin distinguir mayúsculas; `q` busca en título y descripción.

## Crear o editar un curso

```json
{
  "title": "Introducción a la programación",
  "description": "Fundamentos y ejercicios prácticos.",
  "type": "COURSE",
  "category": "Tecnología",
  "venue": "Sede Cusco",
  "startsAt": "2026-12-01T14:00:00.000Z",
  "endsAt": "2026-12-05T18:00:00.000Z",
  "capacity": 30,
  "status": "DRAFT",
  "instructorIds": ["uuid-del-instructor"]
}
```

`PATCH` acepta los campos que se desean cambiar. `instructorIds` reemplaza la asignación completa. `type` admite `COURSE`, `WORKSHOP` y `CONFERENCE`; `status` admite `DRAFT`, `PUBLISHED` y `ARCHIVED`. La categoría y la sede son texto; el CRUD de sedes corresponde al RF-11 pendiente.

La respuesta agrega `id`, `createdAt`, `updatedAt`, `instructors: [{ id, name }]`, `enrollmentCount`, `availableSeats` y `myEnrollment`. Este último es `null` o `{ id, status, enrolledAt, cancelledAt }`; los estados de inscripción son `ENROLLED` y `CANCELLED`.

En `GET /enrollments/me`, cada elemento contiene los datos de inscripción y `course`. En la lista de inscritos, cada elemento contiene los datos de inscripción y `student: { id, name, email }`. No se exponen contraseñas ni tokens.

## Reglas y permisos

| Caso | Comportamiento |
|---|---|
| Administrador | Consulta y gestiona todos los cursos. |
| Instructor | Consulta sus cursos asignados y sus inscritos activos. |
| Catálogo del estudiante | Muestra cursos publicados. |
| Curso despublicado o archivado | Un estudiante con inscripción activa conserva acceso al detalle desde Mis cursos. |
| Nueva inscripción | Requiere curso publicado, cupo disponible y fecha anterior al inicio. |
| Cancelación | Permitida antes del término, incluso si el curso se despublicó o archivó; libera el cupo. |
| Reinscripción | Reutiliza el registro cancelado y vuelve a validar cupo, estado y fecha. |
| Cupos simultáneos | La transacción bloquea el curso para impedir sobreinscripción. Las ediciones de capacidad usan la misma protección. |
| Editar capacidad | No puede quedar por debajo del número de inscripciones activas. |
| Fechas | El término debe ser posterior al inicio. |
| Asignar instructores | Solo usuarios activos con rol INSTRUCTOR. |
| Correo de confirmación | Se intenta después de confirmar la inscripción. Un fallo de correo conserva la inscripción y devuelve `emailSent: false`. |

`emailSent: true` indica que el proveedor aceptó el envío, no que el destinatario lo abrió. Sin configuración de Brevo, el modo local puede registrar el mensaje, pero devuelve `false`.

## Errores esperados

| HTTP | Situación |
|---|---|
| 400 | Datos inválidos, instructor no válido, fechas incoherentes o inscripción fuera de las condiciones permitidas. |
| 401 | Sesión ausente o inválida. |
| 403 | Rol sin permiso para la operación. |
| 404 | Curso inexistente o fuera del acceso del usuario. |
| 409 | Cupo agotado, inscripción ya activa o reducción de capacidad bajo inscritos activos. |

La interfaz debe mostrar el mensaje devuelto por la API y actualizar sus listados después de una inscripción, cancelación o edición. La API valida las reglas aunque el cliente omita sus controles.

## Verificación reproducible

Después de aplicar las migraciones a una base PostgreSQL local aislada cuyo nombre incluya `sprint2` y `smoke` o `test`:

```powershell
$env:DATABASE_URL = 'postgresql://usuario:clave@127.0.0.1:5432/sprint2_smoke'
npm run db:deploy
npm run test:integration
```

El comando compila y ejecuta `scripts/sprint2-smoke.cjs`. El script usa HTTP y PostgreSQL reales, crea usuarios temporales, simula únicamente el transporte de correo y elimina sus propios registros al terminar. Comprueba roles, cuentas pendientes, cambio de contraseña obligatorio, visibilidad, asignación, inscripción, cancelación, reinscripción, fallos del correo y competencia por el último cupo. Rechaza una URL remota o un nombre de base que no corresponda al entorno de prueba.
