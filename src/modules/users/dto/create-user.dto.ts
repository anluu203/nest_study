import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsEmail, MinLength, MaxLength } from 'class-validator';

export class CreateUserDto {
  @ApiProperty({ example: 'nguyenvana' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  readonly username!: string;

  @ApiProperty({ example: 'user@example.com' })
  @IsEmail()
  @MaxLength(320)
  readonly email!: string;

  @ApiProperty({ minLength: 8, example: 'password123' })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  readonly password!: string;
}
