import { randomUUID } from 'crypto';

type Row = Record<string, any>;

function matches(row: Row, where: Row = {}): boolean {
  return Object.entries(where).every(([k, v]) => {
    if (v === null) return row[k] === null || row[k] === undefined;
    return row[k] === v;
  });
}

class FakeTable {
  rows: Row[] = [];
  constructor(
    private readonly defaults: () => Row,
    private readonly uniques: string[] = [],
  ) {}

  private apply(row: Row, data: Row) {
    for (const [k, v] of Object.entries(data)) {
      if (v && typeof v === 'object' && !(v instanceof Date) && 'increment' in v) row[k] = (row[k] ?? 0) + v.increment;
      else row[k] = v;
    }
    row.updatedAt = new Date();
  }

  async create({ data }: { data: Row }) {
    const row = { id: randomUUID(), createdAt: new Date(), ...this.defaults(), ...data };
    for (const u of this.uniques) {
      if (row[u] != null && this.rows.some((r) => r[u] === row[u])) throw new Error(`Unique constraint on ${u}`);
    }
    this.rows.push(row);
    return { ...row };
  }

  async findUnique({ where }: { where: Row }) {
    const r = this.rows.find((x) => matches(x, where));
    return r ? { ...r } : null;
  }

  async findFirst({ where, orderBy }: { where?: Row; orderBy?: Row } = {}) {
    let list = this.rows.filter((x) => matches(x, where));
    if (orderBy?.createdAt === 'desc') list = [...list].sort((a, b) => b.createdAt - a.createdAt);
    return list[0] ? { ...list[0] } : null;
  }

  async update({ where, data }: { where: Row; data: Row }) {
    const r = this.rows.find((x) => matches(x, where));
    if (!r) throw new Error('Record not found');
    this.apply(r, data);
    return { ...r };
  }

  async updateMany({ where, data }: { where?: Row; data: Row }) {
    const list = this.rows.filter((x) => matches(x, where));
    list.forEach((r) => this.apply(r, data));
    return { count: list.length };
  }
}

/** Prisma en memoria con solo las operaciones que usa el modulo de auth (para pruebas unitarias). */
export function createFakePrisma() {
  return {
    user: new FakeTable(
      () => ({
        passwordHash: null,
        role: 'STUDENT',
        status: 'PENDING',
        googleId: null,
        emailVerified: false,
        mustChangePassword: false,
        avatarUrl: null,
        phone: null,
        updatedAt: new Date(),
      }),
      ['email', 'googleId'],
    ),
    verificationCode: new FakeTable(() => ({ usedAt: null, attempts: 0 })),
    refreshToken: new FakeTable(() => ({ revokedAt: null }), ['tokenHash']),
  };
}

export type FakePrisma = ReturnType<typeof createFakePrisma>;
