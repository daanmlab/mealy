import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const expected = this.config.get<string>('INTERNAL_API_KEY');

    // If INTERNAL_API_KEY is not configured, skip the check (development mode).
    if (!expected) return true;

    const key = request.headers['x-internal-api-key'];
    if (!key || key !== expected) {
      throw new UnauthorizedException('Invalid internal API key');
    }

    return true;
  }
}
