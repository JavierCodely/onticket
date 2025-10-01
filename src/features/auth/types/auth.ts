import type { User } from '@supabase/supabase-js';
import type { Admin, Employee } from '@/core/types/database';

export type { Admin, Employee };

export type UserRole = 'admin' | 'employee' | 'none';

export interface AuthState {
  user: User | null;
  admin: Admin | null;
  employee: Employee | null;
  userRole: UserRole;
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
  refreshUserData: () => Promise<void>;
}
