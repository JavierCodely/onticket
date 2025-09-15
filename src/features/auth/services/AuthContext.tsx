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
    isLoading: true,
    isAuthenticated: false,
  });

  // Función para actualizar el estado de autenticación
  const updateAuthState = async (user: User | null) => {
    if (!user) {
      setState({
        user: null,
        admin: null,
        isLoading: false,
        isAuthenticated: false,
      });
      return;
    }

    try {
      const admin = await authService.getCurrentAdmin();
      
      setState({
        user,
        admin,
        isLoading: false,
        isAuthenticated: true,
      });
    } catch (error) {
      console.error('Error fetching admin data:', error);
      setState({
        user,
        admin: null,
        isLoading: false,
        isAuthenticated: false, // No es un admin válido
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

  // Función para refrescar datos del admin
  const refreshAdmin = async () => {
    if (!state.user) return;
    
    try {
      const admin = await authService.getCurrentAdmin();
      setState(prev => ({ ...prev, admin }));
    } catch (error) {
      console.error('Error refreshing admin data:', error);
    }
  };

  const contextValue: AuthContextType = {
    ...state,
    login,
    logout,
    refreshAdmin,
  };

  return (
    <AuthContext.Provider value={contextValue}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthContext };
