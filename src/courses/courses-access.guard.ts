import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

@Injectable()
export class CoursesAccessGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const user = context.switchToHttp().getRequest().user;
    if (!user || user.status !== 'ACTIVE' || user.mustChangePassword) {
      throw new ForbiddenException('Activa tu cuenta y completa el cambio de contraseña para continuar');
    }
    return true;
  }
}
