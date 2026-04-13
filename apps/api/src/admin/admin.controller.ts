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
import { AdminService } from './admin.service';
import { ImportUrlDto, UpdateRecipeDto } from './admin.dto';
import { CreateRecipeDto } from '../recipes/recipes.dto';
import { AdminGuard } from '../auth/guards/admin.guard';

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
    return this.adminService.startImportJob(dto.url);
  }

  @Get('recipes/import-url/status')
  getImportStatus(@Query('jobId') jobId: string) {
    return this.adminService.getJobSnapshot(jobId);
  }

  @Post('recipes')
  createRecipe(@Body() dto: CreateRecipeDto) {
    return this.adminService.createRecipe(dto);
  }

  @Patch('recipes/:id')
  updateRecipe(@Param('id') id: string, @Body() dto: UpdateRecipeDto) {
    return this.adminService.updateRecipe(id, dto);
  }

  @Delete('recipes/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteRecipe(@Param('id') id: string) {
    return this.adminService.deleteRecipe(id);
  }
}
