import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
} from 'class-validator';

export const trimString = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateWarrantyRequestDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Warranty product ID, not catalog product ID',
  })
  @IsUUID()
  productId!: string;

  @ApiProperty({ maxLength: 200 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  contactName!: string;

  @ApiProperty({ example: '0900000000', maxLength: 30 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.replace(/[\s.-]/g, '') : value,
  )
  @IsString()
  @Matches(/^(?:0\d{9}|\+84\d{9})$/)
  @MaxLength(30)
  phone!: string;

  @ApiProperty({ maxLength: 2000 })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  description!: string;
}
