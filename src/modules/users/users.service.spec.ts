import type { Repository } from 'typeorm';
import { UserRole } from '../../core/constants/user-role.enum';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';

describe('UsersService avatar', () => {
  it('persists avatar changes and removes avatars without exposing the password', async () => {
    const user = Object.assign(new User(), {
      id: 'user-id',
      username: 'User',
      email: 'user@example.com',
      role: UserRole.USER,
      passwordHash: 'secret',
      avatarUrl: null,
    });
    const repository = {
      findOne: jest.fn().mockResolvedValue(user),
      save: jest
        .fn()
        .mockImplementation((entity: User) => Promise.resolve(entity)),
    };
    const service = new UsersService(repository as unknown as Repository<User>);
    const avatarUrl =
      '/images/avatars/550e8400-e29b-41d4-a716-446655440000.png';
    const updated = await service.update(user.id, { avatarUrl });
    expect(repository.save).toHaveBeenCalledWith(
      expect.objectContaining({ avatarUrl }),
    );
    expect(updated.avatarUrl).toBe(avatarUrl);
    expect(updated).not.toHaveProperty('passwordHash');
    expect(
      (await service.update(user.id, { username: 'Renamed' })).avatarUrl,
    ).toBe(avatarUrl);
    expect(
      (await service.update(user.id, { avatarUrl: null })).avatarUrl,
    ).toBeNull();
  });
});
