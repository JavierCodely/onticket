import { useState, useEffect } from 'react';
import { supabase } from '@/core/config/supabase';
import type { Employee, UpdateEmployeeData } from '@/core/types/database';
import { useAuth } from '@/features/auth/hooks/useAuth';

// Hook con SQL directo para debugging
export const useEmployeesDebugSQL = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const fetchEmployees = async () => {
    if (!user) return;

    try {
      setLoading(true);
      setError(null);

      const { data, error } = await supabase
        .from('employees')
        .select(`
          *,
          club:clubs(*)
        `)
        .order('full_name');

      if (error) throw error;

      setEmployees(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar empleados');
    } finally {
      setLoading(false);
    }
  };

  const updateEmployeeSQL = async (userId: string, updates: UpdateEmployeeData) => {
    try {
      setError(null);

      console.log('🔍 SQL Update - Starting:', { userId, updates });

      // Verificar usuario actual
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      console.log('🔍 Current user:', currentUser?.id);

      // Verificar admin y club
      const { data: adminCheck } = await supabase
        .rpc('fn_debug_employee_permissions', { p_user_id: userId });

      console.log('🔍 Admin permissions check:', adminCheck);

      // Intentar SQL directo con rpc
      const { data, error } = await supabase
        .rpc('update_employee_status', {
          p_user_id: userId,
          p_updates: updates
        });

      console.log('🔍 RPC Update result:', { data, error });

      if (error) {
        // Si falla RPC, intentar UPDATE normal
        console.log('🔄 Fallback to direct UPDATE...');

        const { data: directData, error: directError } = await supabase
          .from('employees')
          .update(updates)
          .eq('user_id', userId)
          .select(`
            *,
            club:clubs(*)
          `)
          .single();

        console.log('🔍 Direct Update result:', { data: directData, error: directError });

        if (directError) throw directError;

        setEmployees(prev =>
          prev.map(emp => emp.user_id === userId ? directData : emp)
        );

        return directData;
      }

      // Si RPC funcionó, refrescar datos
      await fetchEmployees();
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar empleado';
      console.error('❌ SQL Update error:', err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const toggleEmployeeStatusSQL = async (userId: string) => {
    const employee = employees.find(emp => emp.user_id === userId);
    if (!employee) {
      console.error('❌ Employee not found:', userId);
      return;
    }

    const newStatus = employee.status === 'active' ? 'inactive' : 'active';
    console.log('🔄 SQL Toggle status:', { userId, currentStatus: employee.status, newStatus });

    return updateEmployeeSQL(userId, { status: newStatus });
  };

  useEffect(() => {
    fetchEmployees();
  }, [user]);

  return {
    employees,
    loading,
    error,
    updateEmployee: updateEmployeeSQL,
    toggleEmployeeStatus: toggleEmployeeStatusSQL,
    refetch: fetchEmployees
  };
};