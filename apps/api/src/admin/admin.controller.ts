import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import { AdminService } from './admin.service';
import { ImportUrlDto, RenameTagDto, UpdateRecipeFullDto } from './admin.dto';
import { CreateRecipeDto } from '../recipes/recipes.dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';

@Controller('admin')
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('recipes')
  listRecipes(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.listRecipes(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }

  @Post('recipes/import-url')
  startImportJob(@Body() dto: ImportUrlDto) {
    return this.adminService.startImportJob(dto.url, dto.force);
  }

  @Get('recipes/import-url/status')
  getImportStatus(@Query('jobId') jobId: string) {
    return this.adminService.getJobSnapshot(jobId);
  }

  @Post('recipes/import-url/resume')
  resumeImportJob(@Query('jobId') jobId: string, @CurrentUser() user: User) {
    return this.adminService.resumeImportJob(jobId, user.id);
  }

  @Post('recipes')
  createRecipe(@Body() dto: CreateRecipeDto, @CurrentUser() user: User) {
    return this.adminService.createRecipe(dto, user.id, dto.force ?? false);
  }

  @Patch('recipes/:id')
  updateRecipe(
    @Param('id') id: string,
    @Body() dto: UpdateRecipeFullDto,
    @CurrentUser() user: User,
  ) {
    return this.adminService.updateRecipe(id, dto, user.id);
  }

  @Delete('recipes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRecipe(@Param('id') id: string, @CurrentUser() user: User) {
    return this.adminService.deleteRecipe(id, user.id);
  }

  @Get('ingredients/search')
  searchIngredients(@Query('q') q = '', @Query('limit') limit?: string) {
    return this.adminService.searchIngredients(q, limit ? Number(limit) : 20);
  }

  @Get('units')
  listUnits() {
    return this.adminService.listUnits();
  }

  @Get('ingredient-categories')
  listIngredientCategories() {
    return this.adminService.listIngredientCategories();
  }

  @Get('tags')
  listTags() {
    return this.adminService.listTags();
  }

  @Post('recipes/:id/suggest-tags')
  suggestTags(@Param('id') id: string) {
    return this.adminService.suggestTags(id);
  }

  @Patch('tags/:id')
  renameTag(@Param('id') id: string, @Body() dto: RenameTagDto) {
    return this.adminService.renameTag(id, dto.name);
  }

  @Delete('tags/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteTag(@Param('id') id: string) {
    return this.adminService.deleteTag(id);
  }

  @Get('audit-logs')
  listAuditLogs(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.adminService.listAuditLogs(
      page ? Number(page) : 1,
      limit ? Number(limit) : 50,
    );
  }
}
