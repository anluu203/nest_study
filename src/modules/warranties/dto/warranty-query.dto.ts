import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { WarrantyApiStatus } from '../warranty.utils';
import { trimString } from './create-warranty-request.dto';

export class WarrantyQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page = 1;

  @ApiPropertyOptional({ default: 20, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize = 20;

  @ApiPropertyOptional({ maxLength: 200 })
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(200)
  search?: string;
}

export class WarrantyProductQueryDto extends WarrantyQueryDto {
  @ApiPropertyOptional({
    enum: ['all', 'active', 'expired', 'unknown', 'not_covered', 'not_started'],
    default: 'all',
  })
  @IsOptional()
  @IsIn(['all', 'active', 'expired', 'unknown', 'not_covered', 'not_started'])
  coverage = 'all';
}

export class AdminWarrantyProductQueryDto extends WarrantyProductQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}

export class WarrantyRequestQueryDto extends WarrantyQueryDto {
  @ApiPropertyOptional({ enum: WarrantyApiStatus })
  @IsOptional()
  @IsEnum(WarrantyApiStatus)
  status?: WarrantyApiStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Warranty product ID' })
  @IsOptional()
  @IsUUID()
  productId?: string;
}

export class AdminWarrantyRequestQueryDto extends WarrantyRequestQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  ownerId?: string;
}
