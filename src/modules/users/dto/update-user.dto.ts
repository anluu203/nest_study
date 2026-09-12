import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateUserDto {
  @ApiPropertyOptional({ example: 'nguyenvana' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  username?: string;
}
