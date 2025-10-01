import React, { createContext, useState, useEffect, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase } from '@/core/config/supabase';
import { authService } from '@/features/auth/services/auth';
import type { AuthContextType, AuthState, LoginCredentials } from '@/features/auth/types/auth';


const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [state, setState] = useState<AuthState>({
    user: null,
    admin: null,
    employee: null,
    userRole: 'none',
    isLoading: true,
    isAuthenticated: false,
  });

  // Función para actualizar el estado de autenticación
  const updateAuthState = async (user: User | null) => {
    if (!user) {
      setState({
        user: null,
        admin: null,
        employee: null,
        userRole: 'none',
        isLoading: false,
        isAuthenticated: false,
      });
      return;
    }

    try {
      const { admin, employee, userRole } = await authService.getCurrentUserData();

      console.log('AuthContext updateAuthState:', {
        userId: user.id,
        userEmail: user.email,
        admin: admin ? { id: admin.user_id, status: admin.status, clubId: admin.club_id } : null,
        employee: employee ? { id: employee.user_id, status: employee.status, category: employee.category } : null,
        userRole,
        isAuthenticated: userRole !== 'none'
      });

      setState({
        user,
        admin,
        employee,
        userRole,
        isLoading: false,
        isAuthenticated: userRole !== 'none',
      });
    } catch (error) {
      console.error('Error fetching user data:', error);
      setState({
        user,
        admin: null,
        employee: null,
        userRole: 'none',
        isLoading: false,
        isAuthenticated: false,
      });
    }
  };

  // Configurar listener de cambios de autenticación
  useEffect(() => {
    // Obtener sesión inicial
    supabase.auth.getSession().then(({ data: { session } }) => {
      updateAuthState(session?.user ?? null);
    });

    // Escuchar cambios de autenticación
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        updateAuthState(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  // Función de login
  const login = async (credentials: LoginCredentials) => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await authService.signIn(credentials);
      // El estado se actualizará automáticamente por el listener
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Función de logout
  const logout = async () => {
    setState(prev => ({ ...prev, isLoading: true }));
    
    try {
      await authService.signOut();
      // El estado se actualizará automáticamente por el listener
    } catch (error) {
      setState(prev => ({ ...prev, isLoading: false }));
      throw error;
    }
  };

  // Función para refrescar datos del usuario (admin o empleado)
  const refreshUserData = async () => {
    if (!state.user) return;

    try {
      const { admin, employee, userRole } = await authService.getCurrentUserData();
      setState(prev => ({
        ...prev,
        admin,
        employee,
        userRole,
        isAuthenticated: userRole !== 'none'
      }));
    } catch (error) {
      console.error('Error refreshing user data:', error);
    }
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshUserData,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };
