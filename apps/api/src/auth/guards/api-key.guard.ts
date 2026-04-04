import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const apiKey = request.headers['x-api-key'];
    const expected = this.config.get<string>('SCRAPER_API_KEY');

    if (!expected) {
      throw new UnauthorizedException('SCRAPER_API_KEY is not configured');
    }

    if (!apiKey || apiKey !== expected) {
      throw new UnauthorizedException('Invalid API key');
    }

    return true;
  }
}
