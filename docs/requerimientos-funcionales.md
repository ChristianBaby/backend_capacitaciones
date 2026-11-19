# Requerimientos Funcionales — Sistema Web y Móvil de Gestión de Capacitaciones

**Proyecto:** Diseño e Implementación de un Sistema Web y Móvil para la Gestión, Seguimiento e Impacto Sostenible de Capacitaciones (Ingeniería de Software I)
**Versión:** 0.1 (borrador MVP) · **Fecha:** 2026-11-19 · **Equipo:** 1 desarrollador

---

## 1. Alcance del MVP

Esta primera entrega cubre el **MVP web**. Se prioriza lo esencial: autenticación (con Google OAuth), roles, gestión de cursos, inscripción, evaluaciones automatizadas, asistencia por QR vía web y certificados verificables.

**Fuera del MVP (Fase 2):** app móvil Flutter, geolocalización, seguimiento en tiempo real, firma digital/Blockchain, MongoDB para analítica, módulo de impacto socioeconómico avanzado.

### 1.1 Stack decidido

| Capa | Tecnología |
|---|---|
| Backend | Node.js + NestJS (TypeScript), API REST |
| ORM / BD | Prisma + PostgreSQL (en el VPS) |
| Frontend | React + TypeScript + Vite |
| Autenticación | JWT (access + refresh en cookie httpOnly) + Google OAuth 2.0 |
| Correo | Brevo (API transaccional) |
| Despliegue | VPS propio, subdominio con SSL (ej. `gestion.universoftsystems.com`) |
| Repositorios | `backend_capacitaciones`, `frontend_capacitaciones` (y a futuro `app_capacitaciones`, Flutter) |

---

## 2. Roles de usuario

| Rol | Cómo se crea la cuenta | Responsabilidad |
|---|---|---|
| **Administrador** | Semilla inicial en el servidor (usuario administrador por defecto) | Gestiona todo el sistema: instructores, cursos, eventos, QR de asistencia, certificados y dashboard de métricas |
| **Instructor** | Lo crea el administrador; recibe un código de verificación por correo | Dicta cursos asignados, crea y programa evaluaciones, ve resultados y asistencia de sus cursos |
| **Estudiante** | Se registra solo (Google o correo/contraseña). **Es el único rol con autorregistro** | Se inscribe a cursos, rinde evaluaciones, registra asistencia, descarga certificados |
| **Público (sin cuenta)** | — | Solo consulta la página de verificación de certificados vía QR |

La interfaz y las rutas se distribuyen según el rol del usuario autenticado.

---

## 3. Requerimientos funcionales

Prioridad: **M** = Must (MVP), **S** = Should (MVP si alcanza el tiempo), **F2** = Fase 2.

### Módulo 1 — Autenticación y gestión de usuarios

| ID | Requerimiento | Rol | Prior. |
|---|---|---|---|
| RF-01 | El sistema debe permitir al estudiante registrarse con correo y contraseña, con verificación del correo. | Estudiante | M |
| RF-02 | El sistema debe permitir iniciar sesión y registrarse con **Google OAuth 2.0**; si el correo no existe, se crea una cuenta de estudiante. | Estudiante | M |
| RF-03 | El sistema debe permitir iniciar sesión con correo y contraseña, y cerrar sesión. | Todos | M |
| RF-04 | El sistema debe aplicar control de acceso por rol (Admin / Instructor / Estudiante) en API y en interfaz. | Todos | M |
| RF-05 | El sistema debe permitir recuperar la contraseña mediante un enlace o código enviado al correo. | Todos | S |
| RF-06 | El administrador debe poder crear un instructor (nombre, correo, datos básicos); el sistema genera su usuario y le envía por correo un **código de verificación**. | Admin | M |
| RF-07 | El instructor debe poder ingresar la primera vez con su correo + código de verificación y **estar obligado a definir su contraseña** antes de continuar. | Instructor | M |
| RF-08 | El código de verificación debe expirar (ej. 24 h), ser de un solo uso y poder reenviarse. | Admin / Instructor | M |
| RF-09 | El administrador debe poder listar, editar, activar/desactivar usuarios y ver su rol. Un instructor no puede autoregistrarse. | Admin | M |
| RF-10 | Todo usuario debe poder ver y editar su perfil (nombre, foto, teléfono) y cambiar su contraseña. | Todos | S |
| RF-11 | El administrador debe poder gestionar sedes/zonas de capacitación (CRUD básico) y asociarlas a cursos o eventos. | Admin | S |

### Módulo 2 — Catálogo de cursos y materiales

