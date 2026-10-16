import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { CreateCategoryParentDto } from '../../modules/categories/dto/create-category-parent.dto';
import { CreateCategoryDto } from '../../modules/categories/dto/create-category.dto';
import { CreateProductDto } from '../../modules/products/dto/create-product.dto';
import { UpdateUserDto } from '../../modules/users/dto/update-user.dto';
import { isImageUrl } from './is-image-url.decorator';

describe('Image URL validation', () => {
  it.each([
    'https://hosting.example/photo.png?token=abc',
    'http://localhost:8080/images/products/photo.png',
    '/images/avatars/550e8400-e29b-41d4-a716-446655440000.png',
    '/images/products/550e8400-e29b-41d4-a716-446655440000.jpg',
    '/images/categories/550e8400-e29b-41d4-a716-446655440000.webp',
  ])('accepts %s', (url) => expect(isImageUrl(url)).toBe(true));

  it.each([
    'javascript:alert(1)',
    'data:image/png;base64,abc',
    'ftp://hosting.example/photo.jpg',
    '//hosting.example/photo.jpg',
    '/images/../.env',
    '/images/products/../../.env',
    '/images/products/photo.svg',
    'https://user:secret@hosting.example/photo.png',
    'https://hosting.example/' + 'a'.repeat(2048),
    '',
    null,
    42,
  ])('rejects %s', (url) => expect(isImageUrl(url)).toBe(false));

  it('validates both URL sources and null through every affected DTO', async () => {
    for (const imageUrl of [
      null,
      'https://hosting.example/photo.jpg',
      '/images/products/550e8400-e29b-41d4-a716-446655440000.jpg',
    ]) {
      const dtos = [
        plainToInstance(UpdateUserDto, { avatarUrl: imageUrl }),
        plainToInstance(CreateCategoryParentDto, {
          name: 'Components',
          imageUrl,
        }),
        plainToInstance(CreateCategoryDto, {
          name: 'CPU',
          parentId: '550e8400-e29b-41d4-a716-446655440000',
          imageUrl,
        }),
        plainToInstance(CreateProductDto, {
          name: 'CPU',
          price: '1000',
          categoryId: '550e8400-e29b-41d4-a716-446655440000',
          imageUrl,
        }),
      ];
      for (const dto of dtos) expect(await validate(dto)).toEqual([]);
    }
    expect(
      await validate(
        plainToInstance(UpdateUserDto, { avatarUrl: 'javascript:alert(1)' }),
      ),
    ).toHaveLength(1);
  });
});
