import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

const SUPER_ADMIN_EMAIL = 'jim.okonma@gmail.com';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.email !== SUPER_ADMIN_EMAIL) {
      throw new ForbiddenException('Only the primary admin can manage roles');
    }

    return true;
  }
}