| ID | Requerimiento | Rol | Prior. |
|---|---|---|---|
| RF-12 | El administrador debe poder crear, editar, publicar/despublicar y archivar **cursos** (título, descripción, tipo: curso / taller / conferencia, categoría, sede, fechas, cupo, estado). | Admin | M |
| RF-13 | El administrador debe poder **asignar uno o más instructores** a un curso. | Admin | M |
| RF-14 | El estudiante debe poder ver el catálogo de cursos publicados, buscar/filtrar por categoría y ver el detalle. | Estudiante | M |
| RF-15 | El estudiante debe poder **inscribirse a un curso con un clic** (respetando cupo y estado), y cancelar su inscripción. | Estudiante | M |
| RF-16 | El estudiante debe poder ver "Mis cursos" con su estado (inscrito, en curso, aprobado, certificado). | Estudiante | M |
| RF-17 | El instructor debe poder ver los cursos asignados y la lista de inscritos. | Instructor | M |
| RF-18 | El instructor debe poder organizar el curso en módulos/temario y subir materiales descargables (PDF, enlaces). | Instructor | S |
| RF-19 | El administrador debe poder categorizar cursos por competencias. | Admin | S |

### Módulo 3 — Asistencia por QR (versión web)

| ID | Requerimiento | Rol | Prior. |
|---|---|---|---|
| RF-20 | El administrador debe poder crear sesiones/fechas de un curso o evento y **generar un QR de asistencia** por sesión (con vigencia configurable). | Admin | M |
| RF-21 | El estudiante inscrito debe poder registrar su asistencia **escaneando el QR desde la web en su teléfono** (cámara del navegador) o ingresando el código de la sesión. | Estudiante | M |
| RF-22 | El sistema debe validar que el QR esté vigente, que la sesión corresponda a un curso en el que el estudiante está inscrito y evitar registros duplicados. | Sistema | M |
| RF-23 | El administrador e instructor deben poder ver la lista de asistencia por sesión y el porcentaje de asistencia por estudiante, y exportarla. | Admin / Instructor | M |
| RF-24 | El administrador/instructor debe poder registrar o corregir asistencia manualmente. | Admin / Instructor | S |
| RF-25 | Asistencia geolocalizada y seguimiento en tiempo real desde app móvil. | — | **F2** |

### Módulo 4 — Evaluaciones automatizadas

| ID | Requerimiento | Rol | Prior. |
|---|---|---|---|
| RF-26 | El instructor debe poder crear una evaluación tipo **formulario** para un curso, con preguntas de opción única, opción múltiple y verdadero/falso, cada una con puntaje y respuesta correcta. | Instructor | M |
| RF-27 | El instructor debe poder **programar** la evaluación: fecha/hora de apertura, fecha/hora de cierre y **duración máxima** en minutos. | Instructor | M |
| RF-28 | El estudiante inscrito solo debe ver y poder iniciar la evaluación dentro de la ventana programada. | Estudiante | M |
| RF-29 | Al iniciar, el sistema registra el inicio del intento y controla el tiempo **en el servidor**; el estudiante ve un cronómetro. | Sistema | M |
| RF-30 | Las respuestas enviadas **fuera de plazo** (vencido el tiempo del intento o cerrada la ventana) **no cuentan**; el sistema debe rechazarlas o calificarlas como no válidas. | Sistema | M |
| RF-31 | El sistema debe **calificar automáticamente** el intento y mostrar la nota al estudiante (según política de la evaluación). | Sistema | M |
| RF-32 | El instructor debe poder definir nota mínima de aprobación y número de intentos permitidos (por defecto 1). | Instructor | S |
| RF-33 | El instructor/admin debe poder ver resultados por estudiante y estadísticas básicas (promedio, aprobados/desaprobados). | Instructor / Admin | M |
| RF-34 | El estudiante debe poder ver su historial de evaluaciones y notas. | Estudiante | M |

### Módulo 5 — Certificados verificables

| ID | Requerimiento | Rol | Prior. |
|---|---|---|---|
| RF-35 | El administrador debe poder subir una **plantilla de certificado desde una imagen** (PNG/JPG) y definir la posición de los campos (nombre, curso, fecha, código, QR). | Admin | M |
| RF-36 | El sistema debe generar el certificado (PDF/imagen) sobre la plantilla con los datos del estudiante y un **código QR único**. | Sistema | M |
| RF-37 | El QR debe apuntar a una **página pública de verificación** que muestre: titular, curso/evento, fecha, estado (válido/revocado) y código. No requiere sesión. | Público | M |
| RF-38 | El certificado debe emitirse cuando el estudiante cumpla las condiciones del curso (aprobar evaluación y/o asistencia mínima, configurable) o por emisión manual del administrador. | Sistema / Admin | M |
| RF-39 | El sistema debe **enviar el certificado por correo** al estudiante y permitirle descargarlo desde su cuenta. | Sistema / Estudiante | M |
| RF-40 | El administrador debe poder revocar o reemitir un certificado; el estado se refleja en la página pública. | Admin | S |
| RF-41 | Firma digital avanzada / Blockchain. | — | **F2** |

