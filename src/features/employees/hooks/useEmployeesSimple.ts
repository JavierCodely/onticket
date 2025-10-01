import { useState, useEffect } from 'react';
import { supabase } from '@/core/config/supabase';
import type { Employee, UpdateEmployeeData } from '@/core/types/database';
import { useAuth } from '@/features/auth/hooks/useAuth';

export const useEmployeesSimple = () => {
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

  const updateEmployee = async (userId: string, updates: UpdateEmployeeData) => {
    try {
      setError(null);

      // Limpiar campos vacíos antes de enviar
      const cleanUpdates = Object.fromEntries(
        Object.entries(updates).filter(([key, value]) => {
          if (value === '' || value === null) return false;
          if (typeof value === 'string' && value.trim() === '') return false;
          return true;
        })
      ) as UpdateEmployeeData;

      console.log('🔍 Updating employee:', { userId, originalUpdates: updates, cleanUpdates });

      // Verificar usuario actual
      const { data: { user } } = await supabase.auth.getUser();
      console.log('🔍 Current user:', user?.id);

      // Verificar admin
      const { data: admin } = await supabase
        .from('admins')
        .select('club_id, status')
        .eq('user_id', user?.id)
        .single();

      console.log('🔍 Admin data:', admin);

      const { data, error } = await supabase
        .from('employees')
        .update(cleanUpdates)
        .eq('user_id', userId)
        .select(`
          *,
          club:clubs(*)
        `)
        .single();

      console.log('🔍 Update result:', { data, error });

      if (error) throw error;

      setEmployees(prev =>
        prev.map(emp => emp.user_id === userId ? data : emp)
      );

      console.log('✅ Employee updated successfully:', data);
      return data;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al actualizar empleado';
      console.error('❌ Update error:', err);
      setError(errorMessage);
      throw new Error(errorMessage);
    }
  };

  const toggleEmployeeStatus = async (userId: string) => {
    const employee = employees.find(emp => emp.user_id === userId);
    if (!employee) {
      console.error('❌ Employee not found:', userId);
      return;
    }

    const newStatus = employee.status === 'active' ? 'inactive' : 'active';
    console.log('🔄 Toggling status:', { userId, currentStatus: employee.status, newStatus });

    return updateEmployee(userId, { status: newStatus });
  };

  useEffect(() => {
    fetchEmployees();
  }, [user]);

  return {
    employees,
    loading,
    error,
    updateEmployee,
    toggleEmployeeStatus,
    refetch: fetchEmployees
  };
};