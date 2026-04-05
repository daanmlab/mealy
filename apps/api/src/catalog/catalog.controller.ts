import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiKeyGuard } from '../auth/guards/api-key.guard';
import { CatalogService } from './catalog.service';

@Controller('catalog')
@UseGuards(ApiKeyGuard)
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get()
  get() {
    return this.catalog.getCatalog();
  }
}
