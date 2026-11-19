import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { ACCESS_COOKIE } from '../cookies';
import { toPublicUser } from '../user.mapper';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const token = req.cookies?.[ACCESS_COOKIE];
    if (!token) throw new UnauthorizedException('No autenticado');

    let payload: { sub: string };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: process.env.JWT_ACCESS_SECRET });
    } catch {
      throw new UnauthorizedException('Sesión inválida o expirada');
    }

    const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
    if (!user || user.status === 'DISABLED') throw new UnauthorizedException('Sesión inválida o expirada');

    req.user = toPublicUser(user);
    return true;
  }
}
