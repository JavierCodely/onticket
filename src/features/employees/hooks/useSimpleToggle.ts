import { useState } from 'react';
import { supabase } from '@/core/config/supabase';

export const useSimpleToggle = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleStatus = async (userId: string, currentStatus: 'active' | 'inactive') => {
    try {
      setLoading(true);
      setError(null);

      const newStatus = currentStatus === 'active' ? 'inactive' : 'active';

      console.log('🎯 Simple toggle:', { userId, currentStatus, newStatus });

      // Método 1: Intentar con UPDATE directo
      const { data, error } = await supabase
        .from('employees')
        .update({ status: newStatus })
        .eq('user_id', userId)
        .select('user_id, full_name, status')
        .single();

      if (error) {
        console.error('❌ Method 1 failed:', error);

        // Método 2: Intentar con RPC
        console.log('🔄 Trying RPC method...');
        const { data: rpcData, error: rpcError } = await supabase
          .rpc('toggle_employee_status', { p_user_id: userId });

        if (rpcError) {
          console.error('❌ Method 2 failed:', rpcError);
          throw rpcError;
        }

        console.log('✅ RPC Success:', rpcData);
        return rpcData;
      }

      console.log('✅ Direct Update Success:', data);
      return data;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Error al cambiar estado';
      setError(errorMessage);
      console.error('❌ Toggle error:', err);
      throw new Error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return {
    toggleStatus,
    loading,
    error
  };
};