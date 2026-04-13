import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { ImportJobProcessor } from './import-job.processor';
import { RecipesModule } from '../recipes/recipes.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [
    PrismaModule,
    RecipesModule,
    CatalogModule,
    BullModule.registerQueue({ name: 'import' }),
  ],
  controllers: [AdminController],
  providers: [AdminService, ImportJobProcessor],
})
export class AdminModule {}
