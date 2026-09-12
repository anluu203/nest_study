import { PartialType } from '@nestjs/swagger';
import { CreateCategoryParentDto } from './create-category-parent.dto';

export class UpdateCategoryParentDto extends PartialType(
  CreateCategoryParentDto,
) {}
