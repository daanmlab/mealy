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
  Sse,
  UseGuards,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
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

  @Sse('recipes/import-url/stream')
  importStream(@Query('jobId') jobId: string): Observable<MessageEvent> {
    return this.adminService
      .getJobStream(jobId)
      .pipe(map((event) => ({ data: event }) as MessageEvent));
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
