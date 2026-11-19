export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  status: 'ACTIVE' | 'PENDING' | 'DISABLED';
  avatarUrl: string | null;
  mustChangePassword: boolean;
}

export interface SessionTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResult {
  user: PublicUser;
  tokens: SessionTokens;
}
