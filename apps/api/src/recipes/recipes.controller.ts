import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { RecipeQueryDto } from './recipes.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('recipes')
@UseGuards(JwtAuthGuard)
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  @Get()
  findAll(@Query() query: RecipeQueryDto) {
    return this.recipesService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.recipesService.findById(id);
  }
}
