import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class GuestService {
  private readonly logger = new Logger(GuestService.name);

  constructor(private readonly prisma: PrismaService) {}

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async cleanupAbandonedGuests(): Promise<void> {
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const { count } = await this.prisma.user.deleteMany({
      where: { isGuest: true, createdAt: { lt: cutoff } },
    });
    if (count > 0)
      this.logger.log(`Deleted ${count} abandoned guest account(s)`);
  }
}
