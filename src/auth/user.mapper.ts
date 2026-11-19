import { PublicUser } from './auth.types';

export function toPublicUser(u: {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  mustChangePassword: boolean;
}): PublicUser {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role as PublicUser['role'],
    status: u.status as PublicUser['status'],
    avatarUrl: u.avatarUrl,
    mustChangePassword: u.mustChangePassword,
  };
}
