import { Controller, Body, Patch } from '@nestjs/common';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';
import { CurrentUser } from '../../core/decorators/current-user.decorator';
import type { AuthUser } from '../../core/types/auth-user.type';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

@ApiTags('Users')
@ApiBearerAuth('JWT-auth')
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Patch('me')
  update(
    @CurrentUser() currentUser: AuthUser,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(currentUser.sub, updateUserDto);
  }
}
