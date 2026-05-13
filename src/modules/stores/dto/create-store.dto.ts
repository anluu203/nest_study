import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
/**
 * DTO dùng để tạo mới cửa hàng (Store)
 *
 * @example
 * {
 *   "name": "Cửa hàng Toryama số 9",
 *   "description": "Quán ăn Nhật Bản nổi tiếng với món mì ramen ngon tuyệt vời.",
 *   "address": "123 Nguyễn Trãi, Hà Nội",
 *   "imageUrl": "https://example.com/store.jpg"
 * }
 *
 */
export class CreateStoreDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;

  @ApiProperty()
  @IsString()
  description?: string;

  @ApiProperty()
  @IsString()
  address?: string;

  @ApiProperty()
  @IsString()
  imageUrl?: string;
}
