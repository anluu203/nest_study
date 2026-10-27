import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

export class UpdateWarrantySerialDto {
  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 200 })
  @ValidateIf(
    (_object, value: unknown) => value !== undefined && value !== null,
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  serial?: string | null;
}

export class RegisterWarrantyProductDto extends UpdateWarrantySerialDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  orderItemId!: string;

  @ApiProperty({
    minimum: 1,
    description: 'Physical unit number within the order item quantity',
  })
  @IsInt()
  @Min(1)
  unitNumber!: number;

  @ApiProperty({
    example: '2026-10-28',
    description: 'Verified purchase/delivery date for historical orders',
  })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  purchasedAt!: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1200,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1200)
  warrantyMonths?: number | null;
}

export class UpdateWarrantyProductDto extends UpdateWarrantySerialDto {
  @ApiPropertyOptional({ example: '2026-10-28' })
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  @IsDateString({ strict: true })
  purchasedAt?: string;

  @ApiPropertyOptional({
    type: Number,
    nullable: true,
    minimum: 0,
    maximum: 1200,
  })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(1200)
  warrantyMonths?: number | null;
}
