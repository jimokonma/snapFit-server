import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

const ADMIN_EMAIL = 'jim.okonma@gmail.com';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    if (user.email !== ADMIN_EMAIL) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
