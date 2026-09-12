import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { UserRole } from '../../core/constants/user-role.enum';
import { Public } from '../../core/decorators/public.decorator';
import { Roles } from '../../core/decorators/roles.decorator';
import { CategoryParentsService } from './category-parents.service';
import { CreateCategoryParentDto } from './dto/create-category-parent.dto';
import { UpdateCategoryParentDto } from './dto/update-category-parent.dto';

@ApiTags('Category Parents')
@Controller('category-parents')
export class CategoryParentsController {
  constructor(private readonly service: CategoryParentsService) {}

  @Public()
  @Get()
  findAll() {
    return this.service.findAll();
  }

  @Public()
  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @Post()
  create(@Body() dto: CreateCategoryParentDto) {
    return this.service.create(dto);
  }

  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryParentDto,
  ) {
    return this.service.update(id, dto);
  }

  @ApiBearerAuth('JWT-auth')
  @Roles(UserRole.ADMIN)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
