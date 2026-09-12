import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUrl,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

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

  @ApiPropertyOptional({ example: 'https://example.com/product.jpg' })
  @IsOptional()
  @IsUrl({ require_tld: false })
  imageUrl?: string;

  @ApiProperty({ type: String, example: '8000000' })
  @IsString()
  @MaxLength(12)
  @Matches(/^[1-9]\d*$/, { message: 'price must be a positive VND integer' })
  price!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  categoryId!: string;
}