### Módulo 6 — Dashboard y métricas (Admin)

| ID | Requerimiento | Rol | Prior. |
|---|---|---|---|
| RF-42 | El administrador debe contar con un dashboard con KPIs: total de usuarios por rol, cursos activos, inscripciones, tasa de asistencia, tasa de aprobación y certificados emitidos. | Admin | M |
| RF-43 | El dashboard debe mostrar gráficos por período, curso, instructor y sede (filtros por fecha). | Admin | S |
| RF-44 | El administrador debe poder exportar reportes (CSV/Excel) de inscritos, asistencia y notas. | Admin | S |
| RF-45 | Indicadores de impacto social, económico y ambiental. | — | **F2** |

### Módulo 7 — Notificaciones por correo

| ID | Requerimiento | Rol | Prior. |
|---|---|---|---|
| RF-46 | El sistema debe enviar correos transaccionales (Brevo) para: verificación de cuenta, código de instructor, recuperación de contraseña, confirmación de inscripción, aviso de evaluación programada y certificado emitido. | Sistema | M |
| RF-47 | Notificaciones push de inicio de clases e inasistencias. | — | **F2** |

### Módulo 8 — App móvil (Fase 2, solo análisis)

| ID | Requerimiento | Prior. |
|---|---|---|
| RF-48 | App Flutter para estudiantes: consulta de inscripciones, escaneo de QR con cámara nativa, descarga de certificados. | F2 |
| RF-49 | Asistencia con geolocalización validando que el estudiante esté dentro del radio de la sede. | F2 |
| RF-50 | Seguimiento en tiempo real de asistencia (WebSocket / SSE). | F2 |

---

## 4. Requisitos no funcionales (esenciales para el MVP)

- **Seguridad:** contraseñas con hash (bcrypt/argon2), JWT con refresco, cookies httpOnly, HTTPS, validación de entradas, límite de intentos (rate limiting), secretos solo en variables de entorno.
- **Integridad del examen:** el tiempo y la ventana de la evaluación se validan siempre en el servidor, nunca solo en el cliente.
- **Privacidad:** tratamiento de datos acorde con la LPDP; la página pública de certificados solo muestra los datos mínimos necesarios.
- **Rendimiento:** respuestas típicas < 2 s con la carga esperada de un MVP.
- **Usabilidad:** interfaz responsive (usable desde celular, indispensable para el escaneo QR), paleta basada en el logo UNSAAC.
- **Mantenibilidad:** TypeScript en todo el stack, migraciones Prisma versionadas, documentación en `docs/` de cada repositorio.

---

## 5. Modelo de datos inicial (resumen)

`User` (rol, estado, proveedor de auth) · `InstructorInvite/VerificationCode` · `Sede` · `Course` · `CourseInstructor` · `Module/Material` · `Enrollment` · `Session` (con QR) · `Attendance` · `Exam` · `Question/Option` · `ExamAttempt` · `Answer` · `CertificateTemplate` · `Certificate` · `EmailLog`.

---

## 6. Plan de entrega sugerido (MVP)

1. **Sprint 1 — Fundaciones:** repos, Prisma + PostgreSQL en VPS, usuario admin semilla, auth (correo + Google), roles, flujo de instructor con código por correo.
2. **Sprint 2 — Cursos e inscripción:** CRUD de cursos, asignación de instructores, catálogo e inscripción del estudiante.
3. **Sprint 3 — Evaluaciones y asistencia QR.**
4. **Sprint 4 — Certificados (plantilla + QR + verificación pública + correo) y dashboard.**

---

## 7. Supuestos y pendientes por confirmar

1. "El admin inscribe a los instructores" se interpreta como **asignar instructores a cursos**.
2. Alcance de la autenticación: Google OAuth disponible para **estudiantes**; admin e instructor usan correo + contraseña.
3. Credenciales pendientes: Client ID/Secret de Google OAuth, API key de Brevo, remitente verificado en Brevo, acceso SSH al VPS y registro DNS del subdominio.
4. Condición de emisión del certificado (nota mínima y/o asistencia mínima) por definir con el cliente/docente.
5. La paleta de colores se obtiene del logo UNSAAC (carmesí, dorado y azul); los valores exactos se afinan en la implementación.
