import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';

@Injectable()
export class SuperAdminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new UnauthorizedException('Authentication required');
    }

    const superAdminEmail = process.env.ADMIN_EMAIL;
    if (!superAdminEmail || user.email !== superAdminEmail) {
      throw new ForbiddenException('Only the primary admin can manage roles');
    }

    return true;
  }
}
