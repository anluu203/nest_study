export type ImageFolder = 'avatars' | 'products' | 'categories';

export interface StoredImage {
  imageUrl: string;
}

// Cloud adapters can implement this contract without changing upload consumers.
export abstract class ImageStorage {
  abstract save(
    folder: ImageFolder,
    data: Buffer,
    extension: string,
  ): Promise<StoredImage>;
}
