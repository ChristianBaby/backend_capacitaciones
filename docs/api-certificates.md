# API de certificados y dashboard

Las rutas usan prefijo `/api`. Salvo verificación pública, requieren sesión activa y rol indicado.

| Método y ruta | Acceso | Uso |
|---|---|---|
| GET /certificates/templates | ADMIN | Plantillas con imagen y posiciones |
| POST /certificates/templates | ADMIN | Crea plantilla `{name,imageData,fields}` |
| GET /certificates/policies/:courseId | ADMIN | Política o `null` |
| PUT /certificates/policies/:courseId | ADMIN | Guarda `{templateId,requireExam,minimumAttendance}` |
| POST /certificates/issue | ADMIN | Emite `{courseId,studentId,templateId,manual:true}` y devuelve `{certificate,emailSent}` |
| GET /certificates?courseId= | ADMIN | Certificados emitidos |
| PATCH /certificates/:id/revoke | ADMIN | Revoca certificado |
| GET /certificates/mine | STUDENT | Certificados propios |
| GET /certificates/:id/download | ADMIN o titular | PDF descargable |
| GET /certificates/verify/:code | Público | `{name,course,date,status,code}` |
| GET /dashboard | ADMIN | Usuarios por rol, cursos publicados, inscripciones activas, tasas y certificados válidos |

La plantilla admite PNG o JPEG (data URL) de hasta 2 500 000 bytes decodificados. `fields` contiene `name`, `course`, `date`, `code` y `qr`, cada uno con `{x,y,size}`. `x` e `y` son porcentajes desde la esquina superior izquierda; tamaño de texto en puntos PDF y QR en porcentaje del lado menor de la imagen. El código QR abre `/verificar/:code` del `FRONTEND_URL` configurado. Una plantilla y el PDF emitido se almacenan en PostgreSQL.

La política automática se ejecuta cada minuto mientras la API esté activa, para cursos terminados. Si `requireExam` es verdadero se requiere al menos una evaluación aprobada en ese curso; `minimumAttendance` es un porcentaje entre 0 y 100 y, si es mayor a cero, exige al menos una sesión. Solo se emite a estudiantes con inscripción activa. La restricción única de curso y estudiante evita duplicados; si un correo falla, el certificado permanece disponible para descarga y no se reenvía automáticamente. La emisión manual requiere inscripción activa y omite las condiciones de la política.

Las tasas del dashboard son asistencia registrada sobre oportunidades de asistencia de estudiantes actualmente inscritos, y evaluaciones aprobadas sobre intentos enviados. Sin denominador se informa cero. Los certificados revocados no se cuentan como válidos.
