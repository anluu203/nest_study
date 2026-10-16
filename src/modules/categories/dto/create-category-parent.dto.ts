import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsImageUrl } from '../../../core/validators/is-image-url.decorator';

export class CreateCategoryParentDto {
  @ApiProperty({ example: 'Linh kiện máy tính' })
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
}
