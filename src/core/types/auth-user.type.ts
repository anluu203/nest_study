import { UserRole } from '../constants/user-role.enum';

export interface AuthUser {
  sub: string;
  email: string;
  role: UserRole;
}
