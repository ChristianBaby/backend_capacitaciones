# API de autenticacion (Sprint 1)

Base: `/api` (puerto por defecto `3001`). Todo es JSON. Errores: `{ "statusCode", "message", "error" }` (`message` siempre es texto).

## Sesion por cookies

| Cookie | Contenido | Duracion |
|---|---|---|
| `access_token` | JWT de acceso | 15 min |
| `refresh_token` | JWT de refresco (rotado en cada `refresh`, guardado hasheado) | 7 dias |

Ambas: `httpOnly`, `SameSite=Lax`, `Secure` si `NODE_ENV=production`, `path=/`. El frontend debe usar `credentials: 'include'`. CORS permite `FRONTEND_URL` con credenciales.

Usuario publico: `{ id, email, name, role: ADMIN|INSTRUCTOR|STUDENT, status: ACTIVE|PENDING|DISABLED, avatarUrl, mustChangePassword }`.

## Endpoints

| Metodo y ruta | Body | Respuesta |
|---|---|---|
| POST `/auth/register` | `{name,email,password(min 8)}` | 201 `{message}`. Crea STUDENT `PENDING` y envia codigo de 6 digitos (15 min). Misma respuesta si el correo ya existe. |
| POST `/auth/verify-email` | `{email,code}` | 200 + cookies, devuelve el usuario. |
| POST `/auth/resend-code` | `{email,purpose?}` | 200 siempre. Cooldown de 60 s por proposito. |
| POST `/auth/login` | `{email,password}` | 200 + cookies, `{user}`. Credenciales malas: 401 generico. `PENDING`/`DISABLED`: 403 con mensaje. Si `mustChangePassword` es true el login igual funciona. |
| POST `/auth/refresh` | - | 200 + cookies nuevas, `{user}`. Reusar un refresh ya rotado cierra todas las sesiones del usuario. |
| POST `/auth/logout` | - | 200, limpia cookies y revoca el refresh. |
| GET `/auth/me` | - | Usuario publico (401 sin sesion). |
| POST `/auth/forgot-password` | `{email}` | 200 siempre; envia codigo `PASSWORD_RESET` (15 min). |
| POST `/auth/reset-password` | `{email,code,newPassword}` | 200. Revoca sesiones. |
| POST `/auth/change-password` | `{currentPassword?,newPassword}` | 200 (requiere sesion). `currentPassword` es opcional solo si `mustChangePassword`; limpia el flag. |
| GET `/auth/google` | - | Redirige a Google. |
| GET `/auth/google/callback` | - | Exito: cookies + redireccion a `${FRONTEND_URL}/auth/callback`. Fallo: `${FRONTEND_URL}/login?error=google`. |
| POST `/auth/instructor/activate` | `{email,code,newPassword}` | 200 + cookies, `{user}`. Codigo `INSTRUCTOR_INVITE`: 24 h, un solo uso. |
| GET `/health` | - | `{status:'ok'}` |

Reglas de codigos: 6 digitos, guardados con bcrypt, un solo uso, maximo 5 intentos, un codigo nuevo invalida el anterior. Cualquier fallo responde `400 "Código inválido o expirado"`.

Google: solo crea STUDENT `ACTIVE`. Si el correo es de ADMIN/INSTRUCTOR activo se vincula `googleId` y se inicia sesion. Un instructor `PENDING` debe activarse con su codigo (Google lo rechaza). Una cuenta de estudiante `PENDING` que entra por Google queda activa y se descarta la contrasena previa.

### Admin (cookie de ADMIN; otros roles reciben 403)

| Metodo y ruta | Descripcion |
|---|---|
| POST `/admin/instructors` `{name,email,phone?}` | 201 `{user,emailSent}`. Crea INSTRUCTOR `PENDING` (`mustChangePassword`), envia codigo por correo (nunca en la respuesta). 409 si el correo existe. |
| POST `/admin/instructors/:id/resend-invite` | 200 `{message,emailSent}`. Solo instructores `PENDING`. |
| GET `/admin/users?role=&status=&q=&page=&limit=` | `{items,total,page,limit}` (limit max 100, por defecto 20). `q` busca en nombre y correo. |
| PATCH `/admin/users/:id/status` `{status:'ACTIVE'\|'DISABLED'}` | No se puede deshabilitar a si mismo ni cambiar usuarios `PENDING`. Deshabilitar revoca sus refresh tokens. |

Rate limit: 20 solicitudes/min por IP en `/auth/*` (HTTP 429).

## Variables de entorno

Ver `.env.example`: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `FRONTEND_URL`, `PORT`, `NODE_ENV`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL`, `BREVO_API_KEY`, `MAIL_FROM_EMAIL`, `MAIL_FROM_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `ADMIN_NAME`.

Sin `BREVO_API_KEY` los correos (y sus codigos) se imprimen en consola, excepto con `NODE_ENV=production`, donde nunca se registran codigos.
