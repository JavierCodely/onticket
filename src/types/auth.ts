import type { User } from '@supabase/supabase-js';
import type { Admin } from './database';

export interface AuthState {
  user: User | null;
  admin: Admin | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthContextType extends AuthState {
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
}
