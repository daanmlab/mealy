import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { GuestService } from './guest.service';

@Module({
  imports: [PrismaModule],
  providers: [GuestService],
})
export class GuestModule {}
