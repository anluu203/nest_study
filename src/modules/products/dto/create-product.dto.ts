import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  IsInt,
  IsArray,
  IsObject,
  Min,
  Max,
  ValidateIf,
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

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  @Matches(/\S/, { message: 'sku cannot be blank' })
  sku?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  brand?: string | null;

  @ApiPropertyOptional({ type: String, nullable: true, example: '7500000' })
  @IsOptional()
  @IsString()
  @MaxLength(12)
  @Matches(/^(0|[1-9]\d*)$/)
  discountPrice?: string | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  stockQuantity?: number | null;

  @ApiPropertyOptional({
    type: [String],
    example: ['https://example.com/cpu.webp'],
  })
  @ValidateIf((_object, value) => value !== undefined)
  @IsArray()
  @IsString({ each: true })
  @IsImageUrl({ each: true })
  images?: string[];

  @ApiPropertyOptional({ type: Number, nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(2147483647)
  warrantyMonths?: number | null;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    example: {
      socket: 'AM5',
      tdp: 120,
      supportedRam: ['DDR5'],
      cores: 8,
      threads: 16,
      hasIntegratedGpu: true,
    },
    description:
      'Technical JSON object for CPU, mainboard, RAM, GPU, PSU, storage, case or CPU cooler. Unknown legacy specifications remain null.',
  })
  @IsOptional()
  @IsObject()
  specifications?: Record<string, unknown> | null;
}
