import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TokenCleanupService {
  private readonly logger = new Logger(TokenCleanupService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupExpiredTokens() {
    const { count } = await this.prisma.refreshToken.deleteMany({
      where: {
        OR: [{ revoked: true }, { expiresAt: { lt: new Date() } }],
      },
    });
    if (count > 0) {
      this.logger.log(`Cleaned up ${count} expired/revoked refresh token(s)`);
    }
  }
}
