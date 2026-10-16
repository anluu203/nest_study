import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { IsImageUrl } from '../../../core/validators/is-image-url.decorator';

export class CreateProductDto {
  @ApiProperty({ example: 'AMD Ryzen 7 7800X3D' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: 'https://example.com/product.jpg',
  })
  @IsOptional()
  @IsImageUrl()
  imageUrl?: string | null;

  @ApiProperty({ type: String, example: '8000000' })
  @IsString()
  @MaxLength(12)
  @Matches(/^[1-9]\d*$/, { message: 'price must be a positive VND integer' })
  price!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;
}
