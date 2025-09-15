import { supabase } from '@/core/config/supabase';
import type { LoginCredentials } from '@/features/auth/types/auth';
import type { Admin } from '@/core/types/database';

export const authService = {
  // Login del usuario
  async signIn(credentials: LoginCredentials) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: credentials.email,
      password: credentials.password,
    });

    if (error) throw error;
    return data;
  },

  // Logout
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  // Obtener datos del admin actual
  async getCurrentAdmin(): Promise<Admin | null> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      throw userError || new Error('No authenticated user');
    }

    const { data: admin, error: adminError } = await supabase
      .from('admins')
      .select(`
        *,
        club:clubs(*)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (adminError) {
      // Si no es un admin activo, retorna null (no es un error de autenticación)
      if (adminError.code === 'PGRST116') {
        return null;
      }
      throw adminError;
    }

    return admin as Admin;
  },

  // Verificar si el usuario actual es un admin activo
  async isActiveAdmin(): Promise<boolean> {
    try {
      const admin = await this.getCurrentAdmin();
      return admin !== null && admin.status === 'active';
    } catch {
      return false;
    }
  },

  // Obtener el club del admin actual
  async getCurrentClub() {
    const admin = await this.getCurrentAdmin();
    return admin?.club || null;
  }
};
