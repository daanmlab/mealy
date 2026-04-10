import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { RecipesModule } from '../recipes/recipes.module';
import { CatalogModule } from '../catalog/catalog.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, RecipesModule, CatalogModule],
  controllers: [AdminController],
  providers: [AdminService],
})
export class AdminModule {}
