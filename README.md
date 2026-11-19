# backend_capacitaciones

API (NestJS + Prisma 7 + PostgreSQL) del sistema de gestion de capacitaciones. Sprint 1: autenticacion, roles y gestion de instructores. Contrato en [docs/api-auth.md](docs/api-auth.md).

## Desarrollo local

```bash
npm ci
cp .env.example .env        # completar DATABASE_URL, secretos JWT y ADMIN_PASSWORD
npx prisma migrate dev      # aplica migraciones a tu base local
npm run db:seed             # crea el ADMIN desde ADMIN_EMAIL / ADMIN_PASSWORD (idempotente)
npm run start:dev           # http://localhost:3001/api/health
```

Sin `BREVO_API_KEY`, los correos y codigos se imprimen en la consola.

## Scripts

- `npm run build` genera el cliente Prisma y compila.
- `npm test` ejecuta las pruebas (Prisma simulado en memoria; no requieren base de datos).
- `npm run db:deploy` aplica migraciones; `npm run db:seed` ejecuta el seed.

## Docker

La imagen ejecuta `prisma migrate deploy`, el seed (si hay `ADMIN_PASSWORD`) y arranca en el puerto `3001`. Pensada para correr detras de Traefik (`trust proxy` activo). Nunca incluyas `.env` en la imagen: define las variables en el entorno de despliegue.
