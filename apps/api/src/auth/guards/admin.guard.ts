import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { User } from '@prisma/client';

@Injectable()
export class AdminGuard extends AuthGuard('jwt') implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    await super.canActivate(context);

    const request = context.switchToHttp().getRequest<{ user?: User }>();
    if (!request.user) {
      throw new UnauthorizedException();
    }
    if (!request.user.isAdmin) {
      throw new ForbiddenException('Admin access required');
    }

    return true;
  }
}
