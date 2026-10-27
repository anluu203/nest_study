import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { WarrantyApiStatus } from '../warranty.utils';
import { trimString } from './create-warranty-request.dto';

export class UpdateWarrantyRequestDto {
  @ApiProperty({ enum: WarrantyApiStatus })
  @IsEnum(WarrantyApiStatus)
  status!: WarrantyApiStatus;

  @ApiProperty({
    maxLength: 2000,
    description: 'Visible to the customer in the timeline',
  })
  @Transform(trimString)
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  note!: string;
}
