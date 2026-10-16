import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsImageUrl } from '../../../core/validators/is-image-url.decorator';

export class CreateCategoryDto {
  @ApiProperty({ example: 'CPU' })
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://example.com/category.png',
  })
  @IsOptional()
  @IsImageUrl()
  imageUrl?: string | null;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  parentId!: string;
}
