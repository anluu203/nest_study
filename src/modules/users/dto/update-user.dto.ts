import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { IsImageUrl } from '../../../core/validators/is-image-url.decorator';
import { ProfileFieldsDto } from './profile-fields.dto';

export class UpdateUserDto extends ProfileFieldsDto {
  @ApiPropertyOptional({ example: 'nguyenvana' })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  username?: string;

  @ApiPropertyOptional({
    type: String,
    nullable: true,
    example: '/images/avatars/550e8400-e29b-41d4-a716-446655440000.png',
    description:
      'Uploaded image path or public HTTP(S) URL. Send null to remove the avatar.',
  })
  @IsOptional()
  @IsImageUrl()
  avatarUrl?: string | null;
}
