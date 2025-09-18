import { supabase } from '@/core/config/supabase';
import type { LoginCredentials, UserRole } from '@/features/auth/types/auth';
import type { Admin, Employee } from '@/core/types/database';

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

  // Obtener datos del empleado actual
  async getCurrentEmployee(): Promise<Employee | null> {
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
      throw userError || new Error('No authenticated user');
    }

    const { data: employee, error: employeeError } = await supabase
      .from('employees')
      .select(`
        *,
        club:clubs(*)
      `)
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (employeeError) {
      // Si no es un empleado activo, retorna null
      if (employeeError.code === 'PGRST116') {
        return null;
      }
      throw employeeError;
    }

    return employee as Employee;
  },

  // Obtener el rol del usuario actual
  async getUserRole(): Promise<UserRole> {
    try {
      const [admin, employee] = await Promise.all([
        this.getCurrentAdmin(),
        this.getCurrentEmployee()
      ]);

      if (admin) return 'admin';
      if (employee) return 'employee';
      return 'none';
    } catch {
      return 'none';
    }
  },

  // Obtener datos completos del usuario (admin o empleado)
  async getCurrentUserData(): Promise<{ admin: Admin | null; employee: Employee | null; userRole: UserRole }> {
    try {
      const [admin, employee] = await Promise.all([
        this.getCurrentAdmin().catch(() => null),
        this.getCurrentEmployee().catch(() => null)
      ]);

      let userRole: UserRole = 'none';
      if (admin) userRole = 'admin';
      else if (employee) userRole = 'employee';

      return { admin, employee, userRole };
    } catch (error) {
      console.error('Error getting user data:', error);
      return { admin: null, employee: null, userRole: 'none' };
    }
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

  // Verificar si el usuario actual es un empleado activo
  async isActiveEmployee(): Promise<boolean> {
    try {
      const employee = await this.getCurrentEmployee();
      return employee !== null && employee.status === 'active';
    } catch {
      return false;
    }
  },

  // Obtener el club del usuario actual (admin o empleado)
  async getCurrentClub() {
    const { admin, employee } = await this.getCurrentUserData();
    return admin?.club || employee?.club || null;
  }
};
