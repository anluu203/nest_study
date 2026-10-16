import { registerDecorator, ValidationOptions, isURL } from 'class-validator';

export function isImageUrl(value: unknown): boolean {
  if (typeof value !== 'string' || value.length > 2048) return false;
  // Only allow paths produced by our upload API, never arbitrary local paths.
  if (
    /^\/images\/(avatars|products|categories)\/[a-f0-9-]+\.(jpg|png|gif|webp)$/.test(
      value,
    )
  ) {
    return true;
  }
  return isURL(value, {
    protocols: ['http', 'https'],
    require_protocol: true,
    require_tld: false,
    disallow_auth: true,
  });
}

export function IsImageUrl(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isImageUrl',
      target: target.constructor,
      propertyName: propertyKey.toString(),
      options,
      validator: {
        validate: isImageUrl,
        defaultMessage: () =>
          '$property must be an HTTP(S) URL or an uploaded /images path (max 2048 characters)',
      },
    });
  };
}
