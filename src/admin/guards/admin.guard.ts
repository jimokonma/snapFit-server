import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class AdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    if (user.role !== 'admin' && (!adminEmail || user.email !== adminEmail)) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
