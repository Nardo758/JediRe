export interface UserEntity {
  id: string;
  email: string;
  orgId?: string;
  role?: string;
}
export class User implements UserEntity {
  id: string = '';
  email: string = '';
}
export default User;
