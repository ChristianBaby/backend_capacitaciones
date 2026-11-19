#!/bin/sh
set -eu

if [ -z "${DATABASE_URL:-}" ]; then
  echo "FATAL: DATABASE_URL no definida" >&2
  exit 1
fi

echo "Aplicando migraciones de Prisma..."
npx prisma migrate deploy

if [ -z "${ADMIN_PASSWORD:-}" ]; then
  echo "AVISO: ADMIN_PASSWORD no definida; se omite el seed del administrador." >&2
else
  echo "Ejecutando seed del administrador..."
  npx tsx prisma/seed.ts
fi

echo "Iniciando NestJS..."
exec node dist/main.js
