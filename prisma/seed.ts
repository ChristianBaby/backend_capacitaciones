import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { PrismaClient } from '../src/generated/prisma/client';

async function main() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;
  const name = process.env.ADMIN_NAME?.trim() || 'Administrador';

  if (!password) {
    console.error('ADMIN_PASSWORD no esta definido; el seed no se ejecutara.');
    process.exit(1);
  }
  if (!email) {
    console.error('ADMIN_EMAIL no esta definido; el seed no se ejecutara.');
    process.exit(1);
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  try {
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`Seed: el usuario ${email} ya existe; no se modifica.`);
      return;
    }
    await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await bcrypt.hash(password, 12),
        role: 'ADMIN',
        status: 'ACTIVE',
        emailVerified: true,
        mustChangePassword: false,
      },
    });
    console.log(`Seed: administrador ${email} creado.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seed fallo:', err);
  process.exit(1);
});
